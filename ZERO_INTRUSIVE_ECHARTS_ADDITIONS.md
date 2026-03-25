# Zero-Intrusive ECharts Additions

This feature was added without modifying any existing OpenClaw source files.

## Added Files

- `D:\code\work\OpenClaw\openclaw\tools\openclaw-echarts-userscript\openclaw-echarts-renderer.user.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-echarts-userscript\openclaw-echarts-renderer.cdn.user.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-echarts-userscript\openclaw-echarts-renderer.template.user.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-echarts-userscript\build-offline-userscript.mjs`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-echarts-userscript\README.md`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-echarts-userscript\VENDOR_NOTES.md`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\openclaw-echarts-renderer.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\build-custom-control-ui.mjs`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\setup-direct-docker-compose-up.mjs`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\setup-direct-docker-compose-up.sh`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\README.md`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\RUNTIME_ARCHITECTURE.md`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\runtime\framework\shared.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\runtime\framework\styles.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\runtime\framework\chat-composer.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\runtime\framework\adapter-registry.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\runtime\framework\fenced-block-runtime.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\runtime\branding\brand-replacer.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\runtime\file\ui-text.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\runtime\file\styles.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\runtime\file\libraries.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\runtime\file\parser.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\runtime\file\adapter.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\runtime\echarts\ui-text.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\runtime\echarts\styles.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\runtime\echarts\libraries.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\runtime\echarts\parser.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\runtime\echarts\prompt.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\runtime\echarts\detail-modal.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\runtime\echarts\adapter.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\generated\.gitignore`
- `D:\code\work\OpenClaw\openclaw\docker-compose.override.yml`
- `D:\code\work\OpenClaw\openclaw\ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`

## Notes

- The current recommended implementation is the custom Control UI root generator under `tools/openclaw-control-ui-echarts`.
- It works without a browser plugin by generating a separate UI directory for `gateway.controlUi.root`.
- The generated custom Control UI root currently lives at `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\generated\control-ui`.
- The Control UI path now extracts `echarts` and `json5` from the tracked offline bundle at `D:\code\work\OpenClaw\openclaw\tools\openclaw-echarts-userscript\openclaw-echarts-renderer.user.js`, then writes them into the generated UI as same-origin static assets.
- The runtime source is now modularized into a generic fenced-block framework plus adapter registration and an `echarts` adapter so future blocks such as `file` can reuse the same scanning and action pipeline.
- The runtime now includes a `file` adapter that can turn fenced `file` blocks into compact download/file cards without touching OpenClaw source files.
- This change is required because OpenClaw serves the Control UI with `script-src 'self'`, so inline vendor injection is blocked by CSP.
- A one-time helper can also generate a root `docker-compose.override.yml` so later repo-root `docker compose up -d` runs automatically mount the custom UI into `/app/dist/control-ui`.
- The generated root `docker-compose.override.yml` also mounts `docs/reference/templates` into `/app/docs/reference/templates` to avoid workspace-template bootstrap failures in images missing those docs assets.
- The generated root `docker-compose.override.yml` now also mounts the agent workspace into `/app/dist/control-ui/workspace-downloads` so zero-intrusive `file` cards can trigger same-origin browser downloads.
- The earlier userscript implementation is still present as an alternative zero-intrusion path.
- `openclaw-echarts-renderer.user.js` is now the offline bundled version.
- The Control UI path is now self-contained and no longer requires a vendor cache or CDN access on the target host.
- Existing files under `src/`, `ui/`, `apps/`, and `extensions/` were not edited.
