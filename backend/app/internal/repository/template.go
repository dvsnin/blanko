package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/dvsnin/blanko/backend/app/internal/model"
)

type TemplateRepo struct {
	db DBTX
}

func NewTemplateRepo(db DBTX) *TemplateRepo {
	return &TemplateRepo{db: db}
}

// TemplateFields: nil-поля не меняются.
type TemplateFields struct {
	Name        *string
	Description *string
	Topic       *string
	Ages        []string
	DurationMin *int
}

const templateCols = "id, public_id, preset_key, name, description, topic, ages, duration_min, glyph, author_account_id, created_at, updated_at"

func scanTemplate(row pgx.Row, t *model.Template) error {
	return row.Scan(&t.ID, &t.PublicID, &t.PresetKey, &t.Name, &t.Description, &t.Topic, &t.Ages,
		&t.DurationMin, &t.Glyph, &t.AuthorAccountID, &t.CreatedAt, &t.UpdatedAt)
}

func (r *TemplateRepo) Create(ctx context.Context, t *model.Template) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	if t.PublicID == "" {
		pid, err := newPublicID("t")
		if err != nil {
			return err
		}
		t.PublicID = pid
	}
	now := time.Now().UTC()
	t.CreatedAt = now
	t.UpdatedAt = now
	if t.Ages == nil {
		t.Ages = []string{}
	}
	q := psql.Insert("template").
		Columns("id", "public_id", "preset_key", "name", "description", "topic", "ages", "duration_min", "glyph", "author_account_id", "created_at", "updated_at").
		Values(t.ID, t.PublicID, t.PresetKey, t.Name, t.Description, t.Topic, t.Ages, t.DurationMin, t.Glyph, t.AuthorAccountID, t.CreatedAt, t.UpdatedAt)
	_, err := execBuilder(ctx, r.db, q)
	return err
}

func (r *TemplateRepo) getBy(ctx context.Context, where string, arg any) (*model.Template, error) {
	b := psql.Select(templateCols).From("template").Where(where, arg).Limit(1)
	row, err := queryRowBuilder(ctx, r.db, b)
	if err != nil {
		return nil, err
	}
	var t model.Template
	if err := scanTemplate(row, &t); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &t, nil
}

func (r *TemplateRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Template, error) {
	return r.getBy(ctx, "id = ? AND deleted_at IS NULL", id)
}

func (r *TemplateRepo) GetByPublicID(ctx context.Context, publicID string) (*model.Template, error) {
	return r.getBy(ctx, "public_id = ? AND deleted_at IS NULL", publicID)
}

func (r *TemplateRepo) Exists(ctx context.Context, id uuid.UUID) (bool, error) {
	b := psql.Select("1").From("template").Where("id = ? AND deleted_at IS NULL", id).Limit(1)
	row, err := queryRowBuilder(ctx, r.db, b)
	if err != nil {
		return false, err
	}
	var one int
	if err := row.Scan(&one); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// List: CanEdit здесь не вычисляется, это делает сервис.
func (r *TemplateRepo) List(ctx context.Context, viewerID uuid.UUID) ([]model.TemplateView, error) {
	b := psql.Select(
		"t.id", "t.public_id", "t.preset_key", "t.name", "t.description", "t.topic", "t.ages", "t.duration_min", "t.glyph",
		"t.author_account_id", "t.created_at", "t.updated_at",
		"COALESCE(a.name, '') AS author_name",
		"(ts.template_id IS NOT NULL) AS is_starred",
	).
		From("template t").
		LeftJoin("account a ON a.id = t.author_account_id").
		LeftJoin("template_starred ts ON ts.template_id = t.id AND ts.account_id = ?", viewerID).
		Where("t.deleted_at IS NULL").
		OrderBy("t.created_at ASC") // по имени сортирует сервис

	rows, err := queryBuilder(ctx, r.db, b)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []model.TemplateView
	for rows.Next() {
		var v model.TemplateView
		t := &v.Template
		if err := rows.Scan(&t.ID, &t.PublicID, &t.PresetKey, &t.Name, &t.Description, &t.Topic, &t.Ages,
			&t.DurationMin, &t.Glyph, &t.AuthorAccountID, &t.CreatedAt, &t.UpdatedAt,
			&v.AuthorName, &v.IsStarred); err != nil {
			return nil, err
		}
		result = append(result, v)
	}
	return result, rows.Err()
}

func (r *TemplateRepo) Update(ctx context.Context, id uuid.UUID, f TemplateFields) error {
	b := psql.Update("template").Where("id = ? AND deleted_at IS NULL", id)
	touched := false
	if f.Name != nil {
		b = b.Set("name", *f.Name)
		touched = true
	}
	if f.Description != nil {
		b = b.Set("description", *f.Description)
		touched = true
	}
	if f.Topic != nil {
		b = b.Set("topic", *f.Topic)
		touched = true
	}
	if f.Ages != nil {
		b = b.Set("ages", f.Ages)
		touched = true
	}
	if f.DurationMin != nil {
		b = b.Set("duration_min", *f.DurationMin)
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

// SoftDelete: доски сохраняют ссылку на удалённый шаблон.
func (r *TemplateRepo) SoftDelete(ctx context.Context, id uuid.UUID) error {
	now := time.Now().UTC()
	b := psql.Update("template").
		Where("id = ? AND deleted_at IS NULL", id).
		Set("deleted_at", now).
		Set("updated_at", now)
	tag, err := execBuilder(ctx, r.db, b)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *TemplateRepo) SetStarred(ctx context.Context, accountID, templateID uuid.UUID, starred bool) error {
	if starred {
		q := psql.Insert("template_starred").
			Columns("account_id", "template_id", "created_at").
			Values(accountID, templateID, time.Now().UTC()).
			Suffix("ON CONFLICT (account_id, template_id) DO NOTHING")
		_, err := execBuilder(ctx, r.db, q)
		return err
	}
	q := psql.Delete("template_starred").Where("account_id = ? AND template_id = ?", accountID, templateID)
	_, err := execBuilder(ctx, r.db, q)
	return err
}
