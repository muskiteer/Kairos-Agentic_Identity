package internal

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type DatabaseConnection struct {
	Client *mongo.Client
	DB     *mongo.Database
}

func SetupDatabase() (*DatabaseConnection, error) {
	mongoURI := getMongoURI()
	if mongoURI == "" {
		return nil, fmt.Errorf("mongo connection string not found; set MONGO_URL or mongo_url")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	client, err := mongo.Connect(options.Client().ApplyURI(mongoURI))
	if err != nil {
		return nil, fmt.Errorf("connect mongo: %w", err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("ping mongo: %w", err)
	}

	dbName := extractDatabaseName(mongoURI)
	return &DatabaseConnection{
		Client: client,
		DB:     client.Database(dbName),
	}, nil
}

func getMongoURI() string {
	if v := strings.TrimSpace(os.Getenv("MONGO_URL")); v != "" {
		return v
	}

	if v := strings.TrimSpace(os.Getenv("mongo_url")); v != "" {
		return v
	}

	content, err := os.ReadFile(".env")
	if err != nil {
		return ""
	}

	for _, line := range strings.Split(string(content), "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}

		parts := strings.SplitN(trimmed, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		if key == "MONGO_URL" || key == "mongo_url" {
			return value
		}
	}

	return ""
}

func extractDatabaseName(uri string) string {
	const fallback = "kairos_agentic_identity"

	withoutParams := strings.SplitN(uri, "?", 2)[0]
	idx := strings.LastIndex(withoutParams, "/")
	if idx == -1 || idx == len(withoutParams)-1 {
		return fallback
	}

	name := strings.TrimSpace(withoutParams[idx+1:])
	if name == "" {
		return fallback
	}

	return name
}
