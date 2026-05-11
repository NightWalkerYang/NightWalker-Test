# Tenant Runtime Structure Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the zero-intrusive tenant runtime structure so `entry.js` becomes an assembler, shared runtime concerns gain explicit homes, and future feature work stops inflating the main tenant entrypoint while preserving all current behavior.

**Architecture:** Keep the current public runtime entry files and behavior contracts intact, but introduce a small shared tenant-runtime core for state, registry, shell coordination, and lifecycle cleanup. Then move internal responsibilities out of the largest tenant runtime files in focused slices, using targeted regression tests after each slice so structure changes do not alter user-visible behavior.

**Tech Stack:** Vanilla JS zero-intrusive runtime modules, Vitest targeted runtime tests, zero-intrusive docs and inventory files.

---

## File Structure

### Existing files that remain public entrypoints

- `tools/openclaw-control-ui-echarts/runtime/tenant/entry.js`
  - Keep `bootTenantEntry` and `resetTenantEntryForTests`
  - Shrink to assembly, route wiring, and global cleanup registration
- `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-surface.js`
  - Keep `bootMemberChatSurface` and `resetMemberChatSurfaceForTests`
  - Shrink to member-chat assembly
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-page.js`
  - Keep page entry/controller orchestration
  - Shrink to page-level composition
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-page.js`
  - Keep page entry/controller orchestration
  - Shrink to page-level composition

### New shared runtime files

- `tools/openclaw-control-ui-echarts/runtime/tenant/runtime-store.js`
  - Shared mutable tenant runtime state with subscribe/get/set helpers
- `tools/openclaw-control-ui-echarts/runtime/tenant/view-registry.js`
  - Tenant runtime page/surface registry and matching contract
- `tools/openclaw-control-ui-echarts/runtime/tenant/shell-coordinator.js`
  - Sidebar/topbar/breadcrumb/content-area coordination using `dom-compat.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/lifecycle.js`
  - Shared teardown registration for observers, polling, and event listeners

### New member-chat support files

- `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-storage.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-history.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-sidebar.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-failsafe.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-usage-sync.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-route-state.js`

### New platform page support files

- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-controller.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-render.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-dialogs.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-data-sources.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-nodes.js`

### New tenant page support files

- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-controller.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-render.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-dialogs.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-members.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-wallet.js`

### New governance doc

- `tools/openclaw-control-ui-echarts/TENANT_RUNTIME_EXTENSION_GUIDE.md`
  - Mandatory extension rules for future agents adding pages or runtime behavior

### Existing docs to update

- `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
- `ZERO_INTRUSIVE_TENANT_SYSTEM_PLAN.md`
- `tools/openclaw-control-ui-echarts/RUNTIME_ARCHITECTURE.md`

### Tests to add or update

- `test/tools/openclaw-control-ui-echarts/tenant-runtime-store.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-view-registry.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-shell-coordinator.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-lifecycle.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-entry.test.ts`
- `test/tools/openclaw-control-ui-echarts/member-chat-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/platform-surface.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts`

### Scope guard

Do not modify:

- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/*`
- `tools/openclaw-control-ui-echarts/build-custom-control-ui.mjs`
- deployment scripts
- build manifest / smoke gate contracts

---

### Task 1: Add the runtime governance doc and inventory entries

**Files:**
- Create: `tools/openclaw-control-ui-echarts/TENANT_RUNTIME_EXTENSION_GUIDE.md`
- Modify: `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
- Modify: `ZERO_INTRUSIVE_TENANT_SYSTEM_PLAN.md`
- Modify: `tools/openclaw-control-ui-echarts/RUNTIME_ARCHITECTURE.md`

- [ ] **Step 1: Write the failing doc expectations**

Document the required guidance that must exist after this task:

- `entry.js` is assembly-only
- new tenant pages must be standalone modules registered via a registry
- DOM shell access must go through `runtime/framework/dom-compat.js`
- route/session/storage access must go through shared tenant helpers
- cleanup must be registered centrally

- [ ] **Step 2: Create the governance doc**

Write `tools/openclaw-control-ui-echarts/TENANT_RUNTIME_EXTENSION_GUIDE.md` covering:

- allowed file responsibilities
- prohibited growth patterns for `entry.js`
- how to add a new tenant page
- how to add shell-level behavior
- how to add route/session/shared-state behavior
- required tests/docs for future runtime features

- [ ] **Step 3: Update existing docs**

Update:

- `ZERO_INTRUSIVE_TENANT_SYSTEM_PLAN.md`
  - add tenant runtime structure/governance guidance in the overview/maintenance guidance
- `tools/openclaw-control-ui-echarts/RUNTIME_ARCHITECTURE.md`
  - extend the architecture doc so tenant runtime follows the same layered split philosophy
- `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
  - add the new guide file

