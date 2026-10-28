package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
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
	ErrNotFound  = errors.New("not found")
	ErrForbidden = errors.New("forbidden")
	// ErrLastAdmin - у сада должен остаться хотя бы один администратор.
	ErrLastAdmin    = errors.New("last admin")
	ErrValidation   = errors.New("validation error")
	ErrUnauthorized = errors.New("unauthorized")

	// Специализированные ошибки валидации (оборачивают ErrValidation).
	ErrInvalidAgeGroup   = fmt.Errorf("%w: invalid age group", ErrValidation)
	ErrInvalidTeachers   = fmt.Errorf("%w: invalid teachers", ErrValidation)
	ErrInvalidTemplateID = fmt.Errorf("%w: invalid template id", ErrValidation)
	ErrInvalidEmail      = fmt.Errorf("%w: invalid email", ErrValidation)
	ErrInvalidRole       = fmt.Errorf("%w: invalid role", ErrValidation)
)

type Services struct {
	Pool     *pgxpool.Pool
	Auth     *AuthService
	Team     *TeamService
	Board    *BoardService
	Template *TemplateService
	Document *DocumentService
}

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

func withTx(ctx context.Context, pool *pgxpool.Pool, fn func(tx pgx.Tx) error) error {
	return pgx.BeginFunc(ctx, pool, fn)
}

// AuthService отвечает за разрешение текущего пользователя
// (account создаётся JIT при первом запросе).
type AuthService struct {
	pool *pgxpool.Pool
}

type Identity struct {
	Account        model.Account
	OrganizationID uuid.UUID
	// OrgRole без организации всегда member.
	OrgRole model.OrganizationRole
	OrgName string
}

