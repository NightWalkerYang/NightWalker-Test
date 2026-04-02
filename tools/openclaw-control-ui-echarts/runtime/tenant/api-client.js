import {
  clearTenantSession,
  readTenantSession,
  resolveTenantApiBaseUrl,
  writeTenantSession,
} from "./tenant-context.js";

async function requestJson(path, options = {}) {
  const baseUrl = resolveTenantApiBaseUrl().replace(/\/$/, "");
  const session = readTenantSession();
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
    logout() {
      clearTenantSession();
      return requestJson("/logout", { method: "POST" });
    },
    listPlatformTenants() {
      return requestJson("/platform/tenants");
    },
    createTenant(body) {
      return requestJson("/platform/tenants", { method: "POST", body });
    },
    listTenantMembers() {
      return requestJson("/tenant/admin/members");
    },
    createTenantMember(body) {
      return requestJson("/tenant/admin/members", { method: "POST", body });
    },
    listCatalogAgents() {
      return requestJson("/tenant/admin/catalog-agents");
    },
    listTenantAgents() {
      return requestJson("/tenant/admin/tenant-agents");
    },
    upsertTenantAgent(body) {
      return requestJson("/tenant/admin/tenant-agents", { method: "POST", body });
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

