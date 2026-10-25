package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dvsnin/blanko/backend/app/internal/handler"
	"github.com/dvsnin/blanko/backend/app/internal/model"
	"github.com/dvsnin/blanko/backend/app/internal/service"
)

// Server - HTTP-сервер приложения.
type Server struct {
	api      *handler.API
	pool     *pgxpool.Pool
	services *service.Services
	// tldrawLicenseKey прокидывается в canvas-страницу. Пустая строка -
	// валидное состояние: локально tldraw работает без лицензии.
	tldrawLicenseKey string
	// keycloakPublicURL - куда отправлять браузер на выход из Keycloak.
	keycloakPublicURL string
}

// New создаёт сервер, прикрученный к pgxpool и сервисам.
func New(pool *pgxpool.Pool, services *service.Services, tldrawLicenseKey, keycloakPublicURL string, mediaMaxBytes int64) *Server {
	return &Server{
		pool:              pool,
		services:          services,
		api:               handler.NewAPI(services, mediaMaxBytes),
		tldrawLicenseKey:  tldrawLicenseKey,
		keycloakPublicURL: keycloakPublicURL,
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

	// Вебсокет документа (комната доски или шаблона), та же авторизация, что и у API
	r.Handle("/app/ws/{kind}/{id}", s.api.AuthMiddleware(http.HandlerFunc(s.api.DocWS))).Methods(http.MethodGet)

	// Медиа документов: загрузка по kind в единственном числе, отдача по ключу хранилища
	r.Handle("/app/media/{kind}/{id}", s.api.AuthMiddleware(http.HandlerFunc(s.api.UploadMedia))).Methods(http.MethodPost)
	r.Handle("/app/media/{kind}s/{id}/media/{name}", s.api.AuthMiddleware(http.HandlerFunc(s.api.GetMedia))).Methods(http.MethodGet)

	// Страница доски - uid трактуется как public_id
	r.HandleFunc("/app/board/{uid}", s.boardHandler)

	// Режим показа: публичные маршруты по токену, без входа (oauth2-proxy пропускает /app/present/).
	r.HandleFunc("/app/present/{token}/ws", s.api.PresentWS).Methods(http.MethodGet)
	r.HandleFunc("/app/present/{token}/info", s.presentInfoHandler).Methods(http.MethodGet)
	r.HandleFunc("/app/present/{token}/media/{name}", s.api.GetPresentMedia).Methods(http.MethodGet)
	r.HandleFunc("/app/present/{token}", s.presentHandler).Methods(http.MethodGet)

	// Страница шаблона на том же канвасе, права решает сервер
	r.HandleFunc("/app/template/{uid}", s.templateHandler)

	// logout
	r.HandleFunc("/app/logout", s.handleLogout)

	// ассеты vite dashboard
	r.PathPrefix("/app/assets/").Handler(
		http.StripPrefix("/app/assets/", http.FileServer(http.Dir("backend/static/dashboard/assets"))),
	)

	return r
}

// handleLogout завершает SSO-сессию пользователя:
//  1. редиректим на /oauth2/sign_out - oauth2-proxy удаляет свою cookie
//  2. параметр rd = Keycloak end_session_endpoint, куда oauth2-proxy отправит
//     пользователя дальше, чтобы прибить и SSO-сессию в Keycloak
//  3. post_logout_redirect_uri внутри Keycloak возвращает юзера на /app/dashboard,
//     где oauth2-proxy уже без cookie повторно запустит логин
//
// Чтобы Keycloak не показывал экран подтверждения logout, передаём id_token_hint.
// id_token приходит в заголовке Authorization (флаг --pass-authorization-header=true в oauth2-proxy).
func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	const keycloakClientID = "blanko"
	keycloakLogout := s.keycloakPublicURL + "/realms/blanko/protocol/openid-connect/logout"
	// Возвращаемся на тот хост, с которого вышли: localhost, IP или имя в сети сада.
	scheme := "http"
	if p := r.Header.Get("X-Forwarded-Proto"); p != "" {
		scheme = p
	}
	postLogoutRedir := scheme + "://" + r.Host + "/app/dashboard"

	kcURL := fmt.Sprintf(
		"%s?client_id=%s&post_logout_redirect_uri=%s",
		keycloakLogout,
		keycloakClientID,
		url.QueryEscape(postLogoutRedir),
	)

	// id_token_hint -> Keycloak доверяет источнику и пропускает confirm prompt
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
	payload := s.buildDashData(r)
	// Заголовок вкладки до запуска фронта: раздел «Доски» и название сада, дальше его ведёт App.
	indexHTML = strings.Replace(indexHTML, "<title>Blanko</title>", "<title>"+html.EscapeString(pageTitle("Доски", payload.OrgName))+"</title>", 1)

	// Минимальный срез состояния для первичного рендера: accountId (нужен
	// API-клиенту для каждого POST-запроса), профиль (name/email) и булевы
	// флаги hasTeams/hasBoards - чтобы скрыть empty-state пока TeamsContext
	// фетчит /team/list. Полные списки сюда НЕ кладём, их тянет TeamsContext -
	// чтобы не дублировать контракт с API.
	dashJSON := mustJSON(payload)
	scriptTag := "<script>window.dashData = " + dashJSON + ";</script>\n"

	// Инжектим перед </body> - это единственная трансформация, поэтому
	// никакого html/template на dashboard-странице не нужно (и незачем
	// плодить артефакты от JS-контекстного экранирования).
	out := strings.Replace(indexHTML, "</body>", scriptTag+"</body>", 1)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Write([]byte(out))
}

