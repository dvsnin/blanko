package handler

import (
	"net/http"
)

// Ресурс account: текущий пользователь. Действия выполняются для владельца
// сессии — accountId в body должен совпадать с accountId, который decodeAndAuth
// получает из oauth2-proxy headers (см. handler/api.go).

// AccountDTO — минимальное публичное представление аккаунта.
type AccountDTO struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type accountGetRequest struct {
	WithAccount
}

type accountUpdateRequest struct {
	WithAccount
	Name *string `json:"name,omitempty"`
}

// GetAccount POST /api/v1/account/get — актуальные данные текущего аккаунта из БД
// (ProfileModal вызывает при открытии, чтобы не полагаться на возможно устаревший
// снимок из window.dashData).
func (a *API) GetAccount(w http.ResponseWriter, r *http.Request) {
	var req accountGetRequest
	id, ok := a.decodeAndAuth(w, r, &req)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, AccountDTO{
		ID:    id.Account.ID.String(),
		Name:  id.Account.Name,
		Email: id.Account.Email,
	})
}

// UpdateAccount POST /api/v1/account/update — частичный апдейт профиля.
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
		ID:    acc.ID.String(),
		Name:  acc.Name,
		Email: acc.Email,
	})
}
