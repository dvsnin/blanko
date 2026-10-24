package handler

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
)

// DisplayNameFrom - отображаемое имя для первого входа: claim name из ID-токена, который
// oauth2-proxy кладёт в Authorization (подпись не проверяем, прокси доверенный), иначе имя и
// фамилия из токена, иначе логин из заголовка, если это не e-mail (логин равен e-mail, когда
// в Keycloak включён registrationEmailAsUsername). Пустая строка: сервис возьмёт часть до @.
func DisplayNameFrom(r *http.Request) string {
	if c := idTokenClaims(r); c != nil {
		if name := strings.TrimSpace(c["name"]); name != "" {
			return name
		}
		if full := strings.TrimSpace(strings.TrimSpace(c["given_name"]) + " " + strings.TrimSpace(c["family_name"])); full != "" {
			return full
		}
	}
	login := r.Header.Get("X-Forwarded-Preferred-Username")
	if login == "" {
		login = r.Header.Get("X-Auth-Request-Preferred-Username")
	}
	if strings.Contains(login, "@") {
		return ""
	}
	return strings.TrimSpace(login)
}

func idTokenClaims(r *http.Request) map[string]string {
	authz := r.Header.Get("Authorization")
	if !strings.HasPrefix(authz, "Bearer ") {
		return nil
	}
	parts := strings.Split(strings.TrimPrefix(authz, "Bearer "), ".")
	if len(parts) < 2 {
		return nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(parts[1], "="))
	if err != nil {
		return nil
	}
	var claims map[string]any
	if err := json.Unmarshal(raw, &claims); err != nil {
		return nil
	}
	out := map[string]string{}
	for _, k := range []string{"name", "given_name", "family_name"} {
		if v, ok := claims[k].(string); ok {
			out[k] = v
		}
	}
	return out
}
