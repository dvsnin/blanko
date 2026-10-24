-- +goose Up
-- +goose StatementBegin
ALTER TABLE board ADD COLUMN purged_at timestamptz NULL;
COMMENT ON COLUMN board.purged_at IS 'Когда содержимое и медиа удалённой доски вычищены из хранилища. NULL - ещё лежат.';
ALTER TABLE template ADD COLUMN purged_at timestamptz NULL;
COMMENT ON COLUMN template.purged_at IS 'Когда содержимое и медиа удалённого шаблона вычищены из хранилища. NULL - ещё лежат.';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE board DROP COLUMN purged_at;
ALTER TABLE template DROP COLUMN purged_at;
-- +goose StatementEnd
