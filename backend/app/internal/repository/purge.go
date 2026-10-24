package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Очистка хранилища: документы, удалённые раньше before и ещё не вычищенные.

func listPurgeable(ctx context.Context, db DBTX, table string, before time.Time, limit uint64) ([]uuid.UUID, error) {
	b := psql.Select("id").From(table).
		Where("deleted_at IS NOT NULL AND deleted_at < ? AND purged_at IS NULL", before).
		OrderBy("deleted_at").Limit(limit)
	rows, err := queryBuilder(ctx, db, b)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func markPurged(ctx context.Context, db DBTX, table string, id uuid.UUID) error {
	_, err := execBuilder(ctx, db, psql.Update(table).Set("purged_at", time.Now().UTC()).Where("id = ?", id))
	return err
}

func (r *BoardRepo) ListPurgeable(ctx context.Context, before time.Time, limit uint64) ([]uuid.UUID, error) {
	return listPurgeable(ctx, r.db, "board", before, limit)
}

func (r *BoardRepo) MarkPurged(ctx context.Context, id uuid.UUID) error {
	return markPurged(ctx, r.db, "board", id)
}

func (r *TemplateRepo) ListPurgeable(ctx context.Context, before time.Time, limit uint64) ([]uuid.UUID, error) {
	return listPurgeable(ctx, r.db, "template", before, limit)
}

func (r *TemplateRepo) MarkPurged(ctx context.Context, id uuid.UUID) error {
	return markPurged(ctx, r.db, "template", id)
}
