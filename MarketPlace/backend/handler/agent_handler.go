package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Agent struct {
	AgentID   string `bson:"agent_id" json:"agent_id"`
	PublicKey string `bson:"public_key" json:"public_key"`
	Credits   int    `bson:"credits" json:"credits"`
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

type registerAgentRequest struct {
	AgentID   string `json:"agent_id"`
	PublicKey string `json:"public_key"`
}

type registerSkillsRequest struct {
	AgentID string   `json:"agent_id"`
	Skills  []string `json:"skills"`
	Price   int      `json:"price"`
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
		if req.AgentID == "" || req.PublicKey == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "agent_id and public_key are required"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		agents := db.Collection("agents")
		opts := options.UpdateOne().SetUpsert(true)
		_, err := agents.UpdateOne(ctx,
			bson.M{"agent_id": req.AgentID},
			bson.M{
				"$set": bson.M{
					"agent_id":   req.AgentID,
					"public_key": req.PublicKey,
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

		writeJSON(w, http.StatusOK, map[string]any{
			"request_id": req.RequestID,
			"status":     "completed",
			"price":      providerOffer.Price,
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
