-- +goose Up
-- +goose StatementBegin
CREATE TYPE board_access AS ENUM ('deny', 'view', 'edit');
COMMENT ON TYPE board_access IS 'Уровень доступа к доске.';

CREATE TYPE plan_type AS ENUM ('free', 'pro');
COMMENT ON TYPE plan_type IS 'Тип тарифа.';

CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member');
COMMENT ON TYPE team_role IS 'Роль пользователя в команде.';

CREATE TYPE organization_role AS ENUM ('owner', 'admin', 'member');
COMMENT ON TYPE organization_role IS 'Роль пользователя в организации.';

CREATE TABLE IF NOT EXISTS account
(
    id         uuid PRIMARY KEY NOT NULL,
    email      varchar(255)     NOT NULL,
    name       varchar(255)     NOT NULL,
    created_at timestamptz        NOT NULL,
    updated_at timestamptz        NOT NULL,
    deleted_at timestamptz        NULL,

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
    id               uuid PRIMARY KEY             NOT NULL,
    name             varchar(255)                 NOT NULL,
    owner_account_id uuid REFERENCES account (id) ON DELETE RESTRICT NOT NULL,
    settings         jsonb DEFAULT '{}'::jsonb    NOT NULL,
    created_at       timestamptz                    NOT NULL,
    updated_at       timestamptz                    NOT NULL,
    deleted_at       timestamptz                    NULL
);
COMMENT ON TABLE organization IS 'Организации — корпоративный контейнер для команд. Привязанные домены хранятся в organization_domain, прочие политики (SSO, брендинг и т.п.) — в settings.';
COMMENT ON COLUMN organization.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN organization.name IS 'Название организации.';
COMMENT ON COLUMN organization.owner_account_id IS 'Владелец организации (создатель).';
COMMENT ON COLUMN organization.settings IS 'Политики организации в jsonb: sso_config, default_role, branding и прочее. Домены вынесены в organization_domain.';
COMMENT ON COLUMN organization.created_at IS 'Время создания.';
COMMENT ON COLUMN organization.updated_at IS 'Время обновления.';
COMMENT ON COLUMN organization.deleted_at IS 'Время софт удаления.';

CREATE INDEX IF NOT EXISTS idx_organization_owner_account_id ON organization (owner_account_id);

CREATE TABLE IF NOT EXISTS organization_domain
(
    domain             varchar(253) PRIMARY KEY                              NOT NULL,
    organization_id    uuid REFERENCES organization (id) ON DELETE CASCADE   NOT NULL,
    verified           boolean DEFAULT false             NOT NULL,
    verification_token varchar(64)                       NULL,
    verified_at        timestamptz                         NULL,
    auto_join_enabled  boolean DEFAULT false             NOT NULL,
    created_at         timestamptz                         NOT NULL,
    updated_at         timestamptz                         NOT NULL,

    CHECK (domain = lower(domain))
);
COMMENT ON TABLE organization_domain IS 'Домены, привязанные к организации. Используется для автоджойна нового аккаунта в организацию при совпадении домена email. Домен может принадлежать только одной организации (PK).';
COMMENT ON COLUMN organization_domain.domain IS 'Доменное имя в нижнем регистре, RFC 1035 (≤253 символа). PK даёт O(log n) lookup при регистрации.';
COMMENT ON COLUMN organization_domain.organization_id IS 'Организация-владелец домена.';
COMMENT ON COLUMN organization_domain.verified IS 'Подтверждён ли домен (DNS TXT). Только подтверждённые домены участвуют в автоджойне.';
COMMENT ON COLUMN organization_domain.verification_token IS 'Случайный токен, который админ размещает в DNS TXT-записи для подтверждения владения.';
COMMENT ON COLUMN organization_domain.verified_at IS 'Время успешной верификации.';
COMMENT ON COLUMN organization_domain.auto_join_enabled IS 'Включён ли автоматический join новых аккаунтов с этим доменом. Может быть выключен даже на подтверждённом домене (ручной инвайт).';
COMMENT ON COLUMN organization_domain.created_at IS 'Время создания.';
COMMENT ON COLUMN organization_domain.updated_at IS 'Время обновления.';

