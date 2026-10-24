package handler_test

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"testing"
)

// Неподписанный JWT с нужными claims: подпись бэкенд не проверяет, он доверяет oauth2-proxy.
func idToken(claims map[string]any) string {
	enc := func(v any) string { b, _ := json.Marshal(v); return base64.RawURLEncoding.EncodeToString(b) }
	return enc(map[string]any{"alg": "none"}) + "." + enc(claims) + "."
}

func TestGetAccount(t *testing.T) {
	e := newEnv(t)
	get := func(email string, headers map[string]string) (int, map[string]any) {
		t.Helper()
		body, _ := json.Marshal(map[string]any{"accountId": "00000000-0000-0000-0000-000000000000"})
		req, _ := http.NewRequest(http.MethodPost, e.srv.URL+"/app/api/v1/account/get", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Forwarded-Email", email)
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		// accountId в теле должен совпадать с резолвленным: сначала узнаём id, потом настоящий запрос.
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		acc := e.account(email)
		body, _ = json.Marshal(map[string]any{"accountId": acc.ID.String()})
		req, _ = http.NewRequest(http.MethodPost, e.srv.URL+"/app/api/v1/account/get", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Forwarded-Email", email)
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		resp, err = http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		out := map[string]any{}
		data, _ := io.ReadAll(resp.Body)
		_ = json.Unmarshal(data, &out)
		return resp.StatusCode, out
	}

	cases := []struct {
		name    string
		email   string
		headers map[string]string
		want    string
	}{
		{"name claim from the id token", "anna@example.com",
			map[string]string{"Authorization": "Bearer " + idToken(map[string]any{"name": "Анна Петрова", "preferred_username": "anna@example.com"})}, "Анна Петрова"},
		{"given and family name when there is no name claim", "maria@example.com",
			map[string]string{"Authorization": "Bearer " + idToken(map[string]any{"given_name": "Мария", "family_name": "Сидорова"})}, "Мария Сидорова"},
		{"preferred username header is still a login, not an email", "olga@example.com",
			map[string]string{"X-Forwarded-Preferred-Username": "olga.s"}, "olga.s"},
		{"email as username falls back to the local part", "irina@example.com",
			map[string]string{"X-Forwarded-Preferred-Username": "irina@example.com"}, "irina"},
		{"no name at all: local part", "viewer@example.com", nil, "viewer"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, body := get(tc.email, tc.headers)
			if status != 200 || body["name"] != tc.want {
				t.Fatalf("status %d name %q (want %q) body %v", status, body["name"], tc.want, body)
			}
		})
	}
}
