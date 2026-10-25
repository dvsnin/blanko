package handler_test

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/dvsnin/blanko/backend/app/internal/doc"
	"github.com/dvsnin/blanko/backend/app/internal/model"
	"github.com/dvsnin/blanko/backend/app/internal/repository"
)

func TestListBoards(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	member := e.account("member@example.com")
	e.account("other@example.com")
	team := e.team(owner)
	e.addMember(team, member)
	e.board(team, owner, "Первая")

	cases := []struct {
		name        string
		email       string
		wantStatus  int
		wantItems   int
		wantCanEdit bool
	}{
		{"owner sees boards and may edit", "owner@example.com", 200, 1, true},
		{"member sees boards but may not edit others", "member@example.com", 200, 1, false},
		{"non member forbidden", "other@example.com", 403, 0, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, body := e.post(tc.email, "/board/list", map[string]any{"teamId": team.ID.String()})
			if status != tc.wantStatus {
				t.Fatalf("status = %d, want %d (%v)", status, tc.wantStatus, body)
			}
			if status != 200 {
				return
			}
			if len(items(body)) != tc.wantItems {
				t.Fatalf("items = %d, want %d", len(items(body)), tc.wantItems)
			}
			if got := items(body)[0].(map[string]any)["canEdit"]; got != tc.wantCanEdit {
				t.Fatalf("canEdit = %v, want %v", got, tc.wantCanEdit)
			}
		})
	}

	t.Run("team access", func(t *testing.T) {
		tm := e.team(owner)
		e.addMember(tm, member)
		e.boardWith(tm, owner, "Скрытая", model.BoardAccessDeny, false)
		e.boardWith(tm, owner, "Только смотреть", model.BoardAccessView, false)
		e.boardWith(tm, member, "Моя скрытая", model.BoardAccessDeny, false)

		_, body := e.post("member@example.com", "/board/list", map[string]any{"teamId": tm.ID.String()})
		got := map[string]any{}
		for _, it := range items(body) {
			x := it.(map[string]any)
			got[x["name"].(string)] = x["canEdit"]
		}
		if _, hidden := got["Скрытая"]; hidden {
			t.Fatal("deny board visible to member")
		}
		if got["Только смотреть"] != false || got["Моя скрытая"] != true {
			t.Fatalf("canEdit = %v", got)
		}
		_, ownerBody := e.post("owner@example.com", "/board/list", map[string]any{"teamId": tm.ID.String()})
		if len(items(ownerBody)) != 3 {
			t.Fatalf("owner sees %d boards, want 3", len(items(ownerBody)))
		}
	})

	// Без teamId - доски всех групп пользователя одним ответом, правила доступа те же.
	// Подтест выше уже создал вторую группу owner+member с досками «Скрытая», «Только смотреть», «Моя скрытая».
	t.Run("all teams without teamId", func(t *testing.T) {
		shared := e.team(owner)
		e.addMember(shared, member)
		e.boardWith(shared, owner, "Общая скрытая", model.BoardAccessDeny, false)
		e.boardWith(shared, owner, "Общая смотреть", model.BoardAccessView, false)
		e.boardWith(shared, member, "Общая моя", model.BoardAccessEdit, false)
		foreign := e.team(e.account("other@example.com"))
		e.board(foreign, e.account("other@example.com"), "Чужая")

		cases := []struct {
			email    string
			wantSeen map[string]bool // имя -> canEdit
		}{
			{"owner@example.com", map[string]bool{
				"Первая": true, "Скрытая": true, "Только смотреть": true, "Моя скрытая": true,
				"Общая скрытая": true, "Общая смотреть": true, "Общая моя": true,
			}},
			{"member@example.com", map[string]bool{
				"Первая": false, "Только смотреть": false, "Моя скрытая": true,
				"Общая смотреть": false, "Общая моя": true,
			}},
			{"other@example.com", map[string]bool{"Чужая": true}},
		}
		for _, tc := range cases {
			status, body := e.post(tc.email, "/board/list", map[string]any{})
			if status != 200 {
				t.Fatalf("%s: status = %d (%v)", tc.email, status, body)
			}
			got := map[string]bool{}
			for _, it := range items(body) {
				x := it.(map[string]any)
				got[x["name"].(string)] = x["canEdit"].(bool)
				if x["teamId"] == "" {
					t.Fatalf("%s: board %q without teamId", tc.email, x["name"])
				}
			}
			if len(got) != len(tc.wantSeen) {
				t.Fatalf("%s: boards = %v, want %v", tc.email, got, tc.wantSeen)
			}
			for name, canEdit := range tc.wantSeen {
				if v, ok := got[name]; !ok || v != canEdit {
					t.Fatalf("%s: %q canEdit = %v (seen %v), want %v", tc.email, name, v, ok, canEdit)
				}
			}
		}
	})
}

