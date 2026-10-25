-- +goose Up
-- +goose StatementBegin
-- Новые темы занятий: музыка, здоровье, безопасность, эмоции и общение. Предустановленные
-- шаблоны по ним кладёт сидер на старте бэкенда, миграция только уточняет описание колонки.
COMMENT ON COLUMN template.topic IS 'Тема: math, literacy, world, speech, logic, drawing, sensory, routine, music, health, safety, social.';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
COMMENT ON COLUMN template.topic IS 'Тема: math, literacy, world, speech, logic, drawing, sensory, routine.';
-- +goose StatementEnd
