package sileo

// Layout
const (
	Height           = 40
	Width            = 350
	DefaultRoundness = 16
)

// Timing (ms)
const (
	DurationMS           = 600
	DefaultToastDuration = 6000
	ExitDuration         = DefaultToastDuration / 10
	AutoExpandDelay      = int(float64(DefaultToastDuration) * 0.025)
	AutoCollapseDelay    = DefaultToastDuration - 2000
	SwapCollapseMs       = 200
	HeaderExitMs         = int(float64(DurationMS) * 0.7)
)

// Render
const (
	BlurRatio      = 0.5
	PillPadding    = 10
	MinExpandRatio = 2.25
)

// Theme fills.
var ThemeFills = map[string]string{
	"light": "#1a1a1a",
	"dark":  "#f2f2f2",
}

// ThemeFill returns the pill fill for a resolved theme, or empty if unknown.
func ThemeFill(theme string) string {
	if theme == "" {
		return ""
	}
	if v, ok := ThemeFills[theme]; ok {
		return v
	}
	return ""
}
