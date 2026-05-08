# OpenClaw Control UI ECharts Overlay

This is the no-plugin, zero-intrusion fenced-block overlay for the OpenClaw Control UI.

It does not modify any existing OpenClaw source files. Instead, it:

1. copies a built `dist/control-ui` directory
2. injects one additional runtime script into the copied `index.html`
3. copies a modular fenced-block runtime into that copied UI root
4. extracts local `echarts` and `json5` files from the tracked offline bundle into that copied UI root
5. lets you point `gateway.controlUi.root` at the generated directory

## What It Adds

When the copied Control UI loads, the extra runtime script:

- detects fenced code blocks marked as `echarts`
- parses the block as JSON, JSON5, or a trusted JavaScript object literal
- renders an ECharts preview above the original source block
- detects fenced code blocks marked as `file`
- turns file URLs into compact download cards
- turns workspace paths into compact file cards with normalized copyable paths

No browser plugin is required.

## Files

- `tools/openclaw-control-ui-echarts/build-custom-control-ui.mjs`
  - copies `dist/control-ui` into a separate custom UI root
  - injects the ECharts runtime script
  - writes the zero-intrusive runtime under a fingerprinted asset root `assets/openclaw-echarts/<fingerprint>/`
  - injects `/echarts-view` / `tenant preboot` / `auto-token` / `lufeng` bootstraps to that same fingerprinted runtime root
  - keeps `assets/vendor/echarts.min.js` / `assets/vendor/json5.min.js` and `assets/runtime/echarts/*.js` as compatibility fallbacks for older cached bundles
- `tools/openclaw-control-ui-echarts/openclaw-echarts-renderer.js`
  - module entrypoint that boots the fenced-block runtime
- `tools/openclaw-control-ui-echarts/runtime/framework/*`
  - generic fenced-block scanning, adapter registration, host rendering, source toggle, streaming placeholder, and chat-composer bridge
- `tools/openclaw-control-ui-echarts/runtime/echarts/*`
  - the ECharts-specific adapter, parser, prompt builder, styles, and detail modal
- `tools/openclaw-control-ui-echarts/runtime/file/*`
  - the file-card adapter, parser, compact card styles, and JSON5 loader
- `tools/openclaw-echarts-userscript/openclaw-echarts-renderer.user.js`
  - tracked offline bundle used as the source of truth for extracting vendor assets

## Runtime Architecture

The runtime is split into:

1. a generic fenced-block framework
2. one `echarts` adapter
3. one `file` adapter

That means additional blocks such as:

````text
```file
{ "url": "..." }
```
````

reuse the same framework pieces:

- DOM scanning
- adapter registration
- loading-card replacement during streaming
- source toggle behavior
- action buttons
- chat-box insertion / direct send bridge

and only add a new adapter for:

- language aliases
- parsing
- preview rendering
- prompt building
- click behavior

The current registration shape is:

```js
const runtime = createFencedBlockRuntime([
  createEchartsAdapter({ vendorBaseUrl }),
  createFileAdapter({ vendorBaseUrl }),
]);
```

See `tools/openclaw-control-ui-echarts/RUNTIME_ARCHITECTURE.md`.

## Build The Base UI

First make sure the normal Control UI assets exist:

```bash
pnpm ui:build
```

If `dist/control-ui` already exists, you can skip that step.

## Generate The Custom UI Root

Run:

```bash
node tools/openclaw-control-ui-echarts/build-custom-control-ui.mjs
```

Default output:

- `tools/openclaw-control-ui-echarts/generated/control-ui`

You can also choose your own paths:

```bash
node tools/openclaw-control-ui-echarts/build-custom-control-ui.mjs --source dist/control-ui --output tools/openclaw-control-ui-echarts/generated/control-ui
```

Relative paths are resolved from the repo root.

The builder extracts `echarts` and `json5` from the tracked offline bundle at `tools/openclaw-echarts-userscript/openclaw-echarts-renderer.user.js`, then writes them into the generated Control UI as same-origin static assets.

