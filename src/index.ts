// Touch Shim — ComfyUI frontend extension.
//
// A home for SMALL, INDIVIDUALLY-TOGGLEABLE stopgap mobile/touch QOL fixes for
// upstream ComfyUI frontend bugs. Every shim:
//   - links the upstream issue it papers over (in `upstream` + the settings
//     tooltip), and
//   - is deleted from this pack the release the upstream fix ships.
//
// TypeScript source in `src/`, built to ESM via `bun build` and emitted to
// `web/dist/` (served at /extensions/comfyui-touch-shim/index.js — the pack
// directory name IS the URL segment). See ADR-0001.
//
// Unlike the sibling packs there is NO modal here — the pack injects scoped
// <style> tags (one per shim, managed by a boolean setting) and registers
// commands. CSS selectors target stable `data-testid` hooks where the frontend
// provides them; anything keyed on compiled Tailwind class chains is brittle
// across frontend releases and is expected to rot — each shim must fail soft
// (a dead selector styles nothing).
import type { ComfyApp } from "@comfyorg/comfyui-frontend-types";
import { app } from "/scripts/app.js";

const EXT_NAME = "comfyui-touch-shim";
const DOCK_COMMAND_ID = "touch-shim.dock-actionbar";

// ============================================================
// Shim registry
// ============================================================

export interface CssShim {
  /** PascalCase suffix of the `TouchShim.<Id>` boolean setting. */
  id: string;
  /** Settings-UI label. */
  name: string;
  /** Upstream issue this shim papers over. Delete the shim when it closes. */
  upstream: string;
  /** One-line settings tooltip (the upstream URL is appended). */
  tooltip: string;
  css: string;
}

// Workflow-tab ✕ button is `invisible` until :hover, which never fires on
// touch — tabs can't be closed at all on phones/tablets. Force it visible on
// coarse-pointer / no-hover devices and give it a real tap target. The dirty
// dot (`workflow-dirty-indicator`) overlays the same slot and hides on hover;
// make it click-through so a tap still lands on the button beneath it.
// Verified against ComfyUI_frontend src/components/topbar/WorkflowTab.vue.
const tabCloseButton: CssShim = {
  id: "TabCloseButton",
  name: "Always-visible workflow-tab close button",
  upstream: "https://github.com/Comfy-Org/ComfyUI_frontend/issues/13279",
  tooltip:
    "Show the workflow tab's ✕ on touch devices (upstream hides it until hover, which touch never fires).",
  css: `
@media (hover: none), (pointer: coarse) {
  [data-testid="close-workflow-button"] {
    visibility: visible !important;
    min-width: 2rem;
    min-height: 2rem;
  }
  [data-testid="workflow-dirty-indicator"] {
    pointer-events: none;
  }
}
`,
};

// The sidebar button column clips on narrow viewports: the horizontal button
// row doesn't wrap, the nested Run/status column carries a rigid width, and
// the parent splitter panel is overflow:hidden, so overflowing controls are
// simply unreachable. Selectors are compiled Tailwind chains (no testid hook
// exists) — brittle by nature; scoped to narrow viewports so desktop is
// untouched. Findings from live DevTools analysis, 2026-07.
const sidePanelLayout: CssShim = {
  id: "SidePanelLayout",
  name: "Side-panel layout fixes on narrow screens",
  upstream: "https://github.com/Comfy-Org/ComfyUI_frontend/issues/13446",
  tooltip:
    "Wrap the side-panel button row, allow vertical scroll, and drop rigid widths on narrow viewports.",
  css: `
@media (max-width: 768px) {
  .p-splitterpanel .flex.gap-x-0\\.5 {
    flex-wrap: wrap;
  }
  .p-splitterpanel.p-splitterpanel-nested {
    overflow-y: auto;
  }
  .p-splitterpanel .mx-1.flex.flex-col.items-end.gap-1 {
    width: auto;
    max-width: 100%;
    flex-shrink: 1;
  }
}
`,
};

export const SHIMS: CssShim[] = [tabCloseButton, sidePanelLayout];

// ============================================================
// CSS shim lifecycle — one managed <style> per shim, idempotent
// ============================================================

export function styleElementId(shim: Pick<CssShim, "id">): string {
  return `${EXT_NAME}-${shim.id}`;
}

export function applyCssShim(shim: CssShim, doc: Document = document): void {
  if (doc.getElementById(styleElementId(shim))) return;
  const style = doc.createElement("style");
  style.id = styleElementId(shim);
  style.textContent = `/* ${EXT_NAME}: ${shim.name} — stopgap for ${shim.upstream} */${shim.css}`;
  doc.head.appendChild(style);
}

export function removeCssShim(shim: Pick<CssShim, "id">, doc: Document = document): void {
  doc.getElementById(styleElementId(shim))?.remove();
}

// ============================================================
// Dock-actionbar command
// ============================================================

// Once the actionbar is undocked, the only upstream UI to re-dock it is
// dragging its handle onto a "Dock to top" drop target the handle physically
// can't reach on a phone — upstream issue:
// https://github.com/Comfy-Org/ComfyUI_frontend/issues/13442
// The docked state is just a persisted boolean
// (useLocalStorage("Comfy.MenuPosition.Docked") — verified against
// ComfyUI_frontend src/components/actionbar/ComfyActionbar.vue:152), so the
// command writes it and reloads; an external localStorage write does not
// update the live vueuse ref, hence the reload.
export function dockActionbar(
  storage: Pick<Storage, "setItem"> = localStorage,
  reload: () => void = () => window.location.reload(),
): void {
  storage.setItem("Comfy.MenuPosition.Docked", "true");
  reload();
}

// ============================================================
// Wiring
// ============================================================

type ExtensionSettings = NonNullable<Parameters<ComfyApp["registerExtension"]>[0]["settings"]>;

function shimSettings(): ExtensionSettings {
  return SHIMS.map((shim) => ({
    id: `TouchShim.${shim.id}`,
    name: shim.name,
    type: "boolean",
    defaultValue: true,
    tooltip: `${shim.tooltip} Stopgap for ${shim.upstream}`,
    // Fires once at registration with the stored value, then on every toggle.
    onChange: (value: unknown) => {
      if (value) applyCssShim(shim);
      else removeCssShim(shim);
    },
  })) as ExtensionSettings;
}

app.registerExtension({
  name: "comfy.touch-shim",
  settings: shimSettings(),
  commands: [
    {
      id: DOCK_COMMAND_ID,
      label: "Dock actionbar to top (reloads the page)",
      function: () => dockActionbar(),
    },
  ],
  menuCommands: [
    {
      path: ["Extensions", "Touch Shim"],
      commands: [DOCK_COMMAND_ID],
    },
  ],
});
