# Zero-Intrusive Control UI Additions

These additions were implemented without editing existing OpenClaw source files under `src/`, `ui/`, `apps/`, or `extensions/`.

This file is the inventory for the zero-intrusive layer. When a new zero-intrusive file is added, this file should be updated in the same change.

## Tracked Source Files

### Root-Level Planning Docs

- `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
- `ZERO_INTRUSIVE_3D_VISUALIZATION_RUNTIME_SPEC.md`
- `ZERO_INTRUSIVE_TENANT_SYSTEM_PLAN.md`
- `ZERO_INTRUSIVE_KNOWLEDGE_GRAPH_TENANT_PLAN.md`

### Userscript Bundle

- `tools/openclaw-echarts-userscript/openclaw-echarts-renderer.user.js`
- `tools/openclaw-echarts-userscript/openclaw-echarts-renderer.cdn.user.js`
- `tools/openclaw-echarts-userscript/openclaw-echarts-renderer.template.user.js`
- `tools/openclaw-echarts-userscript/build-offline-userscript.mjs`
- `tools/openclaw-echarts-userscript/README.md`
- `tools/openclaw-echarts-userscript/VENDOR_NOTES.md`

### Control UI Vendor Assets

- `tools/openclaw-control-ui-echarts/vendor/README.md`
- `tools/openclaw-control-ui-echarts/vendor/echarts.min.js`
- `tools/openclaw-control-ui-echarts/vendor/echarts-gl.min.js`
- `tools/openclaw-control-ui-echarts/vendor/json5.min.js`
- `tools/openclaw-control-ui-echarts/vendor/gsap.min.js`
- `tools/openclaw-control-ui-echarts/vendor/pixi.min.js`
- `tools/openclaw-control-ui-echarts/vendor/babylon.js`
- `tools/openclaw-control-ui-echarts/vendor/tsparticles.bundle.min.js`
- `tools/openclaw-control-ui-echarts/vendor/three.module.min.js`
- `tools/openclaw-control-ui-echarts/vendor/three/`

### Control UI Overlay Core

- `tools/openclaw-control-ui-echarts/openclaw-echarts-renderer.js`
- `tools/openclaw-control-ui-echarts/build-custom-control-ui.mjs`
- `tools/openclaw-control-ui-echarts/package-local-runtime.mjs`
- `tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.mjs`
- `tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.sh`
- `tools/openclaw-control-ui-echarts/README.md`
- `tools/openclaw-control-ui-echarts/RUNTIME_ARCHITECTURE.md`
- `tools/openclaw-control-ui-echarts/generated/.gitignore`

### Docker Local Proxy

- `tools/openclaw-control-ui-echarts/docker-local-proxy/nginx.conf`

### Local Runtime Packaging

- `tools/openclaw-control-ui-echarts/local-runtime/CUSTOMER_DEPLOYMENT_GUIDE.md`
- `tools/openclaw-control-ui-echarts/local-runtime/README.md`
- `tools/openclaw-control-ui-echarts/local-runtime/openclaw.local.example.json5`
- `tools/openclaw-control-ui-echarts/local-runtime/portable-config.mjs`
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
- `tools/openclaw-control-ui-echarts/runtime/branding/brand-panel.css`
- `tools/openclaw-control-ui-echarts/runtime/branding/brand-panel.js`
- `tools/openclaw-control-ui-echarts/runtime/branding/brand-replacer.js`
- `tools/openclaw-control-ui-echarts/runtime/branding/brand-state.js`
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

### Runtime: Select

- `tools/openclaw-control-ui-echarts/runtime/select/adapter.js`
- `tools/openclaw-control-ui-echarts/runtime/select/parser.js`
- `tools/openclaw-control-ui-echarts/runtime/select/styles.js`
- `tools/openclaw-control-ui-echarts/runtime/select/ui-text.js`

### Runtime: Knowledge Graph

- `tools/openclaw-control-ui-echarts/runtime/knowledge-graph/entry.js`
- `tools/openclaw-control-ui-echarts/runtime/knowledge-graph/page.css`
- `tools/openclaw-control-ui-echarts/runtime/knowledge-graph/page.js`

### Runtime: Public ECharts View

- `tools/openclaw-control-ui-echarts/runtime/echarts-view/bootstrap.js`
- `tools/openclaw-control-ui-echarts/runtime/echarts-view/context.js`
- `tools/openclaw-control-ui-echarts/runtime/echarts-view/surface.js`
- `tools/openclaw-control-ui-echarts/runtime/echarts-view/preboot.js`

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
- `tools/openclaw-control-ui-echarts/runtime/tenant/preboot.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/api-client.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/auth-surface.css`
- `tools/openclaw-control-ui-echarts/runtime/tenant/auth-surface.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/topbar-meta.css`
- `tools/openclaw-control-ui-echarts/runtime/tenant/feedback-toast.js`
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
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-usage-stats-page.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-overview-page.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-wallet-page.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/member-console-page.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-surface.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/route-sync.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/update-log-dialog.css`
- `tools/openclaw-control-ui-echarts/runtime/tenant/update-log-dialog.js`

