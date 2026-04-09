import fs from "node:fs";
import crypto from "node:crypto";
import JSON5 from "json5";
import { DatabaseSync } from "node:sqlite";
import { ensureTenantPlatformDirs } from "./config.mjs";
import { hashPassword } from "./auth.mjs";

const MIGRATION_PATH = new URL("./migrations/001_init.sql", import.meta.url);
const LOCAL_BOOTSTRAP_TENANT_CODE = "local";
const LOCAL_BOOTSTRAP_TENANT_NAME = "本地租户";
const LOCAL_BOOTSTRAP_MEMBER_LIMIT = 999;

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function getScalar(db, sql, params = {}) {
  const row = db.prepare(sql).get(params);
  if (!row) {
    return null;
  }
  const [firstKey] = Object.keys(row);
  return firstKey ? row[firstKey] : null;
}

function runInTransaction(db, fn) {
  db.exec("BEGIN IMMEDIATE;");
  try {
    const result = fn();
    db.exec("COMMIT;");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK;");
    } catch {
      // Ignore rollback failures so the original error is preserved.
    }
    throw error;
  }
}

function normalizeAgentIdentity(agent) {
  const identity = agent?.identity && typeof agent.identity === "object" ? agent.identity : {};
  const name =
    (typeof agent?.name === "string" && agent.name.trim()) ||
    (typeof identity.name === "string" && identity.name.trim()) ||
    String(agent?.id ?? "main");
  return {
    id: String(agent?.id ?? "main").trim() || "main",
    name,
    emoji: typeof identity.emoji === "string" ? identity.emoji.trim() || null : null,
    avatar: typeof identity.avatar === "string" ? identity.avatar.trim() || null : null,
  };
}

export function readOpenClawAgentCatalog(configPath) {
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON5.parse(raw);
    const list = Array.isArray(parsed?.agents?.list) ? parsed.agents.list : [];
    if (list.length === 0) {
      return [{ id: "main", name: "main", emoji: null, avatar: null }];
    }
    return list.map(normalizeAgentIdentity).filter((entry) => Boolean(entry.id));
  } catch {
    return [{ id: "main", name: "main", emoji: null, avatar: null }];
  }
}

