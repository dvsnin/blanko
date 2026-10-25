package handler_test

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
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
		if err := preset.Run(e.ctx, e.pool, e.store, false); err != nil {
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

	// Файл миграции генерируется из каталога: правка каталога без make presets-sql ловится здесь.
	t.Run("presets migration matches the catalog", func(t *testing.T) {
		raw, err := os.ReadFile(filepath.Join(migrationsDir, "20261025180100_presets.sql"))
		if err != nil {
			t.Fatal(err)
		}
		if string(raw) != preset.MigrationSQL() {
			t.Fatal("migration/20261025180100_presets.sql differs from the catalog: run make presets-sql")
		}
	})

	// PRESET_RESEED перегенерирует документы целиком; без флага отредактированный не трогается.
	t.Run("forced reseed regenerates preset documents", func(t *testing.T) {
		first := items(body)[0].(map[string]any)
		key := doc.DocumentKey(doc.KindTemplate, uuid.MustParse(first["id"].(string)))
		edited := doc.Document{Schema: json.RawMessage(`{"schemaVersion":2,"sequences":{}}`), Store: readStore(t, e, key)}
		for k, rec := range edited.Store {
			if strings.HasPrefix(k, "shape:") {
				edited.Store["shape:extra"] = json.RawMessage(strings.Replace(string(rec), `"`+k+`"`, `"shape:extra"`, 1))
				break
			}
		}
		raw, _ := json.Marshal(edited)
		if err := e.store.Put(e.ctx, key, strings.NewReader(string(raw)), int64(len(raw)), "application/json"); err != nil {
			t.Fatal(err)
		}
		if err := preset.Run(e.ctx, e.pool, e.store, false); err != nil {
			t.Fatal(err)
		}
		if _, ok := readStore(t, e, key)["shape:extra"]; !ok {
			t.Fatal("plain run overwrote an edited preset")
		}
		if err := preset.Run(e.ctx, e.pool, e.store, true); err != nil {
			t.Fatal(err)
		}
		if _, ok := readStore(t, e, key)["shape:extra"]; ok {
			t.Fatal("forced reseed kept the edited document")
		}
	})

	// Доска из шаблона получает все записи один в один, Copy переписывает только ссылки на медиа.
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
