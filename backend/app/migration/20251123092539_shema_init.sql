-- +goose Up
-- +goose StatementBegin
CREATE TYPE board_access AS ENUM ('deny', 'view', 'edit');
COMMENT ON TYPE board_access IS 'Уровень доступа к доске.';

CREATE TYPE plan_type AS ENUM ('free', 'pro');
COMMENT ON TYPE plan_type IS 'Тип тарифа.';

CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member');
COMMENT ON TYPE team_role IS 'Роль пользователя в команде.';

CREATE TYPE organization_role AS ENUM ('admin', 'member');
COMMENT ON TYPE organization_role IS 'Роль пользователя в организации.';

CREATE TABLE IF NOT EXISTS account
(
    id         uuid PRIMARY KEY NOT NULL,
    email      varchar(255)     NOT NULL,
    name       varchar(255)     NOT NULL,
    created_at timestamp        NOT NULL,
    updated_at timestamp        NOT NULL,
    deleted_at timestamp        NULL,

    UNIQUE (email)
);
COMMENT ON TABLE account IS 'Учетные записи пользователей.';
COMMENT ON COLUMN account.id IS 'Уникальный идентификатор пользователя.';
COMMENT ON COLUMN account.email IS 'Уникальный email пользователя.';
COMMENT ON COLUMN account.name IS 'Имя пользователя.';
COMMENT ON COLUMN account.created_at IS 'Время создания записи.';
COMMENT ON COLUMN account.updated_at IS 'Время обновления.';
COMMENT ON COLUMN account.deleted_at IS 'Время софт удаления.';

CREATE TABLE IF NOT EXISTS organization
(
    id         uuid PRIMARY KEY NOT NULL,
    name       VARCHAR(255)     NOT NULL,
    created_at timestamp        NOT NULL,
    updated_at timestamp        NOT NULL,
    deleted_at timestamp        NULL
);
COMMENT ON TABLE organization IS 'Организации, объединяющие пользователей.';
COMMENT ON COLUMN organization.id IS 'Уникальный идентификатор организации.';
COMMENT ON COLUMN organization.name IS 'Название организации.';
COMMENT ON COLUMN organization.created_at IS 'Время создания.';
COMMENT ON COLUMN organization.updated_at IS 'Время обновления.';
COMMENT ON COLUMN organization.deleted_at IS 'Время софт удаления.';

CREATE TABLE IF NOT EXISTS organization_domain
(
    id              uuid PRIMARY KEY                  NOT NULL,
    organization_id uuid REFERENCES organization (id) NOT NULL,
    domain          VARCHAR(255)                      NOT NULL,
    created_at      timestamp                         NOT NULL,
    updated_at      timestamp                         NOT NULL,

    UNIQUE (domain)
);
COMMENT ON TABLE organization_domain IS 'Домены, привязанные к организации.';
COMMENT ON COLUMN organization_domain.id IS 'Уникальный идентификатор записи домена.';
COMMENT ON COLUMN organization_domain.organization_id IS 'Идентификатор организации.';
COMMENT ON COLUMN organization_domain.domain IS 'Домен, принадлежащий организации.';
COMMENT ON COLUMN organization_domain.created_at IS 'Время создания.';
COMMENT ON COLUMN organization_domain.updated_at IS 'Время обновления.';

CREATE INDEX IF NOT EXISTS idx_organization_domain_organization_id ON organization_domain (organization_id);

CREATE TABLE IF NOT EXISTS organization_permission
(
    id                          uuid PRIMARY KEY                  NOT NULL,
    organization_id             uuid REFERENCES organization (id) NOT NULL,
    auto_join_users_by_domain   boolean DEFAULT false             NOT NULL,
    allow_members_team_creation boolean DEFAULT false             NOT NULL,
    created_at                  timestamp                         NOT NULL,
    updated_at                  timestamp                         NOT NULL
);
COMMENT ON TABLE organization_permission IS 'Настройки политик организации.';
COMMENT ON COLUMN organization_permission.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN organization_permission.organization_id IS 'Идентификатор организации.';
COMMENT ON COLUMN organization_permission.auto_join_users_by_domain IS 'Автоматически присоединять пользователей к организации с корпоративным доменом.';
COMMENT ON COLUMN organization_permission.allow_members_team_creation IS 'Разрешить пользователям создавать команды.';
COMMENT ON COLUMN organization_permission.created_at IS 'Время создания.';
COMMENT ON COLUMN organization_permission.updated_at IS 'Время обновления.';

