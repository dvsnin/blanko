package handler_test

import "testing"

// Учётные записи сада для администратора: список с ролями организации.
func TestListAccounts(t *testing.T) {
	e := newEnv(t)
	e.orgAdmin("admin@example.com")
	e.account("anna@example.com")
	e.account("boris@example.com")
	if _, err := e.pool.Exec(e.ctx, "UPDATE account SET name = 'Анна Петрова' WHERE email = 'anna@example.com'"); err != nil {
		t.Fatal(err)
	}

	t.Run("admin sees everyone with org roles, sorted by name", func(t *testing.T) {
		status, body := e.post("admin@example.com", "/account/list", map[string]any{})
		if status != 200 {
			t.Fatalf("status %d %v", status, body)
		}
		roles := map[string]string{}
		names := []string{}
		for _, it := range items(body) {
			x := it.(map[string]any)
			roles[x["email"].(string)] = x["orgRole"].(string)
			names = append(names, x["name"].(string))
		}
		if roles["admin@example.com"] != "admin" || roles["anna@example.com"] != "member" || roles["boris@example.com"] != "member" {
			t.Fatalf("roles = %v", roles)
		}
		// Латиница (логины до первого входа) раньше кириллицы, как везде в сортировке по-русски.
		if names[len(names)-1] != "Анна Петрова" {
			t.Fatalf("names = %v", names)
		}
	})

	t.Run("member is forbidden", func(t *testing.T) {
		status, body := e.post("anna@example.com", "/account/list", map[string]any{})
		if status != 403 {
			t.Fatalf("status %d %v", status, body)
		}
	})
}

// Назначение и снятие администратора сада: только админом, последний админ остаётся.
func TestSetOrgRole(t *testing.T) {
	e := newEnv(t)
	admin := e.orgAdmin("admin@example.com")
	anna := e.account("anna@example.com")
	boris := e.account("boris@example.com")

	roleOf := func(email string) string {
		_, body := e.post("admin@example.com", "/account/list", map[string]any{})
		for _, it := range items(body) {
			x := it.(map[string]any)
			if x["email"] == email {
				return x["orgRole"].(string)
			}
		}
		return ""
	}

	cases := []struct {
		name       string
		actor      string
		id         string
		role       string
		wantStatus int
		wantError  string
	}{
		{"member cannot change roles", "boris@example.com", anna.ID.String(), "admin", 403, "forbidden"},
		{"admin promotes", "admin@example.com", anna.ID.String(), "admin", 200, ""},
		{"bad role", "admin@example.com", anna.ID.String(), "owner", 400, "invalid_role"},
		{"unknown account", "admin@example.com", "00000000-0000-4000-8000-00000000dead", "admin", 404, "not_found"},
		{"admin demotes the other admin", "admin@example.com", anna.ID.String(), "member", 200, ""},
		{"last admin cannot demote himself", "admin@example.com", admin.ID.String(), "member", 409, "last_admin"},
		{"promote again", "admin@example.com", anna.ID.String(), "admin", 200, ""},
		{"admin may step down when another admin remains", "admin@example.com", admin.ID.String(), "member", 200, ""},
		{"new admin keeps managing", "anna@example.com", boris.ID.String(), "admin", 200, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, body := e.post(tc.actor, "/account/role", map[string]any{"id": tc.id, "role": tc.role})
			if status != tc.wantStatus {
				t.Fatalf("status = %d, want %d (%v)", status, tc.wantStatus, body)
			}
			if tc.wantError != "" && body["error"] != tc.wantError {
				t.Fatalf("error = %v, want %s", body["error"], tc.wantError)
			}
			if status == 200 && body["orgRole"] != tc.role {
				t.Fatalf("response orgRole = %v, want %s", body["orgRole"], tc.role)
			}
		})
	}
	// Итог: Анна и Борис админы, первый админ стал пользователем.
	_, body := e.post("anna@example.com", "/account/list", map[string]any{})
	got := map[string]string{}
	for _, it := range items(body) {
		x := it.(map[string]any)
		got[x["email"].(string)] = x["orgRole"].(string)
	}
	if got["admin@example.com"] != "member" || got["anna@example.com"] != "admin" || got["boris@example.com"] != "admin" {
		t.Fatalf("final roles = %v", got)
	}
	_ = roleOf
}
