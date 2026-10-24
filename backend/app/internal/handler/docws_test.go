package handler_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/dvsnin/blanko/backend/app/internal/doc"
	"github.com/dvsnin/blanko/backend/app/internal/repository"
)

func TestDocWS(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	e.account("other@example.com")
	team := e.team(owner)
	key := func(id uuid.UUID) string { return doc.DocumentKey(doc.KindBoard, id) }

	t.Run("init empty", func(t *testing.T) {
		b := e.board(team, owner, "Пустая")
		_, init := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		if init["type"] != "init" || init["canEdit"] != true || init["document"] != nil {
			t.Fatalf("init = %v", init)
		}
	})

	t.Run("push then flush", func(t *testing.T) {
		b := e.board(team, owner, "Рисунок")
		before := e.updatedAt("board", b.ID)
		c, _ := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		writeMsg(t, c, pushMsg(1, map[string]any{"shape:a": shape("shape:a")}, nil))
		ack := readMsg(t, c, time.Second)
		if ack["type"] != "ack" || ack["seq"] != float64(1) {
			t.Fatalf("ack = %v", ack)
		}
		eventually(t, 2*time.Second, func() bool { return strings.Contains(string(e.store.Bytes(key(b.ID))), `"shape:a"`) })
		eventually(t, 2*time.Second, func() bool { return e.updatedAt("board", b.ID).After(before) })
	})

	t.Run("remove", func(t *testing.T) {
		b := e.board(team, owner, "Удаление")
		c, _ := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		writeMsg(t, c, pushMsg(1, map[string]any{"shape:a": shape("shape:a"), "shape:b": shape("shape:b")}, nil))
		readMsg(t, c, time.Second)
		writeMsg(t, c, pushMsg(2, nil, []string{"shape:a"}))
		readMsg(t, c, time.Second)
		eventually(t, 2*time.Second, func() bool {
			body := string(e.store.Bytes(key(b.ID)))
			return strings.Contains(body, `"shape:b"`) && !strings.Contains(body, `"shape:a"`)
		})
	})

	t.Run("second client gets patch immediately", func(t *testing.T) {
		b := e.board(team, owner, "Две вкладки")
		a, _ := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		other, _ := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		writeMsg(t, a, pushMsg(1, map[string]any{"shape:b": shape("shape:b")}, []string{"shape:x"}))
		patch := readMsg(t, other, 200*time.Millisecond)
		put, _ := patch["put"].(map[string]any)
		if patch["type"] != "patch" || put["shape:b"] == nil {
			t.Fatalf("patch = %v", patch)
		}
		if ack := readMsg(t, a, time.Second); ack["type"] != "ack" {
			t.Fatalf("ack = %v", ack)
		}
	})

	t.Run("reconnect sees other's edits", func(t *testing.T) {
		b := e.board(team, owner, "Реконнект")
		a, _ := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		other, _ := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		a.Close()
		writeMsg(t, other, pushMsg(1, map[string]any{"shape:c": shape("shape:c")}, nil))
		readMsg(t, other, time.Second)
		_, init := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		docm, _ := init["document"].(map[string]any)
		store, _ := docm["store"].(map[string]any)
		if store["shape:c"] == nil {
			t.Fatalf("init after reconnect = %v", init)
		}
	})

	t.Run("read only template push rejected", func(t *testing.T) {
		tpl := e.template(&owner, "Чужой шаблон")
		c, init := e.mustDial("other@example.com", doc.KindTemplate, tpl.ID)
		if init["canEdit"] != false {
			t.Fatalf("init = %v", init)
		}
		writeMsg(t, c, pushMsg(1, map[string]any{"shape:a": shape("shape:a")}, nil))
		if msg := readMsg(t, c, time.Second); msg["type"] != "error" || msg["code"] != "read_only" {
			t.Fatalf("msg = %v", msg)
		}
		time.Sleep(150 * time.Millisecond)
		if e.store.Bytes(doc.DocumentKey(doc.KindTemplate, tpl.ID)) != nil {
			t.Fatal("object created from read-only push")
		}
	})

	t.Run("bad message", func(t *testing.T) {
		b := e.board(team, owner, "Мусор")
		c, _ := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		if err := c.WriteMessage(1, []byte("not json")); err != nil {
			t.Fatal(err)
		}
		if msg := readMsg(t, c, time.Second); msg["type"] != "error" || msg["code"] != "bad_message" {
			t.Fatalf("msg = %v", msg)
		}
		writeMsg(t, c, pushMsg(1, map[string]any{"shape:a": shape("shape:a")}, nil))
		if ack := readMsg(t, c, time.Second); ack["type"] != "ack" {
			t.Fatalf("connection dead after bad message: %v", ack)
		}
	})

	t.Run("store down keeps dirty", func(t *testing.T) {
		b := e.board(team, owner, "Без хранилища")
		c, _ := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		e.store.FailPuts.Store(true)
		writeMsg(t, c, pushMsg(1, map[string]any{"shape:a": shape("shape:a")}, nil))
		if ack := readMsg(t, c, time.Second); ack["type"] != "ack" {
			t.Fatalf("ack = %v", ack)
		}
		time.Sleep(200 * time.Millisecond)
		if e.store.Bytes(key(b.ID)) != nil {
			t.Fatal("object written while store down")
		}
		e.store.FailPuts.Store(false)
		eventually(t, 2*time.Second, func() bool { return e.store.Bytes(key(b.ID)) != nil })
	})

	t.Run("last leave flushes", func(t *testing.T) {
		b := e.board(team, owner, "Уход")
		c, _ := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		writeMsg(t, c, pushMsg(1, map[string]any{"shape:a": shape("shape:a")}, nil))
		readMsg(t, c, time.Second)
		c.Close()
		eventually(t, 2*time.Second, func() bool { return e.store.Bytes(key(b.ID)) != nil })
	})

	t.Run("slow flush does not overwrite newer state", func(t *testing.T) {
		b := e.board(team, owner, "Гонка сброса")
		c, _ := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		writeMsg(t, c, pushMsg(1, map[string]any{"shape:a": shape("shape:a")}, nil))
		readMsg(t, c, time.Second)
		e.store.SlowNextPut.Store(int64(300 * time.Millisecond)) // тикер возьмёт снапшот без shape:b и зависнет в Put
		time.Sleep(100 * time.Millisecond)
		writeMsg(t, c, pushMsg(2, map[string]any{"shape:b": shape("shape:b")}, nil))
		readMsg(t, c, time.Second)
		c.Close() // Leave сбрасывает комнату: это должно лечь в хранилище последним
		time.Sleep(700 * time.Millisecond)
		if body := string(e.store.Bytes(key(b.ID))); !strings.Contains(body, `"shape:b"`) {
			t.Fatalf("stale snapshot won: %s", body)
		}
	})

	t.Run("deleted board", func(t *testing.T) {
		b := e.board(team, owner, "Удалённая")
		if err := repository.NewBoardRepo(e.pool).SoftDelete(e.ctx, b.ID); err != nil {
			t.Fatal(err)
		}
		c, _, err := e.dial("owner@example.com", doc.KindBoard, b.ID)
		if err != nil {
			t.Fatalf("dial: %v", err)
		}
		defer c.Close()
		if code := readClose(t, c, time.Second); code != 4404 {
			t.Fatalf("close code = %d, want 4404", code)
		}
	})

	t.Run("delete while connected", func(t *testing.T) {
		b := e.board(team, owner, "Удаляем на лету")
		c, _ := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		if status, body := e.post("owner@example.com", "/board/delete", map[string]any{"id": b.ID.String()}); status != 204 {
			t.Fatalf("delete: %d %v", status, body)
		}
		if code := readClose(t, c, time.Second); code != 4404 {
			t.Fatalf("close code = %d, want 4404", code)
		}
	})

	t.Run("unknown kind", func(t *testing.T) {
		_, resp, err := e.dial("owner@example.com", doc.Kind("foo"), uuid.New())
		if err == nil || resp == nil || resp.StatusCode != 404 {
			t.Fatalf("err = %v, resp = %v", err, resp)
		}
	})

	t.Run("presence relayed to others and not persisted", func(t *testing.T) {
		b := e.board(team, owner, "Курсоры")
		a, _ := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		other, _ := e.mustDial("owner@example.com", doc.KindBoard, b.ID)

		writeMsg(t, a, presenceMsg("instance_presence:a", "Анна"))
		msg := readMsg(t, other, time.Second)
		rec, _ := msg["record"].(map[string]any)
		if msg["type"] != "presence" || rec["id"] != "instance_presence:a" || rec["userName"] != "Анна" {
			t.Fatalf("presence = %v", msg)
		}

		// Отправителю эхо не приходит: очередь упорядочена, после push первым придёт ack.
		writeMsg(t, a, pushMsg(1, map[string]any{"shape:a": shape("shape:a")}, nil))
		if ack := readMsg(t, a, time.Second); ack["type"] != "ack" {
			t.Fatalf("expected ack, got echo: %v", ack)
		}
		readMsg(t, other, time.Second) // patch с shape:a

		// Presence не попадает в снапшот.
		eventually(t, 2*time.Second, func() bool { return strings.Contains(string(e.store.Bytes(key(b.ID))), `"shape:a"`) })
		if body := string(e.store.Bytes(key(b.ID))); strings.Contains(body, "instance_presence") {
			t.Fatalf("presence persisted: %s", body)
		}
	})

	t.Run("late joiner receives presence backlog", func(t *testing.T) {
		b := e.board(team, owner, "Опоздавший")
		a, _ := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		writeMsg(t, a, presenceMsg("instance_presence:a", "Анна"))
		time.Sleep(50 * time.Millisecond) // presence долетел до комнаты

		late, _ := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		msg := readMsg(t, late, time.Second)
		rec, _ := msg["record"].(map[string]any)
		if msg["type"] != "presence" || rec["id"] != "instance_presence:a" {
			t.Fatalf("backlog = %v", msg)
		}
	})

	t.Run("presence gone on disconnect", func(t *testing.T) {
		b := e.board(team, owner, "Ушёл")
		a, _ := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		other, _ := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		writeMsg(t, a, presenceMsg("instance_presence:a", "Анна"))
		readMsg(t, other, time.Second)
		a.Close()
		msg := readMsg(t, other, time.Second)
		if msg["type"] != "presence_gone" || msg["id"] != "instance_presence:a" {
			t.Fatalf("gone = %v", msg)
		}
	})

	t.Run("read-only client may send presence", func(t *testing.T) {
		tpl := e.template(&owner, "Шаблон с курсорами")
		viewer, init := e.mustDial("other@example.com", doc.KindTemplate, tpl.ID)
		if init["canEdit"] != false {
			t.Fatalf("init = %v", init)
		}
		author, _ := e.mustDial("owner@example.com", doc.KindTemplate, tpl.ID)
		writeMsg(t, viewer, presenceMsg("instance_presence:v", "Зритель"))
		msg := readMsg(t, author, time.Second)
		if msg["type"] != "presence" {
			t.Fatalf("presence from viewer = %v", msg)
		}
	})

	t.Run("presence without id rejected", func(t *testing.T) {
		b := e.board(team, owner, "Кривой presence")
		c, _ := e.mustDial("owner@example.com", doc.KindBoard, b.ID)
		writeMsg(t, c, map[string]any{"type": "presence", "record": map[string]any{"userName": "x"}})
		if msg := readMsg(t, c, time.Second); msg["type"] != "error" || msg["code"] != "bad_message" {
			t.Fatalf("msg = %v", msg)
		}
	})

	t.Run("shutdown flushes with expired context", func(t *testing.T) {
		// Ожидание хендлеров съело весь бюджет: сброс всё равно должен пройти со своим таймаутом.
		e2 := newEnv(t)
		o := e2.account("owner@example.com")
		b := e2.board(e2.team(o), o, "Поздняя остановка")
		c, _ := e2.mustDial("owner@example.com", doc.KindBoard, b.ID)
		e2.store.FailPuts.Store(true)
		writeMsg(t, c, pushMsg(1, map[string]any{"shape:a": shape("shape:a")}, nil))
		readMsg(t, c, time.Second)
		e2.store.FailPuts.Store(false)
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		if err := e2.hub.Shutdown(ctx); err != nil {
			t.Fatalf("shutdown: %v", err)
		}
		if e2.store.Bytes(key(b.ID)) == nil {
			t.Fatal("object not flushed when ctx already expired")
		}
	})

	t.Run("empty room evicted after store recovers", func(t *testing.T) {
		e2 := newEnv(t)
		o := e2.account("owner@example.com")
		b := e2.board(e2.team(o), o, "Зависшая комната")
		c, _ := e2.mustDial("owner@example.com", doc.KindBoard, b.ID)
		e2.store.FailPuts.Store(true)
		writeMsg(t, c, pushMsg(1, map[string]any{"shape:a": shape("shape:a")}, nil))
		readMsg(t, c, time.Second)
		c.Close() // Leave: сброс падает, комната остаётся с dirty
		time.Sleep(100 * time.Millisecond)
		if e2.hub.Len() != 1 {
			t.Fatalf("rooms = %d, want 1 while store is down", e2.hub.Len())
		}
		e2.store.FailPuts.Store(false)
		eventually(t, 2*time.Second, func() bool { return e2.store.Bytes(key(b.ID)) != nil && e2.hub.Len() == 0 })
	})

	t.Run("shutdown flushes", func(t *testing.T) {
		e2 := newEnv(t)
		o := e2.account("owner@example.com")
		b := e2.board(e2.team(o), o, "Остановка")
		c, _ := e2.mustDial("owner@example.com", doc.KindBoard, b.ID)
		e2.store.FailPuts.Store(true) // тикер не успеет записать сам
		writeMsg(t, c, pushMsg(1, map[string]any{"shape:a": shape("shape:a")}, nil))
		readMsg(t, c, time.Second)
		e2.store.FailPuts.Store(false)
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if err := e2.hub.Shutdown(ctx); err != nil {
			t.Fatalf("shutdown: %v", err)
		}
		if e2.store.Bytes(key(b.ID)) == nil {
			t.Fatal("object not flushed on shutdown")
		}
		if code := readClose(t, c, time.Second); code != 1001 {
			t.Fatalf("close code = %d, want 1001", code)
		}
	})
}
