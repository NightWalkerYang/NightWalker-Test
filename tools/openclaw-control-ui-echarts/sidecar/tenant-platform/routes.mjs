import fs from "node:fs";
import path from "node:path";
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
  assignTenantAgentsToUser,
  listAssignedAgentsForUser,
  listAssignedAgentVisualizationsForUser,
  listTenants,
  listTenantAgents,
  listTenantMembers,
  listTenantUsageStats,
  listTenantUsageRecords,
  getTenantOverview,
  logAudit,
  readOpenClawAgentCatalog,
  registerTenantAgentSession,
  revokeTenantAgentAssignments,
  syncTenantUsageRecords,
  updateTenantMemberLimit,
  updateTenantMemberPassword,
  updateTenantMemberStatus,
  upsertTenantAgent,
  hideTenantAgentSession,
  listTenantAgentSessions,
} from "./db.mjs";
import { applyLocalRenewalCode, importLocalLicense, readLocalLicenseState } from "./license.mjs";

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
    deploymentMode: config.edition === "local" ? "local" : (tenantContext?.deploymentMode ?? null),
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

function readUserIds(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  }
  const normalized = String(value || "").trim();
  return normalized ? [normalized] : [];
}

function readAssignmentIds(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  }
  const normalized = String(value || "").trim();
  return normalized ? [normalized] : [];
}

function readVisualizationToken(value) {
  return String(value || "").trim();
}

function buildEchartsViewHref(token) {
  return `/echarts-view/?token=${encodeURIComponent(token)}`;
}

function buildWorkspaceAgentDownloadHref(segments) {
  const pathname = Array.isArray(segments) ? segments : [];
  const encoded = pathname
    .map((segment) => encodeURIComponent(String(segment || "").trim()))
    .join("/");
  return `/${encoded}`;
}

function buildWorkspaceAgentDownloadBaseHref(derivedAgentId) {
  return buildWorkspaceAgentDownloadHref([
    "workspace-agent-downloads",
    derivedAgentId,
    "Echarts",
    "",
  ]);
}

