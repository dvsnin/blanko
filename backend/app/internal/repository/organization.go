package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/dvsnin/blanko/backend/app/internal/model"
)

type OrganizationRepo struct {
	db DBTX
}

func NewOrganizationRepo(db DBTX) *OrganizationRepo {
	return &OrganizationRepo{db: db}
}

// GetFirst: в коробке организация одна.
func (r *OrganizationRepo) GetFirst(ctx context.Context) (*model.Organization, error) {
	b := psql.Select("id", "name", "owner_account_id", "created_at", "updated_at").
		From("organization").OrderBy("created_at ASC").Limit(1)
	row, err := queryRowBuilder(ctx, r.db, b)
	if err != nil {
		return nil, err
	}
	var o model.Organization
	if err := row.Scan(&o.ID, &o.Name, &o.OwnerAccountID, &o.CreatedAt, &o.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &o, nil
}

func (r *OrganizationRepo) Create(ctx context.Context, o *model.Organization) error {
	if o.ID == uuid.Nil {
		o.ID = uuid.New()
	}
	now := time.Now().UTC()
	o.CreatedAt, o.UpdatedAt = now, now
	b := psql.Insert("organization").
		Columns("id", "name", "owner_account_id", "created_at", "updated_at").
		Values(o.ID, o.Name, o.OwnerAccountID, o.CreatedAt, o.UpdatedAt)
	_, err := execBuilder(ctx, r.db, b)
	return err
}

func (r *OrganizationRepo) GetMemberRole(ctx context.Context, orgID, accountID uuid.UUID) (model.OrganizationRole, error) {
	b := psql.Select("role").From("organization_member").
		Where("organization_id = ? AND account_id = ?", orgID, accountID).Limit(1)
	row, err := queryRowBuilder(ctx, r.db, b)
	if err != nil {
		return "", err
	}
	var role model.OrganizationRole
	if err := row.Scan(&role); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}
	return role, nil
}

func (r *OrganizationRepo) UpsertMember(ctx context.Context, orgID, accountID uuid.UUID, role model.OrganizationRole) error {
	now := time.Now().UTC()
	b := psql.Insert("organization_member").
		Columns("id", "organization_id", "account_id", "role", "created_at", "updated_at").
		Values(uuid.New(), orgID, accountID, role, now, now).
		Suffix("ON CONFLICT (organization_id, account_id) DO UPDATE SET role = EXCLUDED.role, updated_at = EXCLUDED.updated_at")
	_, err := execBuilder(ctx, r.db, b)
	return err
}

// EnsureMember: существующую запись не трогает.
func (r *OrganizationRepo) EnsureMember(ctx context.Context, orgID, accountID uuid.UUID, role model.OrganizationRole) error {
	now := time.Now().UTC()
	b := psql.Insert("organization_member").
		Columns("id", "organization_id", "account_id", "role", "created_at", "updated_at").
		Values(uuid.New(), orgID, accountID, role, now, now).
		Suffix("ON CONFLICT (organization_id, account_id) DO NOTHING")
	_, err := execBuilder(ctx, r.db, b)
	return err
}

func (r *OrganizationRepo) ListMembers(ctx context.Context, orgID uuid.UUID) ([]model.OrganizationMember, error) {
	b := psql.Select("om.account_id", "a.email", "om.role").
		From("organization_member om").
		Join("account a ON a.id = om.account_id").
		Where("om.organization_id = ?", orgID)
	rows, err := queryBuilder(ctx, r.db, b)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.OrganizationMember
	for rows.Next() {
		var m model.OrganizationMember
		if err := rows.Scan(&m.AccountID, &m.Email, &m.Role); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *OrganizationRepo) SetMemberRole(ctx context.Context, orgID, accountID uuid.UUID, role model.OrganizationRole) error {
	b := psql.Update("organization_member").
		Set("role", role).Set("updated_at", time.Now().UTC()).
		Where("organization_id = ? AND account_id = ?", orgID, accountID)
	_, err := execBuilder(ctx, r.db, b)
	return err
}

// Lock берёт строку организации под запись на время транзакции: смена ролей считает админов
// и не должна пересекаться с другой такой же сменой.
func (r *OrganizationRepo) Lock(ctx context.Context, orgID uuid.UUID) error {
	_, err := execBuilder(ctx, r.db, psql.Select("id").From("organization").Where("id = ?", orgID).Suffix("FOR UPDATE"))
	return err
}

// CountAdmins - сколько в организации владельцев и администраторов.
func (r *OrganizationRepo) CountAdmins(ctx context.Context, orgID uuid.UUID) (int, error) {
	row, err := queryRowBuilder(ctx, r.db, psql.Select("COUNT(*)").From("organization_member").
		Where("organization_id = ? AND role IN ('owner', 'admin')", orgID))
	if err != nil {
		return 0, err
	}
	var n int
	if err := row.Scan(&n); err != nil {
		return 0, err
	}
	return n, nil
}
