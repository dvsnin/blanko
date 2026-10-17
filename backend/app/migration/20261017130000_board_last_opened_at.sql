-- +goose Up
-- +goose StatementBegin
ALTER TABLE board ADD COLUMN last_opened_at timestamptz NULL;
COMMENT ON COLUMN board.last_opened_at IS 'Когда доску открывали в последний раз (любой участник); проставляется при создании и при каждом открытии';
UPDATE board SET last_opened_at = updated_at WHERE last_opened_at IS NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE board DROP COLUMN IF EXISTS last_opened_at;
-- +goose StatementEnd
