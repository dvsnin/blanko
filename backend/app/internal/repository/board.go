package repository

import (
	"context"
	"errors"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/dvsnin/blanko/backend/app/internal/model"
)

// BoardRepo - репозиторий досок.
type BoardRepo struct {
	db DBTX
}

func NewBoardRepo(db DBTX) *BoardRepo {
	return &BoardRepo{db: db}
}

// BoardFields - набор полей для частичного апдейта доски.
type BoardFields struct {
	Name              string
	TeamAccess        model.BoardAccess
	LinkAccessEnabled *bool
	// TeamID - перенос доски в другую команду.
	TeamID *uuid.UUID
}

// Create вставляет новую доску.
func (r *BoardRepo) Create(ctx context.Context, b *model.Board) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	if b.PublicID == "" {
		pid, err := newPublicID("")
		if err != nil {
			return err
		}
		b.PublicID = pid
	}
	if b.TeamAccess == "" {
		b.TeamAccess = model.BoardAccessEdit
	}
	now := time.Now().UTC()
	b.CreatedAt = now
	b.UpdatedAt = now
	b.LastOpenedAt = &now

	q := psql.Insert("board").
		Columns("id", "public_id", "name", "team_id", "account_id", "team_access", "link_access_enabled", "template_id", "created_at", "updated_at", "last_opened_at").
		Values(b.ID, b.PublicID, b.Name, b.TeamID, b.AccountID, b.TeamAccess, b.LinkAccessEnabled, b.TemplateID, b.CreatedAt, b.UpdatedAt, b.LastOpenedAt)
	_, err := execBuilder(ctx, r.db, q)
	return err
}

