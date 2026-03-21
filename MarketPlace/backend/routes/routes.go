package routes

import (
	"net/http"

	"go.mongodb.org/mongo-driver/v2/mongo"

	"github.com/muskiteer/Kairos-Agentic_Identity/MarketPlace/handler"
)

func SetupRoutes(mux *http.ServeMux, db *mongo.Database) {
	mux.HandleFunc("/health", handler.HealthCheckHandler)

	// Agent core
	mux.HandleFunc("POST /agent/register", handler.AgentRegisterHandler(db))
	mux.HandleFunc("GET /agent/info", handler.AgentInfoHandler(db))
	mux.HandleFunc("POST /agent/chat", handler.AgentChatHandler(db))

	// API Marketplace
	mux.HandleFunc("GET /tools", handler.ToolFetchHandler(db))
	mux.HandleFunc("POST /tools/{tool}", handler.ToolHandler(db))

	// Skill marketplace (dynamic manifests + protocol envelope)
	mux.HandleFunc("GET /skills", handler.SkillsListHandler(db))
	mux.HandleFunc("POST /skills/{skill}", handler.SkillsExecuteHandler(db))

	mux.HandleFunc("POST /agent/skills", handler.RegisterSkillsHandler(db))
	mux.HandleFunc("GET /agent/skills", handler.DiscoverSkillsHandler(db))

	// Request/response flow
	mux.HandleFunc("POST /agent/request", handler.RequestExecutionHandler(db))
	mux.HandleFunc("GET /agent/requests", handler.IncomingRequestsHandler(db))
	mux.HandleFunc("POST /agent/respond", handler.RespondToRequestHandler(db))
	mux.HandleFunc("GET /agent/responses", handler.GetResponsesHandler(db))
	mux.HandleFunc("GET /agent/transactions", handler.GetTransactionsHandler(db))
	mux.HandleFunc("GET /agent/developer/dashboard", handler.GetDeveloperDashboardHandler(db))

	mux.HandleFunc("/api/register", handler.AgentRegisterHandler(db))
	mux.HandleFunc("/api/chat", handler.AgentChatHandler(db))
	mux.HandleFunc("/api/tools", handler.ToolFetchHandler(db))
	mux.HandleFunc("/api/tool/{tool}", handler.ToolHandler(db))
	mux.HandleFunc("/api/pseudonym", handler.PseudonymHandler(db))
	mux.HandleFunc("/api/credits", handler.CreditHandler(db))
	mux.HandleFunc("/api/transactions", handler.GetTransactionsHandler(db))
	mux.HandleFunc("/api/developer/dashboard", handler.GetDeveloperDashboardHandler(db))
}
