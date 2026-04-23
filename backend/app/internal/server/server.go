package server

import (
	"encoding/json"
	"fmt"
	"html"
	"html/template"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/gorilla/mux"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dvsnin/blanko/backend/app/internal/handler"
	"github.com/dvsnin/blanko/backend/app/internal/service"
)

// Server — HTTP-сервер приложения.
type Server struct {
	templates *template.Template
	api       *handler.API
	pool      *pgxpool.Pool
	services  *service.Services
}

// New создаёт сервер, прикрученный к pgxpool и сервисам.
func New(pool *pgxpool.Pool, services *service.Services) *Server {
	t := template.Must(template.ParseGlob(filepath.Join("templates", "*.tmpl")))
	return &Server{
		templates: t,
		pool:      pool,
		services:  services,
		api:       handler.NewAPI(services),
	}
}

// Router возвращает http.Handler для приложения.
func (s *Server) Router() http.Handler {
	r := mux.NewRouter()

	// API под /app/api/v1
	apiRouter := r.PathPrefix("/app/api/v1").Subrouter()
	s.api.Register(apiRouter)

	// общая статика (внутри backend/app/static/...)
	r.PathPrefix("/app/static/").Handler(
		http.StripPrefix("/app/static/", http.FileServer(http.Dir("static"))),
	)

	// статическая раздача canvas: /app/static/canvas/*
	r.PathPrefix("/app/static/canvas/").Handler(
		http.StripPrefix("/app/static/canvas/", http.FileServer(http.Dir("static/canvas"))),
	)

	// Страница дашборда
	r.HandleFunc("/app/dashboard", s.dashboardHandler)

	// Страница доски — uid трактуется как public_id
	r.HandleFunc("/app/board/{uid}", s.boardHandler)

	// logout
	r.HandleFunc("/app/logout", s.handleLogout)

	// ассеты vite dashboard
	r.PathPrefix("/app/assets/").Handler(
		http.StripPrefix("/app/assets/", http.FileServer(http.Dir("backend/static/dashboard/assets"))),
	)

	return r
}

// handleLogout завершает SSO-сессию пользователя:
//  1. редиректим на /oauth2/sign_out — oauth2-proxy удаляет свою cookie
//  2. параметр rd = Keycloak end_session_endpoint, куда oauth2-proxy отправит
//     пользователя дальше, чтобы прибить и SSO-сессию в Keycloak
//  3. post_logout_redirect_uri внутри Keycloak возвращает юзера на /app/dashboard,
//     где oauth2-proxy уже без cookie повторно запустит логин
//
// Чтобы Keycloak не показывал экран подтверждения logout, передаём id_token_hint.
// id_token приходит в заголовке Authorization (флаг --pass-authorization-header=true в oauth2-proxy).
func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	const (
		keycloakLogout   = "http://keycloak.localhost/realms/blanko/protocol/openid-connect/logout"
		postLogoutRedir  = "http://app.localhost/app/dashboard"
		keycloakClientID = "blanko"
	)

	kcURL := fmt.Sprintf(
		"%s?client_id=%s&post_logout_redirect_uri=%s",
		keycloakLogout,
		keycloakClientID,
		url.QueryEscape(postLogoutRedir),
	)

	// id_token_hint → Keycloak доверяет источнику и пропускает confirm prompt
	if authz := r.Header.Get("Authorization"); strings.HasPrefix(authz, "Bearer ") {
		idToken := strings.TrimPrefix(authz, "Bearer ")
		if idToken != "" {
			kcURL += "&id_token_hint=" + url.QueryEscape(idToken)
		}
	}

	signOutURL := "/oauth2/sign_out?rd=" + url.QueryEscape(kcURL)
	http.Redirect(w, r, signOutURL, http.StatusFound)
}

func (s *Server) dashboardHandler(w http.ResponseWriter, r *http.Request) {
	_, currentFile, _, _ := runtime.Caller(0)
	baseDir := filepath.Join(filepath.Dir(currentFile), "..", "..")
	indexPath := filepath.Join(baseDir, "static", "dashboard", "index.html")

	indexBytes, err := os.ReadFile(indexPath)
	if err != nil {
		http.Error(w, "Cannot load index.html: "+err.Error(), 500)
		return
	}

	indexHTML := string(indexBytes)
	indexHTML = strings.ReplaceAll(indexHTML, "/app/assets/", "/app/static/dashboard/assets/")

	// Минимальный срез состояния для первичного рендера: accountId (нужен
	// API-клиенту для каждого POST-запроса), профиль (name/email) и булевы
	// флаги hasTeams/hasBoards — чтобы скрыть empty-state пока TeamsContext
	// фетчит /team/list. Полные списки сюда НЕ кладём, их тянет TeamsContext —
	// чтобы не дублировать контракт с API.
	dashJSON := s.buildDashDataJSON(r)
	scriptTag := "<script>window.dashData = " + dashJSON + ";</script>\n"

	// Инжектим перед </body> — это единственная трансформация, поэтому
	// никакого html/template на dashboard-странице не нужно (и незачем
	// плодить артефакты от JS-контекстного экранирования).
	out := strings.Replace(indexHTML, "</body>", scriptTag+"</body>", 1)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(out))
}

