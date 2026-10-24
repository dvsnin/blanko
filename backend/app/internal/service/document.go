package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dvsnin/blanko/backend/app/internal/doc"
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
// Доска: любой вошедший (ACL досок пока нет). Шаблон: canEditTemplate.
func (s *DocumentService) Resolve(ctx context.Context, id Identity, kind doc.Kind, docID uuid.UUID) (bool, error) {
	switch kind {
	case doc.KindBoard:
		if _, err := repository.NewBoardRepo(s.pool).GetByID(ctx, docID); err != nil {
			return false, mapNotFound(err)
		}
		return true, nil
	case doc.KindTemplate:
		t, err := repository.NewTemplateRepo(s.pool).GetByID(ctx, docID)
		if err != nil {
			return false, mapNotFound(err)
		}
		return canEditTemplate(*t, id), nil
	}
	return false, ErrNotFound
}

// Copy переносит содержимое документа под новый префикс: сначала сброс живой комнаты
// источника, затем серверное копирование объектов и переписывание ссылок на медиа
// в document.json. Ошибка хранилища - ErrStorageUnavailable, частичная копия удаляется.
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

// HasPreviews проверяет наличие снимков у набора документов параллельно (до 8 запросов разом).
// Ошибка хранилища считается отсутствием снимка: карточка покажет цветную плитку.
func (s *DocumentService) HasPreviews(ctx context.Context, kind doc.Kind, ids []uuid.UUID) []bool {
	out := make([]bool, len(ids))
	sem := make(chan struct{}, 8)
	var wg sync.WaitGroup
	for i, id := range ids {
		wg.Add(1)
		sem <- struct{}{}
		go func(i int, id uuid.UUID) {
			defer wg.Done()
			defer func() { <-sem }()
			ok, err := s.Store.Exists(ctx, doc.PreviewKey(kind, id))
			if err != nil {
				log.Printf("doc: preview exists %s/%s: %v", kind, id, err)
			}
			out[i] = ok
		}(i, id)
	}
	wg.Wait()
	return out
}

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
