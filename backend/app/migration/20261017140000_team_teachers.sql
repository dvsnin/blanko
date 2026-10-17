-- +goose Up
-- +goose StatementBegin
ALTER TABLE team ADD COLUMN teachers text NULL;
COMMENT ON COLUMN team.teachers IS 'Воспитатели группы, свободный текст, имена через запятую';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE team DROP COLUMN IF EXISTS teachers;
-- +goose StatementEnd
