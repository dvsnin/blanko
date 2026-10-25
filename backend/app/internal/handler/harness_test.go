package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dvsnin/blanko/backend/app/internal/database"
	"github.com/dvsnin/blanko/backend/app/internal/doc"
	"github.com/dvsnin/blanko/backend/app/internal/model"
	"github.com/dvsnin/blanko/backend/app/internal/repository"
	"github.com/dvsnin/blanko/backend/app/internal/server"
	"github.com/dvsnin/blanko/backend/app/internal/service"
	"github.com/dvsnin/blanko/backend/app/internal/storage"
)

// Интеграционная обвязка: реальный Postgres из TEST_POSTGRES_DSN (отдельная база,
// не стенд), хранилище в памяти, сервер через httptest. Без переменной тесты скипаются.

const (
	migrationsDir     = "../../migration"
	testMediaMaxBytes = 1 << 20
)

var migrateOnce sync.Once

type env struct {
	t        *testing.T
	ctx      context.Context
	pool     *pgxpool.Pool
	store    *storage.Memory
	hub      *doc.Hub
	services *service.Services
	srv      *httptest.Server
}

func newEnv(t *testing.T) *env { return newEnvWith(t, 50*time.Millisecond) }

// newEnvWith - окружение с заданным периодом сброса комнат (час, чтобы тикер не мешал).
func newEnvWith(t *testing.T, flushInterval time.Duration) *env {
	t.Helper()
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("TEST_POSTGRES_DSN not set")
	}
	// Тесты делают TRUNCATE: страховка от DSN стенда.
	if u, err := url.Parse(dsn); err != nil || !strings.HasSuffix(strings.TrimPrefix(u.Path, "/"), "_test") {
		t.Fatalf("TEST_POSTGRES_DSN must point to a database named *_test")
	}
	ctx, cancel := context.WithCancel(context.Background())
	pool, err := database.Connect(ctx, dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	migrateOnce.Do(func() {
		if err := database.Migrate(ctx, pool, migrationsDir); err != nil {
			t.Fatalf("migrate: %v", err)
		}
	})
	_, err = pool.Exec(ctx, `TRUNCATE account, organization, organization_member, team, team_member, team_starred,
		board, board_starred, template, template_starred CASCADE`)
	if err != nil {
		t.Fatalf("truncate: %v", err)
	}

	store := storage.NewMemory()
	hub := doc.NewHub(store, flushInterval)
	go hub.Run(ctx)
	services := service.New(pool, store, hub)
	s := server.New(pool, services, "", "http://localhost:8081", testMediaMaxBytes)
	srv := httptest.NewServer(s.Router())
	t.Cleanup(func() {
		srv.Close()
		cancel()
		pool.Close()
	})
	return &env{t: t, ctx: ctx, pool: pool, store: store, hub: hub, services: services, srv: srv}
}

// --- фикстуры ---

func (e *env) account(email string) model.Account {
	e.t.Helper()
	id, err := e.services.Auth.Resolve(e.ctx, email, "")
	if err != nil {
		e.t.Fatalf("account %s: %v", email, err)
	}
	return id.Account
}

func (e *env) team(owner model.Account) model.Team {
	e.t.Helper()
	repo := repository.NewTeamRepo(e.pool)
	team := &model.Team{Name: "Группа " + owner.Name}
	if err := repo.Create(e.ctx, team); err != nil {
		e.t.Fatalf("team create: %v", err)
	}
	if err := repo.AddMember(e.ctx, team.ID, owner.ID, model.TeamRoleOwner); err != nil {
		e.t.Fatalf("team owner: %v", err)
	}
	return *team
}

