/* web/dist bundle built by bun from src/ in this repository (see package.json). No third-party code is bundled. */

// src/index.ts
import { app } from "/scripts/app.js";

// src/canvas-controls-dock.ts
var EXT_NAME = "comfyui-touch-shim";
var DOCK_ID = "CanvasControlsDock";
var dockBarId = `${EXT_NAME}-${DOCK_ID}-bar`;
var dockStyleId = `${EXT_NAME}-${DOCK_ID}-style`;
var DOCKED_ATTR = "data-touch-shim-docked";
var PLACEHOLDER_TEXT = `${EXT_NAME}:${DOCK_ID}-home`;
var DOCK_TARGETS = [
  { id: "breadcrumb", selector: '[data-testid="subgraph-breadcrumb"]' },
  {
    id: "actionbar",
    selector: '[data-testid="queue-overlay-toggle"]',
    climb: ".actionbar"
  },
  {
    id: "canvas-menu",
    selector: '[data-testid="zoom-controls-button"]',
    climb: '[role="toolbar"]'
  },
  { id: "image-feed", selector: ".comfyui-image-feed, .pysssss-image-feed" }
];
function dockBarCss(barId) {
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
function resolveTargets(targets, doc) {
  const found = [];
  const seen = new Set;
  for (const target of targets) {
    for (const match of doc.querySelectorAll(target.selector)) {
      const el = target.climb ? match.closest(target.climb) : match;
      if (el && !seen.has(el)) {
        seen.add(el);
        found.push(el);
      }
    }
  }
  return found;
}
function ensureStyle(doc) {
  if (doc.getElementById(dockStyleId))
    return;
  const style = doc.createElement("style");
  style.id = dockStyleId;
  style.textContent = dockBarCss(dockBarId);
  doc.head.appendChild(style);
}
function ensureBar(doc) {
  const existing = doc.getElementById(dockBarId);
  if (existing)
    return existing;
  const bar = doc.createElement("div");
  bar.id = dockBarId;
  doc.body.appendChild(bar);
  return bar;
}
function createCanvasControlsDock(options = {}) {
  const doc = options.doc ?? document;
  const targets = options.targets ?? DOCK_TARGETS;
  const homes = new Map;
  let observer = null;
  let enabled = false;
  let scanScheduled = false;
  function dock(el, bar) {
    if (homes.has(el) || el === bar || bar.contains(el))
      return;
    const parent = el.parentNode;
    if (!parent)
      return;
    const home = doc.createComment(PLACEHOLDER_TEXT);
    parent.insertBefore(home, el);
    el.setAttribute(DOCKED_ATTR, "");
    bar.appendChild(el);
    homes.set(el, home);
  }
  function dropDetached(bar) {
    for (const [el, home] of homes) {
      if (el.parentNode === bar)
        continue;
      home.remove();
      homes.delete(el);
    }
  }
  function refresh() {
    if (!enabled)
      return;
    const bar = ensureBar(doc);
    dropDetached(bar);
    for (const el of resolveTargets(targets, doc))
      dock(el, bar);
  }
  function restore() {
    for (const [el, home] of homes) {
      el.removeAttribute(DOCKED_ATTR);
      if (home.parentNode)
        home.parentNode.insertBefore(el, home);
      else
        doc.body.appendChild(el);
      home.remove();
    }
    homes.clear();
  }
  function scheduleScan() {
    if (scanScheduled)
      return;
    scanScheduled = true;
    queueMicrotask(() => {
      scanScheduled = false;
      refresh();
    });
  }
  function start() {
    if (enabled)
      return;
    enabled = true;
    ensureStyle(doc);
    refresh();
    if (typeof MutationObserver === "function") {
      observer = new MutationObserver(scheduleScan);
      observer.observe(doc.body, { childList: true, subtree: true });
    }
  }
  function stop() {
    if (!enabled)
      return;
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
    }
  };
}