CREATE INDEX IF NOT EXISTS idx_organization_domain_organization_id ON organization_domain (organization_id);

CREATE TABLE IF NOT EXISTS organization_member
(
    id              uuid PRIMARY KEY                                       NOT NULL,
    organization_id uuid REFERENCES organization (id) ON DELETE CASCADE    NOT NULL,
    account_id      uuid REFERENCES account (id) ON DELETE CASCADE         NOT NULL,
    role            organization_role                                      NOT NULL,
    created_at      timestamptz                         NOT NULL,
    updated_at      timestamptz                         NOT NULL,

    UNIQUE (organization_id, account_id)
);
COMMENT ON TABLE organization_member IS 'Членство аккаунтов в организациях. Один аккаунт может состоять в нескольких организациях. Владелец дополнительно зафиксирован в organization.owner_account_id для billing-сценариев.';
COMMENT ON COLUMN organization_member.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN organization_member.organization_id IS 'Организация.';
COMMENT ON COLUMN organization_member.account_id IS 'Аккаунт.';
COMMENT ON COLUMN organization_member.role IS 'Роль аккаунта в организации.';
COMMENT ON COLUMN organization_member.created_at IS 'Время вступления.';
COMMENT ON COLUMN organization_member.updated_at IS 'Время обновления.';

CREATE INDEX IF NOT EXISTS idx_organization_member_account_id ON organization_member (account_id);

CREATE TABLE IF NOT EXISTS license
(
    id              uuid PRIMARY KEY                                     NOT NULL,
    organization_id uuid REFERENCES organization (id) ON DELETE CASCADE  NULL,
    account_id      uuid REFERENCES account (id) ON DELETE CASCADE       NULL,
    plan            plan_type                                            NOT NULL,
    seats           int                                                  NOT NULL,
    expires_at      timestamptz                                          NULL,
    created_at      timestamptz                                          NOT NULL,
    updated_at      timestamptz                                          NOT NULL,
    deleted_at      timestamptz                                          NULL,

    UNIQUE (organization_id),
    UNIQUE (account_id),
    CONSTRAINT license_target_xor CHECK (num_nonnulls(organization_id, account_id) = 1)
);
COMMENT ON TABLE license IS 'Лицензии. Привязана либо к организации (корпоративная), либо к аккаунту напрямую (персональный план для фрилансеров/одиночек). CHECK гарантирует ровно одного владельца — один из ID обязательно NOT NULL, другой NULL.';
COMMENT ON COLUMN license.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN license.organization_id IS 'Организация-владелец. NULL для персональных лицензий.';
COMMENT ON COLUMN license.account_id IS 'Аккаунт-владелец для персональных лицензий. NULL для корпоративных.';
COMMENT ON COLUMN license.plan IS 'Тарифный план.';
COMMENT ON COLUMN license.seats IS 'Количество оплаченных рабочих мест. Для персональной лицензии обычно 1.';
COMMENT ON COLUMN license.expires_at IS 'Дата окончания лицензии, бесконечно - если не установлено.';
COMMENT ON COLUMN license.created_at IS 'Время создания.';
COMMENT ON COLUMN license.updated_at IS 'Время обновления.';

CREATE TABLE IF NOT EXISTS team
(
    id                  uuid PRIMARY KEY                  NOT NULL,
    organization_id     uuid REFERENCES organization (id) ON DELETE RESTRICT NULL,
    name                varchar(255)                      NOT NULL,
    member_board_access board_access                      NOT NULL,
    settings            jsonb DEFAULT '{}'::jsonb         NOT NULL,
    created_at          timestamptz                         NOT NULL,
    updated_at          timestamptz                         NOT NULL,
    deleted_at          timestamptz                         NULL
);
COMMENT ON TABLE team IS 'Команды. Если organization_id IS NULL — личная команда пользователя без организации. В settings лежат параметры открытия команды внешним участникам.';
COMMENT ON COLUMN team.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN team.organization_id IS 'Организация, к которой относится команда. NULL — личная команда.';
COMMENT ON COLUMN team.name IS 'Название команды.';
COMMENT ON COLUMN team.member_board_access IS 'Доступ участников команды к доскам команды.';
COMMENT ON COLUMN team.settings IS 'Настройки команды в jsonb: открыта ли для внешних участников, дефолтный доступ гостей и т.д.';
COMMENT ON COLUMN team.created_at IS 'Время создания.';
COMMENT ON COLUMN team.updated_at IS 'Время обновления.';
COMMENT ON COLUMN team.deleted_at IS 'Время софт удаления.';

