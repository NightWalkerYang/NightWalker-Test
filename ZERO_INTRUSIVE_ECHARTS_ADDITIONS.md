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
- `tools/openclaw-control-ui-echarts/package-local-runtime.mjs`
- `tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.mjs`
- `tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.sh`
- `tools/openclaw-control-ui-echarts/README.md`
- `tools/openclaw-control-ui-echarts/RUNTIME_ARCHITECTURE.md`
- `tools/openclaw-control-ui-echarts/generated/.gitignore`

### Local Runtime Packaging

- `tools/openclaw-control-ui-echarts/local-runtime/CUSTOMER_DEPLOYMENT_GUIDE.md`
- `tools/openclaw-control-ui-echarts/local-runtime/README.md`
- `tools/openclaw-control-ui-echarts/local-runtime/openclaw.local.example.json5`
- `tools/openclaw-control-ui-echarts/local-runtime/runtime-common.mjs`
- `tools/openclaw-control-ui-echarts/local-runtime/runtime.env.example`
- `tools/openclaw-control-ui-echarts/local-runtime/start-gateway.mjs`
- `tools/openclaw-control-ui-echarts/local-runtime/start-local-runtime.mjs`
- `tools/openclaw-control-ui-echarts/local-runtime/start-tenant-platform.mjs`

### Runtime: Background

- `tools/openclaw-control-ui-echarts/runtime/background/chat-ambient.js`

### Runtime: Branding

- `tools/openclaw-control-ui-echarts/runtime/branding/auto-token.js`
- `tools/openclaw-control-ui-echarts/runtime/branding/auto-token-preboot.js`
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

### Runtime: Lufeng Public Route

- `tools/openclaw-control-ui-echarts/runtime/lufeng/bootstrap.js`
- `tools/openclaw-control-ui-echarts/runtime/lufeng/context.js`
- `tools/openclaw-control-ui-echarts/runtime/lufeng/preboot.js`
- `tools/openclaw-control-ui-echarts/runtime/lufeng/surface.css`
- `tools/openclaw-control-ui-echarts/runtime/lufeng/surface.js`

### Runtime: Tenant

- `tools/openclaw-control-ui-echarts/runtime/tenant/entry.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-access-guard.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/api-client.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/auth-surface.css`
- `tools/openclaw-control-ui-echarts/runtime/tenant/auth-surface.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/topbar-meta.css`
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-surface.css`
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-surface.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-surface.css`
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-surface.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/member-surface.css`
- `tools/openclaw-control-ui-echarts/runtime/tenant/member-surface.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-surface.css`
- `tools/openclaw-control-ui-echarts/runtime/tenant/auth-layout.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/page.css`
- `tools/openclaw-control-ui-echarts/runtime/tenant/login-page.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-login-page.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-page.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-page.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/member-console-page.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-surface.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/route-sync.js`

### Sidecar: Tenant Platform

- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/config.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/auth.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/db.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/license.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/routes.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/server.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/migrations/001_init.sql`

### Static Pages