// Resolve создаёт аккаунт при первом входе; зовётся на каждом запросе.
func (s *AuthService) Resolve(ctx context.Context, email, name string) (*Identity, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return nil, ErrUnauthorized
	}
	if name == "" {
		name = strings.SplitN(email, "@", 2)[0]
	}

	// Быстрый путь: аккаунт и членство уже есть, значит на запрос приходится один SELECT без транзакции.
	// Иначе (первый вход, организация появилась позже) идём медленным путём с созданием строк.
	known, err := repository.NewAccountRepo(s.pool).GetWithOrgRole(ctx, email)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, fmt.Errorf("get account: %w", err)
	}
	if known != nil && (known.OrgID == uuid.Nil || known.Role != "") {
		identity := Identity{Account: known.Account, OrgRole: model.OrgRoleMember}
		if known.OrgID != uuid.Nil {
			identity.OrganizationID = known.OrgID
			identity.OrgName = known.OrgName
			identity.OrgRole = known.Role
		}
		return &identity, nil
	}

	var identity Identity
	err = withTx(ctx, s.pool, func(tx pgx.Tx) error {
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

// ListAccounts - все учётные записи сада с ролями; только для администратора организации.
func (s *AuthService) ListAccounts(ctx context.Context, id Identity) ([]model.AccountWithRole, error) {
	if !id.OrgRole.IsAdmin() || id.OrganizationID == uuid.Nil {
		return nil, ErrForbidden
	}
	list, err := repository.NewAccountRepo(s.pool).ListWithRoles(ctx, id.OrganizationID)
	if err != nil {
		return nil, err
	}
	sortRu(list, func(a model.AccountWithRole) string { return ruSortKey(a.Account.Name) })
	return list, nil
}

// SetOrgRole: администратор назначает или снимает администратора; последнего снять нельзя (ErrLastAdmin).
func (s *AuthService) SetOrgRole(ctx context.Context, id Identity, targetID uuid.UUID, role string) (*model.AccountWithRole, error) {
	if !id.OrgRole.IsAdmin() || id.OrganizationID == uuid.Nil {
		return nil, ErrForbidden
	}
	var want model.OrganizationRole
	switch role {
	case string(model.OrgRoleAdmin):
		want = model.OrgRoleAdmin
	case string(model.OrgRoleMember):
		want = model.OrgRoleMember
	default:
		return nil, ErrInvalidRole
	}
	var out model.AccountWithRole
	err := withTx(ctx, s.pool, func(tx pgx.Tx) error {
		orgs := repository.NewOrganizationRepo(tx)
		if err := orgs.Lock(ctx, id.OrganizationID); err != nil {
			return err
		}
		acc, err := repository.NewAccountRepo(tx).GetByID(ctx, targetID)
		if err != nil {
			return mapNotFound(err)
		}
		if err := orgs.EnsureMember(ctx, id.OrganizationID, acc.ID, model.OrgRoleMember); err != nil {
			return err
		}
		current, err := orgs.GetMemberRole(ctx, id.OrganizationID, acc.ID)
		if err != nil {
			return err
		}
		next := current
		switch {
		case want == model.OrgRoleMember && current.IsAdmin():
			n, err := orgs.CountAdmins(ctx, id.OrganizationID)
			if err != nil {
				return err
			}
			if n <= 1 {
				return ErrLastAdmin
			}
			next = model.OrgRoleMember
		case want == model.OrgRoleAdmin && !current.IsAdmin():
			next = model.OrgRoleAdmin
		}
		if next != current {
			if err := orgs.SetMemberRole(ctx, id.OrganizationID, acc.ID, next); err != nil {
				return err
			}
		}
		out = model.AccountWithRole{Account: *acc, Role: next}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &out, nil
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

const prefsMaxBytes = 4096

// UpdatePrefs сливает переданные ключи в настройки аккаунта: null удаляет ключ, значения только
// скаляры, итог не больше prefsMaxBytes. Возвращает полный объект после слияния.
func (s *AuthService) UpdatePrefs(ctx context.Context, id Identity, set map[string]any) (model.Prefs, error) {
	if len(set) == 0 {
		return nil, fmt.Errorf("%w: set is empty", ErrValidation)
	}
	for k, v := range set {
		if strings.TrimSpace(k) == "" || len(k) > 64 {
			return nil, fmt.Errorf("%w: bad key %q", ErrValidation, k)
		}
		switch v.(type) {
		case nil, string, bool, float64:
		default:
			return nil, fmt.Errorf("%w: value of %q must be a scalar", ErrValidation, k)
		}
	}
	var out model.Prefs
	err := withTx(ctx, s.pool, func(tx pgx.Tx) error {
		repo := repository.NewAccountRepo(tx)
		acc, err := repo.GetByID(ctx, id.Account.ID)
		if err != nil {
			return err
		}
		merged := model.Prefs{}
		for k, v := range acc.Prefs {
			merged[k] = v
		}
		for k, v := range set {
			if v == nil {
				delete(merged, k)
			} else {
				merged[k] = v
			}
		}
		if raw, _ := json.Marshal(merged); len(raw) > prefsMaxBytes {
			return fmt.Errorf("%w: prefs exceed %d bytes", ErrValidation, prefsMaxBytes)
		}
		if err := repo.UpdatePrefs(ctx, acc.ID, merged); err != nil {
			return err
		}
		out = merged
		return nil
	})
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return out, nil
}

// SearchAccounts - справочник педагогов сада для подбора участников группы: любой вошедший
// видит имена и почты коллег (коробка на один сад). Пустой запрос отдаёт всех, не больше 50.
func (s *AuthService) SearchAccounts(ctx context.Context, q string) ([]model.Account, error) {
	q = strings.TrimSpace(q)
	list, err := repository.NewAccountRepo(s.pool).Search(ctx, q, 50)
	if err != nil {
		return nil, fmt.Errorf("search accounts: %w", err)
	}
	// Разделитель \x00 меньше любого символа: порядок тот же, что «по имени, затем по email».
	sortRu(list, func(a model.Account) string { return ruSortKey(a.Name) + "\x00" + a.Email })
	return list, nil
}

type TeamService struct {
	pool *pgxpool.Pool
}

type TeamCreateInput struct {
	Name     string
	AgeGroup string
	Teachers string
}

type TeamUpdateInput struct {
	Name     string
	AgeGroup *string
	Teachers *string
	// MemberBoardAccess - доступ участников к доскам группы по умолчанию: edit, view, deny.
	MemberBoardAccess *string
}

// teamRecentBoards - сколько последних досок показывает карточка группы.
const teamRecentBoards = 3

// List - команды пользователя с числом видимых досок и последними открытыми (для карточек групп).
func (s *TeamService) List(ctx context.Context, id Identity) ([]model.TeamView, error) {
	orgAdmin := id.OrgRole.IsAdmin()
	teams, err := repository.NewTeamRepo(s.pool).ListForAccount(ctx, id.Account.ID, orgAdmin)
	if err != nil {
		return nil, err
	}
	recent, err := repository.NewBoardRepo(s.pool).RecentByTeams(ctx, id.Account.ID, orgAdmin, teamRecentBoards)
	if err != nil {
		return nil, err
	}
	byTeam := map[uuid.UUID][]model.BoardView{}
	for _, b := range visibleBoards(recent, id) {
		byTeam[b.Board.TeamID] = append(byTeam[b.Board.TeamID], b)
	}
	for i := range teams {
		teams[i].RecentBoards = byTeam[teams[i].Team.ID]
	}
	return teams, nil
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
			Name:              name,
			MemberBoardAccess: model.BoardAccessEdit,
		}
		if id.OrganizationID != uuid.Nil {
			org := id.OrganizationID
			team.OrganizationID = &org
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
	if in.MemberBoardAccess != nil {
		access, err := parseBoardAccess(*in.MemberBoardAccess)
		if err != nil {
			return nil, err
		}
		fields.MemberBoardAccess = access
	}
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

// Members - участники команды; видит любой участник.
func (s *TeamService) Members(ctx context.Context, id Identity, teamID uuid.UUID) ([]model.TeamMemberView, error) {
	repo := repository.NewTeamRepo(s.pool)
	if _, err := s.requireRole(ctx, repo, teamID, id.Account.ID, model.TeamRoleOwner, model.TeamRoleAdmin, model.TeamRoleMember); err != nil {
		return nil, err
	}
	members, err := repo.ListMembers(ctx, teamID)
	if err != nil {
		return nil, err
	}
	if members == nil {
		members = []model.TeamMemberView{}
	}
	return members, nil
}

// AddMember добавляет участника по почте; аккаунт создаётся заранее, если человек ещё не входил.
// Повторное добавление ничего не меняет (created = false). Право: owner или admin команды.
func (s *TeamService) AddMember(ctx context.Context, id Identity, teamID uuid.UUID, email string, role model.TeamRole) (*model.TeamMemberView, bool, error) {
	repo := repository.NewTeamRepo(s.pool)
	if _, err := s.requireRole(ctx, repo, teamID, id.Account.ID, model.TeamRoleOwner, model.TeamRoleAdmin); err != nil {
		return nil, false, err
	}
	email = strings.TrimSpace(strings.ToLower(email))
	if err := validateEmail(email); err != nil {
		return nil, false, err
	}
	if err := validateAssignableRole(role); err != nil {
		return nil, false, err
	}
	var member *model.TeamMemberView
	created := false
	err := withTx(ctx, s.pool, func(tx pgx.Tx) error {
		accRepo := repository.NewAccountRepo(tx)
		acc, err := accRepo.GetByEmail(ctx, email)
		if errors.Is(err, repository.ErrNotFound) {
			acc = &model.Account{Email: email, Name: strings.SplitN(email, "@", 2)[0]}
			if err := accRepo.Create(ctx, acc); err != nil {
				return err
			}
		} else if err != nil {
			return err
		}
		teamRepo := repository.NewTeamRepo(tx)
		existing, err := teamRepo.GetRoleForAccount(ctx, teamID, acc.ID)
		if err == nil {
			member = &model.TeamMemberView{AccountID: acc.ID, Email: acc.Email, Name: acc.Name, Role: existing}
			return nil
		}
		if !errors.Is(err, repository.ErrNotFound) {
			return err
		}
		if err := teamRepo.AddMember(ctx, teamID, acc.ID, role); err != nil {
			return err
		}
		created = true
		member = &model.TeamMemberView{AccountID: acc.ID, Email: acc.Email, Name: acc.Name, Role: role, JoinedAt: time.Now().UTC()}
		return nil
	})
	if err != nil {
		return nil, false, err
	}
	return member, created, nil
}

// SetMemberRole: owner или admin команды меняют роль участника между member и admin; владельца не трогают.
func (s *TeamService) SetMemberRole(ctx context.Context, id Identity, teamID, accountID uuid.UUID, role model.TeamRole) (*model.TeamMemberView, error) {
	repo := repository.NewTeamRepo(s.pool)
	if _, err := s.requireRole(ctx, repo, teamID, id.Account.ID, model.TeamRoleOwner, model.TeamRoleAdmin); err != nil {
		return nil, err
	}
	if err := validateAssignableRole(role); err != nil {
		return nil, err
	}
	current, err := repo.GetRoleForAccount(ctx, teamID, accountID)
	if err != nil {
		return nil, mapNotFound(err)
	}
	if current == model.TeamRoleOwner {
		return nil, ErrForbidden
	}
	if err := repo.SetMemberRole(ctx, teamID, accountID, role); err != nil {
		return nil, mapNotFound(err)
	}
	return s.member(ctx, repo, teamID, accountID)
}

// RemoveMember исключает участника; владельца исключить нельзя.
func (s *TeamService) RemoveMember(ctx context.Context, id Identity, teamID, accountID uuid.UUID) error {
	repo := repository.NewTeamRepo(s.pool)
	if _, err := s.requireRole(ctx, repo, teamID, id.Account.ID, model.TeamRoleOwner, model.TeamRoleAdmin); err != nil {
		return err
	}
	current, err := repo.GetRoleForAccount(ctx, teamID, accountID)
	if err != nil {
		return mapNotFound(err)
	}
	if current == model.TeamRoleOwner {
		return ErrForbidden
	}
	return repo.RemoveMember(ctx, teamID, accountID)
}

func (s *TeamService) member(ctx context.Context, repo *repository.TeamRepo, teamID, accountID uuid.UUID) (*model.TeamMemberView, error) {
	m, err := repo.GetMember(ctx, teamID, accountID)
	if err != nil {
		return nil, mapNotFound(err)
	}
	return m, nil
}

func validateEmail(email string) error {
	at := strings.Index(email, "@")
	if at < 1 || at == len(email)-1 || strings.ContainsAny(email, " \t") || utf8.RuneCountInString(email) > 255 {
		return ErrInvalidEmail
	}
	return nil
}

// validateAssignableRole: назначать можно только member и admin, владелец один и задаётся при создании.
func validateAssignableRole(role model.TeamRole) error {
	if role == model.TeamRoleMember || role == model.TeamRoleAdmin {
		return nil
	}
	return ErrInvalidRole
}

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

type BoardService struct {
	pool *pgxpool.Pool
	docs *DocumentService
}

type BoardCreateInput struct {
	Name       string
	TemplateID string
}

type BoardUpdateInput struct {
	Name string
	// TeamAccess: edit, view, deny или "inherit" - снять свою настройку и брать уровень группы.
	TeamAccess        string
	LinkAccessEnabled *bool
}

// overrideAccess - своя настройка доски для копии: пусто, если доска наследует уровень группы.
func overrideAccess(b model.Board) model.BoardAccess {
	if b.TeamAccessInherited {
		return ""
	}
	return b.TeamAccess
}

// BoardAccessInherit - значение teamAccess в запросе, возвращающее доску к уровню группы.
const BoardAccessInherit = "inherit"

func parseBoardAccess(s string) (model.BoardAccess, error) {
	switch model.BoardAccess(s) {
	case model.BoardAccessEdit, model.BoardAccessView, model.BoardAccessDeny:
		return model.BoardAccess(s), nil
	}
	return "", fmt.Errorf("%w: unknown access %q", ErrValidation, s)
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

// BoardListInput - запрос страницы досок. Пустые Segment/Sort - all/recent, Limit 0 - по умолчанию.
type BoardListInput struct {
	TeamID        *uuid.UUID
	ExcludeTeamID *uuid.UUID
	Q             string
	Segment       string
	Sort          string
	Cursor        string
	Limit         int
}

// BoardListResult - страница: доски, курсор на следующую (пусто - конец) и total по фильтру.
// Total считается только на первой странице (nil дальше): клиент держит его с первой.
type BoardListResult struct {
	Items      []model.BoardView
	NextCursor string
	Total      *int
}

const (
	boardPageDefault = 24
	boardPageMax     = 100
)

// boardCursor - непрозрачный курсор для клиента: сортировка внутри, чтобы курсор одной сортировки
// нельзя было подставить в другую.
type boardCursor struct {
	Sort string    `json:"s"`
	Key  string    `json:"k"`
	ID   uuid.UUID `json:"i"`
}

func encodeBoardCursor(sort repository.BoardSort, c *repository.BoardCursor) string {
	if c == nil {
		return ""
	}
	raw, _ := json.Marshal(boardCursor{Sort: string(sort), Key: c.Key, ID: c.ID})
	return base64.RawURLEncoding.EncodeToString(raw)
}

func decodeBoardCursor(s string, sort repository.BoardSort) (*repository.BoardCursor, error) {
	if s == "" {
		return nil, nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return nil, fmt.Errorf("%w: bad cursor", ErrValidation)
	}
	var c boardCursor
	if err := json.Unmarshal(raw, &c); err != nil || c.Sort != string(sort) || c.Key == "" || c.ID == uuid.Nil {
		return nil, fmt.Errorf("%w: bad cursor", ErrValidation)
	}
	return &repository.BoardCursor{Key: c.Key, ID: c.ID}, nil
}

// List отдаёт страницу досок команды (TeamID) или всех команд пользователя. Для команды
// пользователь должен быть участником, иначе ErrForbidden.
func (s *BoardService) List(ctx context.Context, id Identity, in BoardListInput) (*BoardListResult, error) {
	f := repository.BoardListFilter{
		ViewerID:      id.Account.ID,
		OrgAdmin:      id.OrgRole.IsAdmin(),
		TeamID:        in.TeamID,
		ExcludeTeamID: in.ExcludeTeamID,
		Q:             strings.TrimSpace(in.Q),
		Limit:         in.Limit,
	}
	switch in.Segment {
	case "", string(repository.BoardSegmentAll):
		f.Segment = repository.BoardSegmentAll
	case string(repository.BoardSegmentMine), string(repository.BoardSegmentStarred):
		f.Segment = repository.BoardSegment(in.Segment)
	default:
		return nil, fmt.Errorf("%w: unknown segment %q", ErrValidation, in.Segment)
	}
	switch in.Sort {
	case "", string(repository.BoardSortRecent):
		f.Sort = repository.BoardSortRecent
	case string(repository.BoardSortUpdated), string(repository.BoardSortName):
		f.Sort = repository.BoardSort(in.Sort)
	default:
		return nil, fmt.Errorf("%w: unknown sort %q", ErrValidation, in.Sort)
	}
	if f.Limit <= 0 {
		f.Limit = boardPageDefault
	}
	if f.Limit > boardPageMax {
		f.Limit = boardPageMax
	}
	after, err := decodeBoardCursor(in.Cursor, f.Sort)
	if err != nil {
		return nil, err
	}
	f.After = after
	if in.TeamID != nil {
		if _, err := repository.NewTeamRepo(s.pool).GetRoleForAccount(ctx, *in.TeamID, id.Account.ID); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return nil, ErrForbidden
			}
			return nil, err
		}
	}
	repo := repository.NewBoardRepo(s.pool)
	views, next, err := repo.ListBoards(ctx, f)
	if err != nil {
		return nil, err
	}
	var total *int
	if f.After == nil {
		n, err := repo.CountBoards(ctx, f)
		if err != nil {
			return nil, err
		}
		total = &n
	}
	return &BoardListResult{Items: visibleBoards(views, id), NextCursor: encodeBoardCursor(f.Sort, next), Total: total}, nil
}

// visibleBoards режет доски с deny для этого участника и проставляет CanEdit. Роль зрителя уже
// в выборке (ViewerRole), поэтому на любом объёме списка это чистый проход без запросов к БД.
func visibleBoards(views []model.BoardView, id Identity) []model.BoardView {
	visible := views[:0]
	for _, v := range views {
		if accessByRole(v.Board, id, v.ViewerRole, true) == model.BoardAccessDeny {
			continue
		}
		v.CanEdit = canEditBoard(v.Board, id.Account.ID, v.ViewerRole)
		visible = append(visible, v)
	}
	return visible
}

// canEditBoard - право управлять доской (переименовать, удалить, перенести, настроить доступ):
// создатель или owner/admin команды.
func canEditBoard(board model.Board, accountID uuid.UUID, role model.TeamRole) bool {
	return board.AccountID == accountID || role == model.TeamRoleOwner || role == model.TeamRoleAdmin
}

// boardAccess - доступ к содержимому одной доски: узнаёт роль в команде и применяет accessByRole.
func boardAccess(ctx context.Context, pool *pgxpool.Pool, board model.Board, id Identity) (model.BoardAccess, error) {
	if id.OrgRole.IsAdmin() || board.AccountID == id.Account.ID {
		return model.BoardAccessEdit, nil
	}
	role, err := repository.NewTeamRepo(pool).GetRoleForAccount(ctx, board.TeamID, id.Account.ID)
	if err != nil {
		if !errors.Is(err, repository.ErrNotFound) {
			return model.BoardAccessDeny, err
		}
		return accessByRole(board, id, "", false), nil
	}
	return accessByRole(board, id, role, true), nil
}

// accessByRole - единственное правило доступа к содержимому: админ сада, создатель и owner/admin
// группы редактируют, участник по team_access, остальные view при доступе по ссылке, иначе deny.
func accessByRole(board model.Board, id Identity, role model.TeamRole, member bool) model.BoardAccess {
	if id.OrgRole.IsAdmin() || board.AccountID == id.Account.ID {
		return model.BoardAccessEdit
	}
	if !member {
		if board.LinkAccessEnabled {
			return model.BoardAccessView
		}
		return model.BoardAccessDeny
	}
	if role == model.TeamRoleOwner || role == model.TeamRoleAdmin {
		return model.BoardAccessEdit
	}
	if board.TeamAccess == "" {
		return model.BoardAccessEdit
	}
	return board.TeamAccess
}

// Access - доступ текущего пользователя к содержимому доски (для страницы, вебсокета, медиа).
func (s *BoardService) Access(ctx context.Context, board model.Board, id Identity) (model.BoardAccess, error) {
	return boardAccess(ctx, s.pool, board, id)
}

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
	// Доступ участников не задаём: новая доска наследует уровень группы.
	board := &model.Board{
		Name:              name,
		TeamID:            teamID,
		AccountID:         id.Account.ID,
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
	f := repository.BoardFields{Name: strings.TrimSpace(in.Name), LinkAccessEnabled: in.LinkAccessEnabled}
	switch in.TeamAccess {
	case "":
	case BoardAccessInherit:
		f.TeamAccessInherit = true
	default:
		access, err := parseBoardAccess(in.TeamAccess)
		if err != nil {
			return nil, err
		}
		f.TeamAccess = access
	}
	if err := repo.Update(ctx, boardID, f); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
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
		TeamAccess: overrideAccess(*src),
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
		// Перечитываем: наследуемый доступ теперь берётся из новой группы.
		board, err = repo.GetByID(ctx, boardID)
		if err != nil {
			return nil, mapNotFound(err)
		}
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
