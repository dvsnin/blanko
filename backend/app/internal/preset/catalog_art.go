package preset

func drawingPresets() []Preset {
	return []Preset{
		{Key: "free-drawing", Name: "Свободное рисование", Description: "Большие кисти, штампы и заливка. Без задания.", Topic: "drawing", Ages: []string{"3-4", "4-5", "5-6", "6-7"}, Duration: 20, Build: func(d *Doc) {
			f := lesson(d, "Свободное рисование", "Рисуй, что хочешь: выбери инструмент «карандаш» и цвет на панели. Большой лист ждёт.")
			d.Geo(f, 40, contentY, 1440, 640, Geo{Color: "white", Fill: "solid", Dash: "solid"})
			cardRow(d, f, 60, contentY+20, 90, 90, 10, emojis("🔴", "🟠", "🟡", "🟢", "🔵", "🟣"), "white")
		}},
		{Key: "color-by-number", Name: "Раскраска по номерам", Description: "Каждому номеру свой цвет: закрепляем цифры и цвета.", Topic: "drawing", Ages: []string{"5-6", "6-7"}, Duration: 20, Build: func(d *Doc) {
			f := lesson(d, "Раскраска по номерам", "Раскрась фигуры: 1 красный, 2 жёлтый, 3 зелёный, 4 синий. Выбери цвет и инструмент «заливка».")
			legend := []string{"1 🔴", "2 🟡", "3 🟢", "4 🔵"}
			cardRow(d, f, 40, contentY, 150, 90, 20, words(legend...), "white")
			d.Geo(f, 200, contentY+150, 400, 180, Geo{Kind: "triangle", Color: "black", Size: "xl", Label: "1"})
			d.Geo(f, 230, contentY+330, 340, 260, Geo{Color: "black", Size: "xl", Label: "2"})
			d.Geo(f, 300, contentY+450, 90, 140, Geo{Color: "black", Size: "xl", Label: "4"})
			d.Geo(f, 760, contentY+130, 180, 180, Geo{Kind: "ellipse", Color: "black", Size: "xl", Label: "2"})
			d.Geo(f, 820, contentY+310, 60, 280, Geo{Color: "black", Size: "xl", Label: "3"})
			d.Geo(f, 1000, contentY+200, 380, 390, Geo{Kind: "cloud", Color: "black", Size: "xl", Label: "4"})
		}},
		{Key: "finish-drawing", Name: "Дорисуй картинку", Description: "Половина картинки есть, вторую дорисовываем сами.", Topic: "drawing", Ages: []string{"4-5", "5-6"}, Duration: 20, Build: func(d *Doc) {
			f := lesson(d, "Дорисуй картинку", "У каждой фигуры не хватает деталей. Дорисуй домику окно и дверь, солнышку лучи, цветку лепестки.")
			d.Geo(f, 80, contentY+120, 260, 240, Geo{Color: "orange", Fill: "semi", Dash: "solid"})
			d.Geo(f, 60, contentY, 300, 120, Geo{Kind: "triangle", Color: "red", Fill: "semi", Dash: "solid"})
			d.Geo(f, 560, contentY+60, 220, 220, Geo{Kind: "ellipse", Color: "yellow", Fill: "solid", Dash: "solid"})
			d.Geo(f, 1040, contentY+120, 120, 120, Geo{Kind: "ellipse", Color: "orange", Fill: "solid", Dash: "solid"})
			d.Geo(f, 1090, contentY+240, 20, 240, Geo{Color: "green", Fill: "solid", Dash: "solid"})
			lines(d, f, 40, 580, 1400, "l", "Домик 🏠            Солнышко ☀️            Цветок 🌸")
		}},
		{Key: "symmetry", Name: "Вторая половинка", Description: "Бабочка и ёлка: рисуем зеркальную половину.", Topic: "drawing", Ages: []string{"5-6", "6-7"}, Duration: 20, Build: func(d *Doc) {
			f := lesson(d, "Вторая половинка", "Слева от линии половина картинки. Нарисуй справа такую же, как в зеркале.")
			d.Geo(f, 400, contentY, 6, 620, Geo{Color: "black", Fill: "solid", Dash: "solid"})
			d.Geo(f, 160, contentY+60, 240, 180, Geo{Kind: "ellipse", Color: "violet", Fill: "semi", Dash: "solid"})
			d.Geo(f, 200, contentY+260, 200, 160, Geo{Kind: "ellipse", Color: "light-violet", Fill: "semi", Dash: "solid"})
			d.Geo(f, 380, contentY+40, 40, 420, Geo{Kind: "ellipse", Color: "black", Fill: "solid", Dash: "solid"})
			d.Geo(f, 1040, contentY, 6, 620, Geo{Color: "black", Fill: "solid", Dash: "solid"})
			d.Geo(f, 880, contentY+40, 160, 160, Geo{Kind: "triangle", Color: "green", Fill: "semi", Dash: "solid"})
			d.Geo(f, 820, contentY+180, 220, 200, Geo{Kind: "triangle", Color: "green", Fill: "semi", Dash: "solid"})
			d.Geo(f, 760, contentY+360, 280, 220, Geo{Kind: "triangle", Color: "green", Fill: "semi", Dash: "solid"})
		}},
		{Key: "dot-to-dot", Name: "Соедини точки", Description: "Точки с номерами: соединяем по порядку и получаем картинку.", Topic: "drawing", Ages: []string{"5-6", "6-7"}, Duration: 15, Build: func(d *Doc) {
			f := lesson(d, "Соедини точки", "Соедини точки по порядку от 1 до 8 карандашом. Что получилось? Раскрась.")
			pts := [][2]float64{{300, 0}, {560, 180}, {480, 180}, {480, 420}, {120, 420}, {120, 180}, {40, 180}}
			for i, p := range pts {
				d.Geo(f, 40+p[0], contentY+p[1], 70, 70, Geo{Kind: "ellipse", Color: "black", Fill: "solid", Dash: "solid", Size: "l", Label: string(rune('1' + i)), LabelColor: "white"})
			}
			pts2 := [][2]float64{{0, 300}, {120, 100}, {280, 0}, {440, 100}, {560, 300}, {280, 420}}
			for i, p := range pts2 {
				d.Geo(f, 820+p[0], contentY+p[1], 70, 70, Geo{Kind: "ellipse", Color: "blue", Fill: "solid", Dash: "solid", Size: "l", Label: string(rune('1' + i)), LabelColor: "white"})
			}
		}},
		{Key: "palette-mix", Name: "Смешиваем цвета", Description: "Жёлтый и синий дают зелёный: угадываем и проверяем.", Topic: "drawing", Ages: []string{"4-5", "5-6"}, Duration: 20, Build: func(d *Doc) {
			f := lesson(d, "Смешиваем цвета", "Какой цвет получится, если смешать два цвета? Угадай, положи ответ в окошко, потом проверь красками.")
			rows := [][3]string{{"yellow", "blue", "?"}, {"red", "yellow", "?"}, {"red", "blue", "?"}, {"red", "white", "?"}}
			for r, row := range rows {
				y := contentY + float64(r)*150
				d.Geo(f, 40, y, 130, 130, Geo{Kind: "ellipse", Color: row[0], Fill: "solid", Dash: "solid"})
				d.Text(f, 190, y+40, 60, "+", Text{Size: "xl"})
				d.Geo(f, 260, y, 130, 130, Geo{Kind: "ellipse", Color: row[1], Fill: "solid", Dash: "solid"})
				d.Text(f, 410, y+40, 60, "=", Text{Size: "xl"})
				d.Geo(f, 480, y, 130, 130, Geo{Kind: "ellipse", Color: "grey", Dash: "dashed", Size: "xl", Label: "?"})
			}
			for i, c := range []string{"green", "orange", "violet", "light-red"} {
				d.Geo(f, 800+float64(i)*160, contentY+100, 130, 130, Geo{Kind: "ellipse", Color: c, Fill: "solid", Dash: "solid"})
			}
		}},
		{Key: "draw-mood", Name: "Нарисуй настроение", Description: "Весёлое, грустное, спокойное: цвета и линии настроения.", Topic: "drawing", Ages: []string{"4-5", "5-6", "6-7"}, Duration: 20, Build: func(d *Doc) {
			f := lesson(d, "Нарисуй настроение", "Какое у тебя сегодня настроение? Выбери цвета и нарисуй его в своём окошке. Расскажи, почему такие цвета.")
			cardRow(d, f, 40, contentY, 170, 150, 20, cards("😊", "Радость", "😢", "Грусть", "😠", "Злость", "😌", "Спокойствие", "😲", "Удивление"), "")
			zones(d, f, 40, 380, 340, 420, 26, "Окошко 1", "Окошко 2", "Окошко 3", "Окошко 4")
		}},
		{Key: "draw-by-cells", Name: "Рисуем по клеточкам", Description: "Повторяем узор по клеткам: вправо, вниз, влево.", Topic: "drawing", Ages: []string{"6-7"}, Duration: 20, Build: func(d *Doc) {
			f := lesson(d, "Рисуем по клеточкам", "Слушай команды: две клетки вправо, одна вниз. Веди линию по клеткам и получи картинку, как на образце.")
			for r := 0; r < 8; r++ {
				for c := 0; c < 18; c++ {
					d.Geo(f, 40+float64(c)*80, contentY+float64(r)*80, 80, 80, Geo{Color: "grey", Dash: "solid"})
				}
			}
			d.Geo(f, 1360, 60, 120, 120, Geo{Color: "light-blue", Fill: "semi", Dash: "solid", Size: "xl", Label: "🔑"})
		}},
	}
}

