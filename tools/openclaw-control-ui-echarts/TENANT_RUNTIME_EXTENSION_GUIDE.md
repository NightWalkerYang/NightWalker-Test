# Tenant Runtime Extension Guide

This guide defines where future zero-intrusive tenant runtime work is allowed to land.

It is intentionally strict: if a new feature does not fit these rules, fix the structure first instead of growing `runtime/tenant/entry.js`.

## Required Governance Expectations

Future tenant runtime changes must preserve these expectations:

- `runtime/tenant/entry.js` stays assembly-only.
- New tenant pages or surfaces are standalone modules connected through a registry, not inline `if/else` growth inside the entrypoint.
- Native Control UI shell DOM access goes through `runtime/framework/dom-compat.js`.
- Route, session, selected-agent, and storage access goes through shared tenant helpers such as `runtime/tenant/tenant-context.js` and `runtime/tenant/route-sync.js`.
- Polling, observers, and event listeners register cleanup centrally instead of leaving teardown inside scattered page logic.

## Allowed File Responsibilities

### `runtime/tenant/entry.js`

Allowed responsibilities:

- keep public boot and reset exports stable
- assemble route sync, shell coordination, page registry, and shared cleanup wiring
- trigger runtime-wide scans or boot order only at the top level

Not allowed:

- page-specific render logic
- page-specific API orchestration
- page-specific form state
- direct shell selector growth
- one-off polling or observer ownership that is not shared runtime lifecycle wiring

### `runtime/framework/dom-compat.js`

Allowed responsibilities:

- expose the canonical shell DOM contract for sidebar, topbar, breadcrumb, chat surface, and related host nodes
- absorb upstream shell selector drift in one place

Not allowed:

- tenant business logic
- route logic
- page rendering

### Shared tenant helpers under `runtime/tenant/`

Use shared helpers for cross-page truth:

- `tenant-context.js`: session, role, selected agent, storage keys, route constants, route builders
- `route-sync.js`: route change dispatch, navigation helpers, route event subscription
- other shared helpers: only when the behavior is reused across pages or shell coordination

Do not duplicate these concerns inside a page module.

### Page or surface modules under `runtime/tenant/`

Allowed responsibilities:

- controller, render, interaction, and page-local state for one tenant page or surface
- page-local cleanup registration through the shared lifecycle path

Not allowed:

- direct ownership of global shell assembly
- direct mutation of shared route/session/storage truth outside shared helpers

## Prohibited `entry.js` Growth Patterns

Do not extend `runtime/tenant/entry.js` with:

- new page-level conditional branches
- page-specific fetch and submit flows
- page-specific dialog state
- copied DOM selector logic that should live in `dom-compat.js`
- ad hoc `history.pushState`, `history.replaceState`, `localStorage`, or `sessionStorage` access
- page-owned timers, observers, or listeners without central cleanup registration

If the change needs one of those, create or extend the correct standalone module instead.

## How To Add A New Tenant Page

1. Create a standalone page or surface module under `runtime/tenant/`.
2. Keep controller, render, and interaction logic inside that module or its directly related helpers.
3. Register the module through the tenant view registry path instead of adding more page branching to `entry.js`.
4. Reuse `tenant-context.js` for route constants, route builders, session reads, selected-agent reads, and storage access.
5. Reuse `route-sync.js` for navigation and route change subscription.
6. Use `runtime/framework/dom-compat.js` if the page needs native shell anchors.
7. Register teardown through the shared lifecycle/cleanup path so test reset and route exit can release resources centrally.

Minimum contract for a new page module:

- identify when it should run
- mount its own view
- unmount cleanly
- keep shell access indirect through the shell/dom compatibility layer

## How To Add Shell-Level Behavior

Shell-level behavior means sidebar, topbar, breadcrumb, content-area takeover, or other native shell coordination.

Rules:

- add shell node discovery only in `runtime/framework/dom-compat.js`
- keep shell orchestration in the tenant shell coordination layer, not in a page module
- keep `entry.js` limited to wiring the shell coordinator into boot/reset flow

If a shell feature needs new selectors, update `dom-compat.js` instead of adding direct `querySelector` growth in tenant pages or the entrypoint.

## How To Add Route, Session, Or Shared-State Behavior

Use shared tenant helpers as the single source of truth:

- route constants, route builders, selected agent reads, and session/storage access belong in `tenant-context.js`
- route event dispatch and navigation belong in `route-sync.js`

Do not:

- call `history.pushState` or `history.replaceState` directly from a page module
- create new per-page storage key conventions when an existing helper can own them
- read or write browser storage inline across multiple modules

If a new cross-page state concern appears, add one shared helper for it and keep page modules as consumers.

## Cleanup Rules

All runtime resources must have a central teardown path:

- route subscriptions
- DOM observers
- timers and polling
- window or document event listeners
- shell-scoped injected nodes that must be removed on reset

Future runtime features must register cleanup centrally so:

- route switches can unmount predictably
- `resetTenantEntryForTests()` can restore clean test state
- shared shell takeover does not leak across rerenders

## Required Tests And Docs For Future Runtime Features

Every future runtime feature should update both behavior coverage and governance docs.

Required follow-up:

- add or update focused tenant runtime tests for the new shared helper, registry behavior, or cleanup path
- keep behavior-level coverage for the affected page or shell flow
- update `RUNTIME_ARCHITECTURE.md` when the runtime layering changes
- update `ZERO_INTRUSIVE_TENANT_SYSTEM_PLAN.md` if the maintenance guidance changes
- update `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md` whenever a new zero-intrusive file is added

If the implementation and docs drift, update the docs to match the runnable zero-intrusive implementation.
