package handler_test

import (
	"fmt"
	"reflect"
	"testing"

	"github.com/dvsnin/blanko/backend/app/internal/model"
)

// Группы с числом видимых досок и последними открытыми: «Группы» и переключатель
// не грузят список досок целиком.
func TestListTeams(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	member := e.account("member@example.com")
	team := e.team(owner)
	e.addMember(team, member)
	empty := e.team(owner)
	for i, name := range []string{"Первая", "Вторая", "Третья", "Четвёртая"} {
		b := e.board(team, owner, name)
		if _, err := e.pool.Exec(e.ctx, `UPDATE board SET last_opened_at = now() - ($2 || ' hours')::interval WHERE id = $1`, b.ID, fmt.Sprint(i)); err != nil {
			t.Fatal(err)
		}
	}
	e.boardWith(team, owner, "Скрытая", model.BoardAccessDeny, false)

	cases := []struct {
		name       string
		email      string
		wantCount  int
		wantRecent []string
	}{
		{"owner counts deny board and sees it among recent", "owner@example.com", 5, []string{"Скрытая", "Первая", "Вторая"}},
		{"member sees only visible boards", "member@example.com", 4, []string{"Первая", "Вторая", "Третья"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, body := e.post(tc.email, "/team/list", map[string]any{})
			if status != 200 {
				t.Fatalf("status = %d (%v)", status, body)
			}
			byID := map[string]map[string]any{}
			for _, it := range items(body) {
				x := it.(map[string]any)
				byID[x["id"].(string)] = x
			}
			got := byID[team.ID.String()]
			if got["boardCount"] != float64(tc.wantCount) {
				t.Fatalf("boardCount = %v, want %d", got["boardCount"], tc.wantCount)
			}
			recent := []string{}
			for _, it := range got["recentBoards"].([]any) {
				b := it.(map[string]any)
				recent = append(recent, b["name"].(string))
				if b["teamId"] != team.ID.String() || b["canEdit"] == nil {
					t.Fatalf("recent board without teamId/canEdit: %v", b)
				}
			}
			if !reflect.DeepEqual(recent, tc.wantRecent) {
				t.Fatalf("recentBoards = %v, want %v", recent, tc.wantRecent)
			}
			if tc.email == "owner@example.com" {
				if rb, ok := byID[empty.ID.String()]["recentBoards"].([]any); !ok || len(rb) != 0 {
					t.Fatalf("empty team recentBoards = %v", byID[empty.ID.String()]["recentBoards"])
				}
			}
		})
	}
}
