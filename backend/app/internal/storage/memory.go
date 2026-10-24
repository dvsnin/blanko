package storage

import (
	"bytes"
	"context"
	"errors"
	"io"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ErrPutFailed возвращает Memory, когда тесты включили FailPuts.
var ErrPutFailed = errors.New("storage: put failed (test mode)")

type memObject struct {
	data        []byte
	contentType string
}

// Memory - хранилище в памяти для тестов.
type Memory struct {
	// FailPuts: все записи (Put и Copy) падают с ErrPutFailed.
	FailPuts atomic.Bool
	// SlowNextPut: следующий Put спит указанное время (один раз), имитация медленного хранилища.
	SlowNextPut atomic.Int64

	mu      sync.RWMutex
	objects map[string]memObject
}

func NewMemory() *Memory {
	return &Memory{objects: map[string]memObject{}}
}

func (m *Memory) Put(ctx context.Context, key string, body io.Reader, _ int64, contentType string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if m.FailPuts.Load() {
		return ErrPutFailed
	}
	if d := m.SlowNextPut.Swap(0); d > 0 {
		time.Sleep(time.Duration(d))
	}
	data, err := io.ReadAll(body)
	if err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.objects[key] = memObject{data: data, contentType: contentType}
	return nil
}

func (m *Memory) Get(_ context.Context, key string) (io.ReadCloser, ObjectInfo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	obj, ok := m.objects[key]
	if !ok {
		return nil, ObjectInfo{}, ErrNotFound
	}
	return io.NopCloser(bytes.NewReader(obj.data)), ObjectInfo{Size: int64(len(obj.data)), ContentType: obj.contentType}, nil
}

func (m *Memory) List(_ context.Context, prefix string) ([]string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	keys := []string{}
	for k := range m.objects {
		if strings.HasPrefix(k, prefix) {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	return keys, nil
}

func (m *Memory) Copy(_ context.Context, src, dst string) error {
	if m.FailPuts.Load() {
		return ErrPutFailed
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	obj, ok := m.objects[src]
	if !ok {
		return ErrNotFound
	}
	m.objects[dst] = memObject{data: append([]byte(nil), obj.data...), contentType: obj.contentType}
	return nil
}

func (m *Memory) Delete(_ context.Context, keys ...string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, k := range keys {
		delete(m.objects, k)
	}
	return nil
}

// Bytes - содержимое объекта для утверждений в тестах; nil, если объекта нет.
func (m *Memory) Bytes(key string) []byte {
	m.mu.RLock()
	defer m.mu.RUnlock()
	obj, ok := m.objects[key]
	if !ok {
		return nil
	}
	return append([]byte(nil), obj.data...)
}
