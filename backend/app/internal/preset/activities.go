package preset

import "strconv"

// Общие сборщики заданий: рамка занятия, карточки с эмодзи, зоны для сортировки,
// числовые карточки, пронумерованные слоты, списки строк.

const (
	frameX, frameY = 40.0, 40.0
	frameW, frameH = 1520.0, 860.0
	// contentY - где начинается само задание под заголовком и инструкцией.
	contentY = 180.0
)

var cardColors = []string{"light-blue", "light-green", "yellow", "light-violet", "light-red", "orange"}

func colorAt(i int) string { return cardColors[i%len(cardColors)] }

// lesson - рамка занятия с заголовком и заданием для воспитателя; всё остальное кладётся в рамку.
func lesson(d *Doc, title, task string) Shape {
	f := d.Frame(Page, frameX, frameY, frameW, frameH, title)
	d.Text(f, 32, 20, 1200, title, Text{Size: "xl"})
	lines := 1 + len([]rune(task))/105
	h := 20 + float64(lines)*34
	d.Geo(f, 32, 90, frameW-64, h, Geo{Color: "yellow", Fill: "semi", Dash: "solid"})
	d.Text(f, 48, 100, frameW-96, task, Text{Size: "m"})
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

// card - группа «плашка + эмодзи + подпись»: таскается как одно целое.
func card(d *Doc, parent Shape, x, y, w, h float64, c Card, color string) Shape {
	g := d.Group(parent, x, y)
	d.Geo(g, 0, 0, w, h, Geo{Color: color, Fill: "semi", Dash: "solid"})
	labelH := 0.0
	if c.Label != "" {
		labelH = 40
	}
	if c.Emoji != "" {
		scale := 2.0
		if h < 150 {
			scale = 1.3
		}
		emojiH := 44 * 1.4 * scale
		ey := (h - labelH - emojiH) / 2
		if ey < 4 {
			ey = 4
		}
		d.Text(g, 0, ey, w, c.Emoji, Text{Size: "xl", Align: "middle", Scale: scale})
	}
	if c.Label != "" {
		size := "m"
		// Карточка-слово без картинки: крупнее, по центру; длинное слово оставляем средним,
		// иначе оно ломается посреди слова.
		if c.Emoji == "" {
			if len([]rune(c.Label)) <= 10 {
				size = "l"
			}
			if h > 100 {
				labelH = h/2 + 24
			}
		}
		d.Text(g, 4, h-labelH, w-8, c.Label, Text{Size: size, Align: "middle"})
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

// zones - подписанные рамки-корзины в ряд: куда перетаскивать карточки.
func zones(d *Doc, parent Shape, x, y, w, h, gap float64, names ...string) []Shape {
	out := make([]Shape, 0, len(names))
	for i, n := range names {
		out = append(out, d.Frame(parent, x+float64(i)*(w+gap), y, w, h, n))
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
