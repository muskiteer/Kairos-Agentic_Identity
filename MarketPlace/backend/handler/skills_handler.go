package handler

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	agentid "agentid-sdk"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

const (
	// How old a request timestamp can be (fail-closed).
	freshnessWindow = 5 * time.Minute
)

type signatureEnvelope struct {
	RequestID string `json:"request_id"`
	TraceID   string `json:"trace_id"`
	Action    string `json:"action"`
	FromAgent string `json:"from_agent"`
	ToAgent   string `json:"to_agent"`
	SkillID   string `json:"skill_id"`
	SchemaVer string `json:"schema_version"`
	Nonce     string `json:"nonce"`
	Timestamp int64  `json:"timestamp"`
}

func containsString(arr []string, v string) bool {
	for _, s := range arr {
		if s == v {
			return true
		}
	}
	return false
}

func canonicalSignatureText(env ProtocolEnvelope, payload map[string]any) (string, error) {
	// This must match the frontend’s canonicalization strategy.
	// - Envelope is marshaled from a struct (field order is stable)
	// - Payload is marshaled via json.Marshal (map keys are sorted by encoding/json)
	envForSig := signatureEnvelope{
		RequestID: env.RequestID,
		TraceID:   env.TraceID,
		Action:    env.Action,
		FromAgent: env.FromAgent,
		ToAgent:   env.ToAgent,
		SkillID:   env.SkillID,
		SchemaVer: env.SchemaVer,
		Nonce:     env.Nonce,
		Timestamp: env.Timestamp,
	}
	envBytes, err := json.Marshal(envForSig)
	if err != nil {
		return "", err
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(envBytes) + "::" + string(payloadBytes), nil
}

func computeNonceReplayKey(fromAgent, nonce string) bson.M {
	return bson.M{
		"from_agent": fromAgent,
		"nonce":      nonce,
	}
}

func writeAuditRejection(ctx context.Context, db *mongo.Database, reasonCode string, req SkillExecutionRequest, skillID string) {
	fromAgent := strings.TrimSpace(req.Protocol.FromAgent)
	_, _ = db.Collection("audit_logs").InsertOne(ctx, bson.M{
		"status":       "rejected",
		"reason_code":  reasonCode,
		"request_id":   strings.TrimSpace(req.Protocol.RequestID),
		"trace_id":     strings.TrimSpace(req.Protocol.TraceID),
		"from_agent":   fromAgent,
		"to_agent":     strings.TrimSpace(req.Protocol.ToAgent),
		"skill_id":     skillID,
		"schema_version": strings.TrimSpace(req.Protocol.SchemaVer),
		"nonce":        strings.TrimSpace(req.Protocol.Nonce),
		"created_at":   time.Now().UTC(),
	})
}


// ProtocolEnvelope is the typed subset we store for auditability.
// The frontend sends a richer envelope; we persist what we can.
type ProtocolEnvelope struct {
	RequestID string `json:"request_id"`
	TraceID   string `json:"trace_id"`
	Action    string `json:"action"`
	FromAgent string `json:"from_agent"`
	ToAgent   string `json:"to_agent"`
	SkillID   string `json:"skill_id"`
	SchemaVer string `json:"schema_version"`
	Nonce     string `json:"nonce"`
	Timestamp int64  `json:"timestamp"`
	Signature string `json:"signature"`
}

type SkillManifest struct {
	Name          string         `bson:"name" json:"name"`
	Version       string         `bson:"version" json:"version"`
	SchemaVersion string         `bson:"schema_version" json:"schemaVersion"`
	InputSchema   map[string]any `bson:"input_schema,omitempty" json:"inputSchema,omitempty"`
	OutputSchema  map[string]any `bson:"output_schema,omitempty" json:"outputSchema,omitempty"`
	LatencyMs     int            `bson:"latency_ms" json:"latencyMs"`
	Auth          map[string]any `bson:"auth,omitempty" json:"auth,omitempty"`
	Capabilities  []string       `bson:"capabilities,omitempty" json:"capabilities,omitempty"`
	Reputation    float64        `bson:"reputation" json:"reputation"`
	Availability  float64        `bson:"availability" json:"availability"`
	Description   string         `bson:"description,omitempty" json:"description,omitempty"`
}

type SkillManifestDoc struct {
	SkillID         string        `bson:"skill_id" json:"skill_id"`
	ProviderAgentID string        `bson:"provider_agent_id" json:"provider_agent_id"`
	Price           int           `bson:"price" json:"price"`
	Manifest        SkillManifest `bson:"manifest" json:"manifest"`
}

type SkillListItem struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Cost        int           `json:"cost"`
	Manifest    SkillManifest `json:"manifest"`
	Provider    AgentInfoLite `json:"provider,omitempty"`
}

type AgentInfoLite struct {
	AgentID     string `json:"agent_id"`
	Description string `json:"description,omitempty"`
}

