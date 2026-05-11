# Control UI Fenced-Block Runtime Architecture

This directory now uses a two-layer design:

## 1. Framework Layer

Location:

- `tools/openclaw-control-ui-echarts/runtime/framework/`

Responsibilities:

- scan rendered chat HTML for fenced code blocks
- detect unfinished streaming fences and replace them with a loading card
- create the preview host card above the original source block
- manage source show/hide state
- render toolbar actions
- bridge action buttons into the chat composer

Framework files:

- `adapter-registry.js`
- `shared.js`
- `styles.js`
- `chat-composer.js`
- `fenced-block-runtime.js`

## 2. Adapter Layer

Locations:

- `tools/openclaw-control-ui-echarts/runtime/echarts/`
- `tools/openclaw-control-ui-echarts/runtime/file/`

Responsibilities:

- define supported language aliases
- load any adapter-specific runtime libraries
- parse the fenced payload
- render the preview
- build the follow-up prompt text
- handle element-click details
- provide adapter-specific styles

ECharts adapter files:

- `adapter.js`
- `libraries.js`
- `parser.js`
- `prompt.js`
- `detail-modal.js`
- `styles.js`
- `ui-text.js`

File adapter files:

- `adapter.js`
- `libraries.js`
- `parser.js`
- `styles.js`
- `ui-text.js`

## Adapter Contract

An adapter is expected to provide:

- `id`
- `uiText`
- `languageAliases`
- `getStyles()`
- `ensureReady()`
- `renderContent(...)`
- `disposeState(state)`

Optional hooks:

- `localizeSourceWrapper(wrapper)`
- `localizeErrorMessage(detail)`
- `onSourceToggle(state, nextState)`
- `onViewportResize(state)`

## 3. Route Surfaces

The runtime also mounts a few route-scoped surfaces on top of the native Control UI shell:

- `tools/openclaw-control-ui-echarts/runtime/echarts-view/`
- `tools/openclaw-control-ui-echarts/runtime/knowledge-graph/`
- `tools/openclaw-control-ui-echarts/runtime/lufeng/`
- `tools/openclaw-control-ui-echarts/runtime/tenant/`

These layers share route sync and content-area mounting, but each route keeps its own styles and cleanup rules.

## 4. Tenant Runtime Layering

The tenant runtime should follow the same split philosophy instead of growing a single large entrypoint.

Primary tenant runtime files today:

- `tools/openclaw-control-ui-echarts/runtime/tenant/entry.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/route-sync.js`
- `tools/openclaw-control-ui-echarts/runtime/framework/dom-compat.js`

Target layered responsibilities:

- state/context: shared route, session, selected-agent, and storage truth
- navigation/lifecycle: route change wiring and shared cleanup registration
- shell coordination: native Control UI shell takeover and synchronization
- view/page/surface: page-specific controller, render, and interaction logic

Governance rules:

1. `runtime/tenant/entry.js` is assembly-only and should keep public boot/reset exports stable.
   Allowed edits stay limited to import wiring, registry registration, boot sequencing of shared modules, and global lifecycle hookup.
2. New tenant pages or surfaces should be standalone modules registered through a registry path, not appended as page logic inside `entry.js`.
3. Native shell DOM access should reuse `runtime/framework/dom-compat.js` instead of duplicating selectors in tenant files.
4. Route/session/storage access should reuse shared tenant helpers such as `runtime/tenant/tenant-context.js` and `runtime/tenant/route-sync.js`.
5. Timers, observers, and event listeners should register cleanup centrally instead of being scattered across page branches.

See `tools/openclaw-control-ui-echarts/TENANT_RUNTIME_EXTENSION_GUIDE.md` for the operational extension rules.

## Current File Block Support

The runtime now supports blocks like:

````text
```file
{ "url": "..." }
```
````

Current behavior:

1. `https://...` and `http://...` payloads render as compact download cards
2. workspace-relative paths render as compact file cards with same-origin download actions when the deployment mounts `/workspace-downloads`
3. absolute paths are accepted only when they normalize under a `workspace/` segment
4. the card renderer stays inside the same framework lifecycle as `echarts`

Example:

```js
const runtime = createFencedBlockRuntime([
  createEchartsAdapter({ vendorBaseUrl }),
  createFileAdapter({ vendorBaseUrl }),
]);
```

## Why This Split

The previous single-file runtime was fast to ship but too large to maintain.

This split keeps:

- zero-intrusion deployment
- same-origin CSP-safe loading
- current echarts behavior

while making the runtime reusable for other fenced-block previews later.
