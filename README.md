# comfyui-touch-shim

Small stopgap mobile/touch QOL fixes for upstream ComfyUI frontend bugs — each
shim toggleable via a setting, linked to its upstream issue, and deleted from
this pack the release the upstream fix ships.

> Part of a family of mobile-first ComfyUI usability packs
> ([gallery-loader](https://github.com/laurigates/comfyui-gallery-loader),
> [sampler-info](https://github.com/laurigates/comfyui-sampler-info)).
> Unlike its siblings this pack has no modal UI — it injects small scoped
> CSS fixes and registers commands, additive and self-contained.

## Install

```sh
cd <ComfyUI>/custom_nodes
git clone https://github.com/laurigates/comfyui-touch-shim
cd comfyui-touch-shim
bun install
bun run build      # emit web/dist/ (served by ComfyUI)
```

Restart ComfyUI; hard-refresh the browser tab (Ctrl+Shift+R / Cmd+Shift+R).

## What it does

Papers over upstream ComfyUI frontend bugs that make the app painful on
phones/tablets, until the upstream fixes land. Each shim is a boolean setting
under **Settings → TouchShim** (default on), so any one can be switched off
independently — and each is removed from the pack once its upstream issue
closes and the fix ships in `comfyui-frontend-package`.

| Shim | Problem | Upstream |
|------|---------|----------|
| Always-visible workflow-tab close button | The tab's ✕ is hover-revealed, and touch never hovers — tabs can't be closed at all on touch devices. The shim forces it visible on coarse-pointer devices, gives it a real tap target, and makes the unsaved-dot overlay click-through. | [Comfy-Org/ComfyUI_frontend#13279](https://github.com/Comfy-Org/ComfyUI_frontend/issues/13279) |
| Side-panel layout fixes on narrow screens | The sidebar button row doesn't wrap, a nested status column carries a rigid width, and the parent panel is `overflow: hidden` — controls get clipped and are unreachable on phones. The shim wraps the row, allows vertical scroll, and drops the rigid width on narrow viewports. | [Comfy-Org/ComfyUI_frontend#13446](https://github.com/Comfy-Org/ComfyUI_frontend/issues/13446) |
| **Dock actionbar to top** command | Once the actionbar is undocked, the only way to re-dock it is dragging its handle onto a drop target the handle physically can't reach on a phone. The command (menu: *Extensions → Touch Shim*, or the command palette) sets the persisted docked flag and reloads. | [Comfy-Org/ComfyUI_frontend#13442](https://github.com/Comfy-Org/ComfyUI_frontend/issues/13442) |

<!-- Hero screenshot: add the containerized screenshot pipeline with the
     `comfyui-screenshot-pipeline` skill (`just screenshots`), then embed the
     committed docs/*.png here with an italic caption, like the sibling packs. -->

## Caveats

CSS shims prefer stable `data-testid` hooks where the frontend provides them;
the side-panel shim has no such hook and targets compiled Tailwind class
chains, which may rot across `comfyui-frontend-package` releases. A rotted
selector fails soft (styles nothing); if a shim stops working after a frontend
update, check this repo for a newer release before filing a bug.

## Compatibility

- ComfyUI: modern Vue frontend (`comfyui-frontend-package >= 1.40`) for the
  `registerExtension` settings/command API.
- Frontend changes take effect after `bun run build` + a browser hard-refresh —
  no ComfyUI restart.

## License

MIT — see `LICENSE`.
