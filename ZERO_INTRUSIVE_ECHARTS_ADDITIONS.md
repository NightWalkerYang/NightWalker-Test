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

### Runtime: Public ECharts View

- `tools/openclaw-control-ui-echarts/runtime/echarts-view/context.js`
- `tools/openclaw-control-ui-echarts/runtime/echarts-view/page.css`
- `tools/openclaw-control-ui-echarts/runtime/echarts-view/surface.js`

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
- `test/tools/openclaw-control-ui-echarts/echarts-view-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/lufeng-bootstrap.test.ts`
- `test/tools/openclaw-control-ui-echarts/lufeng-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/local-runtime-common.test.ts`
- `test/tools/openclaw-control-ui-echarts/member-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/feedback-toast.test.ts`
- `test/tools/openclaw-control-ui-echarts/member-chat-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/package-local-runtime.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-auth-layout.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-auth-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-entry.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-usage-stats-page.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-overview-page.test.ts`
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
- Platform admin login and tenant login now share a unified single-entry view that renders on the native Control UI root via `?ocTenantView=login`, avoiding the native router bouncing unknown `/login` pathnames back to the console. The `/login` pathname is still recognized as a backward-compatible alias when accessed directly.
- The native Control UI root now requires a platform-admin tenant session and redirects unauthenticated users to the platform login view.
- The native Control UI sidebar now injects a peer `管理` group at the top with tenant-management and Agent-assignment shortcuts.
- The native Control UI now supports a public `/echarts-view` placeholder route, including the `/echarts-view/chat` compatibility alias, and tenant members now get a matching `可视化展示` sidebar entry that opens it without requiring login.
- Platform management now renders inside the native Control UI content area through single-entry query views instead of jumping to the legacy standalone platform page.
- Tenant-admin management now renders inside the native Control UI content area through single-entry query views instead of using a standalone tenant admin page.
- Tenant-admin management now also includes a native-shell `耗量统计` view with search plus server-paginated usage rows sourced from sidecar usage records.
- Tenant-admin, platform-admin, and member Agent-selection list feedback now uses a shared auto-dismissing floating toast instead of an inline bottom callout.
- Tenant-member login now also lands inside the native Control UI shell, with only the injected `Agent` dropdown and an embedded `Agent选择` card view for assigned Agents.
- Tenant members now click assigned Agent cards into the native `/chat` page, where a zero-intrusive sidebar adds `新建会话`, a per-Agent session list, and front-end-only session hiding with a reusable confirm dialog matching the standard topbar modal style, while `Agent选择` moves into the native top breadcrumb area and the native chat content and features remain intact.
- Tenant member chat now syncs assistant usage snapshots from `sessions.usage.timeseries` first, falls back to `chat.history` for compatibility, and uses idempotent message fingerprints so tenant-admin usage statistics stay aligned with what the chat page already shows; the history fallback still normalizes common token aliases like `input_tokens`, `output_tokens`, `prompt_tokens`, and `completion_tokens`.
- Tenant member session titles now prefer the first member message truncated to 20 characters, and legacy timestamp-style placeholder titles are backfilled from `chat.history` instead of persisting as the final session label.
- Tenant members now get a short `已经是新的会话了` toast instead of generating another unsent draft session when they click `新建会话` while already in a brand-new draft chat.
- Platform-admin identity and logout status now occupy the native topbar search slot globally across the root control UI.
- Tenant-admin and tenant-member identity and logout status now occupy that same native topbar search slot on their native control-shell views, and role-scoped CSS plus runtime markers force their sidebar/footer down to only the injected management or Agent entry plus the version block.
- Tenant platform entry now rescans late-rendered native shell nodes so topbar and sidebar role-trimming still applies after Control UI rerenders.
- Tenant-admin shell trimming now keeps only the `管理` dropdown and the version block, while local-edition tenant API calls retry bootstrap and fall back across loopback/base-url candidates to avoid transient `Failed to fetch` startup errors.
- Tenant-admin shell now also sets a role-scoped root attribute and uses injected CSS to force-hide all native sidebar sections outside the injected `管理` group, avoiding native shell rerender leaks.
- Tenant platform routes now follow native history changes so management shortcuts switch without full-page reload and unmount correctly when leaving the management view.
- Tenant Agent assignment now provisions a per-member derived Agent id and isolated workspace bootstrap (`workspace-agents/<derived-id>` + runtime alias), so different members no longer share the same Agent memory/persona workspace when using the same tenant-level Agent.
- Tenant Agent assignment now opens a wide multi-select dialog with select-all support, hides already assigned Agents from the picker, and submits the selected Agent ids in one batch so members can receive several new Agents at once without duplicate choices.
- Tenant-admin Agent assignment now opens a member-scoped `撤回分配` dialog that lists the selected member's assigned Agents with per-Agent multi-select and select-all; clicking `下一步` now opens an in-page confirmation modal before the revoke request is sent, and the sidecar still marks matching `user_agent_assignments` rows inactive so member Agent lists and assignment counts stay in sync without deleting history. The display name resolution now prefers catalog names, then assignment descriptions, instead of surfacing raw placeholder values such as `not_found`.
- File-card parsing now accepts absolute and relative `workspace-<agentId>/...` paths, normalizes them to agent-workspace scope, and keeps download-card behavior compatible with derived member workspaces.
- The native Control UI now supports a public `/lufeng` finance-chat route that reuses the native control shell, skips login, pins the dedicated finance agent to an isolated `lufeng` session, trims the sidebar down to the native chat section only, hides assistant avatars (including branded `SPTC` logo avatars), and locks the model/session controls.
- A non-Docker local runtime package can now be staged with prebuilt gateway assets, the tenant sidecar, launch scripts, runtime env templates, and local-license bootstrap wiring.
- The non-Docker local runtime package now includes a customer-facing deployment guide alongside the operator/runtime templates.
- The non-Docker local runtime templates now include a practical `runtime.env` and `openclaw.json` starter shape with provider-key placeholders and a minimal default model setup.
- The non-Docker local runtime packager now vendors missing runtime-only packages, patches `file-type/core.js` compatibility inside the packaged runtime, and seeds a default `loopback` gateway bind so the packaged local edition boots without extra Control UI origin setup.
- The non-Docker local runtime package now seeds an active `runtime.env` plus `data/.openclaw/openclaw.json` into the output, trims the starter config so it no longer emits missing-`OPENAI_API_KEY` warnings by default, and recreates the config from the bundled template if a customer deletes it.
- Local edition bootstrap now bypasses platform-admin setup entirely: the first local login initializes a single local tenant admin, members continue to use the tenant login entry, and native root access redirects to the tenant flow instead of the platform-admin flow.
- Unified `/login` now validates cached sessions before auto-redirect and logout clears both platform/tenant local sessions to prevent login-control redirect loops.
- The Docker setup helpers now auto-sync `gateway.controlUi.root=/app/dist/control-ui` so root and `/login` routes keep serving after redeploys.
- The custom Control UI build chain now generates stable `/login` aliases (`login/index.html` and `login.html`) without the previous directory/file collision, so zero-intrusive redeploys no longer fail or regress into `Not Found` because of broken login entry artifacts.
- The Control UI rebuild scripts now preserve the `generated/control-ui` root directory itself and only replace its contents, preventing Docker bind mounts from sticking to a deleted empty directory and causing post-redeploy `Not Found` pages.
- Tenant-admin login now defaults to the native-shell `统计总览` view (`ocTenantView=tenant-statistics-overview`) instead of landing on `成员管理`, while the sidebar still keeps `成员管理`, `Agent 分配`, and `耗量统计` as switchable entries.
- Tenant-admin statistics overview now resolves Agent pie-chart labels with a broader display-name fallback than the usage list (`name`, `displayName`, `label`, `agentName`, `agent_name`, `description`, `baseAgentId`, `agentId`), and the top-of-card debug strip for `库加载` / `图表初始化` has been removed so `Agent 消耗分布` renders cleanly.
- Tenant-admin statistics overview now renders cumulative `已用积分` with fixed two-decimal formatting so values such as `8` display as `8.00`, using usage-ledger totals instead of the tenant wallet balance.
- The ECharts overview assets are now emitted under both `assets/vendor/` and the legacy `assets/runtime/echarts/` path so mixed deployments and cached bundles can still load the overview charts.
- The tenant-admin sidebar now injects a sibling `统计` dropdown alongside `管理`, with a `耗量统计` entry that renders a server-paginated usage list for member, Agent, total token, input, output, cache read, cache write, credit, and time columns. The page now prefers debit-direction `tenant_wallet_ledger` usage charges for `消耗积分`, falls back to synced `tenant_usage_records` for older rows, and keeps the existing `data-table` layout from 成员管理 / Agent 分配 pages.
- Member chat usage sync now writes both `tenant_usage_records` and, for cloud tenants, idempotent `tenant_wallet_ledger` usage-charge rows keyed by `openclaw_session_key + source_fingerprint`, then deducts the matching `tenant_agents.balance_points` inside the same sidecar transaction.
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
