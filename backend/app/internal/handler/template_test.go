package handler_test

import (
	"testing"

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

func TestListTemplates(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	withPreview := e.template(&owner, "С превью")
	e.template(&owner, "Без превью")
	e.uploadPreview("owner@example.com", doc.KindTemplate, withPreview.ID, "image/jpeg", jpegBody)

	_, body := e.post("owner@example.com", "/template/list", map[string]any{})
	got := map[string]any{}
	for _, it := range items(body) {
		m := it.(map[string]any)
		got[m["name"].(string)] = m["hasPreview"]
	}
	if got["С превью"] != true || got["Без превью"] != false {
		t.Fatalf("hasPreview = %v", got)
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
