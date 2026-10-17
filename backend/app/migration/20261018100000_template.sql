-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS template
(
    id                uuid PRIMARY KEY                                          NOT NULL,
    public_id         varchar(255)                                              NOT NULL,
    preset_key        varchar(64)                                               NULL,
    name              varchar(255)                                              NOT NULL,
    description       varchar(500) DEFAULT ''                                   NOT NULL,
    topic             varchar(32)                                               NOT NULL,
    ages              text[]                                                    NOT NULL,
    duration_min      int                                                       NOT NULL,
    glyph             varchar(4)                                                NULL,
    author_account_id uuid REFERENCES account (id) ON DELETE SET NULL           NULL,
    created_at        timestamptz                                               NOT NULL,
    updated_at        timestamptz                                               NOT NULL,
    deleted_at        timestamptz                                               NULL,

    UNIQUE (public_id),
    UNIQUE (preset_key),
    CHECK (duration_min BETWEEN 5 AND 120)
);
COMMENT ON TABLE template IS 'Шаблоны занятий детского сада. Предустановленные (author_account_id IS NULL, preset_key задан) и созданные воспитателями.';
COMMENT ON COLUMN template.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN template.public_id IS 'Короткий идентификатор для URL /app/template/{public_id}; начинается с «t».';
COMMENT ON COLUMN template.preset_key IS 'Ключ предустановленного шаблона (бывший строковый id в коде). NULL у созданных в саду.';
COMMENT ON COLUMN template.name IS 'Название шаблона.';
COMMENT ON COLUMN template.description IS 'Короткое описание занятия (до 500 символов).';
COMMENT ON COLUMN template.topic IS 'Тема: math, literacy, world, speech, logic, drawing, sensory, routine.';
COMMENT ON COLUMN template.ages IS 'Возрастные группы, подмножество {3-4, 4-5, 5-6, 6-7}.';
COMMENT ON COLUMN template.duration_min IS 'Длительность занятия в минутах, 5..120.';
COMMENT ON COLUMN template.glyph IS 'Глиф обложки (до 4 символов). NULL - считать из названия.';
COMMENT ON COLUMN template.author_account_id IS 'Автор шаблона. NULL - предустановлен при установке.';
COMMENT ON COLUMN template.created_at IS 'Время создания.';
COMMENT ON COLUMN template.updated_at IS 'Время обновления.';
COMMENT ON COLUMN template.deleted_at IS 'Время софт удаления.';
CREATE INDEX IF NOT EXISTS idx_template_author_account_id ON template (author_account_id);

CREATE TABLE IF NOT EXISTS template_starred
(
    account_id  uuid REFERENCES account (id) ON DELETE CASCADE  NOT NULL,
    template_id uuid REFERENCES template (id) ON DELETE CASCADE NOT NULL,
    created_at  timestamptz                                     NOT NULL,
    PRIMARY KEY (account_id, template_id)
);
COMMENT ON TABLE template_starred IS 'Шаблоны, отмеченные пользователем как избранные.';
COMMENT ON COLUMN template_starred.account_id IS 'Идентификатор пользователя.';
COMMENT ON COLUMN template_starred.template_id IS 'Идентификатор шаблона.';
COMMENT ON COLUMN template_starred.created_at IS 'Время создания.';
CREATE INDEX IF NOT EXISTS idx_template_starred_template_id ON template_starred (template_id);