- `tools/openclaw-control-ui-echarts/static/knowledge-graph.html`

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
- `test/tools/openclaw-control-ui-echarts/lufeng-bootstrap.test.ts`
- `test/tools/openclaw-control-ui-echarts/lufeng-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/local-runtime-common.test.ts`
- `test/tools/openclaw-control-ui-echarts/member-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/member-chat-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/package-local-runtime.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-auth-layout.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-auth-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-entry.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/platform-access-guard.test.ts`
- `test/tools/openclaw-control-ui-echarts/platform-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-license.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-local-edition.test.ts`
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
- Fenced-block adapters now warm their local libraries at boot and rescan only changed DOM roots, reducing the post-refresh delay before `echarts` and `file` cards appear.
- Chat page visuals are customized through the injected framework styles layer.
- The chat background uses an injected animated ambient layer.
- Tool-call and tool-output sequences from the same turn are clustered and collapsible.
- Voice input is bridged through a zero-intrusive runtime layer with visible state and error feedback.
- Branding is customized through fixed brand slots, text logos, favicon replacement, and auto-token bootstrap.
- CSP-sensitive preboot behavior now uses same-origin external scripts instead of inline bootstrap blocks.
- The knowledge graph page is provided as a separate static page with a Control UI entry link.
- A tenant platform sidecar can provide zero-intrusive login, tenant bootstrap, membership, and Agent-assignment APIs.
- The tenant platform sidecar now supports a local-edition license file, signature verification, renewal-code application, and read-only enforcement after expiry.
- Platform admin login and tenant login now use the native Control UI single-entry route with `?ocTenantView=...`.
- The native Control UI root now requires a platform-admin tenant session and redirects unauthenticated users to the platform login view.
- The native Control UI sidebar now injects a peer `管理` group at the top with tenant-management and Agent-assignment shortcuts.
- Platform management now renders inside the native Control UI content area through single-entry query views instead of jumping to the legacy standalone platform page.
- Tenant-admin management now renders inside the native Control UI content area through single-entry query views instead of using a standalone tenant admin page.
- Tenant-member login now also lands inside the native Control UI shell, with only the injected `Agent` dropdown and an embedded `Agent选择` card view for assigned Agents.
- Tenant members now click assigned Agent cards into the native `/chat` page, where a zero-intrusive sidebar adds `新建会话`, a per-Agent session list, and front-end-only session hiding with a reusable confirm dialog matching the standard topbar modal style, while `Agent选择` moves into the native top breadcrumb area and the native chat content and features remain intact.
- Tenant members now get a short `已经是新的会话了` toast instead of generating another unsent draft session when they click `新建会话` while already in a brand-new draft chat.
- Platform-admin identity and logout status now occupy the native topbar search slot globally across the root control UI.
- Tenant-admin and tenant-member identity and logout status now occupy that same native topbar search slot on their native control-shell views, and role-scoped CSS plus runtime markers force their sidebar/footer down to only the injected management or Agent entry plus the version block.
- Tenant platform entry now rescans late-rendered native shell nodes so topbar and sidebar role-trimming still applies after Control UI rerenders.
- Tenant-admin shell trimming now keeps only the `管理` dropdown and the version block, while local-edition tenant API calls retry bootstrap and fall back across loopback/base-url candidates to avoid transient `Failed to fetch` startup errors.
- Tenant-admin shell now also sets a role-scoped root attribute and uses injected CSS to force-hide all native sidebar sections outside the injected `管理` group, avoiding native shell rerender leaks.
- Tenant platform routes now follow native history changes so management shortcuts switch without full-page reload and unmount correctly when leaving the management view.
- The native Control UI now supports a public `/lufeng` finance-chat route that reuses the native control shell, skips login, pins the dedicated finance agent to an isolated `lufeng` session, trims the sidebar down to the native chat section only, hides assistant avatars (including branded `SPTC` logo avatars), and locks the model/session controls.
- A non-Docker local runtime package can now be staged with prebuilt gateway assets, the tenant sidecar, launch scripts, runtime env templates, and local-license bootstrap wiring.
- The non-Docker local runtime package now includes a customer-facing deployment guide alongside the operator/runtime templates.
- The non-Docker local runtime templates now include a practical `runtime.env` and `openclaw.json` starter shape with provider-key placeholders and a minimal default model setup.
- The non-Docker local runtime packager now vendors missing runtime-only packages, patches `file-type/core.js` compatibility inside the packaged runtime, and seeds a default `loopback` gateway bind so the packaged local edition boots without extra Control UI origin setup.
- The non-Docker local runtime package now seeds an active `runtime.env` plus `data/.openclaw/openclaw.json` into the output, trims the starter config so it no longer emits missing-`OPENAI_API_KEY` warnings by default, and recreates the config from the bundled template if a customer deletes it.
- Local edition bootstrap now bypasses platform-admin setup entirely: the first local login initializes a single local tenant admin, members continue to use the tenant login entry, and native root access redirects to the tenant flow instead of the platform-admin flow.

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
