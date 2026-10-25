package handler

import (
	"github.com/google/uuid"

	"github.com/dvsnin/blanko/backend/app/internal/model"
	"net/http"
)

type AccountDTO struct {
	ID      string         `json:"id"`
	Name    string         `json:"name"`
	Email   string         `json:"email"`
	OrgRole string         `json:"orgRole"`
	Prefs   map[string]any `json:"prefs"`
}

// AccountListDTO - учётная запись сада в списке администратора.
type AccountListDTO struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	OrgRole string `json:"orgRole"`
}

type accountRoleRequest struct {
	WithAccount
	ID   string `json:"id"`   // чья роль меняется
	Role string `json:"role"` // admin | member
}

func accountWithRoleToDTO(a model.AccountWithRole) AccountListDTO {
	return AccountListDTO{ID: a.Account.ID.String(), Name: a.Account.Name, Email: a.Account.Email, OrgRole: string(a.Role)}
}

// ListAccounts POST /api/v1/account/list - все учётные записи сада с ролями, только администратору.
func (a *API) ListAccounts(w http.ResponseWriter, r *http.Request) {
	var req accountGetRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	list, err := a.services.Auth.ListAccounts(r.Context(), id)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	out := make([]AccountListDTO, 0, len(list))
	for _, acc := range list {
		out = append(out, accountWithRoleToDTO(acc))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

// SetAccountRole POST /api/v1/account/role - назначить или снять администратора сада.
func (a *API) SetAccountRole(w http.ResponseWriter, r *http.Request) {
	var req accountRoleRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	target, err := uuid.Parse(req.ID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_id", "invalid account id")
		return
	}
	acc, err := a.services.Auth.SetOrgRole(r.Context(), id, target, req.Role)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, accountWithRoleToDTO(*acc))
}

type accountPrefsRequest struct {
	WithAccount
	Set map[string]any `json:"set"`
}

type accountGetRequest struct {
	WithAccount
}

type accountSearchRequest struct {
	WithAccount
	Q string `json:"q"`
}

// AccountSearchDTO - строка справочника педагогов без роли организации.
type AccountSearchDTO struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type accountUpdateRequest struct {
	WithAccount
	Name *string `json:"name,omitempty"`
}

// GetAccount POST /api/v1/account/get - свежие данные аккаунта, когда снимок в dashData мог устареть.
func (a *API) GetAccount(w http.ResponseWriter, r *http.Request) {
	var req accountGetRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, AccountDTO{
		ID:      id.Account.ID.String(),
		Name:    id.Account.Name,
		Email:   id.Account.Email,
		OrgRole: string(id.OrgRole),
		Prefs:   prefsOrEmpty(id.Account.Prefs),
	})
}

// UpdateAccountPrefs POST /api/v1/account/prefs - слияние настроек кабинета, ответ: полный объект.
func (a *API) UpdateAccountPrefs(w http.ResponseWriter, r *http.Request) {
	var req accountPrefsRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	prefs, err := a.services.Auth.UpdatePrefs(r.Context(), id, req.Set)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"prefs": prefsOrEmpty(prefs)})
}

func prefsOrEmpty(p map[string]any) map[string]any {
	if p == nil {
		return map[string]any{}
	}
	return p
}

// UpdateAccount POST /api/v1/account/update - частичный апдейт профиля.
func (a *API) UpdateAccount(w http.ResponseWriter, r *http.Request) {
	var req accountUpdateRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	name := ""
	if req.Name != nil {
		name = *req.Name
	}
	acc, err := a.services.Auth.UpdateAccount(r.Context(), id, name)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, AccountDTO{
		ID:      acc.ID.String(),
		Name:    acc.Name,
		Email:   acc.Email,
		OrgRole: string(id.OrgRole),
		Prefs:   prefsOrEmpty(acc.Prefs),
	})
}

// SearchAccounts POST /api/v1/account/search - педагоги сада по части имени или почты.
func (a *API) SearchAccounts(w http.ResponseWriter, r *http.Request) {
	var req accountSearchRequest
	_, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	list, err := a.services.Auth.SearchAccounts(r.Context(), req.Q)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	out := make([]AccountSearchDTO, 0, len(list))
	for _, acc := range list {
		out = append(out, AccountSearchDTO{ID: acc.ID.String(), Name: acc.Name, Email: acc.Email})
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out})
}