CREATE INDEX IF NOT EXISTS idx_organization_permission_organization_id ON organization_permission (organization_id);

CREATE TABLE IF NOT EXISTS organization_member
(
    id              uuid PRIMARY KEY                  NOT NULL,
    organization_id uuid REFERENCES organization (id) NOT NULL,
    account_id      uuid REFERENCES account (id)      NOT NULL,
    role            organization_role                 NOT NULL,
    created_at      timestamp                         NOT NULL,
    updated_at      timestamp                         NOT NULL,

    UNIQUE (account_id)
);
COMMENT ON TABLE organization_member IS 'Участники организации и их роли.';
COMMENT ON COLUMN organization_member.organization_id IS 'Идентификатор организации.';
COMMENT ON COLUMN organization_member.account_id IS 'Идентификатор пользователя.';
COMMENT ON COLUMN organization_member.role IS 'Роль пользователя в организации.';
COMMENT ON COLUMN organization_member.created_at IS 'Время создания.';
COMMENT ON COLUMN organization_member.updated_at IS 'Время обновления.';

CREATE INDEX IF NOT EXISTS idx_organization_member_organization_id ON organization_member (organization_id);

CREATE TABLE IF NOT EXISTS workspace
(
    id              uuid PRIMARY KEY                  NOT NULL,
    name            text                              NOT NULL,
    account_id      uuid REFERENCES account (id)      NULL,
    organization_id uuid REFERENCES organization (id) NULL,
    created_at      timestamp                         NOT NULL,
    updated_at      timestamp                         NOT NULL,
    deleted_at      timestamp                         NULL,

    UNIQUE (account_id),
    UNIQUE (organization_id),

    CONSTRAINT chk_workspace_owner CHECK ((account_id IS NOT NULL) OR (organization_id IS NOT NULL))
);
COMMENT ON TABLE workspace IS 'Рабочие пространство, пользователя или организации.';
COMMENT ON COLUMN workspace.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN workspace.name IS 'Название рабочей области.';
COMMENT ON COLUMN workspace.account_id IS 'Владелец рабочей области, если пространство личное.';
COMMENT ON COLUMN workspace.organization_id IS 'Идентификатор организации, если пространство организации.';
COMMENT ON COLUMN workspace.created_at IS 'Время создания.';
COMMENT ON COLUMN workspace.updated_at IS 'Время обновления.';
COMMENT ON COLUMN workspace.deleted_at IS 'Время софт удаления.';

CREATE TABLE IF NOT EXISTS license
(
    id           uuid PRIMARY KEY               NOT NULL,
    workspace_id uuid REFERENCES workspace (id) NOT NULL,
    plan         plan_type                      NOT NULL,
    seats        int                            NOT NULL,
    expires_at   timestamp                      NULL,
    created_at   timestamp                      NOT NULL,
    updated_at   timestamp                      NOT NULL,
    deleted_at   timestamp                      NULL,

    UNIQUE (workspace_id)
);
COMMENT ON TABLE license IS 'Лицензии рабочих пространств.';
COMMENT ON COLUMN license.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN license.workspace_id IS 'Уникальный идентификатор рабочей области.';
COMMENT ON COLUMN license.plan IS 'Тарифный план.';
COMMENT ON COLUMN license.seats IS 'Количество оплаченных рабочих мест.';
COMMENT ON COLUMN license.expires_at IS 'Дата окончания лицензии, бесконечно - если не установлено.';
COMMENT ON COLUMN license.created_at IS 'Время создания.';
COMMENT ON COLUMN license.updated_at IS 'Время обновления.';

