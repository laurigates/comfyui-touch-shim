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
  SHIMS,
  styleElementId,
} from "../../src/index.ts";

describe("shim registry", () => {
  it("every shim links its upstream issue and carries non-empty CSS", () => {
    for (const shim of SHIMS) {
      expect(shim.upstream).toMatch(/^https:\/\/github\.com\/Comfy-Org\/ComfyUI_frontend\/issues/);
      expect(shim.css.trim()).not.toBe("");
      expect(shim.tooltip.trim()).not.toBe("");
    }
  });

  it("shim ids are unique", () => {
    const ids = SHIMS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
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
