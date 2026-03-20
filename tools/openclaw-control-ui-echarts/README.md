# OpenClaw Control UI ECharts Overlay

This is the no-plugin, zero-intrusion version of the ECharts fenced-block renderer.

It does not modify any existing OpenClaw source files. Instead, it:

1. copies a built `dist/control-ui` directory
2. injects one additional runtime script into the copied `index.html`
3. extracts local `echarts` and `json5` files from the tracked offline bundle into that copied UI root
4. lets you point `gateway.controlUi.root` at the generated directory

## What It Adds

When the copied Control UI loads, the extra runtime script:

- detects fenced code blocks marked as `echarts`
- parses the block as JSON or JSON5
- renders an ECharts preview above the original source block
- keeps the original source block behind a `Show source` toggle

No browser plugin is required.

## Files

- `tools/openclaw-control-ui-echarts/build-custom-control-ui.mjs`
  - copies `dist/control-ui` into a separate custom UI root
  - injects the ECharts runtime script
  - writes `assets/vendor/echarts.min.js` and `assets/vendor/json5.min.js`
- `tools/openclaw-control-ui-echarts/openclaw-echarts-renderer.js`
  - CSP-safe runtime that loads same-origin vendor assets with `script.src`
- `tools/openclaw-echarts-userscript/openclaw-echarts-renderer.user.js`
  - tracked offline bundle used as the source of truth for extracting vendor assets

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

This matters because the gateway serves the Control UI with a CSP that allows `script-src 'self'` but blocks inline scripts. The generated overlay therefore avoids inline vendor injection and stays compatible with the gateway CSP.

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
4. mounts `docs/reference/templates` to `/app/docs/reference/templates` so agent workspace bootstrap files are available even when an image is missing those docs assets

Because the mount replaces the container's default Control UI asset directory, this path does not need `gateway.controlUi.root`.

The shell variant also works when the host has no `dist/control-ui` yet:

- if `dist/control-ui` exists on the host, it uses that
- otherwise it extracts `/app/dist/control-ui` from the local `openclaw-gateway` Docker image
- if that image does not exist yet, it builds `openclaw:local` from `Dockerfile` or pulls `OPENCLAW_IMAGE` when you set a non-default image
- the injected chart runtime stays CSP-safe by loading same-origin `assets/vendor/*.js` files extracted from the tracked offline bundle

After that, from the same repo root, this is enough:

```bash
docker compose up -d
```

Important:

- if you already have your own root `docker-compose.override.yml`, the setup script refuses to overwrite it
- rerun the setup script whenever you want to refresh the generated Control UI after UI changes
- this direct-override path is meant for repo-root Docker runs where the host path `./tools/openclaw-control-ui-echarts/generated/control-ui` is available
- on Docker-only hosts, prefer `bash tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.sh`

## Safety Limits

The renderer intentionally does not execute arbitrary JavaScript from chat output.

Supported:

- JSON
- JSON5
- common wrappers like `option = { ... }`

Intentionally unsupported:

- `formatter: function () { ... }`
- executable helper variables
- any other inline JavaScript logic

## Rebuild Flow

If the upstream Control UI changes:

1. rebuild `dist/control-ui`
2. rerun `node tools/openclaw-control-ui-echarts/build-custom-control-ui.mjs`

That regenerates the custom UI root without touching OpenClaw source files.
