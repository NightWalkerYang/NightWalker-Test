# Vendored Browser Builds

These files are stored locally so the final userscript can run without loading any browser-side CDN assets.

## Files

- `vendor/echarts.min.js`
  - version: `6.0.0`
  - source: `https://cdn.jsdelivr.net/npm/echarts@6.0.0/dist/echarts.min.js`
- `vendor/json5.min.js`
  - version: `2.2.3`
  - source: `https://cdn.jsdelivr.net/npm/json5@2.2.3/dist/index.min.js`

## Rebuild

After replacing vendor files, rebuild the installable userscript:

```bash
node tools/openclaw-echarts-userscript/build-offline-userscript.mjs
```