// GetByID возвращает доску по UUID.
func (r *BoardRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Board, error) {
	b := psql.Select("id", "public_id", "name", "team_id", "account_id", "team_access",
		"link_access_enabled", "template_id", "created_at", "updated_at", "last_opened_at").
		From("board").
		Where("id = ? AND deleted_at IS NULL", id).Limit(1)

	row, err := queryRowBuilder(ctx, r.db, b)
	if err != nil {
		return nil, err
	}
	var m model.Board
	if err := row.Scan(&m.ID, &m.PublicID, &m.Name, &m.TeamID, &m.AccountID,
		&m.TeamAccess, &m.LinkAccessEnabled, &m.TemplateID, &m.CreatedAt, &m.UpdatedAt, &m.LastOpenedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &m, nil
}

// GetByPublicID возвращает доску по её короткому public_id (из URL доски).
func (r *BoardRepo) GetByPublicID(ctx context.Context, publicID string) (*model.Board, error) {
	b := psql.Select("id", "public_id", "name", "team_id", "account_id", "team_access",
		"link_access_enabled", "template_id", "created_at", "updated_at", "last_opened_at").
		From("board").
		Where("public_id = ? AND deleted_at IS NULL", publicID).Limit(1)

	row, err := queryRowBuilder(ctx, r.db, b)
	if err != nil {
		return nil, err
	}
	var m model.Board
	if err := row.Scan(&m.ID, &m.PublicID, &m.Name, &m.TeamID, &m.AccountID,
		&m.TeamAccess, &m.LinkAccessEnabled, &m.TemplateID, &m.CreatedAt, &m.UpdatedAt, &m.LastOpenedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &m, nil
}

// listSelect - общая выборка списков досок: владелец, избранное и роль зрителя в команде доски.
// Роль нужна сервису, чтобы считать доступ и canEdit без запросов на каждую доску.
func listSelect(viewerID uuid.UUID) sq.SelectBuilder {
	return psql.Select(
		"b.id", "b.public_id", "b.name", "b.team_id", "b.account_id", "b.team_access",
		"b.link_access_enabled", "b.template_id", "b.created_at", "b.updated_at", "b.last_opened_at",
		"a.name",
		"(bs.board_id IS NOT NULL) AS is_starred",
		"tm.role",
	).
		From("board b").
		Join("team_member tm ON tm.team_id = b.team_id AND tm.account_id = ?", viewerID).
		Join("account a ON a.id = b.account_id").
		LeftJoin("board_starred bs ON bs.board_id = b.id AND bs.account_id = ?", viewerID).
		Where("b.deleted_at IS NULL").
		OrderBy("b.updated_at DESC")
}

func scanBoardViews(rows pgx.Rows) ([]model.BoardView, error) {
	defer rows.Close()
	var result []model.BoardView
	for rows.Next() {
		var bv model.BoardView
		if err := rows.Scan(
			&bv.Board.ID, &bv.Board.PublicID, &bv.Board.Name, &bv.Board.TeamID, &bv.Board.AccountID,
			&bv.Board.TeamAccess, &bv.Board.LinkAccessEnabled, &bv.Board.TemplateID, &bv.Board.CreatedAt, &bv.Board.UpdatedAt, &bv.Board.LastOpenedAt,
			&bv.OwnerName,
			&bv.IsStarred,
			&bv.ViewerRole,
		); err != nil {
			return nil, err
		}
		result = append(result, bv)
	}
	return result, rows.Err()
}

// ListByTeam возвращает доски команды для её участника (не участнику - пусто).
func (r *BoardRepo) ListByTeam(ctx context.Context, teamID uuid.UUID, viewerID uuid.UUID) ([]model.BoardView, error) {
	rows, err := queryBuilder(ctx, r.db, listSelect(viewerID).Where("b.team_id = ?", teamID))
	if err != nil {
		return nil, err
	}
	return scanBoardViews(rows)
}

// ListForAccount возвращает доски всех живых команд, где пользователь участник, одним запросом:
// team_member по индексу account_id даёт команды, board по индексу team_id - их доски.
func (r *BoardRepo) ListForAccount(ctx context.Context, viewerID uuid.UUID) ([]model.BoardView, error) {
	rows, err := queryBuilder(ctx, r.db, listSelect(viewerID).
		Join("team t ON t.id = b.team_id AND t.deleted_at IS NULL"))
	if err != nil {
		return nil, err
	}
	return scanBoardViews(rows)
}

// Update - переиспользуемое частичное обновление доски.
func (r *BoardRepo) Update(ctx context.Context, id uuid.UUID, f BoardFields) error {
	b := psql.Update("board").Where("id = ? AND deleted_at IS NULL", id)
	touched := false
	if f.Name != "" {
		b = b.Set("name", f.Name)
		touched = true
	}
	if f.TeamAccess != "" {
		b = b.Set("team_access", f.TeamAccess)
		touched = true
	}
	if f.LinkAccessEnabled != nil {
		b = b.Set("link_access_enabled", *f.LinkAccessEnabled)
		touched = true
	}
	if f.TeamID != nil {
		b = b.Set("team_id", *f.TeamID)
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

// TouchLastOpened проставляет last_opened_at = now() (доску открыли).
func (r *BoardRepo) TouchLastOpened(ctx context.Context, id uuid.UUID) error {
	b := psql.Update("board").
		Where("id = ? AND deleted_at IS NULL", id).
		Set("last_opened_at", time.Now().UTC())
	_, err := execBuilder(ctx, r.db, b)
	return err
}

// SoftDelete помечает доску удалённой.
func (r *BoardRepo) SoftDelete(ctx context.Context, id uuid.UUID) error {
	now := time.Now().UTC()
	b := psql.Update("board").
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

// SetStarred проставляет/снимает избранное для доски у конкретного пользователя.
func (r *BoardRepo) SetStarred(ctx context.Context, accountID, boardID uuid.UUID, starred bool) error {
	if starred {
		q := psql.Insert("board_starred").
			Columns("account_id", "board_id", "created_at").
			Values(accountID, boardID, time.Now().UTC()).
			Suffix("ON CONFLICT (account_id, board_id) DO NOTHING")
		_, err := execBuilder(ctx, r.db, q)
		return err
	}
	q := psql.Delete("board_starred").Where("account_id = ? AND board_id = ?", accountID, boardID)
	_, err := execBuilder(ctx, r.db, q)
	return err
}