-- Предустановленные шаблоны: вставляются один раз, правки сада не затираются.
INSERT INTO template (id, public_id, preset_key, name, description, topic, ages, duration_min, glyph, author_account_id, created_at, updated_at)
SELECT v.id, v.public_id, v.preset_key, v.name, v.description, v.topic, v.ages, v.duration_min, v.glyph, NULL, now(), now()
FROM (VALUES
    ('00000000-0000-4000-8000-000000000001'::uuid, 't46d76276f2159723', 'count-to-5', 'Счёт до 5 с яблоками', 'Дети перетаскивают яблоки в корзину и считают вслух.', 'math', ARRAY['3-4','4-5']::text[], 20, '5'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 't5092339a91849f4c', 'count-to-10', 'Счёт до 10 и обратно', 'Числовая дорожка, пропущенные числа, обратный счёт.', 'math', ARRAY['5-6','6-7']::text[], 25, '10'),
    ('00000000-0000-4000-8000-000000000003'::uuid, 'tf3d83df5a5870bf0', 'number-composition', 'Состав числа', 'Домики чисел: раскладываем число на два слагаемых.', 'math', ARRAY['6-7']::text[], 25, '7'),
    ('00000000-0000-4000-8000-000000000004'::uuid, 't8a995d2704d5368b', 'shapes', 'Фигуры: круг, квадрат, треугольник', 'Сортируем фигуры по форме и находим их в предметах.', 'math', ARRAY['3-4','4-5']::text[], 20, '△'),
    ('00000000-0000-4000-8000-000000000005'::uuid, 'tf5b75010ea8a54b9', 'letter', 'Буква и слова на неё', 'Крупная буква, картинки-подсказки, обводим пальцем.', 'literacy', ARRAY['4-5','5-6']::text[], 20, 'А'),
    ('00000000-0000-4000-8000-000000000006'::uuid, 'td36567f1b826504d', 'syllables', 'Слоги и первые слова', 'Собираем слоги в слова, слушаем и повторяем.', 'literacy', ARRAY['5-6','6-7']::text[], 25, 'Ма'),
    ('00000000-0000-4000-8000-000000000007'::uuid, 'teceadc1d40cea061', 'reading', 'Читаем по слогам', 'Короткие тексты с делением на слоги и картинками.', 'literacy', ARRAY['6-7']::text[], 30, 'Ш'),
    ('00000000-0000-4000-8000-000000000008'::uuid, 't85ed15c4d405df12', 'seasons', 'Времена года', 'Четыре поля: что надеть, что растёт, какая погода.', 'world', ARRAY['4-5','5-6']::text[], 25, 'Зи'),
    ('00000000-0000-4000-8000-000000000009'::uuid, 'ta723e3dfb497b24c', 'animals', 'Домашние и дикие животные', 'Расселяем животных по дому и лесу, слушаем голоса.', 'world', ARRAY['3-4','4-5','5-6']::text[], 20, 'Жи'),
    ('00000000-0000-4000-8000-000000000010'::uuid, 't7d379ead8a20c9b3', 'fairy-tale', 'Сказка по картинкам', 'Расставляем сцены сказки по порядку и пересказываем.', 'speech', ARRAY['3-4','4-5']::text[], 25, 'Ре'),
    ('00000000-0000-4000-8000-000000000011'::uuid, 'tbec670e5a55424d8', 'story', 'Расскажи историю', 'Герои, место и событие: дети придумывают сюжет сами.', 'speech', ARRAY['5-6','6-7']::text[], 30, 'Ис'),
    ('00000000-0000-4000-8000-000000000012'::uuid, 'tfbb2fbd52bf982c1', 'find-pair', 'Найди пару', 'Варежки, носочки, половинки картинок: соединяем линией.', 'logic', ARRAY['3-4','4-5']::text[], 15, 'Па'),
    ('00000000-0000-4000-8000-000000000013'::uuid, 't5d928e82edc4a041', 'odd-one-out', 'Что лишнее', 'Четыре картинки, одна не подходит. Объясняем почему.', 'logic', ARRAY['4-5','5-6','6-7']::text[], 15, '?'),
    ('00000000-0000-4000-8000-000000000014'::uuid, 'tbf9e9d3e15e49cb8', 'free-drawing', 'Свободное рисование', 'Большие кисти, штампы и заливка. Без задания.', 'drawing', ARRAY['3-4','4-5','5-6','6-7']::text[], 20, 'Ки'),
    ('00000000-0000-4000-8000-000000000015'::uuid, 't0d7858319511f469', 'color-by-number', 'Раскраска по номерам', 'Каждому номеру свой цвет: закрепляем цифры и цвета.', 'drawing', ARRAY['5-6','6-7']::text[], 20, '3'),
    ('00000000-0000-4000-8000-000000000016'::uuid, 't62848e3ce5804aa9', 'colors', 'Цвета и оттенки', 'Собираем предметы одного цвета, сравниваем светлее и темнее.', 'sensory', ARRAY['3-4']::text[], 15, '●'),
    ('00000000-0000-4000-8000-000000000017'::uuid, 't7bd3441c6c7f02a0', 'morning-circle', 'Утренний круг', 'Кто пришёл, какая погода, план дня. Для начала дня.', 'routine', ARRAY['3-4','4-5','5-6','6-7']::text[], 10, 'Ут'),
    ('00000000-0000-4000-8000-000000000018'::uuid, 't92b9604ffb8fe105', 'weekdays', 'Дни недели и погода', 'Календарь на неделю: отмечаем день и погоду за окном.', 'routine', ARRAY['5-6','6-7']::text[], 15, 'Пн')
) AS v(id, public_id, preset_key, name, description, topic, ages, duration_min, glyph)
ON CONFLICT (preset_key) DO NOTHING;

-- board.template_id: строковый ключ -> ссылка на template.
ALTER TABLE board ADD COLUMN template_ref uuid REFERENCES template (id) NULL;
UPDATE board b SET template_ref = t.id FROM template t WHERE b.template_id = t.preset_key;
ALTER TABLE board DROP COLUMN template_id;
ALTER TABLE board RENAME COLUMN template_ref TO template_id;
COMMENT ON COLUMN board.template_id IS 'Шаблон, из которого создана доска. NULL - пустая доска.';
CREATE INDEX IF NOT EXISTS idx_board_template_id ON board (template_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE board ADD COLUMN template_key text NULL;
UPDATE board b SET template_key = t.preset_key FROM template t WHERE b.template_id = t.id;
DROP INDEX IF EXISTS idx_board_template_id;
ALTER TABLE board DROP COLUMN template_id;
ALTER TABLE board RENAME COLUMN template_key TO template_id;
COMMENT ON COLUMN board.template_id IS 'Ключ шаблона из реестра кабинета, из которого создана доска; NULL - пустая доска';
DROP TABLE IF EXISTS template_starred;
DROP TABLE IF EXISTS template;
-- +goose StatementEnd
