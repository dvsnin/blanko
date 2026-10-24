-- +goose Up
-- +goose StatementBegin
-- Поиск педагогов в настройках группы идёт по подстроке (ILIKE '%q%'): btree тут бесполезен,
-- триграммные GIN-индексы отдают и имя, и почту без полного скана таблицы.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS account_name_trgm_idx ON account USING gin (name gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS account_email_trgm_idx ON account USING gin (email gin_trgm_ops) WHERE deleted_at IS NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS account_email_trgm_idx;
DROP INDEX IF EXISTS account_name_trgm_idx;
-- +goose StatementEnd
