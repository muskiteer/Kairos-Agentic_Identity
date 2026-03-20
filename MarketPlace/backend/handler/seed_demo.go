package handler

import (
	"context"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// SeedDemoData creates 4 “provider agents” in Mongo and publishes the corresponding skill manifests.
// This is strictly for the demo UI; agents themselves can be real later.
func SeedDemoData(db *mongo.Database) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	agentsColl := db.Collection("agents")
	skillColl := db.Collection("skill_manifests")

	providerRoleFilter := bson.M{"role": "provider"}
	providerCount, err := agentsColl.CountDocuments(ctx, providerRoleFilter)
	if err == nil && providerCount > 0 {
		return
	}

	providers := []Agent{
		{AgentID: "provider-weather_api", PublicKey: "", Credits: 0, Role: "provider", Description: "Weather skill provider (mock)"},
		{AgentID: "provider-crypto_api", PublicKey: "", Credits: 0, Role: "provider", Description: "Crypto skill provider (mock)"},
		{AgentID: "provider-qr_api", PublicKey: "", Credits: 0, Role: "provider", Description: "QR skill provider (mock)"},
		{AgentID: "provider-research_api", PublicKey: "", Credits: 0, Role: "provider", Description: "Research skill provider (mock)"},
	}

	// Upsert providers.
	for _, p := range providers {
		_, _ = agentsColl.UpdateOne(
			ctx,
			bson.M{"agent_id": p.AgentID},
			bson.M{"$set": bson.M{
				"agent_id":       p.AgentID,
				"public_key":    p.PublicKey,
				"description":   p.Description,
				"role":           p.Role,
				"allowed_skills": p.AllowedSkills,
				"credits":       p.Credits,
			}},
			nil,
		)
	}

	// Publish manifests.
	seedSkills := []SkillManifestDoc{
		{
			SkillID:         "weather_api",
			ProviderAgentID: "provider-weather_api",
			Price:           1,
			Manifest: SkillManifest{
				Name:          "weather_api",
				Version:       "v1",
				SchemaVersion: "1",
				LatencyMs:     220,
				Auth:          map[string]any{"type": "none"},
				Capabilities:  []string{"weather", "climate", "temperature"},
				Reputation:    0.92,
				Availability:  0.99,
				Description:   "Return mock weather for a city.",
				InputSchema: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"input": map[string]any{"type": "string", "description": "Free text prompt"},
					},
				},
				OutputSchema: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"city": map[string]any{"type": "string"},
						"temp_c": map[string]any{"type": "number"},
						"condition": map[string]any{"type": "string"},
					},
				},
			},
		},
		{
			SkillID:         "crypto_api",
			ProviderAgentID: "provider-crypto_api",
			Price:           1,
			Manifest: SkillManifest{
				Name:          "crypto_api",
				Version:       "v1",
				SchemaVersion: "1",
				LatencyMs:     260,
				Auth:          map[string]any{"type": "none"},
				Capabilities:  []string{"crypto", "btc", "eth", "price"},
				Reputation:    0.9,
				Availability:  0.98,
				Description:   "Return mock crypto price for BTC/ETH.",
				InputSchema: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"input": map[string]any{"type": "string", "description": "Free text prompt"},
					},
				},
				OutputSchema: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"asset": map[string]any{"type": "string"},
						"price_usd": map[string]any{"type": "number"},
					},
				},
			},
		},
		{
			SkillID:         "qr_api",
			ProviderAgentID: "provider-qr_api",
			Price:           2,
			Manifest: SkillManifest{
				Name:          "qr_api",
				Version:       "v1",
				SchemaVersion: "1",
				LatencyMs:     180,
				Auth:          map[string]any{"type": "none"},
				Capabilities:  []string{"qr", "qrcode", "encode"},
				Reputation:    0.86,
				Availability:  0.97,
				Description:   "Return mock QR payload for a string.",
				InputSchema: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"input": map[string]any{"type": "string"},
					},
				},
				OutputSchema: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"qr_payload": map[string]any{"type": "string"},
						"qr_note": map[string]any{"type": "string"},
					},
				},
			},
		},
		{
			SkillID:         "research_api",
			ProviderAgentID: "provider-research_api",
			Price:           3,
			Manifest: SkillManifest{
				Name:          "research_api",
				Version:       "v1",
				SchemaVersion: "1",
				LatencyMs:     540,
				Auth:          map[string]any{"type": "none"},
				Capabilities:  []string{"research", "search", "summary"},
				Reputation:    0.88,
				Availability:  0.95,
				Description:   "Return mock research summary for a topic.",
				InputSchema: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"input": map[string]any{"type": "string"},
					},
				},
				OutputSchema: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"summary": map[string]any{"type": "string"},
						"citations": map[string]any{"type": "array"},
					},
				},
			},
		},
	}

	for _, s := range seedSkills {
		// Upsert by skill_id to preserve manifest versions.
		_, _ = skillColl.UpdateOne(
			ctx,
			bson.M{"skill_id": s.SkillID},
			bson.M{"$set": bson.M{
				"skill_id":          s.SkillID,
				"provider_agent_id": s.ProviderAgentID,
				"price":             s.Price,
				"manifest":          s.Manifest,
				"updated_at":        time.Now().UTC(),
			}},
			nil,
		)
	}
}

// Ensure we keep “agent description” consistent for quick filtering.
func normalizeText(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

