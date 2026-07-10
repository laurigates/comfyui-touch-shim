# CLAUDE.md

Frontend-only ComfyUI custom-node pack. `__init__.py` is a loader stub; the whole extension is TypeScript in `src/`, built to `web/dist/` via bun. See ADR-0001.

## The pattern ("the vein")

A **stopgap-shim pack**, deliberately unlike its modal siblings: a home for small, individually-toggleable mobile/touch QOL fixes for *upstream ComfyUI frontend bugs*. Each shim is an entry in the `SHIMS` registry in `src/index.ts` — a scoped CSS `<style>` injection managed by a boolean `TouchShim.<Id>` setting (`onChange` applies/removes it; the setting store fires `onChange` once at registration with the stored value) — or a registered command (e.g. `touch-shim.dock-actionbar`). Every shim carries its upstream issue URL in `upstream` and the settings tooltip, and **is deleted from the pack the release the upstream fix ships**. There is no modal and no `@laurigates/comfy-modal-kit` dependency. CSS selectors prefer stable `data-testid` hooks; compiled-Tailwind selectors are expected to rot and must fail soft (a dead selector styles nothing).

## File layout

| Path | Purpose |
|------|---------|
| `src/index.ts` | The extension: the `SHIMS` registry (CSS shims + settings wiring) and commands. |
| `src/canvas-controls-dock.ts` | Experimental **behavioral** shim (not a `CssShim`): reparents the floating on-canvas controls into one horizontally-scrollable bottom bar. Fail-soft, reversible, carries no `upstream` yet (QOL experiment). Toggled by `TouchShim.CanvasControlsDock`. |
| `src/comfyui-shims.d.ts` | Types the `/scripts/app.js` runtime import (via the `paths` mapping in `tsconfig.json`). |
| `__init__.py` | Loader stub. Empty `NODE_CLASS_MAPPINGS`; exports `WEB_DIRECTORY = "./web/dist"`. |
| `web/dist/` | **Generated** by `bun run build`, committed (tracked) so git clone/update carries it. ComfyUI serves it at `/extensions/comfyui-touch-shim/`. |
| `pyproject.toml` | Comfy Registry metadata. `PublisherId` + `version` are the fields you touch; `[tool.comfy] includes = ["web/dist"]` force-ships the built output. |
| `tsconfig.json` / `biome.json` / `knip.json` | Strict TS config, Biome lint/format, knip dead-code. |
| `.github/workflows/` | `ci.yml` (tsc+build/biome/vitest/ruff/pytest/gitleaks), `publish.yml` (builds then publishes on version bump), `release-please.yml`. |
| `tests/js/` | Vitest suite importing the `.ts` source directly. `tests/test_init.py` is a pytest loader-stub smoke test. |
| `justfile` | `build`, `lint`, `format`, `test`, `check` recipes — the local CI gate. |

## Hard rules

- **Pack directory name is part of the URL.** `web/dist/index.js` is served at
  `/extensions/comfyui-touch-shim/index.js`. Renaming the pack dir breaks every fetch. If
  unavoidable, sync `EXT_NAME` in the source.
- **TypeScript source, bun build.** Author in `src/` (entry `src/index.ts`),
  build to `web/dist/` via `bun build ./src/index.ts --target browser --format
  esm --outdir web/dist --external '/scripts/*'`. `tsc --noEmit` is the type
  gate; `bun build` is the emit — they are decoupled. The `/scripts/app.js`
  import is left **unbundled** (resolved at runtime against ComfyUI's served
  module). See ADR-0001.
- **No Python dependencies. The pack is frontend-only; a feature genuinely needing Python belongs in a separate companion pack.**
- **Additive only.** Never clobber an existing tooltip/control; fall back to
  the native widget when there's no match. Never fabricate data.
- **Every shim links its upstream issue and dies with it.** A shim without an `upstream` URL doesn't merge; a shim whose upstream fix has shipped gets removed (that's a `fix:`/`feat:` release, not a silent edit).
- **Shims fail soft.** Prefer `data-testid` selectors; a rotted selector must degrade to styling nothing — never throw, never block the app chrome.
- **Never hand-edit `CHANGELOG.md` or the `version` field** — release-please
  owns them (conventional commits drive the bump).

## Dev workflow

```sh
uv sync --group dev          # ruff, pytest, pre-commit
bun install                  # TypeScript, Biome, Vitest, knip
pre-commit install
just check                   # typecheck + build + lint + test — the local CI gate
```

Iterating on the frontend needs a **`bun run build`** (the served file is
`web/dist/index.js`, not the source) plus a browser hard-refresh — no ComfyUI
restart.

### Endpoint reachability check

```sh
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8188/extensions/comfyui-touch-shim/index.js
```

## Verify the frontend API against the sourcemap

The ComfyUI frontend (`comfyui-frontend-package`) ships **minified** — property
and method names are renamed in the bundle, so reading the running app's objects
by guessed names (or trusting old tutorials) is unreliable. The TypeScript types
from `@comfyorg/comfyui-frontend-types` cover `ComfyApp` but **not** the internal
`LGraphNode` / `LGraphCanvas` / widget interfaces (un-exported). Model the small
surface you touch with local structural interfaces, and verify the real shape
against the bundled sourcemap before coding against a LiteGraph / canvas API.

LiteGraph is bundled in the **`api-*.js.map`** chunk under
`.venv/lib/python*/site-packages/comfyui_frontend_package/static/assets/`. The
`.js.map` embeds the original TypeScript in `sourcesContent` — grep that, not the
minified `.js`:

```sh
cd .venv/lib/python*/site-packages/comfyui_frontend_package/static/assets
grep -l 'LGraphGroup' *.js.map        # find the chunk
```

Facts worth confirming this way (recheck on a `comfyui-frontend-package` bump):
`LiteGraph.NODE_TITLE_HEIGHT` (30); `canvas.selectedItems` is a
`Set<Positionable>` holding nodes + groups + reroutes; `canvas.selected_nodes` is
a node-only dictionary; canvas zoom is **wheel-driven**
(`processMouseWheel -> ds.changeScale`).

DOM facts verified against frontend **1.45.20** (`GraphView-*.js.map`):
`[data-testid="side-toolbar"]` is the ENTIRE left vertical nav
(`SideToolbar.vue`: Comfy menu + all sidebar tabs + settings, `h-full
flex-col`) — never dock/reparent it into a horizontal container;
`[data-testid="queue-overlay-toggle"]` + `closest(".actionbar")` lands on the
small run/queue Panel (`ComfyActionbar.vue`; the enclosing
`.actionbar-container` in `TopMenuSection.vue` is a different class token, so
`closest` can't over-climb); `[data-testid="zoom-controls-button"]` +
`closest('[role="toolbar"]')` lands on the `flex-row` canvas-menu ButtonGroup
(`GraphCanvasMenu.vue`).

Two gotchas that follow: discriminate selected items by **shape, not
`instanceof`** (the class is renamed under minification); and to suppress native
zoom during a gesture, intercept `wheel` (capture, `passive:false`,
`preventDefault`), not just pointer events. Record what you confirm in a
"Verified frontend API" table above so the next change doesn't re-derive it.

## Releases

Merge the release-please PR → the published GitHub release triggers
`publish.yml`, which runs `bun run build`, publishes via
`Comfy-Org/publish-node-action`, attaching the release notes as the per-version registry changelog (the "Updates" section). Requires the
`REGISTRY_ACCESS_TOKEN` repo secret. Use conventional commits; release-please
maintains `CHANGELOG.md` and the version bump PR.