// seedDoc кладёт в хранилище документ с одной картинкой под префикс документа.
func (e *env) seedDoc(kind doc.Kind, id uuid.UUID) {
	e.t.Helper()
	name := strings.Repeat("a", 64) + ".png"
	docJSON := `{"schema":{"schemaVersion":2},"store":{"asset:x":{"id":"asset:x","typeName":"asset","props":{"src":"` + doc.MediaSrc(kind, id, name) + `"}}}}`
	if err := e.store.Put(e.ctx, doc.DocumentKey(kind, id), strings.NewReader(docJSON), int64(len(docJSON)), "application/json"); err != nil {
		e.t.Fatal(err)
	}
	if err := e.store.Put(e.ctx, doc.MediaKey(kind, id, name), strings.NewReader("img"), 3, "image/png"); err != nil {
		e.t.Fatal(err)
	}
}

// assertCopied проверяет, что документ и картинка лежат под префиксом приёмника со ссылками на него.
func (e *env) assertCopied(t *testing.T, srcKind doc.Kind, srcID uuid.UUID, dstKind doc.Kind, dstID uuid.UUID) {
	t.Helper()
	body := string(e.store.Bytes(doc.DocumentKey(dstKind, dstID)))
	if body == "" {
		t.Fatalf("no document under %s", doc.Prefix(dstKind, dstID))
	}
	if !strings.Contains(body, doc.MediaSrc(dstKind, dstID, strings.Repeat("a", 64)+".png")) || strings.Contains(body, doc.Prefix(srcKind, srcID)) {
		t.Fatalf("links not rewritten: %s", body)
	}
	if string(e.store.Bytes(doc.MediaKey(dstKind, dstID, strings.Repeat("a", 64)+".png"))) != "img" {
		t.Fatal("media not copied")
	}
}

func TestCreateBoard(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	team := e.team(owner)

	t.Run("plain", func(t *testing.T) {
		status, body := e.post("owner@example.com", "/board/create", map[string]any{"teamId": team.ID.String(), "name": "Доска"})
		if status != 201 {
			t.Fatalf("status %d %v", status, body)
		}
		keys, _ := e.store.List(e.ctx, doc.Prefix(doc.KindBoard, uuid.MustParse(body["id"].(string))))
		if len(keys) != 0 {
			t.Fatalf("objects for plain board: %v", keys)
		}
	})

	t.Run("from template", func(t *testing.T) {
		tpl := e.template(&owner, "С картинкой")
		e.seedDoc(doc.KindTemplate, tpl.ID)
		status, body := e.post("owner@example.com", "/board/create", map[string]any{"teamId": team.ID.String(), "templateId": tpl.ID.String()})
		if status != 201 {
			t.Fatalf("status %d %v", status, body)
		}
		e.assertCopied(t, doc.KindTemplate, tpl.ID, doc.KindBoard, uuid.MustParse(body["id"].(string)))
	})

	t.Run("from template with open room", func(t *testing.T) {
		tpl := e.template(&owner, "Живой")
		c, _ := e.mustDial("owner@example.com", doc.KindTemplate, tpl.ID)
		writeMsg(t, c, pushMsg(1, map[string]any{"shape:live": shape("shape:live")}, nil))
		readMsg(t, c, time.Second)
		status, body := e.post("owner@example.com", "/board/create", map[string]any{"teamId": team.ID.String(), "templateId": tpl.ID.String()})
		if status != 201 {
			t.Fatalf("status %d %v", status, body)
		}
		got := string(e.store.Bytes(doc.DocumentKey(doc.KindBoard, uuid.MustParse(body["id"].(string)))))
		if !strings.Contains(got, `"shape:live"`) {
			t.Fatalf("live room not flushed before copy: %s", got)
		}
	})

	t.Run("storage down", func(t *testing.T) {
		tpl := e.template(&owner, "Недоступно")
		e.seedDoc(doc.KindTemplate, tpl.ID)
		e.store.FailPuts.Store(true)
		defer e.store.FailPuts.Store(false)
		status, body := e.post("owner@example.com", "/board/create", map[string]any{"teamId": team.ID.String(), "templateId": tpl.ID.String(), "name": "Сирота"})
		if status != 500 || body["error"] != "storage_unavailable" {
			t.Fatalf("status %d %v", status, body)
		}
		_, list := e.post("owner@example.com", "/board/list", map[string]any{"teamId": team.ID.String()})
		for _, it := range items(list) {
			if it.(map[string]any)["name"] == "Сирота" {
				t.Fatal("board row created although copy failed")
			}
		}
	})
}

