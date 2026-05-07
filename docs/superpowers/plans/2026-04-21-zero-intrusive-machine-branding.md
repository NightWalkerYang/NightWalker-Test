# Zero-Intrusive Machine Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a machine-local, platform-admin-managed branding feature that updates the zero-intrusive Control UI immediately without storing brand data in Git.

**Architecture:** The tenant sidecar becomes the source of truth for resolved brand state, stored under its machine-local `stateDir`. The zero-intrusive runtime loads the public brand state, subscribes to revision changes, and re-renders fixed brand slots while a new platform-admin panel handles save and restore actions.

**Tech Stack:** Node.js HTTP sidecar, zero-intrusive browser runtime modules, Vitest, jsdom, SSE, `BroadcastChannel`

---

## File Structure

### Existing files to modify

- `ZERO_INTRUSIVE_TENANT_SYSTEM_PLAN.md`
- `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
- `tools/openclaw-control-ui-echarts/openclaw-echarts-renderer.js`
- `tools/openclaw-control-ui-echarts/runtime/branding/brand-replacer.js`
- `tools/openclaw-control-ui-echarts/runtime/knowledge-graph/entry.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/api-client.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/entry.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-page.js`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/config.mjs`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/routes.mjs`

### New files to create

- `docs/superpowers/specs/2026-04-21-zero-intrusive-machine-branding-design.md`
- `docs/superpowers/plans/2026-04-21-zero-intrusive-machine-branding.md`
- `tools/openclaw-control-ui-echarts/runtime/branding/brand-state.js`
- `tools/openclaw-control-ui-echarts/runtime/branding/brand-panel.js`
- `tools/openclaw-control-ui-echarts/runtime/branding/brand-panel.css`
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/branding.mjs`
- `test/tools/openclaw-control-ui-echarts/brand-panel.test.ts`
- `test/tools/openclaw-control-ui-echarts/brand-state.test.ts`

### Existing tests to modify

- `test/tools/openclaw-control-ui-echarts/brand-replacer.test.ts`
- `test/tools/openclaw-control-ui-echarts/knowledge-graph-entry.test.ts`
- `test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts`

## Task 1: Lock the design and repo-facing docs

**Files:**
- Create: `docs/superpowers/specs/2026-04-21-zero-intrusive-machine-branding-design.md`
- Create: `docs/superpowers/plans/2026-04-21-zero-intrusive-machine-branding.md`
- Modify: `ZERO_INTRUSIVE_TENANT_SYSTEM_PLAN.md`

- [ ] **Step 1: Write the design and planning docs**

Add the approved design and execution plan covering:

```md
- machine-global brand scope
- local-only storage outside Git
- platform-admin-only write access
- text-logo / image-logo exclusivity
- immediate apply without restart
- default fallback to the current 苏博泰克 / SPTC behavior
```

- [ ] **Step 2: Update the tenant system plan**

Add a new branding subsection to `ZERO_INTRUSIVE_TENANT_SYSTEM_PLAN.md` that states:

```md
- platform admins can manage a machine-global brand
- the utility entry replaces 知识图谱 with 更改品牌
- brand config and images are stored on the deployment machine, not in the repo
- no-config fallback keeps the current default branding
```

- [ ] **Step 3: Sanity-check the docs**

Run: `Get-Content docs/superpowers/specs/2026-04-21-zero-intrusive-machine-branding-design.md | Select-Object -First 20`

Expected: the spec file exists and starts with the feature goal and constraints.

## Task 2: Add the failing sidecar tests for branding persistence

**Files:**
- Modify: `test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts`
- Create: `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/branding.mjs`

- [ ] **Step 1: Write the failing sidecar tests**

Add tests for:

```ts
it("returns built-in branding defaults when no local brand file exists", async () => {
  const state = await readBrandingState(config);
  expect(state.brandName).toBe("苏博泰克");
  expect(state.logoMode).toBe("text");
  expect(state.logoText).toBe("SPTC");
});

it("persists machine-local text branding and bumps the revision", async () => {
  const saved = await saveBrandingState(config, {
    brandName: "Acme AI",
    pageTitle: "Acme AI Console",
    logoMode: "text",
    logoText: "ACME",
  });
  expect(saved.brandName).toBe("Acme AI");
  expect(saved.pageTitle).toBe("Acme AI Console");
  expect(saved.logoMode).toBe("text");
  expect(saved.logoText).toBe("ACME");
  expect(saved.revision).toBeTruthy();
});
```

