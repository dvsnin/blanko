# ---------- СТАДИЯ 1 — Сборка Go ----------
FROM golang:1.22 AS builder

WORKDIR /app

# Копируем модули для кэширования
COPY go.mod go.sum ./
RUN go mod download

# Копируем весь backend
COPY . .

# Собираем бинарник
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o server ./cmd/main.go


# ---------- СТАДИЯ 2 — Production образ ----------
FROM alpine:3.19

# Корректная поддержка времени
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Копируем бинарник
COPY --from=builder /app/server /app/server

# Копируем статические файлы (vite build)
COPY --from=builder /app/static /app/static

# Копируем шаблоны
COPY --from=builder /app/templates /app/templates

# Экспонируем порт
EXPOSE 8080

# Запуск
CMD ["/app/server"]
