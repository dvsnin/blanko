package doc

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/dvsnin/blanko/backend/app/internal/storage"
)

// ErrClosing - сервер останавливается, новые подключения не принимаются.
var ErrClosing = errors.New("hub is shutting down")

// Hub - все открытые комнаты процесса.
type Hub struct {
	// OnFlushed зовётся после успешной записи снапшота (сервис обновляет updated_at).
	OnFlushed func(kind Kind, id uuid.UUID)

	store    storage.ObjectStore
	interval time.Duration

	mu    sync.Mutex
	rooms map[string]*Room
	// closing ставится и читается под mu вместе с handlers.Add: после Shutdown ни одна
	// комната не создаётся и ни один хендлер не регистрируется.
	closing bool
	// handlers: живые ws-хендлеры, Shutdown их дожидается.
	handlers sync.WaitGroup
}

func NewHub(store storage.ObjectStore, interval time.Duration) *Hub {
	return &Hub{store: store, interval: interval, rooms: map[string]*Room{}}
}

func roomKey(kind Kind, id uuid.UUID) string { return string(kind) + "/" + id.String() }

// Track регистрирует хендлер; возвращённую функцию зовут при его выходе.
// false - сервер останавливается, хендлер должен сразу выйти.
func (h *Hub) Track() (func(), bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closing {
		return func() {}, false
	}
	h.handlers.Add(1)
	return h.handlers.Done, true
}

func (h *Hub) Closing() bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.closing
}

// Len - число комнат в памяти (для тестов и диагностики).
func (h *Hub) Len() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.rooms)
}

