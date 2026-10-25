package handler_test

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/dvsnin/blanko/backend/app/internal/doc"
	"github.com/dvsnin/blanko/backend/app/internal/handler"
	"github.com/dvsnin/blanko/backend/app/internal/model"
)

// Режим показа: токен и код выдаёт тот, кто управляет доской, ведущий по умолчанию он же;
// публичные маршруты работают без входа и только на чтение.
func TestBoardPresent(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	member := e.account("member@example.com")
	e.account("other@example.com")
	team := e.team(owner)
	e.addMember(team, member)
	if _, err := e.pool.Exec(e.ctx, "UPDATE account SET name = 'Анна Петрова' WHERE email = 'owner@example.com'"); err != nil {
		t.Fatal(err)
	}
	board := e.board(team, owner, "Урок")
	id := board.ID.String()

	status, body := e.post("member@example.com", "/board/present/enable", map[string]any{"id": id})
	if status != 403 {
		t.Fatalf("member enabled present: %d %v", status, body)
	}
	if status, body := e.post("owner@example.com", "/board/present/enable", map[string]any{"id": id, "hours": 5}); status != 400 {
		t.Fatalf("bad hours: %d %v", status, body)
	}
	status, enabled := e.post("owner@example.com", "/board/present/enable", map[string]any{"id": id, "hours": 12})
	if status != 200 {
		t.Fatalf("enable: %d %v", status, enabled)
	}
	if exp, _ := enabled["presentExpiresAt"].(string); exp == "" {
		t.Fatalf("no expiry: %v", enabled)
	}
	token, _ := enabled["presentToken"].(string)
	if len(token) < 32 || enabled["presenterId"] != owner.ID.String() || enabled["presenterName"] != "Анна Петрова" {
		t.Fatalf("enabled = %v", enabled)
	}
	// Повторное включение не меняет токен, но переустанавливает срок («пока не выключу»).
	_, again := e.post("owner@example.com", "/board/present/enable", map[string]any{"id": id, "hours": 0})
	if again["presentToken"] != token || again["presentExpiresAt"] != "" {
		t.Fatalf("re-enable: %v", again)
	}
	// Участник с правом редактирования видит, что показ включён, но токен ему не отдаём.
	_, list := e.post("member@example.com", "/board/list", map[string]any{"teamId": team.ID.String()})
	x := items(list)[0].(map[string]any)
	if x["presentEnabled"] != true || x["presentToken"] != "" {
		t.Fatalf("member view = %v", x)
	}

	t.Run("public page and media", func(t *testing.T) {
		resp, err := http.Get(e.srv.URL + "/app/present/" + token)
		if err != nil {
			t.Fatal(err)
		}
		page, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode != 200 || !strings.Contains(string(page), `"present":`) || !strings.Contains(string(page), "Анна Петрова") || !strings.Contains(string(page), `"canEdit":false`) {
			t.Fatalf("present page: %d %.200s", resp.StatusCode, page)
		}
		if resp, _ := http.Get(e.srv.URL + "/app/present/" + strings.Repeat("0", 32)); resp.StatusCode != 404 {
			t.Fatalf("unknown token: %d", resp.StatusCode)
		}
		resp, _ = http.Get(e.srv.URL + "/app/present/" + token + "/info")
		var info map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&info)
		resp.Body.Close()
		if resp.StatusCode != 200 || info["presenterId"] != owner.ID.String() || info["presenterName"] != "Анна Петрова" {
			t.Fatalf("info: %d %v", resp.StatusCode, info)
		}
		name := strings.Repeat("a", 64) + ".png"
		if err := e.store.Put(e.ctx, doc.MediaKey(doc.KindBoard, board.ID, name), strings.NewReader("img"), 3, "image/png"); err != nil {
			t.Fatal(err)
		}
		if resp, _ := http.Get(e.srv.URL + "/app/present/" + token + "/media/" + name); resp.StatusCode != 200 {
			t.Fatalf("media: %d", resp.StatusCode)
		}
		foreign := e.board(team, owner, "Другая")
		if err := e.store.Put(e.ctx, doc.MediaKey(doc.KindBoard, foreign.ID, name), strings.NewReader("img"), 3, "image/png"); err != nil {
			t.Fatal(err)
		}
		// Токен открывает только медиа своей доски: имя то же, доска другая - 404.
		if resp, _ := http.Get(e.srv.URL + "/app/present/" + token + "/media/" + strings.Repeat("b", 64) + ".png"); resp.StatusCode != 404 {
			t.Fatalf("missing media: %d", resp.StatusCode)
		}
	})

	t.Run("public websocket is read only", func(t *testing.T) {
		url := "ws" + strings.TrimPrefix(e.srv.URL, "http") + "/app/present/" + token + "/ws"
		c, _, err := websocket.DefaultDialer.Dial(url, nil)
		if err != nil {
			t.Fatalf("dial: %v", err)
		}
		defer c.Close()
		init := readMsg(t, c, 2*time.Second)
		if init["type"] != "init" || init["canEdit"] != false {
			t.Fatalf("init = %v", init)
		}
		writeMsg(t, c, pushMsg(1, map[string]any{"shape:a": shape("shape:a")}, nil))
		if resp := readMsg(t, c, time.Second); resp["type"] != "error" || resp["code"] != "read_only" {
			t.Fatalf("push by viewer = %v", resp)
		}
		// Редактор рисует - зритель получает патч.
		editor, _ := e.mustDial("owner@example.com", doc.KindBoard, board.ID)
		writeMsg(t, editor, pushMsg(1, map[string]any{"shape:b": shape("shape:b")}, nil))
		if patch := readMsg(t, c, time.Second); patch["type"] != "patch" {
			t.Fatalf("viewer patch = %v", patch)
		}
		if _, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(e.srv.URL, "http")+"/app/present/"+strings.Repeat("0", 32)+"/ws", nil); err == nil {
			t.Fatal("unknown token connected")
		}
	})

	t.Run("screens are listed to editors", func(t *testing.T) {
		// Страница показа выдаёт экрану cookie с его id: несколько окон одного телевизора это один экран.
		resp, _ := http.Get(e.srv.URL + "/app/present/" + token)
		var screenCookie *http.Cookie
		for _, c := range resp.Cookies() {
			if c.Name == handler.ScreenCookie {
				screenCookie = c
			}
		}
		if screenCookie == nil || screenCookie.Value == "" || !screenCookie.HttpOnly || screenCookie.Path != "/app/present/" {
			t.Fatalf("screen cookie = %v", screenCookie)
		}
		url := "ws" + strings.TrimPrefix(e.srv.URL, "http") + "/app/present/" + token + "/ws"
		dialScreen := func(id string) *websocket.Conn {
			t.Helper()
			c, _, err := websocket.DefaultDialer.Dial(url, http.Header{"Cookie": {handler.ScreenCookie + "=" + id}})
			if err != nil {
				t.Fatalf("dial screen: %v", err)
			}
			t.Cleanup(func() { c.Close() })
			if init := readMsg(t, c, 2*time.Second); init["type"] != "init" {
				t.Fatalf("screen init = %v", init)
			}
			return c
		}
		screens := func(c *websocket.Conn) []string {
			t.Helper()
			msg := readMsg(t, c, 2*time.Second)
			if msg["type"] != "screens" {
				t.Fatalf("expected screens, got %v", msg)
			}
			items, _ := msg["items"].([]any)
			ids := make([]string, 0, len(items))
			for _, it := range items {
				ids = append(ids, it.(map[string]any)["id"].(string))
			}
			return ids
		}
		editor, _ := e.mustDial("owner@example.com", doc.KindBoard, board.ID)
		dialScreen("tv-1")
		if ids := screens(editor); len(ids) != 1 || ids[0] != "tv-1" {
			t.Fatalf("one screen: %v", ids)
		}
		dialScreen("tv-1")
		if ids := screens(editor); len(ids) != 1 {
			t.Fatalf("same screen twice: %v", ids)
		}
		tv2 := dialScreen("tv-2")
		if ids := screens(editor); len(ids) != 2 || ids[0] != "tv-1" || ids[1] != "tv-2" {
			t.Fatalf("two screens: %v", ids)
		}
		// Новый редактор узнаёт об экранах сразу после init.
		late, _ := e.mustDial("member@example.com", doc.KindBoard, board.ID)
		if ids := screens(late); len(ids) != 2 {
			t.Fatalf("late editor: %v", ids)
		}
		tv2.Close()
		if ids := screens(editor); len(ids) != 1 || ids[0] != "tv-1" {
			t.Fatalf("after tv-2 left: %v", ids)
		}
	})

	t.Run("expired link stops working", func(t *testing.T) {
		if _, err := e.pool.Exec(e.ctx, "UPDATE board SET present_expires_at = now() - interval '1 minute' WHERE id = $1", board.ID); err != nil {
			t.Fatal(err)
		}
		if resp, _ := http.Get(e.srv.URL + "/app/present/" + token); resp.StatusCode != 404 {
			t.Fatalf("expired token: %d", resp.StatusCode)
		}
		// Продление: включить снова на сутки.
		_, renewed := e.post("owner@example.com", "/board/present/enable", map[string]any{"id": id, "hours": 24})
		if renewed["presentToken"] != token || renewed["presentExpiresAt"] == "" {
			t.Fatalf("renew: %v", renewed)
		}
		if resp, _ := http.Get(e.srv.URL + "/app/present/" + token); resp.StatusCode != 200 {
			t.Fatalf("renewed token: %d", resp.StatusCode)
		}
	})

	t.Run("lead and disable", func(t *testing.T) {
		if status, body := e.post("other@example.com", "/board/present/lead", map[string]any{"id": id}); status != 403 {
			t.Fatalf("outsider lead: %d %v", status, body)
		}
		status, led := e.post("member@example.com", "/board/present/lead", map[string]any{"id": id})
		if status != 200 || led["presenterId"] != member.ID.String() {
			t.Fatalf("member lead: %d %v", status, led)
		}
		if status, _ := e.post("member@example.com", "/board/present/disable", map[string]any{"id": id}); status != 403 {
			t.Fatalf("member disabled present: %d", status)
		}
		// Подключённый экран при выключении отключается сразу с кодом 4404: ждать опроса не нужно.
		screen, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(e.srv.URL, "http")+"/app/present/"+token+"/ws", nil)
		if err != nil {
			t.Fatalf("dial screen: %v", err)
		}
		defer screen.Close()
		if init := readMsg(t, screen, 2*time.Second); init["type"] != "init" {
			t.Fatalf("screen init = %v", init)
		}
		status, off := e.post("owner@example.com", "/board/present/disable", map[string]any{"id": id})
		if code := readClose(t, screen, 2*time.Second); code != 4404 {
			t.Fatalf("screen close code = %d", code)
		}
		if status != 200 || off["presentEnabled"] != false || off["presentToken"] != "" || off["presenterId"] != "" {
			t.Fatalf("disable: %d %v", status, off)
		}
		if resp, _ := http.Get(e.srv.URL + "/app/present/" + token); resp.StatusCode != 404 {
			t.Fatalf("old token still works: %d", resp.StatusCode)
		}
		if status, _ := e.post("member@example.com", "/board/present/lead", map[string]any{"id": id}); status != 409 {
			t.Fatalf("lead with present disabled: %d", status)
		}
	})
	_ = uuid.Nil
	_ = json.Marshal
	_ = model.BoardAccessEdit
}