CREATE INDEX IF NOT EXISTS idx_team_organization_id ON team (organization_id);

CREATE TABLE IF NOT EXISTS team_member
(
    id         uuid PRIMARY KEY                                  NOT NULL,
    team_id    uuid REFERENCES team (id) ON DELETE CASCADE       NOT NULL,
    account_id uuid REFERENCES account (id) ON DELETE CASCADE    NOT NULL,
    role       team_role                                         NOT NULL,
    created_at timestamptz                    NOT NULL,
    updated_at timestamptz                    NOT NULL,

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
    account_id UUID REFERENCES account (id) ON DELETE CASCADE NOT NULL,
    team_id    UUID REFERENCES team (id) ON DELETE CASCADE    NOT NULL,
    created_at timestamptz                                    NOT NULL,
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
    team_id             uuid REFERENCES team (id) ON DELETE RESTRICT    NOT NULL,
    account_id          uuid REFERENCES account (id) ON DELETE RESTRICT NOT NULL,
    team_access         board_access                                    NOT NULL,
    link_access_enabled bool DEFAULT false           NOT NULL,
    created_at          timestamptz                    NOT NULL,
    updated_at          timestamptz                    NOT NULL,
    deleted_at          timestamptz                    NULL,

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
    id         uuid PRIMARY KEY                                NOT NULL,
    board_id   uuid REFERENCES board (id) ON DELETE CASCADE    NOT NULL,
    account_id uuid REFERENCES account (id) ON DELETE CASCADE  NOT NULL,
    access     board_access                                    NOT NULL,
    created_at timestamptz                                     NOT NULL,
    updated_at timestamptz                                     NOT NULL,

    UNIQUE (board_id, account_id)
);
COMMENT ON TABLE board_member IS 'Участники доски и их роли. Сюда же попадают внешние/гостевые пользователи без членства в команде.';
COMMENT ON COLUMN board_member.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN board_member.board_id IS 'Идентификатор доски.';
COMMENT ON COLUMN board_member.account_id IS 'Идентификатор пользователя.';
COMMENT ON COLUMN board_member.access IS 'Доступ пользователя в доске.';
COMMENT ON COLUMN board_member.created_at IS 'Время создания.';
COMMENT ON COLUMN board_member.updated_at IS 'Время обновления.';

CREATE INDEX IF NOT EXISTS idx_board_member_account_id ON board_member (account_id);

CREATE TABLE IF NOT EXISTS board_share_token
(
    id         uuid PRIMARY KEY                                NOT NULL,
    board_id   uuid REFERENCES board (id) ON DELETE CASCADE    NOT NULL,
    account_id uuid REFERENCES account (id) ON DELETE CASCADE  NOT NULL,
    access     board_access                                    NOT NULL,
    token_hash varchar(64)                                     NOT NULL,
    expires_at timestamptz                                     NULL,
    created_at timestamptz                                     NOT NULL,
    updated_at timestamptz                                     NOT NULL,
    deleted_at timestamptz                                     NULL,

    UNIQUE (token_hash)
);
COMMENT ON TABLE board_share_token IS 'Токены для доступа к доске.';
COMMENT ON COLUMN board_share_token.board_id IS 'Идентификатор доски, к которой относится ссылка.';
COMMENT ON COLUMN board_share_token.account_id IS 'Идентификатор аккаунта, кто сгенерировал токен доступа.';
COMMENT ON COLUMN board_share_token.access IS 'Уровень доступа по данной ссылке.';
COMMENT ON COLUMN board_share_token.token_hash IS 'SHA-256 hex (64 chars) от секретного токена. Сам токен клиенту возвращается один раз при генерации и в БД не хранится — при утечке дампа ссылки остаются непригодными.';
COMMENT ON COLUMN board_share_token.expires_at IS 'Время действия ссылки, бесконечно - если не задано.';
COMMENT ON COLUMN board_share_token.created_at IS 'Время создания.';
COMMENT ON COLUMN board_share_token.updated_at IS 'Время обновления.';
COMMENT ON COLUMN board_share_token.deleted_at IS 'Отключение/ревокация ссылки.';

