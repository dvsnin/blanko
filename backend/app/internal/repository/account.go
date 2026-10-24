package repository

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/dvsnin/blanko/backend/app/internal/model"
)

// AccountRepo - репозиторий работы с таблицей account.
type AccountRepo struct {
	db DBTX
}

// NewAccountRepo создаёт репозиторий.
func NewAccountRepo(db DBTX) *AccountRepo {
	return &AccountRepo{db: db}
}

// AccountFields - набор полей для частичного апдейта учётной записи.
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
		Columns("id", "email", "name", "prefs", "created_at", "updated_at").
		Values(a.ID, a.Email, a.Name, prefsJSON(a.Prefs), a.CreatedAt, a.UpdatedAt)
	if _, err := execBuilder(ctx, r.db, b); err != nil {
		return err
	}
	return nil
}

// GetByEmail возвращает учётную запись по email.
func (r *AccountRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Account, error) {
	return r.getBy(ctx, "id = ? AND deleted_at IS NULL", id)
}

func (r *AccountRepo) GetByEmail(ctx context.Context, email string) (*model.Account, error) {
	return r.getBy(ctx, "email = ? AND deleted_at IS NULL", email)
}

func (r *AccountRepo) getBy(ctx context.Context, where string, arg any) (*model.Account, error) {
	b := psql.Select("id", "email", "name", "prefs", "created_at", "updated_at").
		From("account").
		Where(where, arg).
		Limit(1)

	row, err := queryRowBuilder(ctx, r.db, b)
	if err != nil {
		return nil, err
	}
	var a model.Account
	if err := row.Scan(&a.ID, &a.Email, &a.Name, &a.Prefs, &a.CreatedAt, &a.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &a, nil
}

// Search - живые учётные записи, у которых имя или email содержит q (без учёта регистра);
// пустой q отдаёт всех. Порядок по-русски выставляет сервис.
func (r *AccountRepo) Search(ctx context.Context, q string, limit uint64) ([]model.Account, error) {
	b := psql.Select("id", "email", "name", "created_at", "updated_at").
		From("account").
		Where("deleted_at IS NULL").
		Limit(limit)
	if q != "" {
		like := "%" + escapeLike(q) + "%"
		b = b.Where("(name ILIKE ? OR email ILIKE ?)", like, like)
	}
	rows, err := queryBuilder(ctx, r.db, b)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Account
	for rows.Next() {
		var a model.Account
		if err := rows.Scan(&a.ID, &a.Email, &a.Name, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func escapeLike(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, "%", `\%`)
	return strings.ReplaceAll(s, "_", `\_`)
}

// UpdatePrefs заменяет настройки целиком; слияние делает сервис.
func (r *AccountRepo) UpdatePrefs(ctx context.Context, id uuid.UUID, p model.Prefs) error {
	b := psql.Update("account").
		Set("prefs", prefsJSON(p)).
		Set("updated_at", time.Now().UTC()).
		Where("id = ? AND deleted_at IS NULL", id)
	tag, err := execBuilder(ctx, r.db, b)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// prefsJSON: nil-карта пишется как пустой объект, а не SQL NULL.
func prefsJSON(p model.Prefs) []byte {
	if p == nil {
		p = model.Prefs{}
	}
	b, _ := json.Marshal(p)
	return b
}

// Update - переиспользуемое частичное обновление: применяются только непустые поля.
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