func TestDeleteBoard(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	e.account("other@example.com")
	team := e.team(owner)
	b := e.board(team, owner, "Удаляемая")
	e.seedDoc(doc.KindBoard, b.ID)

	t.Run("non member forbidden", func(t *testing.T) {
		if status, _ := e.post("other@example.com", "/board/delete", map[string]any{"id": b.ID.String()}); status != 403 {
			t.Fatalf("status %d, want 403", status)
		}
	})

	t.Run("soft delete keeps objects", func(t *testing.T) {
		if status, _ := e.post("owner@example.com", "/board/delete", map[string]any{"id": b.ID.String()}); status != 204 {
			t.Fatalf("status %d, want 204", status)
		}
		_, list := e.post("owner@example.com", "/board/list", map[string]any{"teamId": team.ID.String()})
		if len(items(list)) != 0 {
			t.Fatal("deleted board still listed")
		}
		if e.store.Bytes(doc.DocumentKey(doc.KindBoard, b.ID)) == nil {
			t.Fatal("objects purged right away, expected 30-day window")
		}
	})

	t.Run("purge after retention", func(t *testing.T) {
		// Свежеудалённая не трогается, удалённая 31 день назад вычищается и помечается.
		if n, err := e.services.Document.PurgeDeleted(e.ctx, 30*24*time.Hour); err != nil || n != 0 {
			t.Fatalf("purge fresh: n=%d err=%v", n, err)
		}
		if _, err := e.pool.Exec(e.ctx, "UPDATE board SET deleted_at = now() - interval '31 days' WHERE id = $1", b.ID); err != nil {
			t.Fatal(err)
		}
		if n, err := e.services.Document.PurgeDeleted(e.ctx, 30*24*time.Hour); err != nil || n != 1 {
			t.Fatalf("purge old: n=%d err=%v", n, err)
		}
		keys, _ := e.store.List(e.ctx, doc.Prefix(doc.KindBoard, b.ID))
		if len(keys) != 0 {
			t.Fatalf("objects left after purge: %v", keys)
		}
		if n, err := e.services.Document.PurgeDeleted(e.ctx, 30*24*time.Hour); err != nil || n != 0 {
			t.Fatalf("purge twice: n=%d err=%v", n, err)
		}
	})
}

