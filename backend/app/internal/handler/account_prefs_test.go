package handler_test

import (
	"strings"
	"testing"
)

func TestUpdateAccountPrefs(t *testing.T) {
	e := newEnv(t)
	prefs := func(body map[string]any) map[string]any {
		p, _ := body["prefs"].(map[string]any)
		return p
	}

	t.Run("set keys and merge on the next call", func(t *testing.T) {
		status, body := e.post("anna@example.com", "/account/prefs", map[string]any{"set": map[string]any{"lastTeamId": "t1", "boards.view": "list"}})
		if status != 200 || prefs(body)["lastTeamId"] != "t1" || prefs(body)["boards.view"] != "list" {
			t.Fatalf("status %d %v", status, body)
		}
		status, body = e.post("anna@example.com", "/account/prefs", map[string]any{"set": map[string]any{"boards.sort": "name", "flag": true, "n": 3.0}})
		p := prefs(body)
		if status != 200 || p["lastTeamId"] != "t1" || p["boards.sort"] != "name" || p["flag"] != true || p["n"] != 3.0 {
			t.Fatalf("status %d %v", status, body)
		}
		// Срез отдаётся и в /account/get, чтобы кабинет мог перечитать без отдельного вызова.
		status, body = e.post("anna@example.com", "/account/get", nil)
		if status != 200 || prefs(body)["boards.sort"] != "name" {
			t.Fatalf("get: status %d %v", status, body)
		}
	})

	t.Run("null removes a key", func(t *testing.T) {
		e.post("bob@example.com", "/account/prefs", map[string]any{"set": map[string]any{"a": "1", "b": "2"}})
		status, body := e.post("bob@example.com", "/account/prefs", map[string]any{"set": map[string]any{"a": nil}})
		p := prefs(body)
		if status != 200 || p["b"] != "2" {
			t.Fatalf("status %d %v", status, body)
		}
		if _, ok := p["a"]; ok {
			t.Fatalf("key a still present: %v", p)
		}
	})

	cases := []struct {
		name string
		set  map[string]any
		code string
	}{
		{"nested object", map[string]any{"a": map[string]any{"b": 1}}, "validation"},
		{"array", map[string]any{"a": []any{1, 2}}, "validation"},
		{"empty key", map[string]any{"": "x"}, "validation"},
		{"too large", map[string]any{"a": strings.Repeat("x", 5000)}, "validation"},
		{"empty set", map[string]any{}, "validation"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, body := e.post("carl@example.com", "/account/prefs", map[string]any{"set": tc.set})
			if status != 400 || body["error"] != tc.code {
				t.Fatalf("status %d %v", status, body)
			}
		})
	}
}
