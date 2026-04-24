import { renderDashboardManifest } from "./renderer.js";

const DASHBOARD_MANIFEST_ROOT_ID = "oc-dashboard-root";
const DASHBOARD_MANIFEST_PAYLOAD_SCRIPT_ID = "oc-dashboard-manifest-payload";

function readDashboardPayload() {
  const payloadScript = document.getElementById(DASHBOARD_MANIFEST_PAYLOAD_SCRIPT_ID);
  if (!(payloadScript instanceof HTMLScriptElement)) {
    throw new Error("dashboard_manifest_payload_missing");
  }
  const payload = JSON.parse(payloadScript.textContent || "{}");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("dashboard_manifest_payload_invalid");
  }
  return payload;
}

async function bootDashboardManifest() {
  if (window.__ocDashboardManifestBooted) {
    return null;
  }
  window.__ocDashboardManifestBooted = true;

  const root = document.getElementById(DASHBOARD_MANIFEST_ROOT_ID);
  if (!(root instanceof HTMLElement)) {
    return null;
  }

  const payload = readDashboardPayload();
  await renderDashboardManifest({
    root,
    manifest: payload.manifest || {},
    context: payload.context || {},
  });
  if (payload?.context?.visualizationName) {
    document.title = String(payload.context.visualizationName).trim();
  }
  return payload;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootDashboardManifest();
  }, { once: true });
} else {
  void bootDashboardManifest();
}
