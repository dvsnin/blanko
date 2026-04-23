package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/dvsnin/blanko/backend/app/internal/model"
)

// AccountRepo — репозиторий работы с таблицей account.
type AccountRepo struct {
	db DBTX
}

// NewAccountRepo создаёт репозиторий.
func NewAccountRepo(db DBTX) *AccountRepo {
	return &AccountRepo{db: db}
}

// AccountFields — набор полей для частичного апдейта учётной записи.
// Непустые значения будут применены.
type AccountFields struct {
	Email string
	Name  string
}

// Create вставляет новую учётную запись.
func (r *AccountRepo) Create(ctx context.Context, a *model.Account) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	now := time.Now().UTC()
	a.CreatedAt = now
	a.UpdatedAt = now

	b := psql.Insert("account").
		Columns("id", "email", "name", "created_at", "updated_at").
		Values(a.ID, a.Email, a.Name, a.CreatedAt, a.UpdatedAt)
	if _, err := execBuilder(ctx, r.db, b); err != nil {
		return err
	}
	return nil
}

// GetByEmail возвращает учётную запись по email.
func (r *AccountRepo) GetByEmail(ctx context.Context, email string) (*model.Account, error) {
	b := psql.Select("id", "email", "name", "created_at", "updated_at").
		From("account").
		Where("email = ? AND deleted_at IS NULL", email).
		Limit(1)

	row, err := queryRowBuilder(ctx, r.db, b)
	if err != nil {
		return nil, err
	}
	var a model.Account
	if err := row.Scan(&a.ID, &a.Email, &a.Name, &a.CreatedAt, &a.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &a, nil
}

// Update — переиспользуемое частичное обновление: применяются только непустые поля.
func (r *AccountRepo) Update(ctx context.Context, id uuid.UUID, f AccountFields) error {
	b := psql.Update("account").Where("id = ?", id)
	touched := false
	if f.Email != "" {
		b = b.Set("email", f.Email)
		touched = true
	}
	if f.Name != "" {
		b = b.Set("name", f.Name)
		touched = true
	}
	if !touched {
		return nil
	}
	b = b.Set("updated_at", time.Now().UTC())
	tag, err := execBuilder(ctx, r.db, b)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
