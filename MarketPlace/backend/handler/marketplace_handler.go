package handler

import (
	"encoding/json"
	"net/http"

	"go.mongodb.org/mongo-driver/v2/mongo"
)

func HealthCheckHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "OK"})
}

func ToolFetchHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		tools := []map[string]any{
			{"name": "crypto_price", "description": "Returns latest crypto price"},
			{"name": "qr_generate", "description": "Generates QR code payload"},
		}
		writeJSON(w, http.StatusOK, tools)
	}
}
func ToolHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		tool := r.PathValue("tool")
		if tool == "" {
			tool = r.PathValue("id")
		}

		var payload map[string]any
		_ = json.NewDecoder(r.Body).Decode(&payload)

		writeJSON(w, http.StatusOK, map[string]any{
			"tool":    tool,
			"status":  "accepted",
			"payload": payload,
		})
	}
}

func PseudonymHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"message": "Pseudonym generated successfully"})
	}
}

func CreditHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"message": "Credit information processed successfully"})
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
