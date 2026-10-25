package handler_test

import "testing"

// Доступ участников к доскам задаётся в группе и наследуется каждой доской, пока у доски нет своей
// настройки; «как в группе» возвращает наследование.
func TestBoardAccessInheritance(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	member := e.account("member@example.com")
	team := e.team(owner)
	e.addMember(team, member)
	teamID := team.ID.String()

	status, created := e.post("owner@example.com", "/board/create", map[string]any{"teamId": teamID, "name": "Общая"})
	if status != 201 && status != 200 {
		t.Fatalf("create: %d %v", status, created)
	}
	boardID := created["id"].(string)
	if created["teamAccess"] != "edit" || created["teamAccessInherited"] != true {
		t.Fatalf("new board: teamAccess=%v inherited=%v, want edit/true", created["teamAccess"], created["teamAccessInherited"])
	}

	// Что видит участник: имя -> teamAccess, пусто - доска скрыта.
	seen := func(email string) map[string]string {
		_, body := e.post(email, "/board/list", map[string]any{"teamId": teamID})
		out := map[string]string{}
		for _, it := range items(body) {
			x := it.(map[string]any)
			out[x["name"].(string)] = x["teamAccess"].(string)
		}
		return out
	}
	setTeam := func(access string) (int, map[string]any) {
		return e.post("owner@example.com", "/team/update", map[string]any{"id": teamID, "memberBoardAccess": access})
	}
	setBoard := func(access string) map[string]any {
		status, body := e.post("owner@example.com", "/board/update", map[string]any{"id": boardID, "teamAccess": access})
		if status != 200 {
			t.Fatalf("board update %s: %d %v", access, status, body)
		}
		return body
	}

	if got := seen("member@example.com"); got["Общая"] != "edit" {
		t.Fatalf("member before: %v", got)
	}
	if status, body := setTeam("view"); status != 200 || body["memberBoardAccess"] != "view" {
		t.Fatalf("team view: %d %v", status, body)
	}
	if got := seen("member@example.com"); got["Общая"] != "view" {
		t.Fatalf("member after team view: %v", got)
	}
	if status, _ := setTeam("deny"); status != 200 {
		t.Fatal("team deny")
	}
	if got := seen("member@example.com"); len(got) != 0 {
		t.Fatalf("member after team deny still sees: %v", got)
	}
	if got := seen("owner@example.com"); got["Общая"] != "deny" {
		t.Fatalf("owner sees effective access: %v", got)
	}

	// Своя настройка доски перекрывает группу, «inherit» возвращает наследование.
	if body := setBoard("edit"); body["teamAccess"] != "edit" || body["teamAccessInherited"] != false {
		t.Fatalf("override: %v", body)
	}
	if got := seen("member@example.com"); got["Общая"] != "edit" {
		t.Fatalf("member after override: %v", got)
	}
	if body := setBoard("inherit"); body["teamAccess"] != "deny" || body["teamAccessInherited"] != true {
		t.Fatalf("inherit again: %v", body)
	}
	if got := seen("member@example.com"); len(got) != 0 {
		t.Fatalf("member after inherit: %v", got)
	}

	// Новая доска наследует текущий уровень группы.
	_, second := e.post("owner@example.com", "/board/create", map[string]any{"teamId": teamID, "name": "Вторая"})
	if second["teamAccess"] != "deny" || second["teamAccessInherited"] != true {
		t.Fatalf("second board: %v", second)
	}
	_ = member

	// Ошибки: неизвестный уровень и участник без прав.
	if status, body := setTeam("all"); status != 400 {
		t.Fatalf("bad access: %d %v", status, body)
	}
	if status, _ := e.post("member@example.com", "/team/update", map[string]any{"id": teamID, "memberBoardAccess": "edit"}); status != 403 {
		t.Fatalf("member changed team access: %d", status)
	}
	_, teams := e.post("owner@example.com", "/team/list", map[string]any{})
	for _, it := range items(teams) {
		if x := it.(map[string]any); x["id"] == teamID && x["memberBoardAccess"] != "deny" {
			t.Fatalf("team list memberBoardAccess = %v", x["memberBoardAccess"])
		}
	}
}
