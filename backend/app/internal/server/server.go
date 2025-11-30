package server

import (
	"fmt"
	"html"
	"html/template"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/gorilla/mux"
)

type Server struct {
	templates *template.Template
}

func New() *Server {
	// Работает при запуске из backend/
	t := template.Must(template.ParseGlob(filepath.Join("templates", "*.tmpl")))
	return &Server{templates: t}
}

func (s *Server) Router() http.Handler {
	r := mux.NewRouter()

	// общая статика (внутри backend/app/static/...)
	r.PathPrefix("/app/static/").Handler(
		http.StripPrefix("/app/static/", http.FileServer(http.Dir("static"))),
	)

	// статическая раздача canvas: /app/static/canvas/*
	r.PathPrefix("/app/static/canvas/").Handler(
		http.StripPrefix("/app/static/canvas/", http.FileServer(http.Dir("static/canvas"))),
	)

	// регистрируем dashboard
	r.HandleFunc("/app/dashboard", s.dashboardHandler)

	// регистрация board (canvas)
	// /app/board/{uid}
	r.HandleFunc("/app/board/{uid}", s.boardHandler)

	// logout
	r.HandleFunc("/app/logout", s.handleLogout)

	// ассеты vite для dashboard (существующий маршрут, можно оставить)
	r.PathPrefix("/app/assets/").Handler(
		http.StripPrefix("/app/assets/", http.FileServer(http.Dir("backend/static/dashboard/assets"))),
	)

	return r
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, "/app/dashboard", http.StatusFound)
}

func (s *Server) dashboardHandler(w http.ResponseWriter, r *http.Request) {
	// оригинальный dashboard handler (не меняем)
	_, currentFile, _, _ := runtime.Caller(0)
	baseDir := filepath.Join(filepath.Dir(currentFile), "..", "..")
	indexPath := filepath.Join(baseDir, "static", "dashboard", "index.html")

	indexBytes, err := os.ReadFile(indexPath)
	if err != nil {
		http.Error(w, "Cannot load index.html: "+err.Error(), 500)
		return
	}

	indexHTML := string(indexBytes)

	indexHTML = strings.ReplaceAll(
		indexHTML,
		"/app/assets/",
		"/app/static/dashboard/assets/",
	)

	userProfile := extractUser(r)

	data := struct {
		Name          string
		Email         string
		IndexHTML     template.HTML
		WorkspaceName string
	}{
		Name:          userProfile.Name,
		Email:         userProfile.Email,
		IndexHTML:     template.HTML(indexHTML),
		WorkspaceName: "Дмитрий Васянин",
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	s.templates.ExecuteTemplate(w, "dashboard", data)
}

type UserProfile struct {
	Email string
	Name  string
}

func extractUser(r *http.Request) UserProfile {
	for s, i := range r.Header {
		fmt.Println(s, i)
	}

	return UserProfile{
		Email: r.Header.Get("X-Forwarded-Email"),
		Name:  r.Header.Get("X-Forwarded-Preferred-Username"),
	}
}

// фрагмент: обновлённый boardHandler
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

	// Поправляем пути — покрываем несколько возможных форматов, которые может сгенерировать Vite
	// Длинные префиксы первыми, затем относительные
	indexHTML = strings.ReplaceAll(indexHTML, "/app/assets/", "/app/static/canvas/assets/")
	indexHTML = strings.ReplaceAll(indexHTML, "/assets/", "/app/static/canvas/assets/")
	indexHTML = strings.ReplaceAll(indexHTML, "href=\"assets/", "href=\"/app/static/canvas/assets/")
	indexHTML = strings.ReplaceAll(indexHTML, "src=\"assets/", "src=\"/app/static/canvas/assets/")

	// Для mockSocketClient: заменяем только атрибуты src="..." (чтобы не сломать уже подставленные абсолютные пути
	// внутри скриптов/рядовых строк). Это предотвращает появление дублирующего префикса /app/static/canvas/app/static/...
	indexHTML = strings.ReplaceAll(indexHTML, "src=\"/realtime/mockSocketClient.js\"", "src=\"/app/static/canvas/realtime/mockSocketClient.js\"")
	indexHTML = strings.ReplaceAll(indexHTML, "src=\"realtime/mockSocketClient.js\"", "src=\"/app/static/canvas/realtime/mockSocketClient.js\"")

	// подставляем название доски (пока uid)
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
