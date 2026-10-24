package handler

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"

	"github.com/dvsnin/blanko/backend/app/internal/doc"
	"github.com/dvsnin/blanko/backend/app/internal/service"
)

// Вебсокет документа: GET /app/ws/{kind}/{id}. Протокол в спеке
// docs/superpowers/specs/2026-10-24-board-storage-ws-design.md, раздел «Вебсокет».

const (
	wsReadLimit  = 16 << 20
	wsPingPeriod = 15 * time.Second
	wsReadWait   = 60 * time.Second
	wsWriteWait  = 10 * time.Second
	wsSendQueue  = 256

	closeServerShutdown = 1001
	closeSlowConsumer   = 1008
	closeNotFound       = 4404
)

type wsIn struct {
	Type   string                     `json:"type"`
	Seq    int64                      `json:"seq"`
	Schema json.RawMessage            `json:"schema"`
	Put    map[string]json.RawMessage `json:"put"`
	Remove []string                   `json:"remove"`
	Record json.RawMessage            `json:"record"`
}

// validRecords: сервер не знает схему tldraw, но ключ обязан совпадать с id записи,
// а у записи должен быть typeName, иначе документ со временем превратится в мусор.
func validRecords(put map[string]json.RawMessage) bool {
	for key, raw := range put {
		var rec struct {
			ID       string `json:"id"`
			TypeName string `json:"typeName"`
		}
		if err := json.Unmarshal(raw, &rec); err != nil || rec.ID != key || rec.TypeName == "" {
			return false
		}
	}
	return true
}

// presenceID достаёт id presence-записи; остальное содержимое сервер не разбирает.
func presenceID(record json.RawMessage) (string, bool) {
	var rec struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(record, &rec); err != nil || !strings.HasPrefix(rec.ID, "instance_presence:") {
		return "", false
	}
	return rec.ID, true
}

type wsInit struct {
	Type     string        `json:"type"`
	CanEdit  bool          `json:"canEdit"`
	Document *doc.Document `json:"document"`
}

type wsAck struct {
	Type string `json:"type"`
	Seq  int64  `json:"seq"`
}

type wsErr struct {
	Type string `json:"type"`
	Code string `json:"code"`
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:     originMatchesHost,
}

// originMatchesHost: без Origin (не браузер) или с тем же хостом, что и запрос.
func originMatchesHost(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	return strings.EqualFold(u.Host, r.Host)
}

// wsClient - одно соединение: своя очередь и единственная горутина-писатель.
type wsClient struct {
	conn      *websocket.Conn
	send      chan []byte
	done      chan struct{}
	closeOnce sync.Once
}

func newWSClient(conn *websocket.Conn) *wsClient {
	c := &wsClient{conn: conn, send: make(chan []byte, wsSendQueue), done: make(chan struct{})}
	go c.writeLoop()
	return c
}

func (c *wsClient) writeLoop() {
	ping := time.NewTicker(wsPingPeriod)
	defer ping.Stop()
	for {
		select {
		case msg := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(wsWriteWait))
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				c.Close(websocket.CloseAbnormalClosure, "write failed")
				return
			}
		case <-ping.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(wsWriteWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				c.Close(websocket.CloseAbnormalClosure, "ping failed")
				return
			}
		case <-c.done:
			return
		}
	}
}

// Send неблокирующий: полная очередь значит медленный клиент.
func (c *wsClient) Send(msg []byte) bool {
	select {
	case c.send <- msg:
		return true
	case <-c.done:
		return false
	default:
		return false
	}
}

func (c *wsClient) sendJSON(v any) {
	msg, err := json.Marshal(v)
	if err != nil {
		return
	}
	if !c.Send(msg) {
		c.Close(closeSlowConsumer, "slow consumer")
	}
}

// Close шлёт close-фрейм и рвёт соединение; повторные вызовы игнорируются.
// Фрейм уходит в отдельной горутине: вызывающий (чужая горутина чтения, Shutdown) не ждёт сеть.
func (c *wsClient) Close(code int, reason string) {
	c.closeOnce.Do(func() {
		close(c.done)
		go func() {
			_ = c.conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(code, reason), time.Now().Add(time.Second))
			_ = c.conn.Close()
		}()
	})
}

// DocWS GET /app/ws/{kind}/{id}
func (a *API) DocWS(w http.ResponseWriter, r *http.Request) {
	kind, ok := doc.ParseKind(mux.Vars(r)["kind"])
	if !ok {
		http.NotFound(w, r)
		return
	}
	docID, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		http.NotFound(w, r)
		return
	}
	id, ok := identityFrom(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "")
		return
	}
	hub := a.services.Document.Hub
	if hub.Closing() {
		writeError(w, http.StatusServiceUnavailable, "shutting_down", "server is shutting down")
		return
	}
	canEdit, resolveErr := a.services.Document.Resolve(r.Context(), id, kind, docID)
	if resolveErr != nil && !errors.Is(resolveErr, service.ErrNotFound) {
		writeServiceError(w, resolveErr)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	client := newWSClient(conn)
	defer client.Close(websocket.CloseNormalClosure, "")
	if resolveErr != nil {
		client.Close(closeNotFound, "document not found")
		return
	}

	done, ok := hub.Track()
	if !ok {
		client.Close(closeServerShutdown, "server shutting down")
		return
	}
	defer done()
	ctx := r.Context()
	room, err := hub.Join(ctx, kind, docID, client)
	if err != nil {
		log.Printf("ws: join %s/%s: %v", kind, docID, err)
		client.Close(websocket.CloseInternalServerErr, "cannot load document")
		return
	}
	defer hub.Leave(ctx, kind, docID, client)

	client.sendJSON(wsInit{Type: "init", CanEdit: canEdit, Document: room.Snapshot()})
	for _, msg := range room.PresenceBacklog(client) {
		if !client.Send(msg) {
			break
		}
	}

	conn.SetReadLimit(wsReadLimit)
	_ = conn.SetReadDeadline(time.Now().Add(wsReadWait))
	conn.SetPongHandler(func(string) error { return conn.SetReadDeadline(time.Now().Add(wsReadWait)) })

	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			return
		}
		_ = conn.SetReadDeadline(time.Now().Add(wsReadWait))
		var in wsIn
		if err := json.Unmarshal(data, &in); err != nil || (in.Type != "push" && in.Type != "presence") {
			client.sendJSON(wsErr{Type: "error", Code: "bad_message"})
			continue
		}
		// Presence доступен и read-only клиентам: зрители тоже показывают курсор.
		if in.Type == "presence" {
			id, ok := presenceID(in.Record)
			if !ok {
				client.sendJSON(wsErr{Type: "error", Code: "bad_message"})
				continue
			}
			room.Presence(client, id, in.Record)
			continue
		}
		if !canEdit {
			client.sendJSON(wsErr{Type: "error", Code: "read_only"})
			continue
		}
		if !validRecords(in.Put) {
			client.sendJSON(wsErr{Type: "error", Code: "bad_message"})
			continue
		}
		ack, _ := json.Marshal(wsAck{Type: "ack", Seq: in.Seq})
		room.Apply(in.Schema, doc.Patch{Put: in.Put, Remove: in.Remove}, client, ack)
	}
}
