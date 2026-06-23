(function () {
  "use strict";

  const HEIGHT = 40;
  const WIDTH = 350;
  const DEFAULT_ROUNDNESS = 16;
  const BLUR_RATIO = 0.5;
  const MIN_EXPAND_RATIO = 2.25;
  const DURATION_MS = 600;
  const DEFAULT_TOAST_DURATION = 6000;
  const EXIT_DURATION = DEFAULT_TOAST_DURATION * 0.1;
  const AUTO_EXPAND_DELAY = 150;
  const AUTO_COLLAPSE_DELAY = 4000;
  const SWAP_COLLAPSE_MS = 200;
  const HEADER_EXIT_MS = DURATION_MS * 0.7;
  const SWIPE_DISMISS = 30;
  const SWIPE_MAX = 20;

  const DEFAULT_POSITION = "top-right";

  const ICONS = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
    loading: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-sileo-icon="spin" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
    info: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/></svg>`,
    action: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
  };

  let idCounter = 0;
  function generateId() {
    return `${++idCounter}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function pillAlign(pos) {
    if (pos.includes("right")) return "right";
    if (pos.includes("center")) return "center";
    return "left";
  }

  function resolveClientAutopilot(opts) {
    const dur = opts.duration ?? DEFAULT_TOAST_DURATION;
    if (dur <= 0 || opts.autopilot === false) {
      return { expand: null, collapse: null };
    }
    return {
      expand: opts.autoExpandDelay ?? AUTO_EXPAND_DELAY,
      collapse: opts.autoCollapseDelay ?? AUTO_COLLAPSE_DELAY,
    };
  }

  function expandDir(pos) {
    return pos.startsWith("top") ? "bottom" : "top";
  }

  function ensureViewport(pos) {
    let vp = document.querySelector(`[data-sileo-viewport][data-position="${pos}"]`);
    if (!vp) {
      vp = document.createElement("section");
      vp.setAttribute("data-sileo-viewport", "");
      vp.setAttribute("data-position", pos);
      vp.setAttribute("aria-live", "polite");
      document.body.appendChild(vp);
    }
    return vp;
  }

  function parseDuration(el) {
    const v = el.getAttribute("data-duration");
    const n = v ? parseInt(v, 10) : DEFAULT_TOAST_DURATION;
    return Number.isNaN(n) ? DEFAULT_TOAST_DURATION : n;
  }

  function parseDelay(el, attr) {
    const v = el.getAttribute(attr);
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  }

  // Small spring simulation for geometry attributes.
  function Spring(target = 0) {
    this.x = target;
    this.v = 0;
    this.target = target;
    this.tension = 300;
    this.friction = 25;
    this.precision = 0.1;
  }
  Spring.prototype.setTarget = function (t) {
    this.target = t;
  };
  Spring.prototype.step = function (dt) {
    const a = (this.target - this.x) * this.tension;
    this.v += a * dt;
    this.v *= Math.max(0, 1 - this.friction * dt);
    this.x += this.v * dt;
    return Math.abs(this.target - this.x) < this.precision && Math.abs(this.v) < this.precision;
  };

  class ToastController {
    constructor(el) {
      this.el = el;
      this.id = el.getAttribute("data-id");
      this.instanceId = el.getAttribute("data-instance-id");
      this.position = el.closest("[data-sileo-viewport]")?.getAttribute("data-position") || DEFAULT_POSITION;
      this.pill = pillAlign(this.position);
      this.expand = expandDir(this.position);
      this.state = el.getAttribute("data-state") || "success";
      this.hasDesc = el.getAttribute("data-has-desc") === "true";
      this.duration = parseDuration(el);
      this.roundness = Math.max(0, parseInt(el.getAttribute("data-roundness") || `${DEFAULT_ROUNDNESS}`, 10));
      this.blur = this.roundness * BLUR_RATIO;
      this.fill = el.getAttribute("data-fill") || "#FFFFFF";
      this.autoExpandDelay = parseDelay(el, "data-auto-expand-delay");
      this.autoCollapseDelay = parseDelay(el, "data-auto-collapse-delay");

      this.headerEl = el.querySelector("[data-sileo-header]");
      this.innerEl = el.querySelector('[data-sileo-header-inner][data-layer="current"]');
      this.contentEl = el.querySelector("[data-sileo-content]");
      this.descriptionEl = el.querySelector("[data-sileo-description]");
      this.pillRect = el.querySelector("[data-sileo-pill]");
      this.bodyRect = el.querySelector("[data-sileo-body]");
      this.svg = el.querySelector("[data-sileo-svg]");
      this.headerPad = null;

      this.isExpanded = false;
      this.open = false;
      this.exiting = false;
      this.ready = false;
      this.pillWidth = HEIGHT;
      this.contentHeight = 0;
      this.frozenExpanded = HEIGHT * MIN_EXPAND_RATIO;
      this.expandTimer = null;
      this.collapseTimer = null;
      this.dismissTimer = null;
      this.headerExitTimer = null;
      this.swapTimer = null;
      this.pending = null;
      this.canExpand = true;

      this.pillX = new Spring(0);
      this.pillW = new Spring(HEIGHT);
      this.pillH = new Spring(HEIGHT);
      this.bodyH = new Spring(0);
      this.animating = false;

      this.swipeStart = null;
      this.swipeMove = this.onSwipeMove.bind(this);
      this.swipeUp = this.onSwipeUp.bind(this);

      this._measureHeaderPad();
      this._bindEvents();
      this._measure();
      this._layout();

      requestAnimationFrame(() => {
        this.ready = true;
        el.setAttribute("data-ready", "true");
        this._startTimers();
      });

      this._ro = new ResizeObserver(() => this._measure());
      if (this.innerEl) this._ro.observe(this.innerEl);
      if (this.descriptionEl) this._ro.observe(this.descriptionEl);
    }

    _measureHeaderPad() {
      if (!this.headerEl || this.headerPad !== null) return;
      const cs = getComputedStyle(this.headerEl);
      this.headerPad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    }

    _measure() {
      this._measurePillWidth();
      this._measureContentHeight();
      this._layout();
    }

    _measurePillWidth() {
      if (!this.innerEl) return;
      const pad = this.headerPad || 0;
      const w = this.innerEl.scrollWidth + pad + 10; // PILL_PADDING
      if (w > 10) this.pillWidth = Math.max(w, HEIGHT);
    }

    _measureContentHeight() {
      if (!this.descriptionEl) {
        this.contentHeight = 0;
        return;
      }
      this.contentHeight = this.descriptionEl.scrollHeight;
    }

    _expandedHeight() {
      if (!this.hasDesc) return HEIGHT * MIN_EXPAND_RATIO;
      return Math.max(HEIGHT * MIN_EXPAND_RATIO, HEIGHT + this.contentHeight);
    }

    _setTargets() {
      const px = this._pillX();
      this.pillX.setTarget(px);
      this.pillW.setTarget(Math.max(this.pillWidth, HEIGHT));
      this.pillH.setTarget(this.open ? HEIGHT + this.blur * 3 : HEIGHT);
      this.bodyH.setTarget(this.open ? Math.max(0, this.frozenExpanded - HEIGHT) : 0);

      this.el.style.setProperty("--_px", `${px}px`);
      this.el.style.setProperty("--_pw", `${Math.max(this.pillWidth, HEIGHT)}px`);
      this.el.style.setProperty("--_ht", this.open
        ? `translateY(${this.expand === "bottom" ? 3 : -3}px) scale(0.9)`
        : "translateY(0px) scale(1)");
      this.el.style.setProperty("--_co", this.open ? "1" : "0");
    }

    _pillX() {
      const pw = Math.max(this.pillWidth, HEIGHT);
      if (this.pill === "right") return WIDTH - pw;
      if (this.pill === "center") return (WIDTH - pw) / 2;
      return 0;
    }

    _layout() {
      if (this.open) {
        this.frozenExpanded = this._expandedHeight();
      }
      const expanded = this.open ? this._expandedHeight() : this.frozenExpanded;
      const svgHeight = this.hasDesc ? Math.max(expanded, HEIGHT * MIN_EXPAND_RATIO) : HEIGHT;
      this.el.style.setProperty("--_h", `${this.open ? expanded : HEIGHT}px`);
      if (this.svg) {
        this.svg.setAttribute("height", `${svgHeight}`);
        this.svg.setAttribute("viewBox", `0 0 ${WIDTH} ${svgHeight}`);
      }
      this._setTargets();
      if (!this.animating) {
        this.animating = true;
        this._tick();
      }
    }

    _tick() {
      const dt = 1 / 60;
      const a = this.pillX.step(dt);
      const b = this.pillW.step(dt);
      const c = this.pillH.step(dt);
      const d = this.bodyH.step(dt);

      if (this.pillRect) {
        this.pillRect.setAttribute("x", `${Math.round(this.pillX.x)}`);
        this.pillRect.setAttribute("width", `${Math.round(this.pillW.x)}`);
        this.pillRect.setAttribute("height", `${Math.round(this.pillH.x)}`);
      }
      if (this.bodyRect) {
        this.bodyRect.setAttribute("height", `${Math.round(this.bodyH.x)}`);
      }

      if (a && b && c && d) {
        this.animating = false;
        return;
      }
      requestAnimationFrame(() => this._tick());
    }

    _bindEvents() {
      this.el.addEventListener("mouseenter", () => {
        if (this.hasDesc) this.setExpanded(true);
        this._pauseTimers();
      });
      this.el.addEventListener("mouseleave", () => {
        this.setExpanded(false);
        this._resumeDismiss();
      });
      this.el.addEventListener("pointerdown", (e) => this._onPointerDown(e));
      this.el.addEventListener("transitionend", (e) => this._onTransitionEnd(e));

      const btn = this.el.querySelector("[data-sileo-button]");
      if (btn) {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const action = btn.getAttribute("data-action");
          if (action) {
            try {
              const fn = new Function(action);
              fn.call(btn);
            } catch (err) {
              console.error("Sileo button action failed", err);
            }
          }
        });
      }
    }

    _startTimers() {
      if (this.duration > 0) {
        this.dismissTimer = window.setTimeout(() => this.dismiss(), this.duration);
      }
      if (!this.hasDesc || this.autoExpandDelay === null) return;
      const expandDelay = this.autoExpandDelay ?? 0;
      if (expandDelay > 0) {
        this.expandTimer = window.setTimeout(() => this.setExpanded(true), expandDelay);
      } else {
        this.setExpanded(true);
      }
      const collapseDelay = this.autoCollapseDelay ?? 0;
      if (collapseDelay > 0) {
        this.collapseTimer = window.setTimeout(() => this.setExpanded(false), collapseDelay);
      }
    }

    _pauseTimers() {
      if (this.expandTimer) {
        clearTimeout(this.expandTimer);
        this.expandTimer = null;
      }
      if (this.collapseTimer) {
        clearTimeout(this.collapseTimer);
        this.collapseTimer = null;
      }
      if (this.dismissTimer) {
        clearTimeout(this.dismissTimer);
        this.dismissTimer = null;
      }
    }

    _resumeDismiss() {
      if (this.exiting || this.duration === null || this.duration <= 0) return;
      this.dismissTimer = window.setTimeout(() => this.dismiss(), this.duration);
    }

    _clearTimers() {
      if (this.expandTimer) clearTimeout(this.expandTimer);
      if (this.collapseTimer) clearTimeout(this.collapseTimer);
      if (this.dismissTimer) clearTimeout(this.dismissTimer);
      this.expandTimer = this.collapseTimer = this.dismissTimer = null;
    }

    setExpanded(v) {
      if (this.isExpanded === v) return;
      this.isExpanded = v;
      this._updateOpen();
    }

    setCanExpand(v) {
      if (this.canExpand === v) return;
      this.canExpand = v;
      this._updateOpen();
    }

    _updateOpen() {
      const next = this.hasDesc && this.isExpanded && !this.exiting && this.canExpand && this.state !== "loading";
      if (this.open === next) return;
      this.open = next;
      this.el.setAttribute("data-expanded", `${this.open}`);
      if (this.contentEl) this.contentEl.setAttribute("data-visible", `${this.open}`);
      this._layout();
    }

    _onPointerDown(e) {
      if (this.exiting || !this.el.hasAttribute("data-id")) return;
      const target = e.target;
      if (target.closest("[data-sileo-button]")) return;
      this.swipeStart = e.clientY;
      this.el.setPointerCapture(e.pointerId);
      this.el.addEventListener("pointermove", this.swipeMove, { passive: true });
      this.el.addEventListener("pointerup", this.swipeUp, { passive: true });
    }

    onSwipeMove(e) {
      if (this.swipeStart === null) return;
      const dy = e.clientY - this.swipeStart;
      const sign = dy > 0 ? 1 : -1;
      const clamped = Math.min(Math.abs(dy), SWIPE_MAX) * sign;
      this.el.style.transform = `translateY(${clamped}px)`;
    }

    onSwipeUp(e) {
      if (this.swipeStart === null) return;
      const dy = e.clientY - this.swipeStart;
      this.swipeStart = null;
      this.el.style.transform = "";
      this.el.removeEventListener("pointermove", this.swipeMove);
      this.el.removeEventListener("pointerup", this.swipeUp);
      if (Math.abs(dy) > SWIPE_DISMISS) this.dismiss();
    }

    _onTransitionEnd(e) {
      if (e.propertyName !== "height" && e.propertyName !== "transform") return;
      if (this.open) return;
      if (this.pending) {
        this._applyPending();
      }
    }

    refresh(opts) {
      if (this.open) {
        this.pending = opts;
        this.setExpanded(false);
        this.swapTimer = window.setTimeout(() => this._applyPending(), SWAP_COLLAPSE_MS);
      } else {
        this._apply(opts);
      }
    }

    _applyPending() {
      if (!this.pending) return;
      this._apply(this.pending);
      this.pending = null;
    }

    _apply(opts) {
      this.state = opts.type || this.state;
      this.fill = opts.fill || this.fill;
      this.duration = opts.duration ?? DEFAULT_TOAST_DURATION;
      this.hasDesc = Boolean(opts.description || opts.button);
      this.autoExpandDelay = opts.autoExpandDelay ?? null;
      this.autoCollapseDelay = opts.autoCollapseDelay ?? null;
      this.instanceId = opts.instanceId || generateId();
      this.el.setAttribute("data-instance-id", this.instanceId);
      this.el.setAttribute("data-state", this.state);
      this.el.setAttribute("data-duration", `${this.duration}`);
      this.el.setAttribute("data-has-desc", `${this.hasDesc}`);
      this.el.setAttribute("data-fill", this.fill);
      this.el.setAttribute("data-auto-expand-delay", `${this.autoExpandDelay ?? ""}`);
      this.el.setAttribute("data-auto-collapse-delay", `${this.autoCollapseDelay ?? ""}`);

      // Header swap animation
      const prevInner = this.innerEl;
      if (prevInner) {
        prevInner.setAttribute("data-layer", "prev");
        prevInner.setAttribute("data-exiting", "true");
        if (this.headerExitTimer) clearTimeout(this.headerExitTimer);
        this.headerExitTimer = window.setTimeout(() => {
          prevInner.remove();
        }, HEADER_EXIT_MS);
      }
      const nextInner = document.createElement("div");
      nextInner.setAttribute("data-sileo-header-inner", "");
      nextInner.setAttribute("data-layer", "current");
      nextInner.innerHTML = `
        <div data-sileo-badge data-state="${this.state}">${opts.icon || ICONS[this.state]}</div>
        <span data-sileo-title data-state="${this.state}">${escapeHtml(opts.title || this.state)}</span>
      `;
      this.innerEl = nextInner;
      const stack = this.headerEl.querySelector("[data-sileo-header-stack]");
      if (stack) stack.appendChild(nextInner);
      this._measureHeaderPad();
      this._measure();

      // Update content
      if (this.contentEl) {
        this.contentEl.setAttribute("data-visible", "false");
        if (!this.hasDesc) {
          this.contentEl.remove();
          this.contentEl = null;
          this.descriptionEl = null;
        } else {
          this.descriptionEl.innerHTML = (opts.description || "") + (opts.button
            ? `<a href="#" data-sileo-button="" data-state="${this.state}" data-action="${escapeHtml(opts.button.action || "")}">${escapeHtml(opts.button.label)}</a>`
            : "");
        }
      } else if (this.hasDesc) {
        const content = document.createElement("div");
        content.setAttribute("data-sileo-content", "");
        content.setAttribute("data-edge", this.expand);
        content.setAttribute("data-visible", "false");
        content.innerHTML = `<div data-sileo-description>${(opts.description || "") + (opts.button
          ? `<a href="#" data-sileo-button="" data-state="${this.state}" data-action="${escapeHtml(opts.button.action || "")}">${escapeHtml(opts.button.label)}</a>`
          : "")}</div>`;
        this.el.appendChild(content);
        this.contentEl = content;
        this.descriptionEl = content.firstElementChild;
        this._bindButtonClick();
      }

      this._clearTimers();
      this._startTimers();
    }

    _bindButtonClick() {
      const btn = this.el.querySelector("[data-sileo-button]");
      if (btn) {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const action = btn.getAttribute("data-action");
          if (action) {
            try {
              const fn = new Function(action);
              fn.call(btn);
            } catch (err) {
              console.error("Sileo button action failed", err);
            }
          }
        });
      }
    }

    dismiss() {
      if (this.exiting) return;
      this.exiting = true;
      this._clearTimers();
      this.setExpanded(false);
      this.el.setAttribute("data-exiting", "true");
      window.setTimeout(() => {
        this.destroy();
      }, EXIT_DURATION);
    }

    destroy() {
      this._clearTimers();
      if (this._ro) this._ro.disconnect();
      this.el.remove();
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const controllers = new Map();

  function mount(el) {
    const c = new ToastController(el);
    controllers.set(c.id, c);
    return c;
  }

  function create(opts) {
    const position = opts.position || DEFAULT_POSITION;
    const id = opts.id || "sileo-default";
    const existing = controllers.get(id);
    if (existing) {
      const instanceId = generateId();
      existing.refresh({ ...opts, instanceId });
      return id;
    }

    const pill = pillAlign(position);
    const expand = expandDir(position);
    const state = opts.type || "success";
    const roundness = Math.max(0, opts.roundness ?? DEFAULT_ROUNDNESS);
    const blur = roundness * BLUR_RATIO;
    const fill = opts.fill || "#FFFFFF";
    const hasDesc = Boolean(opts.description || opts.button);
    const duration = opts.duration ?? DEFAULT_TOAST_DURATION;
    const auto = resolveClientAutopilot({ ...opts, duration });
    const filterId = `sileo-gooey-${id}`;
    const instanceId = generateId();

    const el = document.createElement("button");
    el.type = "button";
    el.setAttribute("data-sileo-toast", "");
    el.setAttribute("data-id", id);
    el.setAttribute("data-instance-id", instanceId);
    el.setAttribute("data-ready", "false");
    el.setAttribute("data-expanded", "false");
    el.setAttribute("data-exiting", "false");
    el.setAttribute("data-edge", expand);
    el.setAttribute("data-position", pill);
    el.setAttribute("data-state", state);
    el.setAttribute("data-has-desc", `${hasDesc}`);
    el.setAttribute("data-duration", `${duration}`);
    el.setAttribute("data-auto-expand-delay", `${auto.expand ?? ""}`);
    el.setAttribute("data-auto-collapse-delay", `${auto.collapse ?? ""}`);
    el.setAttribute("data-roundness", `${roundness}`);
    el.setAttribute("data-fill", fill);
    el.style.cssText = `--_h:${HEIGHT}px;--_pw:${HEIGHT}px;--_px:0px;--_ht:translateY(0px) scale(1);--_co:0;`;

    el.innerHTML = `
      <div data-sileo-canvas data-edge="${expand}" style="filter:url(#${filterId})">
        <svg data-sileo-svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
          <title>Sileo Notification</title>
          <defs>
            <filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
              <feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="blur"/>
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10" result="goo"/>
              <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
            </filter>
          </defs>
          <rect data-sileo-pill rx="${roundness}" ry="${roundness}" x="0" width="${HEIGHT}" height="${HEIGHT}" fill="${fill}"/>
          <rect data-sileo-body y="${HEIGHT}" width="${WIDTH}" rx="${roundness}" ry="${roundness}" height="0" fill="${fill}"/>
        </svg>
      </div>
      <div data-sileo-header data-edge="${expand}">
        <div data-sileo-header-stack>
          <div data-sileo-header-inner data-layer="current">
            <div data-sileo-badge data-state="${state}">${opts.icon || ICONS[state]}</div>
            <span data-sileo-title data-state="${state}">${escapeHtml(opts.title || state)}</span>
          </div>
        </div>
      </div>
      ${hasDesc ? `
      <div data-sileo-content data-edge="${expand}" data-visible="false">
        <div data-sileo-description>
          ${opts.description || ""}
          ${opts.button ? `<a href="#" data-sileo-button="" data-state="${state}" data-action="${escapeHtml(opts.button.action || "")}">${escapeHtml(opts.button.label)}</a>` : ""}
        </div>
      </div>` : ""}
    `;

    ensureViewport(position).appendChild(el);
    return mount(el).id;
  }

  function init() {
    document.querySelectorAll("[data-sileo-toast]").forEach((el) => {
      if (!controllers.has(el.getAttribute("data-id"))) mount(el);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.sileo = {
    show: (opts) => create({ type: opts.type || "success", ...opts }),
    success: (opts) => create({ type: "success", ...opts }),
    error: (opts) => create({ type: "error", ...opts }),
    warning: (opts) => create({ type: "warning", ...opts }),
    info: (opts) => create({ type: "info", ...opts }),
    action: (opts) => create({ type: "action", ...opts }),
    dismiss: (id) => {
      const c = controllers.get(id);
      if (c) c.dismiss();
    },
    clear: (position) => {
      controllers.forEach((c) => {
        if (!position || c.position === position) c.dismiss();
      });
    },
  };
})();
