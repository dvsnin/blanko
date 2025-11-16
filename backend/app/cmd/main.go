package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/dvsnin/blanko/backend/app/internal/server"
)

func main() {
	s := server.New()

	fmt.Println("Server running at http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", s.Router()))
}
