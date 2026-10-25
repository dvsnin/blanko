package repository

import (
	"context"
	"errors"
	"strings"
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
	Name string
	// TeamAccess - своя настройка доски; TeamAccessInherit сбрасывает её в «как в группе».
	TeamAccess        model.BoardAccess
	TeamAccessInherit bool
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
	now := time.Now().UTC()
	b.CreatedAt = now
	b.UpdatedAt = now
	b.LastOpenedAt = &now

	// Пустой TeamAccess - доска наследует уровень группы (NULL в колонке).
	var access *model.BoardAccess
	if b.TeamAccess != "" {
		access = &b.TeamAccess
	}
	q := psql.Insert("board").
		Columns("id", "public_id", "name", "team_id", "account_id", "team_access", "link_access_enabled", "template_id", "created_at", "updated_at", "last_opened_at").
		Values(b.ID, b.PublicID, b.Name, b.TeamID, b.AccountID, access, b.LinkAccessEnabled, b.TemplateID, b.CreatedAt, b.UpdatedAt, b.LastOpenedAt)
	if _, err := execBuilder(ctx, r.db, q); err != nil {
		return err
	}
	// Перечитываем действующий доступ: он зависит от группы.
	fresh, err := r.GetByID(ctx, b.ID)
	if err != nil {
		return err
	}
	*b = *fresh
	return nil
}

// boardColumns - колонки доски с действующим доступом участников: своя настройка или уровень группы.
// Запросы ждут доску как b, её группу как t и ведущего показа как p (LEFT JOIN account p).
var boardColumns = []string{
	"b.id", "b.public_id", "b.name", "b.team_id", "b.account_id",
	"COALESCE(b.team_access, t.member_board_access) AS team_access", "(b.team_access IS NULL) AS team_access_inherited",
	"b.link_access_enabled", "b.template_id", "b.created_at", "b.updated_at", "b.last_opened_at",
	"b.present_token", "b.presenter_account_id", "COALESCE(p.name, '') AS presenter_name", "b.present_expires_at",
}

const presenterJoin = "account p ON p.id = b.presenter_account_id"

func scanBoard(row interface{ Scan(dest ...any) error }, m *model.Board) error {
	return row.Scan(&m.ID, &m.PublicID, &m.Name, &m.TeamID, &m.AccountID,
		&m.TeamAccess, &m.TeamAccessInherited, &m.LinkAccessEnabled, &m.TemplateID, &m.CreatedAt, &m.UpdatedAt, &m.LastOpenedAt,
		&m.PresentToken, &m.PresenterAccountID, &m.PresenterName, &m.PresentExpiresAt)
}

func (r *BoardRepo) getBy(ctx context.Context, where string, arg any) (*model.Board, error) {
	b := psql.Select(boardColumns...).From("board b").Join("team t ON t.id = b.team_id").LeftJoin(presenterJoin).
		Where(where, arg).Limit(1)
	row, err := queryRowBuilder(ctx, r.db, b)
	if err != nil {
		return nil, err
	}
	var m model.Board
	if err := scanBoard(row, &m); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &m, nil
}

// GetByID возвращает доску по UUID.
func (r *BoardRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Board, error) {
	return r.getBy(ctx, "b.id = ? AND b.deleted_at IS NULL", id)
}

// GetByPublicID возвращает доску по её короткому public_id (из URL доски).
func (r *BoardRepo) GetByPublicID(ctx context.Context, publicID string) (*model.Board, error) {
	return r.getBy(ctx, "b.public_id = ? AND b.deleted_at IS NULL", publicID)
}

// GetByPresentToken - доска по токену показа.
func (r *BoardRepo) GetByPresentToken(ctx context.Context, token string) (*model.Board, error) {
	return r.getBy(ctx, "b.present_token = ? AND b.deleted_at IS NULL AND (b.present_expires_at IS NULL OR b.present_expires_at > now())", token)
}