export function openTenantPlatformDb(config) {
  ensureTenantPlatformDirs(config);
  const db = new DatabaseSync(config.dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(fs.readFileSync(MIGRATION_PATH, "utf8"));
  return db;
}

export function closeTenantPlatformDb(db) {
  if (db && typeof db.close === "function") {
    db.close();
  }
}

export function getBootstrapStatus(db, edition = "cloud") {
  const normalizedEdition = String(edition || "cloud").trim().toLowerCase();
  const platformAdminCount = Number(
    getScalar(db, "SELECT COUNT(*) AS value FROM users WHERE role = 'platform_admin'") || 0,
  );
  const localTenantAdminCount = Number(
    getScalar(
      db,
      `SELECT COUNT(*) AS value
       FROM tenant_memberships tm
       JOIN tenants t ON t.id = tm.tenant_id
       WHERE tm.role = 'tenant_admin' AND t.deployment_mode = 'local'`,
    ) || 0,
  );
  return {
    initialized: normalizedEdition === "local" ? localTenantAdminCount > 0 : platformAdminCount > 0,
    platformAdminCount,
    localTenantAdminCount,
  };
}

export function createBootstrapPlatformAdmin(db, params) {
  if (getBootstrapStatus(db, "cloud").initialized) {
    throw new Error("平台管理员已初始化");
  }
  const now = nowIso();
  const userId = createId("user");
  db.prepare(
    `INSERT INTO users (id, username, password_hash, role, status, created_at, updated_at)
     VALUES (@id, @username, @passwordHash, 'platform_admin', 'active', @createdAt, @updatedAt)`,
  ).run({
    id: userId,
    username: params.username.trim(),
    passwordHash: hashPassword(params.password),
    createdAt: now,
    updatedAt: now,
  });
  return getUserByUsername(db, params.username);
}

export function createBootstrapLocalTenantAdmin(db, params) {
  if (getBootstrapStatus(db, "local").initialized) {
    throw new Error("本地租户管理员已初始化");
  }
  createTenantWithAdmin(db, {
    code: LOCAL_BOOTSTRAP_TENANT_CODE,
    name: String(params.tenantName || "").trim() || LOCAL_BOOTSTRAP_TENANT_NAME,
    adminUsername: params.username.trim(),
    adminPassword: params.password,
    memberLimit: LOCAL_BOOTSTRAP_MEMBER_LIMIT,
    deploymentMode: "local",
    licenseExpiresAt: null,
    renewalCode: null,
  });
  return getUserByUsername(db, params.username);
}

export function getTenantContextForUser(db, userId) {
  return (
    db.prepare(
      `SELECT t.id AS tenantId, t.name AS tenantName, t.code AS tenantCode, t.status AS tenantStatus,
              t.deployment_mode AS deploymentMode, tm.role AS membershipRole, tm.status AS membershipStatus,
              tq.member_limit AS memberLimit, tq.license_expires_at AS licenseExpiresAt,
              tw.balance_points AS walletBalance
       FROM tenant_memberships tm
       JOIN tenants t ON t.id = tm.tenant_id
       LEFT JOIN tenant_quotas tq ON tq.tenant_id = t.id
       LEFT JOIN tenant_wallets tw ON tw.tenant_id = t.id
       WHERE tm.user_id = ?
       ORDER BY tm.created_at ASC
       LIMIT 1`,
    ).get(userId) ?? null
  );
}

export function getUserByUsername(db, username) {
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username.trim());
  if (!user) {
    return null;
  }
  const tenantContext = getTenantContextForUser(db, user.id);
  return {
    ...user,
    tenantId: tenantContext?.tenantId ?? null,
    tenantName: tenantContext?.tenantName ?? null,
    tenantCode: tenantContext?.tenantCode ?? null,
    tenantStatus: tenantContext?.tenantStatus ?? null,
    deploymentMode: tenantContext?.deploymentMode ?? null,
    memberLimit: tenantContext?.memberLimit ?? null,
    licenseExpiresAt: tenantContext?.licenseExpiresAt ?? null,
    membershipRole: tenantContext?.membershipRole ?? null,
    membershipStatus: tenantContext?.membershipStatus ?? null,
  };
}

export function getTenantSummary(db, tenantId) {
  return (
    db.prepare(
      `SELECT t.id, t.code, t.name, t.status, t.deployment_mode AS deploymentMode,
              tq.member_limit AS memberLimit, tq.license_expires_at AS licenseExpiresAt,
              tw.balance_points AS walletBalance,
              COUNT(DISTINCT CASE WHEN tm.role = 'member' AND tm.status = 'active' THEN tm.user_id END) AS memberCount,
              COUNT(DISTINCT CASE WHEN ta.status = 'active' THEN ta.id END) AS agentCount
       FROM tenants t
       LEFT JOIN tenant_quotas tq ON tq.tenant_id = t.id
       LEFT JOIN tenant_wallets tw ON tw.tenant_id = t.id
       LEFT JOIN tenant_memberships tm ON tm.tenant_id = t.id
       LEFT JOIN tenant_agents ta ON ta.tenant_id = t.id
       WHERE t.id = ?
       GROUP BY t.id, tq.member_limit, tq.license_expires_at, tw.balance_points`,
    ).get(tenantId) ?? null
  );
}

export function listTenants(db) {
  return db
    .prepare(
      `SELECT t.id, t.code, t.name, t.status, t.deployment_mode AS deploymentMode,
              tq.member_limit AS memberLimit, tq.license_expires_at AS licenseExpiresAt,
              tw.balance_points AS walletBalance,
              COUNT(DISTINCT CASE WHEN tm.role = 'member' AND tm.status = 'active' THEN tm.user_id END) AS memberCount,
              COUNT(DISTINCT CASE WHEN ta.status = 'active' THEN ta.id END) AS agentCount
       FROM tenants t
       LEFT JOIN tenant_quotas tq ON tq.tenant_id = t.id
       LEFT JOIN tenant_wallets tw ON tw.tenant_id = t.id
       LEFT JOIN tenant_memberships tm ON tm.tenant_id = t.id
       LEFT JOIN tenant_agents ta ON ta.tenant_id = t.id
       GROUP BY t.id, tq.member_limit, tq.license_expires_at, tw.balance_points
       ORDER BY t.created_at DESC`,
    )
    .all();
}

