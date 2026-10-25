package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dvsnin/blanko/backend/app/internal/doc"
	"github.com/dvsnin/blanko/backend/app/internal/model"
	"github.com/dvsnin/blanko/backend/app/internal/repository"
	"github.com/dvsnin/blanko/backend/app/internal/storage"
)

// ErrStorageUnavailable - операция с хранилищем не удалась, в БД ничего не меняем.
var ErrStorageUnavailable = errors.New("storage unavailable")

// DocumentService - содержимое досок и шаблонов: комнаты, хранилище, копирование.
type DocumentService struct {
	pool  *pgxpool.Pool
	Store storage.ObjectStore
	Hub   *doc.Hub
}

// Resolve проверяет, что документ существует и не удалён, и говорит, можно ли его править.
// Доска: boardAccess (deny -> ErrForbidden, view -> только чтение). Шаблон: canEditTemplate.
func (s *DocumentService) Resolve(ctx context.Context, id Identity, kind doc.Kind, docID uuid.UUID) (bool, error) {
	switch kind {
	case doc.KindBoard:
		board, err := repository.NewBoardRepo(s.pool).GetByID(ctx, docID)
		if err != nil {
			return false, mapNotFound(err)
		}
		access, err := boardAccess(ctx, s.pool, *board, id)
		if err != nil {
			return false, err
		}
		if access == model.BoardAccessDeny {
			return false, ErrForbidden
		}
		return access == model.BoardAccessEdit, nil
	case doc.KindTemplate:
		t, err := repository.NewTemplateRepo(s.pool).GetByID(ctx, docID)
		if err != nil {
			return false, mapNotFound(err)
		}
		return canEditTemplate(*t, id), nil
	}
	return false, ErrNotFound
}

// Copy: сброс живой комнаты источника, серверное копирование объектов, переписывание ссылок на медиа;
// при ошибке хранилища частичная копия удаляется.
func (s *DocumentService) Copy(ctx context.Context, srcKind doc.Kind, srcID uuid.UUID, dstKind doc.Kind, dstID uuid.UUID) error {
	if err := s.Hub.Flush(ctx, srcKind, srcID); err != nil {
		return fmt.Errorf("%w: flush source: %v", ErrStorageUnavailable, err)
	}
	src, dst := doc.Prefix(srcKind, srcID), doc.Prefix(dstKind, dstID)
	if err := s.copyPrefix(ctx, srcKind, srcID, dstKind, dstID); err != nil {
		cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Second)
		defer cancel()
		if derr := storage.DeletePrefix(cleanupCtx, s.Store, dst); derr != nil {
			log.Printf("doc: cleanup %s after failed copy: %v", dst, derr)
		}
		return fmt.Errorf("%w: copy %s -> %s: %v", ErrStorageUnavailable, src, dst, err)
	}
	return nil
}

func (s *DocumentService) copyPrefix(ctx context.Context, srcKind doc.Kind, srcID uuid.UUID, dstKind doc.Kind, dstID uuid.UUID) error {
	src, dst := doc.Prefix(srcKind, srcID), doc.Prefix(dstKind, dstID)
	keys, err := s.Store.List(ctx, src)
	if err != nil {
		return err
	}
	srcDoc := doc.DocumentKey(srcKind, srcID)
	for _, key := range keys {
		if key == srcDoc {
			continue
		}
		if err := s.Store.Copy(ctx, key, dst+strings.TrimPrefix(key, src)); err != nil {
			return err
		}
	}
	rc, _, err := s.Store.Get(ctx, srcDoc)
	if errors.Is(err, storage.ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	defer rc.Close()
	body, err := io.ReadAll(rc)
	if err != nil {
		return err
	}
	// Ссылка несёт префикс владельца, строка с UUID уникальна: разбирать JSON не нужно.
	body = bytes.ReplaceAll(body, []byte("asset:"+src), []byte("asset:"+dst))
	return s.Store.Put(ctx, doc.DocumentKey(dstKind, dstID), bytes.NewReader(body), int64(len(body)), "application/json")
}

// PurgeDeleted вычищает документы, удалённые раньше retention, и помечает purged_at; сбой одного не останавливает остальные.
func (s *DocumentService) PurgeDeleted(ctx context.Context, retention time.Duration) (int, error) {
	before := time.Now().Add(-retention)
	purged := 0
	var firstErr error
	purge := func(kind doc.Kind, ids []uuid.UUID, mark func(context.Context, uuid.UUID) error) {
		for _, id := range ids {
			if err := storage.DeletePrefix(ctx, s.Store, doc.Prefix(kind, id)); err != nil {
				log.Printf("purge %s %s: %v", kind, id, err)
				if firstErr == nil {
					firstErr = err
				}
				continue
			}
			if err := mark(ctx, id); err != nil {
				log.Printf("purge mark %s %s: %v", kind, id, err)
				if firstErr == nil {
					firstErr = err
				}
				continue
			}
			purged++
		}
	}
	boards := repository.NewBoardRepo(s.pool)
	ids, err := boards.ListPurgeable(ctx, before, purgeBatch)
	if err != nil {
		return 0, err
	}
	purge(doc.KindBoard, ids, boards.MarkPurged)
	templates := repository.NewTemplateRepo(s.pool)
	ids, err = templates.ListPurgeable(ctx, before, purgeBatch)
	if err != nil {
		return purged, err
	}
	purge(doc.KindTemplate, ids, templates.MarkPurged)
	return purged, firstErr
}

// RunPurge гоняет PurgeDeleted сразу и затем раз в interval, до отмены ctx.
func (s *DocumentService) RunPurge(ctx context.Context, interval, retention time.Duration) {
	run := func() {
		runCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
		defer cancel()
		if n, err := s.PurgeDeleted(runCtx, retention); err != nil {
			log.Printf("purge: %d purged, error: %v", n, err)
		} else if n > 0 {
			log.Printf("purge: %d documents purged", n)
		}
	}
	run()
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			run()
		}
	}
}

// purgeBatch - сколько документов одного вида вычищается за проход.
const purgeBatch = 200

// touchUpdated: updated_at документа отражает правки содержимого. Зовётся хабом после записи снапшота.
func (s *DocumentService) touchUpdated(kind doc.Kind, id uuid.UUID) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	table := "board"
	if kind == doc.KindTemplate {
		table = "template"
	}
	if _, err := s.pool.Exec(ctx, fmt.Sprintf("UPDATE %s SET updated_at = now() WHERE id = $1", table), id); err != nil {
		log.Printf("doc: touch %s %s: %v", table, id, err)
	}
}

func mapNotFound(err error) error {
	if errors.Is(err, repository.ErrNotFound) {
		return ErrNotFound
	}
	return err
}
