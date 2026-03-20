# OpenClaw ECharts Userscript

This is a zero-intrusion add-on for the OpenClaw web control UI.

It does not change any existing OpenClaw source files. Instead, it uses a browser userscript to:

- detect fenced code blocks marked as `echarts`
- parse the block as JSON, JSON5, or a trusted JavaScript object literal
- render a live ECharts preview above the original source block
- keep the original source block available behind a `Show source` toggle

## Main Files

- `tools/openclaw-echarts-userscript/openclaw-echarts-renderer.user.js`
  - install this one
  - this is the offline bundled userscript
- `tools/openclaw-echarts-userscript/openclaw-echarts-renderer.cdn.user.js`
  - old CDN-loading fallback
- `tools/openclaw-echarts-userscript/openclaw-echarts-renderer.template.user.js`
  - source template for rebuilding the offline bundle
- `tools/openclaw-echarts-userscript/build-offline-userscript.mjs`
  - rebuilds the offline bundled userscript from local vendor files

## Installation

1. Install a userscript manager such as Tampermonkey or Violentmonkey.
2. Create a new userscript.
3. Paste the contents of `tools/openclaw-echarts-userscript/openclaw-echarts-renderer.user.js`.
4. Save the userscript.
5. Open the OpenClaw web control UI and send a message that contains an `echarts` fenced code block.

## Runtime Network Behavior

The main file `openclaw-echarts-renderer.user.js` is offline and self-contained at runtime.

It does not load ECharts or JSON5 from a CDN in the browser.

The only time network access is involved is when you intentionally refresh the vendored files yourself and rebuild the userscript.

## Supported Syntax

Strict JSON:

```echarts
{
  "title": { "text": "Weekly Sales" },
  "tooltip": {},
  "xAxis": {
    "type": "category",
    "data": ["Mon", "Tue", "Wed", "Thu", "Fri"]
  },
  "yAxis": { "type": "value" },
  "series": [
    {
      "type": "bar",
      "data": [120, 200, 150, 80, 70]
    }
  ]
}
```

JSON5-style object literals are also supported:

```echarts
{
  title: { text: "Visitors" },
  tooltip: {},
  xAxis: { type: "category", data: ["A", "B", "C"] },
  yAxis: { type: "value" },
  series: [{ type: "line", data: [3, 5, 2] }],
}
```

It also accepts common wrappers like:

```echarts
option = {
  title: { text: "Wrapped option" },
  xAxis: { type: "category", data: ["A", "B"] },
  yAxis: { type: "value" },
  series: [{ type: "bar", data: [1, 2] }]
}
```

Trusted JavaScript-style ECharts option bodies are also supported, including:

- omitted outer braces at the top level
- `formatter: function (...) { ... }`
- `new echarts.graphic.LinearGradient(...)`

## Deliberate Safety Limits

The userscript can evaluate trusted ECharts object literals so common examples keep working, but it still blocks obvious browser/global side effects.

That means these constructs are intentionally unsupported:

- `window`, `document`, `globalThis`
- `fetch(...)`, `XMLHttpRequest`, `WebSocket`, `EventSource`
- `localStorage`, `sessionStorage`, `indexedDB`
- `import(...)`, `eval(...)`, `Function(...)`

The fallback is intended for self-hosted dashboards where you trust the chart block source.

## Local Vendor Files

The offline bundle is built from:

- `tools/openclaw-echarts-userscript/vendor/echarts.min.js`
- `tools/openclaw-echarts-userscript/vendor/json5.min.js`

See `tools/openclaw-echarts-userscript/VENDOR_NOTES.md`.

## Rebuild

If you update the local vendor files, rebuild the offline userscript with:

```bash
node tools/openclaw-echarts-userscript/build-offline-userscript.mjs
```

## Host Matching

The default userscript matches:

- `http://127.0.0.1:*/*`
- `http://localhost:*/*`
- `http://0.0.0.0:*/*`

If your OpenClaw dashboard is served from another host, add another `@match` rule in the userscript header.