- [ ] **Step 2: Run the targeted test to verify RED**

Run: `pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts -t "branding"`

Expected: FAIL with missing branding helpers or missing exports.

- [ ] **Step 3: Implement minimal branding state persistence**

Create a focused sidecar helper module:

```js
export function resolveBrandingPaths(config) {
  const brandingDir = path.join(config.stateDir, "branding");
  return {
    brandingDir,
    brandFilePath: path.join(brandingDir, "brand.json"),
    brandingAssetDir: path.join(brandingDir, "assets"),
  };
}

export function defaultBrandingState() {
  return {
    brandName: "苏博泰克",
    pageTitle: "苏博泰克",
    logoMode: "text",
    logoText: "SPTC",
    logoImage: null,
    revision: "",
    updatedAt: "",
    version: 1,
  };
}
```

- [ ] **Step 4: Run the targeted sidecar test to verify GREEN**

Run: `pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts -t "branding"`

Expected: PASS

## Task 3: Add the failing sidecar route tests for public reads and platform-admin writes

**Files:**
- Modify: `test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts`
- Modify: `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/routes.mjs`
- Modify: `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/config.mjs`

- [ ] **Step 1: Write failing route coverage**

Add tests covering:

```ts
it("serves public branding without authentication", async () => {
  const response = await request("/tenant-platform-api/v1/public/branding");
  expect(response.statusCode).toBe(200);
  expect(response.body.data.brandName).toBe("苏博泰克");
});

it("rejects branding writes from non-platform users", async () => {
  const response = await request("/tenant-platform-api/v1/platform/branding", {
    method: "PUT",
    token: tenantAdminToken,
    body: { brandName: "Blocked", pageTitle: "Blocked", logoMode: "text", logoText: "NO" },
  });
  expect(response.statusCode).toBe(403);
});
```

- [ ] **Step 2: Run the targeted route test to verify RED**

Run: `pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts -t "public branding|branding writes"`

Expected: FAIL because the endpoints do not exist yet.

- [ ] **Step 3: Implement the minimal routing**

Add routes like:

```js
if (request.method === "GET" && relativePath === "/public/branding") {
  sendJson(request, response, 200, { ok: true, data: readBrandingState(deps.config) });
  return;
}

if (request.method === "PUT" && relativePath === "/platform/branding") {
  const session = requireSession(request, response, deps);
  if (!session || !requireRole(request, response, session, ["platform_admin"])) {
    return;
  }
  const body = await readJsonBody(request);
  const state = saveBrandingState(deps.config, body);
  sendJson(request, response, 200, { ok: true, data: state });
  return;
}
```

- [ ] **Step 4: Run the targeted route test to verify GREEN**

Run: `pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts -t "public branding|branding writes"`

Expected: PASS

## Task 4: Add the failing runtime tests for dynamic brand state

**Files:**
- Create: `test/tools/openclaw-control-ui-echarts/brand-state.test.ts`
- Modify: `test/tools/openclaw-control-ui-echarts/brand-replacer.test.ts`
- Create: `tools/openclaw-control-ui-echarts/runtime/branding/brand-state.js`

- [ ] **Step 1: Write the failing runtime-state tests**

Create tests like:

```ts
it("falls back to built-in defaults when the public branding API is unavailable", async () => {
  const state = await loadBrandState();
  expect(state.brandName).toBe("苏博泰克");
  expect(state.logoText).toBe("SPTC");
});

it("prefers the public branding payload when available", async () => {
  mockFetchBranding({
    brandName: "Acme AI",
    pageTitle: "Acme AI Console",
    logoMode: "text",
    logoText: "ACME",
  });
  const state = await loadBrandState();
  expect(state.brandName).toBe("Acme AI");
  expect(state.logoText).toBe("ACME");
});
```

- [ ] **Step 2: Run the targeted runtime-state test to verify RED**

Run: `pnpm test -- test/tools/openclaw-control-ui-echarts/brand-state.test.ts`

Expected: FAIL because `brand-state.js` does not exist yet.

- [ ] **Step 3: Implement the minimal runtime brand-state module**

Start with:

