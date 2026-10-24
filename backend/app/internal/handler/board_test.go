package handler_test

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/dvsnin/blanko/backend/app/internal/doc"
	"github.com/dvsnin/blanko/backend/app/internal/model"
)

func TestListBoards(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	e.account("other@example.com")
	team := e.team(owner)
	e.board(team, owner, "Первая")

	cases := []struct {
		name       string
		email      string
		wantStatus int
		wantItems  int
	}{
		{"member sees boards", "owner@example.com", 200, 1},
		{"non member forbidden", "other@example.com", 403, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, body := e.post(tc.email, "/board/list", map[string]any{"teamId": team.ID.String()})
			if status != tc.wantStatus {
				t.Fatalf("status = %d, want %d (%v)", status, tc.wantStatus, body)
			}
			if status == 200 && len(items(body)) != tc.wantItems {
				t.Fatalf("items = %d, want %d", len(items(body)), tc.wantItems)
			}
		})
	}
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

	t.Run("owner moves to other team", func(t *testing.T) {
		b := e.board(from, owner, "Переезд")
		status, body := e.post("owner@example.com", "/board/move", map[string]any{"id": b.ID.String(), "teamId": to.ID.String()})
		if status != 200 || body["teamId"] != to.ID.String() {
			t.Fatalf("status %d %v", status, body)
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
