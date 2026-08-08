// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
// Vitest transpiles TypeScript, so the test imports the `.ts` source directly
// (no build step). Importing the module also runs the registerExtension wiring
// against tests/js/__mocks__/app.js. There is no modal in this pack — the
// meaningful smoke is the CSS-shim lifecycle (inject / idempotent / remove)
// and the dock-actionbar command's storage write, both jsdom-checkable.
import {
  applyCssShim,
  dockActionbar,
  removeCssShim,
  SETTINGS,
  SHIMS,
  styleElementId,
  toggleCanvasControlsDock,
} from "../../src/index.ts";

describe("shim registry", () => {
  it("every shim links its upstream issue and carries non-empty CSS", () => {
    for (const shim of SHIMS) {
      expect(shim.upstream).toMatch(
        /^https:\/\/github\.com\/Comfy-Org\/ComfyUI_frontend\/issues\/\d+$/,
      );
      expect(shim.css.trim()).not.toBe("");
      expect(shim.tooltip.trim()).not.toBe("");
    }
  });

  it("shim ids are unique", () => {
    const ids = SHIMS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// Node-tier assertions on plain data. What they CANNOT assert: that the
// settings dialog actually renders three rows under one "Touch Tools" heading,
// or that a stored value survived the re-key — both are browser-tier (see
// .claude/rules/modal-pack-test-tiers.md and the spec's T5 checklist).
describe("settings are filed under the Touch Tools category", () => {
  it("registers exactly the three settings this pack owns", () => {
    // 2 shim toggles + 1 canvas-dock toggle. DOCK_TARGETS (4 ids in
    // canvas-controls-dock.ts) is the dock's relocation list and registers no
    // settings — it is not a second shim registry.
    expect(SETTINGS.length).toBe(SHIMS.length + 1);
    expect(SHIMS.length).toBe(2);
  });

  it("every setting carries a three-element Touch Tools > Touch Shim category", () => {
    for (const setting of SETTINGS) {
      expect(setting.category).toEqual(["Touch Tools", "Touch Shim", expect.stringMatching(/^\S/)]);
    }
  });

  it("no two settings share a full category array", () => {
    // The collapse this guards is silent: buildTree overwrites parent.data at a
    // reused path (treeUtil.ts:24-38), so a duplicate makes the FIRST setting
    // vanish from the dialog while its stored value survives.
    const paths = SETTINGS.map((s) => s.category.join("/"));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("sortOrder descends with registration order", () => {
    // flattenTree pops a stack (treeUtil.ts:57-66), so equal sortOrder renders
    // the list backwards. Strictly-descending values cancel that out.
    const orders = SETTINGS.map((s) => s.sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => b - a));
    expect(new Set(orders).size).toBe(orders.length);
  });
});

describe("CSS shim lifecycle", () => {
  const shim = SHIMS[0];

  it("apply injects one managed <style>, idempotently", () => {
    applyCssShim(shim);
    applyCssShim(shim);
    const styles = document.querySelectorAll(`#${styleElementId(shim)}`);
    expect(styles.length).toBe(1);
    expect(styles[0].textContent).toContain(shim.upstream);
    expect(styles[0].textContent).toContain(shim.css.trim().slice(0, 20));
  });

  it("remove deletes the managed <style> and tolerates absence", () => {
    removeCssShim(shim);
    expect(document.getElementById(styleElementId(shim))).toBeNull();
    removeCssShim(shim); // second remove is a no-op, not a throw
  });
});

describe("dockActionbar", () => {
  it("persists the docked flag and reloads", () => {
    const storage = { setItem: vi.fn() };
    const reload = vi.fn();
    dockActionbar(storage, reload);
    expect(storage.setItem).toHaveBeenCalledWith("Comfy.MenuPosition.Docked", "true");
    expect(reload).toHaveBeenCalledOnce();
  });
});

describe("toggleCanvasControlsDock", () => {
  it("flips the setting through the extension manager's setting store", () => {
    const values = { "TouchShim.CanvasControlsDock": false };
    const extensionManager = {
      setting: {
        get: vi.fn((id) => values[id]),
        set: vi.fn((id, value) => {
          values[id] = value;
        }),
      },
    };
    toggleCanvasControlsDock(extensionManager);
    expect(extensionManager.setting.set).toHaveBeenCalledWith("TouchShim.CanvasControlsDock", true);

    toggleCanvasControlsDock(extensionManager);
    expect(extensionManager.setting.set).toHaveBeenCalledWith(
      "TouchShim.CanvasControlsDock",
      false,
    );
  });

  it("treats an unset stored value as off", () => {
    const extensionManager = {
      setting: { get: vi.fn(() => undefined), set: vi.fn() },
    };
    toggleCanvasControlsDock(extensionManager);
    expect(extensionManager.setting.set).toHaveBeenCalledWith("TouchShim.CanvasControlsDock", true);
  });
});
