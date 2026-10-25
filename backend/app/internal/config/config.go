package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	HTTPAddr      string
	PostgresDSN   string
	MigrationsDir string
	RunMigrations bool
	// PresetReseed - перегенерировать документы готовых шаблонов при старте (после обновления каталога или tldraw).
	PresetReseed bool
	// TldrawLicenseKey пуст на localhost и http-хостах: tldraw считает их разработкой.
	TldrawLicenseKey string
	// KeycloakPublicURL - адрес Keycloak, по которому к нему ходит браузер (RP-initiated logout).
	KeycloakPublicURL string
	// OrgName создаётся при первом старте.
	OrgName string
	// AdminEmails из ADMIN_EMAILS: первый - владелец, остальные админы.
	AdminEmails []string

	// S3-совместимое хранилище содержимого досок и медиа.
	S3Endpoint  string
	S3AccessKey string
	S3SecretKey string
	S3Bucket    string
	S3Region    string
	// DocFlushInterval - период записи изменённых комнат в хранилище.
	DocFlushInterval time.Duration
	// ShutdownTimeout - бюджет на закрытие сокетов и сброс комнат при остановке.
	ShutdownTimeout time.Duration
	// MediaMaxBytes - лимит одного загружаемого файла.
	MediaMaxBytes int64
	// PurgeAfter - через сколько после удаления содержимое доски вычищается из хранилища.
	PurgeAfter time.Duration
	// PurgeInterval - как часто запускается очистка.
	PurgeInterval time.Duration
}

func Load() (*Config, error) {
	cfg := &Config{
		HTTPAddr:      getEnv("HTTP_ADDR", ":8080"),
		PostgresDSN:   getEnv("POSTGRES_DSN", ""),
		MigrationsDir: getEnv("MIGRATIONS_DIR", "migration"),
		RunMigrations: getEnvBool("RUN_MIGRATIONS", true),
		PresetReseed:  getEnvBool("PRESET_RESEED", false),

		TldrawLicenseKey:  getEnv("TLDRAW_LICENSE_KEY", ""),
		KeycloakPublicURL: strings.TrimRight(getEnv("KEYCLOAK_PUBLIC_URL", "http://localhost:8081"), "/"),

		OrgName:     getEnv("ORG_NAME", "Детский сад"),
		AdminEmails: splitList(getEnv("ADMIN_EMAILS", "")),

		S3Endpoint:       getEnv("S3_ENDPOINT", ""),
		S3AccessKey:      getEnv("S3_ACCESS_KEY", ""),
		S3SecretKey:      getEnv("S3_SECRET_KEY", ""),
		S3Bucket:         getEnv("S3_BUCKET", "blanko"),
		S3Region:         getEnv("S3_REGION", "us-east-1"),
		DocFlushInterval: getEnvDuration("DOC_FLUSH_INTERVAL", time.Second),
		ShutdownTimeout:  getEnvDuration("SHUTDOWN_TIMEOUT", 25*time.Second),
		MediaMaxBytes:    getEnvInt64("MEDIA_MAX_BYTES", 20<<20),
		PurgeAfter:       getEnvDuration("PURGE_AFTER", 30*24*time.Hour),
		PurgeInterval:    getEnvDuration("PURGE_INTERVAL", 24*time.Hour),
	}
	if cfg.PostgresDSN == "" {
		return nil, fmt.Errorf("POSTGRES_DSN is required")
	}
	for name, v := range map[string]string{"S3_ENDPOINT": cfg.S3Endpoint, "S3_ACCESS_KEY": cfg.S3AccessKey, "S3_SECRET_KEY": cfg.S3SecretKey} {
		if v == "" {
			return nil, fmt.Errorf("%s is required", name)
		}
	}
	return cfg, nil
}

func getEnvDuration(key string, def time.Duration) time.Duration {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return def
}

func getEnvInt64(key string, def int64) int64 {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
	}
	return def
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
