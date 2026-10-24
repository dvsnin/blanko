// Package storage - объектное хранилище для содержимого досок и медиа.
// Реализации: S3-совместимое (RustFS в compose) и память для тестов.
package storage

import (
	"context"
	"errors"
	"io"
)

// ErrNotFound - объекта с таким ключом нет.
var ErrNotFound = errors.New("object not found")

// ObjectInfo - метаданные объекта.
type ObjectInfo struct {
	Size        int64
	ContentType string
}

// ObjectStore - минимальный набор операций, который нужен приложению.
type ObjectStore interface {
	Put(ctx context.Context, key string, body io.Reader, size int64, contentType string) error
	Get(ctx context.Context, key string) (io.ReadCloser, ObjectInfo, error)
	List(ctx context.Context, prefix string) ([]string, error)
	// Copy - серверное копирование, без скачивания.
	Copy(ctx context.Context, src, dst string) error
	Delete(ctx context.Context, keys ...string) error
}