- [ ] **Step 4: Review the doc changes for rule consistency**

Check that the new guide and updated docs all agree on:

- zero-intrusive-only edits
- `dom-compat.js` reuse
- no direct page logic growth in `entry.js`

- [ ] **Step 5: Commit**

Commit with a Chinese message after verification, for example:

```bash
git add tools/openclaw-control-ui-echarts/TENANT_RUNTIME_EXTENSION_GUIDE.md ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md ZERO_INTRUSIVE_TENANT_SYSTEM_PLAN.md tools/openclaw-control-ui-echarts/RUNTIME_ARCHITECTURE.md
git commit -m "补充租户运行时扩展治理规则"
```

### Task 2: Introduce the shared lifecycle helper

**Files:**
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/lifecycle.js`
- Modify: `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
- Test: `test/tools/openclaw-control-ui-echarts/tenant-lifecycle.test.ts`

- [ ] **Step 1: Write the failing test**

Add `tenant-lifecycle.test.ts` covering:

- registering cleanup callbacks
- registering interval/timeout/observer-like teardown callbacks
- running cleanup once
- resetting state for tests

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-lifecycle.test.ts
```

Expected: FAIL because `runtime/tenant/lifecycle.js` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Implement `lifecycle.js` with:

- a small cleanup bucket factory
- methods to register plain callbacks
- helpers to register intervals/timeouts/listeners
- idempotent `cleanup()`
- `resetForTests()` or equivalent test reset

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-lifecycle.test.ts
```

Expected: PASS

- [ ] **Step 5: Update the zero-intrusive inventory and commit**

```bash
git add tools/openclaw-control-ui-echarts/runtime/tenant/lifecycle.js test/tools/openclaw-control-ui-echarts/tenant-lifecycle.test.ts ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md
git commit -m "新增租户运行时生命周期助手"
```

### Task 3: Introduce the shared runtime store

**Files:**
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/runtime-store.js`
- Modify: `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
- Test: `test/tools/openclaw-control-ui-echarts/tenant-runtime-store.test.ts`

- [ ] **Step 1: Write the failing test**

Add `tenant-runtime-store.test.ts` covering:

- initial state read
- updates via setter/updater
- subscriber notification
- no notification when state does not change
- test reset behavior

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-runtime-store.test.ts
```

Expected: FAIL because `runtime-store.js` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Implement `runtime-store.js` with:

- `createTenantRuntimeStore(initialState)`
- `getState()`
- `setState(nextOrUpdater)`
- `subscribe(listener)`
- minimal `resetForTests()` support where needed

State should support, at minimum:

- current session
- current role
- current tenant view
- selected tenant agent
- shell readiness flags

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-runtime-store.test.ts
```

Expected: PASS

- [ ] **Step 5: Update inventory and commit**

```bash
git add tools/openclaw-control-ui-echarts/runtime/tenant/runtime-store.js test/tools/openclaw-control-ui-echarts/tenant-runtime-store.test.ts ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md
git commit -m "新增租户运行时状态存储"
```

### Task 4: Introduce the tenant view registry

**Files:**
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/view-registry.js`
- Modify: `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
- Test: `test/tools/openclaw-control-ui-echarts/tenant-view-registry.test.ts`

- [ ] **Step 1: Write the failing test**

Add `tenant-view-registry.test.ts` covering:

- registry creation
- duplicate id rejection
- matching the first valid registered view
- mount/unmount/sync contract invocation

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-view-registry.test.ts
```

Expected: FAIL because `view-registry.js` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Implement `view-registry.js` with:

- registry creation from a list of view descriptors
- validation for `id` uniqueness
- helpers such as `findMatchingView(context)`
- no behavior changes yet in existing runtime consumers

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-view-registry.test.ts
```

Expected: PASS

- [ ] **Step 5: Update inventory and commit**

```bash
git add tools/openclaw-control-ui-echarts/runtime/tenant/view-registry.js test/tools/openclaw-control-ui-echarts/tenant-view-registry.test.ts ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md
git commit -m "新增租户视图注册表"
```

### Task 5: Introduce the shell coordinator

**Files:**
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/shell-coordinator.js`
- Modify: `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
- Test: `test/tools/openclaw-control-ui-echarts/tenant-shell-coordinator.test.ts`

- [ ] **Step 1: Write the failing test**

Add `tenant-shell-coordinator.test.ts` covering:

