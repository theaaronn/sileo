package main

import (
	"log"
	"net/http"
	"os"

	"github.com/a-h/templ"
	"github.com/hiaaryan/sileo/go"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "42069"
	}

	sileo.Info(sileo.Options{
		ID:          "server-demo",
		Title:       "Server-rendered",
		Description: sileo.Description("This toast was queued on the Go server before the page rendered."),
		Position:    sileo.PositionTopRight,
	})

	mux := http.NewServeMux()
	mux.Handle("/", templ.Handler(Page()))
	mux.Handle("/sileo/", sileo.AssetHandler())

	log.Printf("listening on http://localhost:%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