func sensoryPresets() []Preset {
	return []Preset{
		{Key: "colors", Name: "Цвета и оттенки", Description: "Собираем предметы одного цвета, сравниваем светлее и темнее.", Topic: "sensory", Ages: []string{"3-4"}, Duration: 15, Build: func(d *Doc) {
			f := lesson(d, "Цвета и оттенки", "Собери в каждую корзину предметы своего цвета. Назови цвет.")
			cardRow(d, f, 40, contentY, 150, 150, 21, emojis("🍎", "🐸", "🌞", "🫐", "🍓", "🥒", "🍋", "🚙"), "white")
			z := zones(d, f, 40, 400, 340, 400, 26, "Красный", "Зелёный", "Жёлтый", "Синий")
			for i, c := range []string{"red", "green", "yellow", "blue"} {
				d.Geo(z[i], 20, 60, 300, 300, Geo{Color: c, Fill: "semi", Dash: "dashed"})
			}
		}},
		{Key: "warm-cold", Name: "Тёплые и холодные цвета", Description: "Солнце и костёр, море и лёд: два семейства цветов.", Topic: "sensory", Ages: []string{"5-6", "6-7"}, Duration: 15, Build: func(d *Doc) {
			f := lesson(d, "Тёплые и холодные цвета", "Тёплые цвета как солнце и огонь, холодные как море и лёд. Разложи кружки по двум полям.")
			for i, c := range []string{"red", "blue", "orange", "light-blue", "yellow", "violet", "light-red", "green"} {
				d.Geo(f, 40+float64(i)*180, contentY, 150, 150, Geo{Kind: "ellipse", Color: c, Fill: "solid", Dash: "solid"})
			}
			zones(d, f, 40, 400, 700, 400, 40, "Тёплые 🔥", "Холодные ❄️")
		}},
		{Key: "light-dark", Name: "Светлее и темнее", Description: "Выстраиваем оттенки от самого светлого к самому тёмному.", Topic: "sensory", Ages: []string{"4-5", "5-6"}, Duration: 15, Build: func(d *Doc) {
			f := lesson(d, "Светлее и темнее", "Расставь кружки от самого светлого к самому тёмному. Где светлее, где темнее?")
			for i, c := range []string{"blue", "light-blue", "white", "black", "grey"} {
				d.Geo(f, 40+float64(i)*200, contentY, 160, 160, Geo{Kind: "ellipse", Color: c, Fill: "solid", Dash: "solid"})
			}
			slots(d, f, 40, 460, 160, 160, 40, 5)
			d.Text(f, 40, 640, 300, "светлее", Text{Size: "l"})
			d.Text(f, 800, 640, 300, "темнее", Text{Size: "l", Align: "end"})
		}},
		{Key: "big-medium-small", Name: "Большой, средний, маленький", Description: "Сравниваем размеры и раскладываем по трём коробкам.", Topic: "sensory", Ages: []string{"3-4"}, Duration: 15, Build: func(d *Doc) {
			f := lesson(d, "Большой, средний, маленький", "Положи большие предметы в большую коробку, средние в среднюю, маленькие в маленькую.")
			sizes := []float64{200, 90, 140, 200, 90, 140}
			kinds := []string{"ellipse", "rectangle", "star", "triangle", "heart", "ellipse"}
			colors := []string{"red", "blue", "yellow", "green", "violet", "orange"}
			for i := range sizes {
				d.Geo(f, 40+float64(i)*240, contentY+200-sizes[i], sizes[i], sizes[i], Geo{Kind: kinds[i], Color: colors[i], Fill: "solid", Dash: "solid"})
			}
			d.Frame(f, 40, 440, 520, 380, "Большая коробка")
			d.Frame(f, 620, 520, 380, 300, "Средняя коробка")
			d.Frame(f, 1060, 600, 260, 220, "Маленькая коробка")
		}},
		{Key: "loud-quiet", Name: "Громко и тихо", Description: "Что звучит громко, а что тихо: слушаем и показываем.", Topic: "sensory", Ages: []string{"3-4", "4-5"}, Duration: 15, Build: func(d *Doc) {
			f := lesson(d, "Громко и тихо", "Как звучит каждый предмет: громко или тихо? Разложи картинки и покажи звук голосом.")
			cardRow(d, f, 40, contentY, 165, 160, 20, cards("🥁", "Барабан", "🐭", "Мышка", "✈️", "Самолёт", "🍃", "Листик", "🚒", "Сирена", "🐱", "Котёнок", "⛈️", "Гром", "🕰️", "Часы"), "")
			zones(d, f, 40, 420, 700, 380, 40, "Громко 🔊", "Тихо 🔈")
		}},
		{Key: "textures", Name: "Гладкое и пушистое", Description: "Какой предмет на ощупь: гладкий, пушистый, колючий.", Topic: "sensory", Ages: []string{"3-4", "4-5"}, Duration: 15, Build: func(d *Doc) {
			f := lesson(d, "Гладкое и пушистое", "Вспомни, какой предмет на ощупь, и положи его в нужную рамку. Потом потрогай похожие предметы в группе.")
			cardRow(d, f, 40, contentY, 165, 160, 20, cards("🐱", "Котёнок", "🪞", "Зеркало", "🦔", "Ёжик", "🧶", "Клубок", "🥚", "Яйцо", "🌵", "Кактус", "🧸", "Мишка", "🍎", "Яблоко"), "")
			zones(d, f, 40, 420, 460, 380, 40, "Гладкое", "Пушистое", "Колючее")
		}},
	}
}