// Join подключает клиента к комнате, при необходимости загружая документ из хранилища.
// Загрузка идёт вне мьютекса хаба: медленное хранилище не блокирует остальные комнаты,
// а параллельные подключения к той же комнате ждут одной общей загрузки.
func (h *Hub) Join(ctx context.Context, kind Kind, id uuid.UUID, c Client) (*Room, error) {
	key := roomKey(kind, id)
	h.mu.Lock()
	if h.closing {
		h.mu.Unlock()
		return nil, ErrClosing
	}
	room, ok := h.rooms[key]
	if !ok {
		room = newRoom(kind, id, nil)
		room.loading = make(chan struct{})
		h.rooms[key] = room
		h.mu.Unlock()

		d, err := h.load(ctx, kind, id)
		room.mu.Lock()
		if err != nil {
			room.loadErr = err
		} else if d != nil {
			room.schema = d.Schema
			for k, v := range d.Store {
				room.records[k] = v
			}
		}
		room.mu.Unlock()
		close(room.loading)
		if err != nil {
			h.mu.Lock()
			if cur, ok := h.rooms[key]; ok && cur == room {
				delete(h.rooms, key)
			}
			h.mu.Unlock()
			return nil, err
		}
	} else {
		h.mu.Unlock()
		select {
		case <-room.loading:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
		room.mu.RLock()
		err := room.loadErr
		room.mu.RUnlock()
		if err != nil {
			return nil, err
		}
	}
	room.addClient(c)
	return room, nil
}

// loadTimeout - предел ожидания документа из хранилища при открытии комнаты.
const loadTimeout = 15 * time.Second

func (h *Hub) load(ctx context.Context, kind Kind, id uuid.UUID) (*Document, error) {
	ctx, cancel := context.WithTimeout(ctx, loadTimeout)
	defer cancel()
	body, _, err := h.store.Get(ctx, DocumentKey(kind, id))
	if errors.Is(err, storage.ErrNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("load %s: %w", DocumentKey(kind, id), err)
	}
	defer body.Close()
	var d Document
	if err := json.NewDecoder(body).Decode(&d); err != nil {
		return nil, fmt.Errorf("decode %s: %w", DocumentKey(kind, id), err)
	}
	return &d, nil
}

// Leave отключает клиента; последний уходящий сбрасывает комнату и выгружает её.
func (h *Hub) Leave(ctx context.Context, kind Kind, id uuid.UUID, c Client) {
	h.mu.Lock()
	room, ok := h.rooms[roomKey(kind, id)]
	h.mu.Unlock()
	if !ok {
		return
	}
	if room.removeClient(c) > 0 {
		return
	}
	if err := h.flushRoom(ctx, room); err != nil {
		// Остаётся в памяти с dirty, подберёт тикер.
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if cur, ok := h.rooms[roomKey(kind, id)]; ok && cur == room && room.clientCount() == 0 {
		delete(h.rooms, roomKey(kind, id))
	}
}

// Flush принудительно сбрасывает комнату (перед копированием документа).
func (h *Hub) Flush(ctx context.Context, kind Kind, id uuid.UUID) error {
	h.mu.Lock()
	room, ok := h.rooms[roomKey(kind, id)]
	h.mu.Unlock()
	if !ok {
		return nil
	}
	return h.flushRoom(ctx, room)
}

// Close выгружает комнату без сохранения и закрывает клиентов (документ удалён).
func (h *Hub) Close(kind Kind, id uuid.UUID) {
	h.mu.Lock()
	room, ok := h.rooms[roomKey(kind, id)]
	delete(h.rooms, roomKey(kind, id))
	h.mu.Unlock()
	if ok {
		room.closeClients(4404, "deleted")
	}
}

// CloseScreens отключает экраны показа комнаты, если она открыта.
func (h *Hub) CloseScreens(kind Kind, id uuid.UUID, code int, reason string) {
	h.mu.Lock()
	room, ok := h.rooms[roomKey(kind, id)]
	h.mu.Unlock()
	if ok {
		room.CloseScreens(code, reason)
	}
}

// Run - тикер записи изменённых комнат, работает до отмены ctx.
func (h *Hub) Run(ctx context.Context) {
	t := time.NewTicker(h.interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			for _, room := range h.snapshotRooms() {
				if err := h.flushRoom(context.WithoutCancel(ctx), room); err == nil {
					h.evictIfIdle(room)
				}
			}
		}
	}
}

// evictIfIdle выгружает комнату без клиентов и без несохранённых правок (например, после
// неудачного сброса в Leave, который позже удался тикером).
func (h *Hub) evictIfIdle(room *Room) {
	h.mu.Lock()
	defer h.mu.Unlock()
	key := roomKey(room.kind, room.id)
	if cur, ok := h.rooms[key]; ok && cur == room && room.clientCount() == 0 && !room.dirty.Load() {
		delete(h.rooms, key)
	}
}

// Shutdown: новые подключения отклоняются, сокеты закрываются, все изменённые комнаты записываются.
// На запись свой бюджет: если ожидание хендлеров съело ctx, снапшоты всё равно уходят.
func (h *Hub) Shutdown(ctx context.Context) error {
	h.mu.Lock()
	h.closing = true
	h.mu.Unlock()
	rooms := h.snapshotRooms()
	for _, room := range rooms {
		room.closeClients(1001, "server shutting down")
	}
	done := make(chan struct{})
	go func() { h.handlers.Wait(); close(done) }()
	select {
	case <-done:
	case <-ctx.Done():
		log.Printf("doc: shutdown: handlers still running: %v", ctx.Err())
	}
	flushCtx := ctx
	if ctx.Err() != nil {
		var cancel context.CancelFunc
		flushCtx, cancel = context.WithTimeout(context.WithoutCancel(ctx), shutdownFlushBudget)
		defer cancel()
	}
	var firstErr error
	for _, room := range rooms {
		if room.isTouched() {
			room.dirty.Store(true)
		}
		if err := h.flushRoom(flushCtx, room); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

// shutdownFlushBudget - запасное время на запись снапшотов, если основной ctx уже истёк.
const shutdownFlushBudget = 5 * time.Second

func (h *Hub) snapshotRooms() []*Room {
	h.mu.Lock()
	defer h.mu.Unlock()
	out := make([]*Room, 0, len(h.rooms))
	for _, r := range h.rooms {
		out = append(out, r)
	}
	return out
}

// flushRoom пишет снапшот, если комната dirty. Ошибка возвращает dirty обратно.
// Под flushMu: снимок и запись одной комнаты не перемешиваются между вызывающими.
func (h *Hub) flushRoom(ctx context.Context, room *Room) error {
	room.flushMu.Lock()
	defer room.flushMu.Unlock()
	if !room.dirty.Swap(false) {
		return nil
	}
	d := room.Snapshot()
	if d == nil {
		return nil
	}
	if len(d.Schema) == 0 {
		d.Schema = json.RawMessage("{}")
	}
	body, err := json.Marshal(d)
	if err != nil {
		room.dirty.Store(true)
		return err
	}
	key := DocumentKey(room.kind, room.id)
	if err := h.store.Put(ctx, key, bytes.NewReader(body), int64(len(body)), "application/json"); err != nil {
		room.dirty.Store(true)
		log.Printf("doc: flush %s: %v", key, err)
		return err
	}
	if h.OnFlushed != nil {
		h.OnFlushed(room.kind, room.id)
	}
	return nil
}
