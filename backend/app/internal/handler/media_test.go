package handler_test

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"strings"
	"testing"

	"github.com/dvsnin/blanko/backend/app/internal/doc"
	"github.com/dvsnin/blanko/backend/app/internal/model"
	"github.com/dvsnin/blanko/backend/app/internal/repository"
)

var pngBody = append([]byte("\x89PNG\r\n\x1a\n"), bytes.Repeat([]byte("x"), 64)...)

func sha(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

func TestMediaUpload(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	e.account("other@example.com")
	team := e.team(owner)

	t.Run("png to board", func(t *testing.T) {
		b := e.board(team, owner, "Картинки")
		status, body := e.upload("owner@example.com", doc.KindBoard, b.ID, "cat.png", "image/png", pngBody)
		want := doc.MediaSrc(doc.KindBoard, b.ID, sha(pngBody)+".png")
		if status != 201 || body["src"] != want {
			t.Fatalf("status %d body %v, want src %s", status, body, want)
		}
		rc, info, err := e.store.Get(e.ctx, doc.MediaKey(doc.KindBoard, b.ID, sha(pngBody)+".png"))
		if err != nil {
			t.Fatalf("object missing: %v", err)
		}
		got, _ := io.ReadAll(rc)
		if !bytes.Equal(got, pngBody) || info.ContentType != "image/png" {
			t.Fatalf("object mismatch: %d bytes, %s", len(got), info.ContentType)
		}
	})

	t.Run("same file twice", func(t *testing.T) {
		b := e.board(team, owner, "Дубли")
		_, first := e.upload("owner@example.com", doc.KindBoard, b.ID, "a.png", "image/png", pngBody)
		status, second := e.upload("owner@example.com", doc.KindBoard, b.ID, "b.png", "image/png", pngBody)
		if status != 201 || first["src"] != second["src"] {
			t.Fatalf("second upload: %d %v vs %v", status, second, first)
		}
		keys, _ := e.store.List(e.ctx, doc.Prefix(doc.KindBoard, b.ID)+"media/")
		if len(keys) != 1 {
			t.Fatalf("objects = %d, want 1", len(keys))
		}
	})

	t.Run("too large", func(t *testing.T) {
		b := e.board(team, owner, "Большой файл")
		status, body := e.upload("owner@example.com", doc.KindBoard, b.ID, "big.png", "image/png", bytes.Repeat([]byte("x"), testMediaMaxBytes+1))
		if status != 413 || body["error"] != "too_large" {
			t.Fatalf("status %d body %v", status, body)
		}
	})

	t.Run("unsupported type", func(t *testing.T) {
		b := e.board(team, owner, "Текст")
		status, body := e.upload("owner@example.com", doc.KindBoard, b.ID, "a.txt", "text/plain", []byte("hello"))
		if status != 400 || body["error"] != "unsupported_media" {
			t.Fatalf("status %d body %v", status, body)
		}
	})

	t.Run("content does not match type", func(t *testing.T) {
		b := e.board(team, owner, "Подделка")
		status, body := e.upload("owner@example.com", doc.KindBoard, b.ID, "a.png", "image/png", []byte("hello, definitely not a png"))
		if status != 400 || body["error"] != "unsupported_media" {
			t.Fatalf("status %d body %v", status, body)
		}
	})

	t.Run("view-only member", func(t *testing.T) {
		member := e.account("member@example.com")
		e.addMember(team, member)
		b := e.boardWith(team, owner, "Только смотреть", model.BoardAccessView, false)
		if status, _ := e.upload("member@example.com", doc.KindBoard, b.ID, "a.png", "image/png", pngBody); status != 403 {
			t.Fatalf("status %d, want 403", status)
		}
	})

	t.Run("foreign template", func(t *testing.T) {
		tpl := e.template(&owner, "Чужой")
		status, _ := e.upload("other@example.com", doc.KindTemplate, tpl.ID, "a.png", "image/png", pngBody)
		if status != 403 {
			t.Fatalf("status %d, want 403", status)
		}
	})

	t.Run("deleted board", func(t *testing.T) {
		b := e.board(team, owner, "Удалена")
		if err := repository.NewBoardRepo(e.pool).SoftDelete(e.ctx, b.ID); err != nil {
			t.Fatal(err)
		}
		status, _ := e.upload("owner@example.com", doc.KindBoard, b.ID, "a.png", "image/png", pngBody)
		if status != 404 {
			t.Fatalf("status %d, want 404", status)
		}
	})
}

func TestMediaGet(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	team := e.team(owner)
	b := e.board(team, owner, "Картинки")
	e.upload("owner@example.com", doc.KindBoard, b.ID, "cat.png", "image/png", pngBody)
	name := sha(pngBody) + ".png"
	base := "/app/media/" + doc.Prefix(doc.KindBoard, b.ID) + "media/"

	t.Run("existing", func(t *testing.T) {
		resp := e.get("owner@example.com", base+name)
		defer resp.Body.Close()
		got, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 || resp.Header.Get("Content-Type") != "image/png" || !bytes.Equal(got, pngBody) {
			t.Fatalf("status %d type %s len %d", resp.StatusCode, resp.Header.Get("Content-Type"), len(got))
		}
		if !strings.Contains(resp.Header.Get("Cache-Control"), "immutable") {
			t.Fatalf("cache-control = %q", resp.Header.Get("Cache-Control"))
		}
		// SVG с того же origin не должен исполнять скрипты: nosniff и CSP с sandbox на любой отдаче.
		if resp.Header.Get("X-Content-Type-Options") != "nosniff" || !strings.Contains(resp.Header.Get("Content-Security-Policy"), "sandbox") {
			t.Fatalf("security headers: nosniff=%q csp=%q", resp.Header.Get("X-Content-Type-Options"), resp.Header.Get("Content-Security-Policy"))
		}
	})

	t.Run("deleted board still serves", func(t *testing.T) {
		// Ссылка на картинку самодостаточна и живёт в других документах после вставки через буфер обмена.
		if err := repository.NewBoardRepo(e.pool).SoftDelete(e.ctx, b.ID); err != nil {
			t.Fatal(err)
		}
		resp := e.get("owner@example.com", base+name)
		resp.Body.Close()
		if resp.StatusCode != 200 {
			t.Fatalf("status %d, want 200", resp.StatusCode)
		}
	})

	t.Run("bad name", func(t *testing.T) {
		for _, bad := range []string{"..%2Fdocument.json", "abc.png", strings.Repeat("a", 64) + ".png.exe"} {
			resp := e.get("owner@example.com", base+bad)
			resp.Body.Close()
			if resp.StatusCode != 404 {
				t.Fatalf("%s: status %d, want 404", bad, resp.StatusCode)
			}
		}
	})

	t.Run("missing", func(t *testing.T) {
		resp := e.get("owner@example.com", base+strings.Repeat("0", 64)+".png")
		resp.Body.Close()
		if resp.StatusCode != 404 {
			t.Fatalf("status %d, want 404", resp.StatusCode)
		}
	})
}
