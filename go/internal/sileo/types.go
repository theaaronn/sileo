package sileo

import "github.com/a-h/templ"

// State mirrors TS SileoState.
type State string

const (
	StateSuccess State = "success"
	StateLoading State = "loading"
	StateError   State = "error"
	StateWarning State = "warning"
	StateInfo    State = "info"
	StateAction  State = "action"
)

// Position mirrors TS SileoPosition.
type Position string

const (
	PositionTopLeft      Position = "top-left"
	PositionTopCenter    Position = "top-center"
	PositionTopRight     Position = "top-right"
	PositionBottomLeft   Position = "bottom-left"
	PositionBottomCenter Position = "bottom-center"
	PositionBottomRight  Position = "bottom-right"
)

// Positions is the canonical ordering.
var Positions = []Position{
	PositionTopLeft,
	PositionTopCenter,
	PositionTopRight,
	PositionBottomLeft,
	PositionBottomCenter,
	PositionBottomRight,
}

// Styles mirrors TS SileoStyles.
type Styles struct {
	Title       string
	Description string
	Badge       string
	Button      string
}

// Button mirrors TS SileoButton. Action is client-side JS (function name or snippet)
// executed when the button is clicked.
type Button struct {
	Label  string
	Action string
}

// Autopilot mirrors TS autopilot object form.
type Autopilot struct {
	Expand   *int // ms
	Collapse *int // ms
}

// Options mirrors TS SileoOptions, adapted for Go/templ.
type Options struct {
	ID          string
	Title       string
	Description templ.Component
	Type        State
	Position    Position
	Duration    *int // ms; nil means default
	Icon        templ.Component
	Styles      Styles
	Fill        string
	Roundness   *int
	Autopilot   *Autopilot
	Button      *Button
}

// ToasterProps mirrors TS SileoToasterProps.
type ToasterProps struct {
	Position Position
	Offset   Offset
	Options  Options
	Theme    Theme
}

// Theme selection.
type Theme string

const (
	ThemeLight  Theme = "light"
	ThemeDark   Theme = "dark"
	ThemeSystem Theme = "system"
)

// Offset can be a single value or per-edge config.
type Offset struct {
	All    *string
	Top    *string
	Right  *string
	Bottom *string
	Left   *string
}

// Pill alignment derived from position.
func PillAlign(pos Position) string {
	switch {
	case pos == PositionTopRight || pos == PositionBottomRight:
		return "right"
	case pos == PositionTopCenter || pos == PositionBottomCenter:
		return "center"
	default:
		return "left"
	}
}

// ExpandDir returns the direction the toast body expands.
func ExpandDir(pos Position) string {
	if pos == PositionTopLeft || pos == PositionTopCenter || pos == PositionTopRight {
		return "bottom"
	}
	return "top"
}