export function createTenantWithAdmin(db, params) {
  const tenantId = runInTransaction(db, () => {
    const now = nowIso();
    const tenantId = createId("tenant");
    const adminUserId = createId("user");
    const membershipId = createId("membership");

    db.prepare(
      `INSERT INTO tenants (id, code, name, status, deployment_mode, created_at, updated_at)
       VALUES (@id, @code, @name, 'active', @deploymentMode, @createdAt, @updatedAt)`,
    ).run({
      id: tenantId,
      code: params.code.trim(),
      name: params.name.trim(),
      deploymentMode: params.deploymentMode === "local" ? "local" : "cloud",
      createdAt: now,
      updatedAt: now,
    });

    db.prepare(
      `INSERT INTO users (id, username, password_hash, role, status, created_at, updated_at)
       VALUES (@id, @username, @passwordHash, 'tenant_admin', 'active', @createdAt, @updatedAt)`,
    ).run({
      id: adminUserId,
      username: params.adminUsername.trim(),
      passwordHash: hashPassword(params.adminPassword),
      createdAt: now,
      updatedAt: now,
    });

    db.prepare(
      `INSERT INTO tenant_memberships (id, tenant_id, user_id, role, status, created_at)
       VALUES (@id, @tenantId, @userId, 'tenant_admin', 'active', @createdAt)`,
    ).run({
      id: membershipId,
      tenantId,
      userId: adminUserId,
      createdAt: now,
    });

    db.prepare(
      `INSERT INTO tenant_quotas (tenant_id, member_limit, license_expires_at, renewal_code, readonly_after_expiry, created_at, updated_at)
       VALUES (@tenantId, @memberLimit, @licenseExpiresAt, @renewalCode, 1, @createdAt, @updatedAt)`,
    ).run({
      tenantId,
      memberLimit: Number.isFinite(params.memberLimit) ? params.memberLimit : 5,
      licenseExpiresAt: params.licenseExpiresAt || null,
      renewalCode: params.renewalCode || null,
      createdAt: now,
      updatedAt: now,
    });

    db.prepare(
      `INSERT INTO tenant_wallets (tenant_id, balance_points, created_at, updated_at)
       VALUES (@tenantId, 0, @createdAt, @updatedAt)`,
    ).run({
      tenantId,
      createdAt: now,
      updatedAt: now,
    });

    return tenantId;
  });

  return getTenantSummary(db, tenantId);
}

export function updateTenantMemberLimit(db, params) {
  const tenantId = String(params.tenantId || "").trim();
  const memberLimit = Number.parseInt(String(params.memberLimit || ""), 10);
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }
  if (!Number.isFinite(memberLimit) || memberLimit < 1) {
    throw new Error("member_limit_invalid");
  }

  const currentMembers = countTenantMembers(db, tenantId);
  if (currentMembers > memberLimit) {
    throw new Error("member_limit_below_current_members");
  }

  db.prepare(
    `UPDATE tenant_quotas
     SET member_limit = @memberLimit,
         updated_at = @updatedAt
     WHERE tenant_id = @tenantId`,
  ).run({
    tenantId,
    memberLimit,
    updatedAt: nowIso(),
  });

  return getTenantSummary(db, tenantId);
}

export function countTenantMembers(db, tenantId) {
  return Number(
    getScalar(
      db,
      `SELECT COUNT(*) AS value
       FROM tenant_memberships
       WHERE tenant_id = @tenantId AND role = 'member' AND status = 'active'`,
      { tenantId },
    ) || 0,
  );
}

