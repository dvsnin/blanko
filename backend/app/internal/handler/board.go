package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"github.com/dvsnin/blanko/backend/app/internal/doc"
	"github.com/dvsnin/blanko/backend/app/internal/model"
	"github.com/dvsnin/blanko/backend/app/internal/service"
)

// BoardDTO - представление доски в API.
type BoardDTO struct {
	ID                  string `json:"id"`
	PublicID            string `json:"publicId"`
	Name                string `json:"name"`
	TeamID              string `json:"teamId"`
	OwnerID             string `json:"ownerId"`
	OwnerName           string `json:"ownerName"`
	TeamAccess          string `json:"teamAccess"` // действующий: своя настройка или уровень группы
	TeamAccessInherited bool   `json:"teamAccessInherited"`
	LinkAccessEnabled   bool   `json:"linkAccessEnabled"`
	// Режим показа: включён ли, токен и код (только тем, кто управляет доской), срок, ведущий.
	PresentEnabled   bool      `json:"presentEnabled"`
	PresentToken     string    `json:"presentToken"`
	PresentExpiresAt string    `json:"presentExpiresAt"`
	PresenterID      string    `json:"presenterId"`
	PresenterName    string    `json:"presenterName"`
	IsStarred        bool      `json:"isStarred"`
	CanEdit          bool      `json:"canEdit"`
	TemplateID       string    `json:"templateId"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
	LastOpenedAt     string    `json:"lastOpenedAt"`
}

func boardViewToDTO(v model.BoardView) BoardDTO {
	templateID := ""
	if v.Board.TemplateID != nil {
		templateID = v.Board.TemplateID.String()
	}
	lastOpened := ""
	if v.Board.LastOpenedAt != nil {
		lastOpened = v.Board.LastOpenedAt.Format(time.RFC3339)
	}
	presenterID := ""
	if v.Board.PresenterAccountID != nil {
		presenterID = v.Board.PresenterAccountID.String()
	}
	presentToken, presentExpires := "", ""
	if v.Board.PresentToken != nil && v.Board.PresentExpiresAt != nil {
		presentExpires = v.Board.PresentExpiresAt.UTC().Format(time.RFC3339)
	}
	if v.CanEdit && v.Board.PresentToken != nil {
		presentToken = *v.Board.PresentToken
	}
	return BoardDTO{
		PresentEnabled:      v.Board.PresentToken != nil,
		PresentToken:        presentToken,
		PresentExpiresAt:    presentExpires,
		PresenterID:         presenterID,
		PresenterName:       v.Board.PresenterName,
		ID:                  v.Board.ID.String(),
		PublicID:            v.Board.PublicID,
		Name:                v.Board.Name,
		TeamID:              v.Board.TeamID.String(),
		OwnerID:             v.Board.AccountID.String(),
		OwnerName:           v.OwnerName,
		TeamAccess:          string(v.Board.TeamAccess),
		TeamAccessInherited: v.Board.TeamAccessInherited,
		LinkAccessEnabled:   v.Board.LinkAccessEnabled,
		IsStarred:           v.IsStarred,
		CanEdit:             v.CanEdit,
		TemplateID:          templateID,
		CreatedAt:           v.Board.CreatedAt,
		UpdatedAt:           v.Board.UpdatedAt,
		LastOpenedAt:        lastOpened,
	}
}

// --- requests ---

type listBoardsRequest struct {
	WithAccount
	TeamID        string `json:"teamId"`        // пусто - все команды пользователя
	ExcludeTeamID string `json:"excludeTeamId"` // поиск по другим группам: вычесть текущую
	Q             string `json:"q"`
	Segment       string `json:"segment"` // all | mine | starred
	Sort          string `json:"sort"`    // recent | updated | name
	Cursor        string `json:"cursor"`  // nextCursor предыдущей страницы
	Limit         int    `json:"limit"`   // по умолчанию 24, максимум 100
}

type createBoardRequest struct {
	WithAccount
	TeamID     string `json:"teamId"`
	Name       string `json:"name"`
	TemplateID string `json:"templateId,omitempty"`
}

type updateBoardRequest struct {
	WithAccount
	ID                string  `json:"id"`
	Name              *string `json:"name,omitempty"`
	TeamAccess        *string `json:"teamAccess,omitempty"` // edit | view | deny | inherit
	LinkAccessEnabled *bool   `json:"linkAccessEnabled,omitempty"`
}

type moveBoardRequest struct {
	WithAccount
	ID     string `json:"id"`
	TeamID string `json:"teamId"`
}

type boardIDRequest struct {
	WithAccount
	ID string `json:"id"`
}

// --- board handlers ---

// ListBoards POST /api/v1/board/list - страница досок команды teamId или всех команд пользователя:
// {items, nextCursor, total}.
func (a *API) ListBoards(w http.ResponseWriter, r *http.Request) {
	var req listBoardsRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	in := service.BoardListInput{Q: req.Q, Segment: req.Segment, Sort: req.Sort, Cursor: req.Cursor, Limit: req.Limit}
	if req.TeamID != "" {
		teamID, err := uuid.Parse(req.TeamID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_id", "invalid team id")
			return
		}
		in.TeamID = &teamID
	}
	if req.ExcludeTeamID != "" {
		excl, err := uuid.Parse(req.ExcludeTeamID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_id", "invalid excludeTeamId")
			return
		}
		in.ExcludeTeamID = &excl
	}
	page, err := a.services.Board.List(r.Context(), id, in)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	out := make([]BoardDTO, 0, len(page.Items))
	for _, b := range page.Items {
		out = append(out, boardViewToDTO(b))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out, "nextCursor": page.NextCursor, "total": page.Total})
}

type presentEnableRequest struct {
	WithAccount
	ID    string `json:"id"`
	Hours int    `json:"hours"` // 0 - пока не выключат, иначе 1, 12 или 24
}

// EnablePresent POST /api/v1/board/present/enable - включить показ: ссылка, код, срок, ведущий.
func (a *API) EnablePresent(w http.ResponseWriter, r *http.Request) {
	var req presentEnableRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	boardID, err := uuid.Parse(req.ID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_id", "invalid board id")
		return
	}
	view, err := a.services.Board.EnablePresent(r.Context(), id, boardID, req.Hours)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, boardViewToDTO(*view))
}

// DisablePresent POST /api/v1/board/present/disable.
func (a *API) DisablePresent(w http.ResponseWriter, r *http.Request) {
	a.presentAction(w, r, func(ctx context.Context, id service.Identity, boardID uuid.UUID) (*model.BoardView, error) {
		view, err := a.services.Board.DisablePresent(ctx, id, boardID)
		if err == nil {
			// Экраны отключаем сразу, не дожидаясь их опроса: ссылка уже не действует.
			a.services.Document.Hub.CloseScreens(doc.KindBoard, boardID, 4404, "present off")
		}
		return view, err
	})
}

// LeadPresent POST /api/v1/board/present/lead - стать ведущим показа.
func (a *API) LeadPresent(w http.ResponseWriter, r *http.Request) {
	a.presentAction(w, r, a.services.Board.LeadPresent)
}

func (a *API) presentAction(w http.ResponseWriter, r *http.Request, action func(context.Context, service.Identity, uuid.UUID) (*model.BoardView, error)) {
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
	view, err := action(r.Context(), id, boardID)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, boardViewToDTO(*view))
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
	view, err := a.services.Board.Create(r.Context(), id, teamID, service.BoardCreateInput{Name: req.Name, TemplateID: req.TemplateID})
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
		in.TeamAccess = *req.TeamAccess
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

// DuplicateBoard POST /api/v1/board/duplicate
func (a *API) DuplicateBoard(w http.ResponseWriter, r *http.Request) {
	var req boardIDRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	bid, ok := parseID(w, req.ID, "board")
	if !ok {
		return
	}
	view, err := a.services.Board.Duplicate(r.Context(), id, bid)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, boardViewToDTO(*view))
}

// MoveBoard POST /api/v1/board/move
func (a *API) MoveBoard(w http.ResponseWriter, r *http.Request) {
	var req moveBoardRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	bid, ok := parseID(w, req.ID, "board")
	if !ok {
		return
	}
	tid, ok := parseID(w, req.TeamID, "team")
	if !ok {
		return
	}
	view, err := a.services.Board.Move(r.Context(), id, bid, tid)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, boardViewToDTO(*view))
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
	post("/account/search", a.SearchAccounts)
	post("/account/prefs", a.UpdateAccountPrefs)
	post("/account/list", a.ListAccounts)
	post("/account/role", a.SetAccountRole)

	// Teams
	post("/team/list", a.ListTeams)
	post("/team/create", a.CreateTeam)
	post("/team/update", a.UpdateTeam)
	post("/team/delete", a.DeleteTeam)
	post("/team/leave", a.LeaveTeam)
	post("/team/star", a.StarTeam)
	post("/team/unstar", a.UnstarTeam)
	post("/team/members", a.TeamMembers)
	post("/team/member/add", a.AddTeamMember)
	post("/team/member/role", a.SetTeamMemberRole)
	post("/team/member/remove", a.RemoveTeamMember)

	// Boards
	post("/board/list", a.ListBoards)
	post("/board/create", a.CreateBoard)
	post("/board/update", a.UpdateBoard)
	post("/board/delete", a.DeleteBoard)
	post("/board/present/enable", a.EnablePresent)
	post("/board/present/disable", a.DisablePresent)
	post("/board/present/lead", a.LeadPresent)
	post("/board/star", a.StarBoard)
	post("/board/unstar", a.UnstarBoard)
	post("/board/duplicate", a.DuplicateBoard)
	post("/board/move", a.MoveBoard)

	// Templates
	post("/template/list", a.ListTemplates)
	post("/template/create", a.CreateTemplate)
	post("/template/update", a.UpdateTemplate)
	post("/template/delete", a.DeleteTemplate)
	post("/template/duplicate", a.DuplicateTemplate)
	post("/template/star", a.StarTemplate)
	post("/template/unstar", a.UnstarTemplate)
}
