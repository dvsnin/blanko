package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config - настройки приложения, читаемые из окружения.
type Config struct {
	// HTTPAddr - адрес HTTP-сервера (например ":8080").
	HTTPAddr string
	// PostgresDSN - строка подключения к PostgreSQL.
	PostgresDSN string
	// MigrationsDir - путь к директории с миграциями (goose).
	MigrationsDir string
	// RunMigrations - запускать ли миграции при старте.
	RunMigrations bool
	// TldrawLicenseKey - лицензионный ключ tldraw. Пустая строка допустима:
	// локально (HTTP на loopback) SDK считает окружение разработкой и ключ
	// не требует. Ключ публичный по дизайну - проверяется на клиенте.
	TldrawLicenseKey string
	// OrgName создаётся при первом старте.
	OrgName string
	// AdminEmails из ADMIN_EMAILS: первый - владелец, остальные админы.
	AdminEmails []string
}

// Load собирает конфиг из переменных окружения с разумными значениями по умолчанию.
func Load() (*Config, error) {
	cfg := &Config{
		HTTPAddr:      getEnv("HTTP_ADDR", ":8080"),
		PostgresDSN:   getEnv("POSTGRES_DSN", ""),
		MigrationsDir: getEnv("MIGRATIONS_DIR", "migration"),
		RunMigrations: getEnvBool("RUN_MIGRATIONS", true),

		TldrawLicenseKey: getEnv("TLDRAW_LICENSE_KEY", ""),

		OrgName:     getEnv("ORG_NAME", "Детский сад"),
		AdminEmails: splitList(getEnv("ADMIN_EMAILS", "")),
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

func splitList(raw string) []string {
	out := []string{}
	for _, p := range strings.Split(raw, ",") {
		if v := strings.ToLower(strings.TrimSpace(p)); v != "" {
			out = append(out, v)
		}
	}
	return out
}
