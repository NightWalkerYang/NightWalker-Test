import {
  clearPlatformSession,
  clearTenantSession,
  readPlatformSession,
  readSessionForCurrentView,
  readTenantSession,
  resolveTenantApiBaseCandidates,
  writeTenantApiBaseOverride,
  writeTenantSession,
} from "./tenant-context.js";

function withQuery(path, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const normalized = String(value ?? "").trim();
    if (normalized) {
      query.set(key, normalized);
    }
  }
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function shouldRetryTransportError(error) {
  const message = String(error?.message || error || "")
    .trim()
    .toLowerCase();
  return (
    error instanceof TypeError ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed")
  );
}

async function requestJson(path, options = {}) {
  const baseUrls = resolveTenantApiBaseCandidates();
  const session = options.session || readSessionForCurrentView();
  const headers = {
    "content-type": "application/json",
    ...options.headers,
  };
  if (session?.token) {
    headers.authorization = `Bearer ${session.token}`;
  }

  const maxAttempts = Math.max(1, Number.parseInt(String(options.maxAttempts || "1"), 10) || 1);
  const retryDelayMs = Math.max(0, Number.parseInt(String(options.retryDelayMs || "0"), 10) || 0);
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
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
          const message = payload?.error || `HTTP ${response.status}`;
          throw new Error(message);
        }

        if (baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
          writeTenantApiBaseOverride(baseUrl);
        }
        return payload.data;
      } catch (error) {
        lastError = error;
        if (!shouldRetryTransportError(error)) {
          throw error;
        }
      }
    }
    if (attempt < maxAttempts - 1 && retryDelayMs > 0) {
      await delay(retryDelayMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError || "request_failed"));
}

export function createTenantApiClient() {
  return {
    bootstrap() {
      return requestJson("/bootstrap", {
        maxAttempts: 8,
        retryDelayMs: 300,
      });
    },
    setupPlatformAdmin(body) {
      return requestJson("/setup/platform-admin", { method: "POST", body });
    },
    setupLocalTenantAdmin(body) {
      return requestJson("/setup/local-tenant-admin", { method: "POST", body });
    },
    login(body) {
      return requestJson("/login", { method: "POST", body });
    },
    me(session) {
      return requestJson("/me", { session });
    },
    logout(scope = "current") {
      const session =
        scope === "platform"
          ? readPlatformSession()
          : scope === "tenant"
            ? readTenantSession()
            : readSessionForCurrentView();
      if (scope === "platform") {
        clearPlatformSession();
      } else if (scope === "tenant") {
        clearTenantSession();
      } else if (session?.session?.role === "platform_admin") {
        clearPlatformSession();
      } else {
        clearTenantSession();
      }
      return requestJson("/logout", { method: "POST", session });
    },
    listPlatformTenants() {
      return requestJson("/platform/tenants");
    },
    createTenant(body) {
      return requestJson("/platform/tenants", { method: "POST", body });
    },
    updateTenantMemberLimit(body) {
      return requestJson("/platform/tenant-member-limit", { method: "POST", body });
    },
    listPlatformCatalogAgents() {
      return requestJson("/platform/catalog-agents");
    },
    getLocalLicense() {
      return requestJson("/platform/local-license");
    },
    importLocalLicense(body) {
      return requestJson("/platform/local-license/import", { method: "POST", body });
    },
    renewLocalLicense(body) {
      return requestJson("/platform/local-license/renew", { method: "POST", body });
    },
    listPlatformTenantMembers(tenantId) {
      return requestJson(withQuery("/platform/tenant-members", { tenantId }));
    },
    listPlatformTenantAgents(tenantId) {
      return requestJson(withQuery("/platform/tenant-agents", { tenantId }));
    },
    upsertPlatformTenantAgent(body) {
      return requestJson("/platform/tenant-agents", { method: "POST", body });
    },
    listTenantMembers() {
      return requestJson("/tenant/admin/members");
    },
    createTenantMember(body) {
      return requestJson("/tenant/admin/members", { method: "POST", body });
    },
    updateTenantMemberPassword(body) {
      return requestJson("/tenant/admin/members/password", { method: "POST", body });
    },
    updateTenantMemberStatus(body) {
      return requestJson("/tenant/admin/members/status", { method: "POST", body });
    },
    listTenantAgents() {
      return requestJson("/tenant/admin/tenant-agents");
    },
    assignTenantAgent(body) {
      return requestJson("/tenant/admin/assign-agent", { method: "POST", body });
    },
    revokeTenantAgentAssignments(body) {
      return requestJson("/tenant/admin/revoke-agent-assignments", { method: "POST", body });
    },
    getTenantUsageStats(startDate, endDate) {
      return requestJson(withQuery("/tenant/admin/usage-stats", { startDate, endDate }));
    },
    listTenantUsageStats({ page = 1, pageSize = 8, search = "" } = {}) {
      return requestJson(withQuery("/tenant/admin/usage-stats", { page, pageSize, search }));
    },
    getTenantOverview() {
      return requestJson("/tenant/admin/overview");
    },
    listMemberAgents() {
      return requestJson("/member/agents");
    },
    syncMemberUsageRecords(body) {
      return requestJson("/member/usage-records/sync", { method: "POST", body });
    },
    listMemberSessions(tenantAgentId) {
      return requestJson(withQuery("/member/sessions", { tenantAgentId }));
    },
    registerMemberSession(body) {
      return requestJson("/member/sessions", { method: "POST", body });
    },
    hideMemberSession(body) {
      return requestJson("/member/sessions/hide", { method: "POST", body });
    },
    deleteMemberSession(body) {
      return requestJson("/member/sessions/delete", { method: "POST", body });
    },
    persistSession(payload) {
      writeTenantSession(payload);
    },
  };
}