CREATE TABLE IF NOT EXISTS team
(
    id                  uuid PRIMARY KEY               NOT NULL,
    workspace_id        uuid REFERENCES workspace (id) NOT NULL,
    name                varchar(255)                   NOT NULL,
    member_board_access board_access                   NOT NULL,
    created_at          timestamp                      NOT NULL,
    updated_at          timestamp                      NOT NULL,
    deleted_at          timestamp                      NULL
);
COMMENT ON TABLE team IS 'Команды внутри рабочей области.';
COMMENT ON COLUMN team.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN team.workspace_id IS 'Идентификатор рабочей области.';
COMMENT ON COLUMN team.name IS 'Название команды.';
COMMENT ON COLUMN team.member_board_access IS 'Доступ участников команды к доскам команды.';
COMMENT ON COLUMN team.created_at IS 'Время создания.';
COMMENT ON COLUMN team.updated_at IS 'Время обновления.';
COMMENT ON COLUMN team.deleted_at IS 'Время софт удаления.';

CREATE INDEX IF NOT EXISTS idx_team_workspace_id ON team (workspace_id);

CREATE TABLE IF NOT EXISTS team_member
(
    id         uuid PRIMARY KEY             NOT NULL,
    team_id    uuid REFERENCES team (id)    NOT NULL,
    account_id uuid REFERENCES account (id) NOT NULL,
    role       team_role                    NOT NULL,
    created_at timestamp                    NOT NULL,
    updated_at timestamp                    NOT NULL,

    UNIQUE (team_id, account_id)
);
COMMENT ON TABLE team_member IS 'Участники команд и их роли.';
COMMENT ON COLUMN team_member.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN team_member.team_id IS 'Идентификатор команды.';
COMMENT ON COLUMN team_member.account_id IS 'Идентификатор пользователя.';
COMMENT ON COLUMN team_member.role IS 'Роль пользователя в команде.';
COMMENT ON COLUMN team_member.created_at IS 'Время создания.';
COMMENT ON COLUMN team_member.updated_at IS 'Время обновления.';

CREATE INDEX IF NOT EXISTS idx_team_member_account_id ON team_member (account_id);

CREATE TABLE IF NOT EXISTS team_starred
(
    account_id UUID REFERENCES account (id) NOT NULL,
    team_id    UUID REFERENCES team (id)    NOT NULL,
    created_at timestamp                    NOT NULL,
    PRIMARY KEY (account_id, team_id)
);
COMMENT ON TABLE team_starred IS 'Хранит информацию о командах, отмеченных пользователем как избранные.';
COMMENT ON COLUMN team_starred.account_id IS 'Идентификатор пользователя.';
COMMENT ON COLUMN team_starred.team_id IS 'Идентификатор команды, отмеченной пользователем как избранная.';
COMMENT ON COLUMN team_starred.created_at IS 'Время создания';

CREATE INDEX IF NOT EXISTS idx_team_starred_team_id ON team_starred (team_id);

CREATE TABLE IF NOT EXISTS board
(
    id                  uuid PRIMARY KEY             NOT NULL,
    public_id           VARCHAR(255)                 NOT NULL,
    name                varchar(255)                 NOT NULL,
    team_id             uuid REFERENCES team (id)    NOT NULL,
    account_id          uuid REFERENCES account (id) NOT NULL,
    team_access         board_access                 NOT NULL,
    link_access_enabled bool DEFAULT false           NOT NULL,
    created_at          timestamp                    NOT NULL,
    updated_at          timestamp                    NOT NULL,
    deleted_at          timestamp                    NULL,

    UNIQUE (public_id)
);
COMMENT ON TABLE board IS 'Интерактивные доски.';
COMMENT ON COLUMN board.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN board.public_id IS 'Уникальный идентификатор для передачи в url.';
COMMENT ON COLUMN board.name IS 'Название доски.';
COMMENT ON COLUMN board.team_id IS 'Идентификатор команды, которой принадлежит доска.';
COMMENT ON COLUMN board.account_id IS 'Идентификатор пользователя создателя доски.';
COMMENT ON COLUMN board.team_access IS 'Уровень доступа команды.';
COMMENT ON COLUMN board.link_access_enabled IS 'Доступа по ссылке включен или выключен (нужен access token).';
COMMENT ON COLUMN board.created_at IS 'Время создания.';
COMMENT ON COLUMN board.updated_at IS 'Время обновления.';
COMMENT ON COLUMN board.deleted_at IS 'Время софт удаления.';

