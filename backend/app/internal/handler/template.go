package handler

import (
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/dvsnin/blanko/backend/app/internal/model"
	"github.com/dvsnin/blanko/backend/app/internal/service"
)

type TemplateDTO struct {
	ID          string    `json:"id"`
	PublicID    string    `json:"publicId"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Topic       string    `json:"topic"`
	Ages        []string  `json:"ages"`
	DurationMin int       `json:"durationMin"`
	Source      string    `json:"source"`
	AuthorID    string    `json:"authorId"`
	AuthorName  string    `json:"authorName"`
	IsStarred   bool      `json:"isStarred"`
	CanEdit     bool      `json:"canEdit"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func templateViewToDTO(v model.TemplateView) TemplateDTO {
	t := v.Template
	dto := TemplateDTO{
		ID:          t.ID.String(),
		PublicID:    t.PublicID,
		Name:        t.Name,
		Description: t.Description,
		Topic:       t.Topic,
		Ages:        t.Ages,
		DurationMin: t.DurationMin,
		Source:      "preset",
		AuthorName:  v.AuthorName,
		IsStarred:   v.IsStarred,
		CanEdit:     v.CanEdit,
		CreatedAt:   t.CreatedAt,
		UpdatedAt:   t.UpdatedAt,
	}
	if dto.Ages == nil {
		dto.Ages = []string{}
	}
	if t.AuthorAccountID != nil {
		dto.Source = "own"
		dto.AuthorID = t.AuthorAccountID.String()
	}
	return dto
}

type createTemplateRequest struct {
	WithAccount
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Topic       string   `json:"topic"`
	Ages        []string `json:"ages"`
	DurationMin int      `json:"durationMin"`
	FromBoardID string   `json:"fromBoardId,omitempty"`
}

type updateTemplateRequest struct {
	WithAccount
	ID          string   `json:"id"`
	Name        *string  `json:"name,omitempty"`
	Description *string  `json:"description,omitempty"`
	Topic       *string  `json:"topic,omitempty"`
	Ages        []string `json:"ages,omitempty"`
	DurationMin *int     `json:"durationMin,omitempty"`
}

type templateIDRequest struct {
	WithAccount
	ID string `json:"id"`
}

func parseID(w http.ResponseWriter, raw, what string) (uuid.UUID, bool) {
	id, err := uuid.Parse(raw)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_id", "invalid "+what+" id")
		return uuid.Nil, false
	}
	return id, true
}

// ListTemplates POST /api/v1/template/list
func (a *API) ListTemplates(w http.ResponseWriter, r *http.Request) {
	var req struct{ WithAccount }
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	views, err := a.services.Template.List(r.Context(), id)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	out := make([]TemplateDTO, 0, len(views))
	for _, v := range views {
		out = append(out, templateViewToDTO(v))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

// CreateTemplate POST /api/v1/template/create
func (a *API) CreateTemplate(w http.ResponseWriter, r *http.Request) {
	var req createTemplateRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	var fromBoard *uuid.UUID
	if req.FromBoardID != "" {
		bid, ok := parseID(w, req.FromBoardID, "board")
		if !ok {
			return
		}
		fromBoard = &bid
	}
	in := service.TemplateInput{Name: req.Name, Description: req.Description, Topic: req.Topic, Ages: req.Ages, DurationMin: req.DurationMin}
	view, err := a.services.Template.Create(r.Context(), id, in, fromBoard)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, templateViewToDTO(*view))
}

// UpdateTemplate POST /api/v1/template/update
func (a *API) UpdateTemplate(w http.ResponseWriter, r *http.Request) {
	var req updateTemplateRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	tid, ok := parseID(w, req.ID, "template")
	if !ok {
		return
	}
	in := service.TemplateUpdateInput{Name: req.Name, Description: req.Description, Topic: req.Topic, Ages: req.Ages, DurationMin: req.DurationMin}
	view, err := a.services.Template.Update(r.Context(), id, tid, in)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, templateViewToDTO(*view))
}

// DeleteTemplate POST /api/v1/template/delete
func (a *API) DeleteTemplate(w http.ResponseWriter, r *http.Request) {
	var req templateIDRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	tid, ok := parseID(w, req.ID, "template")
	if !ok {
		return
	}
	if err := a.services.Template.Delete(r.Context(), id, tid); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DuplicateTemplate POST /api/v1/template/duplicate
func (a *API) DuplicateTemplate(w http.ResponseWriter, r *http.Request) {
	var req templateIDRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	tid, ok := parseID(w, req.ID, "template")
	if !ok {
		return
	}
	view, err := a.services.Template.Duplicate(r.Context(), id, tid)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, templateViewToDTO(*view))
}

// StarTemplate POST /api/v1/template/star
func (a *API) StarTemplate(w http.ResponseWriter, r *http.Request) { a.setTemplateStar(w, r, true) }

// UnstarTemplate POST /api/v1/template/unstar
func (a *API) UnstarTemplate(w http.ResponseWriter, r *http.Request) { a.setTemplateStar(w, r, false) }

func (a *API) setTemplateStar(w http.ResponseWriter, r *http.Request, starred bool) {
	var req templateIDRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	tid, ok := parseID(w, req.ID, "template")
	if !ok {
		return
	}
	if err := a.services.Template.SetStarred(r.Context(), id, tid, starred); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
