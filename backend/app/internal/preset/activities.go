package preset

import (
	"strconv"
	"strings"
	"unicode"
)

// Общие сборщики заданий: рамка занятия, карточки с эмодзи, зоны для сортировки,
// числовые карточки, пронумерованные слоты, списки строк.

const (
	frameX, frameY = 40.0, 40.0
	frameW, frameH = 1520.0, 860.0
	// contentY - где начинается само задание под заголовком и инструкцией.
	contentY = 180.0
)

var cardColors = []string{"light-blue", "light-green", "yellow", "light-violet", "light-red", "orange"}

// Метрики текста tldraw для раскладки: интервал 1.35, буква 0.6 em, пробел 0.3 em, эмодзи 1.25 em.
var fontPx = map[string]float64{"s": 18, "m": 24, "l": 36, "xl": 44}

const (
	lineHeight = 1.35
	// headingClear - полоса над рамкой, где tldraw рисует её название; содержимое выше не должно в неё заходить.
	headingClear = 24.0
)

func isEmojiRune(r rune) bool {
	return r >= 0x1F000 || (r >= 0x2600 && r <= 0x27BF) || r == 0x2B50 || r == 0x2B55 || r == 0x203C || r == 0x2049
}

// emojiCount - сколько эмодзи нарисуется: модификаторы, селекторы и склейки через ZWJ не считаются.
func emojiCount(s string) int {
	n, joined := 0, false
	for _, r := range s {
		switch {
		case r == 0x200D:
			joined = true
		case r == 0xFE0F || r == 0xFE0E || (r >= 0x1F3FB && r <= 0x1F3FF) || (r >= 0x1F1E6 && r <= 0x1F1FF && n > 0 && joined):
		case unicode.IsSpace(r):
		default:
			if joined {
				joined = false
				continue
			}
			n++
		}
	}
	if n == 0 && strings.TrimSpace(s) != "" {
		return 1
	}
	return n
}

func textWidth(s string, px float64) float64 {
	w := 0.0
	for _, r := range s {
		switch {
		case r == 0x200D || r == 0xFE0F || (r >= 0x1F3FB && r <= 0x1F3FF):
		case isEmojiRune(r):
			w += 1.25 * px
		case unicode.IsSpace(r):
			w += 0.3 * px
		default:
			w += 0.6 * px
		}
	}
	return w
}

// wrapLines - число строк при переносе по словам в ширину maxW; слово шире строки редактор
// ломает посреди, это тоже считается.
func wrapLines(s string, maxW, px float64) int {
	total := 0
	for _, para := range strings.Split(s, "\n") {
		lines, cur := 1, 0.0
		for _, word := range strings.Fields(para) {
			ww := textWidth(word, px)
			switch {
			case cur == 0:
				cur = ww
			case cur+0.3*px+ww <= maxW:
				cur += 0.3*px + ww
			default:
				lines++
				cur = ww
			}
			for cur > maxW {
				lines++
				cur -= maxW
			}
		}
		total += lines
	}
	return total
}

func colorAt(i int) string { return cardColors[i%len(cardColors)] }

// lesson - рамка занятия с заголовком и заданием для воспитателя; всё остальное кладётся в рамку.
func lesson(d *Doc, title, task string) Shape {
	f := d.Frame(Page, frameX, frameY, frameW, frameH, title)
	d.Text(f, 32, 20, 1200, title, Text{Size: "xl"})
	// Коробка инструкции по числу строк; при двух строках до contentY остаётся зазор.
	lines := wrapLines(task, frameW-96-16, fontPx["m"])
	h := 10 + float64(lines)*fontPx["m"]*lineHeight
	d.Geo(f, 32, 86, frameW-64, h, Geo{Color: "yellow", Fill: "semi", Dash: "solid"})
	d.Text(f, 48, 91, frameW-96, task, Text{Size: "m"})
	return f
}

// Card - карточка: картинка-эмодзи и подпись; любое из полей может быть пустым.
type Card struct{ Emoji, Label string }

func cards(pairs ...string) []Card {
	out := make([]Card, 0, len(pairs)/2)
	for i := 0; i+1 < len(pairs); i += 2 {
		out = append(out, Card{Emoji: pairs[i], Label: pairs[i+1]})
	}
	return out
}

func emojis(list ...string) []Card {
	out := make([]Card, 0, len(list))
	for _, e := range list {
		out = append(out, Card{Emoji: e})
	}
	return out
}

func words(list ...string) []Card {
	out := make([]Card, 0, len(list))
	for _, w := range list {
		out = append(out, Card{Label: w})
	}
	return out
}

