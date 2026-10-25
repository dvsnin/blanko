-- +goose Up
-- +goose StatementBegin
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE board_access AS ENUM ('deny', 'view', 'edit');
COMMENT ON TYPE board_access IS 'Уровень доступа к содержимому доски.';

CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member');
COMMENT ON TYPE team_role IS 'Роль педагога в группе.';

CREATE TYPE organization_role AS ENUM ('owner', 'admin', 'member');
COMMENT ON TYPE organization_role IS 'Роль в саду: владелец и администраторы управляют учётными записями.';

CREATE TABLE account
(
    id         uuid PRIMARY KEY           NOT NULL,
    email      varchar(255)               NOT NULL,
    name       varchar(255)               NOT NULL,
    prefs      jsonb DEFAULT '{}'::jsonb  NOT NULL,
    created_at timestamptz                NOT NULL,
    updated_at timestamptz                NOT NULL,
    deleted_at timestamptz                NULL,

    UNIQUE (email)
);
COMMENT ON TABLE account IS 'Учётные записи педагогов; создаются при первом входе через Keycloak.';
COMMENT ON COLUMN account.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN account.email IS 'Почта из Keycloak, уникальна.';
COMMENT ON COLUMN account.name IS 'Отображаемое имя.';
COMMENT ON COLUMN account.prefs IS 'Настройки кабинета (последняя группа, режим и сортировка досок, фильтры): плоский объект, ключи задаёт фронтенд, отдаётся в dashData при загрузке страницы.';
COMMENT ON COLUMN account.created_at IS 'Время создания.';
COMMENT ON COLUMN account.updated_at IS 'Время обновления.';
COMMENT ON COLUMN account.deleted_at IS 'Время софт-удаления.';

