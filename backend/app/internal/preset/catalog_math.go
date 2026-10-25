package preset

import "strconv"

func mathPresets() []Preset {
	return []Preset{
		{Key: "count-to-5", Name: "Счёт до 5 с яблоками", Description: "Дети перетаскивают яблоки в корзину и считают вслух.", Topic: "math", Ages: []string{"3-4", "4-5"}, Duration: 20, Glyph: "5", Build: func(d *Doc) {
			f := lesson(d, "Счёт до 5 с яблоками", "Перетащи в корзину столько яблок, сколько показывает число. Считай вслух: один, два, три...")
			cardRow(d, f, 40, contentY, 150, 150, 20, emojis("🍎", "🍎", "🍎", "🍎", "🍎", "🍏", "🍏", "🍏"), "light-red")
			zones(d, f, 40, 400, 440, 400, 40, "Корзина 1", "Корзина 2", "Корзина 3")
			numberCards(d, f, 100, 700, 90, 50, 1, 5, "yellow")
		}},
		{Key: "count-to-10", Name: "Счёт до 10 и обратно", Description: "Числовая дорожка, пропущенные числа, обратный счёт.", Topic: "math", Ages: []string{"5-6", "6-7"}, Duration: 25, Glyph: "10", Build: func(d *Doc) {
			f := lesson(d, "Счёт до 10 и обратно", "Впиши пропущенные числа на дорожке. Потом прочитай дорожку назад: десять, девять, восемь...")
			for i := 1; i <= 10; i++ {
				label := strconv.Itoa(i)
				if i == 3 || i == 6 || i == 9 {
					label = "?"
				}
				d.Geo(f, 40+float64(i-1)*146, contentY, 130, 130, Geo{Color: "light-blue", Fill: "semi", Dash: "solid", Size: "xl", Label: label})
			}
			d.Text(f, 40, 360, 700, "Обратный счёт:", Text{Size: "l"})
			slots(d, f, 40, 420, 130, 130, 16, 10)
			cardRow(d, f, 40, 620, 120, 120, 12, words("10", "9", "8", "7", "6", "5", "4", "3", "2", "1"), "")
		}},
		{Key: "number-composition", Name: "Состав числа", Description: "Домики чисел: раскладываем число на два слагаемых.", Topic: "math", Ages: []string{"6-7"}, Duration: 25, Glyph: "7", Build: func(d *Doc) {
			f := lesson(d, "Состав числа", "В крыше домика живёт число. В каждом этаже два соседа, которые вместе дают это число. Заполни пустые окошки.")
			houses := [][]string{{"5", "4", "?", "3", "?", "2", "?", "1", "?"}, {"7", "6", "?", "5", "?", "4", "?", "3", "?"}, {"10", "9", "?", "8", "?", "7", "?", "6", "?"}}
			for h, house := range houses {
				x := 40 + float64(h)*500
				d.Geo(f, x, contentY, 420, 110, Geo{Kind: "triangle", Color: "red", Fill: "semi", Dash: "solid", Size: "xl", Label: house[0]})
				for row := 0; row < 4; row++ {
					y := contentY + 120 + float64(row)*120
					d.Geo(f, x+40, y, 160, 110, Geo{Color: "light-blue", Fill: "semi", Dash: "solid", Size: "xl", Label: house[1+row*2]})
					d.Geo(f, x+220, y, 160, 110, Geo{Color: "light-blue", Fill: "semi", Dash: "solid", Size: "xl", Label: house[2+row*2]})
				}
			}
		}},
		{Key: "shapes", Name: "Фигуры: круг, квадрат, треугольник", Description: "Сортируем фигуры по форме и находим их в предметах.", Topic: "math", Ages: []string{"3-4", "4-5"}, Duration: 20, Glyph: "△", Build: func(d *Doc) {
			f := lesson(d, "Фигуры: круг, квадрат, треугольник", "Разложи фигуры по домикам. Потом найди в группе предметы такой же формы.")
			kinds := []string{"ellipse", "rectangle", "triangle", "ellipse", "triangle", "rectangle", "ellipse", "triangle", "rectangle"}
			colors := []string{"red", "blue", "green", "yellow", "violet", "orange", "light-blue", "light-green", "light-red"}
			for i, k := range kinds {
				d.Geo(f, 40+float64(i)*160, contentY, 130, 130, Geo{Kind: k, Color: colors[i], Fill: "solid", Dash: "solid"})
			}
			zones(d, f, 40, 400, 460, 400, 40, "Круги", "Квадраты", "Треугольники")
			cardRow(d, f, 60, 440, 100, 100, 10, emojis("🕐", "🎁", "🍕"), "grey")
		}},
		{Key: "count-animals", Name: "Сколько зверей", Description: "Считаем животных в каждой рамке и подбираем цифру.", Topic: "math", Ages: []string{"3-4", "4-5"}, Duration: 15, Glyph: "🐾", Build: func(d *Doc) {
			f := lesson(d, "Сколько зверей", "Сосчитай зверей в каждом окошке и положи рядом нужную цифру.")
			groups := []string{"🐱", "🐶🐶", "🐰🐰🐰", "🐦🐦🐦🐦", "🐟🐟🐟🐟🐟"}
			for i, g := range groups {
				d.Geo(f, 40+float64(i)*296, contentY, 270, 230, Geo{Color: "light-green", Fill: "semi", Dash: "solid"})
				big(d, f, 40+float64(i)*296, contentY+40, 270, g, 1.6)
				d.Geo(f, 40+float64(i)*296+85, contentY+250, 100, 100, Geo{Color: "grey", Dash: "dashed", Size: "xl", Label: "?"})
			}
			cardRow(d, f, 240, 600, 110, 110, 30, words("3", "1", "5", "2", "4"), "yellow")
		}},
		{Key: "more-less", Name: "Больше, меньше, поровну", Description: "Сравниваем две группы предметов и ставим знак.", Topic: "math", Ages: []string{"4-5", "5-6"}, Duration: 20, Glyph: ">", Build: func(d *Doc) {
			f := lesson(d, "Больше, меньше, поровну", "Где предметов больше? Поставь между окошками нужный знак: больше, меньше или равно.")
			pairs := [][2]string{{"🍓🍓🍓", "🍓🍓"}, {"🚗🚗", "🚗🚗🚗🚗"}, {"⭐⭐⭐", "⭐⭐⭐"}}
			for i, p := range pairs {
				y := contentY + float64(i)*200
				d.Geo(f, 40, y, 480, 170, Geo{Color: "light-blue", Fill: "semi", Dash: "solid"})
				big(d, f, 40, y+30, 480, p[0], 1.5)
				d.Geo(f, 560, y+35, 100, 100, Geo{Color: "grey", Dash: "dashed", Size: "xl", Label: "?"})
				d.Geo(f, 700, y, 480, 170, Geo{Color: "light-green", Fill: "semi", Dash: "solid"})
				big(d, f, 700, y+30, 480, p[1], 1.5)
			}
			for r := 0; r < 3; r++ {
				cardRow(d, f, 1200, contentY+float64(r)*200, 95, 95, 10, words(">", "<", "="), "yellow")
			}
		}},
		{Key: "add-within-5", Name: "Сложение до 5", Description: "Складываем картинки и подбираем ответ.", Topic: "math", Ages: []string{"5-6"}, Duration: 20, Glyph: "+", Build: func(d *Doc) {
			f := lesson(d, "Сложение до 5", "Сосчитай картинки слева и справа от плюса. Сколько всего? Положи ответ в окошко.")
			tasks := []string{"🍎🍎 + 🍎", "🐤 + 🐤🐤🐤", "🚂🚂 + 🚂🚂", "🌸 + 🌸🌸🌸🌸"}
			for i, t := range tasks {
				y := contentY + float64(i)*150
				d.Geo(f, 40, y, 900, 120, Geo{Color: "light-blue", Fill: "semi", Dash: "solid"})
				big(d, f, 60, y+22, 860, t+"  =", 1.3)
				d.Geo(f, 980, y+10, 100, 100, Geo{Color: "grey", Dash: "dashed", Size: "xl", Label: "?"})
			}
			numberCards(d, f, 1160, contentY, 110, 20, 1, 3, "yellow")
			numberCards(d, f, 1160, contentY+140, 110, 20, 4, 5, "yellow")
			numberCards(d, f, 1160, contentY+280, 110, 20, 3, 5, "yellow")
		}},
		{Key: "add-within-10", Name: "Примеры до 10", Description: "Сложение и вычитание в пределах десяти с числовой дорожкой.", Topic: "math", Ages: []string{"6-7"}, Duration: 25, Glyph: "=", Build: func(d *Doc) {
			f := lesson(d, "Примеры до 10", "Реши примеры. Если трудно, шагай по числовой дорожке: вперёд при сложении, назад при вычитании.")
			numberCards(d, f, 40, contentY, 120, 26, 1, 10, "light-green")
			tasks := []string{"3 + 4 =", "8 - 5 =", "6 + 2 =", "10 - 7 =", "5 + 5 =", "9 - 3 ="}
			for i, t := range tasks {
				x := 40 + float64(i%3)*490
				y := contentY + 180 + float64(i/3)*180
				plate(d, f, x, y, 320, 120, t, "light-blue")
				d.Geo(f, x+340, y+10, 100, 100, Geo{Color: "grey", Dash: "dashed", Size: "xl", Label: "?"})
			}
		}},
		{Key: "pattern-continue", Name: "Продолжи ряд", Description: "Повторяющиеся узоры из фигур и картинок: что идёт дальше?", Topic: "math", Ages: []string{"4-5", "5-6"}, Duration: 15, Glyph: "…", Build: func(d *Doc) {
			f := lesson(d, "Продолжи ряд", "Посмотри, как чередуются картинки, и перетащи в пустые окошки то, что идёт дальше.")
			rows := [][]string{{"🔴", "🔵", "🔴", "🔵", "", ""}, {"🍎", "🍎", "🍌", "🍎", "🍎", ""}, {"⭐", "🌙", "☀️", "⭐", "🌙", ""}}
			for r, row := range rows {
				for i, e := range row {
					if e == "" {
						d.Geo(f, 40+float64(i)*150, contentY+float64(r)*170, 130, 130, Geo{Color: "grey", Dash: "dashed", Size: "xl", Label: "?"})
					} else {
						card(d, f, 40+float64(i)*150, contentY+float64(r)*170, 130, 130, Card{Emoji: e}, "light-blue")
					}
				}
			}
			cardGrid(d, f, 1040, contentY, 130, 130, 20, 3, emojis("🔴", "🔵", "🍌", "🍎", "☀️", "⭐"), "yellow")
		}},
		{Key: "size-order", Name: "Разложи по росту", Description: "От самого маленького к самому большому и наоборот.", Topic: "math", Ages: []string{"3-4", "4-5"}, Duration: 15, Glyph: "📏", Build: func(d *Doc) {
			f := lesson(d, "Разложи по росту", "Расставь матрёшек от самой маленькой к самой большой. Потом ёлочки от большой к маленькой.")
			sizes := []float64{90, 150, 120, 60, 180}
			for i, s := range sizes {
				g := d.Group(f, 60+float64(i)*180, contentY+200-s)
				d.Geo(g, 0, 0, s*0.7, s, Geo{Kind: "ellipse", Color: "red", Fill: "semi", Dash: "solid"})
			}
			slots(d, f, 40, 440, 150, 190, 24, 5)
			tree := []float64{140, 80, 200, 110, 170}
			for i, s := range tree {
				d.Geo(f, 960+float64(i)*110, contentY+200-s, 90, s, Geo{Kind: "triangle", Color: "green", Fill: "semi", Dash: "solid"})
			}
			d.Text(f, 960, 440, 500, "Ёлочки: от большой к маленькой", Text{Size: "m"})
			slots(d, f, 960, 490, 95, 140, 12, 5)
		}},
		{Key: "number-neighbors", Name: "Соседи числа", Description: "Какое число стоит перед и после: заполняем окошки.", Topic: "math", Ages: []string{"5-6", "6-7"}, Duration: 15, Glyph: "4", Build: func(d *Doc) {
			f := lesson(d, "Соседи числа", "У каждого числа есть соседи: одно стоит перед ним, другое после. Впиши их в пустые окошки.")
			nums := []string{"4", "7", "2", "9", "5", "8"}
			for i, n := range nums {
				x := 40 + float64(i%3)*490
				y := contentY + float64(i/3)*200
				d.Geo(f, x, y, 130, 130, Geo{Color: "grey", Dash: "dashed", Size: "xl", Label: "?"})
				d.Geo(f, x+150, y, 130, 130, Geo{Color: "orange", Fill: "semi", Dash: "solid", Size: "xl", Label: n})
				d.Geo(f, x+300, y, 130, 130, Geo{Color: "grey", Dash: "dashed", Size: "xl", Label: "?"})
			}
			numberCards(d, f, 40, 620, 110, 24, 1, 10, "light-blue")
		}},
		{Key: "shapes-in-things", Name: "На что похоже", Description: "Ищем круги, квадраты и треугольники в предметах вокруг.", Topic: "math", Ages: []string{"4-5", "5-6"}, Duration: 15, Glyph: "◯", Build: func(d *Doc) {
			f := lesson(d, "На что похоже", "Соедини предмет с фигурой, на которую он похож. Назови ещё предметы такой формы в группе.")
			kinds := []string{"ellipse", "rectangle", "triangle"}
			for i, k := range kinds {
				d.Geo(f, 60, contentY+float64(i)*210, 170, 170, Geo{Kind: k, Color: []string{"red", "blue", "green"}[i], Fill: "semi", Dash: "solid"})
			}
			cardGrid(d, f, 500, contentY, 170, 170, 30, 5, emojis("⚽", "📺", "🍕", "🎈", "📦", "⛺", "🍪", "🚪", "🔔", "🪁"), "")
		}},
		{Key: "count-and-match", Name: "Сосчитай и соедини", Description: "Группы предметов и цифры: проводим линии между ними.", Topic: "math", Ages: []string{"4-5", "5-6"}, Duration: 15, Glyph: "🔢", Build: func(d *Doc) {
			f := lesson(d, "Сосчитай и соедини", "Сосчитай предметы слева и проведи линию к нужной цифре справа.")
			groups := []string{"🎈🎈🎈🎈", "🐞🐞", "🌻🌻🌻🌻🌻", "🚀", "🍭🍭🍭"}
			nums := []string{"3", "5", "1", "4", "2"}
			for i := range groups {
				y := contentY + float64(i)*125
				d.Geo(f, 40, y, 520, 100, Geo{Color: "light-green", Fill: "semi", Dash: "solid"})
				big(d, f, 40, y+18, 520, groups[i], 1.1)
				d.Geo(f, 1200, y, 100, 100, Geo{Kind: "ellipse", Color: "orange", Fill: "semi", Dash: "solid", Size: "xl", Label: nums[i]})
			}
		}},
		{Key: "clock-hours", Name: "Который час", Description: "Целые часы на циферблате и распорядок дня.", Topic: "math", Ages: []string{"6-7"}, Duration: 25, Glyph: "🕒", Build: func(d *Doc) {
			f := lesson(d, "Который час", "Посмотри на часы и подбери подпись: во сколько мы завтракаем, гуляем, обедаем и спим.")
			cardRow(d, f, 40, contentY, 220, 220, 40, emojis("🕗", "🕙", "🕐", "🕒"), "light-blue")
			cardRow(d, f, 40, 520, 220, 150, 40, cards("🍽️", "Обед, 13:00", "🥣", "Завтрак, 8:00", "😴", "Сон, 15:00", "🌳", "Прогулка, 10:00"), "yellow")
		}},
	}
}
