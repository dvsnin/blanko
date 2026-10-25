// Package preset - предустановленные шаблоны занятий: каталог и сидер документов tldraw.
package preset

import (
	"encoding/json"
	"fmt"
	"strings"
)

// schemaJSON - схема снапшота tldraw 5.5.2, снята с реального документа стенда. Совпадает со
// схемой канваса, поэтому loadSnapshot не гоняет миграции.
const schemaJSON = `{"schemaVersion":2,"sequences":{"com.tldraw.store":5,"com.tldraw.asset":1,"com.tldraw.camera":1,"com.tldraw.document":2,"com.tldraw.instance":26,"com.tldraw.instance_page_state":5,"com.tldraw.page":1,"com.tldraw.instance_presence":6,"com.tldraw.pointer":1,"com.tldraw.shape":4,"com.tldraw.user":1,"com.tldraw.asset.image":6,"com.tldraw.asset.video":5,"com.tldraw.asset.bookmark":2,"com.tldraw.shape.group":0,"com.tldraw.shape.text":4,"com.tldraw.shape.bookmark":2,"com.tldraw.shape.draw":5,"com.tldraw.shape.geo":12,"com.tldraw.shape.note":13,"com.tldraw.shape.line":5,"com.tldraw.shape.frame":1,"com.tldraw.shape.arrow":8,"com.tldraw.shape.highlight":4,"com.tldraw.shape.embed":4,"com.tldraw.shape.image":5,"com.tldraw.shape.video":4,"com.tldraw.binding.arrow":1}}`

// Shape - id записи-родителя для вложения фигур: страница, рамка или группа.
type Shape string

const Page Shape = "page:page"

// Doc - минимальный конструктор части document снапшота tldraw: document, page и фигуры
// frame, group, geo, text. Координаты фигуры относительны родителя.
type Doc struct {
	order   []string
	records map[string]map[string]any
	child   map[Shape]int
	seq     int
}

func NewDoc() *Doc {
	d := &Doc{records: map[string]map[string]any{}, child: map[Shape]int{}}
	d.add("document:document", map[string]any{"gridSize": 10, "name": "", "meta": map[string]any{}, "id": "document:document", "typeName": "document"})
	d.add("page:page", map[string]any{"meta": map[string]any{}, "id": "page:page", "name": "Страница 1", "index": "a1", "typeName": "page"})
	return d
}

func (d *Doc) add(id string, rec map[string]any) {
	d.order = append(d.order, id)
	d.records[id] = rec
}

const indexDigits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

// nextIndex - дробный индекс порядка среди детей родителя: a1..az, затем b10, b11, ...
func (d *Doc) nextIndex(parent Shape) string {
	d.child[parent]++
	i := d.child[parent]
	if i < len(indexDigits) {
		return "a" + string(indexDigits[i])
	}
	i -= len(indexDigits)
	return "b" + string(indexDigits[1+i/len(indexDigits)]) + string(indexDigits[i%len(indexDigits)])
}

// richText - текст в формате редактора tldraw: абзац на каждую строку.
func richText(text string) map[string]any {
	paragraphs := []any{}
	for _, line := range strings.Split(text, "\n") {
		p := map[string]any{"type": "paragraph", "attrs": map[string]any{"dir": "auto"}}
		if line != "" {
			p["content"] = []any{map[string]any{"type": "text", "text": line}}
		}
		paragraphs = append(paragraphs, p)
	}
	return map[string]any{"type": "doc", "content": paragraphs}
}

func (d *Doc) shape(parent Shape, typ string, x, y float64, props map[string]any) Shape {
	d.seq++
	id := fmt.Sprintf("shape:p%03d", d.seq)
	d.add(id, map[string]any{
		"x": x, "y": y, "rotation": 0, "isLocked": false, "opacity": 1, "meta": map[string]any{},
		"id": id, "type": typ, "props": props, "parentId": string(parent), "index": d.nextIndex(parent), "typeName": "shape",
	})
	return Shape(id)
}

// Frame - рамка с подписью; детям задаются координаты внутри неё.
func (d *Doc) Frame(parent Shape, x, y, w, h float64, name string) Shape {
	return d.shape(parent, "frame", x, y, map[string]any{"w": w, "h": h, "name": name, "color": "black"})
}

// Group - группа: фигуры внутри таскаются как одна.
func (d *Doc) Group(parent Shape, x, y float64) Shape {
	return d.shape(parent, "group", x, y, map[string]any{})
}

// Geo - геометрическая фигура с подписью. Пустые поля - значения по умолчанию.
type Geo struct {
	Kind, Color, Fill, Size, Font, Dash, Align, VAlign, LabelColor, Label string
}

func or(v, def string) string {
	if v == "" {
		return def
	}
	return v
}

func (d *Doc) Geo(parent Shape, x, y, w, h float64, g Geo) Shape {
	return d.shape(parent, "geo", x, y, map[string]any{
		"geo": or(g.Kind, "rectangle"), "dash": or(g.Dash, "draw"), "url": "", "w": w, "h": h, "growY": 0, "scale": 1, "flipX": false, "flipY": false,
		"labelColor": or(g.LabelColor, "black"), "color": or(g.Color, "black"), "fill": or(g.Fill, "none"),
		"size": or(g.Size, "m"), "font": or(g.Font, "sans"), "align": or(g.Align, "middle"), "verticalAlign": or(g.VAlign, "middle"),
		"richText": richText(g.Label),
	})
}

// Text - надпись шириной w (в экранных единицах родителя: tldraw умножает w на scale, поэтому
// здесь делим); высота считается редактором, длинный текст переносится.
type Text struct {
	Size, Color, Font, Align string
	Scale                    float64
}

func (d *Doc) Text(parent Shape, x, y, w float64, text string, o Text) Shape {
	scale := o.Scale
	if scale == 0 {
		scale = 1
	}
	return d.shape(parent, "text", x, y, map[string]any{
		"color": or(o.Color, "black"), "size": or(o.Size, "m"), "font": or(o.Font, "sans"), "textAlign": or(o.Align, "start"),
		"w": w / scale, "richText": richText(text), "scale": scale, "autoSize": false,
	})
}

// Note - стикер 200x200.
func (d *Doc) Note(parent Shape, x, y float64, text, color string) Shape {
	return d.shape(parent, "note", x, y, map[string]any{
		"color": or(color, "yellow"), "labelColor": "black", "size": "m", "font": "sans", "fontSizeAdjustment": 1,
		"align": "middle", "verticalAlign": "middle", "growY": 0, "url": "", "richText": richText(text), "scale": 1, "textLastEditedBy": nil,
	})
}

// Shapes - число фигур в документе.
func (d *Doc) Shapes() int { return d.seq }

// JSON - документ в формате хранилища: {schema, store}.
func (d *Doc) JSON() ([]byte, error) {
	store := map[string]json.RawMessage{}
	for _, id := range d.order {
		raw, err := json.Marshal(d.records[id])
		if err != nil {
			return nil, err
		}
		store[id] = raw
	}
	return json.Marshal(map[string]any{"schema": json.RawMessage(schemaJSON), "store": store})
}
