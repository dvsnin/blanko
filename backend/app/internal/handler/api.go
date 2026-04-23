package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/dvsnin/blanko/backend/app/internal/service"
)

// ctxKey — приватный тип для ключей контекста.
type ctxKey int

const (
	ctxKeyIdentity ctxKey = iota + 1
)

// API — корневая структура API, владеющая сервисами.
type API struct {
	services *service.Services
}

// NewAPI создаёт API с переданными сервисами.
func NewAPI(s *service.Services) *API {
	return &API{services: s}
}

// AuthMiddleware достаёт email/name из заголовков oauth2-proxy, резолвит identity
// и кладёт её в контекст запроса. Без валидной identity API вернёт 401.
func (a *API) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		email := r.Header.Get("X-Forwarded-Email")
		if email == "" {
			email = r.Header.Get("X-Auth-Request-Email")
		}
		name := r.Header.Get("X-Forwarded-Preferred-Username")
		if name == "" {
			name = r.Header.Get("X-Auth-Request-Preferred-Username")
		}
		if email == "" {
			writeError(w, http.StatusUnauthorized, "unauthorized", "no identity headers")
			return
		}
		id, err := a.services.Auth.Resolve(r.Context(), email, name)
		if err != nil {
			log.Printf("auth resolve error: %v", err)
			writeError(w, http.StatusInternalServerError, "internal", "identity resolution failed")
			return
		}
		ctx := context.WithValue(r.Context(), ctxKeyIdentity, *id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// identityFrom извлекает identity из контекста.
func identityFrom(ctx context.Context) (service.Identity, bool) {
	id, ok := ctx.Value(ctxKeyIdentity).(service.Identity)
	return id, ok
}

// ---------- HTTP helpers ----------

type errorBody struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if body == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(body); err != nil {
		log.Printf("write json: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, errorBody{Error: code, Message: msg})
}

func writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrNotFound):
		writeError(w, http.StatusNotFound, "not_found", err.Error())
	case errors.Is(err, service.ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden", err.Error())
	case errors.Is(err, service.ErrValidation):
		writeError(w, http.StatusBadRequest, "validation", err.Error())
	case errors.Is(err, service.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "unauthorized", err.Error())
	default:
		log.Printf("internal error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal", "internal server error")
	}
}

func decodeJSON(r *http.Request, dst any) error {
	if r.Body == nil {
		return nil
	}
	defer r.Body.Close()
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}

// WithAccount — общая часть всех POST-DTO: клиент обязан присылать accountId
// текущего пользователя; сервер сверяет его с сессией (oauth2-proxy headers)
// и режет запросы с чужим id.
type WithAccount struct {
	AccountID string `json:"accountId"`
}

// GetAccountID реализует интерфейс accountIDProvider.
func (w WithAccount) GetAccountID() string { return w.AccountID }

type accountIDProvider interface {
	GetAccountID() string
}

// decodeAndAuth — стандартный вход в любой POST-хендлер:
//  1. вытаскивает Identity из контекста (кладёт AuthMiddleware);
//  2. парсит JSON-тело в req;
//  3. сверяет req.AccountID с id.Account.ID — при несовпадении 403;
//
// В случае ошибки пишет HTTP-ответ и возвращает ok=false.
func (a *API) decodeAndAuth(w http.ResponseWriter, r *http.Request, req accountIDProvider) (service.Identity, bool) {
	id, ok := identityFrom(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "")
		return service.Identity{}, false
	}
	if err := decodeJSON(r, req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_json", err.Error())
		return service.Identity{}, false
	}
	if req.GetAccountID() == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "accountId is required")
		return service.Identity{}, false
	}
	if req.GetAccountID() != id.Account.ID.String() {
		writeError(w, http.StatusForbidden, "account_mismatch", "accountId does not match session")
		return service.Identity{}, false
	}
	return id, true
}
