package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dvsnin/blanko/backend/app/internal/doc"
	"github.com/dvsnin/blanko/backend/app/internal/model"
	"github.com/dvsnin/blanko/backend/app/internal/repository"
	"github.com/dvsnin/blanko/backend/app/internal/storage"
)

// Ошибки уровня сервиса.
var (
	ErrNotFound     = errors.New("not found")
	ErrForbidden    = errors.New("forbidden")
	ErrValidation   = errors.New("validation error")
	ErrUnauthorized = errors.New("unauthorized")

	// Специализированные ошибки валидации (оборачивают ErrValidation).
	ErrInvalidAgeGroup   = fmt.Errorf("%w: invalid age group", ErrValidation)
	ErrInvalidTeachers   = fmt.Errorf("%w: invalid teachers", ErrValidation)
	ErrInvalidTemplateID = fmt.Errorf("%w: invalid template id", ErrValidation)
)

// Services - набор всех прикладных сервисов.
type Services struct {
	Pool     *pgxpool.Pool
	Auth     *AuthService
	Team     *TeamService
	Board    *BoardService
	Template *TemplateService
	Document *DocumentService
}

// New создаёт все сервисы: общий pgxpool, хранилище содержимого и хаб комнат.
func New(pool *pgxpool.Pool, store storage.ObjectStore, hub *doc.Hub) *Services {
	s := &Services{Pool: pool}
	s.Auth = &AuthService{pool: pool}
	s.Team = &TeamService{pool: pool}
	s.Document = &DocumentService{pool: pool, Store: store, Hub: hub}
	s.Board = &BoardService{pool: pool, docs: s.Document}
	s.Template = &TemplateService{pool: pool, docs: s.Document}
	hub.OnFlushed = s.Document.touchUpdated
	return s
}

// withTx запускает callback в транзакции.
func withTx(ctx context.Context, pool *pgxpool.Pool, fn func(tx pgx.Tx) error) error {
	return pgx.BeginFunc(ctx, pool, fn)
}

// ---------- AuthService ----------

// AuthService отвечает за разрешение текущего пользователя
// (account создаётся JIT при первом запросе).
type AuthService struct {
	pool *pgxpool.Pool
}

// Identity - разрешённая идентичность текущего пользователя.
type Identity struct {
	Account        model.Account
	OrganizationID uuid.UUID
	// OrgRole без организации всегда member.
	OrgRole model.OrganizationRole
	OrgName string
}

// Resolve обеспечивает наличие account для переданной пары (email, name).
// Вызывается из middleware на каждом API-запросе.
func (s *AuthService) Resolve(ctx context.Context, email, name string) (*Identity, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return nil, ErrUnauthorized
	}
	if name == "" {
		name = strings.SplitN(email, "@", 2)[0]
	}

	var identity Identity
	err := withTx(ctx, s.pool, func(tx pgx.Tx) error {
		accRepo := repository.NewAccountRepo(tx)

		acc, err := accRepo.GetByEmail(ctx, email)
		if errors.Is(err, repository.ErrNotFound) {
			acc = &model.Account{Email: email, Name: name}
			if err := accRepo.Create(ctx, acc); err != nil {
				return fmt.Errorf("create account: %w", err)
			}
		} else if err != nil {
			return fmt.Errorf("get account: %w", err)
		}
		identity.Account = *acc
		identity.OrgRole = model.OrgRoleMember

		// Новый аккаунт - member; admin ставит только bootstrap.
		orgRepo := repository.NewOrganizationRepo(tx)
		org, err := orgRepo.GetFirst(ctx)
		if errors.Is(err, repository.ErrNotFound) {
			return nil
		} else if err != nil {
			return fmt.Errorf("get organization: %w", err)
		}
		identity.OrganizationID = org.ID
		identity.OrgName = org.Name
		if err := orgRepo.EnsureMember(ctx, org.ID, acc.ID, model.OrgRoleMember); err != nil {
			return fmt.Errorf("ensure membership: %w", err)
		}
		role, err := orgRepo.GetMemberRole(ctx, org.ID, acc.ID)
		if err != nil {
			return fmt.Errorf("get org role: %w", err)
		}
		identity.OrgRole = role
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &identity, nil
}

// UpdateAccount - переименование текущей учётной записи.
func (s *AuthService) UpdateAccount(ctx context.Context, id Identity, name string) (*model.Account, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("%w: name is required", ErrValidation)
	}
	repo := repository.NewAccountRepo(s.pool)
	if err := repo.Update(ctx, id.Account.ID, repository.AccountFields{Name: name}); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update account: %w", err)
	}
	acc, err := repo.GetByEmail(ctx, id.Account.Email)
	if err != nil {
		return nil, fmt.Errorf("reload account: %w", err)
	}
	return acc, nil
}