The zero-intrusive runtime asset paths are content-fingerprinted (derived from renderer + runtime + vendor contents), for example:

- `assets/openclaw-echarts/<fingerprint>/openclaw-echarts-renderer.js`
- `assets/openclaw-echarts/<fingerprint>/runtime/**`
- `assets/openclaw-echarts/<fingerprint>/vendor/**`

This avoids stale Service Worker cache-first hits on fixed `/assets/` paths after redeploys, while keeping legacy compatibility assets for older clients.

This matters because the gateway serves the Control UI with a CSP that allows `script-src 'self'` but blocks inline scripts. The generated overlay therefore avoids inline vendor injection and stays compatible with the gateway CSP.

The generated UI also writes a dedicated static `/echarts-view/` entry page for public visualization sharing, while the root Control UI still injects the public-route preboot scripts for `/echarts-view`, `/lufeng`, and the auto-token path so legacy shell entry points keep working before the native app bootstrap runs.

## Configure OpenClaw

Point `gateway.controlUi.root` at the generated directory.

Example config:

```json5
{
  gateway: {
    controlUi: {
      root: "/path/to/openclaw/tools/openclaw-control-ui-echarts/generated/control-ui",
    },
  },
}
```

## Docker Deployment

If OpenClaw runs in Docker, mount the generated directory into the container and point `gateway.controlUi.root` at the container path.

Example shape:

```yaml
volumes:
  - ./tools/openclaw-control-ui-echarts/generated/control-ui:/custom-control-ui:ro
```

Then inside OpenClaw config:

```json5
{
  gateway: {
    controlUi: {
      root: "/custom-control-ui",
    },
  },
}
```

## Direct `docker compose up`

If you want plain `docker compose up -d` from the repo root to work without extra `-f` flags, use:

```bash
node tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.mjs
```

If the server does not have host `node`, use:

```bash
bash tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.sh
```

That script:

1. rebuilds `tools/openclaw-control-ui-echarts/generated/control-ui`
2. writes a root-level `docker-compose.override.yml`
3. mounts the generated UI directly to `/app/dist/control-ui` inside `openclaw-gateway`
4. mounts `${OPENCLAW_WORKSPACE_DIR}` read-only into `/app/dist/control-ui/workspace-downloads` so fenced `file` cards can download workspace files through the same origin
5. mounts `${OPENCLAW_CONFIG_DIR}/workspace-agents` read-only into `/app/dist/control-ui/workspace-agent-downloads` so refreshed public visualization pages can still load their rewritten same-origin JS/CSS assets
6. mounts `docs/reference/templates` to `/app/docs/reference/templates` so agent workspace bootstrap files are available even when an image is missing those docs assets
7. optionally mounts extra host paths from `OPENCLAW_EXTRA_MOUNTS`
8. runs `docker compose up -d --force-recreate openclaw-gateway openclaw-tenant-platform openclaw-gateway-proxy` so the new bind mounts are actually applied instead of leaving the old gateway/proxy containers running

Because the mount replaces the container's default Control UI asset directory, this path does not need `gateway.controlUi.root`.

The shell variant also works when the host has no `dist/control-ui` yet:

- if `dist/control-ui` exists on the host and `dist/.buildstamp` matches the current `git HEAD`, it uses that and skips a gateway image rebuild
- otherwise it first rebuilds `openclaw-gateway`, then extracts `/app/dist/control-ui` from that current image
- if that image does not exist yet, it builds `openclaw:local` from `Dockerfile` or pulls `OPENCLAW_IMAGE` when you set a non-default image
- when the shell has to run the builder inside Docker, it also passes the target machine's `OPENCLAW_GATEWAY_TOKEN` plus `OPENCLAW_CONFIG_DIR` into the container so tokenized bootstrap injection still matches the target host
- the injected chart runtime stays CSP-safe by loading same-origin `assets/vendor/*.js` files extracted from the tracked offline bundle

If you only want to refresh generated files and `docker-compose.override.yml` without restarting the related containers, set:

```bash
OPENCLAW_SKIP_COMPOSE_UP=1
```

