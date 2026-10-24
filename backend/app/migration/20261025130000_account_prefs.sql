-- +goose Up
-- +goose StatementBegin
ALTER TABLE account ADD COLUMN prefs jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN account.prefs IS 'Настройки кабинета (последняя группа, режим и сортировка досок, фильтры): плоский объект, ключи задаёт фронтенд, отдаётся в dashData при загрузке страницы.';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE account DROP COLUMN prefs;
-- +goose StatementEnd