type SkillExecutionRequest struct {
	Protocol  ProtocolEnvelope `json:"protocol"`
	AgentID   string           `json:"agentId"`
	Pseudonym string           `json:"pseudonym"`
	Payload   map[string]any   `json:"payload"`
}

func SkillsListHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		cur, err := db.Collection("skill_manifests").Find(ctx, bson.M{})
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer cur.Close(ctx)

		items := make([]SkillListItem, 0)
		for cur.Next(ctx) {
			var doc SkillManifestDoc
			if err := cur.Decode(&doc); err != nil {
				continue
			}

			// Provider metadata (optional but nice for UI).
			provider := AgentInfoLite{AgentID: doc.ProviderAgentID}
			{
				var a struct {
					AgentID     string `bson:"agent_id" json:"agent_id"`
					Description string `bson:"description" json:"description"`
				}
				_ = db.Collection("agents").FindOne(ctx, bson.M{"agent_id": doc.ProviderAgentID}).Decode(&a)
				if a.AgentID != "" {
					provider.AgentID = a.AgentID
					provider.Description = a.Description
				}
			}

			items = append(items, SkillListItem{
				ID:          doc.SkillID,
				Name:        doc.SkillID,
				Description: doc.Manifest.Description,
				Cost:        doc.Price,
				Manifest:    doc.Manifest,
				Provider:    provider,
			})
		}

		writeJSON(w, http.StatusOK, items)
	}
}

func SkillsExecuteHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		skillID := strings.TrimSpace(r.PathValue("skill"))
		if skillID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "skill path param is required"})
			return
		}

		var req SkillExecutionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
		defer cancel()

		// --- Fail-closed verification-first ---
		fail := func(reasonCode string, msg string) {
			writeAuditRejection(ctx, db, reasonCode, req, skillID)
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": msg, "reason_code": reasonCode})
		}

		fromAgent := strings.TrimSpace(req.Protocol.FromAgent)
		toAgent := strings.TrimSpace(req.Protocol.ToAgent)
		nonce := strings.TrimSpace(req.Protocol.Nonce)
		timestamp := req.Protocol.Timestamp
		schemaVer := strings.TrimSpace(req.Protocol.SchemaVer)
		requestID := strings.TrimSpace(req.Protocol.RequestID)
		traceID := strings.TrimSpace(req.Protocol.TraceID)
		sigB64 := strings.TrimSpace(req.Protocol.Signature)

		if fromAgent == "" || nonce == "" || timestamp == 0 || schemaVer == "" || sigB64 == "" {
			fail("malformed_request", "protocol envelope missing required fields")
			return
		}
		if strings.TrimSpace(req.AgentID) == "" || strings.TrimSpace(req.AgentID) != fromAgent {
			fail("malformed_request", "agentId/from_agent mismatch")
			return
		}
		if req.Protocol.SkillID != "" && strings.TrimSpace(req.Protocol.SkillID) != skillID {
			fail("malformed_request", "skill_id mismatch between path and protocol")
			return
		}

		// timestamp freshness check (timestamp is milliseconds since epoch)
		nowMs := time.Now().UnixMilli()
		delta := nowMs - timestamp
		if delta < 0 {
			delta = -delta
		}
		if delta > int64(freshnessWindow/time.Millisecond) {
			fail("expired_timestamp", "timestamp freshness window exceeded")
			return
		}

		// Load manifest so we can validate schema/version consistency.
		var manifestDoc SkillManifestDoc
		if err := db.Collection("skill_manifests").FindOne(ctx, bson.M{"skill_id": skillID}).Decode(&manifestDoc); err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "skill not found"})
			return
		}

		if manifestDoc.Manifest.SchemaVersion != schemaVer {
			fail("schema_version_mismatch", "schema_version mismatch")
			return
		}

		// Authorization check: does requesting agent allow this skill?
		var sender Agent
		if err := db.Collection("agents").FindOne(ctx, bson.M{"agent_id": fromAgent}).Decode(&sender); err != nil {
			fail("unauthorized", "sender agent not registered")
			return
		}
		if sender.PublicKey == "" {
			fail("malformed_request", "sender public key is missing")
			return
		}
		if len(sender.AllowedSkills) > 0 && !containsString(sender.AllowedSkills, skillID) {
			fail("unauthorized", "sender not allowed to request this skill")
			return
		}

		// nonce replay protection
		if nonce != "" {
			if err := db.Collection("nonce_replays").FindOne(ctx, computeNonceReplayKey(fromAgent, nonce)).Err(); err == nil {
				fail("replay_nonce", "nonce replay detected")
				return
			} else if err != mongo.ErrNoDocuments {
				fail("malformed_request", "nonce replay lookup failed")
				return
			}
		}

		// Signature verification (SDK VerifySignature)
		// signature covers canonical protocol envelope + payload.
		sigBytes, err := base64.StdEncoding.DecodeString(sigB64)
		if err != nil {
			fail("invalid_signature", "signature is not valid base64")
			return
		}

		// public key stored as hex string
		pubBytes, err := hex.DecodeString(sender.PublicKey)
		if err != nil {
			fail("invalid_signature", "sender public_key is not valid hex")
			return
		}
		if len(pubBytes) != ed25519.PublicKeySize {
			fail("invalid_signature", "sender public_key has invalid length")
			return
		}

		sigText, err := canonicalSignatureText(req.Protocol, req.Payload)
		if err != nil {
			fail("malformed_request", "failed to canonicalize signature text")
			return
		}

		verified := agentid.VerifySignature(ed25519.PublicKey(pubBytes), []byte(sigText), sigBytes)
		if !verified {
			fail("invalid_signature", "signature verification failed")
			return
		}

		// Now that verification succeeded, persist nonce to prevent future replays.
		if nonce != "" {
			_, _ = db.Collection("nonce_replays").InsertOne(ctx, bson.M{
				"from_agent": fromAgent,
				"nonce":      nonce,
				"created_at": time.Now().UTC(),
			})
		}

		// idempotency-safe default request id
		if requestID == "" {
			requestID = fmt.Sprintf("req_%s_%s", traceID, bson.NewObjectID().Hex())
		}
		if toAgent == "" {
			toAgent = manifestDoc.ProviderAgentID
		} else if toAgent != manifestDoc.ProviderAgentID {
			fail("malformed_request", "to_agent does not match provider for skill")
			return
		}
		// Only verified requests proceed to persistence/execution.
		_, _ = db.Collection("execution_requests").InsertOne(ctx, bson.M{
			"request_id":     requestID,
			"trace_id":       traceID,
			"action":         req.Protocol.Action,
			"from_agent":     fromAgent,
			"to_agent":       toAgent,
			"skill_id":       skillID,
			"schema_version": req.Protocol.SchemaVer,
			"nonce":          nonce,
			"timestamp":      timestamp,
			"signature":      sigB64,
			"agent_id":       req.AgentID,
			"pseudonym":      req.Pseudonym,
			"payload":        req.Payload,
			"status":         "verified",
			"created_at":     time.Now().UTC(),
		})

		// Demo execution (mock).
		output, execErr := executeMockSkill(skillID, req.Payload)
		if execErr != nil {
			writeAuditRejection(ctx, db, "execution_failed", req, skillID)
			_, _ = db.Collection("execution_requests").UpdateOne(ctx, bson.M{"request_id": requestID}, bson.M{"$set": bson.M{"status": "rejected"}})
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": execErr.Error(), "reason_code": "execution_failed"})
			return
		}

		_, _ = db.Collection("execution_results").InsertOne(ctx, bson.M{
			"request_id": requestID,
			"from_agent": fromAgent,
			"to_agent":   toAgent,
			"skill_id":   skillID,
			"result":     output,
			"created_at": time.Now().UTC(),
		})
		_, _ = db.Collection("execution_requests").UpdateOne(ctx, bson.M{"request_id": requestID}, bson.M{"$set": bson.M{"status": "completed"}})

		writeJSON(w, http.StatusOK, map[string]any{
			"skill_id":          skillID,
			"provider_agent_id": manifestDoc.ProviderAgentID,
			"pseudonym":         req.Pseudonym,
			"status":            "completed",
			"manifest_version":  manifestDoc.Manifest.Version,
			"output":            output,
		})
	}
}