// dashPayload — минимальный набор для первого рендера: accountId (нужен API
// клиенту для каждого POST-запроса) + имя/email для мгновенного отображения в UI.
// Команды/доски сюда НЕ кладём — их тянет TeamsContext через /team/list +
// /board/list сразу после монтирования, чтобы не дублировать данные в двух местах.
//
// name/email берутся из БД (id.Account), а не из Keycloak-заголовков —
// заголовок X-Forwarded-Preferred-Username содержит login (например "test"),
// а не реальное отображаемое имя аккаунта из таблицы accounts.
// HasTeams/HasBoards — лёгкие булевы флаги для фронта: позволяют на первом
// рендере сразу решить, показывать ли empty-state ("Команд не найдено...",
// "В этой команде пока нет досок..."), не дожидаясь async-фетча TeamsContext.
// Это убирает flash-of-empty-state у пользователей, у которых данные есть.
// Полные списки сюда НЕ кладём — их тянет TeamsContext.
type dashPayload struct {
	AccountID string `json:"accountId"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	HasTeams  bool   `json:"hasTeams"`
	HasBoards bool   `json:"hasBoards"`
}

// buildDashDataJSON собирает срез состояния для первичного рендера фронта.
// Любая ошибка деградирует изящно: отдаём то, что успели собрать — фронт либо
// уйдёт на перелогин (нет accountId), либо ретраит через TeamsContext.refresh().
func (s *Server) buildDashDataJSON(r *http.Request) string {
	profile := extractUser(r)

	payload := dashPayload{}
	if profile.Email == "" {
		return mustJSON(payload)
	}

	id, err := s.services.Auth.Resolve(r.Context(), profile.Email, profile.Name)
	if err != nil {
		log.Printf("dashboard: identity resolve failed: %v", err)
		return mustJSON(payload)
	}
	payload.AccountID = id.Account.ID.String()
	payload.Name = id.Account.Name
	payload.Email = id.Account.Email

	// Лёгкий запрос: TeamView уже содержит BoardCount, второй запрос за
	// досками не нужен. Ошибка здесь не фатальна — оставим флаги false,
	// фронт всё равно ретраит через TeamsContext.refresh().
	if teams, err := s.services.Team.List(r.Context(), *id); err == nil {
		payload.HasTeams = len(teams) > 0
		for _, t := range teams {
			if t.BoardCount > 0 {
				payload.HasBoards = true
				break
			}
		}
	} else {
		log.Printf("dashboard: team list failed: %v", err)
	}

	return mustJSON(payload)
}

// mustJSON сериализует в pretty-printed JSON (каждое поле на новой строке) —
// так window.dashData остаётся читабельным при view-source страницы.
func mustJSON(v any) string {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		log.Printf("dashboard: json marshal failed: %v", err)
		return "{}"
	}
	return string(b)
}

type UserProfile struct {
	Email string
	Name  string
}

func extractUser(r *http.Request) UserProfile {
	return UserProfile{
		Email: r.Header.Get("X-Forwarded-Email"),
		Name:  r.Header.Get("X-Forwarded-Preferred-Username"),
	}
}

func (s *Server) boardHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	uid := vars["uid"]
	if uid == "" {
		http.NotFound(w, r)
		return
	}

	_, currentFile, _, _ := runtime.Caller(0)
	baseDir := filepath.Join(filepath.Dir(currentFile), "..", "..")
	indexPath := filepath.Join(baseDir, "static", "canvas", "index.html")

	indexBytes, err := os.ReadFile(indexPath)
	if err != nil {
		http.Error(w, "Cannot load canvas index.html: "+err.Error(), http.StatusInternalServerError)
		return
	}
	indexHTML := string(indexBytes)

	indexHTML = strings.ReplaceAll(indexHTML, "/app/assets/", "/app/static/canvas/assets/")
	indexHTML = strings.ReplaceAll(indexHTML, "/assets/", "/app/static/canvas/assets/")
	indexHTML = strings.ReplaceAll(indexHTML, "href=\"assets/", "href=\"/app/static/canvas/assets/")
	indexHTML = strings.ReplaceAll(indexHTML, "src=\"assets/", "src=\"/app/static/canvas/assets/")
	indexHTML = strings.ReplaceAll(indexHTML, "src=\"/realtime/mockSocketClient.js\"", "src=\"/app/static/canvas/realtime/mockSocketClient.js\"")
	indexHTML = strings.ReplaceAll(indexHTML, "src=\"realtime/mockSocketClient.js\"", "src=\"/app/static/canvas/realtime/mockSocketClient.js\"")

	title := uid
	escTitle := html.EscapeString(title)
	indexHTML = strings.ReplaceAll(indexHTML, "%%BOARD_TITLE%%", escTitle)

	tmplData := struct {
		UID       string
		IndexHTML template.HTML
	}{
		UID:       uid,
		IndexHTML: template.HTML(indexHTML),
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := s.templates.ExecuteTemplate(w, "board", tmplData); err != nil {
		http.Error(w, "Template render error: "+err.Error(), http.StatusInternalServerError)
		return
	}
}
