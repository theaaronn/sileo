# Sileo React → Go/templ Port Analysis

## React Source (`src/`)
- `sileo.tsx` – Main `Sileo` component. Physics SVG animations via `motion` (Framer Motion), gooey filter, pill expansion, header morphing, swipe-to-dismiss, auto-expand/collapse, refresh/swap animations, `interruptKey` logic.
- `toast.tsx` – `Toaster` viewport manager, `sileo` API object (`show`, `success`, `error`, `warning`, `info`, `action`, `promise`, `dismiss`, `clear`), store with listeners, autopilot, theme detection (`useResolvedTheme`).
- `icons.tsx` – React SVG icon components.
- `types.ts` – TS types (`SileoState`, `SileoStyles`, `SileoButton`, `SileoPosition`, `SileoOptions`).
- `constants.ts` – Layout, timing, spring config.
- `styles.css` – Full CSS via data-attribute selectors.
- `index.ts` – Re-exports.

## Go/templ Port (`go/`)
- `sileo.go` – Top-level package, re-exports types/consts/funcs.
- `internal/sileo/types.go` – Go types mirroring TS.
- `internal/sileo/constants.go` – Same constants.
- `internal/sileo/store.go` – Thread-safe server store, `Show`/`Success`/`Error`/`Dismiss`/`Clear`/`Snapshot`. `SetPosition`/`SetOptions` added.
- `internal/sileo/assets.go` – Embedded CSS + JS via `//go:embed`.
- `internal/sileo/icons.templ` – SVG icons as templ components.
- `internal/sileo/sileo.templ` – Server-rendered toast HTML, data attributes for JS hydration.
- `internal/sileo/toaster.templ` – Viewport container.
- `internal/sileo/viewport.templ` – Individual viewport section.
- `internal/sileo/static/sileo.js` – Custom 638-line JS runtime (`ToastController` class, `Spring` physics, swipe, timers, refresh, header morphing).
- `internal/sileo/static/styles.css` – Nearly identical CSS (+ `box-sizing: border-box` on header).
- `cmd/example/` – Demo server.

---

## What WAS Ported

| Feature | Status |
|---|---|
| Type system (State, Position, Styles, Button, Options) | Complete – Go structs/consts |
| Layout/timing constants | Complete |
| SVG icons (6 states) | Complete – templ + JS string fallbacks |
| Toast HTML structure (pill, body, header, badge, title, content, desc, button) | Complete – server-rendered |
| Viewport positioning (6 positions, offset) | Complete |
| Toaster container | Complete |
| Store (create/update/dismiss/clear) | Complete – Go mutex-guarded |
| API: `show`, `success`, `error`, `warning`, `info`, `action`, `dismiss`, `clear` | Complete – Go funcs + `window.sileo` JS |
| Autopilot (auto-expand/collapse delays) | Complete – server calc + JS timers |
| Swipe-to-dismiss | Complete – JS `pointerdown`/`pointermove`/`pointerup` |
| Spring animations | Complete – custom `Spring` class (Verlet integration) |
| Toast refresh/swap with collapse pending | Complete – `refresh()` + `_applyPending()` |
| Header morphing (enter/exit layers) | Complete – JS DOM manipulation |
| CSS (spring easing, state colors, animations, viewports, themes, reduced-motion) | Complete – embedded `<style>` |
| Asset serving | **Added** – `AssetHandler()` HTTP mux (not in React) |

## What Was NOT Ported / Is Different

### 1. `motion` library → custom JS `Spring` class
React uses Framer Motion's `<motion.rect>` with spring config (`bounce: 0.25`, `duration: 0.6s`). Go port reimplements with a manual `Spring` class (`sileo.js:82-99`) using:
```
a = (target - x) * tension (300)
v += a * dt
v *= max(0, 1 - friction(25) * dt)
x += v * dt
```
Spring feel **will differ** from React's `motion`. No bounce parameter; different physics model.

### 2. All React hooks eliminated
`useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`, `useLayoutEffect` – all handled by:
- Server-rendered static HTML with `data-*` attributes
- `ToastController` class in JS for runtime state

### 3. `sileo.promise()` – NOT ported
React `sileo.promise()` handles async toast lifecycle (`loading` → `success`/`error`/`action`). Go/JS API has no equivalent. Users must chain manually.

### 4. `interruptKey` – NOT ported
React `Sileo` component has `interruptKey` prop controlling which toast can interrupt current expanded state. Go port omits this.

### 5. `Button` action: string vs function reference
React: `button.onClick` is a real JS function reference.
Go: `Button.Action` is a string, evaluated via `new Function(action)` in JS (`sileo.js:283`). **Security consideration** – XSS if action string comes from user input.

### 6. Theme resolution: system = "light" on server
React resolves `prefers-color-scheme` client-side via `matchMedia`.
Go port resolves `ThemeSystem` to `"light"` on server (line 71 of `sileo.go`). Theme only applies via `data-theme` attribute; full dark mode requires JS `window.sileo` calls.

### 7. `Description()` wraps string as `templ.Component`
React accepts `ReactNode` (arbitrary JSX). Go `Description(s string)` returns `templ.Raw(s)`. Can't pass rich components, only plain strings.

### 8. Type system differences
- Go uses pointers (`*int`, `*Autopilot`) for optional fields; React uses `| undefined`
- `Offset` is struct with `*string` per-edge; React handles `number | string` and unified/per-edge objects
- `Position` ordering is canonical (`Positions` slice); React just has const array
- No `ReactNode` equivalent – descriptions are `templ.Component`

### 9. CSS: one minor addition
`go/internal/sileo/static/styles.css:149` adds `box-sizing: border-box` on `[data-sileo-header]` not present in React `src/styles.css`. Otherwise identical.

### 10. Go port adds `SetPosition()` / `SetOptions()`
Functions to mutate default position/options globally. React sets these via `<Toaster position={} options={} />` props.

### 11. No `canExpand` per-toast control
React `Sileo` has `canExpand` prop. Go port renders `data-can-expand` omitted; JS `ToastController` manages expand state purely based on `activeId` / mouseenter.

---

## Summary

**Ported**: All structural, type, API, and visual elements. Server-rendered HTML + embedded CSS/JS achieves same UI.

**Not ported**: `sileo.promise()`, `interruptKey`, rich `ReactNode` descriptions.

**Different**: `motion` spring physics → custom `Spring` class (different feel), `Button.onClick` function → string eval, theme system resolution, hook-based state management → imperative `ToastController`, real React components → server HTML + JS hydration pattern.

**Hard blockers for porting**: None – all core functionality has an equivalent. The biggest gap is `sileo.promise()` lifecycle and the spring physics fidelity.

---

## Should motion be ported to templ?

**No.** Architecturally incompatible.

| Factor | `motion` | templ |
|---|---|---|
| Runtime | Client, hooks, VDOM, reconciliation | Server, static markup generation |
| Components | Persistent, stateful, re-renderable | Render-once, no lifecycle |
| Layout animation | Tracks DOM identity across renders | No re-render concept |
| `AnimatePresence` | Exit animations via VDOM unmount | N/A |

"Porting motion to templ" = rewriting a framework-agnostic animation engine, not porting the library.

**Recommended approach** (current port already does this correctly):
- templ owns initial HTML + data-* attributes
- JS owns all runtime animation, physics, and DOM mutation after hydration

**Improvement targets for the current port** (not full port):
- Replace naive custom `Spring` class with **Motion One** (`@motionone/dom`) – framework-agnostic, same spring model as Framer Motion
- Or use **GSAP** / **Web Animations API** for production physics
- No need to involve React or templ in animation at all
