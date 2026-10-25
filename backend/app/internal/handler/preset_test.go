package handler_test

import (
	"encoding/json"
	"io"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/dvsnin/blanko/backend/app/internal/doc"
	"github.com/dvsnin/blanko/backend/app/internal/preset"
)

// Предустановленные шаблоны: сидер кладёт строки и документы с содержимым, повторный запуск
// ничего не дублирует, у каждого шаблона на канвасе есть фигуры.
func TestPresetTemplates(t *testing.T) {
	e := newEnv(t)
	for i := 0; i < 2; i++ {
		if err := preset.Run(e.ctx, e.pool, e.store); err != nil {
			t.Fatalf("run %d: %v", i, err)
		}
	}
	status, body := e.post("teacher@example.com", "/template/list", map[string]any{})
	if status != 200 {
		t.Fatalf("status = %d (%v)", status, body)
	}
	topics := map[string]bool{
		"math": true, "literacy": true, "world": true, "speech": true, "logic": true, "drawing": true,
		"sensory": true, "routine": true, "music": true, "health": true, "safety": true, "social": true,
	}
	ages := map[string]bool{"3-4": true, "4-5": true, "5-6": true, "6-7": true}
	names := map[string]bool{}
	seenTopics := map[string]bool{}
	count := 0
	for _, it := range items(body) {
		x := it.(map[string]any)
		if x["source"] != "preset" {
			continue
		}
		count++
		name := x["name"].(string)
		if names[name] {
			t.Fatalf("duplicate preset name %q", name)
		}
		names[name] = true
		if !topics[x["topic"].(string)] {
			t.Fatalf("%s: unknown topic %v", name, x["topic"])
		}
		seenTopics[x["topic"].(string)] = true
		if strings.TrimSpace(x["description"].(string)) == "" {
			t.Fatalf("%s: empty description", name)
		}
		if d := x["durationMin"].(float64); d < 5 || d > 120 {
			t.Fatalf("%s: duration %v", name, d)
		}
		list, _ := x["ages"].([]any)
		if len(list) == 0 {
			t.Fatalf("%s: no ages", name)
		}
		for _, a := range list {
			if !ages[a.(string)] {
				t.Fatalf("%s: bad age %v", name, a)
			}
		}
		id := uuid.MustParse(x["id"].(string))
		assertSeededDocument(t, e, id, name)
	}
	if count < 80 {
		t.Fatalf("presets = %d, want at least 80", count)
	}
	if len(seenTopics) < 12 {
		t.Fatalf("topics covered = %d, want 12", len(seenTopics))
	}
	if n := len(items(body)); n != count {
		t.Fatalf("non-preset templates appeared: %d", n-count)
	}

	// Доска из готового шаблона получает всё его содержимое: те же записи, кроме документа и страницы
	// копируются один в один (Copy переписывает только ссылки на медиа).
	t.Run("board from preset keeps every shape", func(t *testing.T) {
		teacher := e.account("teacher@example.com")
		team := e.team(teacher)
		for _, it := range items(body)[:10] {
			x := it.(map[string]any)
			tplID := uuid.MustParse(x["id"].(string))
			status, created := e.post("teacher@example.com", "/board/create", map[string]any{"teamId": team.ID.String(), "name": "Из шаблона", "templateId": tplID.String()})
			if status != 201 && status != 200 {
				t.Fatalf("%s: create board: %d %v", x["name"], status, created)
			}
			boardID := uuid.MustParse(created["id"].(string))
			src := readStore(t, e, doc.DocumentKey(doc.KindTemplate, tplID))
			dst := readStore(t, e, doc.DocumentKey(doc.KindBoard, boardID))
			if len(src) != len(dst) {
				t.Fatalf("%s: board has %d records, template %d", x["name"], len(dst), len(src))
			}
			for key, rec := range src {
				if string(dst[key]) != string(rec) {
					t.Fatalf("%s: record %q differs in the board copy", x["name"], key)
				}
			}
		}
	})
}

func readStore(t *testing.T, e *env, key string) map[string]json.RawMessage {
	t.Helper()
	body, _, err := e.store.Get(e.ctx, key)
	if err != nil {
		t.Fatalf("%s: %v", key, err)
	}
	defer body.Close()
	raw, _ := io.ReadAll(body)
	var d doc.Document
	if err := json.Unmarshal(raw, &d); err != nil {
		t.Fatalf("%s: %v", key, err)
	}
	return d.Store
}

func assertSeededDocument(t *testing.T, e *env, id uuid.UUID, name string) {
	t.Helper()
	body, _, err := e.store.Get(e.ctx, doc.DocumentKey(doc.KindTemplate, id))
	if err != nil {
		t.Fatalf("%s: document missing: %v", name, err)
	}
	defer body.Close()
	raw, _ := io.ReadAll(body)
	var d doc.Document
	if err := json.Unmarshal(raw, &d); err != nil {
		t.Fatalf("%s: bad document json: %v", name, err)
	}
	if len(d.Schema) == 0 {
		t.Fatalf("%s: no schema", name)
	}
	shapes := 0
	for key, rec := range d.Store {
		var r struct {
			ID       string `json:"id"`
			TypeName string `json:"typeName"`
			ParentID string `json:"parentId"`
			Index    string `json:"index"`
		}
		if err := json.Unmarshal(rec, &r); err != nil || r.ID != key || r.TypeName == "" {
			t.Fatalf("%s: record %q: id/typeName mismatch", name, key)
		}
		if r.TypeName == "shape" {
			shapes++
			if _, ok := d.Store[r.ParentID]; !ok {
				t.Fatalf("%s: shape %q parent %q missing", name, key, r.ParentID)
			}
			if r.Index == "" {
				t.Fatalf("%s: shape %q without index", name, key)
			}
		}
	}
	if shapes < 3 {
		t.Fatalf("%s: only %d shapes, template looks empty", name, shapes)
	}
}
