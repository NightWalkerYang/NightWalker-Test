import { issueSessionToken, readSessionToken, verifyPassword } from "./auth.mjs";
import {
  createBootstrapLocalTenantAdmin,
  assignTenantAgentToUser,
  createBootstrapPlatformAdmin,
  createTenantMember,
  createTenantWithAdmin,
  getBootstrapStatus,
  getTenantContextForUser,
  getUserByUsername,
  listAssignedAgentsForUser,
  listTenants,
  listTenantAgents,
  listTenantMembers,
  logAudit,
  readOpenClawAgentCatalog,
  updateTenantMemberLimit,
  upsertTenantAgent,
} from "./db.mjs";
import {
  applyLocalRenewalCode,
  importLocalLicense,
  readLocalLicenseState,
} from "./license.mjs";

function sendJson(request, response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": request.headers.origin || "*",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET, POST, OPTIONS",
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8").trim();
        resolve(text ? JSON.parse(text) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function buildSessionPayload(user, tenantContext, config, localLicenseState) {
  const localReadonly = Boolean(config.edition === "local" && localLicenseState?.readonly);
  return {
    userId: user.id,
    username: user.username,
    role: user.role,
    tenantId: tenantContext?.tenantId ?? null,
    tenantName: tenantContext?.tenantName ?? null,
    deploymentMode:
      config.edition === "local" ? "local" : (tenantContext?.deploymentMode ?? null),
    readonly: localReadonly,
    edition: config.edition,
    licenseStatus: localLicenseState?.status ?? null,
    licenseExpiresAt: localLicenseState?.expiresAt ?? tenantContext?.licenseExpiresAt ?? null,
    customerName: localLicenseState?.customerName ?? null,
  };
}

function parseBearerToken(request) {
  const header = String(request.headers.authorization || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return header.slice(7).trim() || null;
}

function requireSession(request, response, deps) {
  const token = parseBearerToken(request);
  if (!token) {
    sendJson(request, response, 401, { ok: false, error: "missing_token" });
    return null;
  }
  const session = readSessionToken(token, deps.config.sessionSecret);
  if (!session?.userId) {
    sendJson(request, response, 401, { ok: false, error: "invalid_token" });
    return null;
  }
  return session;
}

function requireRole(request, response, session, allowedRoles) {
  if (!allowedRoles.includes(session.role)) {
    sendJson(request, response, 403, { ok: false, error: "forbidden" });
    return false;
  }
  return true;
}

function requireEditionRole(request, response, session, deps, cloudRoles, localRoles = cloudRoles) {
  const allowedRoles = deps.config.edition === "local" ? localRoles : cloudRoles;
  return requireRole(request, response, session, allowedRoles);
}

function requireLocalWritable(request, response, deps) {
  if (deps.config.edition !== "local") {
    return true;
  }
  const localLicense = readLocalLicenseState(deps.config);
  if (localLicense.status === "active") {
    return true;
  }
  sendJson(request, response, 403, {
    ok: false,
    error: localLicense.status === "expired" ? "license_readonly" : "license_unavailable",
    data: {
      localLicense,
    },
  });
  return false;
}

function normalizePath(basePath, pathname) {
  if (!pathname.startsWith(basePath)) {
    return null;
  }
  return pathname.slice(basePath.length) || "/";
}

function readTenantId(value) {
  return String(value || "").trim();
}

export function createTenantPlatformRouter(deps) {
  return async function handleTenantPlatformRequest(request, response) {
    const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
    const relativePath = normalizePath(deps.config.apiBasePath, url.pathname);
    const configAgents = readOpenClawAgentCatalog(deps.config.configPath);
    const localLicense = readLocalLicenseState(deps.config);

    if (request.method === "OPTIONS") {
      sendJson(request, response, 204, {});
      return;
    }

    if (url.pathname === "/healthz") {
      sendJson(request, response, 200, { ok: true });
      return;
    }

    if (!relativePath) {
      sendJson(request, response, 404, { ok: false, error: "not_found" });
      return;
    }

    if (request.method === "GET" && relativePath === "/bootstrap") {
      sendJson(request, response, 200, {
        ok: true,
        data: {
          ...getBootstrapStatus(deps.db, deps.config.edition),
          apiBasePath: deps.config.apiBasePath,
          edition: deps.config.edition,
          localLicense,
          configAgents,
        },
      });
      return;
    }

    if (request.method === "POST" && relativePath === "/setup/platform-admin") {
      if (deps.config.edition === "local") {
        sendJson(request, response, 400, { ok: false, error: "local_edition_uses_tenant_admin" });
        return;
      }
      try {
        const body = await readJsonBody(request);
        const user = createBootstrapPlatformAdmin(deps.db, {
          username: String(body.username || "").trim(),
          password: String(body.password || ""),
        });
        const session = buildSessionPayload(user, null, deps.config, localLicense);
        sendJson(request, response, 200, {
          ok: true,
          data: {
            token: issueSessionToken(session, deps.config.sessionSecret),
            session,
          },
        });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/setup/local-tenant-admin") {
      if (deps.config.edition !== "local") {
        sendJson(request, response, 400, { ok: false, error: "local_edition_required" });
        return;
      }
      try {
        const body = await readJsonBody(request);
        const user = createBootstrapLocalTenantAdmin(deps.db, {
          username: String(body.username || "").trim(),
          password: String(body.password || ""),
          tenantName: localLicense.customerName || "本地租户",
        });
        const tenantContext = getTenantContextForUser(deps.db, user.id);
        const session = buildSessionPayload(user, tenantContext, deps.config, localLicense);
        sendJson(request, response, 200, {
          ok: true,
          data: {
            token: issueSessionToken(session, deps.config.sessionSecret),
            session,
          },
        });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/login") {
      try {
        const body = await readJsonBody(request);
        const user = getUserByUsername(deps.db, String(body.username || "").trim());
        if (!user || !verifyPassword(String(body.password || ""), user.password_hash)) {
          sendJson(request, response, 401, { ok: false, error: "invalid_credentials" });
          return;
        }
        if (user.status !== "active") {
          sendJson(request, response, 403, { ok: false, error: "account_disabled" });
          return;
        }
        const tenantContext = user.tenantId ? getTenantContextForUser(deps.db, user.id) : null;
        if (
          deps.config.edition === "local" &&
          user.role === "member" &&
          (localLicense.status === "missing" || localLicense.status === "invalid")
        ) {
          sendJson(request, response, 403, {
            ok: false,
            error: "license_unavailable",
            data: { localLicense },
          });
          return;
        }
        if (tenantContext?.tenantStatus === "frozen") {
          sendJson(request, response, 403, { ok: false, error: "tenant_frozen" });
          return;
        }
        const session = buildSessionPayload(user, tenantContext, deps.config, localLicense);
        sendJson(request, response, 200, {
          ok: true,
          data: {
            token: issueSessionToken(session, deps.config.sessionSecret),
            session,
          },
        });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/logout") {
      sendJson(request, response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && relativePath === "/me") {
      const session = requireSession(request, response, deps);
      if (!session) {
        return;
      }
      const tenant = session.tenantId ? getTenantContextForUser(deps.db, session.userId) : null;
      sendJson(request, response, 200, {
        ok: true,
        data: {
          session,
          tenant,
          edition: deps.config.edition,
          localLicense,
        },
      });
      return;
    }

    if (request.method === "GET" && relativePath === "/platform/local-license") {
      const session = requireSession(request, response, deps);
      if (!session || !requireEditionRole(request, response, session, deps, ["platform_admin"], ["tenant_admin"])) {
        return;
      }
      sendJson(request, response, 200, { ok: true, data: localLicense });
      return;
    }

    if (request.method === "POST" && relativePath === "/platform/local-license/import") {
      const session = requireSession(request, response, deps);
      if (!session || !requireEditionRole(request, response, session, deps, ["platform_admin"], ["tenant_admin"])) {
        return;
      }
      if (deps.config.edition !== "local") {
        sendJson(request, response, 400, { ok: false, error: "local_edition_required" });
        return;
      }
      try {
        const body = await readJsonBody(request);
        const nextLicense = importLocalLicense(deps.config, body.licenseText || body.license);
        sendJson(request, response, 200, { ok: true, data: nextLicense });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/platform/local-license/renew") {
      const session = requireSession(request, response, deps);
      if (!session || !requireEditionRole(request, response, session, deps, ["platform_admin"], ["tenant_admin"])) {
        return;
      }
      if (deps.config.edition !== "local") {
        sendJson(request, response, 400, { ok: false, error: "local_edition_required" });
        return;
      }
      try {
        const body = await readJsonBody(request);
        const nextLicense = applyLocalRenewalCode(deps.config, body.renewalCode);
        sendJson(request, response, 200, { ok: true, data: nextLicense });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "GET" && relativePath === "/platform/tenants") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["platform_admin"])) {
        return;
      }
      sendJson(request, response, 200, { ok: true, data: listTenants(deps.db) });
      return;
    }

    if (request.method === "POST" && relativePath === "/platform/tenants") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["platform_admin"])) {
        return;
      }
      if (!requireLocalWritable(request, response, deps)) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const tenant = createTenantWithAdmin(deps.db, {
          code: String(body.code || "").trim(),
          name: String(body.name || "").trim(),
          adminUsername: String(body.adminUsername || "").trim(),
          adminPassword: String(body.adminPassword || ""),
          memberLimit: Number.parseInt(String(body.memberLimit || "5"), 10),
          deploymentMode: deps.config.edition === "local" ? "local" : (body.deploymentMode === "local" ? "local" : "cloud"),
          licenseExpiresAt:
            deps.config.edition === "local" ? null : (String(body.licenseExpiresAt || "").trim() || null),
          renewalCode:
            deps.config.edition === "local" ? null : (String(body.renewalCode || "").trim() || null),
        });
        logAudit(deps.db, {
          userId: session.userId,
          action: "tenant.create",
          resourceType: "tenant",
          resourceId: tenant.id,
          payloadJson: { code: tenant.code, name: tenant.name },
        });
        sendJson(request, response, 200, { ok: true, data: tenant });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/platform/tenant-member-limit") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["platform_admin"])) {
        return;
      }
      if (!requireLocalWritable(request, response, deps)) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const tenant = updateTenantMemberLimit(deps.db, {
          tenantId: body.tenantId,
          memberLimit: body.memberLimit,
        });
        logAudit(deps.db, {
          userId: session.userId,
          action: "tenant.member_limit.update",
          resourceType: "tenant",
          resourceId: tenant?.id || null,
          payloadJson: {
            tenantId: body.tenantId,
            memberLimit: body.memberLimit,
          },
        });
        sendJson(request, response, 200, { ok: true, data: tenant });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "GET" && relativePath === "/platform/catalog-agents") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["platform_admin"])) {
        return;
      }
      sendJson(request, response, 200, { ok: true, data: configAgents });
      return;
    }

    if (request.method === "GET" && relativePath === "/platform/tenant-members") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["platform_admin"])) {
        return;
      }
      const tenantId = readTenantId(url.searchParams.get("tenantId"));
      if (!tenantId) {
        sendJson(request, response, 400, { ok: false, error: "tenant_id_required" });
        return;
      }
      sendJson(request, response, 200, { ok: true, data: listTenantMembers(deps.db, tenantId) });
      return;
    }

    if (request.method === "GET" && relativePath === "/platform/tenant-agents") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["platform_admin"])) {
        return;
      }
      const tenantId = readTenantId(url.searchParams.get("tenantId"));
      if (!tenantId) {
        sendJson(request, response, 400, { ok: false, error: "tenant_id_required" });
        return;
      }
      sendJson(request, response, 200, {
        ok: true,
        data: listTenantAgents(deps.db, tenantId, configAgents),
      });
      return;
    }

    if (request.method === "POST" && relativePath === "/platform/tenant-agents") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["platform_admin"])) {
        return;
      }
      if (!requireLocalWritable(request, response, deps)) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const tenantId = readTenantId(body.tenantId);
        if (!tenantId) {
          sendJson(request, response, 400, { ok: false, error: "tenant_id_required" });
          return;
        }
        const tenantAgentId = upsertTenantAgent(deps.db, {
          tenantId,
          agentId: String(body.agentId || "").trim(),
          description: String(body.description || "").trim(),
          rateMultiplier:
            deps.config.edition === "local"
              ? 1
              : (Number.parseFloat(String(body.rateMultiplier || "1")) || 1),
          balancePoints:
            deps.config.edition === "local"
              ? 0
              : (Number.parseFloat(String(body.balancePoints || "0")) || 0),
          status: "active",
        });
        const agent = listTenantAgents(deps.db, tenantId, configAgents).find(
          (item) => item.id === tenantAgentId,
        );
        sendJson(request, response, 200, { ok: true, data: agent ?? null });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "GET" && relativePath === "/tenant/admin/members") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      sendJson(request, response, 200, { ok: true, data: listTenantMembers(deps.db, session.tenantId) });
      return;
    }

    if (request.method === "POST" && relativePath === "/tenant/admin/members") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      if (!requireLocalWritable(request, response, deps)) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const member = createTenantMember(deps.db, {
          tenantId: session.tenantId,
          username: String(body.username || "").trim(),
          password: String(body.password || ""),
        });
        sendJson(request, response, 200, { ok: true, data: member });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "GET" && relativePath === "/tenant/admin/tenant-agents") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      sendJson(request, response, 200, {
        ok: true,
        data: listTenantAgents(deps.db, session.tenantId, configAgents),
      });
      return;
    }

    if (request.method === "POST" && relativePath === "/tenant/admin/assign-agent") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      if (!requireLocalWritable(request, response, deps)) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const assignmentId = assignTenantAgentToUser(deps.db, {
          tenantId: session.tenantId,
          userId: String(body.userId || "").trim(),
          tenantAgentId: String(body.tenantAgentId || "").trim(),
        });
        sendJson(request, response, 200, { ok: true, data: { assignmentId } });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "GET" && relativePath === "/member/agents") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["member"])) {
        return;
      }
      sendJson(request, response, 200, {
        ok: true,
        data: listAssignedAgentsForUser(deps.db, session, configAgents),
      });
      return;
    }

    sendJson(request, response, 404, { ok: false, error: "not_found" });
  };
}
