#!/bin/bash
# Выполняется образом postgres один раз при создании тома. Основная база приложения
# создаётся самим образом из POSTGRES_DB, здесь добавляются база Keycloak со своей ролью
# и app_test для интеграционных тестов бэкенда.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE "$KC_POSTGRES_USER" LOGIN PASSWORD '$KC_POSTGRES_PASSWORD';
CREATE DATABASE "$KC_POSTGRES_DB" OWNER "$KC_POSTGRES_USER";
CREATE DATABASE app_test OWNER "$POSTGRES_USER";
SQL