CREATE INDEX IF NOT EXISTS idx_board_share_token_board_id ON board_share_token (board_id);
CREATE INDEX IF NOT EXISTS idx_board_share_token_account_id ON board_share_token (account_id);

CREATE TABLE IF NOT EXISTS board_starred
(
    account_id UUID REFERENCES account (id) ON DELETE CASCADE NOT NULL,
    board_id   UUID REFERENCES board (id) ON DELETE CASCADE   NOT NULL,
    created_at timestamptz                                    NOT NULL,
    PRIMARY KEY (account_id, board_id)
);
COMMENT ON TABLE board_starred IS 'Хранит информацию о досках, отмеченных пользователем как избранные.';
COMMENT ON COLUMN board_starred.account_id IS 'Идентификатор пользователя.';
COMMENT ON COLUMN board_starred.board_id IS 'Идентификатор доски, отмеченной пользователем как избранная.';
COMMENT ON COLUMN board_starred.created_at IS 'Время создания';

CREATE INDEX IF NOT EXISTS idx_board_starred_board_id ON board_starred (board_id);

CREATE TABLE IF NOT EXISTS board_event_journal
(
    id            uuid PRIMARY KEY                                NOT NULL,
    board_id      uuid REFERENCES board (id) ON DELETE CASCADE    NOT NULL,
    event_payload jsonb                                           NOT NULL,
    account_id    uuid REFERENCES account (id) ON DELETE SET NULL NULL,
    created_at    timestamptz                    NOT NULL,
    updated_at    timestamptz                    NOT NULL
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
    id         uuid PRIMARY KEY                                 NOT NULL,
    board_id   uuid REFERENCES board (id) ON DELETE CASCADE     NOT NULL,
    account_id uuid REFERENCES account (id) ON DELETE SET NULL  NULL,
    access     board_access                                     NOT NULL,
    created_at timestamptz                    NOT NULL,
    updated_at timestamptz                    NOT NULL,
    logout_at  timestamptz                    NULL
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
    id         uuid PRIMARY KEY                                NOT NULL,
    account_id uuid REFERENCES account (id) ON DELETE CASCADE  NOT NULL,
    is_read    boolean DEFAULT false                           NOT NULL,
    payload    jsonb                        NOT NULL,
    created_at timestamptz                    NOT NULL,
    updated_at timestamptz                    NOT NULL,
    deleted_at timestamptz                    NULL
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
DROP TABLE IF EXISTS notification;
DROP TABLE IF EXISTS board_login;
DROP TABLE IF EXISTS board_event_journal;
DROP TABLE IF EXISTS board_starred;
DROP TABLE IF EXISTS board_share_token;
DROP TABLE IF EXISTS board_member;
DROP TABLE IF EXISTS board;
DROP TABLE IF EXISTS team_starred;
DROP TABLE IF EXISTS team_member;
DROP TABLE IF EXISTS team;
DROP TABLE IF EXISTS license;
DROP TABLE IF EXISTS organization_member;
DROP TABLE IF EXISTS organization_domain;
DROP TABLE IF EXISTS organization;
DROP TABLE IF EXISTS account;
DROP TYPE IF EXISTS organization_role;
DROP TYPE IF EXISTS team_role;
DROP TYPE IF EXISTS plan_type;
DROP TYPE IF EXISTS board_access;
-- +goose StatementEnd
