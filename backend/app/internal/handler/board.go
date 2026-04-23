package handler

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"github.com/dvsnin/blanko/backend/app/internal/model"
	"github.com/dvsnin/blanko/backend/app/internal/service"
)

// BoardDTO — представление доски в API.
type BoardDTO struct {
	ID                string    `json:"id"`
	PublicID          string    `json:"publicId"`
	Name              string    `json:"name"`
	TeamID            string    `json:"teamId"`
	OwnerID           string    `json:"ownerId"`
	OwnerName         string    `json:"ownerName"`
	TeamAccess        string    `json:"teamAccess"`
	LinkAccessEnabled bool      `json:"linkAccessEnabled"`
	IsStarred         bool      `json:"isStarred"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

func boardViewToDTO(v model.BoardView) BoardDTO {
	return BoardDTO{
		ID:                v.Board.ID.String(),
		PublicID:          v.Board.PublicID,
		Name:              v.Board.Name,
		TeamID:            v.Board.TeamID.String(),
		OwnerID:           v.Board.AccountID.String(),
		OwnerName:         v.OwnerName,
		TeamAccess:        string(v.Board.TeamAccess),
		LinkAccessEnabled: v.Board.LinkAccessEnabled,
		IsStarred:         v.IsStarred,
		CreatedAt:         v.Board.CreatedAt,
		UpdatedAt:         v.Board.UpdatedAt,
	}
}

// --- requests ---

type listBoardsRequest struct {
	WithAccount
	TeamID string `json:"teamId"`
}

type createBoardRequest struct {
	WithAccount
	TeamID string `json:"teamId"`
	Name   string `json:"name"`
}

type updateBoardRequest struct {
	WithAccount
	ID                string  `json:"id"`
	Name              *string `json:"name,omitempty"`
	TeamAccess        *string `json:"teamAccess,omitempty"`
	LinkAccessEnabled *bool   `json:"linkAccessEnabled,omitempty"`
}

type boardIDRequest struct {
	WithAccount
	ID string `json:"id"`
}

// --- board handlers ---

// ListBoards POST /api/v1/board/list
func (a *API) ListBoards(w http.ResponseWriter, r *http.Request) {
	var req listBoardsRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	teamID, err := uuid.Parse(req.TeamID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_id", "invalid team id")
		return
	}
	boards, err := a.services.Board.ListByTeam(r.Context(), id, teamID)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	out := make([]BoardDTO, 0, len(boards))
	for _, b := range boards {
		out = append(out, boardViewToDTO(b))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

// CreateBoard POST /api/v1/board/create
func (a *API) CreateBoard(w http.ResponseWriter, r *http.Request) {
	var req createBoardRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	teamID, err := uuid.Parse(req.TeamID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_id", "invalid team id")
		return
	}
	view, err := a.services.Board.Create(r.Context(), id, teamID, service.BoardCreateInput{Name: req.Name})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, boardViewToDTO(*view))
}

// UpdateBoard POST /api/v1/board/update
func (a *API) UpdateBoard(w http.ResponseWriter, r *http.Request) {
	var req updateBoardRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	boardID, err := uuid.Parse(req.ID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_id", "invalid board id")
		return
	}
	in := service.BoardUpdateInput{LinkAccessEnabled: req.LinkAccessEnabled}
	if req.Name != nil {
		in.Name = *req.Name
	}
	if req.TeamAccess != nil {
		in.TeamAccess = model.BoardAccess(*req.TeamAccess)
	}
	view, err := a.services.Board.Update(r.Context(), id, boardID, in)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, boardViewToDTO(*view))
}

// DeleteBoard POST /api/v1/board/delete
func (a *API) DeleteBoard(w http.ResponseWriter, r *http.Request) {
	var req boardIDRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	boardID, err := uuid.Parse(req.ID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_id", "invalid board id")
		return
	}
	if err := a.services.Board.Delete(r.Context(), id, boardID); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// StarBoard POST /api/v1/board/star
func (a *API) StarBoard(w http.ResponseWriter, r *http.Request) {
	a.setBoardStar(w, r, true)
}

// UnstarBoard POST /api/v1/board/unstar
func (a *API) UnstarBoard(w http.ResponseWriter, r *http.Request) {
	a.setBoardStar(w, r, false)
}

func (a *API) setBoardStar(w http.ResponseWriter, r *http.Request, starred bool) {
	var req boardIDRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	boardID, err := uuid.Parse(req.ID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_id", "invalid board id")
		return
	}
	if err := a.services.Board.SetStarred(r.Context(), id, boardID, starred); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- Register ---

// Register регистрирует все API-маршруты под указанным subrouter.
// Схема: все action-роуты POST-only, accountId передаётся в body и валидируется
// в decodeAndAuth против сессии oauth2-proxy.
func (a *API) Register(r *mux.Router) {
	r.Use(a.AuthMiddleware)

	post := func(path string, h http.HandlerFunc) {
		r.HandleFunc(path, h).Methods(http.MethodPost)
	}

	// Account (текущий пользователь)
	post("/account/get", a.GetAccount)
	post("/account/update", a.UpdateAccount)

	// Teams
	post("/team/list", a.ListTeams)
	post("/team/create", a.CreateTeam)
	post("/team/update", a.UpdateTeam)
	post("/team/delete", a.DeleteTeam)
	post("/team/leave", a.LeaveTeam)
	post("/team/star", a.StarTeam)
	post("/team/unstar", a.UnstarTeam)

	// Boards
	post("/board/list", a.ListBoards)
	post("/board/create", a.CreateBoard)
	post("/board/update", a.UpdateBoard)
	post("/board/delete", a.DeleteBoard)
	post("/board/star", a.StarBoard)
	post("/board/unstar", a.UnstarBoard)
}
