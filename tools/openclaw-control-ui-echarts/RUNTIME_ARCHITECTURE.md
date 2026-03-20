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

Location:

- `tools/openclaw-control-ui-echarts/runtime/echarts/`

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

## Planned Path For Future Blocks

For a future block like:

````text
```file
{ "url": "..." }
```
````

the recommended shape is:

1. create `tools/openclaw-control-ui-echarts/runtime/file/`
2. add a `file` adapter with its own parser / preview / prompt builder
3. register it beside `echarts`
4. keep using the same framework for scanning, streaming placeholders, toolbar buttons, and chat sending

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
