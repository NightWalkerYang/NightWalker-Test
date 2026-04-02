# Zero-Intrusive Control UI Additions

These additions were implemented without editing existing OpenClaw source files under `src/`, `ui/`, `apps/`, or `extensions/`.

This file is the inventory for the zero-intrusive layer. When a new zero-intrusive file is added, this file should be updated in the same change.

## Tracked Source Files

### Root-Level Planning Docs

- `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
- `ZERO_INTRUSIVE_TENANT_SYSTEM_PLAN.md`
- `ZERO_INTRUSIVE_KNOWLEDGE_GRAPH_TENANT_PLAN.md`

### Userscript Bundle

- `tools/openclaw-echarts-userscript/openclaw-echarts-renderer.user.js`
- `tools/openclaw-echarts-userscript/openclaw-echarts-renderer.cdn.user.js`
- `tools/openclaw-echarts-userscript/openclaw-echarts-renderer.template.user.js`
- `tools/openclaw-echarts-userscript/build-offline-userscript.mjs`
- `tools/openclaw-echarts-userscript/README.md`
- `tools/openclaw-echarts-userscript/VENDOR_NOTES.md`

### Control UI Overlay Core

- `tools/openclaw-control-ui-echarts/openclaw-echarts-renderer.js`
- `tools/openclaw-control-ui-echarts/build-custom-control-ui.mjs`
- `tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.mjs`
- `tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.sh`
- `tools/openclaw-control-ui-echarts/README.md`
- `tools/openclaw-control-ui-echarts/RUNTIME_ARCHITECTURE.md`
- `tools/openclaw-control-ui-echarts/generated/.gitignore`

### Runtime: Background

- `tools/openclaw-control-ui-echarts/runtime/background/chat-ambient.js`

### Runtime: Branding

- `tools/openclaw-control-ui-echarts/runtime/branding/auto-token.js`
- `tools/openclaw-control-ui-echarts/runtime/branding/brand-replacer.js`
- `tools/openclaw-control-ui-echarts/runtime/branding/favicon.js`

### Runtime: ECharts

- `tools/openclaw-control-ui-echarts/runtime/echarts/adapter.js`
- `tools/openclaw-control-ui-echarts/runtime/echarts/detail-modal.js`
- `tools/openclaw-control-ui-echarts/runtime/echarts/libraries.js`
- `tools/openclaw-control-ui-echarts/runtime/echarts/parser.js`
- `tools/openclaw-control-ui-echarts/runtime/echarts/prompt.js`
- `tools/openclaw-control-ui-echarts/runtime/echarts/styles.js`
- `tools/openclaw-control-ui-echarts/runtime/echarts/ui-text.js`

### Runtime: File Cards

- `tools/openclaw-control-ui-echarts/runtime/file/adapter.js`
- `tools/openclaw-control-ui-echarts/runtime/file/libraries.js`
- `tools/openclaw-control-ui-echarts/runtime/file/parser.js`
- `tools/openclaw-control-ui-echarts/runtime/file/styles.js`
- `tools/openclaw-control-ui-echarts/runtime/file/ui-text.js`

### Runtime: Framework

- `tools/openclaw-control-ui-echarts/runtime/framework/adapter-registry.js`
- `tools/openclaw-control-ui-echarts/runtime/framework/chat-composer.js`
- `tools/openclaw-control-ui-echarts/runtime/framework/fenced-block-runtime.js`
- `tools/openclaw-control-ui-echarts/runtime/framework/shared.js`
- `tools/openclaw-control-ui-echarts/runtime/framework/styles.js`
- `tools/openclaw-control-ui-echarts/runtime/framework/tool-run-cluster.js`
- `tools/openclaw-control-ui-echarts/runtime/framework/voice-input.js`

### Runtime: Knowledge Graph

- `tools/openclaw-control-ui-echarts/runtime/knowledge-graph/entry.js`
- `tools/openclaw-control-ui-echarts/runtime/knowledge-graph/page.css`
- `tools/openclaw-control-ui-echarts/runtime/knowledge-graph/page.js`

### Runtime: Tenant

- `tools/openclaw-control-ui-echarts/runtime/tenant/entry.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/api-client.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/auth-surface.css`
- `tools/openclaw-control-ui-echarts/runtime/tenant/auth-surface.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/auth-layout.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/page.css`
- `tools/openclaw-control-ui-echarts/runtime/tenant/login-page.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-login-page.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-page.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/admin-page.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/agent-selector-page.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/chat-shell.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/chat-page.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/wallet-page.js`

### Sidecar: Tenant Platform

- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/config.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/auth.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/db.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/routes.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/server.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/migrations/001_init.sql`