// src/index.ts
var EXT_NAME2 = "comfyui-touch-shim";
var DOCK_COMMAND_ID = "touch-shim.dock-actionbar";
var TOGGLE_CANVAS_DOCK_COMMAND_ID = "touch-shim.toggle-canvas-controls-dock";
var CANVAS_DOCK_SETTING_ID = "TouchShim.CanvasControlsDock";
var tabCloseButton = {
  id: "TabCloseButton",
  name: "Always-visible workflow-tab close button",
  upstream: "https://github.com/Comfy-Org/ComfyUI_frontend/issues/13279",
  tooltip: "Show the workflow tab's ✕ on touch devices (upstream hides it until hover, which touch never fires).",
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
`
};
var sidePanelLayout = {
  id: "SidePanelLayout",
  name: "Side-panel layout fixes on narrow screens",
  upstream: "https://github.com/Comfy-Org/ComfyUI_frontend/issues/13446",
  tooltip: "Wrap the side-panel button row, allow vertical scroll, and drop rigid widths on narrow viewports.",
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
`
};
var SHIMS = [tabCloseButton, sidePanelLayout];
function styleElementId(shim) {
  return `${EXT_NAME2}-${shim.id}`;
}
function applyCssShim(shim, doc = document) {
  if (doc.getElementById(styleElementId(shim)))
    return;
  const style = doc.createElement("style");
  style.id = styleElementId(shim);
  style.textContent = `/* ${EXT_NAME2}: ${shim.name} — stopgap for ${shim.upstream} */${shim.css}`;
  doc.head.appendChild(style);
}
function removeCssShim(shim, doc = document) {
  doc.getElementById(styleElementId(shim))?.remove();
}
function dockActionbar(storage = localStorage, reload = () => window.location.reload()) {
  storage.setItem("Comfy.MenuPosition.Docked", "true");
  reload();
}
function toggleCanvasControlsDock(extensionManager = app.extensionManager) {
  const enabled = extensionManager.setting.get(CANVAS_DOCK_SETTING_ID) ?? false;
  extensionManager.setting.set(CANVAS_DOCK_SETTING_ID, !enabled);
}
function shimSettings() {
  return SHIMS.map((shim, index) => ({
    id: `TouchShim.${shim.id}`,
    name: shim.name,
    type: "boolean",
    defaultValue: true,
    category: ["Touch Tools", "Touch Shim", shim.id],
    sortOrder: 100 - index * 10,
    tooltip: `${shim.tooltip} Stopgap for ${shim.upstream}`,
    onChange: (value) => {
      if (value)
        applyCssShim(shim);
      else
        removeCssShim(shim);
    }
  }));
}
var canvasControlsDock = createCanvasControlsDock();
function canvasDockSetting() {
  return {
    id: CANVAS_DOCK_SETTING_ID,
    name: "Dock floating canvas controls into a scrollable bottom bar (experimental)",
    type: "boolean",
    defaultValue: false,
    category: ["Touch Tools", "Touch Shim", "CanvasControlsDock"],
    sortOrder: 10,
    tooltip: "EXPERIMENTAL: gather the run/queue actionbar, subgraph breadcrumb, the canvas menu (zoom/minimap/fit-view) and the pysssss image feed into one fixed bottom bar you can scroll horizontally by touch. Reparents live UI; switch off to restore everything in place.",
    onChange: (value) => {
      if (value)
        canvasControlsDock.start();
      else
        canvasControlsDock.stop();
    }
  };
}
var SETTINGS = [...shimSettings(), canvasDockSetting()];
app.registerExtension({
  name: "comfy.touch-shim",
  settings: SETTINGS,
  commands: [
    {
      id: DOCK_COMMAND_ID,
      label: "Dock actionbar to top (reloads the page)",
      icon: "pi pi-arrow-up",
      function: () => dockActionbar()
    },
    {
      id: TOGGLE_CANVAS_DOCK_COMMAND_ID,
      label: "Toggle scrollable canvas controls bar (experimental)",
      icon: "pi pi-arrows-h",
      function: () => toggleCanvasControlsDock()
    }
  ],
  menuCommands: [
    {
      path: ["Extensions", "Touch Tools"],
      commands: [DOCK_COMMAND_ID, TOGGLE_CANVAS_DOCK_COMMAND_ID]
    }
  ]
});
export {
  toggleCanvasControlsDock,
  styleElementId,
  removeCssShim,
  dockActionbar,
  applyCssShim,
  SHIMS,
  SETTINGS
};