// orgAdmin делает аккаунт администратором организации (организация создаётся при первом вызове).
func (e *env) orgAdmin(email string) model.Account {
	e.t.Helper()
	acc := e.account(email)
	repo := repository.NewOrganizationRepo(e.pool)
	org, err := repo.GetFirst(e.ctx)
	if errors.Is(err, repository.ErrNotFound) {
		org = &model.Organization{Name: "Сад", OwnerAccountID: acc.ID}
		if err := repo.Create(e.ctx, org); err != nil {
			e.t.Fatalf("org create: %v", err)
		}
	} else if err != nil {
		e.t.Fatalf("org: %v", err)
	}
	if err := repo.UpsertMember(e.ctx, org.ID, acc.ID, model.OrgRoleAdmin); err != nil {
		e.t.Fatalf("org admin: %v", err)
	}
	return e.account(email) // перечитать роль
}

func (e *env) addMember(team model.Team, acc model.Account) {
	e.t.Helper()
	if err := repository.NewTeamRepo(e.pool).AddMember(e.ctx, team.ID, acc.ID, model.TeamRoleMember); err != nil {
		e.t.Fatalf("add member: %v", err)
	}
}

func (e *env) board(team model.Team, owner model.Account, name string) model.Board {
	return e.boardWith(team, owner, name, model.BoardAccessEdit, false)
}

// boardWith - доска с заданным доступом участников группы и флагом доступа по ссылке.
func (e *env) boardWith(team model.Team, owner model.Account, name string, access model.BoardAccess, link bool) model.Board {
	e.t.Helper()
	b := &model.Board{Name: name, TeamID: team.ID, AccountID: owner.ID, TeamAccess: access, LinkAccessEnabled: link}
	if err := repository.NewBoardRepo(e.pool).Create(e.ctx, b); err != nil {
		e.t.Fatalf("board create: %v", err)
	}
	return *b
}

func (e *env) template(author *model.Account, name string) model.Template {
	e.t.Helper()
	t := &model.Template{Name: name, Topic: "math", Ages: []string{"3-4"}, DurationMin: 20}
	if author != nil {
		id := author.ID
		t.AuthorAccountID = &id
	}
	if err := repository.NewTemplateRepo(e.pool).Create(e.ctx, t); err != nil {
		e.t.Fatalf("template create: %v", err)
	}
	return *t
}

// --- HTTP ---

// post шлёт action-запрос API от имени email: accountId подставляется сам.
func (e *env) post(email, path string, body map[string]any) (int, map[string]any) {
	e.t.Helper()
	acc := e.account(email)
	payload := map[string]any{"accountId": acc.ID.String()}
	for k, v := range body {
		payload[k] = v
	}
	raw, _ := json.Marshal(payload)
	resp := e.rawPost(email, "/app/api/v1"+path, "application/json", bytes.NewReader(raw))
	defer resp.Body.Close()
	out := map[string]any{}
	data, _ := io.ReadAll(resp.Body)
	if len(data) > 0 {
		_ = json.Unmarshal(data, &out)
	}
	return resp.StatusCode, out
}

func (e *env) rawPost(email, path, contentType string, body io.Reader) *http.Response {
	e.t.Helper()
	req, _ := http.NewRequest(http.MethodPost, e.srv.URL+path, body)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-Forwarded-Email", email)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.t.Fatalf("post %s: %v", path, err)
	}
	return resp
}

func (e *env) get(email, path string) *http.Response {
	e.t.Helper()
	req, _ := http.NewRequest(http.MethodGet, e.srv.URL+path, nil)
	req.Header.Set("X-Forwarded-Email", email)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.t.Fatalf("get %s: %v", path, err)
	}
	return resp
}

func items(body map[string]any) []any {
	list, _ := body["items"].([]any)
	return list
}

func eventually(t *testing.T, timeout time.Duration, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("condition not met within %s", timeout)
}

// --- WebSocket ---

func (e *env) dial(email string, kind doc.Kind, id uuid.UUID) (*websocket.Conn, *http.Response, error) {
	e.t.Helper()
	url := "ws" + strings.TrimPrefix(e.srv.URL, "http") + "/app/ws/" + string(kind) + "/" + id.String()
	hdr := http.Header{"X-Forwarded-Email": {email}}
	return websocket.DefaultDialer.Dial(url, hdr)
}

