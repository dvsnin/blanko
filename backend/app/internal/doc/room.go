package doc

import (
	"encoding/json"
	"sync"
	"sync/atomic"

	"github.com/google/uuid"
)

// Room - один открытый документ в памяти.
type Room struct {
	kind Kind
	id   uuid.UUID

	mu      sync.RWMutex
	schema  json.RawMessage
	records map[string]json.RawMessage
	// touched: комната менялась после загрузки, при остановке её нужно сохранить.
	touched bool
	clients map[Client]struct{}
	// presence: последний курсор каждого клиента - только ретрансляция, в records не попадает.
	presence map[Client]presenceEntry

	dirty atomic.Bool
	// flushMu сериализует сброс: тикер, Leave, Flush и Shutdown не должны класть снапшоты вперемешку.
	flushMu sync.Mutex

	// loading закрывается, когда документ загружен (или загрузка провалилась: loadErr).
	loading chan struct{}
	loadErr error
}

type presenceEntry struct {
	id  string
	msg []byte // готовое к отправке {"type":"presence","record":...}
}

func newRoom(kind Kind, id uuid.UUID, d *Document) *Room {
	r := &Room{kind: kind, id: id, records: map[string]json.RawMessage{}, clients: map[Client]struct{}{}, presence: map[Client]presenceEntry{}}
	if d != nil {
		r.schema = d.Schema
		for k, v := range d.Store {
			r.records[k] = v
		}
	}
	return r
}

// Apply накладывает дифф, пересылает его остальным клиентам и подтверждает отправителю.
// Всё под r.mu и без таймеров: порядок сообщений у клиента равен порядку применения на сервере.
func (r *Room) Apply(schema json.RawMessage, p Patch, from Client, ack []byte) {
	msg, _ := json.Marshal(PatchMessage{Type: "patch", Put: p.Put, Remove: p.Remove})

	r.mu.Lock()
	if len(schema) > 0 && string(schema) != "null" {
		r.schema = schema
	}
	for id, rec := range p.Put {
		r.records[id] = rec
	}
	for _, id := range p.Remove {
		delete(r.records, id)
	}
	r.touched = true
	var slow []Client
	for _, c := range r.otherClients(from) {
		if !c.Send(msg) {
			slow = append(slow, c)
		}
	}
	if from != nil && ack != nil {
		from.Send(ack)
	}
	r.mu.Unlock()
	r.dirty.Store(true)

	for _, c := range slow {
		c.Close(1008, "slow consumer")
	}
}

// Presence запоминает курсор клиента и пересылает его остальным. Как и в Apply,
// отправка идёт под r.mu, чтобы порядок у получателей совпадал с порядком приёма.
func (r *Room) Presence(from Client, id string, record json.RawMessage) {
	msg, err := json.Marshal(PresenceMessage{Type: "presence", Record: record})
	if err != nil {
		return
	}
	r.mu.Lock()
	r.presence[from] = presenceEntry{id: id, msg: msg}
	var slow []Client
	for _, c := range r.otherClients(from) {
		if !c.Send(msg) {
			slow = append(slow, c)
		}
	}
	r.mu.Unlock()
	for _, c := range slow {
		c.Close(1008, "slow consumer")
	}
}

// PresenceBacklog - курсоры уже сидящих в комнате; отдаётся новому клиенту после init.
func (r *Room) PresenceBacklog(exclude Client) [][]byte {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([][]byte, 0, len(r.presence))
	for c, p := range r.presence {
		if c != exclude {
			out = append(out, p.msg)
		}
	}
	return out
}

// otherClients зовётся под r.mu.
func (r *Room) otherClients(from Client) []Client {
	out := make([]Client, 0, len(r.clients))
	for c := range r.clients {
		if c != from {
			out = append(out, c)
		}
	}
	return out
}

// Snapshot - копия документа; nil, если в комнате ничего нет.
func (r *Room) Snapshot() *Document {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if len(r.records) == 0 && len(r.schema) == 0 {
		return nil
	}
	d := &Document{Schema: r.schema, Store: make(map[string]json.RawMessage, len(r.records))}
	for k, v := range r.records {
		d.Store[k] = v
	}
	return d
}

func (r *Room) addClient(c Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clients[c] = struct{}{}
}

// removeClient возвращает число оставшихся клиентов; если у ушедшего был курсор,
// остальным рассылается presence_gone.
func (r *Room) removeClient(c Client) int {
	r.mu.Lock()
	delete(r.clients, c)
	n := len(r.clients)
	var gone []byte
	var rest []Client
	if p, ok := r.presence[c]; ok {
		delete(r.presence, c)
		if n > 0 {
			gone, _ = json.Marshal(PresenceGoneMessage{Type: "presence_gone", ID: p.id})
			rest = r.otherClients(nil)
		}
	}
	var slow []Client
	for _, cl := range rest {
		if !cl.Send(gone) {
			slow = append(slow, cl)
		}
	}
	r.mu.Unlock()
	for _, cl := range slow {
		cl.Close(1008, "slow consumer")
	}
	return n
}

func (r *Room) clientCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.clients)
}

func (r *Room) isTouched() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.touched
}

func (r *Room) closeClients(code int, reason string) {
	r.mu.RLock()
	clients := r.otherClients(nil)
	r.mu.RUnlock()
	for _, c := range clients {
		c.Close(code, reason)
	}
}
