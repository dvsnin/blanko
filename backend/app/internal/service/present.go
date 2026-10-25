package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/dvsnin/blanko/backend/app/internal/model"
	"github.com/dvsnin/blanko/backend/app/internal/repository"
)

// ErrPresentOff - показ на доске выключен, вести его некому.
var ErrPresentOff = errors.New("present mode is off")

// Сроки показа в часах; 0 - пока не выключат вручную.
var presentHours = map[int]bool{0: true, 1: true, 12: true, 24: true}

// EnablePresent: токен ссылки и ведущий; повторное включение только переустанавливает срок. Право canEditBoard.
func (s *BoardService) EnablePresent(ctx context.Context, id Identity, boardID uuid.UUID, hours int) (*model.BoardView, error) {
	if !presentHours[hours] {
		return nil, fmt.Errorf("%w: present duration must be 0, 1, 12 or 24 hours", ErrValidation)
	}
	var expires *time.Time
	if hours > 0 {
		t := time.Now().UTC().Add(time.Duration(hours) * time.Hour)
		expires = &t
	}
	repo := repository.NewBoardRepo(s.pool)
	board, err := repo.GetByID(ctx, boardID)
	if err != nil {
		return nil, mapNotFound(err)
	}
	if err := s.requireBoardWrite(ctx, board, id.Account.ID); err != nil {
		return nil, err
	}
	if board.PresentToken != nil {
		if err := repo.SetPresentExpiry(ctx, boardID, expires); err != nil {
			return nil, mapNotFound(err)
		}
	} else {
		token, err := randomHex(16)
		if err != nil {
			return nil, err
		}
		presenter := id.Account.ID
		if err := repo.SetPresent(ctx, boardID, &token, &presenter, expires); err != nil {
			return nil, mapNotFound(err)
		}
	}
	return s.boardViewFor(ctx, id, boardID)
}

// DisablePresent выключает показ: ссылка перестаёт работать, ведущий сбрасывается.
func (s *BoardService) DisablePresent(ctx context.Context, id Identity, boardID uuid.UUID) (*model.BoardView, error) {
	repo := repository.NewBoardRepo(s.pool)
	board, err := repo.GetByID(ctx, boardID)
	if err != nil {
		return nil, mapNotFound(err)
	}
	if err := s.requireBoardWrite(ctx, board, id.Account.ID); err != nil {
		return nil, err
	}
	if err := repo.SetPresent(ctx, boardID, nil, nil, nil); err != nil {
		return nil, mapNotFound(err)
	}
	return s.boardViewFor(ctx, id, boardID)
}

// LeadPresent делает ведущим вызывающего. Право: редактировать содержимое доски.
func (s *BoardService) LeadPresent(ctx context.Context, id Identity, boardID uuid.UUID) (*model.BoardView, error) {
	repo := repository.NewBoardRepo(s.pool)
	board, err := repo.GetByID(ctx, boardID)
	if err != nil {
		return nil, mapNotFound(err)
	}
	access, err := boardAccess(ctx, s.pool, *board, id)
	if err != nil {
		return nil, err
	}
	if access != model.BoardAccessEdit {
		return nil, ErrForbidden
	}
	if board.PresentToken == nil {
		return nil, ErrPresentOff
	}
	if err := repo.SetPresenter(ctx, boardID, id.Account.ID); err != nil {
		return nil, mapNotFound(err)
	}
	return s.boardViewFor(ctx, id, boardID)
}

// ResolvePresentToken - доска по токену показа для публичных маршрутов.
func (s *BoardService) ResolvePresentToken(ctx context.Context, token string) (*model.Board, error) {
	if len(token) < 16 {
		return nil, ErrNotFound
	}
	board, err := repository.NewBoardRepo(s.pool).GetByPresentToken(ctx, token)
	if err != nil {
		return nil, mapNotFound(err)
	}
	return board, nil
}

// boardViewFor перечитывает доску с правами вызывающего.
func (s *BoardService) boardViewFor(ctx context.Context, id Identity, boardID uuid.UUID) (*model.BoardView, error) {
	board, err := repository.NewBoardRepo(s.pool).GetByID(ctx, boardID)
	if err != nil {
		return nil, mapNotFound(err)
	}
	ownerName := id.Account.Name
	if board.AccountID != id.Account.ID {
		if owner, err := repository.NewAccountRepo(s.pool).GetByID(ctx, board.AccountID); err == nil {
			ownerName = owner.Name
		}
	}
	return &model.BoardView{Board: *board, OwnerName: ownerName, CanEdit: true}, nil
}

func randomHex(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