export function createTenantMember(db, params) {
  const quota = db
    .prepare("SELECT member_limit AS memberLimit FROM tenant_quotas WHERE tenant_id = ?")
    .get(params.tenantId);
  if (!quota) {
    throw new Error("租户额度不存在");
  }
  if (countTenantMembers(db, params.tenantId) >= Number(quota.memberLimit || 0)) {
    throw new Error("租户人数已达上限");
  }

  const userId = runInTransaction(db, () => {
    const now = nowIso();
    const userId = createId("user");
    const membershipId = createId("membership");

    db.prepare(
      `INSERT INTO users (id, username, password_hash, role, status, created_at, updated_at)
       VALUES (@id, @username, @passwordHash, 'member', 'active', @createdAt, @updatedAt)`,
    ).run({
      id: userId,
      username: params.username.trim(),
      passwordHash: hashPassword(params.password),
      createdAt: now,
      updatedAt: now,
    });

    db.prepare(
      `INSERT INTO tenant_memberships (id, tenant_id, user_id, role, status, created_at)
       VALUES (@id, @tenantId, @userId, 'member', 'active', @createdAt)`,
    ).run({
      id: membershipId,
      tenantId: params.tenantId,
      userId,
      createdAt: now,
    });

    return userId;
  });

  return (
    db.prepare(
      `SELECT u.id, u.username, u.status, tm.role, tm.created_at AS createdAt
       FROM users u
       JOIN tenant_memberships tm ON tm.user_id = u.id
       WHERE u.id = ?`,
    ).get(userId) ?? null
  );
}

export function listTenantMembers(db, tenantId) {
  return db
    .prepare(
      `SELECT u.id, u.username, u.status,
              tm.role, tm.created_at AS createdAt,
              COUNT(DISTINCT ua.tenant_agent_id) AS assignedAgentCount
       FROM users u
       JOIN tenant_memberships tm ON tm.user_id = u.id
       LEFT JOIN user_agent_assignments ua ON ua.user_id = u.id AND ua.status = 'active'
       WHERE tm.tenant_id = ? AND tm.role = 'member'
       GROUP BY u.id, tm.role, tm.created_at
       ORDER BY tm.created_at DESC`,
    )
    .all(tenantId);
}

export function upsertTenantAgent(db, params) {
  const existing = db
    .prepare(
      "SELECT id, balance_points AS balancePoints FROM tenant_agents WHERE tenant_id = ? AND agent_id = ?",
    )
    .get(params.tenantId, params.agentId);
  const now = nowIso();

  if (existing) {
    db.prepare(
      `UPDATE tenant_agents
       SET description = @description,
           rate_multiplier = @rateMultiplier,
           status = @status,
           balance_points = @balancePoints,
           updated_at = @updatedAt
       WHERE id = @id`,
    ).run({
      id: existing.id,
      description: params.description || "",
      rateMultiplier: params.rateMultiplier ?? 1,
      status: params.status || "active",
      balancePoints: params.balancePoints ?? existing.balancePoints ?? 0,
      updatedAt: now,
    });
    return existing.id;
  }

  const tenantAgentId = createId("tenant_agent");
  db.prepare(
    `INSERT INTO tenant_agents (id, tenant_id, agent_id, description, rate_multiplier, status, balance_points, created_at, updated_at)
     VALUES (@id, @tenantId, @agentId, @description, @rateMultiplier, @status, @balancePoints, @createdAt, @updatedAt)`,
  ).run({
    id: tenantAgentId,
    tenantId: params.tenantId,
    agentId: params.agentId,
    description: params.description || "",
    rateMultiplier: params.rateMultiplier ?? 1,
    status: params.status || "active",
    balancePoints: params.balancePoints ?? 0,
    createdAt: now,
    updatedAt: now,
  });
  return tenantAgentId;
}

export function listTenantAgents(db, tenantId, configAgents = []) {
  const configMap = new Map(configAgents.map((entry) => [entry.id, entry]));
  return db
    .prepare(
      `SELECT id, agent_id AS agentId, description, rate_multiplier AS rateMultiplier,
              status, balance_points AS balancePoints, created_at AS createdAt, updated_at AS updatedAt
       FROM tenant_agents
       WHERE tenant_id = ?
       ORDER BY created_at DESC`,
    )
    .all(tenantId)
    .map((row) => {
      const configEntry = configMap.get(row.agentId) ?? null;
      return {
        ...row,
        agentName: configEntry?.name ?? row.agentId,
        emoji: configEntry?.emoji ?? null,
        avatar: configEntry?.avatar ?? null,
      };
    });
}

