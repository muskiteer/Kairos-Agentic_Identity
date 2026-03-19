package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/muskiteer/Kairos-Agentic_Identity/MarketPlace/internal"
	"github.com/muskiteer/Kairos-Agentic_Identity/MarketPlace/routes"
)

func main() {
	db, err := internal.SetupDatabase()
	if err != nil {
		log.Fatalf("database setup failed: %v", err)
	}
	defer db.Client.Disconnect(context.Background())

	mux := http.NewServeMux()
	routes.SetupRoutes(mux, db.DB)

	server := &http.Server{
		Addr:              ":8080",
		Handler:           mux,
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