-- Поиск педагогов по подстроке имени или почты (ILIKE '%q%'): триграммные GIN-индексы.
CREATE INDEX account_name_trgm_idx ON account USING gin (name gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX account_email_trgm_idx ON account USING gin (email gin_trgm_ops) WHERE deleted_at IS NULL;

CREATE TABLE organization
(
    id               uuid PRIMARY KEY                                     NOT NULL,
    name             varchar(255)                                         NOT NULL,
    owner_account_id uuid REFERENCES account (id) ON DELETE RESTRICT      NOT NULL,
    created_at       timestamptz                                          NOT NULL,
    updated_at       timestamptz                                          NOT NULL
);
COMMENT ON TABLE organization IS 'Детский сад. В коробке ровно одна строка: создаётся bootstrap при первом старте из APP_ORG_NAME и APP_ADMIN_EMAILS.';
COMMENT ON COLUMN organization.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN organization.name IS 'Название сада, показывается в шапке кабинета.';
COMMENT ON COLUMN organization.owner_account_id IS 'Владелец: первый адрес из APP_ADMIN_EMAILS.';
COMMENT ON COLUMN organization.created_at IS 'Время создания.';
COMMENT ON COLUMN organization.updated_at IS 'Время обновления.';

CREATE TABLE organization_member
(
    id              uuid PRIMARY KEY                                       NOT NULL,
    organization_id uuid REFERENCES organization (id) ON DELETE CASCADE    NOT NULL,
    account_id      uuid REFERENCES account (id) ON DELETE CASCADE         NOT NULL,
    role            organization_role                                      NOT NULL,
    created_at      timestamptz                                            NOT NULL,
    updated_at      timestamptz                                            NOT NULL,

    UNIQUE (organization_id, account_id)
);
COMMENT ON TABLE organization_member IS 'Роли учётных записей в саду. Запись появляется при первом входе (member) или из APP_ADMIN_EMAILS (admin, owner); администраторов меняют в кабинете, хотя бы один остаётся всегда.';
COMMENT ON COLUMN organization_member.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN organization_member.organization_id IS 'Сад.';
COMMENT ON COLUMN organization_member.account_id IS 'Учётная запись.';
COMMENT ON COLUMN organization_member.role IS 'Роль: owner, admin или member.';
COMMENT ON COLUMN organization_member.created_at IS 'Время вступления.';
COMMENT ON COLUMN organization_member.updated_at IS 'Время обновления.';

CREATE INDEX idx_organization_member_account_id ON organization_member (account_id);

CREATE TABLE team
(
    id                  uuid PRIMARY KEY                                     NOT NULL,
    organization_id     uuid REFERENCES organization (id) ON DELETE RESTRICT NULL,
    name                varchar(255)                                         NOT NULL,
    member_board_access board_access                                         NOT NULL,
    age_group           text                                                 NULL,
    teachers            text                                                 NULL,
    created_at          timestamptz                                          NOT NULL,
    updated_at          timestamptz                                          NOT NULL,
    deleted_at          timestamptz                                          NULL
);
COMMENT ON TABLE team IS 'Группы сада (в интерфейсе «группа», в коде team). Доски живут в группах.';
COMMENT ON COLUMN team.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN team.organization_id IS 'Сад, которому принадлежит группа. NULL только если группа создана до bootstrap организации (тесты).';
COMMENT ON COLUMN team.name IS 'Название группы.';
COMMENT ON COLUMN team.member_board_access IS 'Доступ участников группы к её доскам по умолчанию: edit, view, deny. Доска может переопределить своим team_access.';
COMMENT ON COLUMN team.age_group IS 'Возраст детей в группе: 3-4, 4-5, 5-6, 6-7 или NULL.';
COMMENT ON COLUMN team.teachers IS 'Воспитатели группы, свободный текст, имена через запятую.';
COMMENT ON COLUMN team.created_at IS 'Время создания.';
COMMENT ON COLUMN team.updated_at IS 'Время обновления.';
COMMENT ON COLUMN team.deleted_at IS 'Время софт-удаления.';

CREATE INDEX idx_team_organization_id ON team (organization_id);

CREATE TABLE team_member
(
    id         uuid PRIMARY KEY                                  NOT NULL,
    team_id    uuid REFERENCES team (id) ON DELETE CASCADE       NOT NULL,
    account_id uuid REFERENCES account (id) ON DELETE CASCADE    NOT NULL,
    role       team_role                                         NOT NULL,
    created_at timestamptz                                       NOT NULL,
    updated_at timestamptz                                       NOT NULL,

    UNIQUE (team_id, account_id)
);
COMMENT ON TABLE team_member IS 'Участники групп и их роли; owner и admin группы управляют её досками и составом.';
COMMENT ON COLUMN team_member.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN team_member.team_id IS 'Группа.';
COMMENT ON COLUMN team_member.account_id IS 'Учётная запись.';
COMMENT ON COLUMN team_member.role IS 'Роль в группе.';
COMMENT ON COLUMN team_member.created_at IS 'Время вступления.';
COMMENT ON COLUMN team_member.updated_at IS 'Время обновления.';

CREATE INDEX idx_team_member_account_id ON team_member (account_id);

CREATE TABLE team_starred
(
    account_id uuid REFERENCES account (id) ON DELETE CASCADE NOT NULL,
    team_id    uuid REFERENCES team (id) ON DELETE CASCADE    NOT NULL,
    created_at timestamptz                                    NOT NULL,
    PRIMARY KEY (account_id, team_id)
);
COMMENT ON TABLE team_starred IS 'Группы, отмеченные педагогом как избранные.';
COMMENT ON COLUMN team_starred.account_id IS 'Учётная запись.';
COMMENT ON COLUMN team_starred.team_id IS 'Группа.';
COMMENT ON COLUMN team_starred.created_at IS 'Время отметки.';

CREATE INDEX idx_team_starred_team_id ON team_starred (team_id);

CREATE TABLE template
(
    id                uuid PRIMARY KEY                                   NOT NULL,
    public_id         varchar(255)                                       NOT NULL,
    preset_key        varchar(64)                                        NULL,
    name              varchar(255)                                       NOT NULL,
    description       varchar(500) DEFAULT ''                            NOT NULL,
    topic             varchar(32)                                        NOT NULL,
    ages              text[]                                             NOT NULL,
    duration_min      int                                                NOT NULL,
    author_account_id uuid REFERENCES account (id) ON DELETE SET NULL    NULL,
    created_at        timestamptz                                        NOT NULL,
    updated_at        timestamptz                                        NOT NULL,
    deleted_at        timestamptz                                        NULL,
    purged_at         timestamptz                                        NULL,

    UNIQUE (public_id),
    UNIQUE (preset_key),
    CHECK (duration_min BETWEEN 5 AND 120)
);
COMMENT ON TABLE template IS 'Шаблоны занятий: готовые (preset_key задан, author_account_id NULL) и созданные воспитателями. Содержимое лежит в хранилище под templates/{id}/.';
COMMENT ON COLUMN template.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN template.public_id IS 'Короткий идентификатор для URL /app/template/{public_id}; начинается с «t».';
COMMENT ON COLUMN template.preset_key IS 'Ключ готового шаблона из каталога internal/preset. NULL у созданных в саду.';
COMMENT ON COLUMN template.name IS 'Название шаблона.';
COMMENT ON COLUMN template.description IS 'Короткое описание занятия (до 500 символов).';
COMMENT ON COLUMN template.topic IS 'Тема: math, literacy, world, speech, logic, drawing, sensory, routine, music, health, safety, social.';
COMMENT ON COLUMN template.ages IS 'Возрастные группы, подмножество {3-4, 4-5, 5-6, 6-7}.';
COMMENT ON COLUMN template.duration_min IS 'Длительность занятия в минутах, 5..120.';
COMMENT ON COLUMN template.author_account_id IS 'Автор шаблона. NULL - готовый шаблон коробки.';
COMMENT ON COLUMN template.created_at IS 'Время создания.';
COMMENT ON COLUMN template.updated_at IS 'Время обновления.';
COMMENT ON COLUMN template.deleted_at IS 'Время софт-удаления.';
COMMENT ON COLUMN template.purged_at IS 'Когда содержимое и медиа удалённого шаблона вычищены из хранилища. NULL - ещё лежат.';

CREATE INDEX idx_template_author_account_id ON template (author_account_id);

CREATE TABLE template_starred
(
    account_id  uuid REFERENCES account (id) ON DELETE CASCADE  NOT NULL,
    template_id uuid REFERENCES template (id) ON DELETE CASCADE NOT NULL,
    created_at  timestamptz                                     NOT NULL,
    PRIMARY KEY (account_id, template_id)
);
COMMENT ON TABLE template_starred IS 'Шаблоны, отмеченные педагогом как избранные.';
COMMENT ON COLUMN template_starred.account_id IS 'Учётная запись.';
COMMENT ON COLUMN template_starred.template_id IS 'Шаблон.';
COMMENT ON COLUMN template_starred.created_at IS 'Время отметки.';

CREATE INDEX idx_template_starred_template_id ON template_starred (template_id);

CREATE TABLE board
(
    id                   uuid PRIMARY KEY                                   NOT NULL,
    public_id            varchar(255)                                       NOT NULL,
    name                 varchar(255)                                       NOT NULL,
    team_id              uuid REFERENCES team (id) ON DELETE RESTRICT       NOT NULL,
    account_id           uuid REFERENCES account (id) ON DELETE RESTRICT    NOT NULL,
    template_id          uuid REFERENCES template (id)                      NULL,
    team_access          board_access                                       NULL,
    link_access_enabled  boolean DEFAULT false                              NOT NULL,
    present_token        varchar(64)                                        NULL,
    presenter_account_id uuid REFERENCES account (id) ON DELETE SET NULL    NULL,
    present_expires_at   timestamptz                                        NULL,
    last_opened_at       timestamptz                                        NULL,
    created_at           timestamptz                                        NOT NULL,
    updated_at           timestamptz                                        NOT NULL,
    deleted_at           timestamptz                                        NULL,
    purged_at            timestamptz                                        NULL,

    UNIQUE (public_id)
);
COMMENT ON TABLE board IS 'Интерактивные доски группы. Содержимое лежит в хранилище под boards/{id}/.';
COMMENT ON COLUMN board.id IS 'Уникальный идентификатор.';
COMMENT ON COLUMN board.public_id IS 'Короткий идентификатор для URL /app/board/{public_id}.';
COMMENT ON COLUMN board.name IS 'Название доски.';
COMMENT ON COLUMN board.team_id IS 'Группа, которой принадлежит доска.';
COMMENT ON COLUMN board.account_id IS 'Создатель доски.';
COMMENT ON COLUMN board.template_id IS 'Шаблон, из которого создана доска. NULL - пустая доска.';
COMMENT ON COLUMN board.team_access IS 'Доступ участников группы к содержимому: edit, view, deny. NULL - как у группы (team.member_board_access).';
COMMENT ON COLUMN board.link_access_enabled IS 'Доступ по ссылке: вошедшие педагоги вне группы видят доску только для чтения.';
COMMENT ON COLUMN board.present_token IS 'Токен публичной ссылки показа /app/present/{token}; NULL - показ выключен.';
COMMENT ON COLUMN board.presenter_account_id IS 'Ведущий показа: за его соединением следуют экраны. NULL - показ выключен или ведущий не назначен.';
COMMENT ON COLUMN board.present_expires_at IS 'Когда ссылка показа перестаёт работать; NULL - пока показ не выключат вручную.';
COMMENT ON COLUMN board.last_opened_at IS 'Когда доску открывали в последний раз (любой участник); проставляется при создании и при каждом открытии.';
COMMENT ON COLUMN board.created_at IS 'Время создания.';
COMMENT ON COLUMN board.updated_at IS 'Время обновления.';
COMMENT ON COLUMN board.deleted_at IS 'Время софт-удаления.';
COMMENT ON COLUMN board.purged_at IS 'Когда содержимое и медиа удалённой доски вычищены из хранилища. NULL - ещё лежат.';

CREATE INDEX idx_board_team_id ON board (team_id);
CREATE INDEX idx_board_account_id ON board (account_id);
CREATE INDEX idx_board_template_id ON board (template_id);
CREATE UNIQUE INDEX board_present_token_idx ON board (present_token) WHERE present_token IS NOT NULL;
-- Поиск досок по подстроке названия в списке со страницами; удалённые доски в индексе не нужны.
CREATE INDEX board_name_trgm_idx ON board USING gin (name gin_trgm_ops) WHERE deleted_at IS NULL;

CREATE TABLE board_starred
(
    account_id uuid REFERENCES account (id) ON DELETE CASCADE NOT NULL,
    board_id   uuid REFERENCES board (id) ON DELETE CASCADE   NOT NULL,
    created_at timestamptz                                    NOT NULL,
    PRIMARY KEY (account_id, board_id)
);
COMMENT ON TABLE board_starred IS 'Доски, отмеченные педагогом как избранные.';
COMMENT ON COLUMN board_starred.account_id IS 'Учётная запись.';
COMMENT ON COLUMN board_starred.board_id IS 'Доска.';
COMMENT ON COLUMN board_starred.created_at IS 'Время отметки.';

CREATE INDEX idx_board_starred_board_id ON board_starred (board_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS board_starred;
DROP TABLE IF EXISTS board;
DROP TABLE IF EXISTS template_starred;
DROP TABLE IF EXISTS template;
DROP TABLE IF EXISTS team_starred;
DROP TABLE IF EXISTS team_member;
DROP TABLE IF EXISTS team;
DROP TABLE IF EXISTS organization_member;
DROP TABLE IF EXISTS organization;
DROP TABLE IF EXISTS account;
DROP TYPE IF EXISTS organization_role;
DROP TYPE IF EXISTS team_role;
DROP TYPE IF EXISTS board_access;
-- +goose StatementEnd
