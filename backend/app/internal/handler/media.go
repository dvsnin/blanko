package handler

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"log"
	"net/http"
	"regexp"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"github.com/dvsnin/blanko/backend/app/internal/doc"
	"github.com/dvsnin/blanko/backend/app/internal/service"
	"github.com/dvsnin/blanko/backend/app/internal/storage"
)

// Медиа документа: файл лежит в хранилище под префиксом документа с именем по хэшу,
// в записи ассета tldraw хранится "asset:<ключ>", канвас превращает его в /app/media/<ключ>.

var mediaExt = map[string]string{
	"image/png":     "png",
	"image/jpeg":    "jpg",
	"image/gif":     "gif",
	"image/webp":    "webp",
	"image/svg+xml": "svg",
	"video/mp4":     "mp4",
	"video/webm":    "webm",
}

var mediaNameRe = regexp.MustCompile(`^[a-f0-9]{64}\.[a-z0-9]{2,5}$`)

// UploadMedia POST /app/media/{kind}/{id}, multipart поле "file".
func (a *API) UploadMedia(w http.ResponseWriter, r *http.Request) {
	kind, docID, ok := a.resolveMediaDoc(w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, a.mediaMaxBytes+64<<10)
	part, contentType, ok := firstFilePart(w, r)
	if !ok {
		return
	}
	ext, ok := mediaExt[contentType]
	if !ok {
		writeError(w, http.StatusBadRequest, "unsupported_media", "unsupported content type "+contentType)
		return
	}
	data, err := io.ReadAll(io.LimitReader(part, a.mediaMaxBytes+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "cannot read file")
		return
	}
	if int64(len(data)) > a.mediaMaxBytes {
		writeError(w, http.StatusRequestEntityTooLarge, "too_large", "file is too large")
		return
	}
	// Заявленный тип должен совпадать с сигнатурой содержимого (SVG - текст, его сниффер не узнаёт).
	if contentType != "image/svg+xml" && http.DetectContentType(data) != contentType {
		writeError(w, http.StatusBadRequest, "unsupported_media", "content does not match "+contentType)
		return
	}
	sum := sha256.Sum256(data)
	name := hex.EncodeToString(sum[:]) + "." + ext
	// Имя по хэшу: повторная запись того же содержимого безвредна, проверять наличие не нужно.
	key := doc.MediaKey(kind, docID, name)
	if err := a.services.Document.Store.Put(r.Context(), key, bytes.NewReader(data), int64(len(data)), contentType); err != nil {
		log.Printf("media: put %s: %v", key, err)
		writeServiceError(w, service.ErrStorageUnavailable)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"src": doc.MediaSrc(kind, docID, name)})
}

// GetMedia GET /app/media/{kind}s/{id}/media/{name}: путь после /app/media/ равен ключу в хранилище.
// Документ в БД не проверяется: ссылка самодостаточна и живёт в других документах после вставки
// через буфер обмена, а объекты при мягком удалении остаются. Права на чтение - любой вошедший.
func (a *API) GetMedia(w http.ResponseWriter, r *http.Request) {
	name := mux.Vars(r)["name"]
	kind, kindOK := doc.ParseKind(mux.Vars(r)["kind"])
	docID, err := uuid.Parse(mux.Vars(r)["id"])
	if !mediaNameRe.MatchString(name) || !kindOK || err != nil {
		http.NotFound(w, r)
		return
	}
	if _, ok := identityFrom(r.Context()); !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "")
		return
	}
	rc, info, err := a.services.Document.Store.Get(r.Context(), doc.MediaKey(kind, docID, name))
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
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	// SVG отдаётся с того же origin: без этих заголовков встроенный скрипт получил бы сессию.
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, rc)
}

// resolveMediaDoc разбирает kind и id из URL, проверяет документ и право записи.
// Ответ в случае ошибки уже записан.
func (a *API) resolveMediaDoc(w http.ResponseWriter, r *http.Request) (doc.Kind, uuid.UUID, bool) {
	kind, ok := doc.ParseKind(mux.Vars(r)["kind"])
	if !ok {
		http.NotFound(w, r)
		return "", uuid.Nil, false
	}
	docID, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		http.NotFound(w, r)
		return "", uuid.Nil, false
	}
	id, ok := identityFrom(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "")
		return "", uuid.Nil, false
	}
	canEdit, err := a.services.Document.Resolve(r.Context(), id, kind, docID)
	if err != nil {
		writeServiceError(w, err)
		return "", uuid.Nil, false
	}
	if !canEdit {
		writeError(w, http.StatusForbidden, "forbidden", "no write access to document")
		return "", uuid.Nil, false
	}
	return kind, docID, true
}
