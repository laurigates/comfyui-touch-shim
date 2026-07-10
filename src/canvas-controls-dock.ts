// Canvas-controls dock — an EXPERIMENTAL behavioral shim (NOT a `CssShim`).
//
// Collects the floating / semi-floating on-canvas chrome (run/queue actionbar,
// subgraph breadcrumb, the bottom-right canvas menu cluster, the pysssss image
// feed) into a single `position: fixed` bottom bar that scrolls horizontally
// under touch.
//
// Unlike the CSS shims this REPARENTS live, Vue-managed DOM at runtime, so it is
// deliberately:
//   - fail-soft: a target whose selector matches nothing is simply skipped; no
//     throw, nothing styled.
//   - fully reversible: every relocated element leaves a placeholder comment at
//     its original home and is returned there when the feature is switched off.
//   - self-healing: a MutationObserver re-docks controls that Vue mounts (or
//     remounts) after the bar is created.
//
// It carries no `upstream` issue URL — this is a QOL experiment pending
// real-world testing before deciding whether it becomes an upstream proposal,
// so it stays out of the `SHIMS` registry and its upstream-required contract.

const EXT_NAME = "comfyui-touch-shim";
const DOCK_ID = "CanvasControlsDock";
export const dockBarId = `${EXT_NAME}-${DOCK_ID}-bar`;
export const dockStyleId = `${EXT_NAME}-${DOCK_ID}-style`;
export const DOCKED_ATTR = "data-touch-shim-docked";
const PLACEHOLDER_TEXT = `${EXT_NAME}:${DOCK_ID}-home`;

interface DockTarget {
  /** Stable key, for readability/debugging only. */
  id: string;
  /** CSS selector matching an element inside (or at) the control. */
  selector: string;
  /** Optional ancestor selector; the match climbs to it before being docked. */
  climb?: string;
}

// Ordered left-to-right in the bar. Prefer stable `data-testid` hooks; the
// pysssss target is external and unverified (fails soft when absent), matching
// this pack's "compiled selectors rot, degrade to nothing" discipline.
//
// Targets must be SMALL, HORIZONTAL clusters. `[data-testid="side-toolbar"]`
// is deliberately NOT here: it is the entire left vertical nav (Comfy menu,
// every sidebar tab, settings — SideToolbar.vue, verified against frontend
// 1.45.20), and docking that full-height `flex-col` column into the horizontal
// bar drags the nav to the right of the actionbar and stretches the bar to the
// column's stacked height, wrecking the layout.
export const DOCK_TARGETS: DockTarget[] = [
  { id: "breadcrumb", selector: '[data-testid="subgraph-breadcrumb"]' },
  {
    id: "actionbar",
    selector: '[data-testid="queue-overlay-toggle"]',
    climb: ".actionbar",
  },
  {
    id: "canvas-menu",
    selector: '[data-testid="zoom-controls-button"]',
    climb: '[role="toolbar"]',
  },
  { id: "image-feed", selector: ".comfyui-image-feed, .pysssss-image-feed" },
];

function dockBarCss(barId: string): string {
  return `
#${barId} {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1350;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scrollbar-width: none;
  background: var(--comfy-menu-bg, rgba(24, 24, 27, 0.92));
  box-shadow: 0 -1px 6px rgba(0, 0, 0, 0.35);
  pointer-events: auto;
}
#${barId}::-webkit-scrollbar { display: none; }
/* Neutralise each docked control's own positioning (the actionbar drags itself
   to fixed coords; the canvas menu is absolute) so it lays out in the flex row. */
#${barId} > [${DOCKED_ATTR}] {
  position: static !important;
  inset: auto !important;
  transform: none !important;
  flex: 0 0 auto;
  margin: 0 !important;
}
`;
}

/** Resolve every dock target to a de-duplicated, order-preserving element list. */
export function resolveTargets(targets: DockTarget[], doc: Document): HTMLElement[] {
  const found: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  for (const target of targets) {
    for (const match of doc.querySelectorAll<HTMLElement>(target.selector)) {
      const el = target.climb ? match.closest<HTMLElement>(target.climb) : match;
      if (el && !seen.has(el)) {
        seen.add(el);
        found.push(el);
      }
    }
  }
  return found;
}

function ensureStyle(doc: Document): void {
  if (doc.getElementById(dockStyleId)) return;
  const style = doc.createElement("style");
  style.id = dockStyleId;
  style.textContent = dockBarCss(dockBarId);
  doc.head.appendChild(style);
}

function ensureBar(doc: Document): HTMLElement {
  const existing = doc.getElementById(dockBarId);
  if (existing) return existing;
  const bar = doc.createElement("div");
  bar.id = dockBarId;
  doc.body.appendChild(bar);
  return bar;
}

interface CanvasControlsDock {
  start(): void;
  stop(): void;
  /** Re-scan for target controls and dock any new ones. */
  refresh(): void;
  readonly enabled: boolean;
}

interface CanvasControlsDockOptions {
  doc?: Document;
  targets?: DockTarget[];
}

export function createCanvasControlsDock(
  options: CanvasControlsDockOptions = {},
): CanvasControlsDock {
  const doc = options.doc ?? document;
  const targets = options.targets ?? DOCK_TARGETS;
  // Each managed element -> the placeholder comment marking its home.
  const homes = new Map<HTMLElement, Comment>();
  let observer: MutationObserver | null = null;
  let enabled = false;
  let scanScheduled = false;

  function dock(el: HTMLElement, bar: HTMLElement): void {
    if (homes.has(el) || el === bar || bar.contains(el)) return;
    const parent = el.parentNode;
    if (!parent) return;
    const home = doc.createComment(PLACEHOLDER_TEXT);
    parent.insertBefore(home, el);
    el.setAttribute(DOCKED_ATTR, "");
    bar.appendChild(el);
    homes.set(el, home);
  }

  // A control Vue removed/remounted is no longer under the bar — forget it and
  // tidy its placeholder so a fresh mount can be re-docked cleanly.
  function dropDetached(bar: HTMLElement): void {
    for (const [el, home] of homes) {
      if (el.parentNode === bar) continue;
      home.remove();
      homes.delete(el);
    }
  }

  function refresh(): void {
    if (!enabled) return;
    const bar = ensureBar(doc);
    dropDetached(bar);
    for (const el of resolveTargets(targets, doc)) dock(el, bar);
  }

  function restore(): void {
    for (const [el, home] of homes) {
      el.removeAttribute(DOCKED_ATTR);
      if (home.parentNode) home.parentNode.insertBefore(el, home);
      else doc.body.appendChild(el);
      home.remove();
    }
    homes.clear();
  }

  function scheduleScan(): void {
    if (scanScheduled) return;
    scanScheduled = true;
    queueMicrotask(() => {
      scanScheduled = false;
      refresh();
    });
  }

  function start(): void {
    if (enabled) return;
    enabled = true;
    ensureStyle(doc);
    refresh();
    if (typeof MutationObserver === "function") {
      observer = new MutationObserver(scheduleScan);
      observer.observe(doc.body, { childList: true, subtree: true });
    }
  }

  function stop(): void {
    if (!enabled) return;
    enabled = false;
    observer?.disconnect();
    observer = null;
    restore();
    doc.getElementById(dockBarId)?.remove();
    doc.getElementById(dockStyleId)?.remove();
  }

  return {
    start,
    stop,
    refresh,
    get enabled() {
      return enabled;
    },
  };
}