### Static Pages

- `tools/openclaw-control-ui-echarts/static/knowledge-graph.html`
- `tools/openclaw-control-ui-echarts/static/platform-login.html`
- `tools/openclaw-control-ui-echarts/static/tenant-login.html`
- `tools/openclaw-control-ui-echarts/static/platform-tenant-console.html`
- `tools/openclaw-control-ui-echarts/static/tenant-admin.html`
- `tools/openclaw-control-ui-echarts/static/tenant-agent-selector.html`
- `tools/openclaw-control-ui-echarts/static/tenant-chat.html`
- `tools/openclaw-control-ui-echarts/static/tenant-wallet.html`

### Tests

- `test/tools/openclaw-control-ui-echarts/adapter-registry.test.ts`
- `test/tools/openclaw-control-ui-echarts/auto-token-bootstrap.test.ts`
- `test/tools/openclaw-control-ui-echarts/brand-replacer.test.ts`
- `test/tools/openclaw-control-ui-echarts/chat-ambient.test.ts`
- `test/tools/openclaw-control-ui-echarts/echarts-parser.test.ts`
- `test/tools/openclaw-control-ui-echarts/echarts-styles.test.ts`
- `test/tools/openclaw-control-ui-echarts/fenced-block-runtime.test.ts`
- `test/tools/openclaw-control-ui-echarts/file-adapter.test.ts`
- `test/tools/openclaw-control-ui-echarts/file-parser.test.ts`
- `test/tools/openclaw-control-ui-echarts/framework-styles.test.ts`
- `test/tools/openclaw-control-ui-echarts/knowledge-graph-entry.test.ts`
- `test/tools/openclaw-control-ui-echarts/knowledge-graph-page.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-auth-layout.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-auth-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-entry.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts`
- `test/tools/openclaw-control-ui-echarts/tool-run-cluster.test.ts`
- `test/tools/openclaw-control-ui-echarts/voice-input.test.ts`

## Generated Or Runtime-Only Artifacts

These are part of the zero-intrusive deployment flow, but they are generated at runtime and are not tracked in Git:

- `tools/openclaw-control-ui-echarts/generated/control-ui/`
- `docker-compose.override.yml`

## Current Capabilities

- Fenced `echarts` blocks render as inline chart cards with a detail modal.
- Fenced `file` blocks render as compact download cards.
- Workspace file paths can download through same-origin `workspace-downloads` mounts.
- Shared runtime styles load at boot instead of waiting for a fenced block to appear.
- Chat page visuals are customized through the injected framework styles layer.
- The chat background uses an injected animated ambient layer.
- Tool-call and tool-output sequences from the same turn are clustered and collapsible.
- Voice input is bridged through a zero-intrusive runtime layer with visible state and error feedback.
- Branding is customized through fixed brand slots, text logos, favicon replacement, and auto-token bootstrap.
- The knowledge graph page is provided as a separate static page with a Control UI entry link.
- A tenant platform sidecar can provide zero-intrusive login, tenant bootstrap, membership, and Agent-assignment APIs.
- Platform admin login and tenant login now prefer the native Control UI single-entry route with `?ocTenantView=...`.
- Platform console, tenant admin, Agent selector, chat shell, and wallet pages currently use separate static pages.
- Legacy standalone tenant/platform login pages remain only as compatibility wrappers while the login flow converges on the native single entry.

## Important Notes

- The recommended deployment path is the custom Control UI root generator under `tools/openclaw-control-ui-echarts`.
- The generated UI remains CSP-compatible by loading same-origin assets only.
- The shell setup path can rebuild from a Docker image even when host `dist/control-ui` is missing.
- The root setup flow can optionally mount extra host paths with `OPENCLAW_EXTRA_MOUNTS`.
- The current branding layer should only target fixed brand slots; it should not rewrite arbitrary chat content.
- Existing files under `src/`, `ui/`, `apps/`, and `extensions/` were not edited for these additions.

## Maintenance Rule

Whenever a new zero-intrusive file is added under any of these areas, update this document in the same change:

- `tools/openclaw-control-ui-echarts/**`
- `tools/openclaw-echarts-userscript/**`
- `test/tools/openclaw-control-ui-echarts/**`
