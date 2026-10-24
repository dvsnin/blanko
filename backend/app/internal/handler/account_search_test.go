package handler_test

import "testing"

func TestSearchAccounts(t *testing.T) {
	e := newEnv(t)
	e.account("anna.petrova@example.com")
	e.account("maria@example.com")
	e.account("viewer@example.com")
	if _, err := e.pool.Exec(e.ctx, "UPDATE account SET name = 'Анна Петрова' WHERE email = 'anna.petrova@example.com'"); err != nil {
		t.Fatal(err)
	}
	if _, err := e.pool.Exec(e.ctx, "UPDATE account SET name = 'Мария Сидорова' WHERE email = 'maria@example.com'"); err != nil {
		t.Fatal(err)
	}

	emails := func(body map[string]any) []string {
		var out []string
		for _, it := range items(body) {
			out = append(out, it.(map[string]any)["email"].(string))
		}
		return out
	}

	cases := []struct {
		name string
		q    string
		want []string
	}{
		{"by name, case-insensitive", "петр", []string{"anna.petrova@example.com"}},
		{"by email part", "maria@", []string{"maria@example.com"}},
		// Имя из латиницы (логин до первого входа) идёт раньше кириллицы, как и в сортировке шаблонов.
		{"empty query lists everyone by name", "", []string{"viewer@example.com", "anna.petrova@example.com", "maria@example.com"}},
		{"no match", "zzz", nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, body := e.post("viewer@example.com", "/account/search", map[string]any{"q": tc.q})
			if status != 200 {
				t.Fatalf("status %d %v", status, body)
			}
			got := emails(body)
			if len(got) != len(tc.want) {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
			for i := range tc.want {
				if got[i] != tc.want[i] {
					t.Fatalf("got %v, want %v", got, tc.want)
				}
			}
		})
	}
}
