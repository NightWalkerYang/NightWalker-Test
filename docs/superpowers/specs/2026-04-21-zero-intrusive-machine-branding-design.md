# Zero-Intrusive Machine Branding Design

## Goal

Add a platform-admin-only branding feature that can replace the default OpenClaw branding across the deployed Control UI without modifying existing source files under `src/`, `ui/`, `apps/`, or `extensions/`.

The branding state must be machine-local, must not be stored in Git, and must apply to the entire deployed instance rather than to individual tenants.

## Constraints

- All behavior changes must stay inside the existing zero-intrusive layer under `tools/openclaw-control-ui-echarts/**`.
- Machine-specific brand data must not be committed to the repository and must not live inside the project tree.
- The feature must work for the single machine / single deployment instance model.
- Platform admins must be able to update branding online after login.
- Saving a brand change must apply immediately without rebuilding the Control UI bundle and without restarting related containers by default.
- When no machine-local branding is configured, the UI must keep the current default appearance:
  - brand name remains `苏博泰克`
  - text logo remains `SPTC`
  - existing title / favicon behavior remains unchanged

## Scope

### Included

- Replace the platform-admin left sidebar utility entry `知识图谱` with `更改品牌`.
- Add a platform-admin-only branding panel for:
  - brand name
  - page title
  - logo mode (`text` or `image`)
  - text logo value or uploaded image logo, but never both at once
- Persist branding state in the tenant sidecar machine-local state directory.
- Serve public read-only branding state so login and other pre-auth surfaces can render the current brand.
- Apply the configured brand to fixed brand slots only:
  - sidebar brand area
  - login brand area
  - dashboard breadcrumb brand slot
  - chat logo avatar / badge slots
  - document title
  - favicon
- Push or broadcast brand revisions so already-open pages can re-render immediately.
- Add targeted tests for sidecar persistence, brand runtime rendering, and the platform-admin entry behavior.

### Excluded

- No per-tenant branding.
- No arbitrary find-and-replace across chat content or business content.
- No storage of branding data inside the repo, Docker image, or generated build artifacts.
- No changes to the existing OpenClaw source tree.
- No support for remote image URLs in the first version.
- No SVG upload support in the first version.

## Current Baseline

The current zero-intrusive layer already owns the relevant surfaces:

- `tools/openclaw-control-ui-echarts/runtime/branding/brand-replacer.js`
  - hardcodes the current `苏博泰克` brand name
  - hardcodes the `SPTC` text logo
  - swaps the favicon at runtime
- `tools/openclaw-control-ui-echarts/runtime/knowledge-graph/entry.js`
  - injects the `知识图谱` utility entry
