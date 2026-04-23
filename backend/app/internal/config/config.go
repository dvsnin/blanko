package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config — настройки приложения, читаемые из окружения.
type Config struct {
	// HTTPAddr — адрес HTTP-сервера (например ":8080").
	HTTPAddr string
	// PostgresDSN — строка подключения к PostgreSQL.
	PostgresDSN string
	// MigrationsDir — путь к директории с миграциями (goose).
	MigrationsDir string
	// RunMigrations — запускать ли миграции при старте.
	RunMigrations bool
}

// Load собирает конфиг из переменных окружения с разумными значениями по умолчанию.
func Load() (*Config, error) {
	cfg := &Config{
		HTTPAddr:      getEnv("HTTP_ADDR", ":8080"),
		PostgresDSN:   getEnv("POSTGRES_DSN", ""),
		MigrationsDir: getEnv("MIGRATIONS_DIR", "migration"),
		RunMigrations: getEnvBool("RUN_MIGRATIONS", true),
	}
	if cfg.PostgresDSN == "" {
		return nil, fmt.Errorf("POSTGRES_DSN is required")
	}
	return cfg, nil
}

func getEnv(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}

func getEnvBool(key string, def bool) bool {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return def
}
