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
	"github.com/dvsnin/blanko/backend/app/internal/repository"
	"github.com/dvsnin/blanko/backend/app/internal/storage"
)

// Preset - шаблон каталога: метаданные строки template (попадают в миграцию через MigrationSQL)
// и сборка документа для хранилища.
type Preset struct {
	Key, Name, Description, Topic string
	Ages                          []string
	Duration                      int
	Build                         func(d *Doc)
}

var presetNamespace = uuid.MustParse("6f3a2c8e-7b1d-4e55-9a0c-2d9f1b7c4e10")

func presetIDs(key string) (uuid.UUID, string) {
	sum := sha256.Sum256([]byte("blanko-preset:" + key))
	return uuid.NewSHA1(presetNamespace, []byte(key)), "t" + hex.EncodeToString(sum[:])[:16]
}

// MigrationSQL - миграция со строками каталога (make presets-sql); id и public_id детерминированы из ключа.
func MigrationSQL() string {
	var b strings.Builder
	b.WriteString("-- +goose Up\n-- +goose StatementBegin\n")
	b.WriteString("-- Сгенерировано из каталога internal/preset: make presets-sql.\n")
	b.WriteString("INSERT INTO template (id, public_id, preset_key, name, description, topic, ages, duration_min, author_account_id, created_at, updated_at)\nVALUES\n")
	presets := Catalog()
	for i, p := range presets {
		id, publicID := presetIDs(p.Key)
		ages := make([]string, len(p.Ages))
		for j, a := range p.Ages {
			ages[j] = sqlString(a)
		}
		fmt.Fprintf(&b, "    ('%s', '%s', %s, %s, %s, %s, ARRAY[%s]::text[], %d, NULL, now(), now())",
			id, publicID, sqlString(p.Key), sqlString(p.Name), sqlString(p.Description), sqlString(p.Topic), strings.Join(ages, ","), p.Duration)
		if i < len(presets)-1 {
			b.WriteString(",")
		}
		b.WriteString("\n")
	}
	b.WriteString("ON CONFLICT (preset_key) DO NOTHING;\n-- +goose StatementEnd\n\n-- +goose Down\n-- +goose StatementBegin\n")
	b.WriteString("DELETE FROM template WHERE preset_key IS NOT NULL;\n-- +goose StatementEnd\n")
	return b.String()
}

func sqlString(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "''") + "'"
}

// Run строит документы готовых шаблонов там, где их нет или нет ни одной фигуры; с force
// перегенерирует все (документы tldraw не мигрируются, а строятся заново).
func Run(ctx context.Context, pool *pgxpool.Pool, store storage.ObjectStore, force bool) error {
	repo := repository.NewTemplateRepo(pool)
	docs := 0
	for _, p := range Catalog() {
		if err := p.validate(); err != nil {
			return err
		}
		key := p.Key
		existing, err := repo.GetByPresetKey(ctx, key)
		if errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("preset %s: no template row, regenerate the migration (make presets-sql)", key)
		}
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
		need := force
		if !need {
			if need, err = needsDocument(ctx, store, existing.ID); err != nil {
				return fmt.Errorf("preset %s: %w", key, err)
			}
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
	log.Printf("presets: %d templates in catalog, %d documents written", len(Catalog()), docs)
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
