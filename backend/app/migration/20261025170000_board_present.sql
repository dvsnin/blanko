-- +goose Up
-- +goose StatementBegin
-- Режим показа: доска открывается по токену без входа в режиме «только смотреть» и следует за ведущим.
ALTER TABLE board ADD COLUMN IF NOT EXISTS present_token varchar(64) NULL;
ALTER TABLE board ADD COLUMN IF NOT EXISTS presenter_account_id uuid REFERENCES account (id) ON DELETE SET NULL NULL;
ALTER TABLE board ADD COLUMN IF NOT EXISTS present_expires_at timestamptz NULL;
CREATE UNIQUE INDEX IF NOT EXISTS board_present_token_idx ON board (present_token) WHERE present_token IS NOT NULL;
COMMENT ON COLUMN board.present_token IS 'Токен публичной ссылки показа /app/present/{token}; NULL - показ выключен.';
COMMENT ON COLUMN board.present_expires_at IS 'Когда ссылка показа перестаёт работать; NULL - пока показ не выключат вручную.';
COMMENT ON COLUMN board.presenter_account_id IS 'Ведущий показа: за его соединением следуют зрители. NULL - показ выключен или ведущий не назначен.';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS board_present_token_idx;
ALTER TABLE board DROP COLUMN present_expires_at;
ALTER TABLE board DROP COLUMN presenter_account_id;
ALTER TABLE board DROP COLUMN present_token;
-- +goose StatementEnd
