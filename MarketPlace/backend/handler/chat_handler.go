package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type agentChatRequest struct {
	AgentID string               `json:"agent_id"`
	Message string               `json:"message"`
	Skills  []chatSkillCandidate `json:"skills,omitempty"`
}

type chatSkillCandidate struct {
	ID           string   `json:"id"`
	Description  string   `json:"description,omitempty"`
	Capabilities []string `json:"capabilities,omitempty"`
}

type groqCompletionRequest struct {
	Model       string                 `json:"model"`
	Messages    []map[string]string    `json:"messages"`
	Temperature float64                `json:"temperature"`
	MaxTokens   int                    `json:"max_tokens"`
	ResponseFmt map[string]interface{} `json:"response_format,omitempty"`
}

type groqCompletionResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
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

		selectedSkill, routeReason := routeSkill(req.Message, req.Skills)
		if selectedSkill == "" {
			selectedSkill = "research_api"
			routeReason = "empty-skill-list"
		}

		reply := fmt.Sprintf("Routed to %s (%s)", selectedSkill, routeReason)

		_, _ = db.Collection("agent_chats").InsertOne(ctx, bson.M{
			"agent_id":   req.AgentID,
			"message":    req.Message,
			"reply":      reply,
			"skill_id":   selectedSkill,
			"result":     bson.M{"route_reason": routeReason},
			"created_at": time.Now().UTC(),
		})

		writeJSON(w, http.StatusOK, map[string]any{
			"agent_id":     req.AgentID,
			"skill_id":     selectedSkill,
			"route_reason": routeReason,
			"reply":        reply,
		})
	}
}

func routeSkill(message string, skills []chatSkillCandidate) (string, string) {
	message = strings.ToLower(strings.TrimSpace(message))
	if message == "" || len(skills) == 0 {
		return "", "no-input"
	}

	idSet := map[string]struct{}{}
	for _, s := range skills {
		id := strings.TrimSpace(s.ID)
		if id != "" {
			idSet[id] = struct{}{}
		}
	}
	has := func(skillID string) bool {
		_, ok := idSet[skillID]
		return ok
	}
	containsAny := func(tokens ...string) bool {
		for _, t := range tokens {
			if strings.Contains(message, t) {
				return true
			}
		}
		return false
	}

	if has("crypto_api") && containsAny("crypto", "bitcoin", "btc", "ethereum", "eth", "coin", "price") {
		return "crypto_api", "intent-keyword"
	}
	if has("weather_api") && containsAny("weather", "temperature", "forecast", "rain", "humidity", "climate") {
		return "weather_api", "intent-keyword"
	}

	if skillID := chooseWithGroq(message, skills); skillID != "" {
		if has(skillID) {
			return skillID, "groq-router"
		}
	}

	bestID := ""
	bestScore := -1
	for _, s := range skills {
		id := strings.TrimSpace(s.ID)
		if id == "" {
			continue
		}
		bag := strings.ToLower(id + " " + s.Description + " " + strings.Join(s.Capabilities, " "))
		score := 0
		for _, tok := range strings.Fields(message) {
			if len(tok) < 3 {
				continue
			}
			if strings.Contains(bag, tok) {
				score++
			}
		}
		if score > bestScore {
			bestScore = score
			bestID = id
		}
	}
	if bestID != "" {
		if bestScore > 0 {
			return bestID, "lexical-match"
		}
		return bestID, "first-available"
	}

	return "", "no-skill-selected"
}

func chooseWithGroq(message string, skills []chatSkillCandidate) string {
	apiKey := getGroqAPIKey()
	if apiKey == "" || len(skills) == 0 {
		return ""
	}

	skillJSON, err := json.Marshal(skills)
	if err != nil {
		return ""
	}

	systemPrompt := "You are a skill router. Choose exactly one best skill id from the provided skills list for the user request. Return strict JSON: {\"skill_id\":\"...\"}."
	userPrompt := fmt.Sprintf("User request: %s\nAvailable skills JSON: %s", message, string(skillJSON))

	bodyObj := groqCompletionRequest{
		Model: "llama-3.1-8b-instant",
		Messages: []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		Temperature: 0,
		MaxTokens:   64,
	}
	body, err := json.Marshal(bodyObj)
	if err != nil {
		return ""
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.groq.com/openai/v1/chat/completions", strings.NewReader(string(body)))
	if err != nil {
		return ""
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return ""
	}

	b, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return ""
	}

	var parsed groqCompletionResponse
	if err := json.Unmarshal(b, &parsed); err != nil || len(parsed.Choices) == 0 {
		return ""
	}

	content := strings.TrimSpace(parsed.Choices[0].Message.Content)
	if content == "" {
		return ""
	}

	var route struct {
		SkillID string `json:"skill_id"`
	}
	if json.Unmarshal([]byte(content), &route) == nil && strings.TrimSpace(route.SkillID) != "" {
		return strings.TrimSpace(route.SkillID)
	}

	contentLower := strings.ToLower(content)
	for _, s := range skills {
		id := strings.TrimSpace(s.ID)
		if id == "" {
			continue
		}
		if strings.Contains(contentLower, strings.ToLower(id)) {
			return id
		}
	}

	return ""
}

func getGroqAPIKey() string {
	if v := strings.TrimSpace(os.Getenv("groq_api")); v != "" {
		return v
	}
	if v := strings.TrimSpace(os.Getenv("GROQ_API_KEY")); v != "" {
		return v
	}

	content, err := os.ReadFile(".env")
	if err != nil {
		return ""
	}

	for _, line := range strings.Split(string(content), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		k := strings.TrimSpace(parts[0])
		v := strings.TrimSpace(parts[1])
		if (k == "groq_api" || k == "GROQ_API_KEY") && v != "" {
			return v
		}
	}

	return ""
}