```js
const DEFAULT_BRAND_STATE = Object.freeze({
  brandName: "苏博泰克",
  pageTitle: "苏博泰克",
  logoMode: "text",
  logoText: "SPTC",
  logoImage: null,
});

export async function loadBrandState(fetchImpl = fetch) {
  try {
    const response = await fetchImpl("/tenant-platform-api/v1/public/branding");
    const payload = await response.json();
    return { ...DEFAULT_BRAND_STATE, ...(payload?.data || {}) };
  } catch {
    return { ...DEFAULT_BRAND_STATE };
  }
}
```

- [ ] **Step 4: Run the targeted runtime-state test to verify GREEN**

Run: `pnpm test -- test/tools/openclaw-control-ui-echarts/brand-state.test.ts`

Expected: PASS

## Task 5: Add the failing UI tests for the brand panel and entry replacement

**Files:**
- Create: `test/tools/openclaw-control-ui-echarts/brand-panel.test.ts`
- Modify: `test/tools/openclaw-control-ui-echarts/knowledge-graph-entry.test.ts`
- Create: `tools/openclaw-control-ui-echarts/runtime/branding/brand-panel.js`
- Create: `tools/openclaw-control-ui-echarts/runtime/branding/brand-panel.css`

- [ ] **Step 1: Write the failing utility-entry tests**

Update `knowledge-graph-entry.test.ts` to cover:

```ts
it("shows 更改品牌 for platform admins", async () => {
  seedPlatformAdminSession();
  document.body.innerHTML = `<div class="sidebar-utility-group"></div>`;
  bootKnowledgeGraphEntry();
  expect(document.querySelector(".oc-brand-settings-link")?.textContent).toContain("更改品牌");
});
```

Create brand panel tests such as:

```ts
it("keeps text and image logo modes mutually exclusive", async () => {
  const panel = mountBrandPanel();
  selectLogoMode(panel, "image");
  expect(queryLogoTextInput(panel)).toBeDisabled();
  expect(queryLogoUploadInput(panel)).not.toBeDisabled();
});
```

- [ ] **Step 2: Run the targeted UI tests to verify RED**

Run: `pnpm test -- test/tools/openclaw-control-ui-echarts/knowledge-graph-entry.test.ts test/tools/openclaw-control-ui-echarts/brand-panel.test.ts`

Expected: FAIL because the brand action and panel do not exist yet.

- [ ] **Step 3: Implement the minimal panel and entry**

Introduce:

```js
export function bootKnowledgeGraphEntry() {
  // platform_admin -> inject 更改品牌
  // other roles -> no brand action
}

export function bootBrandPanel() {
  // open / close UI
  // bind save and restore buttons
  // toggle text vs image form state
}
```

- [ ] **Step 4: Run the targeted UI tests to verify GREEN**

Run: `pnpm test -- test/tools/openclaw-control-ui-echarts/knowledge-graph-entry.test.ts test/tools/openclaw-control-ui-echarts/brand-panel.test.ts`

Expected: PASS

## Task 6: Add the failing renderer tests for text-logo and image-logo live updates

**Files:**
- Modify: `test/tools/openclaw-control-ui-echarts/brand-replacer.test.ts`
- Modify: `tools/openclaw-control-ui-echarts/runtime/branding/brand-replacer.js`
- Modify: `tools/openclaw-control-ui-echarts/openclaw-echarts-renderer.js`

- [ ] **Step 1: Extend the failing brand-renderer tests**

Add cases like:

```ts
it("renders the configured text logo and page title from dynamic brand state", async () => {
  seedResolvedBrandState({
    brandName: "Acme AI",
    pageTitle: "Acme AI Console",
    logoMode: "text",
    logoText: "ACME",
  });
  bootBrandReplacer();
  await Promise.resolve();
  expect(document.title).toBe("Acme AI Console");
  expect(document.querySelector(".oc-text-logo--sidebar")?.textContent).toBe("ACME");
});

it("renders an image logo when logoMode is image", async () => {
  seedResolvedBrandState({
    brandName: "Acme AI",
    pageTitle: "Acme AI Console",
    logoMode: "image",
    logoImage: { src: "/tenant-platform-api/v1/public/branding/logo?v=1", fileName: "logo.png", mimeType: "image/png" },
  });
  bootBrandReplacer();
  await Promise.resolve();
  expect(document.querySelector(".sidebar-brand__logo")).toBeNull();
  expect(document.querySelector(".oc-image-logo--sidebar")).toBeTruthy();
});
```

- [ ] **Step 2: Run the targeted renderer test to verify RED**

Run: `pnpm test -- test/tools/openclaw-control-ui-echarts/brand-replacer.test.ts`

