package handler_test

import (
	"bytes"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/dvsnin/blanko/backend/app/internal/doc"
)

var jpegBody = append([]byte("\xff\xd8\xff\xe0"), bytes.Repeat([]byte("j"), 128)...)

func (e *env) uploadPreview(email string, kind doc.Kind, id uuid.UUID, contentType string, body []byte) int {
	e.t.Helper()
	status, _ := e.uploadTo(email, "/app/preview/"+string(kind)+"/"+id.String(), "preview.jpg", contentType, body)
	return status
}

func (e *env) del(email, path string) *http.Response {
	e.t.Helper()
	req, _ := http.NewRequest(http.MethodDelete, e.srv.URL+path, nil)
	req.Header.Set("X-Forwarded-Email", email)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.t.Fatalf("delete %s: %v", path, err)
	}
	return resp
}

func TestPreviewUpload(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	e.account("other@example.com")
	team := e.team(owner)

	t.Run("jpeg to board", func(t *testing.T) {
		b := e.board(team, owner, "С превью")
		if status := e.uploadPreview("owner@example.com", doc.KindBoard, b.ID, "image/jpeg", jpegBody); status != 201 {
			t.Fatalf("status %d", status)
		}
		rc, info, err := e.store.Get(e.ctx, doc.PreviewKey(doc.KindBoard, b.ID))
		if err != nil {
			t.Fatalf("object missing: %v", err)
		}
		got, _ := io.ReadAll(rc)
		if !bytes.Equal(got, jpegBody) || info.ContentType != "image/jpeg" {
			t.Fatalf("object mismatch: %d bytes, %s", len(got), info.ContentType)
		}
	})

	t.Run("too large keeps old preview", func(t *testing.T) {
		b := e.board(team, owner, "Большое превью")
		e.uploadPreview("owner@example.com", doc.KindBoard, b.ID, "image/jpeg", jpegBody)
		if status := e.uploadPreview("owner@example.com", doc.KindBoard, b.ID, "image/jpeg", bytes.Repeat([]byte("x"), 512<<10+1)); status != 413 {
			t.Fatalf("status %d, want 413", status)
		}
		if !bytes.Equal(e.store.Bytes(doc.PreviewKey(doc.KindBoard, b.ID)), jpegBody) {
			t.Fatal("old preview replaced")
		}
	})

	t.Run("unsupported type", func(t *testing.T) {
		b := e.board(team, owner, "SVG")
		if status := e.uploadPreview("owner@example.com", doc.KindBoard, b.ID, "image/svg+xml", []byte("<svg/>")); status != 400 {
			t.Fatalf("status %d, want 400", status)
		}
	})

	t.Run("foreign template", func(t *testing.T) {
		tpl := e.template(&owner, "Чужой")
		if status := e.uploadPreview("other@example.com", doc.KindTemplate, tpl.ID, "image/jpeg", jpegBody); status != 403 {
			t.Fatalf("status %d, want 403", status)
		}
		if resp := e.del("other@example.com", "/app/preview/template/"+tpl.ID.String()); resp.StatusCode != 403 {
			t.Fatalf("delete status %d, want 403", resp.StatusCode)
		}
	})

	t.Run("delete", func(t *testing.T) {
		b := e.board(team, owner, "Опустела")
		e.uploadPreview("owner@example.com", doc.KindBoard, b.ID, "image/jpeg", jpegBody)
		if resp := e.del("owner@example.com", "/app/preview/board/"+b.ID.String()); resp.StatusCode != 204 {
			t.Fatalf("status %d, want 204", resp.StatusCode)
		}
		if e.store.Bytes(doc.PreviewKey(doc.KindBoard, b.ID)) != nil {
			t.Fatal("preview still there")
		}
		if resp := e.del("owner@example.com", "/app/preview/board/"+b.ID.String()); resp.StatusCode != 204 {
			t.Fatalf("second delete status %d, want 204", resp.StatusCode)
		}
	})
}

func TestPreviewGet(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	team := e.team(owner)
	b := e.board(team, owner, "С превью")
	e.uploadPreview("owner@example.com", doc.KindBoard, b.ID, "image/jpeg", jpegBody)

	t.Run("existing", func(t *testing.T) {
		resp := e.get("owner@example.com", "/app/preview/boards/"+b.ID.String())
		defer resp.Body.Close()
		got, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 || resp.Header.Get("Content-Type") != "image/jpeg" || !bytes.Equal(got, jpegBody) {
			t.Fatalf("status %d type %s len %d", resp.StatusCode, resp.Header.Get("Content-Type"), len(got))
		}
		if !strings.Contains(resp.Header.Get("Cache-Control"), "max-age=60") {
			t.Fatalf("cache-control = %q", resp.Header.Get("Cache-Control"))
		}
	})

	t.Run("missing", func(t *testing.T) {
		resp := e.get("owner@example.com", "/app/preview/boards/"+uuid.New().String())
		resp.Body.Close()
		if resp.StatusCode != 404 {
			t.Fatalf("status %d, want 404", resp.StatusCode)
		}
	})
}
