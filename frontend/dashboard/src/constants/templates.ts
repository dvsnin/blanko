export type AgeKey = "3-4" | "4-5" | "5-6" | "6-7";
export const AGES: ReadonlyArray<{ key: AgeKey; label: string }> = [
  { key: "3-4", label: "3–4 года" },
  { key: "4-5", label: "4–5 лет" },
  { key: "5-6", label: "5–6 лет" },
  { key: "6-7", label: "6–7 лет" },
];

export type TopicKey = "math" | "literacy" | "world" | "speech" | "logic" | "drawing" | "sensory" | "routine";
export interface TopicStyle { key: TopicKey; label: string; bg: string; color: string; dot: string }
export const TOPICS: ReadonlyArray<TopicStyle> = [
  { key: "math", label: "Математика", bg: "#FFF3D6", color: "#8A5A00", dot: "#F2B134" },
  { key: "literacy", label: "Грамота", bg: "#E6F4F3", color: "#166562", dot: "#2BA7A0" },
  { key: "world", label: "Окружающий мир", bg: "#E8F6E4", color: "#2F7A1F", dot: "#6AB04C" },
  { key: "speech", label: "Речь", bg: "#FDE8DF", color: "#9A3A1E", dot: "#F7A08C" },
  { key: "logic", label: "Логика", bg: "#EAF1FF", color: "#2E4FB8", dot: "#5B7BE9" },
  { key: "drawing", label: "Рисование", bg: "#F3E8FF", color: "#6D3BB5", dot: "#9B5DE5" },
  { key: "sensory", label: "Сенсорика", bg: "#FFE9F2", color: "#9C2A5B", dot: "#E86AA0" },
  { key: "routine", label: "Режим дня", bg: "#ECE9E0", color: "#4A4F58", dot: "#9AA1AC" },
];

export interface Template { id: string; title: string; desc: string; topic: TopicKey; ages: AgeKey[]; duration: string; glyph: string }
export const TEMPLATES: ReadonlyArray<Template> = [
  { id: "count-to-5", title: "Счёт до 5 с яблоками", desc: "Дети перетаскивают яблоки в корзину и считают вслух.", topic: "math", ages: ["3-4","4-5"], duration: "20 мин", glyph: "5" },
  { id: "count-to-10", title: "Счёт до 10 и обратно", desc: "Числовая дорожка, пропущенные числа, обратный счёт.", topic: "math", ages: ["5-6","6-7"], duration: "25 мин", glyph: "10" },
  { id: "number-composition", title: "Состав числа", desc: "Домики чисел: раскладываем число на два слагаемых.", topic: "math", ages: ["6-7"], duration: "25 мин", glyph: "7" },
  { id: "shapes", title: "Фигуры: круг, квадрат, треугольник", desc: "Сортируем фигуры по форме и находим их в предметах.", topic: "math", ages: ["3-4","4-5"], duration: "20 мин", glyph: "△" },
  { id: "letter", title: "Буква и слова на неё", desc: "Крупная буква, картинки-подсказки, обводим пальцем.", topic: "literacy", ages: ["4-5","5-6"], duration: "20 мин", glyph: "А" },
  { id: "syllables", title: "Слоги и первые слова", desc: "Собираем слоги в слова, слушаем и повторяем.", topic: "literacy", ages: ["5-6","6-7"], duration: "25 мин", glyph: "Ма" },
  { id: "reading", title: "Читаем по слогам", desc: "Короткие тексты с делением на слоги и картинками.", topic: "literacy", ages: ["6-7"], duration: "30 мин", glyph: "Ш" },
  { id: "seasons", title: "Времена года", desc: "Четыре поля: что надеть, что растёт, какая погода.", topic: "world", ages: ["4-5","5-6"], duration: "25 мин", glyph: "Зи" },
  { id: "animals", title: "Домашние и дикие животные", desc: "Расселяем животных по дому и лесу, слушаем голоса.", topic: "world", ages: ["3-4","4-5","5-6"], duration: "20 мин", glyph: "Жи" },
  { id: "fairy-tale", title: "Сказка по картинкам", desc: "Расставляем сцены сказки по порядку и пересказываем.", topic: "speech", ages: ["3-4","4-5"], duration: "25 мин", glyph: "Ре" },
  { id: "story", title: "Расскажи историю", desc: "Герои, место и событие: дети придумывают сюжет сами.", topic: "speech", ages: ["5-6","6-7"], duration: "30 мин", glyph: "Ис" },
  { id: "find-pair", title: "Найди пару", desc: "Варежки, носочки, половинки картинок: соединяем линией.", topic: "logic", ages: ["3-4","4-5"], duration: "15 мин", glyph: "Па" },
  { id: "odd-one-out", title: "Что лишнее", desc: "Четыре картинки, одна не подходит. Объясняем почему.", topic: "logic", ages: ["4-5","5-6","6-7"], duration: "15 мин", glyph: "?" },
  { id: "free-drawing", title: "Свободное рисование", desc: "Большие кисти, штампы и заливка. Без задания.", topic: "drawing", ages: ["3-4","4-5","5-6","6-7"], duration: "20 мин", glyph: "Ки" },
  { id: "color-by-number", title: "Раскраска по номерам", desc: "Каждому номеру свой цвет: закрепляем цифры и цвета.", topic: "drawing", ages: ["5-6","6-7"], duration: "20 мин", glyph: "3" },
  { id: "colors", title: "Цвета и оттенки", desc: "Собираем предметы одного цвета, сравниваем светлее и темнее.", topic: "sensory", ages: ["3-4"], duration: "15 мин", glyph: "●" },
  { id: "morning-circle", title: "Утренний круг", desc: "Кто пришёл, какая погода, план дня. Для начала дня.", topic: "routine", ages: ["3-4","4-5","5-6","6-7"], duration: "10 мин", glyph: "Ут" },
  { id: "weekdays", title: "Дни недели и погода", desc: "Календарь на неделю: отмечаем день и погоду за окном.", topic: "routine", ages: ["5-6","6-7"], duration: "15 мин", glyph: "Пн" },
];

export const LOGO_SVG = "<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#22262E\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 5h16v11H4z\"></path><path d=\"M9 20h6\"></path><path d=\"M12 16v4\"></path><path d=\"M8 12l3-3 2 2 3-4\"></path></svg>";
