// Package doc - комнаты документов tldraw: состояние в памяти, пересылка диффов
// между подключениями, периодическая запись снапшота в хранилище.
package doc

import (
	"encoding/json"

	"github.com/google/uuid"
)

// Kind - вид документа. Совпадает с сегментом URL и префиксом в хранилище ("boards/", "templates/").
type Kind string

const (
	KindBoard    Kind = "board"
	KindTemplate Kind = "template"
)

func ParseKind(s string) (Kind, bool) {
	switch Kind(s) {
	case KindBoard, KindTemplate:
		return Kind(s), true
	}
	return "", false
}

// Prefix - корень всех объектов документа в хранилище.
func Prefix(kind Kind, id uuid.UUID) string { return string(kind) + "s/" + id.String() + "/" }

func DocumentKey(kind Kind, id uuid.UUID) string { return Prefix(kind, id) + "document.json" }

func MediaKey(kind Kind, id uuid.UUID, name string) string { return Prefix(kind, id) + "media/" + name }

// MediaSrc - значение asset.props.src в документе; канвас превращает его в /app/media/<key>.
// Схема asset: - единственная нестандартная, которую пропускает валидатор tldraw.
func MediaSrc(kind Kind, id uuid.UUID, name string) string {
	return "asset:" + MediaKey(kind, id, name)
}

// Document - ровно часть document снапшота tldraw. Записи для сервера непрозрачны.
type Document struct {
	Schema json.RawMessage            `json:"schema"`
	Store  map[string]json.RawMessage `json:"store"`
}

// Patch - дифф записей: put кладёт последнее состояние по id, remove удаляет.
type Patch struct {
	Put    map[string]json.RawMessage `json:"put"`
	Remove []string                   `json:"remove"`
}

// PatchMessage - то, что уходит остальным клиентам комнаты.
type PatchMessage struct {
	Type   string                     `json:"type"`
	Put    map[string]json.RawMessage `json:"put"`
	Remove []string                   `json:"remove"`
}

// PresenceMessage - курсор/камера одного участника, ретранслируется остальным.
// Запись непрозрачна для сервера (кроме id) и никогда не попадает в снапшот.
type PresenceMessage struct {
	Type   string          `json:"type"`
	Record json.RawMessage `json:"record"`
}

// PresenceGoneMessage - участник отключился, его курсор надо убрать.
type PresenceGoneMessage struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

// ScreensMessage - экраны показа в комнате; редакторы показывают их в списке участников.
type ScreensMessage struct {
	Type  string   `json:"type"`
	Items []Screen `json:"items"`
}

// Screen - одно устройство показа (по cookie), сколько бы окон оно ни открыло.
type Screen struct {
	ID    string `json:"id"`
	Since int64  `json:"since"` // unix ms первого подключения
}

// Client - подключение к комнате. Send неблокирующий: false значит очередь полна.
type Client interface {
	Send(msg []byte) bool
	Close(code int, reason string)
}