// SetPresent включает (token, presenter, expires) или выключает (все nil) показ.
func (r *BoardRepo) SetPresent(ctx context.Context, id uuid.UUID, token *string, presenter *uuid.UUID, expires *time.Time) error {
	b := psql.Update("board").
		Set("present_token", token).Set("presenter_account_id", presenter).Set("present_expires_at", expires).
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

// SetPresentExpiry продлевает или снимает срок уже включённого показа.
func (r *BoardRepo) SetPresentExpiry(ctx context.Context, id uuid.UUID, expires *time.Time) error {
	tag, err := execBuilder(ctx, r.db, psql.Update("board").Set("present_expires_at", expires).Where("id = ? AND deleted_at IS NULL", id))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SetPresenter меняет ведущего показа.
func (r *BoardRepo) SetPresenter(ctx context.Context, id, presenter uuid.UUID) error {
	tag, err := execBuilder(ctx, r.db, psql.Update("board").Set("presenter_account_id", presenter).Where("id = ? AND deleted_at IS NULL", id))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// BoardSort - сортировка списка досок; ключи keyset-курсора совпадают с ORDER BY.
type BoardSort string

const (
	BoardSortRecent  BoardSort = "recent"  // COALESCE(last_opened_at, updated_at) DESC, id DESC
	BoardSortUpdated BoardSort = "updated" // updated_at DESC, id DESC
	BoardSortName    BoardSort = "name"    // replace(lower(name), 'ё', 'е') COLLATE "C" ASC, id ASC - то же, что ruSortKey
)

// BoardSegment - срез списка: все, мои (создатель - зритель), избранные зрителем.
type BoardSegment string

const (
	BoardSegmentAll     BoardSegment = "all"
	BoardSegmentMine    BoardSegment = "mine"
	BoardSegmentStarred BoardSegment = "starred"
)

// BoardCursor - позиция keyset-курсора: ключ сортировки последней отданной строки и её id.
// Ключ хранится строкой в том виде, в каком его отдала БД (RFC3339Nano для времени).
type BoardCursor struct {
	Key string
	ID  uuid.UUID
}

// BoardListFilter - параметры списка досок. ViewerID обязателен: от него зависят роль, избранное
// и видимость. TeamID nil - все команды зрителя, ExcludeTeamID вычитает одну (поиск по другим группам).
type BoardListFilter struct {
	ViewerID      uuid.UUID
	OrgAdmin      bool
	TeamID        *uuid.UUID
	ExcludeTeamID *uuid.UUID
	Q             string
	Segment       BoardSegment
	Sort          BoardSort
	After         *BoardCursor
	Limit         int
}

const nameKeySQL = "replace(lower(b.name), 'ё', 'е')"

// visibleBoardSQL зеркалит accessByRole из сервиса для deny: доску не видит рядовой участник,
// если он не создатель и не админ организации. Нужен в SQL, чтобы страницы и total считались
// по одним и тем же строкам; сервис всё равно прогоняет результат через accessByRole.
func visibleBoardSQL(b sq.SelectBuilder, viewerID uuid.UUID, orgAdmin bool) sq.SelectBuilder {
	return b.Where(visibleBoardCond, orgAdmin, viewerID)
}

// visibleBoardCond ждёт доску как b, её группу как t и членство зрителя как tm; аргументы: orgAdmin, viewerID.
const visibleBoardCond = "(? OR b.account_id = ? OR tm.role IN ('owner', 'admin') OR COALESCE(b.team_access, t.member_board_access) <> 'deny')"

// boardListFrom - общая часть списка и счётчика: доски живых команд зрителя с его ролью и избранным.
func boardListFrom(b sq.SelectBuilder, f BoardListFilter) sq.SelectBuilder {
	b = b.From("board b").
		Join("team_member tm ON tm.team_id = b.team_id AND tm.account_id = ?", f.ViewerID).
		Join("team t ON t.id = b.team_id AND t.deleted_at IS NULL").
		LeftJoin("board_starred bs ON bs.board_id = b.id AND bs.account_id = ?", f.ViewerID).
		Where("b.deleted_at IS NULL")
	b = visibleBoardSQL(b, f.ViewerID, f.OrgAdmin)
	if f.TeamID != nil {
		b = b.Where("b.team_id = ?", *f.TeamID)
	}
	if f.ExcludeTeamID != nil {
		b = b.Where("b.team_id <> ?", *f.ExcludeTeamID)
	}
	if q := strings.TrimSpace(f.Q); q != "" {
		b = b.Where("b.name ILIKE ?", "%"+escapeLike(q)+"%")
	}
	switch f.Segment {
	case BoardSegmentMine:
		b = b.Where("b.account_id = ?", f.ViewerID)
	case BoardSegmentStarred:
		b = b.Where("bs.board_id IS NOT NULL")
	}
	return b
}

// ListBoards возвращает страницу досок и курсор на следующую (nil, если дальше пусто).
// Страница запрашивается на одну строку больше лимита, чтобы не делать отдельный запрос «есть ли ещё».
func (r *BoardRepo) ListBoards(ctx context.Context, f BoardListFilter) ([]model.BoardView, *BoardCursor, error) {
	b := psql.Select(boardColumns...).Columns(
		"a.name",
		"(bs.board_id IS NOT NULL) AS is_starred",
		"tm.role",
	)
	b = boardListFrom(b, f).Join("account a ON a.id = b.account_id").LeftJoin(presenterJoin)
	var keyCol string
	switch f.Sort {
	case BoardSortName:
		keyCol = nameKeySQL + ` COLLATE "C"`
		if f.After != nil {
			b = b.Where("("+keyCol+`, b.id) > (?::text COLLATE "C", ?)`, f.After.Key, f.After.ID)
		}
		b = b.OrderBy(keyCol+" ASC", "b.id ASC")
	case BoardSortUpdated:
		keyCol = "b.updated_at"
		if f.After != nil {
			b = b.Where("(b.updated_at, b.id) < (?::timestamptz, ?)", f.After.Key, f.After.ID)
		}
		b = b.OrderBy("b.updated_at DESC", "b.id DESC")
	default:
		keyCol = "COALESCE(b.last_opened_at, b.updated_at)"
		if f.After != nil {
			b = b.Where("("+keyCol+", b.id) < (?::timestamptz, ?)", f.After.Key, f.After.ID)
		}
		b = b.OrderBy(keyCol+" DESC", "b.id DESC")
	}
	// Ключ курсора берём из БД той же строкой, чтобы сравнение на следующей странице было точным.
	b = b.Column(keyCol + "::text AS cursor_key").Limit(uint64(f.Limit + 1))

	rows, err := queryBuilder(ctx, r.db, b)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	var result []model.BoardView
	var keys []string
	for rows.Next() {
		var bv model.BoardView
		var key string
		if err := rows.Scan(
			&bv.Board.ID, &bv.Board.PublicID, &bv.Board.Name, &bv.Board.TeamID, &bv.Board.AccountID,
			&bv.Board.TeamAccess, &bv.Board.TeamAccessInherited, &bv.Board.LinkAccessEnabled, &bv.Board.TemplateID, &bv.Board.CreatedAt, &bv.Board.UpdatedAt, &bv.Board.LastOpenedAt,
			&bv.Board.PresentToken, &bv.Board.PresenterAccountID, &bv.Board.PresenterName, &bv.Board.PresentExpiresAt,
			&bv.OwnerName,
			&bv.IsStarred,
			&bv.ViewerRole,
			&key,
		); err != nil {
			return nil, nil, err
		}
		result = append(result, bv)
		keys = append(keys, key)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	var next *BoardCursor
	if len(result) > f.Limit {
		result = result[:f.Limit]
		last := result[len(result)-1]
		next = &BoardCursor{Key: keys[len(result)-1], ID: last.Board.ID}
	}
	return result, next, nil
}

// RecentByTeams - до perTeam последних открытых видимых досок в каждой команде зрителя, одним
// запросом через LATERAL: карточкам групп в кабинете не нужен полный список.
func (r *BoardRepo) RecentByTeams(ctx context.Context, viewerID uuid.UUID, orgAdmin bool, perTeam int) ([]model.BoardView, error) {
	b := psql.Select(boardColumns...).Columns(
		"a.name",
		"(bs.board_id IS NOT NULL) AS is_starred",
		"tm.role",
	).
		From("team_member tm").
		Join("team t ON t.id = tm.team_id AND t.deleted_at IS NULL").
		JoinClause("JOIN LATERAL (SELECT b.* FROM board b WHERE b.team_id = tm.team_id AND b.deleted_at IS NULL AND "+visibleBoardCond+
			" ORDER BY COALESCE(b.last_opened_at, b.updated_at) DESC, b.id DESC LIMIT ?) b ON true", orgAdmin, viewerID, perTeam).
		Join("account a ON a.id = b.account_id").
		LeftJoin(presenterJoin).
		LeftJoin("board_starred bs ON bs.board_id = b.id AND bs.account_id = ?", viewerID).
		Where("tm.account_id = ?", viewerID).
		OrderBy("b.team_id", "COALESCE(b.last_opened_at, b.updated_at) DESC", "b.id DESC")
	rows, err := queryBuilder(ctx, r.db, b)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []model.BoardView
	for rows.Next() {
		var bv model.BoardView
		if err := rows.Scan(
			&bv.Board.ID, &bv.Board.PublicID, &bv.Board.Name, &bv.Board.TeamID, &bv.Board.AccountID,
			&bv.Board.TeamAccess, &bv.Board.TeamAccessInherited, &bv.Board.LinkAccessEnabled, &bv.Board.TemplateID, &bv.Board.CreatedAt, &bv.Board.UpdatedAt, &bv.Board.LastOpenedAt,
			&bv.Board.PresentToken, &bv.Board.PresenterAccountID, &bv.Board.PresenterName, &bv.Board.PresentExpiresAt,
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

// CountBoards - число досок под тем же фильтром, что и ListBoards (курсор и лимит не учитываются).
func (r *BoardRepo) CountBoards(ctx context.Context, f BoardListFilter) (int, error) {
	row, err := queryRowBuilder(ctx, r.db, boardListFrom(psql.Select("COUNT(*)"), f))
	if err != nil {
		return 0, err
	}
	var n int
	if err := row.Scan(&n); err != nil {
		return 0, err
	}
	return n, nil
}

// Update - переиспользуемое частичное обновление доски.
func (r *BoardRepo) Update(ctx context.Context, id uuid.UUID, f BoardFields) error {
	b := psql.Update("board").Where("id = ? AND deleted_at IS NULL", id)
	touched := false
	if f.Name != "" {
		b = b.Set("name", f.Name)
		touched = true
	}
	if f.TeamAccessInherit {
		b = b.Set("team_access", nil)
		touched = true
	} else if f.TeamAccess != "" {
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
