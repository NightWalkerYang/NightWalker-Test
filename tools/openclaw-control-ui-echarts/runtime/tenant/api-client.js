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
          cache: options.cache,
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
    getPublicBranding() {
      return requestJson("/public/branding");
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
    listUpdateLogs() {
      return requestJson("/changelogs", { cache: "no-store" });
    },
    createUpdateLog(body) {
      return requestJson("/platform/changelogs", { method: "POST", body });
    },
    updateUpdateLog(body) {
      return requestJson("/platform/changelogs", { method: "PUT", body });
    },
    deleteUpdateLog(id) {
      return requestJson(withQuery("/platform/changelogs", { id }), { method: "DELETE" });
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
    savePlatformBranding(body) {
      return requestJson("/platform/branding", { method: "PUT", body });
    },
    restorePlatformBranding() {
      return requestJson("/platform/branding", { method: "DELETE" });
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
    revokePlatformTenantAgents(body) {
      return requestJson("/platform/revoke-tenant-agents", { method: "POST", body });
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
    deleteTenantMember(body) {
      return requestJson("/tenant/admin/members/delete", { method: "POST", body });
    },
    listTenantAgents() {
      return requestJson("/tenant/admin/tenant-agents");
    },
    listTenantMemberAssignedAgents(userId) {
      return requestJson(withQuery("/tenant/admin/members/agents", { userId }));
    },
    assignTenantAgents(body) {
      return requestJson("/tenant/admin/assign-agent", { method: "POST", body });
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
    getTenantWallet() {
      return requestJson("/tenant/admin/wallet");
    },
    listTenantPaymentOrders({ page = 1, pageSize = 8, search = "" } = {}) {
      return requestJson(withQuery("/tenant/admin/payment-orders", { page, pageSize, search }));
    },
    listTenantWalletLedger({ page = 1, pageSize = 8, search = "" } = {}) {
      return requestJson(withQuery("/tenant/admin/wallet-ledger", { page, pageSize, search }));
    },
    listTenantWalletFlow({ page = 1, pageSize = 8, search = "" } = {}) {
      return requestJson(withQuery("/tenant/admin/wallet-flow", { page, pageSize, search }));
    },
    createTenantPaymentOrder(body) {
      return requestJson("/tenant/admin/payment-orders", { method: "POST", body });
    },
    queryTenantPaymentOrder(body) {
      return requestJson("/tenant/admin/payment-orders/query", { method: "POST", body });
    },
    transferTenantWalletToAgent(body) {
      return requestJson("/tenant/admin/wallet/transfers", { method: "POST", body });
    },
    listMemberAgents() {
      return requestJson("/member/agents");
    },
    listMemberVisualizations() {
      return requestJson("/member/visualizations", {
        cache: "no-store",
      });
    },
    resolveMemberVisualization(token) {
      return requestJson(withQuery("/member/visualizations/resolve", { token }));
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
