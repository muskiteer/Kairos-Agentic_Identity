package main

import (
	"context"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/muskiteer/Kairos-Agentic_Identity/MarketPlace/handler"
	"github.com/muskiteer/Kairos-Agentic_Identity/MarketPlace/internal"
	"github.com/muskiteer/Kairos-Agentic_Identity/MarketPlace/routes"
)

func main() {
	db, err := internal.SetupDatabase()
	if err != nil {
		log.Fatalf("database setup failed: %v", err)
	}
	defer db.Client.Disconnect(context.Background())

	// Seed demo marketplace data (provider agents + published skill manifests).
	handler.SeedDemoData(db.DB)

	mux := http.NewServeMux()
	routes.SetupRoutes(mux, db.DB)
	handlerWithCORS := corsMiddleware(mux)

	server := &http.Server{
		Addr:              ":8080",
		Handler:           handlerWithCORS,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Println("backend listening on :8080")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
}

func corsMiddleware(next http.Handler) http.Handler {
	allowedOrigins := map[string]bool{}
	defaultOrigins := "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,http://localhost:3000,http://127.0.0.1:3000,https://kairos-agentic-identity.vercel.app"
	originsRaw := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS"))
	if originsRaw == "" {
		originsRaw = defaultOrigins
	} else {
		originsRaw = defaultOrigins + "," + originsRaw
	}

	allowAll := false
	for _, origin := range strings.Split(originsRaw, ",") {
		o := strings.TrimSpace(origin)
		if o == "" {
			continue
		}
		if o == "*" {
			allowAll = true
			break
		}
		allowedOrigins[o] = true
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if allowAll {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		} else if origin != "" && (allowedOrigins[origin] || isKairosVercelPreviewOrigin(origin)) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func isKairosVercelPreviewOrigin(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}

	if !strings.EqualFold(u.Scheme, "https") {
		return false
	}

	host := strings.ToLower(strings.TrimSpace(u.Hostname()))
	if host == "kairos-agentic-identity.vercel.app" {
		return true
	}

	return strings.HasPrefix(host, "kairos-agentic-identity-") && strings.HasSuffix(host, ".vercel.app")
}