// card - группа «плашка + эмодзи + подпись». Подпись берёт крупнейший размер, влезающий в строку,
// иначе переносится мелким; эмодзи ужимается под остаток высоты и ширину.
func card(d *Doc, parent Shape, x, y, w, h float64, c Card, color string) Shape {
	g := d.Group(parent, x, y)
	d.Geo(g, 0, 0, w, h, Geo{Color: color, Fill: "semi", Dash: "solid"})
	labelH, textH, size := 0.0, 0.0, ""
	if c.Label != "" {
		sizes := []string{"m", "s"}
		if c.Emoji == "" {
			sizes = []string{"l", "m", "s"}
		}
		lines := 1
		for _, sz := range sizes {
			size = sz
			lines = wrapLines(c.Label, w-16, fontPx[sz])
			if lines == 1 && fontPx[sz]*lineHeight <= h-8 {
				break
			}
		}
		if lines > 3 {
			lines = 3
		}
		textH = float64(lines) * fontPx[size] * lineHeight
		labelH = textH + 8
	}
	if c.Emoji != "" {
		scale := 2.0
		if h < 150 {
			scale = 1.3
		}
		free := h - labelH - 8
		if 44*lineHeight*scale > free {
			scale = free / (44 * lineHeight)
		}
		if wide := float64(emojiCount(c.Emoji)) * 44 * 1.25 * scale; wide > w-8 {
			scale = (w - 8) / (float64(emojiCount(c.Emoji)) * 44 * 1.25)
		}
		if scale < 0.8 {
			scale = 0.8
		}
		emojiH := 44 * lineHeight * scale
		ey := 4 + (free-emojiH)/2
		if ey < 2 {
			ey = 2
		}
		d.Text(g, 0, ey, w, c.Emoji, Text{Size: "xl", Align: "middle", Scale: scale})
	}
	if c.Label != "" {
		ly := h - labelH + 4
		if c.Emoji == "" {
			ly = (h - textH) / 2
		}
		d.Text(g, 4, ly, w-8, c.Label, Text{Size: size, Align: "middle"})
	}
	return g
}

// cardRow - карточки в ряд слева направо.
func cardRow(d *Doc, parent Shape, x, y, w, h, gap float64, list []Card, color string) {
	for i, c := range list {
		col := color
		if col == "" {
			col = colorAt(i)
		}
		card(d, parent, x+float64(i)*(w+gap), y, w, h, c, col)
	}
}

// cardGrid - карточки сеткой по cols в ряд.
func cardGrid(d *Doc, parent Shape, x, y, w, h, gap float64, cols int, list []Card, color string) {
	for i, c := range list {
		col := color
		if col == "" {
			col = colorAt(i)
		}
		card(d, parent, x+float64(i%cols)*(w+gap), y+float64(i/cols)*(h+gap), w, h, c, col)
	}
}

// zones - подписанные рамки-корзины в ряд: куда перетаскивать карточки. Название рамки tldraw
// рисует над ней, поэтому рамка начинается на headingClear ниже заданного y.
func zones(d *Doc, parent Shape, x, y, w, h, gap float64, names ...string) []Shape {
	out := make([]Shape, 0, len(names))
	for i, n := range names {
		out = append(out, d.Frame(parent, x+float64(i)*(w+gap), y+headingClear, w, h-headingClear, n))
	}
	return out
}

// numberCards - карточки с числами from..to.
func numberCards(d *Doc, parent Shape, x, y, size, gap float64, from, to int, color string) {
	for n := from; n <= to; n++ {
		d.Geo(parent, x+float64(n-from)*(size+gap), y, size, size, Geo{Color: color, Fill: "semi", Dash: "solid", Size: "xl", Label: strconv.Itoa(n)})
	}
}

// slots - пунктирные пронумерованные места под карточки «по порядку».
func slots(d *Doc, parent Shape, x, y, w, h, gap float64, n int) {
	for i := 0; i < n; i++ {
		d.Geo(parent, x+float64(i)*(w+gap), y, w, h, Geo{Color: "grey", Dash: "dashed", Size: "xl", Label: strconv.Itoa(i + 1)})
	}
}

// lines - строки текста одна под другой.
func lines(d *Doc, parent Shape, x, y, w float64, size string, texts ...string) {
	step := map[string]float64{"s": 30, "m": 38, "l": 54, "xl": 66}[size]
	if step == 0 {
		step = 38
	}
	for i, t := range texts {
		d.Text(parent, x, y+float64(i)*step, w, t, Text{Size: size})
	}
}

// big - крупная надпись или эмодзи по центру ширины w.
func big(d *Doc, parent Shape, x, y, w float64, text string, scale float64) {
	d.Text(parent, x, y, w, text, Text{Size: "xl", Align: "middle", Scale: scale})
}

// plate - цветная подложка с подписью (без группы): заголовок секции, поле ответа.
func plate(d *Doc, parent Shape, x, y, w, h float64, label, color string) Shape {
	return d.Geo(parent, x, y, w, h, Geo{Color: color, Fill: "semi", Dash: "solid", Size: "l", Label: label})
}
