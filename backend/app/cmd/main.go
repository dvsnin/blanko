package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dvsnin/blanko/backend/app/internal/config"
	"github.com/dvsnin/blanko/backend/app/internal/database"
	"github.com/dvsnin/blanko/backend/app/internal/server"
	"github.com/dvsnin/blanko/backend/app/internal/service"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := database.Connect(ctx, cfg.PostgresDSN)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	if cfg.RunMigrations {
		log.Printf("applying migrations from %s", cfg.MigrationsDir)
		if err := database.Migrate(ctx, pool, cfg.MigrationsDir); err != nil {
			log.Fatalf("migrate: %v", err)
		}
	}

	services := service.New(pool)
	s := server.New(pool, services, cfg.TldrawLicenseKey)

	httpServer := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           s.Router(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = httpServer.Shutdown(shutdownCtx)
	}()

	fmt.Printf("Server running at http://localhost%s\n", cfg.HTTPAddr)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("listen: %v", err)
	}
}
