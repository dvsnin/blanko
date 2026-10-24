package handler

import (
	"bytes"
	"errors"
	"io"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"github.com/dvsnin/blanko/backend/app/internal/doc"
	"github.com/dvsnin/blanko/backend/app/internal/service"
	"github.com/dvsnin/blanko/backend/app/internal/storage"
)

// Превью содержимого: один объект {kind}s/{id}/preview, снимает канвас, показывает дашборд.

const previewMaxBytes = 512 << 10

var previewTypes = map[string]bool{"image/jpeg": true, "image/png": true, "image/webp": true}

// UploadPreview POST /app/preview/{kind}/{id}, multipart поле "file".
func (a *API) UploadPreview(w http.ResponseWriter, r *http.Request) {
	kind, docID, ok := a.resolveMediaDoc(w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, previewMaxBytes+64<<10)
	part, contentType, ok := firstFilePart(w, r)
	if !ok {
		return
	}
	if !previewTypes[contentType] {
		writeError(w, http.StatusBadRequest, "unsupported_media", "unsupported content type "+contentType)
		return
	}
	data, err := io.ReadAll(io.LimitReader(part, previewMaxBytes+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "cannot read file")
		return
	}
	if len(data) > previewMaxBytes {
		writeError(w, http.StatusRequestEntityTooLarge, "too_large", "preview is too large")
		return
	}
	key := doc.PreviewKey(kind, docID)
	if err := a.services.Document.Store.Put(r.Context(), key, bytes.NewReader(data), int64(len(data)), contentType); err != nil {
		log.Printf("preview: put %s: %v", key, err)
		writeServiceError(w, service.ErrStorageUnavailable)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{})
}

// DeletePreview DELETE /app/preview/{kind}/{id}: доска опустела, плитка возвращается к цвету.
func (a *API) DeletePreview(w http.ResponseWriter, r *http.Request) {
	kind, docID, ok := a.resolveMediaDoc(w, r)
	if !ok {
		return
	}
	if err := a.services.Document.Store.Delete(r.Context(), doc.PreviewKey(kind, docID)); err != nil {
		writeServiceError(w, service.ErrStorageUnavailable)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GetPreview GET /app/preview/{kind}s/{id}: документ в БД не проверяется, как у медиа.
func (a *API) GetPreview(w http.ResponseWriter, r *http.Request) {
	kind, kindOK := doc.ParseKind(mux.Vars(r)["kind"])
	docID, err := uuid.Parse(mux.Vars(r)["id"])
	if !kindOK || err != nil {
		http.NotFound(w, r)
		return
	}
	if _, ok := identityFrom(r.Context()); !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "")
		return
	}
	rc, info, err := a.services.Document.Store.Get(r.Context(), doc.PreviewKey(kind, docID))
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			http.NotFound(w, r)
			return
		}
		writeServiceError(w, service.ErrStorageUnavailable)
		return
	}
	defer rc.Close()
	w.Header().Set("Content-Type", info.ContentType)
	w.Header().Set("Cache-Control", "private, max-age=60")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, rc)
}

// firstFilePart находит поле "file" в multipart-теле; при ошибке ответ уже записан.
func firstFilePart(w http.ResponseWriter, r *http.Request) (io.Reader, string, bool) {
	mr, err := r.MultipartReader()
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "multipart body expected")
		return nil, "", false
	}
	for {
		p, err := mr.NextPart()
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "field file is required")
			return nil, "", false
		}
		if p.FormName() == "file" {
			return p, p.Header.Get("Content-Type"), true
		}
	}
}
