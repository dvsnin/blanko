package handler_test

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/dvsnin/blanko/backend/app/internal/doc"
)

func templateInput(name string) map[string]any {
	return map[string]any{"name": name, "description": "", "topic": "math", "ages": []string{"3-4"}, "durationMin": 20}
}

func TestCreateTemplate(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	team := e.team(owner)

	t.Run("from board", func(t *testing.T) {
		b := e.board(team, owner, "Исходник")
		e.seedDoc(doc.KindBoard, b.ID)
		in := templateInput("Из доски")
		in["fromBoardId"] = b.ID.String()
		status, body := e.post("owner@example.com", "/template/create", in)
		if status != 201 {
			t.Fatalf("status %d %v", status, body)
		}
		e.assertCopied(t, doc.KindBoard, b.ID, doc.KindTemplate, uuid.MustParse(body["id"].(string)))
	})

	t.Run("without source", func(t *testing.T) {
		status, body := e.post("owner@example.com", "/template/create", templateInput("Пустой"))
		if status != 201 {
			t.Fatalf("status %d %v", status, body)
		}
		keys, _ := e.store.List(e.ctx, doc.Prefix(doc.KindTemplate, uuid.MustParse(body["id"].(string))))
		if len(keys) != 0 {
			t.Fatalf("objects for empty template: %v", keys)
		}
	})
}

func TestDeleteTemplate(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	tpl := e.template(&owner, "Удаляемый")
	e.seedDoc(doc.KindTemplate, tpl.ID)
	if status, _ := e.post("owner@example.com", "/template/delete", map[string]any{"id": tpl.ID.String()}); status != 204 {
		t.Fatalf("status %d, want 204", status)
	}
	if _, err := e.pool.Exec(e.ctx, "UPDATE template SET deleted_at = now() - interval '31 days' WHERE id = $1", tpl.ID); err != nil {
		t.Fatal(err)
	}
	if n, err := e.services.Document.PurgeDeleted(e.ctx, 30*24*time.Hour); err != nil || n != 1 {
		t.Fatalf("purge: n=%d err=%v", n, err)
	}
	if keys, _ := e.store.List(e.ctx, doc.Prefix(doc.KindTemplate, tpl.ID)); len(keys) != 0 {
		t.Fatalf("objects left after purge: %v", keys)
	}
}

func TestDuplicateTemplate(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	tpl := e.template(&owner, "Оригинал")
	e.seedDoc(doc.KindTemplate, tpl.ID)

	status, body := e.post("owner@example.com", "/template/duplicate", map[string]any{"id": tpl.ID.String()})
	if status != 201 || body["name"] != "Оригинал (копия)" {
		t.Fatalf("status %d %v", status, body)
	}
	e.assertCopied(t, doc.KindTemplate, tpl.ID, doc.KindTemplate, uuid.MustParse(body["id"].(string)))
}
