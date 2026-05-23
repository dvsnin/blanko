package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/dvsnin/blanko/backend/app/internal/model"
)

// TeamRepo — репозиторий команд.
type TeamRepo struct {
	db DBTX
}

func NewTeamRepo(db DBTX) *TeamRepo {
	return &TeamRepo{db: db}
}

// TeamFields — набор полей для частичного апдейта команды.
// Непустые/ненулевые значения будут применены.
type TeamFields struct {
	Name              string
	MemberBoardAccess model.BoardAccess
}

// Create вставляет команду.
func (r *TeamRepo) Create(ctx context.Context, t *model.Team) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	if t.MemberBoardAccess == "" {
		t.MemberBoardAccess = model.BoardAccessEdit
	}
	now := time.Now().UTC()
	t.CreatedAt = now
	t.UpdatedAt = now

	b := psql.Insert("team").
		Columns("id", "organization_id", "name", "member_board_access", "created_at", "updated_at").
		Values(t.ID, t.OrganizationID, t.Name, t.MemberBoardAccess, t.CreatedAt, t.UpdatedAt)
	if _, err := execBuilder(ctx, r.db, b); err != nil {
		return err
	}
	return nil
}

// GetByID возвращает команду по ID (с проверкой soft-delete).
func (r *TeamRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Team, error) {
	b := psql.Select("id", "organization_id", "name", "member_board_access", "created_at", "updated_at").
		From("team").
		Where("id = ? AND deleted_at IS NULL", id).
		Limit(1)

	row, err := queryRowBuilder(ctx, r.db, b)
	if err != nil {
		return nil, err
	}
	var t model.Team
	if err := row.Scan(&t.ID, &t.OrganizationID, &t.Name, &t.MemberBoardAccess, &t.CreatedAt, &t.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &t, nil
}

// Update — переиспользуемое частичное обновление. Применяются только непустые поля.
func (r *TeamRepo) Update(ctx context.Context, id uuid.UUID, f TeamFields) error {
	b := psql.Update("team").Where("id = ? AND deleted_at IS NULL", id)
	touched := false
	if f.Name != "" {
		b = b.Set("name", f.Name)
		touched = true
	}
	if f.MemberBoardAccess != "" {
		b = b.Set("member_board_access", f.MemberBoardAccess)
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

// SoftDelete помечает команду удалённой.
func (r *TeamRepo) SoftDelete(ctx context.Context, id uuid.UUID) error {
	now := time.Now().UTC()
	b := psql.Update("team").
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

// ListForAccount возвращает все команды, где пользователь является участником,
// вместе с ролью пользователя, признаком избранного и количеством досок.
func (r *TeamRepo) ListForAccount(ctx context.Context, accountID uuid.UUID) ([]model.TeamView, error) {
	b := psql.Select(
		"t.id", "t.organization_id", "t.name", "t.member_board_access", "t.created_at", "t.updated_at",
		"tm.role",
		"(ts.account_id IS NOT NULL) AS is_starred",
		"COALESCE((SELECT COUNT(*) FROM board WHERE team_id = t.id AND deleted_at IS NULL), 0) AS board_count",
	).
		From("team t").
		Join("team_member tm ON tm.team_id = t.id AND tm.account_id = ?", accountID).
		LeftJoin("team_starred ts ON ts.team_id = t.id AND ts.account_id = ?", accountID).
		Where("t.deleted_at IS NULL").
		OrderBy("t.created_at ASC")

	rows, err := queryBuilder(ctx, r.db, b)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []model.TeamView
	for rows.Next() {
		var tv model.TeamView
		if err := rows.Scan(
			&tv.Team.ID, &tv.Team.OrganizationID, &tv.Team.Name, &tv.Team.MemberBoardAccess,
			&tv.Team.CreatedAt, &tv.Team.UpdatedAt,
			&tv.Role,
			&tv.IsStarred,
			&tv.BoardCount,
		); err != nil {
			return nil, err
		}
		result = append(result, tv)
	}
	return result, rows.Err()
}

// GetRoleForAccount возвращает роль пользователя в команде (или ErrNotFound).
func (r *TeamRepo) GetRoleForAccount(ctx context.Context, teamID, accountID uuid.UUID) (model.TeamRole, error) {
	b := psql.Select("role").From("team_member").
		Where("team_id = ? AND account_id = ?", teamID, accountID).Limit(1)

	row, err := queryRowBuilder(ctx, r.db, b)
	if err != nil {
		return "", err
	}
	var role model.TeamRole
	if err := row.Scan(&role); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}
	return role, nil
}

// AddMember добавляет участника в команду.
func (r *TeamRepo) AddMember(ctx context.Context, teamID, accountID uuid.UUID, role model.TeamRole) error {
	now := time.Now().UTC()
	b := psql.Insert("team_member").
		Columns("id", "team_id", "account_id", "role", "created_at", "updated_at").
		Values(uuid.New(), teamID, accountID, role, now, now).
		Suffix("ON CONFLICT (team_id, account_id) DO NOTHING")
	_, err := execBuilder(ctx, r.db, b)
	return err
}

// RemoveMember исключает участника из команды.
func (r *TeamRepo) RemoveMember(ctx context.Context, teamID, accountID uuid.UUID) error {
	b := psql.Delete("team_member").Where("team_id = ? AND account_id = ?", teamID, accountID)
	_, err := execBuilder(ctx, r.db, b)
	return err
}

// SetStarred переключает «избранное» для команды.
func (r *TeamRepo) SetStarred(ctx context.Context, teamID, accountID uuid.UUID, starred bool) error {
	if starred {
		b := psql.Insert("team_starred").
			Columns("account_id", "team_id", "created_at").
			Values(accountID, teamID, time.Now().UTC()).
			Suffix("ON CONFLICT DO NOTHING")
		_, err := execBuilder(ctx, r.db, b)
		return err
	}
	b := psql.Delete("team_starred").Where("team_id = ? AND account_id = ?", teamID, accountID)
	_, err := execBuilder(ctx, r.db, b)
	return err
}
