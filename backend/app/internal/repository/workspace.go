package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/dvsnin/blanko/backend/app/internal/model"
)

// WorkspaceRepo — репозиторий таблицы workspace.
type WorkspaceRepo struct {
	db DBTX
}

func NewWorkspaceRepo(db DBTX) *WorkspaceRepo {
	return &WorkspaceRepo{db: db}
}

// Create вставляет новое рабочее пространство.
func (r *WorkspaceRepo) Create(ctx context.Context, w *model.Workspace) error {
	if w.ID == uuid.Nil {
		w.ID = uuid.New()
	}
	now := time.Now().UTC()
	w.CreatedAt = now
	w.UpdatedAt = now

	b := psql.Insert("workspace").
		Columns("id", "name", "account_id", "is_organization", "created_at", "updated_at").
		Values(w.ID, w.Name, w.AccountID, w.IsOrganization, w.CreatedAt, w.UpdatedAt)
	if _, err := execBuilder(ctx, r.db, b); err != nil {
		return err
	}
	return nil
}

// GetByAccountID возвращает личное пространство пользователя.
func (r *WorkspaceRepo) GetByAccountID(ctx context.Context, accountID uuid.UUID) (*model.Workspace, error) {
	b := psql.Select("id", "name", "account_id", "is_organization", "created_at", "updated_at").
		From("workspace").
		Where("account_id = ? AND deleted_at IS NULL", accountID).
		Limit(1)

	row, err := queryRowBuilder(ctx, r.db, b)
	if err != nil {
		return nil, err
	}
	var w model.Workspace
	if err := row.Scan(&w.ID, &w.Name, &w.AccountID, &w.IsOrganization, &w.CreatedAt, &w.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &w, nil
}
