package preset

func oddPreset(key, name, desc, glyph string, ages []string, rows [][]Card) Preset {
	return Preset{Key: key, Name: name, Description: desc, Topic: "logic", Ages: ages, Duration: 15, Glyph: glyph, Build: func(d *Doc) {
		f := lesson(d, name, "В каждом ряду одна картинка лишняя. Найди её, обведи и объясни, почему она не подходит.")
		for r, row := range rows {
			cardRow(d, f, 40, contentY+float64(r)*220, 200, 200, 24, row, colorAt(r))
		}
	}}
}

func logicPresets() []Preset {
	return []Preset{
		{Key: "find-pair", Name: "Найди пару", Description: "Варежки, носочки, половинки картинок: соединяем линией.", Topic: "logic", Ages: []string{"3-4", "4-5"}, Duration: 15, Glyph: "Па", Build: func(d *Doc) {
			f := lesson(d, "Найди пару", "У каждой картинки слева есть пара справа. Соедини их линией.")
			cardGrid(d, f, 40, contentY, 180, 150, 20, 1, emojis("🧤", "🧦", "👟", "🥾"), "light-blue")
			cardGrid(d, f, 1300, contentY, 180, 150, 20, 1, emojis("🥾", "🧤", "🧦", "👟"), "light-green")
		}},
		oddPreset("odd-one-out", "Что лишнее", "Четыре картинки, одна не подходит. Объясняем почему.", "?", []string{"4-5", "5-6", "6-7"},
			[][]Card{emojis("🍎", "🍐", "🚗", "🍌"), emojis("🐱", "🐶", "🐰", "🌻"), emojis("🚌", "✈️", "🚂", "🍕")}),
		oddPreset("odd-one-out-home", "Лишний предмет дома", "Посуда, мебель, одежда: что попало не в свою группу.", "🪑", []string{"5-6", "6-7"},
			[][]Card{emojis("🍽️", "🥄", "🪑", "🍴"), emojis("👕", "👖", "🧢", "🛏️"), emojis("🛋️", "🪑", "🛏️", "👟")}),
		{Key: "patterns", Name: "Продолжи узор", Description: "Чередование цветов и форм: что идёт дальше.", Topic: "logic", Ages: []string{"4-5", "5-6"}, Duration: 15, Glyph: "▲●", Build: func(d *Doc) {
			f := lesson(d, "Продолжи узор", "Посмотри, как чередуются фигуры, и дорисуй узор до конца ряда.")
			rows := [][][2]string{
				{{"ellipse", "red"}, {"rectangle", "blue"}, {"ellipse", "red"}, {"rectangle", "blue"}, {"ellipse", "red"}},
				{{"triangle", "green"}, {"triangle", "green"}, {"ellipse", "yellow"}, {"triangle", "green"}, {"triangle", "green"}},
				{{"star", "orange"}, {"ellipse", "violet"}, {"rectangle", "blue"}, {"star", "orange"}, {"ellipse", "violet"}},
			}
			for r, row := range rows {
				for i, s := range row {
					d.Geo(f, 40+float64(i)*140, contentY+float64(r)*210, 120, 120, Geo{Kind: s[0], Color: s[1], Fill: "solid", Dash: "solid"})
				}
				for i := len(row); i < 10; i++ {
					d.Geo(f, 40+float64(i)*140, contentY+float64(r)*210, 120, 120, Geo{Color: "grey", Dash: "dashed"})
				}
			}
		}},
		{Key: "sudoku", Name: "Судоку с картинками", Description: "В каждом ряду и столбце все картинки разные.", Topic: "logic", Ages: []string{"5-6", "6-7"}, Duration: 20, Glyph: "4x4", Build: func(d *Doc) {
			f := lesson(d, "Судоку с картинками", "В каждом ряду и в каждом столбце должны быть все четыре картинки, и ни одна не повторяется. Заполни пустые клетки.")
			grid := [][]string{{"🍎", "", "🍌", "🍇"}, {"", "🍇", "", "🍌"}, {"🍌", "", "🍇", ""}, {"🍇", "🍌", "", "🍎"}}
			for r, row := range grid {
				for c, e := range row {
					if e == "" {
						d.Geo(f, 40+float64(c)*150, contentY+float64(r)*150, 140, 140, Geo{Color: "grey", Dash: "dashed"})
					} else {
						card(d, f, 40+float64(c)*150, contentY+float64(r)*150, 140, 140, Card{Emoji: e}, "light-blue")
					}
				}
			}
			cardGrid(d, f, 760, contentY, 140, 140, 16, 4, emojis("🍎", "🍎", "🍌", "🍌", "🍇", "🍇", "🍓", "🍓"), "yellow")
			big(d, f, 760, contentY+340, 620, "🍓 тоже нужна: в каждом ряду четыре разные картинки", 0.6)
		}},
		{Key: "what-first", Name: "Что сначала, что потом", Description: "Последовательности: семечко и цветок, яйцо и цыплёнок.", Topic: "logic", Ages: []string{"4-5", "5-6"}, Duration: 15, Glyph: "1→2", Build: func(d *Doc) {
			f := lesson(d, "Что сначала, что потом", "Расставь картинки по порядку: что было сначала, что потом, чем закончилось.")
			cardRow(d, f, 40, contentY, 200, 180, 30, emojis("🌻", "🌱", "🌰"), "light-green")
			slots(d, f, 800, contentY, 200, 180, 30, 3)
			cardRow(d, f, 40, contentY+230, 200, 180, 30, emojis("🐔", "🥚", "🐣"), "yellow")
			slots(d, f, 800, contentY+230, 200, 180, 30, 3)
			cardRow(d, f, 40, contentY+460, 200, 180, 30, emojis("🍞", "🌾", "🌽"), "orange")
			slots(d, f, 800, contentY+460, 200, 180, 30, 3)
		}},
		{Key: "same-same", Name: "Найди одинаковые", Description: "Среди похожих картинок находим две одинаковые.", Topic: "logic", Ages: []string{"3-4", "4-5"}, Duration: 10, Glyph: "👀", Build: func(d *Doc) {
			f := lesson(d, "Найди одинаковые", "В каждом ряду спрятались две одинаковые картинки. Найди и обведи их.")
			rows := [][]string{{"🐱", "🐶", "🐱", "🐭", "🐰", "🦊"}, {"🚗", "🚕", "🚙", "🚗", "🚌", "🚓"}, {"🌸", "🌼", "🌻", "🌷", "🌼", "🌹"}}
			for r, row := range rows {
				cardRow(d, f, 40, contentY+float64(r)*210, 200, 190, 30, emojis(row...), colorAt(r))
			}
		}},
		{Key: "memory-grid", Name: "Запомни и найди", Description: "Запоминаем картинки, закрываем и вспоминаем, что где лежало.", Topic: "logic", Ages: []string{"5-6", "6-7"}, Duration: 15, Glyph: "🧠", Build: func(d *Doc) {
			f := lesson(d, "Запомни и найди", "Посмотри на картинки и запомни. Воспитатель закрывает их карточками, а вы вспоминаете, что где лежало.")
			cardGrid(d, f, 40, contentY, 200, 200, 20, 4, emojis("🍎", "⭐", "🐱", "🚗", "🌸", "🎈", "🐟", "🔑"), "light-blue")
			cardGrid(d, f, 1000, contentY, 110, 110, 10, 4, words("?", "?", "?", "?", "?", "?", "?", "?"), "grey")
		}},
		{Key: "sort-by-size", Name: "Три медведя", Description: "Подбираем каждому медведю посуду по размеру.", Topic: "logic", Ages: []string{"3-4", "4-5"}, Duration: 15, Glyph: "🐻", Build: func(d *Doc) {
			f := lesson(d, "Три медведя", "Три медведя сели обедать. Большому нужна большая миска, среднему средняя, маленькому маленькая. Разложи посуду.")
			sizes := []float64{260, 190, 120}
			for i, s := range sizes {
				card(d, f, 60+float64(i)*320, contentY+260-s, s, s, Card{Emoji: "🐻"}, "orange")
			}
			bowl := []float64{120, 260, 190}
			for i, s := range bowl {
				card(d, f, 1000+float64(i)*50, contentY+280-s*0.9+float64(i)*110, s*0.9, s*0.6, Card{Emoji: "🥣"}, "light-blue")
			}
			zones(d, f, 40, 560, 460, 240, 40, "Большому", "Среднему", "Маленькому")
		}},
		{Key: "tangram", Name: "Сложи из фигур", Description: "Домик, ёлка и кораблик из кругов, квадратов и треугольников.", Topic: "logic", Ages: []string{"4-5", "5-6"}, Duration: 20, Glyph: "🏠", Build: func(d *Doc) {
			f := lesson(d, "Сложи из фигур", "Собери из фигур домик, ёлочку и кораблик, как на образце. Какие фигуры понадобились?")
			d.Geo(f, 60, contentY+120, 160, 140, Geo{Color: "blue", Fill: "semi", Dash: "solid"})
			d.Geo(f, 40, contentY, 200, 120, Geo{Kind: "triangle", Color: "red", Fill: "semi", Dash: "solid"})
			d.Geo(f, 360, contentY, 180, 120, Geo{Kind: "triangle", Color: "green", Fill: "semi", Dash: "solid"})
			d.Geo(f, 340, contentY+100, 220, 160, Geo{Kind: "triangle", Color: "green", Fill: "semi", Dash: "solid"})
			d.Geo(f, 430, contentY+260, 40, 60, Geo{Color: "orange", Fill: "solid", Dash: "solid"})
			d.Text(f, 40, contentY+340, 600, "Образцы: домик и ёлочка", Text{Size: "m"})
			kinds := []string{"rectangle", "triangle", "triangle", "ellipse", "rectangle", "triangle", "rectangle", "ellipse", "triangle", "trapezoid"}
			colors := []string{"blue", "red", "green", "yellow", "orange", "green", "light-blue", "violet", "red", "orange"}
			for i, k := range kinds {
				d.Geo(f, 760+float64(i%5)*145, contentY+float64(i/5)*145, 125, 125, Geo{Kind: k, Color: colors[i], Fill: "semi", Dash: "solid"})
			}
			zones(d, f, 40, 560, 460, 260, 40, "Домик", "Ёлочка", "Кораблик")
		}},
		{Key: "count-shapes", Name: "Сколько треугольников", Description: "Считаем фигуры в картинке из фигур.", Topic: "logic", Ages: []string{"5-6", "6-7"}, Duration: 15, Glyph: "△3", Build: func(d *Doc) {
			f := lesson(d, "Сколько треугольников", "Сосчитай на картинке все треугольники, круги и квадраты. Запиши ответы в окошки.")
			d.Geo(f, 160, contentY, 240, 120, Geo{Kind: "triangle", Color: "red", Fill: "semi", Dash: "solid"})
			d.Geo(f, 200, contentY+120, 160, 160, Geo{Color: "blue", Fill: "semi", Dash: "solid"})
			d.Geo(f, 250, contentY+170, 60, 60, Geo{Kind: "ellipse", Color: "yellow", Fill: "solid", Dash: "solid"})
			d.Geo(f, 480, contentY+100, 140, 90, Geo{Kind: "triangle", Color: "green", Fill: "semi", Dash: "solid"})
			d.Geo(f, 470, contentY+190, 160, 90, Geo{Kind: "triangle", Color: "green", Fill: "semi", Dash: "solid"})
			d.Geo(f, 700, contentY+60, 120, 120, Geo{Kind: "ellipse", Color: "orange", Fill: "solid", Dash: "solid"})
			d.Geo(f, 720, contentY+180, 80, 100, Geo{Color: "blue", Fill: "semi", Dash: "solid"})
			d.Geo(f, 900, contentY+40, 100, 100, Geo{Kind: "triangle", Color: "red", Fill: "semi", Dash: "solid"})
			lines(d, f, 40, 520, 600, "l", "Треугольников: ____", "Кругов: ____", "Квадратов: ____")
			numberCards(d, f, 760, 540, 110, 20, 1, 5, "yellow")
		}},
		{Key: "logic-chain", Name: "Логические цепочки", Description: "Что к чему относится: гнездо и птица, улей и пчела.", Topic: "logic", Ages: []string{"5-6", "6-7"}, Duration: 15, Glyph: "🔗", Build: func(d *Doc) {
			f := lesson(d, "Логические цепочки", "Подбери к каждой картинке слева то, что с ней связано, и объясни связь.")
			cardGrid(d, f, 40, contentY, 190, 150, 16, 1, emojis("🐝", "🔑", "🌧️", "🍳"), "light-blue")
			cardGrid(d, f, 1290, contentY, 190, 150, 16, 1, emojis("☂️", "🍯", "🥚", "🔒"), "light-green")
		}},
	}
}