### Workspace Overlays: Kingdee Cloud

- `tools/openclaw-control-ui-echarts/workspace-overlays/kingdee-cloud/skills/kingdee-analytics-ops/SKILL.md`
- `tools/openclaw-control-ui-echarts/workspace-overlays/kingdee-cloud/skills/kingdee-analytics-ops/scripts/_bridge_client.py`
- `tools/openclaw-control-ui-echarts/workspace-overlays/kingdee-cloud/skills/kingdee-analytics-ops/scripts/query_analytics_db.py`
- `tools/openclaw-control-ui-echarts/workspace-overlays/kingdee-cloud/skills/kingdee-analytics-ops/scripts/manage_analytics_db.py`
- `tools/openclaw-control-ui-echarts/workspace-overlays/kingdee-cloud/skills/kingdee-analytics-ops/scripts/query_host_db.py`

### Sidecar: Tenant Platform

- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/config.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/auth.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/allinpay.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/billing-rates.json5`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/branding.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/db.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/exec-approval-auto-approve.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/license.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/managed-node-sync.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/routes.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/server.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/migrations/001_init.sql`

### Static Pages

- `tools/openclaw-control-ui-echarts/static/knowledge-graph.html`

### Tests

- `test/tools/openclaw-control-ui-echarts/adapter-registry.test.ts`
- `test/tools/openclaw-control-ui-echarts/auto-token-bootstrap.test.ts`
- `test/tools/openclaw-control-ui-echarts/brand-panel.test.ts`
- `test/tools/openclaw-control-ui-echarts/brand-replacer.test.ts`
- `test/tools/openclaw-control-ui-echarts/brand-state.test.ts`
- `test/tools/openclaw-control-ui-echarts/chat-ambient.test.ts`
- `test/tools/openclaw-control-ui-echarts/echarts-parser.test.ts`
- `test/tools/openclaw-control-ui-echarts/echarts-styles.test.ts`
- `test/tools/openclaw-control-ui-echarts/fenced-block-runtime.test.ts`
- `test/tools/openclaw-control-ui-echarts/file-adapter.test.ts`
- `test/tools/openclaw-control-ui-echarts/file-parser.test.ts`
- `test/tools/openclaw-control-ui-echarts/framework-styles.test.ts`
- `test/tools/openclaw-control-ui-echarts/knowledge-graph-entry.test.ts`
- `test/tools/openclaw-control-ui-echarts/knowledge-graph-page.test.ts`
- `test/tools/openclaw-control-ui-echarts/echarts-view-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/lufeng-bootstrap.test.ts`
- `test/tools/openclaw-control-ui-echarts/lufeng-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/local-runtime-common.test.ts`
- `test/tools/openclaw-control-ui-echarts/portable-config.test.ts`
- `test/tools/openclaw-control-ui-echarts/member-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/feedback-toast.test.ts`
- `test/tools/openclaw-control-ui-echarts/member-chat-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/package-local-runtime.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-auth-layout.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-auth-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-branding.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-entry.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-usage-stats-page.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-overview-page.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-platform-auto-approve.test.ts`
- `test/tools/openclaw-control-ui-echarts/platform-access-guard.test.ts`
- `test/tools/openclaw-control-ui-echarts/platform-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/select-adapter.test.ts`
- `test/tools/openclaw-control-ui-echarts/select-parser.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-license.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-local-edition.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts`
- `test/tools/openclaw-control-ui-echarts/tool-run-cluster.test.ts`
- `test/tools/openclaw-control-ui-echarts/voice-input.test.ts`