CREATE INDEX IF NOT EXISTS idx_board_team_id ON board (team_id);
CREATE INDEX IF NOT EXISTS idx_board_account_id ON board (account_id);

CREATE TABLE IF NOT EXISTS board_member
(
    id         uuid PRIMARY KEY             NOT NULL,
    board_id   uuid REFERENCES board (id)   NOT NULL,
    account_id uuid REFERENCES account (id) NOT NULL,
    access     board_access                 NOT NULL,
    created_at timestamp                    NOT NULL,
    updated_at timestamp                    NOT NULL,

    UNIQUE (board_id, account_id)
);
COMMENT ON TABLE board_member IS 'Участники доски и их роли.';
COMMENT ON COLUMN board_member.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN board_member.board_id IS 'Идентификатор доски.';
COMMENT ON COLUMN board_member.account_id IS 'Идентификатор пользователя.';
COMMENT ON COLUMN board_member.access IS 'Доступ пользователя в доске.';
COMMENT ON COLUMN board_member.created_at IS 'Время создания.';
COMMENT ON COLUMN board_member.updated_at IS 'Время обновления.';

CREATE INDEX IF NOT EXISTS idx_board_member_account_id ON board_member (account_id);

CREATE TABLE IF NOT EXISTS board_share_token
(
    id         uuid PRIMARY KEY             NOT NULL,
    board_id   uuid REFERENCES board (id)   NOT NULL,
    account_id uuid REFERENCES account (id) NOT NULL,
    access     board_access                 NOT NULL,
    token      VARCHAR(255)                 NOT NULL,
    expires_at timestamp                    NULL,
    created_at timestamp                    NOT NULL,
    updated_at timestamp                    NOT NULL,
    deleted_at timestamp                    NULL,

    UNIQUE (token)
);
COMMENT ON TABLE board_share_token IS 'Токены для доступа к доске.';
COMMENT ON COLUMN board_share_token.board_id IS 'Идентификатор доски, к которой относится ссылка.';
COMMENT ON COLUMN board_share_token.account_id IS 'Идентификатор аккаунта, кто сгенерировал токен доступа.';
COMMENT ON COLUMN board_share_token.access IS 'Уровень доступа по данной ссылке.';
COMMENT ON COLUMN board_share_token.token IS 'Секретный токен доступа (query параметр).';
COMMENT ON COLUMN board_share_token.expires_at IS 'Время действия ссылки, бесконечно - если не задано.';
COMMENT ON COLUMN board_share_token.created_at IS 'Время создания.';
COMMENT ON COLUMN board_share_token.updated_at IS 'Время обновления.';
COMMENT ON COLUMN board_share_token.deleted_at IS 'Отключение/ревокация ссылки.';

CREATE INDEX IF NOT EXISTS idx_board_share_token_board_id ON board_share_token (board_id);
CREATE INDEX IF NOT EXISTS idx_board_share_token_account_id ON board_share_token (account_id);