- locating shell anchors through `dom-compat.js`
- creating/updating sidebar/topbar coordination state
- cleanup behavior

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-shell-coordinator.test.ts
```

Expected: FAIL because `shell-coordinator.js` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Implement `shell-coordinator.js` so it:

- accepts a context/store/lifecycle object
- resolves sidebar/topbar/breadcrumb/content roots through `dom-compat.js`
- exposes coordination helpers without changing current page behavior yet

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-shell-coordinator.test.ts
```

Expected: PASS

- [ ] **Step 5: Update inventory and commit**

```bash
git add tools/openclaw-control-ui-echarts/runtime/tenant/shell-coordinator.js test/tools/openclaw-control-ui-echarts/tenant-shell-coordinator.test.ts ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md
git commit -m "新增租户壳层协调器"
```

### Task 6: Refactor `entry.js` to assemble shared runtime pieces

**Files:**
- Modify: `tools/openclaw-control-ui-echarts/runtime/tenant/entry.js`
- Modify: `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js`
- Modify: `tools/openclaw-control-ui-echarts/runtime/tenant/route-sync.js`
- Test: `test/tools/openclaw-control-ui-echarts/tenant-entry.test.ts`
- Test: `test/tools/openclaw-control-ui-echarts/platform-surface.test.ts`
- Test: `test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts`

- [ ] **Step 1: Write the failing tests**

Add/update tests that verify:

- `bootTenantEntry()` still mounts the correct surface for platform, tenant-admin, and member contexts
- route changes still update mounted views
- topbar/sidebar shell behavior still appears under existing role scenarios

- [ ] **Step 2: Run the tests to verify baseline behavior**

Run:

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-entry.test.ts test/tools/openclaw-control-ui-echarts/platform-surface.test.ts test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts
```

Expected: PASS before refactor, establishing the regression target.

- [ ] **Step 3: Refactor `entry.js` in minimal slices**

Move out of `entry.js`:

- shell anchor discovery and coordination
- role-based shell section synchronization
- shared polling/cleanup wiring
- view matching/dispatch

Keep:

- public boot/reset exports
- high-level assembly/wiring

- [ ] **Step 4: Run the tests to verify no behavior changed**

Run:

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-entry.test.ts test/tools/openclaw-control-ui-echarts/platform-surface.test.ts test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tools/openclaw-control-ui-echarts/runtime/tenant/entry.js tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js tools/openclaw-control-ui-echarts/runtime/tenant/route-sync.js test/tools/openclaw-control-ui-echarts/tenant-entry.test.ts test/tools/openclaw-control-ui-echarts/platform-surface.test.ts test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts
git commit -m "收敛租户入口装配职责"
```

### Task 7: Split member-chat internal responsibilities

**Files:**
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-storage.js`
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-history.js`
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-sidebar.js`
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-failsafe.js`
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-usage-sync.js`
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-route-state.js`
- Modify: `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-surface.js`
- Modify: `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
- Test: `test/tools/openclaw-control-ui-echarts/member-chat-surface.test.ts`

- [ ] **Step 1: Write/update failing regression tests**

Ensure `member-chat-surface.test.ts` covers:

- draft route lock behavior
- sidebar session list rendering
- delete dialog flow
- history prepend behavior
- current session route syncing

- [ ] **Step 2: Run the test to establish the regression baseline**

Run:

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/member-chat-surface.test.ts
```

Expected: PASS before internal extraction, establishing the target behavior.

- [ ] **Step 3: Extract one concern at a time**

Move logic into the new support files in this order:

1. storage helpers
2. route-state helpers
3. failsafe helpers
4. history helpers
5. usage sync helpers
6. sidebar rendering helpers

Keep the public member-chat boot/reset exports unchanged.

- [ ] **Step 4: Run the test after each extraction group**

Run:

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/member-chat-surface.test.ts
```

Expected: PASS after each extraction slice.

- [ ] **Step 5: Update inventory and commit**

```bash
git add tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-storage.js tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-history.js tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-sidebar.js tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-failsafe.js tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-usage-sync.js tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-route-state.js tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-surface.js test/tools/openclaw-control-ui-echarts/member-chat-surface.test.ts ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md
git commit -m "拆分成员聊天运行时内部职责"
```

### Task 8: Split platform console page internals

**Files:**
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-controller.js`
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-render.js`
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-dialogs.js`
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-data-sources.js`
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-nodes.js`
- Modify: `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-page.js`
- Modify: `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
- Test: `test/tools/openclaw-control-ui-echarts/platform-surface.test.ts`

- [ ] **Step 1: Expand the regression test as needed**

Make sure `platform-surface.test.ts` covers:

- tenant-management rendering
- agent assignment rendering
- node management rendering
- data-source rendering
- toolbar/dialog flows still reachable

- [ ] **Step 2: Run the test to establish the regression baseline**

Run:

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/platform-surface.test.ts
```

