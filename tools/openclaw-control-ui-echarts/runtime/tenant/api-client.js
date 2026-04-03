import {
  clearPlatformSession,
  clearTenantSession,
  readPlatformSession,
  readSessionForCurrentView,
  readTenantSession,
  resolveTenantApiBaseUrl,
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

async function requestJson(path, options = {}) {
  const baseUrl = resolveTenantApiBaseUrl().replace(/\/$/, "");
  const session = options.session || readSessionForCurrentView();
  const headers = {
    "content-type": "application/json",
    ...(options.headers || {}),
  };
  if (session?.token) {
    headers.authorization = `Bearer ${session.token}`;
  }

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
  return payload.data;
}

export function createTenantApiClient() {
  return {
    bootstrap() {
      return requestJson("/bootstrap");
    },
    setupPlatformAdmin(body) {
      return requestJson("/setup/platform-admin", { method: "POST", body });
    },
    login(body) {
      return requestJson("/login", { method: "POST", body });
    },
    me() {
      return requestJson("/me");
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
    listTenantAgents() {
      return requestJson("/tenant/admin/tenant-agents");
    },
    assignTenantAgent(body) {
      return requestJson("/tenant/admin/assign-agent", { method: "POST", body });
    },
    listMemberAgents() {
      return requestJson("/member/agents");
    },
    persistSession(payload) {
      writeTenantSession(payload);
    },
  };
}
