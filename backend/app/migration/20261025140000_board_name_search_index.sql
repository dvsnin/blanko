-- +goose Up
-- +goose StatementBegin
-- Поиск досок по подстроке названия (ILIKE '%q%') в списке со страницами: триграммный GIN,
-- как у справочника аккаунтов. Удалённые доски в индексе не нужны.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS board_name_trgm_idx ON board USING gin (name gin_trgm_ops) WHERE deleted_at IS NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS board_name_trgm_idx;
-- +goose StatementEnd