Expected: PASS before extraction.

- [ ] **Step 3: Extract platform page responsibilities**

Move:

- controller state helpers
- render helpers
- dialog helpers
- data-source helpers
- node helpers

Keep `platform-console-page.js` as the composition entry.

- [ ] **Step 4: Run the test to verify no behavior changed**

Run:

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/platform-surface.test.ts
```

Expected: PASS

- [ ] **Step 5: Update inventory and commit**

```bash
git add tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-controller.js tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-render.js tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-dialogs.js tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-data-sources.js tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-nodes.js tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-page.js test/tools/openclaw-control-ui-echarts/platform-surface.test.ts ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md
git commit -m "拆分平台控制台页面结构"
```

### Task 9: Split tenant console page internals

**Files:**
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-controller.js`
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-render.js`
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-dialogs.js`
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-members.js`
- Create: `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-wallet.js`
- Modify: `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-page.js`
- Modify: `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
- Test: `test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts`

- [ ] **Step 1: Expand the regression test as needed**

Make sure `tenant-surface.test.ts` covers:

- member management rendering
- assignment rendering
- owned-agent rendering
- usage stats rendering
- wallet subviews rendering
- existing dialog flows

- [ ] **Step 2: Run the test to establish the regression baseline**

Run:

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts
```

Expected: PASS before extraction.

- [ ] **Step 3: Extract tenant page responsibilities**

Move:

- controller state helpers
- render helpers
- dialog helpers
- member-management helpers
- wallet helpers

Keep `tenant-console-page.js` as the composition entry.

- [ ] **Step 4: Run the test to verify no behavior changed**

Run:

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts
```

Expected: PASS

- [ ] **Step 5: Update inventory and commit**

```bash
git add tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-controller.js tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-render.js tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-dialogs.js tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-members.js tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-wallet.js tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-page.js test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md
git commit -m "拆分租户控制台页面结构"
```

### Task 10: Final targeted verification and handoff

**Files:**
- Test: `test/tools/openclaw-control-ui-echarts/tenant-lifecycle.test.ts`
- Test: `test/tools/openclaw-control-ui-echarts/tenant-runtime-store.test.ts`
- Test: `test/tools/openclaw-control-ui-echarts/tenant-view-registry.test.ts`
- Test: `test/tools/openclaw-control-ui-echarts/tenant-shell-coordinator.test.ts`
- Test: `test/tools/openclaw-control-ui-echarts/tenant-entry.test.ts`
- Test: `test/tools/openclaw-control-ui-echarts/member-chat-surface.test.ts`
- Test: `test/tools/openclaw-control-ui-echarts/platform-surface.test.ts`
- Test: `test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts`

- [ ] **Step 1: Run the focused runtime regression suite**

Run:

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-lifecycle.test.ts test/tools/openclaw-control-ui-echarts/tenant-runtime-store.test.ts test/tools/openclaw-control-ui-echarts/tenant-view-registry.test.ts test/tools/openclaw-control-ui-echarts/tenant-shell-coordinator.test.ts test/tools/openclaw-control-ui-echarts/tenant-entry.test.ts test/tools/openclaw-control-ui-echarts/member-chat-surface.test.ts test/tools/openclaw-control-ui-echarts/platform-surface.test.ts test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts
```

Expected: PASS

- [ ] **Step 2: Run changed checks for the touched lane if needed**

Run:

```bash
pnpm check:changed
```

Expected: PASS or a precise report limited to unrelated pre-existing issues.

- [ ] **Step 3: Review docs and inventory**

Verify:

- every newly added zero-intrusive file is listed in `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
- governance docs still match the runtime structure

- [ ] **Step 4: Commit the final verification or cleanup-only doc touches**

```bash
git add ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md docs/superpowers/plans/2026-05-11-tenant-runtime-structure-refactor.md
git commit -m "完善租户运行时结构重构计划与校验"
```

## Self-Review

### Spec coverage

This plan covers:

- shared runtime layers (`runtime-store`, `view-registry`, `shell-coordinator`, `lifecycle`)
- `entry.js` assembly-only goal
- member chat internal responsibility split
- platform page internal responsibility split
- tenant page internal responsibility split
- governance doc for future feature work
- targeted regression verification

No spec section is intentionally left without a task.

### Placeholder scan

This plan avoids:

- TODO/TBD placeholders
- “add tests” without named test files and commands
- “similar to previous task” shortcuts

### Type and naming consistency

The plan consistently uses:

- `runtime-store.js`
- `view-registry.js`
- `shell-coordinator.js`
- `lifecycle.js`

and keeps the public boot/reset names unchanged for the two current runtime entrypoints.
