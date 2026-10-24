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

	"github.com/dvsnin/blanko/backend/app/internal/bootstrap"
	"github.com/dvsnin/blanko/backend/app/internal/config"
	"github.com/dvsnin/blanko/backend/app/internal/database"
	"github.com/dvsnin/blanko/backend/app/internal/doc"
	"github.com/dvsnin/blanko/backend/app/internal/server"
	"github.com/dvsnin/blanko/backend/app/internal/service"
	"github.com/dvsnin/blanko/backend/app/internal/storage"
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

	if err := bootstrap.Run(ctx, pool, cfg.OrgName, cfg.AdminEmails); err != nil {
		log.Fatalf("bootstrap: %v", err)
	}

	store, err := storage.NewS3(ctx, storage.S3Config{
		Endpoint: cfg.S3Endpoint, AccessKey: cfg.S3AccessKey, SecretKey: cfg.S3SecretKey,
		Bucket: cfg.S3Bucket, Region: cfg.S3Region,
	})
	if err != nil {
		log.Fatalf("storage: %v", err)
	}
	if err := store.EnsureBucket(ctx); err != nil {
		log.Fatalf("storage: %v", err)
	}
	log.Printf("storage: bucket %s ready", cfg.S3Bucket)

	hub := doc.NewHub(store, cfg.DocFlushInterval)
	go hub.Run(ctx)
	services := service.New(pool, store, hub)
	s := server.New(pool, services, cfg.TldrawLicenseKey, cfg.MediaMaxBytes)

	httpServer := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           s.Router(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	// Сначала хаб: http.Server.Shutdown не закрывает захваченные вебсокет-соединения
	// и не знает про комнаты, которые нужно записать.
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
		defer cancel()
		if err := hub.Shutdown(shutdownCtx); err != nil {
			log.Printf("shutdown: rooms flush: %v", err)
		} else {
			log.Printf("shutdown: rooms flushed")
		}
		_ = httpServer.Shutdown(shutdownCtx)
	}()

	fmt.Printf("Server running at http://localhost%s\n", cfg.HTTPAddr)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("listen: %v", err)
	}
}
