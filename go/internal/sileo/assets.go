package sileo

import (
	"context"
	_ "embed"
	"io"
	"net/http"

	"github.com/a-h/templ"
)

//go:embed static/styles.css
var stylesCSS string

//go:embed static/sileo.js
var sileoJS string

// StylesTag returns a <style> tag with the embedded CSS.
func StylesTag() templ.Component {
	return templ.ComponentFunc(func(ctx context.Context, w io.Writer) error {
		_, err := io.WriteString(w, "<style type=\"text/css\">\n")
		if err != nil {
			return err
		}
		_, err = io.WriteString(w, stylesCSS)
		if err != nil {
			return err
		}
		_, err = io.WriteString(w, "\n</style>")
		return err
	})
}

// ScriptTag returns a <script> tag with the embedded runtime.
func ScriptTag() templ.Component {
	return templ.ComponentFunc(func(ctx context.Context, w io.Writer) error {
		_, err := io.WriteString(w, "<script type=\"text/javascript\">\n")
		if err != nil {
			return err
		}
		_, err = io.WriteString(w, sileoJS)
		if err != nil {
			return err
		}
		_, err = io.WriteString(w, "\n</script>")
		return err
	})
}

// AssetHandler serves /sileo/styles.css and /sileo/sileo.js.
func AssetHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/sileo/styles.css", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/css")
		w.Write([]byte(stylesCSS))
	})
	mux.HandleFunc("/sileo/sileo.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript")
		w.Write([]byte(sileoJS))
	})
	return mux
}
