package handler

import (
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/dvsnin/blanko/backend/app/internal/model"
	"github.com/dvsnin/blanko/backend/app/internal/service"
)

// TeamDTO — представление команды во внешнем API.
type TeamDTO struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Role       string    `json:"role"`
	IsStarred  bool      `json:"isStarred"`
	BoardCount int       `json:"boardCount"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

func teamViewToDTO(v model.TeamView) TeamDTO {
	return TeamDTO{
		ID:         v.Team.ID.String(),
		Name:       v.Team.Name,
		Role:       string(v.Role),
		IsStarred:  v.IsStarred,
		BoardCount: v.BoardCount,
		CreatedAt:  v.Team.CreatedAt,
		UpdatedAt:  v.Team.UpdatedAt,
	}
}

// --- requests ---

type listTeamsRequest struct {
	WithAccount
}

type createTeamRequest struct {
	WithAccount
	Name string `json:"name"`
}

type updateTeamRequest struct {
	WithAccount
	ID   string  `json:"id"`
	Name *string `json:"name,omitempty"`
}

type teamIDRequest struct {
	WithAccount
	ID string `json:"id"`
}

// --- handlers ---

// ListTeams POST /api/v1/team/list
func (a *API) ListTeams(w http.ResponseWriter, r *http.Request) {
	var req listTeamsRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	teams, err := a.services.Team.List(r.Context(), id)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	out := make([]TeamDTO, 0, len(teams))
	for _, t := range teams {
		out = append(out, teamViewToDTO(t))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

// CreateTeam POST /api/v1/team/create
func (a *API) CreateTeam(w http.ResponseWriter, r *http.Request) {
	var req createTeamRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	view, err := a.services.Team.Create(r.Context(), id, service.TeamCreateInput{Name: req.Name})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, teamViewToDTO(*view))
}

// UpdateTeam POST /api/v1/team/update
func (a *API) UpdateTeam(w http.ResponseWriter, r *http.Request) {
	var req updateTeamRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	teamID, err := uuid.Parse(req.ID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_id", "invalid team id")
		return
	}
	in := service.TeamUpdateInput{}
	if req.Name != nil {
		in.Name = *req.Name
	}
	view, err := a.services.Team.Update(r.Context(), id, teamID, in)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, teamViewToDTO(*view))
}

// DeleteTeam POST /api/v1/team/delete
func (a *API) DeleteTeam(w http.ResponseWriter, r *http.Request) {
	var req teamIDRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	teamID, err := uuid.Parse(req.ID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_id", "invalid team id")
		return
	}
	if err := a.services.Team.Delete(r.Context(), id, teamID); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// LeaveTeam POST /api/v1/team/leave
func (a *API) LeaveTeam(w http.ResponseWriter, r *http.Request) {
	var req teamIDRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	teamID, err := uuid.Parse(req.ID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_id", "invalid team id")
		return
	}
	if err := a.services.Team.Leave(r.Context(), id, teamID); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// StarTeam POST /api/v1/team/star
func (a *API) StarTeam(w http.ResponseWriter, r *http.Request) {
	a.setTeamStar(w, r, true)
}

// UnstarTeam POST /api/v1/team/unstar
func (a *API) UnstarTeam(w http.ResponseWriter, r *http.Request) {
	a.setTeamStar(w, r, false)
}

func (a *API) setTeamStar(w http.ResponseWriter, r *http.Request, starred bool) {
	var req teamIDRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	teamID, err := uuid.Parse(req.ID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_id", "invalid team id")
		return
	}
	if err := a.services.Team.SetStarred(r.Context(), id, teamID, starred); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
