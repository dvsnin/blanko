// Package repository - доступ к данным; SQL собирается через squirrel.
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

// DBTX - минимальный интерфейс, который реализуют и *pgxpool.Pool, и pgx.Tx.
// Позволяет репозиториям работать в транзакциях и вне их.
type DBTX interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

var ErrNotFound = errors.New("not found")

// psql - билдер squirrel, предварительно настроенный на $1-плейсхолдеры PostgreSQL.
var psql = sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

type Pool = pgxpool.Pool

func execBuilder(ctx context.Context, db DBTX, b sq.Sqlizer) (pgconn.CommandTag, error) {
	query, args, err := b.ToSql()
	if err != nil {
		return pgconn.CommandTag{}, fmt.Errorf("build sql: %w", err)
	}
	return db.Exec(ctx, query, args...)
}

func queryBuilder(ctx context.Context, db DBTX, b sq.Sqlizer) (pgx.Rows, error) {
	query, args, err := b.ToSql()
	if err != nil {
		return nil, fmt.Errorf("build sql: %w", err)
	}
	return db.Query(ctx, query, args...)
}

func queryRowBuilder(ctx context.Context, db DBTX, b sq.Sqlizer) (pgx.Row, error) {
	query, args, err := b.ToSql()
	if err != nil {
		return nil, fmt.Errorf("build sql: %w", err)
	}
	return db.QueryRow(ctx, query, args...), nil
}