func TestDuplicateBoard(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	e.account("other@example.com")
	team := e.team(owner)
	src := e.board(team, owner, "Первая")
	e.seedDoc(doc.KindBoard, src.ID)

	t.Run("member", func(t *testing.T) {
		status, body := e.post("owner@example.com", "/board/duplicate", map[string]any{"id": src.ID.String()})
		if status != 201 || body["name"] != "Первая (копия)" || body["teamId"] != team.ID.String() || body["ownerId"] != owner.ID.String() {
			t.Fatalf("status %d %v", status, body)
		}
		e.assertCopied(t, doc.KindBoard, src.ID, doc.KindBoard, uuid.MustParse(body["id"].(string)))
	})

	t.Run("non member", func(t *testing.T) {
		status, _ := e.post("other@example.com", "/board/duplicate", map[string]any{"id": src.ID.String()})
		if status != 403 {
			t.Fatalf("status %d, want 403", status)
		}
		_, list := e.post("owner@example.com", "/board/list", map[string]any{"teamId": team.ID.String()})
		if len(items(list)) != 2 {
			t.Fatalf("boards = %d, want 2 (original and one copy)", len(items(list)))
		}
	})
}

func TestMoveBoard(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	member := e.account("member@example.com")
	stranger := e.account("stranger@example.com")
	from := e.team(owner)
	to := e.team(owner)
	e.addMember(from, member)
	e.addMember(to, member)
	onlyFrom := e.team(stranger) // stranger владеет своей группой, но не состоит в to
	e.addMember(onlyFrom, owner)

	count := func(team model.Team) int {
		_, list := e.post("owner@example.com", "/board/list", map[string]any{"teamId": team.ID.String()})
		return len(items(list))
	}

	t.Run("owner moves other member's board", func(t *testing.T) {
		b := e.board(from, member, "Переезд")
		status, body := e.post("owner@example.com", "/board/move", map[string]any{"id": b.ID.String(), "teamId": to.ID.String()})
		if status != 200 || body["teamId"] != to.ID.String() {
			t.Fatalf("status %d %v", status, body)
		}
		if body["ownerId"] != member.ID.String() || body["ownerName"] != member.Name {
			t.Fatalf("owner in response = %v / %v, want %s", body["ownerId"], body["ownerName"], member.Name)
		}
		if count(from) != 0 || count(to) != 1 {
			t.Fatalf("from=%d to=%d", count(from), count(to))
		}
	})

	t.Run("same team", func(t *testing.T) {
		b := e.board(from, owner, "На месте")
		status, body := e.post("owner@example.com", "/board/move", map[string]any{"id": b.ID.String(), "teamId": from.ID.String()})
		if status != 200 || body["teamId"] != from.ID.String() {
			t.Fatalf("status %d %v", status, body)
		}
	})

	t.Run("not member of target", func(t *testing.T) {
		b := e.board(onlyFrom, stranger, "Чужая цель")
		status, _ := e.post("stranger@example.com", "/board/move", map[string]any{"id": b.ID.String(), "teamId": to.ID.String()})
		if status != 403 {
			t.Fatalf("status %d, want 403", status)
		}
		_, list := e.post("stranger@example.com", "/board/list", map[string]any{"teamId": onlyFrom.ID.String()})
		if len(items(list)) != 1 {
			t.Fatalf("board left its team after refused move: %d items", len(items(list)))
		}
	})

	t.Run("target team deleted", func(t *testing.T) {
		gone := e.team(owner)
		if err := repository.NewTeamRepo(e.pool).SoftDelete(e.ctx, gone.ID); err != nil {
			t.Fatal(err)
		}
		b := e.board(from, owner, "В никуда")
		status, _ := e.post("owner@example.com", "/board/move", map[string]any{"id": b.ID.String(), "teamId": gone.ID.String()})
		if status != 404 {
			t.Fatalf("status %d, want 404", status)
		}
	})

	t.Run("member but not board writer", func(t *testing.T) {
		b := e.board(from, owner, "Не моя")
		status, _ := e.post("member@example.com", "/board/move", map[string]any{"id": b.ID.String(), "teamId": to.ID.String()})
		if status != 403 {
			t.Fatalf("status %d, want 403", status)
		}
	})

	t.Run("unknown board", func(t *testing.T) {
		status, _ := e.post("owner@example.com", "/board/move", map[string]any{"id": uuid.New().String(), "teamId": to.ID.String()})
		if status != 404 {
			t.Fatalf("status %d, want 404", status)
		}
	})
}