## Generated Or Runtime-Only Artifacts

These are part of the zero-intrusive deployment flow, but they are generated at runtime and are not tracked in Git:

- `tools/openclaw-control-ui-echarts/generated/control-ui/`
- `.artifacts/` (local validation or design export outputs)
- `docker-compose.override.yml`

## Current Capabilities

- Fenced `echarts` blocks render as inline chart cards with a detail modal.
- Fenced `file` blocks render as compact download cards.
- Fenced `single-select` and `multi-select` blocks now render as inline option cards. Users can select one or more suggested next steps, then either insert the composed prompt into the chat box or directly send it back to the chat flow.
- Workspace file paths can download through same-origin `workspace-downloads` mounts.
- Shared runtime styles load at boot instead of waiting for a fenced block to appear.
- Fenced-block adapters now warm their local libraries at boot and rescan only changed DOM roots, reducing the post-refresh delay before `echarts` and `file` cards appear.
- Chat page visuals are customized through the injected framework styles layer.
- The chat background uses an injected animated ambient layer.
- Tool-call and tool-output sequences from the same turn are clustered and collapsible.
- Voice input is bridged through a zero-intrusive runtime layer with visible state and error feedback.
- Member chat now uses a progress-aware idle failsafe instead of a fixed 75-second absolute timeout, so long ECharts/file-generation runs keep going while text or tool output is still advancing and only fail after a real stall.
- Branding is customized through fixed brand slots, text logos, favicon replacement, and auto-token bootstrap that mirrors the gateway token into both the route scope and the root scope so public routes can reuse existing stored settings.
- Platform admins can now replace the default `知识图谱` utility entry with a zero-intrusive `更改品牌` action, open a machine-global branding panel, and save either a text logo or an uploaded image logo without touching repository files or existing OpenClaw source files; if the current brand already uses an image logo, later name/title edits can keep that machine-local image without forcing a re-upload.
- The tenant sidecar now serves a machine-local public branding state plus an image logo asset path, while platform-admin routes can persist or restore the brand configuration under the sidecar state directory so each deployment machine keeps its own brand outside Git.
- The branding runtime now reads dynamic brand state instead of relying on hardcoded text only, so brand name, page title, text logos, and image logos all update fixed Control UI brand slots while still leaving normal chat content untouched; favicon updates now follow the active text or image logo, and same-browser tabs sync branding changes immediately through zero-intrusive cross-tab state propagation.
- Tenant admins can now delete members directly from the member list through a zero-intrusive confirmation dialog; deletion now physically removes the member's `users` row together with cascaded membership/session rows, deletes that member's Agent-assignment rows, and clears that member's derived Agent workspace directories, while historical usage records stay queryable through snapshot fields persisted on `tenant_usage_records`. Recreating the same username inside that same tenant now creates a fresh member record instead of reviving a logically deleted account.
- CSP-sensitive preboot behavior now uses same-origin external scripts instead of inline bootstrap blocks.
- The public `/echarts-view/` bridge now ships with a dedicated static entry page plus same-origin runtime assets, so the browser lands on a tokenized visualization entry instead of falling back to the main Control UI shell and its `/echarts-view/__openclaw/control-ui-config.json` probe.
- The knowledge graph page is provided as a separate static page with a Control UI entry link.
- A tenant platform sidecar can provide zero-intrusive login, tenant bootstrap, membership, and Agent-assignment APIs.
- The tenant platform sidecar now supports a local-edition license file, signature verification, renewal-code application, and read-only enforcement after expiry.
- Tenant member Agent assignment now seeds each derived workspace with the base Agent's `MEMORY.md` / `memory.md` / `memory/` / `skills/` plus the existing bootstrap templates, while still excluding prior sessions and other runtime artifacts so assignment remains a one-time derivation.
- Tenant member Agent assignment now also mirrors the base Agent's durable exec-approval bucket into the derived Agent bucket under `exec-approvals.json`, heals older derived assignments during member-Agent list reads, and removes the derived bucket again when that member is deleted.
- The tenant platform sidecar now self-heals a dedicated paired operator device for exec approvals under the shared `OPENCLAW_CONFIG_DIR` (`devices/paired.json`) plus a sidecar-private device-token store under `tenant-platform/identity/tenant-platform-device-auth.json`, then uses that identity to open an `operator.approvals` gateway client and automatically resolve matching `exec.approval.requested` events with `allow-once` for tenant-derived Agent requests. This removes the previous dependency on front-end approval popups for long heredoc or obfuscation-triggered dashboard file writes and keeps working across sidecar restarts.
- Split-workspace deployments now require the tenant sidecar to see the same base workspace as the gateway, either through an explicit `/home/node/.openclaw/workspace` mount or an `OPENCLAW_WORKSPACE_DIR` fallback; otherwise member assignment can only create `.tenant-derived-agent.json` shells and will miss the base Agent's `MEMORY.md` / `memory/` / `skills/`.
- Platform admin login and tenant login now share a unified single-entry view that renders on the native Control UI root via `?ocTenantView=login`, avoiding the native router bouncing unknown `/login` pathnames back to the console. The `/login` pathname is still recognized as a backward-compatible alias when accessed directly.
- The native Control UI root now requires a platform-admin tenant session and redirects unauthenticated users to the platform login view.
- The native Control UI sidebar now injects a peer `管理` group at the top with tenant-management and Agent-assignment shortcuts.
- The native Control UI now supports a public `/echarts-view/?token=...` bridge route with a dedicated static entry page, and tenant members now get a current-member-only `可视化展示` dropdown populated from their assigned Agent workspaces' `Echarts/*_index.html` files. The bridge route resolves a signed token, falls back to the last same-browser token when the query string is missing, and mounts the target workspace HTML inside a full-page iframe, with no placeholder shell. Any executable inline `<script>` blocks are externalized into same-origin generated assets under the target Agent's `Echarts/__openclaw_echarts_view__/...` directory before the iframe loads, relative resource URLs are rewritten to absolute same-origin workspace paths, and any relative JS/JSON/image-like asset names that contain Chinese or other unsafe URL characters are copied to ASCII/hash alias files under that same generated directory before the HTML is served, so the browser no longer 404s on percent-encoded workspace asset names. Same-workspace `*_index.html` links are re-pointed back to the public `/echarts-view/?token=...` route, so the page stays CSP-safe without relying on a `<base>` tag while keeping cross-html navigation inside the supported public bridge.
- The same public `/echarts-view/` bridge now also rewrites inline style blocks, `style=` attributes, aliased CSS files, module-import specifiers, `dynamic import(...)`, worker entry URLs, and `new URL(..., import.meta.url)` relative assets against the original workspace file location instead of the generated alias directory, so AI-generated 3D/particle dashboards with bundled module graphs and local style/image/model assets are far less likely to white-screen after the zero-intrusive rewrite step.
- The zero-intrusive Control UI vendor layer now also preinstalls same-origin `Three.js`, browser-ready `three/examples/jsm` addons, `GSAP`, `PixiJS`, `Babylon.js`, `ECharts-GL`, and `tsParticles` assets under `/assets/vendor/`, so AI-generated 3D or particle dashboards can directly reference local libraries instead of relying on CDN delivery.
- The primary Docker deployment script now also stages that full zero-intrusive `vendor/` directory into `generated/control-ui/assets/vendor/` instead of only extracting embedded `echarts.min.js` / `json5.min.js`, so the same-origin advanced visualization libraries remain available after real deployments.
- The direct `setup-direct-docker-compose-up.*` deployment helpers now also apply a targeted `docker compose up -d --force-recreate` for `openclaw-gateway`, `openclaw-tenant-platform`, and `openclaw-gateway-proxy` by default, so refreshed public visualization pages do not keep serving stale gateway/proxy containers that are missing the `workspace-agent-downloads` bind mount.
- Platform management now renders inside the native Control UI content area through single-entry query views instead of jumping to the legacy standalone platform page.
- Platform-admin Agent allocation now opens a tenant-scoped wide multi-select dialog aligned with the tenant-admin assignment flow: it first loads the tenant's existing Agents, hides already assigned catalog Agents, supports per-Agent multi-select plus select-all, and submits the remaining catalog Agents in one batch while reusing a shared description / rate / initial-points payload for that batch.
- Platform-admin Agent allocation now also supports a tenant-scoped `撤回分配` dialog with per-Agent multi-select, select-all, and an in-page confirmation modal. Revoking tenant-level Agents now marks the matching `tenant_agents` rows inactive and simultaneously invalidates related `user_agent_assignments`, so tenant-admin assignment lists, member Agent lists, and stale usage-sync calls stop accepting revoked Agents without deleting history.
- Tenant-admin management now renders inside the native Control UI content area through single-entry query views instead of using a standalone tenant admin page.
- Tenant-admin management now also includes a native-shell `耗量统计` view with search plus server-paginated usage rows sourced from sidecar usage records.
- Tenant-admin management now also includes a dedicated `Agent` dropdown with an `已有Agent` entry; that view renders the tenant's currently owned Agents as cards, keeps search plus pagination inside the native content area, and opens an in-page detail modal for the selected Agent.
- Tenant-admin, platform-admin, and member Agent-selection list feedback now uses a shared auto-dismissing floating toast instead of an inline bottom callout.
- Tenant-member login now also lands inside the native Control UI shell, with only the injected `Agent` dropdown and an embedded `Agent选择` card view for assigned Agents.
- Tenant members now click assigned Agent cards into the native `/chat` page, where a zero-intrusive sidebar adds `新建会话`, a per-Agent session list, and front-end-only session hiding with a reusable confirm dialog matching the standard topbar modal style, while `Agent选择` moves into the native top breadcrumb area and the native chat content and features remain intact.
- Tenant-member draft chats now keep the native `/chat` welcome state when the current session has no real history yet, instead of injecting a blank assistant placeholder shell after `新建会话`.
- Tenant member chat now syncs assistant usage snapshots from `sessions.usage.timeseries` first, falls back to `chat.history` for compatibility, and uses idempotent message fingerprints so tenant-admin usage statistics stay aligned with what the chat page already shows; the history fallback still normalizes common token aliases like `input_tokens`, `output_tokens`, `prompt_tokens`, and `completion_tokens`.
- Tenant member session titles now prefer the first member message truncated to 20 characters, and legacy timestamp-style placeholder titles are backfilled from `chat.history` instead of persisting as the final session label.
- Tenant members now get a short `已经是新的会话了` toast instead of generating another unsent draft session when they click `新建会话` while already in a brand-new draft chat.
- Platform-admin identity and logout status now occupy the native topbar search slot globally across the root control UI.
- Tenant-admin and tenant-member identity and logout status now occupy that same native topbar search slot on their native control-shell views, and role-scoped CSS plus runtime markers force their sidebar/footer down to only the injected management or Agent entry plus the version block.
- Logged-in platform admins, tenant admins, and tenant members can now click the native right-bottom `版本` utility item to open a zero-intrusive update-log history dialog. The latest published entry auto-pops once per browser/user signature after login, while platform admins see extra `新建更新` and `修改` actions that open dedicated management dialogs for creating, editing, and deleting entries backed by the tenant sidecar SQLite store.
- Tenant platform entry now rescans late-rendered native shell nodes so topbar and sidebar role-trimming still applies after Control UI rerenders.
- Tenant-admin shell trimming now keeps only the injected `管理` / `Agent` / `统计` dropdowns plus the version block, while local-edition tenant API calls retry bootstrap and fall back across loopback/base-url candidates to avoid transient `Failed to fetch` startup errors.
- Tenant-admin shell now also sets a role-scoped root attribute and uses injected CSS to force-hide all native sidebar sections outside the injected `管理` / `Agent` / `统计` groups, avoiding native shell rerender leaks.
- Tenant platform routes now follow native history changes so management shortcuts switch without full-page reload and unmount correctly when leaving the management view.
- Tenant Agent assignment now provisions a per-member derived Agent id and isolated workspace bootstrap (`workspace-agents/<derived-id>` + runtime alias), so different members no longer share the same Agent memory/persona workspace when using the same tenant-level Agent.
- Tenant Agent assignment now opens a wide multi-select dialog with select-all support, hides already assigned Agents from the picker, and submits the selected Agent ids in one batch so members can receive several new Agents at once without duplicate choices.
- Tenant-admin Agent assignment now opens a member-scoped `撤回分配` dialog that lists the selected member's assigned Agents with per-Agent multi-select and select-all; clicking `下一步` now opens an in-page confirmation modal before the revoke request is sent, and the sidecar still marks matching `user_agent_assignments` rows inactive so member Agent lists and assignment counts stay in sync without deleting history. The display name resolution now prefers catalog names, then assignment descriptions, instead of surfacing raw placeholder values such as `not_found`.
- File-card parsing now accepts absolute and relative `workspace-<agentId>/...` paths, normalizes them to agent-workspace scope, and keeps download-card behavior compatible with derived member workspaces.
- The native Control UI now supports a public `/lufeng` finance-chat route that reuses the native control shell, skips login, pins the dedicated finance agent to an isolated `lufeng` session, proactively persists that session's GPT-5.4 override, forces the visible route state to `openai/gpt-5.4`, filters the route-scoped model catalog down to GPT-only entries, strips stale non-GPT history model badges plus stale coding-plan startup errors, trims the sidebar down to the native chat section only, hides assistant avatars (including branded `SPTC` logo avatars), and locks the model/session controls.
- A non-Docker local runtime package can now be staged with prebuilt gateway assets, the tenant sidecar, launch scripts, runtime env templates, and local-license bootstrap wiring.
- The non-Docker local runtime package now includes a customer-facing deployment guide alongside the operator/runtime templates.
- The non-Docker local runtime templates now include a practical `runtime.env` and `openclaw.json` starter shape with provider-key placeholders and a portable baseline config seeded from the real deployment shape.
- The non-Docker local runtime packager now vendors missing runtime-only packages, patches `file-type/core.js` compatibility inside the packaged runtime, and seeds a default `loopback` gateway bind so the packaged local edition boots without extra Control UI origin setup.
- The non-Docker local runtime package now seeds an active `runtime.env` plus `data/.openclaw/openclaw.json` into the output, trims the starter config so it no longer emits missing-`OPENAI_API_KEY` warnings by default, and recreates the config from the bundled template if a customer deletes it.
- The direct-docker setup helpers now sync the same portable baseline config into existing `openclaw.json` files without touching runtime-only state, then continue to sync `gateway.controlUi.root` for the generated Control UI.
- Local Docker tenant deployment now inserts a zero-intrusive front proxy on host port `18789`; that proxy forwards `/tenant-platform-api/` to the tenant sidecar and forwards the remaining HTTP/WebSocket traffic to `openclaw-gateway`, so the tenant login view can stay same-origin without modifying gateway source files.
- The direct-docker setup helpers now also merge `gateway.controlUi.allowedOrigins` with the proxy-facing local browser origins (`http://127.0.0.1:18789` and `http://localhost:18789` on the published gateway port), so the proxy-fronted Control UI no longer depends on dangerous Host-header origin fallback to complete its WebSocket handshake.
- The same direct-docker setup helpers now explicitly sync `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback=false`, so stale break-glass runtime configs stop overriding the safer allowlist-based path on later redeploys.
- Local Docker proxy-fronted setup now also syncs `gateway.controlUi.dangerouslyDisableDeviceAuth=true` into the runtime config, because the proxy-fronted `18789` path no longer looks like a direct loopback browser session to the gateway and would otherwise stop on a one-time `pairing required` screen before the tenant shell can render.
- The zero-intrusive Docker deployment path now also syncs a `kingdee-cloud` workspace overlay into the host `workspace-agents` tree, covering both the base `kingdee-cloud` workspace and existing `tenant-*-kingdee-cloud-*` derived workspaces without touching OpenClaw core source files or rebuilding the image.
- That overlay upgrades the existing forced-command SSH bridge behind `kingdee-analytics-ops`: read queries still use the same `query_analytics_db.py` path, while a new `manage_analytics_db.py` path can send controlled DDL/DML writes and whitelisted `kingdee_analytics.cli` host commands (`init-db`, `sync-object`, `sync-sales-module`) through the host bridge, so AI can now create tables, insert or update rows, and trigger the real sync engine instead of being limited to the previous read-only bridge.
- Local edition bootstrap now bypasses platform-admin setup entirely: the first local login initializes a single local tenant admin, members continue to use the tenant login entry, and native root access redirects to the tenant flow instead of the platform-admin flow.
- The tenant sidecar now supports a three-role node topology without touching core OpenClaw source files: `control-plane` remains the source of truth for tenants, members, tenant Agents, and tenant-to-node bindings; `managed-node` now registers outbound, sends heartbeats plus local Agent inventory, pulls desired state, applies it into the local SQLite/workspace view, and blocks local management writes with `managed_node_controlled`; `standalone-local` keeps the signed-license single-machine flow.
- Unified `/login` now validates cached sessions before auto-redirect and logout clears both platform/tenant local sessions to prevent login-control redirect loops.
- The Docker setup helpers now auto-sync `gateway.controlUi.root=/app/dist/control-ui` so root and `/login` routes keep serving after redeploys.
- The custom Control UI build chain now generates stable `/login` aliases (`login/index.html` and `login.html`) without the previous directory/file collision, so zero-intrusive redeploys no longer fail or regress into `Not Found` because of broken login entry artifacts.
- The Control UI rebuild scripts now preserve the `generated/control-ui` root directory itself and only replace its contents, preventing Docker bind mounts from sticking to a deleted empty directory and causing post-redeploy `Not Found` pages.
- Tenant-admin login now defaults to the native-shell `统计总览` view (`ocTenantView=tenant-statistics-overview`) instead of landing on `成员管理`, while the sidebar keeps `成员管理`, `Agent 分配`, `已有Agent`, `统计总览`, and `耗量统计` as switchable entries.
- Tenant-admin statistics overview now resolves Agent pie-chart labels with a broader display-name fallback than the usage list (`name`, `displayName`, `label`, `agentName`, `agent_name`, `description`, `baseAgentId`, `agentId`), and the top-of-card debug strip for `库加载` / `图表初始化` has been removed so `Agent 消耗分布` renders cleanly.
- Tenant-admin statistics overview now renders cumulative `已用积分` with fixed two-decimal formatting so values such as `8` display as `8.00`, using usage-ledger totals instead of the tenant wallet balance.
- The ECharts overview assets are now emitted under both `assets/vendor/` and the legacy `assets/runtime/echarts/` path so mixed deployments and cached bundles can still load the overview charts.
- The tenant-admin sidebar now injects a sibling `统计` dropdown alongside `管理`, with a `耗量统计` entry that renders a server-paginated usage list for member, Agent, total token, input, output, cache read, cache write, credit, and time columns. The page now prefers debit-direction `tenant_wallet_ledger` usage charges for `消耗积分`, falls back to synced `tenant_usage_records` for older rows, and keeps the existing `data-table` layout from 成员管理 / Agent 分配 pages.
- The same tenant-admin sidebar now also injects a sibling `Agent` dropdown between `管理` and `统计`, and the new `已有Agent` page reuses the existing `listTenantAgents()` sidecar API instead of adding a new backend surface.
- Member chat usage sync now writes both `tenant_usage_records` and, for cloud tenants, idempotent `tenant_wallet_ledger` usage-charge rows keyed by `openclaw_session_key + source_fingerprint`, then deducts the matching `tenant_agents.balance_points` inside the same sidecar transaction.
- The tenant billing sidecar now also reads a local static billing table from `billing-rates.json5`, settles tenant usage in CNY, converts session-level `estimatedCostUsd` through the local FX table before allocation, and deducts points 1:1 against the final CNY amount without depending on supplier-returned cost fields.
- Tenant member chat now intercepts the send action: if the selected Agent's assigned balance is not greater than 0 (for non-local editions), it blocks the message and displays a "积分不足请联系管理员。" alert.
- Unified `/login` now validates account status during both new logins and auto-authentication; if the account is not active, it intercepts the process and displays a "账号未启用，请联系管理员。" alert.
- Tenant-admin member management now exposes an operation column with member password changes plus an enable/disable switch, backed by zero-intrusive tenant-member update routes in the sidecar.
- The native "Update available" notification banner is now hidden through the injected framework styles layer to maintain a clean production UI.

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
