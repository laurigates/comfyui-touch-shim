// src/index.ts
import { app } from "/scripts/app.js";
var EXT_NAME = "comfyui-touch-shim";
var DOCK_COMMAND_ID = "touch-shim.dock-actionbar";
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
  return `${EXT_NAME}-${shim.id}`;
}
function applyCssShim(shim, doc = document) {
  if (doc.getElementById(styleElementId(shim)))
    return;
  const style = doc.createElement("style");
  style.id = styleElementId(shim);
  style.textContent = `/* ${EXT_NAME}: ${shim.name} — stopgap for ${shim.upstream} */${shim.css}`;
  doc.head.appendChild(style);
}
function removeCssShim(shim, doc = document) {
  doc.getElementById(styleElementId(shim))?.remove();
}
function dockActionbar(storage = localStorage, reload = () => window.location.reload()) {
  storage.setItem("Comfy.MenuPosition.Docked", "true");
  reload();
}
function shimSettings() {
  return SHIMS.map((shim) => ({
    id: `TouchShim.${shim.id}`,
    name: shim.name,
    type: "boolean",
    defaultValue: true,
    tooltip: `${shim.tooltip} Stopgap for ${shim.upstream}`,
    onChange: (value) => {
      if (value)
        applyCssShim(shim);
      else
        removeCssShim(shim);
    }
  }));
}
app.registerExtension({
  name: "comfy.touch-shim",
  settings: shimSettings(),
  commands: [
    {
      id: DOCK_COMMAND_ID,
      label: "Dock actionbar to top (reloads the page)",
      icon: "pi pi-arrow-up",
      function: () => dockActionbar()
    }
  ],
  menuCommands: [
    {
      path: ["Extensions", "Touch Tools"],
      commands: [DOCK_COMMAND_ID]
    }
  ]
});
export {
  styleElementId,
  removeCssShim,
  dockActionbar,
  applyCssShim,
  SHIMS
};