export function assignTenantAgentToUser(db, params) {
  const existing = db
    .prepare(
      `SELECT id
       FROM user_agent_assignments
       WHERE user_id = ? AND tenant_agent_id = ?`,
    )
    .get(params.userId, params.tenantAgentId);
  if (existing) {
    db.prepare("UPDATE user_agent_assignments SET status = 'active' WHERE id = ?").run(existing.id);
    return existing.id;
  }
  const assignmentId = createId("assignment");
  db.prepare(
    `INSERT INTO user_agent_assignments (id, tenant_id, user_id, tenant_agent_id, status, created_at)
     VALUES (@id, @tenantId, @userId, @tenantAgentId, 'active', @createdAt)`,
  ).run({
    id: assignmentId,
    tenantId: params.tenantId,
    userId: params.userId,
    tenantAgentId: params.tenantAgentId,
    createdAt: nowIso(),
  });
  return assignmentId;
}

export function listAssignedAgentsForUser(db, params, configAgents = []) {
  const configMap = new Map(configAgents.map((entry) => [entry.id, entry]));
  return db
    .prepare(
      `SELECT ta.id, ta.agent_id AS agentId, ta.description, ta.rate_multiplier AS rateMultiplier,
              ta.status, ta.balance_points AS balancePoints, ta.updated_at AS updatedAt
       FROM user_agent_assignments ua
       JOIN tenant_agents ta ON ta.id = ua.tenant_agent_id
       WHERE ua.user_id = ? AND ua.status = 'active' AND ta.status = 'active'
       ORDER BY ta.updated_at DESC`,
    )
    .all(params.userId)
    .map((row) => {
      const configEntry = configMap.get(row.agentId) ?? null;
      return {
        ...row,
        agentName: configEntry?.name ?? row.agentId,
        emoji: configEntry?.emoji ?? null,
        avatar: configEntry?.avatar ?? null,
      };
    });
}

export function logAudit(db, params) {
  db.prepare(
    `INSERT INTO audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, payload_json, created_at)
     VALUES (@id, @tenantId, @userId, @action, @resourceType, @resourceId, @payloadJson, @createdAt)`,
  ).run({
    id: createId("audit"),
    tenantId: params.tenantId || null,
    userId: params.userId || null,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId || null,
    payloadJson: params.payloadJson ? JSON.stringify(params.payloadJson) : null,
    createdAt: nowIso(),
  });
}

export function registerTenantAgentSession(db, params) {
  const existing = db
    .prepare("SELECT id FROM tenant_agent_sessions WHERE openclaw_session_key = ?")
    .get(params.openclawSessionKey);
  const now = nowIso();

  if (existing) {
    db.prepare(
      `UPDATE tenant_agent_sessions
       SET title = @title,
           updated_at = @updatedAt,
           hidden_at = NULL
       WHERE id = @id`
    ).run({
      id: existing.id,
      title: params.title || "新会话",
      updatedAt: now,
    });
    return existing.id;
  }

  const sessionId = createId("session");
  db.prepare(
    `INSERT INTO tenant_agent_sessions (id, tenant_id, user_id, tenant_agent_id, openclaw_session_key, title, created_at, updated_at)
     VALUES (@id, @tenantId, @userId, @tenantAgentId, @openclawSessionKey, @title, @createdAt, @updatedAt)`
  ).run({
    id: sessionId,
    tenantId: params.tenantId,
    userId: params.userId,
    tenantAgentId: params.tenantAgentId,
    openclawSessionKey: params.openclawSessionKey,
    title: params.title || "新会话",
    createdAt: now,
    updatedAt: now,
  });
  return sessionId;
}

export function hideTenantAgentSession(db, params) {
  db.prepare(
    `UPDATE tenant_agent_sessions
     SET hidden_at = @hiddenAt,
         updated_at = @updatedAt
     WHERE user_id = @userId AND openclaw_session_key = @openclawSessionKey`
  ).run({
    userId: params.userId,
    openclawSessionKey: params.openclawSessionKey,
    hiddenAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export function listTenantAgentSessions(db, params) {
  return db
    .prepare(
      `SELECT id, tenant_id AS tenantId, user_id AS userId, tenant_agent_id AS tenantAgentId,
              openclaw_session_key AS openclawSessionKey, openclaw_session_id AS openclawSessionId,
              title, hidden_at AS hiddenAt, created_at AS createdAt, updated_at AS updatedAt
       FROM tenant_agent_sessions
       WHERE user_id = ? AND tenant_agent_id = ? AND hidden_at IS NULL
       ORDER BY updated_at DESC`
    )
    .all(params.userId, params.tenantAgentId);
}