func executeMockSkill(skillID string, payload map[string]any) (map[string]any, error) {
	input := ""
	if payload != nil {
		if v, ok := payload["input"].(string); ok {
			input = strings.ToLower(strings.TrimSpace(v))
		}
	}

	switch skillID {
	case "weather_api":
		city := "Delhi"
		if strings.Contains(input, "mumbai") {
			city = "Mumbai"
		} else if strings.Contains(input, "delhi") {
			city = "Delhi"
		} else if strings.Contains(input, "london") {
			city = "London"
		}
		return map[string]any{
			"city":      city,
			"temp_c":    29,
			"condition": "Clear (mock)",
		}, nil
	case "crypto_api":
		asset := "BTC"
		if strings.Contains(input, "eth") {
			asset = "ETH"
		} else if strings.Contains(input, "btc") {
			asset = "BTC"
		}
		price := 64500
		if asset == "ETH" {
			price = 3450
		}
		return map[string]any{
			"asset":     asset,
			"price_usd": price,
			"source":    "mock",
		}, nil
	case "qr_api":
		text := payloadValueString(payload, "input")
		return map[string]any{
			"qr_payload": text,
			"qr_note":    "Mock QR (backend demo)",
		}, nil
	case "research_api":
		topic := payloadValueString(payload, "input")
		if topic == "" {
			topic = "your topic"
		}
		return map[string]any{
			"summary":   "Mock research summary for: " + topic,
			"citations": []string{},
		}, nil
	default:
		return map[string]any{
			"message":  "Unknown skill (mock executor)",
			"skill_id": skillID,
		}, nil
	}
}

func payloadValueString(payload map[string]any, key string) string {
	if payload == nil {
		return ""
	}
	v, ok := payload[key].(string)
	if !ok {
		return ""
	}
	return v
}
