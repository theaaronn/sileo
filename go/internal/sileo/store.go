package sileo

import (
	"math/rand"
	"strconv"
	"sync"
	"time"
)

// Item is an internal toast instance.
type Item struct {
	Options
	InstanceID          string
	Exiting             bool
	AutoExpandDelayMs   *int
	AutoCollapseDelayMs *int
}

var (
	storeMutex sync.RWMutex
	store      []Item
	storePos   = PositionTopRight
	storeOpts  Options
	idCounter  int64
)

func generateID() string {
	idCounter++
	return strconv.FormatInt(idCounter, 10) + "-" + strconv.FormatInt(time.Now().UnixMilli(), 36) + "-" + strconv.Itoa(rand.Intn(1_000_000))
}

func resolveAutopilot(opts Options, duration *int) (expand *int, collapse *int) {
	if duration == nil || *duration <= 0 {
		return nil, nil
	}
	clamp := func(v int) int {
		if v < 0 {
			return 0
		}
		if v > *duration {
			return *duration
		}
		return v
	}
	e := AutoExpandDelay
	c := AutoCollapseDelay
	if opts.Autopilot != nil {
		if opts.Autopilot.Expand != nil {
			e = clamp(*opts.Autopilot.Expand)
		}
		if opts.Autopilot.Collapse != nil {
			c = clamp(*opts.Autopilot.Collapse)
		}
	}
	return &e, &c
}

func mergeOptions(opts Options) Options {
	merged := storeOpts
	if opts.ID != "" {
		merged.ID = opts.ID
	}
	if opts.Title != "" {
		merged.Title = opts.Title
	}
	if opts.Description != nil {
		merged.Description = opts.Description
	}
	if opts.Type != "" {
		merged.Type = opts.Type
	}
	if opts.Position != "" {
		merged.Position = opts.Position
	}
	if opts.Duration != nil {
		merged.Duration = opts.Duration
	}
	if opts.Icon != nil {
		merged.Icon = opts.Icon
	}
	merged.Styles = Styles{
		Title:       coalesce(opts.Styles.Title, storeOpts.Styles.Title),
		Description: coalesce(opts.Styles.Description, storeOpts.Styles.Description),
		Badge:       coalesce(opts.Styles.Badge, storeOpts.Styles.Badge),
		Button:      coalesce(opts.Styles.Button, storeOpts.Styles.Button),
	}
	if opts.Fill != "" {
		merged.Fill = opts.Fill
	}
	if opts.Roundness != nil {
		merged.Roundness = opts.Roundness
	}
	if opts.Autopilot != nil {
		merged.Autopilot = opts.Autopilot
	}
	if opts.Button != nil {
		merged.Button = opts.Button
	}
	if merged.Position == "" {
		merged.Position = storePos
	}
	return merged
}

func coalesce(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

func buildItem(merged Options, id string, fallbackPos Position) Item {
	dur := merged.Duration
	if dur == nil {
		d := DefaultToastDuration
		dur = &d
	}
	expand, collapse := resolveAutopilot(merged, dur)
	pos := merged.Position
	if pos == "" {
		pos = fallbackPos
	}
	if pos == "" {
		pos = PositionTopRight
	}
	return Item{
		Options:             merged,
		InstanceID:          generateID(),
		Exiting:             false,
		AutoExpandDelayMs:   expand,
		AutoCollapseDelayMs: collapse,
	}
}

func createToast(opts Options) string {
	storeMutex.Lock()
	defer storeMutex.Unlock()

	merged := mergeOptions(opts)
	id := merged.ID
	if id == "" {
		id = "sileo-default"
	}

	var fallbackPos Position
	var prevIdx = -1
	for i, t := range store {
		if t.ID == id {
			prevIdx = i
			fallbackPos = t.Position
			break
		}
	}

	item := buildItem(merged, id, fallbackPos)
	item.ID = id

	if prevIdx >= 0 {
		store[prevIdx] = item
	} else {
		store = append(store, item)
	}
	return id
}

// Show creates or updates a toast with the supplied options.
func Show(opts Options) string {
	if opts.Type == "" {
		opts.Type = StateSuccess
	}
	return createToast(opts)
}

// Success is shorthand for Show with state success.
func Success(opts Options) string {
	opts.Type = StateSuccess
	return Show(opts)
}

// Error is shorthand for Show with state error.
func Error(opts Options) string {
	opts.Type = StateError
	return Show(opts)
}

// Warning is shorthand for Show with state warning.
func Warning(opts Options) string {
	opts.Type = StateWarning
	return Show(opts)
}

// Info is shorthand for Show with state info.
func Info(opts Options) string {
	opts.Type = StateInfo
	return Show(opts)
}

// Action is shorthand for Show with state action.
func Action(opts Options) string {
	opts.Type = StateAction
	return Show(opts)
}

// Dismiss marks a toast as exiting and removes it after the exit animation.
func Dismiss(id string) {
	storeMutex.Lock()
	var instanceID string
	var idx int = -1
	for i := range store {
		if store[i].ID == id && !store[i].Exiting {
			store[i].Exiting = true
			idx = i
			instanceID = store[i].InstanceID
			break
		}
	}
	storeMutex.Unlock()

	if idx < 0 {
		return
	}
	go func() {
		time.Sleep(ExitDuration * time.Millisecond)
		storeMutex.Lock()
		defer storeMutex.Unlock()
		if idx < len(store) && store[idx].ID == id && store[idx].InstanceID == instanceID {
			store = append(store[:idx], store[idx+1:]...)
		}
	}()
}

// Clear removes all toasts, optionally filtering by position.
func Clear(position Position) {
	storeMutex.Lock()
	defer storeMutex.Unlock()

	if position == "" {
		store = nil
		return
	}
	filtered := store[:0]
	for _, t := range store {
		if t.Position != position {
			filtered = append(filtered, t)
		}
	}
	store = filtered
}

// Snapshot returns a copy of the current store for rendering.
func Snapshot() []Item {
	storeMutex.RLock()
	defer storeMutex.RUnlock()

	out := make([]Item, len(store))
	copy(out, store)
	return out
}

// SetPosition sets the default position used when toasts are created.
func SetPosition(p Position) {
	storeMutex.Lock()
	defer storeMutex.Unlock()
	storePos = p
}

// SetOptions sets default options merged into every toast.
func SetOptions(opts Options) {
	storeMutex.Lock()
	defer storeMutex.Unlock()
	storeOpts = opts
}