// dashPayload - минимальный набор для первого рендера: accountId (нужен API
// клиенту для каждого POST-запроса) + имя/email для мгновенного отображения в UI.
// Команды/доски сюда НЕ кладём - их тянет TeamsContext через /team/list +
// /board/list сразу после монтирования, чтобы не дублировать данные в двух местах.
//
// name/email берутся из БД (id.Account), а не из заголовков: имя из Keycloak нужно
// только при первом входе, дальше его правят в профиле кабинета.
// HasTeams/HasBoards - лёгкие булевы флаги для фронта: позволяют на первом
// рендере сразу решить, показывать ли empty-state ("Команд не найдено...",
// "В этой команде пока нет досок..."), не дожидаясь async-фетча TeamsContext.
// Это убирает flash-of-empty-state у пользователей, у которых данные есть.
// Полные списки сюда НЕ кладём - их тянет TeamsContext.
type dashPayload struct {
	AccountID string `json:"accountId"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	OrgRole   string `json:"orgRole"`
	OrgName   string `json:"orgName"`
	HasTeams  bool   `json:"hasTeams"`
	HasBoards bool   `json:"hasBoards"`
	// Настройки кабинета сразу в HTML, чтобы активная группа и фильтры не «прыгали» после загрузки.
	Prefs map[string]any `json:"prefs"`
}

// buildDashDataJSON собирает срез состояния для первичного рендера фронта.
// Любая ошибка деградирует изящно: отдаём то, что успели собрать - фронт либо
// уйдёт на перелогин (нет accountId), либо ретраит через TeamsContext.refresh().
func (s *Server) buildDashDataJSON(r *http.Request) string {
	return mustJSON(s.buildDashData(r))
}

func (s *Server) buildDashData(r *http.Request) dashPayload {
	profile := extractUser(r)

	payload := dashPayload{}
	if profile.Email == "" {
		return payload
	}

	id, err := s.services.Auth.Resolve(r.Context(), profile.Email, profile.Name)
	if err != nil {
		log.Printf("dashboard: identity resolve failed: %v", err)
		return payload
	}
	payload.AccountID = id.Account.ID.String()
	payload.Name = id.Account.Name
	payload.Email = id.Account.Email
	payload.OrgRole = string(id.OrgRole)
	payload.OrgName = id.OrgName
	payload.Prefs = id.Account.Prefs
	if payload.Prefs == nil {
		payload.Prefs = map[string]any{}
	}

	// Лёгкий запрос: TeamView уже содержит BoardCount, второй запрос за
	// досками не нужен. Ошибка здесь не фатальна - оставим флаги false,
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

	return payload
}

// mustJSON сериализует в pretty-printed JSON (каждое поле на новой строке) -
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
		Name:  handler.DisplayNameFrom(r),
	}
}

func (s *Server) boardHandler(w http.ResponseWriter, r *http.Request) {
	uid := mux.Vars(r)["uid"]
	if uid == "" {
		http.NotFound(w, r)
		return
	}
	// Канвасу нужен id доски для вебсокета и медиа, поэтому без доски страницы нет.
	board, err := s.services.Board.GetByPublicID(r.Context(), uid)
	if errors.Is(err, service.ErrNotFound) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		log.Printf("board page %s: %v", uid, err)
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	title := strings.TrimSpace(board.Name)
	if title == "" {
		title = uid
	}
	access := model.BoardAccessDeny
	profile := extractUser(r)
	if profile.Email != "" {
		if id, err := s.services.Auth.Resolve(r.Context(), profile.Email, profile.Name); err == nil {
			if access, err = s.services.Board.Access(r.Context(), *board, *id); err != nil {
				log.Printf("board page %s: access: %v", uid, err)
			}
		} else {
			log.Printf("board page: identity resolve failed: %v", err)
		}
	}
	if access == model.BoardAccessDeny {
		s.renderDenied(w)
		return
	}
	if err := s.services.Board.MarkOpened(r.Context(), uid); err != nil {
		log.Printf("board mark opened %s: %v", uid, err)
	}
	s.renderCanvas(w, r, title, canvasDoc{Kind: "board", ID: board.ID.String(), PublicID: uid, CanEdit: access == model.BoardAccessEdit, PresentEnabled: board.PresentToken != nil, PresenterID: presenterID(board)})
}

// templateHandler: автор и админы получают запись, остальные только чтение.
func (s *Server) templateHandler(w http.ResponseWriter, r *http.Request) {
	uid := mux.Vars(r)["uid"]
	if uid == "" {
		http.NotFound(w, r)
		return
	}
	tpl, err := s.services.Template.GetByPublicID(r.Context(), uid)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	readOnly := true
	profile := extractUser(r)
	if profile.Email != "" {
		if id, err := s.services.Auth.Resolve(r.Context(), profile.Email, profile.Name); err == nil {
			readOnly = !s.services.Template.CanEdit(*tpl, *id)
		} else {
			log.Printf("template page: identity resolve failed: %v", err)
		}
	}
	title := strings.TrimSpace(tpl.Name)
	if title == "" {
		title = uid
	}
	s.renderCanvas(w, r, title, canvasDoc{Kind: "template", ID: tpl.ID.String(), PublicID: uid, CanEdit: !readOnly})
}

// renderDenied - страница 403 для доски, к которой у пользователя нет доступа.
func (s *Server) renderDenied(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusForbidden)
	_, _ = w.Write([]byte(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Доска недоступна</title>
<style>body{margin:0;font-family:Nunito,"Segoe UI",system-ui,sans-serif;background:#F6F4EE;color:#22262E;display:flex;align-items:center;justify-content:center;height:100vh}
.card{background:#fff;border:1px solid #E6E2D9;border-radius:16px;padding:28px 32px;text-align:center;max-width:420px}
h1{font-size:20px;margin:0 0 8px}p{margin:0 0 18px;color:#5B6472;font-size:14px;line-height:1.5}
</style></head>
<body><div class="card"><h1>Доска недоступна</h1><p>У вас нет доступа к этой доске. Попросите владельца добавить вас в группу или открыть доступ по ссылке.</p><a href="/app/dashboard#/boards">В кабинет</a></div></body></html>`))
}

