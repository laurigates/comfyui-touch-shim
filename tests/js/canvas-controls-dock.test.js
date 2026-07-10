// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  createCanvasControlsDock,
  DOCK_TARGETS,
  DOCKED_ATTR,
  dockBarId,
  dockStyleId,
  resolveTargets,
} from "../../src/canvas-controls-dock.ts";

// A minimal stand-in for the scattered frontend chrome: three controls in
// distinct parents, each identified by a stable selector, plus a climb case.
function buildCanvas() {
  document.body.innerHTML = `
    <div id="top"><div data-testid="subgraph-breadcrumb">breadcrumb</div></div>
    <div id="left"><nav data-testid="side-toolbar">sidebar</nav></div>
    <div id="corner">
      <div role="toolbar" class="canvas-menu">
        <button data-testid="zoom-controls-button">100%</button>
      </div>
    </div>
  `;
}

const TEST_TARGETS = [
  { id: "breadcrumb", selector: '[data-testid="subgraph-breadcrumb"]' },
  { id: "sidebar", selector: '[data-testid="side-toolbar"]' },
  {
    id: "canvas-menu",
    selector: '[data-testid="zoom-controls-button"]',
    climb: '[role="toolbar"]',
  },
];

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("DOCK_TARGETS", () => {
  it("every target has a stable id and non-empty selector", () => {
    for (const target of DOCK_TARGETS) {
      expect(target.id).toBeTruthy();
      expect(target.selector.trim()).not.toBe("");
    }
  });

  it("target ids are unique", () => {
    const ids = DOCK_TARGETS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Regression: `[data-testid="side-toolbar"]` is the ENTIRE left vertical nav
  // (SideToolbar.vue — Comfy menu + every sidebar tab + settings). Docking that
  // full-height column into the horizontal bar shoved the nav to the right of
  // the actionbar and stretched the bar to the column's height. The real
  // targets must leave it untouched.
  it("never captures the left side toolbar nav", () => {
    document.body.innerHTML = `
      <div id="left-column">
        <nav data-testid="side-toolbar" class="side-tool-bar-container" role="toolbar">
          <button data-testid="queue-tab-button">queue</button>
        </nav>
      </div>
      <div role="toolbar"><button data-testid="zoom-controls-button">100%</button></div>
    `;
    const nav = document.querySelector('[data-testid="side-toolbar"]');

    const resolved = resolveTargets(DOCK_TARGETS, document);
    expect(resolved).not.toContain(nav);

    const dock = createCanvasControlsDock({ targets: DOCK_TARGETS });
    dock.start();
    expect(nav.parentElement).toBe(document.getElementById("left-column"));
    expect(nav.hasAttribute(DOCKED_ATTR)).toBe(false);
    dock.stop();
  });
});

describe("resolveTargets", () => {
  it("resolves selectors, climbs to the requested ancestor, and dedups", () => {
    buildCanvas();
    const resolved = resolveTargets(TEST_TARGETS, document);
    expect(resolved.map((el) => el.getAttribute("data-testid") ?? el.className)).toEqual([
      "subgraph-breadcrumb",
      "side-toolbar",
      "canvas-menu", // climbed from the zoom button to role=toolbar
    ]);
  });

  it("skips targets whose selector matches nothing (fail soft)", () => {
    buildCanvas();
    const resolved = resolveTargets(
      [{ id: "missing", selector: ".not-present" }, ...TEST_TARGETS],
      document,
    );
    expect(resolved).toHaveLength(3);
  });
});

describe("createCanvasControlsDock", () => {
  it("start() moves matched controls into a fixed bottom bar", () => {
    buildCanvas();
    const dock = createCanvasControlsDock({ targets: TEST_TARGETS });
    dock.start();

    const bar = document.getElementById(dockBarId);
    expect(bar).not.toBeNull();
    expect(document.getElementById(dockStyleId)).not.toBeNull();
    expect(bar.children).toHaveLength(3);
    for (const child of bar.children) {
      expect(child.hasAttribute(DOCKED_ATTR)).toBe(true);
    }
    // Homes are marked by a placeholder comment left behind.
    expect(document.getElementById("top").firstChild?.nodeType).toBe(Node.COMMENT_NODE);
  });

  it("stop() restores every control to its exact original position", () => {
    buildCanvas();
    const before = document.body.innerHTML;
    const dock = createCanvasControlsDock({ targets: TEST_TARGETS });

    dock.start();
    dock.stop();

    expect(document.getElementById(dockBarId)).toBeNull();
    expect(document.getElementById(dockStyleId)).toBeNull();
    expect(document.querySelector(`[${DOCKED_ATTR}]`)).toBeNull();
    expect(document.body.innerHTML).toBe(before);
  });

  it("refresh() adopts controls mounted after start, without duplicating", () => {
    buildCanvas();
    const dock = createCanvasControlsDock({ targets: TEST_TARGETS });
    dock.start();

    const latecomer = document.createElement("nav");
    latecomer.setAttribute("data-testid", "side-toolbar");
    document.getElementById("left").appendChild(latecomer);
    dock.refresh();
    dock.refresh();

    const bar = document.getElementById(dockBarId);
    const docked = bar.querySelectorAll('[data-testid="side-toolbar"]');
    expect(docked).toHaveLength(2);
    expect(bar.children).toHaveLength(4);
  });

  it("start() is idempotent", () => {
    buildCanvas();
    const dock = createCanvasControlsDock({ targets: TEST_TARGETS });
    dock.start();
    dock.start();
    expect(document.querySelectorAll(`#${dockBarId}`)).toHaveLength(1);
    expect(document.getElementById(dockBarId).children).toHaveLength(3);
  });

  it("re-docks a fresh element after Vue removes the docked one", () => {
    buildCanvas();
    const dock = createCanvasControlsDock({ targets: TEST_TARGETS });
    dock.start();

    const bar = document.getElementById(dockBarId);
    const old = bar.querySelector('[data-testid="side-toolbar"]');
    old.remove(); // Vue unmounts the docked control

    const remounted = document.createElement("nav");
    remounted.setAttribute("data-testid", "side-toolbar");
    document.getElementById("left").appendChild(remounted);
    dock.refresh();

    const docked = bar.querySelectorAll('[data-testid="side-toolbar"]');
    expect(docked).toHaveLength(1);
    expect(docked[0]).toBe(remounted);
  });
});
