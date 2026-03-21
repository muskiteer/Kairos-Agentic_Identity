package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type agentChatRequest struct {
	AgentID string `json:"agent_id"`
	Message string `json:"message"`
}

func AgentChatHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		var req agentChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
			return
		}

		req.AgentID = strings.TrimSpace(req.AgentID)
		req.Message = strings.TrimSpace(req.Message)
		if req.AgentID == "" || req.Message == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "agent_id and message are required"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
		defer cancel()

		if err := db.Collection("agents").FindOne(ctx, bson.M{"agent_id": req.AgentID}).Err(); err != nil {
			if err == mongo.ErrNoDocuments {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "agent not found, register first"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		// Fully skill-based fallback: route generic chat prompts through research skill.
		researchOutput, err := executeMockSkill("research_api", map[string]any{"input": req.Message})
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "research skill execution failed"})
			return
		}

		reply := strings.TrimSpace(payloadValueString(researchOutput, "summary"))
		if reply == "" {
			reply = "Research skill executed, but no summary was returned."
		}

		_, _ = db.Collection("agent_chats").InsertOne(ctx, bson.M{
			"agent_id":   req.AgentID,
			"message":    req.Message,
			"reply":      reply,
			"skill_id":   "research_api",
			"result":     researchOutput,
			"created_at": time.Now().UTC(),
		})

		writeJSON(w, http.StatusOK, map[string]any{
			"agent_id": req.AgentID,
			"skill_id": "research_api",
			"reply":    reply,
			"output":   researchOutput,
		})
	}
}