Expected: FAIL because the runtime still uses hardcoded values.

- [ ] **Step 3: Implement the minimal renderer refactor**

Refactor around:

```js
function resolveBrandName(state) {
  return String(state?.brandName || "苏博泰克").trim() || "苏博泰克";
}

function resolveTextLogo(state) {
  return String(state?.logoText || "SPTC").trim() || "SPTC";
}

function isImageLogo(state) {
  return state?.logoMode === "image" && state?.logoImage?.src;
}
```

- [ ] **Step 4: Run the targeted renderer test to verify GREEN**

Run: `pnpm test -- test/tools/openclaw-control-ui-echarts/brand-replacer.test.ts`

Expected: PASS

## Task 7: Wire the tenant API client, live update stream, and platform-admin save flow

**Files:**
- Modify: `tools/openclaw-control-ui-echarts/runtime/tenant/api-client.js`
- Modify: `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-page.js`
- Modify: `tools/openclaw-control-ui-echarts/runtime/tenant/entry.js`
- Modify: `tools/openclaw-control-ui-echarts/openclaw-echarts-renderer.js`
- Modify: `tools/openclaw-control-ui-echarts/runtime/branding/brand-state.js`

- [ ] **Step 1: Add the failing flow tests**

Extend panel tests to assert:

```ts
it("submits branding saves through the tenant API client and applies the returned state", async () => {
  const apiClient = mockTenantApiClient({
    saveBranding: vi.fn().mockResolvedValue({ brandName: "Acme AI", pageTitle: "Acme AI Console", logoMode: "text", logoText: "ACME" }),
  });
  const panel = mountBrandPanel({ apiClient });
  await saveBranding(panel);
  expect(apiClient.saveBranding).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the targeted flow tests to verify RED**

Run: `pnpm test -- test/tools/openclaw-control-ui-echarts/brand-panel.test.ts -t "submits branding saves"`

Expected: FAIL because the API client does not expose branding methods yet.

- [ ] **Step 3: Implement the API client and live update flow**

Add client methods:

```js
savePlatformBranding(body) {
  return requestJson("/platform/branding", { method: "PUT", body });
},
restorePlatformBranding() {
  return requestJson("/platform/branding", { method: "DELETE" });
},
getPublicBranding() {
  return requestJson("/public/branding");
}
```

Also wire:

```js
const channel = new BroadcastChannel("openclaw-branding");
channel.postMessage({ revision: nextState.revision });
```

- [ ] **Step 4: Run the targeted flow tests to verify GREEN**

Run: `pnpm test -- test/tools/openclaw-control-ui-echarts/brand-panel.test.ts -t "submits branding saves"`

Expected: PASS

## Task 8: Run the final targeted verification and update inventory docs

**Files:**
- Modify: `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`

- [ ] **Step 1: Update the zero-intrusive inventory**

Append the new runtime, sidecar, and test files to `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`.

- [ ] **Step 2: Run the targeted branding-related test suite**

Run:

```powershell
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts -t "branding"
pnpm test -- test/tools/openclaw-control-ui-echarts/brand-state.test.ts
pnpm test -- test/tools/openclaw-control-ui-echarts/brand-replacer.test.ts
pnpm test -- test/tools/openclaw-control-ui-echarts/knowledge-graph-entry.test.ts
pnpm test -- test/tools/openclaw-control-ui-echarts/brand-panel.test.ts
```

Expected: PASS for all targeted branding tests.

- [ ] **Step 3: Run the nearest integration safety checks**

Run:

```powershell
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-entry.test.ts
pnpm test -- test/tools/openclaw-control-ui-echarts/platform-surface.test.ts
```

Expected: PASS, proving the new branding entry and runtime wiring did not break the existing tenant shell.

- [ ] **Step 4: Record any doc deltas required by the real implementation**

If the final file list or endpoint shape differs from the design, update:

```md
- ZERO_INTRUSIVE_TENANT_SYSTEM_PLAN.md
- docs/superpowers/specs/2026-04-21-zero-intrusive-machine-branding-design.md
- ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md
```

## Self-Review

- Spec coverage: the plan covers machine-local storage, platform-admin UI, sidecar persistence, public reads, immediate apply, fallback defaults, and inventory docs.
- Placeholder scan: no `TODO`, `TBD`, or “implement later” placeholders remain.
- Type consistency: the plan consistently uses `brandName`, `pageTitle`, `logoMode`, `logoText`, `logoImage`, and `revision`.