// canvasDoc - то, что канвас узнаёт о документе: window.APP_DOC.
type canvasDoc struct {
	Kind     string `json:"kind"`
	ID       string `json:"id"`
	PublicID string `json:"publicId"`
	CanEdit  bool   `json:"canEdit"`
	// Показ включён и кто ведёт: редакторам нужно для кнопки «Вести показ».
	PresentEnabled bool   `json:"presentEnabled"`
	PresenterID    string `json:"presenterId"`
	// Present заполнен только на экране показа: токен для вебсокета и медиа, ведущий.
	Present *presentDoc `json:"present,omitempty"`
}

type presentDoc struct {
	Token         string `json:"token"`
	PresenterID   string `json:"presenterId"`
	PresenterName string `json:"presenterName"`
}

func presenterID(b *model.Board) string {
	if b.PresenterAccountID == nil {
		return ""
	}
	return b.PresenterAccountID.String()
}

// presentHandler - экран показа: холст только для чтения, следует за ведущим, без входа.
func (s *Server) presentHandler(w http.ResponseWriter, r *http.Request) {
	board, err := s.services.Board.ResolvePresentToken(r.Context(), mux.Vars(r)["token"])
	if errors.Is(err, service.ErrNotFound) {
		s.renderPresentGone(w)
		return
	}
	if err != nil {
		log.Printf("present page: %v", err)
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	title := strings.TrimSpace(board.Name)
	if title == "" {
		title = board.PublicID
	}
	// Экран получает постоянный id: редакторы видят его в списке участников одной строкой,
	// сколько бы окон на нём ни открыли.
	if c, err := r.Cookie(handler.ScreenCookie); err != nil || c.Value == "" {
		http.SetCookie(w, &http.Cookie{Name: handler.ScreenCookie, Value: uuid.NewString(), Path: "/app/present/", MaxAge: 365 * 24 * 3600, HttpOnly: true, SameSite: http.SameSiteLaxMode})
	}
	s.renderCanvas(w, r, title, canvasDoc{
		Kind: "board", ID: board.ID.String(), PublicID: board.PublicID, CanEdit: false,
		PresentEnabled: true, PresenterID: presenterID(board),
		Present: &presentDoc{Token: *board.PresentToken, PresenterID: presenterID(board), PresenterName: board.PresenterName},
	})
}

// presentInfoHandler - кто сейчас ведёт показ: зритель опрашивает, чтобы заметить передачу роли.
func (s *Server) presentInfoHandler(w http.ResponseWriter, r *http.Request) {
	board, err := s.services.Board.ResolvePresentToken(r.Context(), mux.Vars(r)["token"])
	if errors.Is(err, service.ErrNotFound) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write([]byte(mustJSON(presentDoc{Token: "", PresenterID: presenterID(board), PresenterName: board.PresenterName})))
}

// renderPresentGone - ссылка показа не действует: показ выключен или истёк.
func (s *Server) renderPresentGone(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusNotFound)
	_, _ = w.Write([]byte(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Показ недоступен</title><link rel="stylesheet" href="/app/static/fonts/nunito.css">
<style>body{margin:0;font-family:Nunito,"Segoe UI",system-ui,sans-serif;background:#F6F4EE;color:#22262E;display:flex;align-items:center;justify-content:center;height:100vh}
.card{background:#fff;border:1px solid #E6E2D9;border-radius:16px;padding:28px 32px;text-align:center;max-width:440px}
h1{font-size:20px;margin:0 0 8px}p{margin:0 0 18px;color:#5B6472;font-size:14px;line-height:1.5}
</style></head>
<body><div class="card"><h1>Показ недоступен</h1><p>Ссылка больше не действует: показ выключен или его срок истёк. Попросите воспитателя включить показ заново.</p></div></body></html>`))
}

func (s *Server) renderCanvas(w http.ResponseWriter, r *http.Request, title string, d canvasDoc) {
	_, currentFile, _, _ := runtime.Caller(0)
	baseDir := filepath.Join(filepath.Dir(currentFile), "..", "..")
	indexPath := filepath.Join(baseDir, "static", "canvas", "index.html")

	indexBytes, err := os.ReadFile(indexPath)
	if err != nil {
		http.Error(w, "Cannot load canvas index.html: "+err.Error(), http.StatusInternalServerError)
		return
	}
	indexHTML := string(indexBytes)
	indexHTML = strings.ReplaceAll(indexHTML, "%%BOARD_TITLE%%", html.EscapeString(title))
	kindWord := "Доска"
	if d.Kind == "template" {
		kindWord = "Шаблон"
	}
	if d.Present != nil {
		kindWord = "Показ"
	}
	indexHTML = strings.ReplaceAll(indexHTML, "%%PAGE_TITLE%%", html.EscapeString(pageTitle(title, kindWord)))

	docJSON, _ := json.Marshal(d)
	dashJSON := s.buildDashDataJSON(r)
	licenseJSON, _ := json.Marshal(s.tldrawLicenseKey)
	injectTag := "<script>window.APP_DOC = " + string(docJSON) +
		"; window.dashData = " + dashJSON +
		"; window.TLDRAW_LICENSE_KEY = " + string(licenseJSON) + ";</script>\n"
	indexHTML = strings.Replace(indexHTML, "</head>", injectTag+"</head>", 1)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Write([]byte(indexHTML))
}

// pageTitle - заголовок вкладки «Главное · Уточнение»: раздел и сад в кабинете, название и вид документа на канвасе.
func pageTitle(main, detail string) string {
	if strings.TrimSpace(detail) == "" {
		return main
	}
	return main + " · " + detail
}
