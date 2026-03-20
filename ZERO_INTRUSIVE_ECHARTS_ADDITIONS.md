# Zero-Intrusive ECharts Additions

This feature was added without modifying any existing OpenClaw source files.

## Added Files

- `D:\code\work\OpenClaw\openclaw\tools\openclaw-echarts-userscript\openclaw-echarts-renderer.user.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-echarts-userscript\openclaw-echarts-renderer.cdn.user.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-echarts-userscript\openclaw-echarts-renderer.template.user.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-echarts-userscript\build-offline-userscript.mjs`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-echarts-userscript\README.md`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-echarts-userscript\VENDOR_NOTES.md`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-echarts-userscript\vendor\echarts.min.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-echarts-userscript\vendor\json5.min.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\openclaw-echarts-renderer.js`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\build-custom-control-ui.mjs`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\setup-direct-docker-compose-up.mjs`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\setup-direct-docker-compose-up.sh`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\README.md`
- `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\generated\.gitignore`
- `D:\code\work\OpenClaw\openclaw\docker-compose.override.yml`
- `D:\code\work\OpenClaw\openclaw\ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`

## Notes

- The current recommended implementation is the custom Control UI root generator under `tools/openclaw-control-ui-echarts`.
- It works without a browser plugin by generating a separate UI directory for `gateway.controlUi.root`.
- The generated custom Control UI root currently lives at `D:\code\work\OpenClaw\openclaw\tools\openclaw-control-ui-echarts\generated\control-ui`.
- A one-time helper can also generate a root `docker-compose.override.yml` so later repo-root `docker compose up -d` runs automatically mount the custom UI into `/app/dist/control-ui`.
- The earlier userscript implementation is still present as an alternative zero-intrusion path.
- `openclaw-echarts-renderer.user.js` is now the offline bundled version.
- The local vendor files are shared by both the userscript path and the custom Control UI root path.
- Existing files under `src/`, `ui/`, `apps/`, and `extensions/` were not edited.
