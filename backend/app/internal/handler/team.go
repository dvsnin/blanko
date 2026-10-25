package handler

import (
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/dvsnin/blanko/backend/app/internal/model"
	"github.com/dvsnin/blanko/backend/app/internal/service"
)

// TeamDTO - представление команды во внешнем API.
type TeamDTO struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Role       string `json:"role"`
	IsStarred  bool   `json:"isStarred"`
	BoardCount int    `json:"boardCount"`
	// Последние открытые доски группы (до 3), только видимые пользователю.
	RecentBoards []BoardDTO `json:"recentBoards"`
	AgeGroup     string     `json:"ageGroup"`
	Teachers     string     `json:"teachers"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}

func teamViewToDTO(v model.TeamView) TeamDTO {
	ageGroup := ""
	if v.Team.AgeGroup != nil {
		ageGroup = *v.Team.AgeGroup
	}
	teachers := ""
	if v.Team.Teachers != nil {
		teachers = *v.Team.Teachers
	}
	recent := make([]BoardDTO, 0, len(v.RecentBoards))
	for _, b := range v.RecentBoards {
		recent = append(recent, boardViewToDTO(b))
	}
	return TeamDTO{
		ID:           v.Team.ID.String(),
		Name:         v.Team.Name,
		Role:         string(v.Role),
		IsStarred:    v.IsStarred,
		BoardCount:   v.BoardCount,
		RecentBoards: recent,
		AgeGroup:     ageGroup,
		Teachers:     teachers,
		CreatedAt:    v.Team.CreatedAt,
		UpdatedAt:    v.Team.UpdatedAt,
	}
}

// --- requests ---

type listTeamsRequest struct {
	WithAccount
}

type createTeamRequest struct {
	WithAccount
	Name     string `json:"name"`
	AgeGroup string `json:"ageGroup,omitempty"`
	Teachers string `json:"teachers,omitempty"`
}

type updateTeamRequest struct {
	WithAccount
	ID       string  `json:"id"`
	Name     *string `json:"name,omitempty"`
	AgeGroup *string `json:"ageGroup,omitempty"`
	Teachers *string `json:"teachers,omitempty"`
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
	view, err := a.services.Team.Create(r.Context(), id, service.TeamCreateInput{Name: req.Name, AgeGroup: req.AgeGroup, Teachers: req.Teachers})
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
	in := service.TeamUpdateInput{AgeGroup: req.AgeGroup, Teachers: req.Teachers}
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

// --- участники ---

type TeamMemberDTO struct {
	AccountID string `json:"accountId"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	Role      string `json:"role"`
	JoinedAt  string `json:"joinedAt"`
}

func teamMemberToDTO(m model.TeamMemberView) TeamMemberDTO {
	joined := ""
	if !m.JoinedAt.IsZero() {
		joined = m.JoinedAt.Format(time.RFC3339)
	}
	return TeamMemberDTO{AccountID: m.AccountID.String(), Email: m.Email, Name: m.Name, Role: string(m.Role), JoinedAt: joined}
}

type teamMembersRequest struct {
	WithAccount
	TeamID string `json:"teamId"`
}

type addTeamMemberRequest struct {
	WithAccount
	TeamID string `json:"teamId"`
	Email  string `json:"email"`
	Role   string `json:"role"`
}

// memberId, а не accountId: accountId в теле занят вызывающим (WithAccount).
type teamMemberRoleRequest struct {
	WithAccount
	TeamID   string `json:"teamId"`
	MemberID string `json:"memberId"`
	Role     string `json:"role"`
}

type teamMemberRequest struct {
	WithAccount
	TeamID   string `json:"teamId"`
	MemberID string `json:"memberId"`
}

// TeamMembers POST /api/v1/team/members
func (a *API) TeamMembers(w http.ResponseWriter, r *http.Request) {
	var req teamMembersRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	teamID, ok := parseID(w, req.TeamID, "team")
	if !ok {
		return
	}
	members, err := a.services.Team.Members(r.Context(), id, teamID)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	out := make([]TeamMemberDTO, 0, len(members))
	for _, m := range members {
		out = append(out, teamMemberToDTO(m))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

// AddTeamMember POST /api/v1/team/member/add: 201 при добавлении, 200 если уже в команде.
func (a *API) AddTeamMember(w http.ResponseWriter, r *http.Request) {
	var req addTeamMemberRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	teamID, ok := parseID(w, req.TeamID, "team")
	if !ok {
		return
	}
	member, created, err := a.services.Team.AddMember(r.Context(), id, teamID, req.Email, model.TeamRole(req.Role))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	writeJSON(w, status, teamMemberToDTO(*member))
}

// SetTeamMemberRole POST /api/v1/team/member/role
func (a *API) SetTeamMemberRole(w http.ResponseWriter, r *http.Request) {
	var req teamMemberRoleRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	teamID, ok := parseID(w, req.TeamID, "team")
	if !ok {
		return
	}
	accountID, ok := parseID(w, req.MemberID, "member")
	if !ok {
		return
	}
	member, err := a.services.Team.SetMemberRole(r.Context(), id, teamID, accountID, model.TeamRole(req.Role))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, teamMemberToDTO(*member))
}

// RemoveTeamMember POST /api/v1/team/member/remove
func (a *API) RemoveTeamMember(w http.ResponseWriter, r *http.Request) {
	var req teamMemberRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	teamID, ok := parseID(w, req.TeamID, "team")
	if !ok {
		return
	}
	accountID, ok := parseID(w, req.MemberID, "member")
	if !ok {
		return
	}
	if err := a.services.Team.RemoveMember(r.Context(), id, teamID, accountID); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