function readMemberVisualizationTokenPayload(token, secret) {
  const payload = readSessionToken(token, secret);
  if (!payload || typeof payload !== "object") {
    return null;
  }
  if (String(payload.purpose || "").trim() !== "member_visualization") {
    return null;
  }
  const tenantId = String(payload.tenantId || "").trim();
  const userId = String(payload.userId || "").trim();
  const derivedAgentId = String(payload.derivedAgentId || "").trim();
  const visualizationFileName = String(payload.visualizationFileName || "").trim();
  if (!tenantId || !userId || !derivedAgentId || !visualizationFileName) {
    return null;
  }
  return {
    tenantId,
    userId,
    derivedAgentId,
    visualizationFileName,
  };
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
      const user = getUserByUsername(deps.db, session.username);
      if (user?.status !== "active") {
        sendJson(request, response, 403, { ok: false, error: "account_disabled" });
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
      if (
        !session ||
        !requireEditionRole(request, response, session, deps, ["platform_admin"], ["tenant_admin"])
      ) {
        return;
      }
      sendJson(request, response, 200, { ok: true, data: localLicense });
      return;
    }

    if (request.method === "POST" && relativePath === "/platform/local-license/import") {
      const session = requireSession(request, response, deps);
      if (
        !session ||
        !requireEditionRole(request, response, session, deps, ["platform_admin"], ["tenant_admin"])
      ) {
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
      if (
        !session ||
        !requireEditionRole(request, response, session, deps, ["platform_admin"], ["tenant_admin"])
      ) {
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
          deploymentMode:
            deps.config.edition === "local"
              ? "local"
              : body.deploymentMode === "local"
                ? "local"
                : "cloud",
          licenseExpiresAt:
            deps.config.edition === "local"
              ? null
              : String(body.licenseExpiresAt || "").trim() || null,
          renewalCode:
            deps.config.edition === "local" ? null : String(body.renewalCode || "").trim() || null,
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
              : Number.parseFloat(String(body.rateMultiplier || "1")) || 1,
          balancePoints:
            deps.config.edition === "local"
              ? 0
              : Number.parseFloat(String(body.balancePoints || "0")) || 0,
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
      sendJson(request, response, 200, {
        ok: true,
        data: listTenantMembers(deps.db, session.tenantId),
      });
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

    if (request.method === "POST" && relativePath === "/tenant/admin/members/password") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      if (!requireLocalWritable(request, response, deps)) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const member = updateTenantMemberPassword(deps.db, {
          tenantId: session.tenantId,
          userId: String(body.userId || "").trim(),
          password: String(body.password || ""),
        });
        logAudit(deps.db, {
          userId: session.userId,
          tenantId: session.tenantId,
          action: "tenant.member.password.update",
          resourceType: "member",
          resourceId: member?.id || String(body.userId || "").trim() || null,
          payloadJson: {
            userId: String(body.userId || "").trim(),
            username: member?.username || null,
          },
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

    if (request.method === "POST" && relativePath === "/tenant/admin/members/status") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      if (!requireLocalWritable(request, response, deps)) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const member = updateTenantMemberStatus(deps.db, {
          tenantId: session.tenantId,
          userId: String(body.userId || "").trim(),
          status: String(body.status || "").trim(),
        });
        logAudit(deps.db, {
          userId: session.userId,
          tenantId: session.tenantId,
          action: "tenant.member.status.update",
          resourceType: "member",
          resourceId: member?.id || String(body.userId || "").trim() || null,
          payloadJson: {
            userId: String(body.userId || "").trim(),
            status: member?.status || String(body.status || "").trim() || null,
          },
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
        const tenantAgentIds = readAssignmentIds(body.tenantAgentIds ?? body.tenantAgentId);
        const assignment = assignTenantAgentsToUser(deps.db, {
          tenantId: session.tenantId,
          userId: String(body.userId || "").trim(),
          tenantAgentIds,
          configPath: deps.config.configPath,
          configDir: deps.config.configDir,
        });
        logAudit(deps.db, {
          userId: session.userId,
          tenantId: session.tenantId,
          action: "tenant.member.agent_assignment.assign",
          resourceType: "member",
          resourceId: String(body.userId || "").trim() || null,
          payloadJson: {
            userId: String(body.userId || "").trim(),
            tenantAgentIds,
            assignmentIds: assignment.assignmentIds,
            assignedAssignmentCount: assignment.assignedAssignmentCount,
          },
        });
        sendJson(request, response, 200, {
          ok: true,
          data: {
            assignmentId: assignment.assignmentId,
            derivedAgentId: assignment.derivedAgentId,
            assignmentIds: assignment.assignmentIds,
            derivedAgentIds: assignment.derivedAgentIds,
            assignedAssignmentCount: assignment.assignedAssignmentCount,
            affectedUserIds: assignment.affectedUserIds,
            affectedMemberCount: assignment.affectedMemberCount,
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

    if (request.method === "GET" && relativePath === "/tenant/admin/members/agents") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      const userId = String(url.searchParams.get("userId") || "").trim();
      if (!userId) {
        sendJson(request, response, 400, { ok: false, error: "user_id_required" });
        return;
      }
      const member = deps.db
        .prepare(
          `SELECT u.id
           FROM users u
           JOIN tenant_memberships tm ON tm.user_id = u.id
           WHERE tm.tenant_id = ? AND tm.role = 'member' AND tm.status = 'active' AND u.id = ?`,
        )
        .get(session.tenantId, userId);
      if (!member) {
        sendJson(request, response, 404, { ok: false, error: "member_not_found" });
        return;
      }
      sendJson(request, response, 200, {
        ok: true,
        data: listAssignedAgentsForUser(
          deps.db,
          {
            userId,
            configPath: deps.config.configPath,
            configDir: deps.config.configDir,
          },
          configAgents,
        ),
      });
      return;
    }

    if (request.method === "POST" && relativePath === "/tenant/admin/revoke-agent-assignments") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      if (!requireLocalWritable(request, response, deps)) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const userIds = readUserIds(body.userIds ?? body.userId);
        const assignmentIds = readAssignmentIds(body.assignmentIds ?? body.assignmentId);
        const result = revokeTenantAgentAssignments(deps.db, {
          tenantId: session.tenantId,
          userIds,
          userId: String(body.userId || "").trim(),
          assignmentIds,
        });
        logAudit(deps.db, {
          userId: session.userId,
          tenantId: session.tenantId,
          action: "tenant.member.agent_assignment.revoke",
          resourceType: "member",
          resourceId:
            result.affectedUserIds[0] || String(body.userId || "").trim() || userIds[0] || null,
          payloadJson: {
            userIds,
            assignmentIds,
            affectedUserIds: result.affectedUserIds,
            revokedAssignmentCount: result.revokedAssignmentCount,
          },
        });
        sendJson(request, response, 200, { ok: true, data: result });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "GET" && relativePath === "/tenant/admin/usage-stats") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      try {
        const hasPagedRecordQuery =
          url.searchParams.has("page") ||
          url.searchParams.has("pageSize") ||
          url.searchParams.has("search");
        if (hasPagedRecordQuery) {
          const result = listTenantUsageRecords(deps.db, {
            tenantId: session.tenantId,
            search: url.searchParams.get("search") || "",
            page: url.searchParams.get("page"),
            pageSize: url.searchParams.get("pageSize"),
          });
          const configMap = new Map((configAgents || []).map((entry) => [entry.id, entry]));
          const items = result.items.map((row) => {
            const configEntry = configMap.get(row.agentId) ?? null;
            return {
              ...row,
              agentName: configEntry?.name ?? row.agentId ?? "-",
              agentEmoji: configEntry?.emoji ?? null,
            };
          });
          sendJson(request, response, 200, {
            ok: true,
            data: {
              items,
              total: result.total,
              page: result.page,
              pageSize: result.pageSize,
            },
          });
          return;
        }
        sendJson(request, response, 200, {
          ok: true,
          data: listTenantUsageStats(
            deps.db,
            {
              tenantId: session.tenantId,
              startDate: url.searchParams.get("startDate"),
              endDate: url.searchParams.get("endDate"),
            },
            configAgents,
          ),
        });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "GET" && relativePath === "/tenant/admin/overview") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      try {
        const data = getTenantOverview(deps.db, { tenantId: session.tenantId }, configAgents);
        sendJson(request, response, 200, { ok: true, data });
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
        data: listAssignedAgentsForUser(
          deps.db,
          {
            ...session,
            configPath: deps.config.configPath,
            configDir: deps.config.configDir,
          },
          configAgents,
        ),
      });
      return;
    }

    if (request.method === "GET" && relativePath === "/member/visualizations") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["member"])) {
        return;
      }
      const visualizations = listAssignedAgentVisualizationsForUser(
        deps.db,
        {
          ...session,
          configPath: deps.config.configPath,
          configDir: deps.config.configDir,
        },
        configAgents,
      ).map((item) => {
        const token = issueSessionToken(
          {
            purpose: "member_visualization",
            tenantId: item.tenantId,
            userId: item.userId,
            derivedAgentId: item.derivedAgentId,
            visualizationFileName: item.visualizationFileName,
          },
          deps.config.sessionSecret,
        );
        const title = item.agentName
          ? `${item.visualizationName} · ${item.agentName}`
          : item.visualizationName;
        return {
          id: `${item.derivedAgentId}:${item.visualizationFileName}`,
          agentId: item.derivedAgentId,
          baseAgentId: item.baseAgentId,
          agentName: item.agentName,
          visualizationFileName: item.visualizationFileName,
          visualizationName: item.visualizationName,
          title,
          token,
          href: buildEchartsViewHref(token),
        };
      });
      sendJson(request, response, 200, {
        ok: true,
        data: visualizations,
      });
      return;
    }

    if (request.method === "GET" && relativePath === "/member/visualizations/resolve") {
      const token = readVisualizationToken(url.searchParams.get("token"));
      if (!token) {
        sendJson(request, response, 400, { ok: false, error: "missing_fields" });
        return;
      }
      const payload = readMemberVisualizationTokenPayload(token, deps.config.sessionSecret);
      if (!payload) {
        sendJson(request, response, 401, { ok: false, error: "invalid_token" });
        return;
      }
      const visualizations = listAssignedAgentVisualizationsForUser(
        deps.db,
        {
          tenantId: payload.tenantId,
          userId: payload.userId,
          configPath: deps.config.configPath,
          configDir: deps.config.configDir,
        },
        configAgents,
      );
      const match = visualizations.find(
        (item) =>
          item.derivedAgentId === payload.derivedAgentId &&
          item.visualizationFileName === payload.visualizationFileName,
      );
      if (!match) {
        sendJson(request, response, 404, { ok: false, error: "visualization_not_found" });
        return;
      }
      const visualizationPath = path.join(
        String(match.derivedWorkspaceDir || "").trim(),
        "Echarts",
        match.visualizationFileName,
      );
      try {
        const html = fs.readFileSync(visualizationPath, "utf8");
        sendJson(request, response, 200, {
          ok: true,
          data: {
            html,
            baseHref: buildWorkspaceAgentDownloadBaseHref(match.derivedAgentId),
            href: buildWorkspaceAgentDownloadHref([
              "workspace-agent-downloads",
              match.derivedAgentId,
              "Echarts",
              match.visualizationFileName,
            ]),
            visualizationName: match.visualizationName,
            agentName: match.agentName,
            agentId: match.derivedAgentId,
          },
        });
      } catch {
        sendJson(request, response, 404, {
          ok: false,
          error: "visualization_not_found",
        });
      }
      return;
    }

    if (request.method === "GET" && relativePath === "/member/sessions") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["member"])) {
        return;
      }
      const tenantAgentId = String(url.searchParams.get("tenantAgentId") || "").trim();
      if (!tenantAgentId) {
        sendJson(request, response, 400, { ok: false, error: "tenant_agent_id_required" });
        return;
      }
      sendJson(request, response, 200, {
        ok: true,
        data: listTenantAgentSessions(deps.db, { userId: session.userId, tenantAgentId }),
      });
      return;
    }

    if (request.method === "POST" && relativePath === "/member/sessions") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["member"])) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const tenantAgentId = String(body.tenantAgentId || "").trim();
        const openclawSessionKey = String(body.openclawSessionKey || "").trim();
        if (!tenantAgentId || !openclawSessionKey) {
          sendJson(request, response, 400, { ok: false, error: "missing_fields" });
          return;
        }
        const sessionId = registerTenantAgentSession(deps.db, {
          tenantId: session.tenantId,
          userId: session.userId,
          tenantAgentId,
          openclawSessionKey,
          title: String(body.title || "").trim() || "新会话",
        });
        sendJson(request, response, 200, { ok: true, data: { sessionId } });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/member/usage-records/sync") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["member"])) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const tenantAgentId = String(body.tenantAgentId || "").trim();
        const openclawSessionKey = String(body.openclawSessionKey || "").trim();
        if (!tenantAgentId || !openclawSessionKey) {
          sendJson(request, response, 400, { ok: false, error: "missing_fields" });
          return;
        }
        const result = syncTenantUsageRecords(deps.db, {
          tenantId: session.tenantId,
          userId: session.userId,
          tenantAgentId,
          openclawSessionKey,
          records: Array.isArray(body.records) ? body.records : [],
        });
        sendJson(request, response, 200, { ok: true, data: result });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/member/sessions/hide") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["member"])) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const openclawSessionKey = String(body.openclawSessionKey || "").trim();
        if (!openclawSessionKey) {
          sendJson(request, response, 400, { ok: false, error: "missing_fields" });
          return;
        }
        hideTenantAgentSession(deps.db, {
          userId: session.userId,
          openclawSessionKey,
        });
        sendJson(request, response, 200, { ok: true });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/member/sessions/delete") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["member"])) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const openclawSessionKey = String(body.openclawSessionKey || "").trim();
        if (!openclawSessionKey) {
          sendJson(request, response, 400, { ok: false, error: "missing_fields" });
          return;
        }
        deps.db.exec("BEGIN TRANSACTION");
        try {
          deps.db
            .prepare(
              `DELETE FROM tenant_agent_sessions
             WHERE user_id = @userId AND openclaw_session_key = @openclawSessionKey`,
            )
            .run({
              userId: session.userId,
              openclawSessionKey,
            });
          deps.db.exec("COMMIT");
          sendJson(request, response, 200, { ok: true });
        } catch (err) {
          deps.db.exec("ROLLBACK");
          throw err;
        }
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    sendJson(request, response, 404, { ok: false, error: "not_found" });
  };
}