- `tools/openclaw-control-ui-echarts/openclaw-echarts-renderer.js`
  - boots both runtime modules
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/config.mjs`
  - already provides a machine-local `stateDir`

This means the feature can remain fully zero-intrusive.

## Final UX

### Entry

When the current session role is `platform_admin`, the left utility area shows `更改品牌` instead of `知识图谱`.

For non-platform users, no branding-management entry is shown.

### Panel

Clicking `更改品牌` opens a zero-intrusive brand-management drawer or modal inside the existing Control UI shell.

The panel includes:

- `Brand Name`
- `Page Title`
- `Logo Type`
- `Text Logo` when `Logo Type = text`
- `Upload Logo Image` when `Logo Type = image`
- live preview
- `Save`
- `Restore Defaults`

### Rules

- `Brand Name` is always editable.
- `Page Title` is always editable.
- `Logo Type` is a required single-choice field.
- `Text Logo` is enabled only for `text` mode.
- `Upload Logo Image` is enabled only for `image` mode.
- `Restore Defaults` removes the machine-local branding state and returns the system to the current built-in zero-intrusive default brand.

## Data Model

The resolved branding state should look like this:

```json
{
  "brandName": "苏博泰克",
  "pageTitle": "苏博泰克",
  "logoMode": "text",
  "logoText": "SPTC",
  "logoImage": null,
  "revision": "2026-04-21T12:00:00.000Z",
  "updatedAt": "2026-04-21T12:00:00.000Z",
  "version": 1
}
```

When `logoMode = image`, `logoImage` becomes:

```json
{
  "fileName": "logo.png",
  "mimeType": "image/png",
  "src": "/tenant-platform-api/v1/public/branding/logo?v=2026-04-21T12:00:00.000Z"
}
```

## Machine-Local Storage

Branding state must live under the tenant sidecar `stateDir`, not inside the repo and not inside the build output.

Recommended layout:

- `<stateDir>/branding/brand.json`
- `<stateDir>/branding/assets/logo.png`

This keeps branding aligned with other machine-local tenant sidecar state while ensuring that Git pulls do not overwrite per-machine brand data.

## Sidecar Design

Add a dedicated sidecar module for branding state management. The sidecar is the source of truth.

### Public read endpoints

- `GET /tenant-platform-api/v1/public/branding`
  - returns the resolved brand state
  - available without authentication so login and public routes can render correctly
- `GET /tenant-platform-api/v1/public/branding/logo`
  - returns the stored logo image for `image` mode
  - available without authentication
- `GET /tenant-platform-api/v1/public/branding/stream`
  - SSE endpoint that emits revision updates
  - available without authentication

### Platform-admin write endpoints

- `PUT /tenant-platform-api/v1/platform/branding`
  - saves brand fields
  - only available to `platform_admin`
  - supports either text-logo payload or image-logo payload
- `POST /tenant-platform-api/v1/platform/branding/logo`
  - optional dedicated upload endpoint if separating image persistence is cleaner than a single `PUT`
- `DELETE /tenant-platform-api/v1/platform/branding`
  - removes machine-local branding state and logo asset
  - only available to `platform_admin`

The implementation can choose between a single `PUT` or split `PUT` + `POST`, but the final API must keep the mutually-exclusive logo modes explicit and must return the resolved state after every write.

## Runtime Design

The current brand runtime needs to stop depending on hardcoded constants only. It should instead use:

1. built-in defaults
2. the latest resolved brand state from the sidecar, when available

### Default fallback

Built-in defaults remain:

- brand name: `苏博泰克`
- text logo: `SPTC`
- current favicon generation path

### Brand state loader

Add a small runtime brand-state layer responsible for:

- fetching `public/branding`
- caching the current resolved state
- subscribing to `public/branding/stream`
- broadcasting changes to other tabs with `BroadcastChannel`
- exposing `getCurrentBrandState()` and `subscribeBrandState()`

### Brand rendering

Refactor `brand-replacer.js` so it:

- still targets fixed brand slots only
- no longer rewrites arbitrary page text
- renders text-logo or image-logo depending on the resolved brand state
- updates title and favicon when the brand state changes
- re-renders when the subscription callback fires

## Platform-Admin Entry Replacement

`runtime/knowledge-graph/entry.js` should no longer inject a fixed knowledge-graph link for platform admins.

Instead:

- `platform_admin`
  - inject `更改品牌`
  - clicking opens the branding panel
- non-platform roles
  - preserve existing role-trim behavior

The knowledge graph route itself can remain in the zero-intrusive layer; only the default platform-admin utility entry is replaced.

## Upload Design

The first version should accept local file uploads only.

Supported formats:

- `image/png`
- `image/jpeg`
- `image/webp`

Rejected in the first version:

- SVG
- remote URLs

The browser can send a base64 data URL in JSON to avoid adding multipart parsing as part of the first implementation.

## Immediate Apply Strategy

### Same page

After a successful save:

- the platform panel receives the resolved brand state
- the runtime brand store updates immediately
- the existing page re-renders all fixed brand slots

### Other tabs and routes

- same-browser tabs update via `BroadcastChannel`
- already-open pages update via the SSE revision stream
- newly-opened pages fetch the latest public brand state during boot

This satisfies the “apply immediately without restart” requirement.

## Security Model

- Public reads are allowed because login and other public routes need the active brand.
- Only `platform_admin` can modify or delete branding state.
- The runtime must never trust browser-local state as the source of truth for machine branding.
- The logo serving path must only expose the machine-local branding asset, not arbitrary filesystem paths.

## Testing Strategy

Targeted tests only. No repo-wide slow gates by default.

### Sidecar tests

- brand state defaults when no config exists
- save text-logo brand
- save image-logo brand
- restore defaults removes local state
- SSE revision emission on update

### Runtime tests

- fallback default rendering still matches current behavior
- dynamic text-logo rendering
- dynamic image-logo rendering
- title update on state change
- fixed brand slots update while chat content remains untouched

### Entry tests

- platform-admin utility entry becomes `更改品牌`
- non-platform roles do not get the branding action

### Panel tests

- text and image modes stay mutually exclusive
- save / restore workflows call the correct tenant API client methods

## Deployment Notes

- Brand data is machine-local, so no Git conflict should occur between deployments.
- Code ships through the normal zero-intrusive deployment path.
- Pure branding content changes should not require image rebuilds.
- Operators can sync zero-intrusive code, keep existing local brand state, and restart only the related sidecar or proxy path when truly needed.

## Risks

### Risk: stale brand state in long-lived pages

Mitigation:

- use SSE revision updates
- use `BroadcastChannel`
- always fetch the latest public state on boot

### Risk: image upload complexity

Mitigation:

- accept base64 JSON payloads first
- limit allowed mime types
- keep the first version to local-file upload only

### Risk: hardcoded string replacement touching business content

Mitigation:

- keep the current fixed-slot selector model
- stop treating free text as a replacement target

## Acceptance Criteria

- Platform admins can open `更改品牌` from the Control UI utility area.
- Platform admins can change brand name, page title, and logo mode.
- Text-logo and image-logo modes are mutually exclusive.
- The resolved brand applies across login, platform, tenant, member, chat, title, and favicon surfaces.
- Saving branding updates the current page immediately and updates other open pages without restart.
- Restoring defaults returns the UI to the current built-in `苏博泰克` / `SPTC` appearance.
- No machine-specific brand asset or config is committed to Git.
