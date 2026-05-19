# OpenClaw Desktop Shell Template

This is an optional desktop shell for the zero-intrusive local runtime package.

It is intentionally thin:

- the existing local runtime still owns Gateway startup, tenant sidecar startup, Control UI preflight, token sync, and workspace download links
- the desktop shell waits for the loopback Gateway and then loads the normal Control UI URL
- the shell does not fork or modify OpenClaw core, native Control UI source, or tenant runtime source

## Build Flow

Stage a local runtime package with the desktop shell:

```bash
node tools/openclaw-control-ui-echarts/package-local-runtime.mjs --with-desktop-shell
```

The output directory will include:

- `desktop/`
- `start-desktop-shell.cmd`
- `start-desktop-shell.sh`

From the generated package, install the desktop shell dependencies and run the dev shell:

```bash
cd desktop
npm install
npm run tauri:dev
```

For production installers, run:

```bash
npm run tauri:build
```

The packaged application starts `../scripts/start-local-runtime.mjs` through the desktop runtime helper and points the Tauri window at `http://127.0.0.1:<OPENCLAW_GATEWAY_PORT>`.

## Runtime Contract

The desktop helper expects this layout from `package-local-runtime.mjs`:

- `../scripts/start-local-runtime.mjs`
- `../runtime.env`
- `../runtime/node_modules/openclaw/dist/control-ui/index.html`

It performs a lightweight readiness check against:

- Gateway: `/healthz`
- tenant sidecar: `http://127.0.0.1:<OPENCLAW_TENANT_PLATFORM_PORT>/tenant-platform-api/v1/healthz`

The browser window uses loopback HTTP instead of `file://` so WebSocket auth, same-origin tenant API calls, service worker behavior, and workspace download URLs stay aligned with the existing Control UI runtime.

The bootstrap page writes the tenant API override into its local WebView storage before navigating to the Control UI, so the tenant runtime talks to the packaged sidecar on `127.0.0.1:<OPENCLAW_TENANT_PLATFORM_PORT>` without requiring a gateway-core proxy change.

## Why Tauri

Tauri keeps the shell smaller than an Electron app and can manage sidecar-style local processes. The implementation here keeps Tauri as a template dependency under `desktop/` so the OpenClaw root package and official source tree do not gain desktop build dependencies.

## Dual Mode

The desktop shell supports two connection modes, selected on first launch:

### Connected Mode (连接云端)

- Gateway model calls are routed through the cloud platform for token billing
- User authenticates via the cloud auth service (Control UI login page)
- Purchased Agents and Skills are synced from ClawHub
- Default cloud endpoint: `https://hailstone.cn:18789/`
- The endpoint is configurable and persisted in `desktop-config.json`

### Standalone Mode (企业独立部署)

- Gateway uses locally configured model providers (from `openclaw.json`)
- Authentication via local License file
- No cloud dependency
- This is the original behavior before dual-mode support

### Mode Persistence

The selected mode is saved to `desktop-config.json` in the Tauri app data directory (Windows: `%APPDATA%/ai.openclaw.zero-intrusive-desktop/`). On subsequent launches the app skips the mode selector and boots directly into the saved mode.

A "切换模式" link on the boot status screen allows returning to the mode selector.

### Technical Detail

The mode difference is implemented via the `OPENCLAW_MODEL_PROXY_ENDPOINT` environment variable in `runtime.env`:

- Connected mode: set to the cloud endpoint URL
- Standalone mode: not set (Gateway uses local provider config)