// mustDial подключается и возвращает соединение вместе с первым сообщением (init).
func (e *env) mustDial(email string, kind doc.Kind, id uuid.UUID) (*websocket.Conn, map[string]any) {
	e.t.Helper()
	c, _, err := e.dial(email, kind, id)
	if err != nil {
		e.t.Fatalf("dial: %v", err)
	}
	e.t.Cleanup(func() { c.Close() })
	return c, readMsg(e.t, c, 2*time.Second)
}

func readMsg(t *testing.T, c *websocket.Conn, timeout time.Duration) map[string]any {
	t.Helper()
	_ = c.SetReadDeadline(time.Now().Add(timeout))
	_, data, err := c.ReadMessage()
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	var out map[string]any
	if err := json.Unmarshal(data, &out); err != nil {
		t.Fatalf("decode %q: %v", data, err)
	}
	return out
}

// readClose ждёт закрытия и возвращает код.
func readClose(t *testing.T, c *websocket.Conn, timeout time.Duration) int {
	t.Helper()
	_ = c.SetReadDeadline(time.Now().Add(timeout))
	for {
		_, _, err := c.ReadMessage()
		if err == nil {
			continue
		}
		var ce *websocket.CloseError
		if errors.As(err, &ce) {
			return ce.Code
		}
		t.Fatalf("expected close, got %v", err)
	}
}

func writeMsg(t *testing.T, c *websocket.Conn, v any) {
	t.Helper()
	if err := c.WriteJSON(v); err != nil {
		t.Fatalf("write: %v", err)
	}
}

func pushMsg(seq int, put map[string]any, remove []string) map[string]any {
	return map[string]any{"type": "push", "seq": seq, "schema": map[string]any{"schemaVersion": 2}, "put": put, "remove": remove}
}

func shape(id string) map[string]any {
	return map[string]any{"id": id, "typeName": "shape", "type": "geo"}
}

// presenceMsg - сообщение presence с минимальной записью: сервер не заглядывает
// внутрь record дальше id, остальные поля для него непрозрачны.
func presenceMsg(id, name string) map[string]any {
	return map[string]any{"type": "presence", "record": map[string]any{
		"id": id, "typeName": "instance_presence", "userId": "user-" + id, "userName": name,
	}}
}

func (e *env) updatedAt(table string, id uuid.UUID) time.Time {
	e.t.Helper()
	var ts time.Time
	if err := e.pool.QueryRow(e.ctx, "SELECT updated_at FROM "+table+" WHERE id = $1", id).Scan(&ts); err != nil {
		e.t.Fatalf("updated_at: %v", err)
	}
	return ts
}

// upload шлёт multipart с одним файлом в POST /app/media/{kind}/{id}.
func (e *env) upload(email string, kind doc.Kind, id uuid.UUID, filename, contentType string, body []byte) (int, map[string]any) {
	e.t.Helper()
	return e.uploadTo(email, "/app/media/"+string(kind)+"/"+id.String(), filename, contentType, body)
}

// uploadTo шлёт multipart с одним файлом в произвольный путь.
func (e *env) uploadTo(email, path, filename, contentType string, body []byte) (int, map[string]any) {
	e.t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	hdr := textproto.MIMEHeader{}
	hdr.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, filename))
	hdr.Set("Content-Type", contentType)
	part, err := mw.CreatePart(hdr)
	if err != nil {
		e.t.Fatal(err)
	}
	_, _ = part.Write(body)
	_ = mw.Close()
	resp := e.rawPost(email, path, mw.FormDataContentType(), &buf)
	defer resp.Body.Close()
	out := map[string]any{}
	data, _ := io.ReadAll(resp.Body)
	if len(data) > 0 {
		_ = json.Unmarshal(data, &out)
	}
	return resp.StatusCode, out
}
