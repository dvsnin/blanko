-- +goose Up
-- +goose StatementBegin
-- Доступ участников к доскам задаётся в группе (team.member_board_access) и наследуется доской,
-- пока у неё нет своей настройки: NULL в board.team_access значит «как в группе».
ALTER TABLE board ALTER COLUMN team_access DROP NOT NULL;
UPDATE board b SET team_access = NULL FROM team t WHERE t.id = b.team_id AND b.team_access = t.member_board_access;
COMMENT ON COLUMN board.team_access IS 'Доступ участников группы к содержимому: edit, view, deny. NULL - как у группы (team.member_board_access).';
COMMENT ON COLUMN team.member_board_access IS 'Доступ участников группы к её доскам по умолчанию: edit, view, deny. Доска может переопределить своим team_access.';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
UPDATE board b SET team_access = t.member_board_access FROM team t WHERE t.id = b.team_id AND b.team_access IS NULL;
ALTER TABLE board ALTER COLUMN team_access SET NOT NULL;
-- +goose StatementEnd
