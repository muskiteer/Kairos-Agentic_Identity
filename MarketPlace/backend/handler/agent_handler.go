package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Agent struct {
	AgentID       string   `bson:"agent_id" json:"agent_id"`
	PublicKey     string   `bson:"public_key" json:"public_key"`
	Description   string   `bson:"description,omitempty" json:"description,omitempty"`
	Role          string   `bson:"role,omitempty" json:"role,omitempty"` // "user" or "provider" (demo)
	AllowedSkills []string `bson:"allowed_skills,omitempty" json:"allowed_skills,omitempty"`
	Credits       int      `bson:"credits" json:"credits"`
}

type SkillOffer struct {
	AgentID string   `bson:"agent_id" json:"agent_id"`
	Skills  []string `bson:"skills" json:"skills"`
	Price   int      `bson:"price" json:"price"`
}

type ExecutionRequest struct {
	ID        string         `bson:"id" json:"id"`
	FromAgent string         `bson:"from" json:"from_agent"`
	ToAgent   string         `bson:"to" json:"to_agent"`
	Skill     string         `bson:"skill" json:"skill"`
	Payload   map[string]any `bson:"payload" json:"payload"`
	Timestamp int64          `bson:"timestamp" json:"timestamp"`
	Signature string         `bson:"signature" json:"signature"`
	Status    string         `bson:"status" json:"status"`
	CreatedAt time.Time      `bson:"created_at" json:"created_at"`
}

type ExecutionResponse struct {
	RequestID string    `bson:"request_id" json:"request_id"`
	FromAgent string    `bson:"from_agent" json:"from_agent"`
	ToAgent   string    `bson:"to_agent" json:"to_agent"`
	Result    string    `bson:"result" json:"result"`
	CreatedAt time.Time `bson:"created_at" json:"created_at"`
}

type CreditTransaction struct {
	TransactionID string    `bson:"transaction_id" json:"transaction_id"`
	RequestID     string    `bson:"request_id" json:"request_id"`
	Skill         string    `bson:"skill" json:"skill"`
	FromAgent     string    `bson:"from_agent" json:"from_agent"`
	ToAgent       string    `bson:"to_agent" json:"to_agent"`
	Amount        int       `bson:"amount" json:"amount"`
	Currency      string    `bson:"currency" json:"currency"`
	Status        string    `bson:"status" json:"status"`
	CreatedAt     time.Time `bson:"created_at" json:"created_at"`
}

type DeveloperSkillSummary struct {
	SkillID      string   `json:"skill_id"`
	Price        int      `json:"price"`
	Reputation   float64  `json:"reputation"`
	Availability float64  `json:"availability"`
	LatencyMs    int      `json:"latency_ms"`
	Capabilities []string `json:"capabilities,omitempty"`
}

type registerAgentRequest struct {
	AgentID       string   `json:"agent_id"`
	PublicKey     string   `json:"public_key"`
	Description   string   `json:"description,omitempty"`
	Role          string   `json:"role,omitempty"`
	AllowedSkills []string `json:"allowed_skills,omitempty"`
}

type registerSkillsRequest struct {
	AgentID      string         `json:"agent_id"`
	Skills       []string       `json:"skills"`
	Price        int            `json:"price"`
	Endpoint     string         `json:"endpoint,omitempty"`
	Method       string         `json:"method,omitempty"`
	InputExample map[string]any `json:"input_example,omitempty"`
}

type requestExecutionPayload struct {
	FromAgent string         `json:"from_agent"`
	Skill     string         `json:"skill"`
	Payload   map[string]any `json:"payload"`
	Timestamp int64          `json:"timestamp"`
	Signature string         `json:"signature"`
}

type respondPayload struct {
	RequestID string `json:"request_id"`
	FromAgent string `json:"from_agent"`
	Result    string `json:"result"`
}

func deriveCapabilities(skillID string, description string) []string {
	parts := strings.FieldsFunc(strings.ToLower(skillID+" "+description), func(r rune) bool {
		return !(r >= 'a' && r <= 'z') && !(r >= '0' && r <= '9')
	})

	seen := map[string]struct{}{}
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if len(p) < 3 {
			continue
		}
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		out = append(out, p)
		if len(out) >= 8 {
			break
		}
	}
	if len(out) == 0 {
		return []string{"agent", "service"}
	}
	return out
}

