-- +goose Up
-- +goose StatementBegin
CREATE TYPE board_access AS ENUM ('deny', 'view', 'edit');
CREATE TYPE plan_type AS ENUM ('free', 'pro');
CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE organization_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE IF NOT EXISTS account
(
    id         uuid PRIMARY KEY,
    email      varchar(255) NOT NULL UNIQUE,
    name       varchar(255) NOT NULL,
    created_at timestamp    NOT NULL,
    updated_at timestamp    NOT NULL,
    deleted_at timestamp
);

CREATE TABLE IF NOT EXISTS organization
(
    id         uuid PRIMARY KEY,
    name       text      NOT NULL,
    created_at timestamp NOT NULL,
    updated_at timestamp NOT NULL,
    deleted_at timestamp
);

CREATE TABLE IF NOT EXISTS organization_domain
(
    id              uuid PRIMARY KEY,
    organization_id uuid      NOT NULL REFERENCES organization (id),
    domain          text      NOT NULL UNIQUE,
    created_at      timestamp NOT NULL,
    updated_at      timestamp NOT NULL,
    deleted_at      timestamp
);

CREATE TABLE IF NOT EXISTS organization_permission
(
    id                        uuid PRIMARY KEY,
    organization_id           uuid      NOT NULL REFERENCES organization (id),
    auto_join_users           boolean   NOT NULL DEFAULT false,
    allow_team_creation       boolean   NOT NULL DEFAULT false,
    restrict_external_sharing boolean   NOT NULL DEFAULT false,
    created_at                timestamp NOT NULL,
    updated_at                timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_member
(
    organization_id uuid              NOT NULL REFERENCES organization (id),
    account_id      uuid              NOT NULL REFERENCES account (id),
    role            organization_role NOT NULL,
    created_at      timestamp         NOT NULL,
    updated_at      timestamp         NOT NULL,
    deleted_at      timestamp,
    PRIMARY KEY (organization_id, account_id)
);

CREATE TABLE IF NOT EXISTS workspace
(
    id               uuid PRIMARY KEY,
    name             text      NOT NULL,
    owner_account_id uuid      NOT NULL REFERENCES account (id),
    organization_id  uuid REFERENCES organization (id),
    created_at       timestamp NOT NULL,
    updated_at       timestamp NOT NULL,
    deleted_at       timestamp
);

CREATE TABLE IF NOT EXISTS license
(
    workspace_id uuid PRIMARY KEY REFERENCES workspace (id),
    plan         plan_type NOT NULL,
    seats        int       NOT NULL,
    expires_at   timestamp,
    created_at   timestamp NOT NULL,
    updated_at   timestamp NOT NULL,
    deleted_at   timestamp
);

CREATE TABLE IF NOT EXISTS team
(
    id                  uuid PRIMARY KEY,
    workspace_id        uuid         NOT NULL REFERENCES workspace (id),
    name                varchar(255) NOT NULL,
    member_board_access board_access NOT NULL,
    created_at          timestamp    NOT NULL,
    updated_at          timestamp    NOT NULL,
    deleted_at          timestamp
);


CREATE TABLE IF NOT EXISTS team_member
(
    team_id    uuid      NOT NULL REFERENCES team (id),
    account_id uuid      NOT NULL REFERENCES account (id),
    role       team_role NOT NULL,
    created_at timestamp NOT NULL,
    updated_at timestamp NOT NULL,
    deleted_at timestamp,
    PRIMARY KEY (team_id, account_id)
);

CREATE TABLE IF NOT EXISTS board
(
    id          uuid PRIMARY KEY,
    name        varchar(255) NOT NULL,
    team_id     uuid         NOT NULL REFERENCES team (id),
    account_id  uuid         NOT NULL REFERENCES account (id),
    team_access board_access NOT NULL,
    link_access board_access NOT NULL,
    created_at  timestamp    NOT NULL,
    updated_at  timestamp    NOT NULL,
    deleted_at  timestamp
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- +goose StatementEnd
