package handler

import (
	"net/http"
)

// Ресурс account: текущий пользователь. Действия выполняются для владельца
// сессии - accountId в body должен совпадать с accountId, который decodeAndAuth
// получает из oauth2-proxy headers (см. handler/api.go).

// AccountDTO - минимальное публичное представление аккаунта.
type AccountDTO struct {
	ID      string         `json:"id"`
	Name    string         `json:"name"`
	Email   string         `json:"email"`
	OrgRole string         `json:"orgRole"`
	Prefs   map[string]any `json:"prefs"`
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

// GetAccount POST /api/v1/account/get - актуальные данные текущего аккаунта из БД
// (ProfileModal вызывает при открытии, чтобы не полагаться на возможно устаревший
// снимок из window.dashData).
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