CREATE TABLE IF NOT EXISTS board_starred
(
    account_id UUID REFERENCES account (id) NOT NULL,
    board_id   UUID REFERENCES board (id)   NOT NULL,
    created_at timestamp                    NOT NULL,
    PRIMARY KEY (account_id, board_id)
);
COMMENT ON TABLE board_starred IS 'Хранит информацию о досках, отмеченных пользователем как избранные.';
COMMENT ON COLUMN board_starred.account_id IS 'Идентификатор пользователя.';
COMMENT ON COLUMN board_starred.board_id IS 'Идентификатор доски, отмеченной пользователем как избранная.';
COMMENT ON COLUMN board_starred.created_at IS 'Время создания';

CREATE INDEX IF NOT EXISTS idx_board_starred_board_id ON board_starred (board_id);

CREATE TABLE IF NOT EXISTS board_event_journal
(
    id            uuid PRIMARY KEY             NOT NULL,
    board_id      uuid REFERENCES board (id)   NOT NULL,
    event_payload jsonb                        NOT NULL,
    account_id    uuid REFERENCES account (id) NULL,
    created_at    timestamp                    NOT NULL,
    updated_at    timestamp                    NOT NULL
);
COMMENT ON TABLE board_event_journal IS 'Журнал событий на доске.';
COMMENT ON COLUMN board_event_journal.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN board_event_journal.board_id IS 'Идентификатор доски.';
COMMENT ON COLUMN board_event_journal.event_payload IS 'JSON-событие доски.';
COMMENT ON COLUMN board_event_journal.account_id IS 'Пользователь, инициировавший событие (если NULL - гость).';
COMMENT ON COLUMN board_event_journal.created_at IS 'Время создания.';
COMMENT ON COLUMN board_event_journal.updated_at IS 'Время обновления.';

CREATE INDEX IF NOT EXISTS idx_board_event_journal_board_id ON board_event_journal (board_id);

CREATE TABLE IF NOT EXISTS board_login
(
    id         uuid PRIMARY KEY             NOT NULL,
    board_id   uuid REFERENCES board (id)   NOT NULL,
    account_id uuid REFERENCES account (id) NULL,
    access     board_access                 NOT NULL,
    created_at timestamp                    NOT NULL,
    updated_at timestamp                    NOT NULL,
    logout_at  timestamp                    NULL
);
COMMENT ON TABLE board_login IS 'Записи входов пользователей и гостей на доску.';
COMMENT ON COLUMN board_login.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN board_login.board_id IS 'Идентификатор доски.';
COMMENT ON COLUMN board_login.account_id IS 'Пользователь (если NULL - гость).';
COMMENT ON COLUMN board_login.created_at IS 'Время входа.';
COMMENT ON COLUMN board_login.updated_at IS 'Время обновления.';
COMMENT ON COLUMN board_login.access IS 'Уровень доступа при входе.';
COMMENT ON COLUMN board_login.logout_at IS 'Время выхода.';

CREATE INDEX IF NOT EXISTS idx_board_login_board_id ON board_login (board_id);
CREATE INDEX IF NOT EXISTS idx_board_login_account_id ON board_login (account_id);

CREATE TABLE IF NOT EXISTS notification
(
    id         uuid PRIMARY KEY             NOT NULL,
    account_id uuid REFERENCES account (id) NOT NULL,
    is_read    boolean DEFAULT false        NOT NULL,
    payload    jsonb                        NOT NULL,
    created_at timestamp                    NOT NULL,
    updated_at timestamp                    NOT NULL,
    deleted_at timestamp                    NULL
);
COMMENT ON TABLE notification IS 'Уведомления пользователей.';
COMMENT ON COLUMN notification.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN notification.account_id IS 'Идентификатор пользователя.';
COMMENT ON COLUMN notification.is_read IS 'Признак прочтения пользователем.';
COMMENT ON COLUMN notification.payload IS 'Данные уведомления.';
COMMENT ON COLUMN notification.created_at IS 'Время создания.';
COMMENT ON COLUMN notification.updated_at IS 'Время обновления.';
COMMENT ON COLUMN notification.deleted_at IS 'Время софт удаления.';

CREATE INDEX IF NOT EXISTS idx_notification_account_id ON notification (account_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- +goose StatementEnd
