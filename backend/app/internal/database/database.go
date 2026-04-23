package database

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect создаёт пул подключений pgx к PostgreSQL.
func Connect(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse pg dsn: %w", err)
	}
	cfg.MaxConns = 16
	cfg.MinConns = 2
	cfg.MaxConnLifetime = time.Hour

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("new pgx pool: %w", err)
	}
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		return nil, fmt.Errorf("ping pg: %w", err)
	}
	return pool, nil
}

// Migrate применяет SQL-миграции из директории dir. Формат файлов совместим
// с goose: секция Up между "-- +goose Up" и "-- +goose Down" выполняется целиком.
// Применённые миграции фиксируются в таблице schema_migrations (по имени файла).
func Migrate(ctx context.Context, pool *pgxpool.Pool, dir string) error {
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	// Совместимость с предыдущим goose: если существует goose_db_version,
	// подтягиваем уже применённые версии в schema_migrations, сопоставляя
	// numeric-префикс имени файла с version_id из goose.
	if err := importGooseHistory(ctx, pool, dir); err != nil {
		return fmt.Errorf("import goose history: %w", err)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("read migrations dir %q: %w", dir, err)
	}

	var files []string
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		files = append(files, e.Name())
	}
	sort.Strings(files)

	for _, name := range files {
		var exists bool
		if err := pool.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)`, name,
		).Scan(&exists); err != nil {
			return fmt.Errorf("check migration %s: %w", name, err)
		}
		if exists {
			continue
		}

		raw, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		up := extractGooseUp(string(raw))
		if strings.TrimSpace(up) == "" {
			// Пустая миграция — просто отметим как применённую.
			if _, err := pool.Exec(ctx,
				`INSERT INTO schema_migrations(version) VALUES($1)`, name,
			); err != nil {
				return fmt.Errorf("mark migration %s: %w", name, err)
			}
			continue
		}

		if err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
			if _, err := tx.Exec(ctx, up); err != nil {
				return fmt.Errorf("apply migration %s: %w", name, err)
			}
			if _, err := tx.Exec(ctx,
				`INSERT INTO schema_migrations(version) VALUES($1)`, name,
			); err != nil {
				return fmt.Errorf("record migration %s: %w", name, err)
			}
			return nil
		}); err != nil {
			return err
		}
	}
	return nil
}

// extractGooseUp вытаскивает секцию Up из goose-файла, удаляя управляющие аннотации.
func extractGooseUp(content string) string {
	lines := strings.Split(content, "\n")
	var (
		out     []string
		inUp    bool
		stopped bool
	)
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		lower := strings.ToLower(trimmed)
		switch {
		case strings.HasPrefix(lower, "-- +goose up"):
			inUp = true
			continue
		case strings.HasPrefix(lower, "-- +goose down"):
			inUp = false
			stopped = true
			continue
		case strings.HasPrefix(lower, "-- +goose statementbegin"),
			strings.HasPrefix(lower, "-- +goose statementend"),
			strings.HasPrefix(lower, "-- +goose no transaction"):
			continue
		}
		if stopped {
			continue
		}
		if inUp {
			out = append(out, line)
		}
	}
	return strings.Join(out, "\n")
}

// importGooseHistory переносит применённые миграции из старой таблицы
// goose_db_version в schema_migrations. Если goose_db_version отсутствует —
// ничего не делает. Сопоставление идёт по numeric-префиксу имени файла.
func importGooseHistory(ctx context.Context, pool *pgxpool.Pool, dir string) error {
	var exists bool
	if err := pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = current_schema() AND table_name = 'goose_db_version'
		)
	`).Scan(&exists); err != nil {
		return fmt.Errorf("probe goose_db_version: %w", err)
	}
	if !exists {
		return nil
	}

	rows, err := pool.Query(ctx, `
		SELECT version_id FROM goose_db_version
		WHERE is_applied = true AND version_id > 0
	`)
	if err != nil {
		return fmt.Errorf("select goose versions: %w", err)
	}
	defer rows.Close()

	applied := make(map[int64]bool)
	for rows.Next() {
		var v int64
		if err := rows.Scan(&v); err != nil {
			return fmt.Errorf("scan goose version: %w", err)
		}
		applied[v] = true
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if len(applied) == 0 {
		return nil
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("read dir %q: %w", dir, err)
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		name := e.Name()
		// Формат goose: <version>_<name>.sql
		prefix := name
		if idx := strings.Index(name, "_"); idx > 0 {
			prefix = name[:idx]
		}
		var v int64
		if _, err := fmt.Sscanf(prefix, "%d", &v); err != nil {
			continue
		}
		if !applied[v] {
			continue
		}
		if _, err := pool.Exec(ctx,
			`INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING`,
			name,
		); err != nil {
			return fmt.Errorf("seed schema_migrations %s: %w", name, err)
		}
	}
	return nil
}