// ---------- TeamService ----------

type TeamService struct {
	pool *pgxpool.Pool
}

// TeamCreateInput - входные данные для создания команды.
type TeamCreateInput struct {
	Name     string
	AgeGroup string
	Teachers string
}

// TeamUpdateInput - входные данные для частичного апдейта.
type TeamUpdateInput struct {
	Name     string
	AgeGroup *string
	Teachers *string
}

// List возвращает все команды, в которых состоит пользователь.
func (s *TeamService) List(ctx context.Context, id Identity) ([]model.TeamView, error) {
	repo := repository.NewTeamRepo(s.pool)
	return repo.ListForAccount(ctx, id.Account.ID)
}

// Create создаёт команду и добавляет текущего пользователя владельцем.
func (s *TeamService) Create(ctx context.Context, id Identity, in TeamCreateInput) (*model.TeamView, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, fmt.Errorf("%w: name is required", ErrValidation)
	}
	if err := validateAgeGroup(in.AgeGroup); err != nil {
		return nil, err
	}
	teachers := strings.TrimSpace(in.Teachers)
	if err := validateTeachers(teachers); err != nil {
		return nil, err
	}

	var view model.TeamView
	err := withTx(ctx, s.pool, func(tx pgx.Tx) error {
		repo := repository.NewTeamRepo(tx)
		team := &model.Team{
			OrganizationID:    nil,
			Name:              name,
			MemberBoardAccess: model.BoardAccessEdit,
		}
		if in.AgeGroup != "" {
			ag := in.AgeGroup
			team.AgeGroup = &ag
		}
		if teachers != "" {
			team.Teachers = &teachers
		}
		if err := repo.Create(ctx, team); err != nil {
			return err
		}
		if err := repo.AddMember(ctx, team.ID, id.Account.ID, model.TeamRoleOwner); err != nil {
			return err
		}
		view = model.TeamView{
			Team:       *team,
			Role:       model.TeamRoleOwner,
			IsStarred:  false,
			BoardCount: 0,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &view, nil
}

// Update - переименование/изменение команды. Доступно owner/admin.
func (s *TeamService) Update(ctx context.Context, id Identity, teamID uuid.UUID, in TeamUpdateInput) (*model.TeamView, error) {
	repo := repository.NewTeamRepo(s.pool)
	role, err := s.requireRole(ctx, repo, teamID, id.Account.ID, model.TeamRoleOwner, model.TeamRoleAdmin)
	if err != nil {
		return nil, err
	}
	if in.AgeGroup != nil {
		if err := validateAgeGroup(*in.AgeGroup); err != nil {
			return nil, err
		}
	}
	var teachers *string
	if in.Teachers != nil {
		t := strings.TrimSpace(*in.Teachers)
		if err := validateTeachers(t); err != nil {
			return nil, err
		}
		teachers = &t
	}
	fields := repository.TeamFields{Name: strings.TrimSpace(in.Name), AgeGroup: in.AgeGroup, Teachers: teachers}
	if err := repo.Update(ctx, teamID, fields); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s.getView(ctx, teamID, id.Account.ID, role)
}

// Delete - soft delete команды. Только owner.
func (s *TeamService) Delete(ctx context.Context, id Identity, teamID uuid.UUID) error {
	repo := repository.NewTeamRepo(s.pool)
	if _, err := s.requireRole(ctx, repo, teamID, id.Account.ID, model.TeamRoleOwner); err != nil {
		return err
	}
	if err := repo.SoftDelete(ctx, teamID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

// Leave - пользователь покидает команду. Owner покинуть не может.
func (s *TeamService) Leave(ctx context.Context, id Identity, teamID uuid.UUID) error {
	repo := repository.NewTeamRepo(s.pool)
	role, err := repo.GetRoleForAccount(ctx, teamID, id.Account.ID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	if role == model.TeamRoleOwner {
		return fmt.Errorf("%w: owner cannot leave the team", ErrForbidden)
	}
	return repo.RemoveMember(ctx, teamID, id.Account.ID)
}

// SetStarred переключает избранное для команды.
func (s *TeamService) SetStarred(ctx context.Context, id Identity, teamID uuid.UUID, starred bool) error {
	repo := repository.NewTeamRepo(s.pool)
	// Пользователь должен быть участником
	if _, err := repo.GetRoleForAccount(ctx, teamID, id.Account.ID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrForbidden
		}
		return err
	}
	return repo.SetStarred(ctx, teamID, id.Account.ID, starred)
}

// requireRole проверяет, что у пользователя одна из допустимых ролей.
func (s *TeamService) requireRole(ctx context.Context, repo *repository.TeamRepo, teamID, accountID uuid.UUID, roles ...model.TeamRole) (model.TeamRole, error) {
	role, err := repo.GetRoleForAccount(ctx, teamID, accountID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return "", ErrForbidden
		}
		return "", err
	}
	for _, r := range roles {
		if role == r {
			return role, nil
		}
	}
	return "", ErrForbidden
}

func (s *TeamService) getView(ctx context.Context, teamID, accountID uuid.UUID, role model.TeamRole) (*model.TeamView, error) {
	team, err := repository.NewTeamRepo(s.pool).GetByID(ctx, teamID)
	if err != nil {
		return nil, err
	}
	return &model.TeamView{
		Team:       *team,
		Role:       role,
		IsStarred:  false,
		BoardCount: 0,
	}, nil
}

// ---------- BoardService ----------

type BoardService struct {
	pool *pgxpool.Pool
	docs *DocumentService
}

type BoardCreateInput struct {
	Name       string
	TemplateID string
}

type BoardUpdateInput struct {
	Name              string
	TeamAccess        model.BoardAccess
	LinkAccessEnabled *bool
}

// GetByPublicID - лукап доски по короткому public_id (из URL).
// ACL пока не проверяем: страница за oauth2-proxy, детальный доступ - отдельной задачей.
func (s *BoardService) GetByPublicID(ctx context.Context, publicID string) (*model.Board, error) {
	board, err := repository.NewBoardRepo(s.pool).GetByPublicID(ctx, publicID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return board, nil
}

// MarkOpened фиксирует открытие доски (last_opened_at = now()).
func (s *BoardService) MarkOpened(ctx context.Context, publicID string) error {
	repo := repository.NewBoardRepo(s.pool)
	board, err := repo.GetByPublicID(ctx, publicID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	return repo.TouchLastOpened(ctx, board.ID)
}

// ListByTeam возвращает доски команды. Пользователь должен быть участником команды.
func (s *BoardService) ListByTeam(ctx context.Context, id Identity, teamID uuid.UUID) ([]model.BoardView, error) {
	role, err := repository.NewTeamRepo(s.pool).GetRoleForAccount(ctx, teamID, id.Account.ID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrForbidden
		}
		return nil, err
	}
	views, err := repository.NewBoardRepo(s.pool).ListByTeam(ctx, teamID, id.Account.ID)
	if err != nil {
		return nil, err
	}
	// Доски с deny для этого участника в список не попадают; CanEdit - право управлять.
	visible := views[:0]
	for _, v := range views {
		access, err := boardAccess(ctx, s.pool, v.Board, id)
		if err != nil {
			return nil, err
		}
		if access == model.BoardAccessDeny {
			continue
		}
		v.CanEdit = canEditBoard(v.Board, id.Account.ID, role)
		visible = append(visible, v)
	}
	return visible, nil
}

// canEditBoard - право управлять доской (переименовать, удалить, перенести, настроить доступ):
// создатель или owner/admin команды.
func canEditBoard(board model.Board, accountID uuid.UUID, role model.TeamRole) bool {
	return board.AccountID == accountID || role == model.TeamRoleOwner || role == model.TeamRoleAdmin
}

// boardAccess - единственное правило доступа к содержимому доски.
// Админ организации, создатель и owner/admin команды: edit. Участник команды: team_access доски.
// Не участник: view при включённом доступе по ссылке, иначе deny.
func boardAccess(ctx context.Context, pool *pgxpool.Pool, board model.Board, id Identity) (model.BoardAccess, error) {
	if id.OrgRole.IsAdmin() || board.AccountID == id.Account.ID {
		return model.BoardAccessEdit, nil
	}
	role, err := repository.NewTeamRepo(pool).GetRoleForAccount(ctx, board.TeamID, id.Account.ID)
	if err != nil {
		if !errors.Is(err, repository.ErrNotFound) {
			return model.BoardAccessDeny, err
		}
		if board.LinkAccessEnabled {
			return model.BoardAccessView, nil
		}
		return model.BoardAccessDeny, nil
	}
	if role == model.TeamRoleOwner || role == model.TeamRoleAdmin {
		return model.BoardAccessEdit, nil
	}
	if board.TeamAccess == "" {
		return model.BoardAccessEdit, nil
	}
	return board.TeamAccess, nil
}

// Access - доступ текущего пользователя к содержимому доски (для страницы, вебсокета, медиа).
func (s *BoardService) Access(ctx context.Context, board model.Board, id Identity) (model.BoardAccess, error) {
	return boardAccess(ctx, s.pool, board, id)
}

// Create создаёт доску в команде.
func (s *BoardService) Create(ctx context.Context, id Identity, teamID uuid.UUID, in BoardCreateInput) (*model.BoardView, error) {
	if err := s.requireTeamMember(ctx, teamID, id.Account.ID); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		name = "Новая доска"
	}
	templateID, err := parseTemplateID(in.TemplateID)
	if err != nil {
		return nil, err
	}
	if templateID != nil {
		tplRepo := repository.NewTemplateRepo(s.pool)
		if err := validateTemplateExists(ctx, tplRepo, templateID); err != nil {
			return nil, err
		}
		if name == "Новая доска" {
			if t, err := tplRepo.GetByID(ctx, *templateID); err == nil {
				name = t.Name
			}
		}
	}
	board := &model.Board{
		Name:              name,
		TeamID:            teamID,
		AccountID:         id.Account.ID,
		TeamAccess:        model.BoardAccessEdit,
		LinkAccessEnabled: false,
		TemplateID:        templateID,
	}
	// Строка и содержимое вместе: упало копирование - доски нет.
	err = withTx(ctx, s.pool, func(tx pgx.Tx) error {
		if err := repository.NewBoardRepo(tx).Create(ctx, board); err != nil {
			return err
		}
		if templateID == nil {
			return nil
		}
		return s.docs.Copy(ctx, doc.KindTemplate, *templateID, doc.KindBoard, board.ID)
	})
	if err != nil {
		return nil, err
	}
	return &model.BoardView{Board: *board, OwnerName: id.Account.Name, CanEdit: true}, nil
}

// Update обновляет доску. Право: создатель или owner/admin команды.
func (s *BoardService) Update(ctx context.Context, id Identity, boardID uuid.UUID, in BoardUpdateInput) (*model.BoardView, error) {
	repo := repository.NewBoardRepo(s.pool)
	board, err := repo.GetByID(ctx, boardID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if err := s.requireBoardWrite(ctx, board, id.Account.ID); err != nil {
		return nil, err
	}
	f := repository.BoardFields{
		Name:              strings.TrimSpace(in.Name),
		TeamAccess:        in.TeamAccess,
		LinkAccessEnabled: in.LinkAccessEnabled,
	}
	if err := repo.Update(ctx, boardID, f); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	// Перечитаем агрегированно
	board, err = repo.GetByID(ctx, boardID)
	if err != nil {
		return nil, err
	}
	return &model.BoardView{Board: *board, OwnerName: id.Account.Name, CanEdit: true}, nil
}

// Delete удаляет доску (soft).
func (s *BoardService) Delete(ctx context.Context, id Identity, boardID uuid.UUID) error {
	repo := repository.NewBoardRepo(s.pool)
	board, err := repo.GetByID(ctx, boardID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	if err := s.requireBoardWrite(ctx, board, id.Account.ID); err != nil {
		return err
	}
	if err := repo.SoftDelete(ctx, boardID); err != nil {
		return err
	}
	s.docs.Hub.Close(doc.KindBoard, boardID)
	return nil
}

// Duplicate: копия доски в той же команде вместе с содержимым, владелец - текущий пользователь.
func (s *BoardService) Duplicate(ctx context.Context, id Identity, boardID uuid.UUID) (*model.BoardView, error) {
	src, err := repository.NewBoardRepo(s.pool).GetByID(ctx, boardID)
	if err != nil {
		return nil, mapNotFound(err)
	}
	if err := s.requireTeamMember(ctx, src.TeamID, id.Account.ID); err != nil {
		return nil, err
	}
	board := &model.Board{
		Name:       duplicateName(src.Name),
		TeamID:     src.TeamID,
		AccountID:  id.Account.ID,
		TeamAccess: src.TeamAccess,
		TemplateID: src.TemplateID,
	}
	err = withTx(ctx, s.pool, func(tx pgx.Tx) error {
		if err := repository.NewBoardRepo(tx).Create(ctx, board); err != nil {
			return err
		}
		return s.docs.Copy(ctx, doc.KindBoard, src.ID, doc.KindBoard, board.ID)
	})
	if err != nil {
		return nil, err
	}
	return &model.BoardView{Board: *board, OwnerName: id.Account.Name, CanEdit: true}, nil
}

// Move переносит доску в другую команду. Право: как на правку доски, плюс членство в целевой команде.
// Хранилище не трогается: префикс объектов привязан к id доски.
func (s *BoardService) Move(ctx context.Context, id Identity, boardID, teamID uuid.UUID) (*model.BoardView, error) {
	repo := repository.NewBoardRepo(s.pool)
	board, err := repo.GetByID(ctx, boardID)
	if err != nil {
		return nil, mapNotFound(err)
	}
	if err := s.requireBoardWrite(ctx, board, id.Account.ID); err != nil {
		return nil, err
	}
	// Целевая команда должна существовать: членство в мягко удалённой команде ещё лежит в БД.
	if _, err := repository.NewTeamRepo(s.pool).GetByID(ctx, teamID); err != nil {
		return nil, mapNotFound(err)
	}
	if err := s.requireTeamMember(ctx, teamID, id.Account.ID); err != nil {
		return nil, err
	}
	if board.TeamID != teamID {
		if err := repo.Update(ctx, boardID, repository.BoardFields{TeamID: &teamID}); err != nil {
			return nil, mapNotFound(err)
		}
		board.TeamID = teamID
	}
	ownerName := id.Account.Name
	if board.AccountID != id.Account.ID {
		if owner, err := repository.NewAccountRepo(s.pool).GetByID(ctx, board.AccountID); err == nil {
			ownerName = owner.Name
		}
	}
	return &model.BoardView{Board: *board, OwnerName: ownerName, CanEdit: true}, nil
}

// SetStarred переключает избранное для доски у текущего пользователя.
// Пользователь должен быть участником команды, в которой лежит доска.
func (s *BoardService) SetStarred(ctx context.Context, id Identity, boardID uuid.UUID, starred bool) error {
	repo := repository.NewBoardRepo(s.pool)
	board, err := repo.GetByID(ctx, boardID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	if err := s.requireTeamMember(ctx, board.TeamID, id.Account.ID); err != nil {
		return err
	}
	return repo.SetStarred(ctx, id.Account.ID, boardID, starred)
}

func (s *BoardService) requireTeamMember(ctx context.Context, teamID, accountID uuid.UUID) error {
	_, err := repository.NewTeamRepo(s.pool).GetRoleForAccount(ctx, teamID, accountID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrForbidden
		}
		return err
	}
	return nil
}

func (s *BoardService) requireBoardWrite(ctx context.Context, board *model.Board, accountID uuid.UUID) error {
	if board.AccountID == accountID {
		return nil
	}
	role, err := repository.NewTeamRepo(s.pool).GetRoleForAccount(ctx, board.TeamID, accountID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrForbidden
		}
		return err
	}
	if role == model.TeamRoleOwner || role == model.TeamRoleAdmin {
		return nil
	}
	return ErrForbidden
}

// validateAgeGroup допускает "" (не указан) и четыре возрастных диапазона.
func validateAgeGroup(s string) error {
	switch s {
	case "", "3-4", "4-5", "5-6", "6-7":
		return nil
	}
	return ErrInvalidAgeGroup
}

// validateTeachers допускает до 300 символов (уже обрезанная строка).
func validateTeachers(s string) error {
	if utf8.RuneCountInString(s) > 300 {
		return ErrInvalidTeachers
	}
	return nil
}

// parseTemplateID: "" -> nil, иначе UUID. Существование проверяет validateTemplateExists.
func parseTemplateID(s string) (*uuid.UUID, error) {
	if s == "" {
		return nil, nil
	}
	id, err := uuid.Parse(s)
	if err != nil {
		return nil, ErrInvalidTemplateID
	}
	return &id, nil
}
