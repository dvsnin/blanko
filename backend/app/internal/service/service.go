package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dvsnin/blanko/backend/app/internal/model"
	"github.com/dvsnin/blanko/backend/app/internal/repository"
)

// Ошибки уровня сервиса.
var (
	ErrNotFound     = errors.New("not found")
	ErrForbidden    = errors.New("forbidden")
	ErrValidation   = errors.New("validation error")
	ErrUnauthorized = errors.New("unauthorized")
)

// Services — набор всех прикладных сервисов.
type Services struct {
	Pool  *pgxpool.Pool
	Auth  *AuthService
	Team  *TeamService
	Board *BoardService
}

// New создаёт все сервисы, используя общий pgxpool.
func New(pool *pgxpool.Pool) *Services {
	s := &Services{Pool: pool}
	s.Auth = &AuthService{pool: pool}
	s.Team = &TeamService{pool: pool}
	s.Board = &BoardService{pool: pool}
	return s
}

// withTx запускает callback в транзакции.
func withTx(ctx context.Context, pool *pgxpool.Pool, fn func(tx pgx.Tx) error) error {
	return pgx.BeginFunc(ctx, pool, fn)
}

// ---------- AuthService ----------

// AuthService отвечает за разрешение текущего пользователя и автосоздание
// связанных сущностей (account + personal workspace).
type AuthService struct {
	pool *pgxpool.Pool
}

// Identity — разрешённая идентичность текущего пользователя.
type Identity struct {
	Account   model.Account
	Workspace model.Workspace
}

// Resolve обеспечивает наличие account и личного workspace для переданной пары (email, name).
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
		wsRepo := repository.NewWorkspaceRepo(tx)

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

		ws, err := wsRepo.GetByAccountID(ctx, acc.ID)
		if errors.Is(err, repository.ErrNotFound) {
			ws = &model.Workspace{
				Name:      acc.Name,
				AccountID: &acc.ID,
			}
			if err := wsRepo.Create(ctx, ws); err != nil {
				return fmt.Errorf("create workspace: %w", err)
			}
		} else if err != nil {
			return fmt.Errorf("get workspace: %w", err)
		}
		identity.Workspace = *ws
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &identity, nil
}

// UpdateAccount — переименование текущей учётной записи.
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

// TeamCreateInput — входные данные для создания команды.
type TeamCreateInput struct {
	Name string
}

// TeamUpdateInput — входные данные для частичного апдейта.
type TeamUpdateInput struct {
	Name string
}

// List возвращает команды пользователя в его workspace.
func (s *TeamService) List(ctx context.Context, id Identity) ([]model.TeamView, error) {
	repo := repository.NewTeamRepo(s.pool)
	return repo.ListForAccount(ctx, id.Workspace.ID, id.Account.ID)
}

// Create создаёт команду и добавляет текущего пользователя владельцем.
func (s *TeamService) Create(ctx context.Context, id Identity, in TeamCreateInput) (*model.TeamView, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, fmt.Errorf("%w: name is required", ErrValidation)
	}

	var view model.TeamView
	err := withTx(ctx, s.pool, func(tx pgx.Tx) error {
		repo := repository.NewTeamRepo(tx)
		team := &model.Team{
			WorkspaceID:       id.Workspace.ID,
			Name:              name,
			MemberBoardAccess: model.BoardAccessEdit,
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

// Update — переименование/изменение команды. Доступно owner/admin.
func (s *TeamService) Update(ctx context.Context, id Identity, teamID uuid.UUID, in TeamUpdateInput) (*model.TeamView, error) {
	repo := repository.NewTeamRepo(s.pool)
	role, err := s.requireRole(ctx, repo, teamID, id.Account.ID, model.TeamRoleOwner, model.TeamRoleAdmin)
	if err != nil {
		return nil, err
	}
	fields := repository.TeamFields{Name: strings.TrimSpace(in.Name)}
	if err := repo.Update(ctx, teamID, fields); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s.getView(ctx, teamID, id.Account.ID, role)
}

// Delete — soft delete команды. Только owner.
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

// Leave — пользователь покидает команду. Owner покинуть не может.
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
}

type BoardCreateInput struct {
	Name string
}

type BoardUpdateInput struct {
	Name              string
	TeamAccess        model.BoardAccess
	LinkAccessEnabled *bool
}

// ListByTeam возвращает доски команды. Пользователь должен быть участником команды.
func (s *BoardService) ListByTeam(ctx context.Context, id Identity, teamID uuid.UUID) ([]model.BoardView, error) {
	if err := s.requireTeamMember(ctx, teamID, id.Account.ID); err != nil {
		return nil, err
	}
	return repository.NewBoardRepo(s.pool).ListByTeam(ctx, teamID, id.Account.ID)
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
	board := &model.Board{
		Name:              name,
		TeamID:            teamID,
		AccountID:         id.Account.ID,
		TeamAccess:        model.BoardAccessEdit,
		LinkAccessEnabled: false,
	}
	if err := repository.NewBoardRepo(s.pool).Create(ctx, board); err != nil {
		return nil, err
	}
	return &model.BoardView{Board: *board, OwnerName: id.Account.Name}, nil
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
	return &model.BoardView{Board: *board, OwnerName: id.Account.Name}, nil
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
	return repo.SoftDelete(ctx, boardID)
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