func buildManifestFromSkillRegistration(skillID string, provider Agent, price int, endpoint string, method string, inputExample map[string]any) SkillManifestDoc {
	desc := strings.TrimSpace(provider.Description)
	if desc == "" {
		desc = "Agent-provided marketplace skill"
	}

	method = strings.ToUpper(strings.TrimSpace(method))
	if method == "" {
		method = http.MethodPost
	}

	endpoint = strings.TrimSpace(endpoint)
	if inputExample == nil {
		inputExample = map[string]any{"input": "sample request"}
	}

	latency := 300
	if price >= 4 {
		latency = 550
	} else if price <= 1 {
		latency = 220
	}

	return SkillManifestDoc{
		SkillID:         skillID,
		ProviderAgentID: provider.AgentID,
		Price:           price,
		Manifest: SkillManifest{
			Name:          skillID,
			Version:       "v1",
			SchemaVersion: "1",
			LatencyMs:     latency,
			Auth:          map[string]any{"type": "none"},
			Endpoint:      endpoint,
			Method:        method,
			InputExample:  inputExample,
			Capabilities:  deriveCapabilities(skillID, desc),
			Reputation:    0.8,
			Availability:  0.95,
			Description:   desc,
			InputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"input": map[string]any{"type": "string"},
				},
			},
			OutputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"result": map[string]any{"type": "string"},
				},
			},
		},
	}
}

func AgentRegisterHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		var req registerAgentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
			return
		}

		req.AgentID = strings.TrimSpace(req.AgentID)
		req.PublicKey = strings.TrimSpace(req.PublicKey)
		if req.AgentID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "agent_id is required"})
			return
		}
		if req.Role == "" {
			req.Role = "user"
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		agents := db.Collection("agents")
		opts := options.UpdateOne().SetUpsert(true)
		_, err := agents.UpdateOne(ctx,
			bson.M{"agent_id": req.AgentID},
			bson.M{
				"$set": bson.M{
					"agent_id":       req.AgentID,
					"public_key":     req.PublicKey,
					"description":    req.Description,
					"role":           req.Role,
					"allowed_skills": req.AllowedSkills,
				},
				"$setOnInsert": bson.M{
					"credits": 100,
				},
			},
			opts,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		var agent Agent
		if err := agents.FindOne(ctx, bson.M{"agent_id": req.AgentID}).Decode(&agent); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, agent)
	}
}

func AgentInfoHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		agentID := strings.TrimSpace(r.URL.Query().Get("agent_id"))
		if agentID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "agent_id query parameter is required"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		var agent Agent
		err := db.Collection("agents").FindOne(ctx, bson.M{"agent_id": agentID}).Decode(&agent)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "agent not found"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, agent)
	}
}

func RegisterSkillsHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		var req registerSkillsRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
			return
		}

		req.AgentID = strings.TrimSpace(req.AgentID)
		if req.AgentID == "" || len(req.Skills) == 0 || req.Price <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "agent_id, skills, and positive price are required"})
			return
		}

		req.Endpoint = strings.TrimSpace(req.Endpoint)
		req.Method = strings.ToUpper(strings.TrimSpace(req.Method))
		if req.Method == "" {
			req.Method = http.MethodPost
		}
		if req.Endpoint != "" {
			u, err := url.ParseRequestURI(req.Endpoint)
			if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "endpoint must be a valid http/https URL"})
				return
			}
		}

		normalizedSkills := make([]string, 0, len(req.Skills))
		seen := map[string]struct{}{}
		for _, s := range req.Skills {
			v := strings.TrimSpace(s)
			if v == "" {
				continue
			}
			if _, ok := seen[v]; ok {
				continue
			}
			seen[v] = struct{}{}
			normalizedSkills = append(normalizedSkills, v)
		}
		if len(normalizedSkills) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "at least one non-empty skill is required"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		var agent Agent
		if err := db.Collection("agents").FindOne(ctx, bson.M{"agent_id": req.AgentID}).Decode(&agent); err != nil {
			if err == mongo.ErrNoDocuments {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "agent not found, register agent first"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		skillsColl := db.Collection("skills")
		opts := options.UpdateOne().SetUpsert(true)
		_, err := skillsColl.UpdateOne(ctx,
			bson.M{"agent_id": req.AgentID},
			bson.M{"$set": bson.M{"agent_id": req.AgentID, "skills": normalizedSkills, "price": req.Price}},
			opts,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		// Keep the modern manifest marketplace in sync so frontend cards can execute provider offers.
		manifestColl := db.Collection("skill_manifests")
		for _, skillID := range normalizedSkills {
			doc := buildManifestFromSkillRegistration(skillID, agent, req.Price, req.Endpoint, req.Method, req.InputExample)
			_, err := manifestColl.UpdateOne(
				ctx,
				bson.M{"skill_id": doc.SkillID, "provider_agent_id": doc.ProviderAgentID},
				bson.M{"$set": bson.M{
					"skill_id":          doc.SkillID,
					"provider_agent_id": doc.ProviderAgentID,
					"price":             doc.Price,
					"manifest":          doc.Manifest,
					"updated_at":        time.Now().UTC(),
				}},
				options.UpdateOne().SetUpsert(true),
			)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to publish skill manifest: " + err.Error()})
				return
			}
		}

		writeJSON(w, http.StatusOK, SkillOffer{AgentID: req.AgentID, Skills: normalizedSkills, Price: req.Price})
	}
}

func DiscoverSkillsHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		skill := strings.TrimSpace(r.URL.Query().Get("skill"))
		if skill == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "skill query parameter is required"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		cursor, err := db.Collection("skills").Find(ctx, bson.M{"skills": skill})
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		result := make([]map[string]any, 0)
		for cursor.Next(ctx) {
			var offer SkillOffer
			if err := cursor.Decode(&offer); err != nil {
				continue
			}
			result = append(result, map[string]any{
				"agent_id": offer.AgentID,
				"price":    offer.Price,
			})
		}

		writeJSON(w, http.StatusOK, result)
	}
}

func RequestExecutionHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		var req requestExecutionPayload
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
			return
		}

		req.FromAgent = strings.TrimSpace(req.FromAgent)
		req.Skill = strings.TrimSpace(req.Skill)
		if req.FromAgent == "" || req.Skill == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "from_agent and skill are required"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		var requester Agent
		if err := db.Collection("agents").FindOne(ctx, bson.M{"agent_id": req.FromAgent}).Decode(&requester); err != nil {
			if err == mongo.ErrNoDocuments {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "requesting agent not found"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		findOpts := options.FindOne().SetSort(bson.D{{Key: "price", Value: 1}})
		var provider SkillOffer
		err := db.Collection("skills").FindOne(ctx, bson.M{"skills": req.Skill}, findOpts).Decode(&provider)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "no provider found for skill"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		requestID := fmt.Sprintf("req_%s", bson.NewObjectID().Hex())
		timestamp := req.Timestamp
		if timestamp == 0 {
			timestamp = time.Now().Unix()
		}

		record := ExecutionRequest{
			ID:        requestID,
			FromAgent: req.FromAgent,
			ToAgent:   provider.AgentID,
			Skill:     req.Skill,
			Payload:   req.Payload,
			Timestamp: timestamp,
			Signature: req.Signature,
			Status:    "pending",
			CreatedAt: time.Now().UTC(),
		}

		_, err = db.Collection("requests").InsertOne(ctx, record)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"request_id": requestID,
			"to_agent":   provider.AgentID,
			"skill":      req.Skill,
			"status":     "pending",
		})
	}
}

func IncomingRequestsHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		agentID := strings.TrimSpace(r.URL.Query().Get("agent_id"))
		if agentID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "agent_id query parameter is required"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		filter := bson.M{"to": agentID, "status": "pending"}
		cursor, err := db.Collection("requests").Find(ctx, filter)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		requests := make([]ExecutionRequest, 0)
		for cursor.Next(ctx) {
			var row ExecutionRequest
			if err := cursor.Decode(&row); err != nil {
				continue
			}
			requests = append(requests, row)
		}

		writeJSON(w, http.StatusOK, requests)
	}
}

func RespondToRequestHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		var req respondPayload
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
			return
		}

		req.RequestID = strings.TrimSpace(req.RequestID)
		req.FromAgent = strings.TrimSpace(req.FromAgent)
		req.Result = strings.TrimSpace(req.Result)
		if req.RequestID == "" || req.FromAgent == "" || req.Result == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "request_id, from_agent and result are required"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		requestsColl := db.Collection("requests")
		var executionReq ExecutionRequest
		err := requestsColl.FindOne(ctx, bson.M{"id": req.RequestID}).Decode(&executionReq)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "request not found"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		if executionReq.ToAgent != req.FromAgent {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "only assigned provider can respond"})
			return
		}
		if executionReq.Status != "pending" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "request already processed"})
			return
		}

		var providerOffer SkillOffer
		err = db.Collection("skills").FindOne(ctx, bson.M{"agent_id": executionReq.ToAgent, "skills": executionReq.Skill}).Decode(&providerOffer)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "provider skill/price not found"})
			return
		}

		agentsColl := db.Collection("agents")
		debitResult, err := agentsColl.UpdateOne(ctx,
			bson.M{"agent_id": executionReq.FromAgent, "credits": bson.M{"$gte": providerOffer.Price}},
			bson.M{"$inc": bson.M{"credits": -providerOffer.Price}},
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if debitResult.MatchedCount == 0 || debitResult.ModifiedCount == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "insufficient credits"})
			return
		}

		if _, err := agentsColl.UpdateOne(ctx,
			bson.M{"agent_id": executionReq.ToAgent},
			bson.M{"$inc": bson.M{"credits": providerOffer.Price}},
		); err != nil {
			_, _ = agentsColl.UpdateOne(ctx,
				bson.M{"agent_id": executionReq.FromAgent},
				bson.M{"$inc": bson.M{"credits": providerOffer.Price}},
			)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		responseDoc := ExecutionResponse{
			RequestID: req.RequestID,
			FromAgent: req.FromAgent,
			ToAgent:   executionReq.FromAgent,
			Result:    req.Result,
			CreatedAt: time.Now().UTC(),
		}
		if _, err := db.Collection("responses").InsertOne(ctx, responseDoc); err != nil {
			_, _ = agentsColl.UpdateOne(ctx,
				bson.M{"agent_id": executionReq.ToAgent},
				bson.M{"$inc": bson.M{"credits": -providerOffer.Price}},
			)
			_, _ = agentsColl.UpdateOne(ctx,
				bson.M{"agent_id": executionReq.FromAgent},
				bson.M{"$inc": bson.M{"credits": providerOffer.Price}},
			)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		if _, err := requestsColl.UpdateOne(ctx,
			bson.M{"id": req.RequestID},
			bson.M{"$set": bson.M{"status": "completed"}},
		); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		txn := CreditTransaction{
			TransactionID: fmt.Sprintf("txn_%s", bson.NewObjectID().Hex()),
			RequestID:     req.RequestID,
			Skill:         executionReq.Skill,
			FromAgent:     executionReq.FromAgent,
			ToAgent:       executionReq.ToAgent,
			Amount:        providerOffer.Price,
			Currency:      "CREDITS",
			Status:        "completed",
			CreatedAt:     time.Now().UTC(),
		}
		if _, err := db.Collection("transactions").InsertOne(ctx, txn); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "transaction recorded failed: " + err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"request_id":     req.RequestID,
			"status":         "completed",
			"price":          providerOffer.Price,
			"transaction_id": txn.TransactionID,
		})
	}
}

func GetTransactionsHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		agentID := strings.TrimSpace(r.URL.Query().Get("agent_id"))
		if agentID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "agent_id query parameter is required"})
			return
		}

		limit := int64(50)
		if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
			if n, err := strconv.Atoi(raw); err == nil && n > 0 && n <= 500 {
				limit = int64(n)
			}
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		filter := bson.M{
			"$or": []bson.M{
				{"from_agent": agentID},
				{"to_agent": agentID},
			},
		}
		findOpts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(limit)
		cursor, err := db.Collection("transactions").Find(ctx, filter, findOpts)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		items := make([]CreditTransaction, 0)
		for cursor.Next(ctx) {
			var row CreditTransaction
			if err := cursor.Decode(&row); err != nil {
				continue
			}
			items = append(items, row)
		}

		writeJSON(w, http.StatusOK, items)
	}
}

func GetDeveloperDashboardHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		agentID := strings.TrimSpace(r.URL.Query().Get("agent_id"))
		if agentID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "agent_id query parameter is required"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
		defer cancel()

		if err := db.Collection("agents").FindOne(ctx, bson.M{"agent_id": agentID}).Err(); err != nil {
			if err == mongo.ErrNoDocuments {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "agent not found"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		// Payment analytics
		txFilter := bson.M{
			"$or": []bson.M{{"from_agent": agentID}, {"to_agent": agentID}},
		}
		txCur, err := db.Collection("transactions").Find(ctx, txFilter, options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(30))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer txCur.Close(ctx)

		recentTransactions := make([]CreditTransaction, 0)
		var earned, spent, txTotal, incomingCount, outgoingCount int
		for txCur.Next(ctx) {
			var tx CreditTransaction
			if err := txCur.Decode(&tx); err != nil {
				continue
			}
			recentTransactions = append(recentTransactions, tx)
			txTotal += tx.Amount
			if tx.ToAgent == agentID {
				earned += tx.Amount
				incomingCount++
			}
			if tx.FromAgent == agentID {
				spent += tx.Amount
				outgoingCount++
			}
		}

		totalTransactions := incomingCount + outgoingCount
		averageTxAmount := 0.0
		if totalTransactions > 0 {
			averageTxAmount = float64(txTotal) / float64(totalTransactions)
		}

		// Cost + trust analytics from registered skills
		skillCur, err := db.Collection("skill_manifests").Find(ctx, bson.M{"provider_agent_id": agentID})
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer skillCur.Close(ctx)

		skills := make([]DeveloperSkillSummary, 0)
		priceMin := 0
		priceMax := 0
		priceSum := 0
		reputationSum := 0.0
		availabilitySum := 0.0

		for skillCur.Next(ctx) {
			var doc SkillManifestDoc
			if err := skillCur.Decode(&doc); err != nil {
				continue
			}

			skills = append(skills, DeveloperSkillSummary{
				SkillID:      doc.SkillID,
				Price:        doc.Price,
				Reputation:   doc.Manifest.Reputation,
				Availability: doc.Manifest.Availability,
				LatencyMs:    doc.Manifest.LatencyMs,
				Capabilities: doc.Manifest.Capabilities,
			})

			if len(skills) == 1 {
				priceMin = doc.Price
				priceMax = doc.Price
			} else {
				if doc.Price < priceMin {
					priceMin = doc.Price
				}
				if doc.Price > priceMax {
					priceMax = doc.Price
				}
			}

			priceSum += doc.Price
			reputationSum += doc.Manifest.Reputation
			availabilitySum += doc.Manifest.Availability
		}

		skillsCount := len(skills)
		avgPrice := 0.0
		avgReputation := 0.0
		avgAvailability := 0.0
		if skillsCount > 0 {
			avgPrice = float64(priceSum) / float64(skillsCount)
			avgReputation = reputationSum / float64(skillsCount)
			avgAvailability = availabilitySum / float64(skillsCount)
		}

		completedExec, _ := db.Collection("execution_results").CountDocuments(ctx, bson.M{"to_agent": agentID})
		rejectedExec, _ := db.Collection("audit_logs").CountDocuments(ctx, bson.M{"to_agent": agentID, "status": "rejected"})

		trustScore := 0.0
		if avgReputation > 0 || avgAvailability > 0 {
			trustScore = avgReputation*0.65 + avgAvailability*0.35
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"agent_id": agentID,
			"payment": map[string]any{
				"earned":             earned,
				"spent":              spent,
				"net":                earned - spent,
				"incoming_count":     incomingCount,
				"outgoing_count":     outgoingCount,
				"total_transactions": totalTransactions,
				"average_tx_amount":  averageTxAmount,
			},
			"trust": map[string]any{
				"avg_reputation":        avgReputation,
				"avg_availability":      avgAvailability,
				"successful_executions": completedExec,
				"rejected_executions":   rejectedExec,
				"trust_score":           trustScore,
			},
			"cost": map[string]any{
				"skills_count": skillsCount,
				"min_price":    priceMin,
				"max_price":    priceMax,
				"avg_price":    avgPrice,
			},
			"skills":              skills,
			"recent_transactions": recentTransactions,
			"prototype_readiness": map[string]any{
				"identity_registered":     true,
				"has_skills_published":    skillsCount > 0,
				"has_tx_history":          totalTransactions > 0,
				"trust_scoring_available": skillsCount > 0,
				"recommendation":          "Add goal planner + async queue for multi-agent workflows.",
			},
		})
	}
}

func GetResponsesHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		agentID := strings.TrimSpace(r.URL.Query().Get("agent_id"))
		if agentID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "agent_id query parameter is required"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		cursor, err := db.Collection("responses").Find(ctx, bson.M{"to_agent": agentID})
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		responses := make([]ExecutionResponse, 0)
		for cursor.Next(ctx) {
			var row ExecutionResponse
			if err := cursor.Decode(&row); err != nil {
				continue
			}
			responses = append(responses, row)
		}

		writeJSON(w, http.StatusOK, responses)
	}
}
