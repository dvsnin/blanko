// Package repository содержит реализацию слоя доступа к данным.
// Все SQL-запросы собираются через squirrel (PostgreSQL placeholders).
package repository

import (
	"context"
	"errors"
	"fmt"

	sq "github.com/Masterminds/squirrel"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DBTX — минимальный интерфейс, который реализуют и *pgxpool.Pool, и pgx.Tx.
// Позволяет репозиториям работать в транзакциях и вне их.
type DBTX interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// ErrNotFound — запись не найдена.
var ErrNotFound = errors.New("not found")

// psql — билдер squirrel, предварительно настроенный на $1-плейсхолдеры PostgreSQL.
var psql = sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

// Pool — pgxpool, хранимый на уровне репозиториев.
type Pool = pgxpool.Pool

// execBuilder выполняет builder-INSERT/UPDATE/DELETE через DBTX.
func execBuilder(ctx context.Context, db DBTX, b sq.Sqlizer) (pgconn.CommandTag, error) {
	query, args, err := b.ToSql()
	if err != nil {
		return pgconn.CommandTag{}, fmt.Errorf("build sql: %w", err)
	}
	return db.Exec(ctx, query, args...)
}

// queryBuilder выполняет builder-SELECT через DBTX и возвращает pgx.Rows.
func queryBuilder(ctx context.Context, db DBTX, b sq.Sqlizer) (pgx.Rows, error) {
	query, args, err := b.ToSql()
	if err != nil {
		return nil, fmt.Errorf("build sql: %w", err)
	}
	return db.Query(ctx, query, args...)
}

// queryRowBuilder выполняет builder-SELECT с одним результатом.
func queryRowBuilder(ctx context.Context, db DBTX, b sq.Sqlizer) (pgx.Row, error) {
	query, args, err := b.ToSql()
	if err != nil {
		return nil, fmt.Errorf("build sql: %w", err)
	}
	return db.QueryRow(ctx, query, args...), nil
}
