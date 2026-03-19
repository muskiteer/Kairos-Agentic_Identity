package handler

import (
	"go.mongodb.org/mongo-driver/v2/mongo"
	"net/http"
)

func LoginHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Placeholder for user login logic
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("User logged in successfully"))
	}
}

func RegisterHandler(db *mongo.Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Placeholder for user registration logic
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("User registered successfully"))
	}
}