Without that flag, the setup script already applies the targeted `docker compose up`.

If you want files committed under the repo, such as `excel_Test`, to appear inside the agent workspace, add this to `.env` before rerunning the setup script:

```bash
OPENCLAW_EXTRA_MOUNTS=./excel_Test:/home/node/.openclaw/workspace/excel_Test:ro
```

The setup script will copy that bind mount into the generated `docker-compose.override.yml` for both `openclaw-gateway` and `openclaw-cli`.

Important:

- if you already have your own root `docker-compose.override.yml`, the setup script refuses to overwrite it
- rerun the setup script whenever you want to refresh the generated Control UI after UI changes
- this direct-override path is meant for repo-root Docker runs where the host path `./tools/openclaw-control-ui-echarts/generated/control-ui` is available
- on Docker-only hosts, prefer `bash tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.sh`

## Non-Docker Local Runtime Package

If a customer machine cannot install Docker, you can stage a prebuilt local runtime package instead of shipping the repo.

Run:

```bash
node tools/openclaw-control-ui-echarts/package-local-runtime.mjs
```

Default output:

- `tools/openclaw-control-ui-echarts/generated/local-runtime`

This packaging path:

1. makes sure `dist/control-ui` exists and runs `pnpm ui:build` automatically when it is missing
2. rebuilds the zero-intrusive Control UI overlay
3. creates an npm tarball for the current OpenClaw version
4. installs that tarball into a local `runtime/` directory under the output package
5. overlays the generated Control UI and tenant sidecar onto that runtime
6. writes local launchers, env templates, and data-directory skeletons

The staged package includes:

- a preinstalled OpenClaw runtime under `runtime/`
- tenant sidecar code under the packaged runtime tree
- `runtime.env.example`
- `openclaw.local.example.json5` (portable baseline config, not a full state export)
- `start-gateway`
- `start-tenant-platform`
- `start-local-runtime`

The local runtime scripts automatically:

- force the tenant platform into `local` edition mode
- update the shared gateway token used by the zero-intrusive bootstrap scripts
- point `workspace-downloads` at the local workspace directory
- point `workspace-agent-downloads` at the local `workspace-agents` directory

The direct-docker setup helper also syncs the portable baseline config into the mounted `openclaw.json` first, then applies the generated Control UI root override separately so runtime state stays intact.

This path is intended for the local authorized edition:

- no online payment flow
- local license file / renewal-code control
- customer-managed model API keys or coding plans
- customer machine only runs the package and does not build from source

## Safety Limits

The renderer intentionally does not execute arbitrary JavaScript from chat output.

Supported:

- JSON
- JSON5
- common wrappers like `option = { ... }`
- trusted JavaScript object literals used by common ECharts examples
- formatter functions and `new echarts.graphic.*` expressions

Intentionally unsupported:

- browser/global side effects such as `window`, `document`, `fetch`, `XMLHttpRequest`, or `import()`
- arbitrary page scripting outside the option literal shape

The JavaScript fallback is meant for self-hosted dashboards where you trust the chart block source. It exists specifically so Dify-style ECharts snippets can render without rewriting them into strict JSON first.

For `file` blocks:

- `https://...` and `http://...` values render as real download cards
- workspace-relative paths such as `output/report.xlsx` render as compact file cards
- absolute paths are accepted only when they clearly resolve under a `workspace/` segment, then normalized to workspace-relative paths before display
- arbitrary host paths outside the workspace are intentionally rejected
- when you deploy through `setup-direct-docker-compose-up.*`, workspace-path cards download through the same origin under `/workspace-downloads/...`
- this deployment path exposes the mounted workspace to anyone who can reach the Control UI and guess the file path, so prefer keeping generated downloads in a dedicated workspace subdirectory when possible

## Rebuild Flow

If the upstream Control UI changes:

1. rebuild `dist/control-ui`
2. rerun `node tools/openclaw-control-ui-echarts/build-custom-control-ui.mjs`

That regenerates the custom UI root without touching OpenClaw source files.
