import { createTenantApiClient } from "../tenant/api-client.js";

const _client = createTenantApiClient();

function _req(path, options = {}) {
  return _client._requestJson
    ? _client._requestJson(path, options)
    : _requestJsonFallback(path, options);
}

// api-client.js の requestJson は export されていないため直接実装
import {
  resolveTenantApiBaseCandidates,
  readSessionForCurrentView,
  writeTenantApiBaseOverride,
} from "../tenant/tenant-context.js";

async function requestJson(path, options = {}) {
  const baseUrls = resolveTenantApiBaseCandidates();
  const session = options.session || readSessionForCurrentView();
  const headers = { "content-type": "application/json", ...options.headers };
  if (session?.token) {
    headers.authorization = `Bearer ${session.token}`;
  }

  let lastError = null;
  for (const baseUrl of baseUrls) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }
      if (baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
        writeTenantApiBaseOverride(baseUrl);
      }
      return payload.data;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError || "request_failed"));
}

// ─── 大屏 API ────────────────────────────────────────────────────────────────

export function listDashboards() {
  return requestJson("/dashboards");
}

export function getDashboard(id) {
  return requestJson(`/dashboards/${id}`);
}

export function createDashboard(body) {
  return requestJson("/dashboards", { method: "POST", body });
}

export function updateDashboard(id, body) {
  return requestJson(`/dashboards/${id}`, { method: "PUT", body });
}

export function deleteDashboard(id) {
  return requestJson(`/dashboards/${id}`, { method: "DELETE" });
}

export function shareDashboard(id, isPublic) {
  return requestJson(`/dashboards/${id}/share`, { method: "POST", body: { isPublic } });
}

export function listDashboardCharts(dashboardId) {
  return requestJson(`/dashboards/${dashboardId}/charts`);
}

export function createDashboardChart(dashboardId, body) {
  return requestJson(`/dashboards/${dashboardId}/charts`, { method: "POST", body });
}

export function updateDashboardChart(dashboardId, chartId, body) {
  return requestJson(`/dashboards/${dashboardId}/charts/${chartId}`, { method: "PUT", body });
}

export function deleteDashboardChart(dashboardId, chartId) {
  return requestJson(`/dashboards/${dashboardId}/charts/${chartId}`, { method: "DELETE" });
}

// ─── 公开大屏 API（无需认证） ─────────────────────────────────────────────────

export async function getPublicDashboard(token) {
  const baseUrls = resolveTenantApiBaseCandidates();
  let lastError = null;
  for (const baseUrl of baseUrls) {
    try {
      const response = await fetch(`${baseUrl}/public/dashboards/${token}`);
      const payload = await response.json();
      if (!payload?.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }
      return payload.data;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("request_failed");
}

// ─── 金蝶 API ─────────────────────────────────────────────────────────────────

export function getKingdeeConnection() {
  return requestJson("/kingdee/connection");
}

export function saveKingdeeConnection(body) {
  return requestJson("/kingdee/connection", { method: "POST", body });
}

export function testKingdeeConnection(body) {
  return requestJson("/kingdee/test-connection", { method: "POST", body });
}

export function getKingdeeReportTemplates() {
  return requestJson("/kingdee/report-templates");
}

export function queryKingdeeData(body) {
  return requestJson("/kingdee/query", { method: "POST", body });
}
