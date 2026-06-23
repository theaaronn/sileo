// Package sileo is a Go/templ port of the Sileo React toast library.
package sileo

import (
	"net/http"

	"github.com/a-h/templ"
	internal "github.com/hiaaryan/sileo/go/internal/sileo"
)

// Re-exported types.
type (
	State        = internal.State
	Position     = internal.Position
	Styles       = internal.Styles
	Button       = internal.Button
	Autopilot    = internal.Autopilot
	Options      = internal.Options
	Theme        = internal.Theme
	Offset       = internal.Offset
	ToasterProps = internal.ToasterProps
)

// State constants.
const (
	StateSuccess = internal.StateSuccess
	StateLoading = internal.StateLoading
	StateError   = internal.StateError
	StateWarning = internal.StateWarning
	StateInfo    = internal.StateInfo
	StateAction  = internal.StateAction
)

// Position constants.
const (
	PositionTopLeft      = internal.PositionTopLeft
	PositionTopCenter    = internal.PositionTopCenter
	PositionTopRight     = internal.PositionTopRight
	PositionBottomLeft   = internal.PositionBottomLeft
	PositionBottomCenter = internal.PositionBottomCenter
	PositionBottomRight  = internal.PositionBottomRight
)

// Theme constants.
const (
	ThemeLight  = internal.ThemeLight
	ThemeDark   = internal.ThemeDark
	ThemeSystem = internal.ThemeSystem
)

// Description converts a plain string into a templ component.
func Description(s string) templ.Component {
	return templ.Raw(s)
}

// Toaster renders the toast viewport(s) and any server-side toasts queued
// before render. Include sileo.JS() and sileo.CSS() in the page for
// client-side interactivity.
func Toaster(props internal.ToasterProps) templ.Component {
	if props.Position == "" {
		props.Position = internal.PositionTopRight
	}
	items := internal.Snapshot()
	resolved := ""
	switch props.Theme {
	case ThemeDark:
		resolved = "dark"
	case ThemeLight:
		resolved = "light"
	case ThemeSystem:
		resolved = "light"
	}
	if fill := internal.ThemeFill(resolved); fill != "" {
		for i := range items {
			if items[i].Fill == "" {
				items[i].Fill = fill
			}
		}
	}
	return internal.Toaster(props, items)
}

// CSS renders the embedded Sileo <style> tag.
func CSS() templ.Component {
	return internal.StylesTag()
}

// JS renders the embedded Sileo <script> runtime.
func JS() templ.Component {
	return internal.ScriptTag()
}

// AssetHandler serves the standalone CSS and JS assets under /sileo/.
func AssetHandler() http.Handler {
	return internal.AssetHandler()
}

// Show creates or updates a toast.
func Show(opts Options) string { return internal.Show(opts) }

// Success is shorthand for Show with state success.
func Success(opts Options) string { return internal.Success(opts) }

// Error is shorthand for Show with state error.
func Error(opts Options) string { return internal.Error(opts) }

// Warning is shorthand for Show with state warning.
func Warning(opts Options) string { return internal.Warning(opts) }

// Info is shorthand for Show with state info.
func Info(opts Options) string { return internal.Info(opts) }

// Action is shorthand for Show with state action.
func Action(opts Options) string { return internal.Action(opts) }

// Dismiss removes a toast by id.
func Dismiss(id string) { internal.Dismiss(id) }

// Clear removes all toasts, optionally filtered by position.
func Clear(position Position) { internal.Clear(position) }
