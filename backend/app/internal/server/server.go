package server

import (
	"fmt"
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

	// статика
	r.PathPrefix("/static/").Handler(
		http.StripPrefix("/static/", http.FileServer(http.Dir("static"))),
	)

	// регистрируем dashboard
	r.HandleFunc("/dashboard", s.dashboardHandler)

	// logout
	r.HandleFunc("/logout", s.handleLogout)

	// ассеты vite
	r.PathPrefix("/assets/").Handler(
		http.StripPrefix("/assets/", http.FileServer(http.Dir("backend/static/dashboard/assets"))),
	)

	return r
}

type User struct {
	Name  string
	Email string
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, "/dashboard", http.StatusFound)
}

type DashboardData struct {
	Name  string
	Email string
}

func (s *Server) dashboardHandler(w http.ResponseWriter, r *http.Request) {
	// получаем абсолютный путь к текущему файлу server.go
	_, currentFile, _, _ := runtime.Caller(0)

	// переходим из internal/server/ → в static/dashboard/
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
		"/assets/",
		"/static/dashboard/assets/",
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
