-- +goose Up
-- +goose StatementBegin
ALTER TABLE team ADD COLUMN age_group text NULL;
COMMENT ON COLUMN team.age_group IS 'Возраст детей в группе: 3-4, 4-5, 5-6, 6-7 или NULL';
ALTER TABLE board ADD COLUMN template_id text NULL;
COMMENT ON COLUMN board.template_id IS 'Идентификатор шаблона из реестра фронтенда, из которого создана доска';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE board DROP COLUMN IF EXISTS template_id;
ALTER TABLE team DROP COLUMN IF EXISTS age_group;
-- +goose StatementEnd
