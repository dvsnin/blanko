package preset

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dvsnin/blanko/backend/app/internal/doc"
	"github.com/dvsnin/blanko/backend/app/internal/model"
	"github.com/dvsnin/blanko/backend/app/internal/repository"
	"github.com/dvsnin/blanko/backend/app/internal/storage"
)

// Preset - шаблон каталога: метаданные строки template и сборка документа.
type Preset struct {
	Key, Name, Description, Topic, Glyph string
	Ages                                 []string
	Duration                             int
	Build                                func(d *Doc)
}

// legacyIDs - первые 18 шаблонов пришли миграцией с фиксированными id и ссылками; сидер их не меняет.
var legacyIDs = map[string][2]string{
	"count-to-5":         {"00000000-0000-4000-8000-000000000001", "t46d76276f2159723"},
	"count-to-10":        {"00000000-0000-4000-8000-000000000002", "t5092339a91849f4c"},
	"number-composition": {"00000000-0000-4000-8000-000000000003", "tf3d83df5a5870bf0"},
	"shapes":             {"00000000-0000-4000-8000-000000000004", "t8a995d2704d5368b"},
	"letter":             {"00000000-0000-4000-8000-000000000005", "tf5b75010ea8a54b9"},
	"syllables":          {"00000000-0000-4000-8000-000000000006", "td36567f1b826504d"},
	"reading":            {"00000000-0000-4000-8000-000000000007", "teceadc1d40cea061"},
	"seasons":            {"00000000-0000-4000-8000-000000000008", "t85ed15c4d405df12"},
	"animals":            {"00000000-0000-4000-8000-000000000009", "ta723e3dfb497b24c"},
	"fairy-tale":         {"00000000-0000-4000-8000-000000000010", "t7d379ead8a20c9b3"},
	"story":              {"00000000-0000-4000-8000-000000000011", "tbec670e5a55424d8"},
	"find-pair":          {"00000000-0000-4000-8000-000000000012", "tfbb2fbd52bf982c1"},
	"odd-one-out":        {"00000000-0000-4000-8000-000000000013", "t5d928e82edc4a041"},
	"free-drawing":       {"00000000-0000-4000-8000-000000000014", "tbf9e9d3e15e49cb8"},
	"color-by-number":    {"00000000-0000-4000-8000-000000000015", "t0d7858319511f469"},
	"colors":             {"00000000-0000-4000-8000-000000000016", "t62848e3ce5804aa9"},
	"morning-circle":     {"00000000-0000-4000-8000-000000000017", "t7bd3441c6c7f02a0"},
	"weekdays":           {"00000000-0000-4000-8000-000000000018", "t92b9604ffb8fe105"},
}

var presetNamespace = uuid.MustParse("6f3a2c8e-7b1d-4e55-9a0c-2d9f1b7c4e10")

func presetIDs(key string) (uuid.UUID, string) {
	if l, ok := legacyIDs[key]; ok {
		return uuid.MustParse(l[0]), l[1]
	}
	sum := sha256.Sum256([]byte("blanko-preset:" + key))
	return uuid.NewSHA1(presetNamespace, []byte(key)), "t" + hex.EncodeToString(sum[:])[:16]
}

// Run сидирует каталог: строки template без перезаписи правок сада и документы там, где их нет
// или где нет ни одной фигуры (пустой снапшот после открытия тоже считается пустым).
func Run(ctx context.Context, pool *pgxpool.Pool, store storage.ObjectStore) error {
	repo := repository.NewTemplateRepo(pool)
	rows, docs := 0, 0
	for _, p := range Catalog() {
		if err := p.validate(); err != nil {
			return err
		}
		id, publicID := presetIDs(p.Key)
		key := p.Key
		glyph := p.Glyph
		t := &model.Template{
			ID: id, PublicID: publicID, PresetKey: &key, Name: p.Name, Description: p.Description,
			Topic: p.Topic, Ages: p.Ages, DurationMin: p.Duration,
		}
		if glyph != "" {
			t.Glyph = &glyph
		}
		inserted, err := repo.CreatePreset(ctx, t)
		if err != nil {
			return fmt.Errorf("preset %s: %w", key, err)
		}
		if inserted {
			rows++
		}
		existing, err := repo.GetByPresetKey(ctx, key)
		if err != nil {
			return fmt.Errorf("preset %s: %w", key, err)
		}
		// Удалённый садом шаблон не воскрешаем и документ ему не пишем.
		if alive, err := repo.Exists(ctx, existing.ID); err != nil || !alive {
			if err != nil {
				return fmt.Errorf("preset %s: %w", key, err)
			}
			continue
		}
		need, err := needsDocument(ctx, store, existing.ID)
		if err != nil {
			return fmt.Errorf("preset %s: %w", key, err)
		}
		if !need {
			continue
		}
		d := NewDoc()
		p.Build(d)
		body, err := d.JSON()
		if err != nil {
			return fmt.Errorf("preset %s: %w", key, err)
		}
		if err := store.Put(ctx, doc.DocumentKey(doc.KindTemplate, existing.ID), bytes.NewReader(body), int64(len(body)), "application/json"); err != nil {
			return fmt.Errorf("preset %s: %w", key, err)
		}
		docs++
	}
	log.Printf("presets: %d templates in catalog, %d rows added, %d documents written", len(Catalog()), rows, docs)
	return nil
}

func (p Preset) validate() error {
	switch {
	case p.Key == "" || p.Name == "" || p.Description == "" || p.Topic == "":
		return fmt.Errorf("preset %q: key, name, description and topic are required", p.Key)
	case len(p.Ages) == 0:
		return fmt.Errorf("preset %q: ages are required", p.Key)
	case p.Duration < 5 || p.Duration > 120:
		return fmt.Errorf("preset %q: duration %d out of range", p.Key, p.Duration)
	case p.Build == nil:
		return fmt.Errorf("preset %q: no content builder", p.Key)
	case len([]rune(p.Glyph)) > 4:
		// Колонка glyph - varchar(4): составные эмодзи из нескольких кодпоинтов не влезают.
		return fmt.Errorf("preset %q: glyph %q longer than 4 characters", p.Key, p.Glyph)
	}
	return nil
}

// needsDocument: документа нет или в нём нет фигур. Другие ошибки хранилища - наверх, чтобы не
// затереть документ из-за временного сбоя.
func needsDocument(ctx context.Context, store storage.ObjectStore, id uuid.UUID) (bool, error) {
	body, _, err := store.Get(ctx, doc.DocumentKey(doc.KindTemplate, id))
	if errors.Is(err, storage.ErrNotFound) {
		return true, nil
	}
	if err != nil {
		return false, err
	}
	defer body.Close()
	raw, err := io.ReadAll(body)
	if err != nil {
		return false, err
	}
	var d doc.Document
	if err := json.Unmarshal(raw, &d); err != nil {
		return true, nil
	}
	for key := range d.Store {
		if strings.HasPrefix(key, "shape:") {
			return false, nil
		}
	}
	return true, nil
}
