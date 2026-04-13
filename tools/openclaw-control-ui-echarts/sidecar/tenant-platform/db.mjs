import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import JSON5 from "json5";
import { hashPassword } from "./auth.mjs";
import { ensureTenantPlatformDirs } from "./config.mjs";

const MIGRATION_PATH = new URL("./migrations/001_init.sql", import.meta.url);
const LOCAL_BOOTSTRAP_TENANT_CODE = "local";
const LOCAL_BOOTSTRAP_TENANT_NAME = "本地租户";
const LOCAL_BOOTSTRAP_MEMBER_LIMIT = 999;
const DERIVED_AGENT_TEMPLATE_ENTRIES = [
  "AGENTS.md",
  "SOUL.md",
  "IDENTITY.md",
  "USER.md",
  "TOOLS.md",
  "HEARTBEAT.md",
  "BOOTSTRAP.md",
  "skills",
];
const DERIVED_AGENT_METADATA_FILE = ".tenant-derived-agent.json";

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function roundPoints(value) {
  const numeric = toFiniteNumber(value, 0);
  return Math.round(numeric * 1_000_000) / 1_000_000;
}

function normalizeNonNegativePoints(value) {
  return Math.max(0, roundPoints(value));
}

function buildUsageLedgerNote(openclawSessionKey, sourceFingerprint) {
  return `usage:${String(openclawSessionKey || "").trim()}:${String(sourceFingerprint || "").trim()}`;
}

function resolveUsageChargePoints(totalCost, rateMultiplier) {
  const cost = Math.max(0, toFiniteNumber(totalCost, 0));
  const multiplier = Math.max(0, toFiniteNumber(rateMultiplier, 1));
  if (cost <= 0 || multiplier <= 0) {
    return 0;
  }
  return roundPoints(cost * multiplier);
}

function normalizeUsageDay(value) {
  const normalized = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }
  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) {
    return "";
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

function normalizeIsoTimestamp(value, fallback = nowIso()) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return fallback;
  }
  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return new Date(parsed).toISOString();
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

function ensureSchemaCompatibility(db) {
  const columns = db.prepare("PRAGMA table_info(user_agent_assignments)").all();
  const knownColumns = new Set(columns.map((row) => String(row?.name || "").trim()));
  if (!knownColumns.has("derived_agent_id")) {
    db.exec("ALTER TABLE user_agent_assignments ADD COLUMN derived_agent_id TEXT;");
  }
  if (!knownColumns.has("derived_workspace_dir")) {
    db.exec("ALTER TABLE user_agent_assignments ADD COLUMN derived_workspace_dir TEXT;");
  }
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_agent_assignments_derived_agent
       ON user_agent_assignments (derived_agent_id)
       WHERE derived_agent_id IS NOT NULL`,
  );
}

function normalizeSegment(value, fallback = "x", maxLength = 24) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
  return normalized || fallback;
}

function shortStableHash(input) {
  return crypto
    .createHash("sha1")
    .update(String(input || ""))
    .digest("hex")
    .slice(0, 12);
}

function deriveTenantMemberAgentId(params) {
  const basePart = normalizeSegment(params.baseAgentId, "agent", 18);
  const tenantPart = normalizeSegment(params.tenantId, "tenant", 12);
  const fingerprint = shortStableHash(
    `${params.tenantId}:${params.userId}:${params.tenantAgentId}:${params.baseAgentId}`,
  );
  return `tenant-${tenantPart}-${basePart}-${fingerprint}`;
}

function resolveConfigDir(params = {}) {
  const explicit = String(params.configDir || "").trim();
  if (explicit) {
    return explicit;
  }
  const fromPath = String(params.configPath || "").trim();
  if (fromPath) {
    return path.dirname(fromPath);
  }
  const env = String(process.env.OPENCLAW_CONFIG_DIR || "").trim();
  if (env) {
    return env;
  }
  const home = process.env.HOME?.trim() || os.homedir();
  return path.join(home, ".openclaw");
}

function resolveHomePath(input, configDir) {
  const raw = String(input || "").trim();
  if (!raw) {
    return "";
  }
  let normalized = raw;
  if (raw.startsWith("~/")) {
    const home = process.env.HOME?.trim() || os.homedir();
    normalized = path.join(home, raw.slice(2));
  }
  if (!path.isAbsolute(normalized)) {
    return path.resolve(configDir, normalized);
  }
  return path.resolve(normalized);
}

function parseOpenClawConfig(configPath) {
  try {
    const text = fs.readFileSync(configPath, "utf8");
    const parsed = JSON5.parse(text);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function listConfigAgents(configPayload) {
  const agents = configPayload?.agents;
  if (!agents || typeof agents !== "object") {
    return [];
  }
  return Array.isArray(agents.list) ? agents.list : [];
}

function resolveDefaultAgentIdFromConfig(configPayload) {
  const list = listConfigAgents(configPayload);
  if (!list.length) {
    return "main";
  }
  const explicitDefault = list.find((entry) => entry?.default);
  const id = String((explicitDefault ?? list[0])?.id || "").trim();
  return id || "main";
}

function resolveAgentEntryFromConfig(configPayload, agentId) {
  const normalized = String(agentId || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return null;
  }
  return (
    listConfigAgents(configPayload).find(
      (entry) =>
        String(entry?.id || "")
          .trim()
          .toLowerCase() === normalized,
    ) ?? null
  );
}

function resolveBaseWorkspaceDir(params) {
  const configDir = resolveConfigDir(params);
  const configPayload = parseOpenClawConfig(params.configPath);
  const baseAgentId = String(params.baseAgentId || "").trim();
  const entry = resolveAgentEntryFromConfig(configPayload, baseAgentId);
  const defaultAgentId = resolveDefaultAgentIdFromConfig(configPayload);
  const candidates = [];

  const configuredWorkspace = resolveHomePath(entry?.workspace, configDir);
  if (configuredWorkspace) {
    candidates.push(configuredWorkspace);
  }

  const explicitAgentWorkspace = path.join(configDir, "workspace-agents", baseAgentId);
  candidates.push(explicitAgentWorkspace);

  if (baseAgentId && baseAgentId === defaultAgentId) {
    const defaultsWorkspace = resolveHomePath(
      configPayload?.agents?.defaults?.workspace,
      configDir,
    );
    if (defaultsWorkspace) {
      candidates.push(defaultsWorkspace);
    }
    candidates.push(path.join(configDir, "workspace"));
  }

  if (baseAgentId) {
    candidates.push(path.join(configDir, `workspace-${baseAgentId}`));
  }

  const seen = new Set();
  for (const candidate of candidates) {
    const normalized = path.resolve(candidate);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    if (fs.existsSync(normalized)) {
      return normalized;
    }
  }

  return candidates[0] ? path.resolve(candidates[0]) : "";
}

function copySeedEntry(source, target) {
  if (!fs.existsSync(source) || fs.existsSync(target)) {
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const sourceStats = fs.statSync(source);
  if (sourceStats.isDirectory()) {
    fs.cpSync(source, target, { recursive: true });
    return;
  }
  fs.copyFileSync(source, target);
}

function ensureDerivedWorkspaceAlias(aliasPath, targetPath) {
  try {
    if (fs.existsSync(aliasPath)) {
      const stats = fs.lstatSync(aliasPath);
      if (stats.isSymbolicLink()) {
        const resolved = path.resolve(path.dirname(aliasPath), fs.readlinkSync(aliasPath));
        if (resolved === path.resolve(targetPath)) {
          return true;
        }
      }
      if (stats.isDirectory()) {
        return false;
      }
      fs.rmSync(aliasPath, { force: true });
    }
    const symlinkType = process.platform === "win32" ? "junction" : "dir";
    fs.symlinkSync(targetPath, aliasPath, symlinkType);
    return true;
  } catch {
    return false;
  }
}

function ensureTenantDerivedWorkspace(params) {
  const configDir = resolveConfigDir(params);
  const derivedAgentId = String(params.derivedAgentId || "").trim();
  if (!derivedAgentId) {
    throw new Error("derived_agent_id_required");
  }

  const canonicalWorkspace = path.join(configDir, "workspace-agents", derivedAgentId);
  const runtimeWorkspace = path.join(configDir, `workspace-${derivedAgentId}`);
  fs.mkdirSync(canonicalWorkspace, { recursive: true });

  const sourceWorkspace = resolveBaseWorkspaceDir(params);
  if (sourceWorkspace) {
    for (const entry of DERIVED_AGENT_TEMPLATE_ENTRIES) {
      copySeedEntry(path.join(sourceWorkspace, entry), path.join(canonicalWorkspace, entry));
    }
  }

  const metadataPath = path.join(canonicalWorkspace, DERIVED_AGENT_METADATA_FILE);
  if (!fs.existsSync(metadataPath)) {
    fs.writeFileSync(
      metadataPath,
      JSON.stringify(
        {
          tenantId: params.tenantId,
          userId: params.userId,
          tenantAgentId: params.tenantAgentId,
          baseAgentId: params.baseAgentId,
          derivedAgentId,
          sourceWorkspace: sourceWorkspace || null,
          createdAt: nowIso(),
        },
        null,
        2,
      ),
      "utf8",
    );
  }

  const linked = ensureDerivedWorkspaceAlias(runtimeWorkspace, canonicalWorkspace);
  if (!linked && !fs.existsSync(runtimeWorkspace)) {
    fs.mkdirSync(runtimeWorkspace, { recursive: true });
    for (const entry of DERIVED_AGENT_TEMPLATE_ENTRIES) {
      copySeedEntry(path.join(canonicalWorkspace, entry), path.join(runtimeWorkspace, entry));
    }
  }

  return {
    canonicalWorkspace,
    runtimeWorkspace,
  };
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
    const parsed = parseOpenClawConfig(configPath);
    const list = listConfigAgents(parsed);
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
  ensureSchemaCompatibility(db);
  return db;
}

export function closeTenantPlatformDb(db) {
  if (db && typeof db.close === "function") {
    db.close();
  }
}

export function getBootstrapStatus(db, edition = "cloud") {
  const normalizedEdition = String(edition || "cloud")
    .trim()
    .toLowerCase();
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
    db
      .prepare(
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
      )
      .get(userId) ?? null
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
    db
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
       WHERE t.id = ?
       GROUP BY t.id, tq.member_limit, tq.license_expires_at, tw.balance_points`,
      )
      .get(tenantId) ?? null
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
    db
      .prepare(
        `SELECT u.id, u.username, u.status, tm.role, tm.created_at AS createdAt
       FROM users u
       JOIN tenant_memberships tm ON tm.user_id = u.id
       WHERE u.id = ?`,
      )
      .get(userId) ?? null
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

export function listTenantUsageRecords(db, params) {
  const tenantId = String(params?.tenantId || "").trim();
  if (!tenantId) {
    return { items: [], total: 0, page: 1, pageSize: 8 };
  }
  const search = String(params?.search || "").trim();
  const rawPageSize = Number(params?.pageSize);
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(Math.floor(rawPageSize), 50) : 8;
  const rawPage = Number(params?.page);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const offset = (page - 1) * pageSize;

  const whereClauses = ["r.tenant_id = @tenantId"];
  const bindings = { tenantId };
  if (search) {
    whereClauses.push(
      `(
        LOWER(COALESCE(u.username, '')) LIKE @search OR
        LOWER(COALESCE(ta.agent_id, '')) LIKE @search OR
        LOWER(COALESCE(r.model, '')) LIKE @search OR
        LOWER(COALESCE(r.provider, '')) LIKE @search
      )`,
    );
    bindings.search = `%${search.toLowerCase()}%`;
  }
  const whereSql = whereClauses.join(" AND ");

  const total = Number(
    db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM tenant_usage_records r
         JOIN tenants t ON t.id = r.tenant_id
         LEFT JOIN users u ON u.id = r.user_id
         LEFT JOIN tenant_agents ta ON ta.id = r.tenant_agent_id
         LEFT JOIN tenant_wallet_ledger l
           ON l.tenant_id = r.tenant_id
          AND l.category = 'usage_charge'
          AND l.note = 'usage:' || r.openclaw_session_key || ':' || r.source_fingerprint
         WHERE ${whereSql}`,
      )
      .get(bindings)?.total || 0,
  );

  const items = db
    .prepare(
      `SELECT r.id AS id,
              r.message_timestamp AS createdAt,
              CASE
                WHEN l.amount_points IS NOT NULL THEN l.amount_points
                WHEN t.deployment_mode = 'local' THEN 0
                ELSE COALESCE(r.total_cost, 0) * COALESCE(ta.rate_multiplier, 1)
              END AS creditsUsed,
              r.source_fingerprint AS note,
              r.user_id AS memberId,
              u.username AS memberUsername,
              r.tenant_agent_id AS tenantAgentId,
              ta.agent_id AS agentId,
              r.input_tokens AS inputTokens,
              r.output_tokens AS outputTokens,
              r.total_tokens AS tokens,
              r.total_tokens AS totalTokens,
              r.model AS model,
              r.openclaw_session_key AS sessionKey
         FROM tenant_usage_records r
         JOIN tenants t ON t.id = r.tenant_id
         LEFT JOIN users u ON u.id = r.user_id
         LEFT JOIN tenant_agents ta ON ta.id = r.tenant_agent_id
         LEFT JOIN tenant_wallet_ledger l
           ON l.tenant_id = r.tenant_id
          AND l.category = 'usage_charge'
          AND l.note = 'usage:' || r.openclaw_session_key || ':' || r.source_fingerprint
         WHERE ${whereSql}
         ORDER BY r.message_timestamp DESC, r.created_at DESC
         LIMIT @limit OFFSET @offset`,
    )
    .all({ ...bindings, limit: pageSize, offset });

  return { items, total, page, pageSize };
}

export function assignTenantAgentToUser(db, params) {
  const tenantAgent = db
    .prepare(
      `SELECT id, tenant_id AS tenantId, agent_id AS baseAgentId
       FROM tenant_agents
       WHERE id = ?`,
    )
    .get(params.tenantAgentId);
  if (!tenantAgent) {
    throw new Error("tenant_agent_not_found");
  }
  if (String(tenantAgent.tenantId || "").trim() !== String(params.tenantId || "").trim()) {
    throw new Error("tenant_mismatch");
  }
  const membership = db
    .prepare(
      `SELECT id
       FROM tenant_memberships
       WHERE tenant_id = ? AND user_id = ? AND role = 'member' AND status = 'active'`,
    )
    .get(params.tenantId, params.userId);
  if (!membership) {
    throw new Error("member_not_found");
  }

  return runInTransaction(db, () => {
    const existing = db
      .prepare(
        `SELECT id, derived_agent_id AS derivedAgentId, derived_workspace_dir AS derivedWorkspaceDir
         FROM user_agent_assignments
         WHERE user_id = ? AND tenant_agent_id = ?`,
      )
      .get(params.userId, params.tenantAgentId);

    const derivedAgentId =
      String(existing?.derivedAgentId || "").trim() ||
      deriveTenantMemberAgentId({
        tenantId: params.tenantId,
        userId: params.userId,
        tenantAgentId: params.tenantAgentId,
        baseAgentId: tenantAgent.baseAgentId,
      });

    const workspace = ensureTenantDerivedWorkspace({
      tenantId: params.tenantId,
      userId: params.userId,
      tenantAgentId: params.tenantAgentId,
      baseAgentId: tenantAgent.baseAgentId,
      derivedAgentId,
      configPath: params.configPath,
      configDir: params.configDir,
    });

    if (existing) {
      db.prepare(
        `UPDATE user_agent_assignments
         SET status = 'active',
             derived_agent_id = @derivedAgentId,
             derived_workspace_dir = @derivedWorkspaceDir
         WHERE id = @id`,
      ).run({
        id: existing.id,
        derivedAgentId,
        derivedWorkspaceDir: workspace.canonicalWorkspace,
      });
      return {
        assignmentId: existing.id,
        derivedAgentId,
      };
    }

    const assignmentId = createId("assignment");
    db.prepare(
      `INSERT INTO user_agent_assignments
         (id, tenant_id, user_id, tenant_agent_id, derived_agent_id, derived_workspace_dir, status, created_at)
       VALUES
         (@id, @tenantId, @userId, @tenantAgentId, @derivedAgentId, @derivedWorkspaceDir, 'active', @createdAt)`,
    ).run({
      id: assignmentId,
      tenantId: params.tenantId,
      userId: params.userId,
      tenantAgentId: params.tenantAgentId,
      derivedAgentId,
      derivedWorkspaceDir: workspace.canonicalWorkspace,
      createdAt: nowIso(),
    });
    return {
      assignmentId,
      derivedAgentId,
    };
  });
}

export function listAssignedAgentsForUser(db, params, configAgents = []) {
  const configMap = new Map(configAgents.map((entry) => [entry.id, entry]));
  return db
    .prepare(
      `SELECT ta.id, ta.agent_id AS baseAgentId, ta.description, ta.rate_multiplier AS rateMultiplier,
              ta.status, ta.balance_points AS balancePoints, ta.updated_at AS updatedAt,
              ua.id AS assignmentId, ua.tenant_id AS tenantId, ua.user_id AS userId, ua.tenant_agent_id AS tenantAgentId,
              ua.derived_agent_id AS derivedAgentId, ua.derived_workspace_dir AS derivedWorkspaceDir
       FROM user_agent_assignments ua
       JOIN tenant_agents ta ON ta.id = ua.tenant_agent_id
       WHERE ua.user_id = ? AND ua.status = 'active' AND ta.status = 'active'
       ORDER BY ta.updated_at DESC`,
    )
    .all(params.userId)
    .map((row) => {
      let resolvedAgentId = String(row.derivedAgentId || "").trim();
      if (!resolvedAgentId) {
        resolvedAgentId = deriveTenantMemberAgentId({
          tenantId: row.tenantId,
          userId: row.userId,
          tenantAgentId: row.tenantAgentId,
          baseAgentId: row.baseAgentId,
        });
        const workspace = ensureTenantDerivedWorkspace({
          tenantId: row.tenantId,
          userId: row.userId,
          tenantAgentId: row.tenantAgentId,
          baseAgentId: row.baseAgentId,
          derivedAgentId: resolvedAgentId,
          configPath: params.configPath,
          configDir: params.configDir,
        });
        db.prepare(
          `UPDATE user_agent_assignments
           SET derived_agent_id = @derivedAgentId,
               derived_workspace_dir = @derivedWorkspaceDir
           WHERE id = @assignmentId`,
        ).run({
          assignmentId: row.assignmentId,
          derivedAgentId: resolvedAgentId,
          derivedWorkspaceDir: workspace.canonicalWorkspace,
        });
      }

      const baseAgentId = String(row.baseAgentId || "").trim();
      const agentId = resolvedAgentId || baseAgentId;
      const configEntry = configMap.get(baseAgentId) ?? configMap.get(resolvedAgentId) ?? null;
      return {
        ...row,
        agentId,
        baseAgentId,
        agentName: configEntry?.name ?? baseAgentId ?? agentId,
        emoji: configEntry?.emoji ?? null,
        avatar: configEntry?.avatar ?? null,
      };
    });
}

export function syncTenantUsageRecords(db, params) {
  const tenantId = String(params.tenantId || "").trim();
  const userId = String(params.userId || "").trim();
  const tenantAgentId = String(params.tenantAgentId || "").trim();
  const openclawSessionKey = String(params.openclawSessionKey || "").trim();
  const records = Array.isArray(params.records) ? params.records : [];

  if (!tenantId || !userId || !tenantAgentId || !openclawSessionKey) {
    throw new Error("missing_fields");
  }

  const tenantAgent = db
    .prepare(
      `SELECT ta.id,
              ta.balance_points AS balancePoints,
              ta.rate_multiplier AS rateMultiplier,
              t.deployment_mode AS deploymentMode
       FROM tenant_agents ta
       JOIN tenants t ON t.id = ta.tenant_id
       JOIN tenant_memberships tm ON tm.tenant_id = ta.tenant_id
       WHERE ta.id = @tenantAgentId
         AND ta.tenant_id = @tenantId
         AND tm.user_id = @userId
         AND tm.role = 'member'
         AND tm.status = 'active'
       LIMIT 1`,
    )
    .get({
      tenantAgentId,
      tenantId,
      userId,
    });
  if (!tenantAgent) {
    throw new Error("tenant_agent_not_found");
  }

  return runInTransaction(db, () => {
    const selectExisting = db.prepare(
      `SELECT id
       FROM tenant_usage_records
       WHERE openclaw_session_key = @openclawSessionKey
         AND source_fingerprint = @sourceFingerprint`,
    );
    const selectUsageLedger = db.prepare(
      `SELECT id, amount_points AS amountPoints
       FROM tenant_wallet_ledger
       WHERE tenant_id = @tenantId
         AND category = 'usage_charge'
         AND note = @note
       LIMIT 1`,
    );
    const upsert = db.prepare(
      `INSERT INTO tenant_usage_records (
         id,
         tenant_id,
         user_id,
         tenant_agent_id,
         openclaw_session_key,
         source_fingerprint,
         message_timestamp,
         usage_day,
         provider,
         model,
         input_tokens,
         output_tokens,
         cache_read_tokens,
         cache_write_tokens,
         total_tokens,
         total_cost,
         created_at,
         updated_at
       ) VALUES (
         @id,
         @tenantId,
         @userId,
         @tenantAgentId,
         @openclawSessionKey,
         @sourceFingerprint,
         @messageTimestamp,
         @usageDay,
         @provider,
         @model,
         @inputTokens,
         @outputTokens,
         @cacheReadTokens,
         @cacheWriteTokens,
         @totalTokens,
         @totalCost,
         @createdAt,
         @updatedAt
       )
       ON CONFLICT(openclaw_session_key, source_fingerprint) DO UPDATE SET
         tenant_agent_id = excluded.tenant_agent_id,
         message_timestamp = excluded.message_timestamp,
         usage_day = excluded.usage_day,
         provider = excluded.provider,
         model = excluded.model,
         input_tokens = excluded.input_tokens,
         output_tokens = excluded.output_tokens,
         cache_read_tokens = excluded.cache_read_tokens,
         cache_write_tokens = excluded.cache_write_tokens,
         total_tokens = excluded.total_tokens,
         total_cost = excluded.total_cost,
         updated_at = excluded.updated_at`,
    );
    const updateTenantAgentBalance = db.prepare(
      `UPDATE tenant_agents
       SET balance_points = @balancePoints,
           updated_at = @updatedAt
       WHERE id = @tenantAgentId`,
    );
    const insertUsageLedger = db.prepare(
      `INSERT INTO tenant_wallet_ledger (
         id,
         tenant_id,
         direction,
         category,
         amount_points,
         balance_after,
         tenant_agent_id,
         actor_user_id,
         note,
         created_at
       ) VALUES (
         @id,
         @tenantId,
         'debit',
         'usage_charge',
         @amountPoints,
         @balanceAfter,
         @tenantAgentId,
         @actorUserId,
         @note,
         @createdAt
       )`,
    );
    const updateUsageLedger = db.prepare(
      `UPDATE tenant_wallet_ledger
       SET direction = 'debit',
           amount_points = @amountPoints,
           balance_after = @balanceAfter,
           tenant_agent_id = @tenantAgentId,
           actor_user_id = @actorUserId,
           note = @note
       WHERE id = @id`,
    );
    const deleteUsageLedger = db.prepare(
      `DELETE FROM tenant_wallet_ledger
       WHERE id = @id`,
    );

    let inserted = 0;
    let updated = 0;
    let pointsDelta = 0;
    const now = nowIso();
    const billingEnabled = String(tenantAgent.deploymentMode || "").trim().toLowerCase() !== "local";
    const rateMultiplier = Math.max(0, toFiniteNumber(tenantAgent.rateMultiplier, 1));
    let currentAgentBalance = normalizeNonNegativePoints(tenantAgent.balancePoints);

    for (const record of records) {
      const sourceFingerprint = String(record?.sourceFingerprint || "").trim();
      if (!sourceFingerprint) {
        continue;
      }
      const messageTimestamp = normalizeIsoTimestamp(record?.messageTimestamp, now);
      const usageDay = normalizeUsageDay(record?.usageDay || messageTimestamp) || now.slice(0, 10);
      const inputTokens = Math.max(0, Math.round(toFiniteNumber(record?.inputTokens)));
      const outputTokens = Math.max(0, Math.round(toFiniteNumber(record?.outputTokens)));
      const cacheReadTokens = Math.max(0, Math.round(toFiniteNumber(record?.cacheReadTokens)));
      const cacheWriteTokens = Math.max(0, Math.round(toFiniteNumber(record?.cacheWriteTokens)));
      const totalTokensRaw = Math.round(toFiniteNumber(record?.totalTokens));
      const totalTokens =
        totalTokensRaw > 0
          ? totalTokensRaw
          : inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
      if (totalTokens <= 0 && toFiniteNumber(record?.totalCost, 0) <= 0) {
        continue;
      }

      const existing = selectExisting.get({
        openclawSessionKey,
        sourceFingerprint,
      });
      const totalCost =
        toFiniteNumber(record?.totalCost, 0) > 0 ? toFiniteNumber(record?.totalCost, 0) : null;
      upsert.run({
        id: existing?.id || createId("usage"),
        tenantId,
        userId,
        tenantAgentId,
        openclawSessionKey,
        sourceFingerprint,
        messageTimestamp,
        usageDay,
        provider: String(record?.provider || "").trim() || null,
        model: String(record?.model || "").trim() || null,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        totalTokens,
        totalCost,
        createdAt: existing?.id ? now : now,
        updatedAt: now,
      });

      const usageLedgerNote = buildUsageLedgerNote(openclawSessionKey, sourceFingerprint);
      const existingLedger = selectUsageLedger.get({
        tenantId,
        note: usageLedgerNote,
      });
      const previousPoints = normalizeNonNegativePoints(existingLedger?.amountPoints);
      const nextPoints = billingEnabled ? resolveUsageChargePoints(totalCost, rateMultiplier) : 0;
      const deltaPoints = roundPoints(nextPoints - previousPoints);
      if (deltaPoints !== 0) {
        currentAgentBalance = normalizeNonNegativePoints(currentAgentBalance - deltaPoints);
        pointsDelta = roundPoints(pointsDelta + deltaPoints);
      }

      if (existingLedger?.id && nextPoints <= 0) {
        deleteUsageLedger.run({ id: existingLedger.id });
      } else if (nextPoints > 0) {
        if (existingLedger?.id) {
          updateUsageLedger.run({
            id: existingLedger.id,
            amountPoints: nextPoints,
            balanceAfter: currentAgentBalance,
            tenantAgentId,
            actorUserId: userId,
            note: usageLedgerNote,
          });
        } else {
          insertUsageLedger.run({
            id: createId("ledger"),
            tenantId,
            amountPoints: nextPoints,
            balanceAfter: currentAgentBalance,
            tenantAgentId,
            actorUserId: userId,
            note: usageLedgerNote,
            createdAt: now,
          });
        }
      }

      if (existing?.id) {
        updated += 1;
      } else {
        inserted += 1;
      }
    }

    if (billingEnabled && pointsDelta !== 0) {
      updateTenantAgentBalance.run({
        tenantAgentId,
        balancePoints: currentAgentBalance,
        updatedAt: now,
      });
    }

    return {
      inserted,
      updated,
      total: inserted + updated,
      billingEnabled,
      rateMultiplier,
      agentBalancePoints: currentAgentBalance,
      pointsDelta,
    };
  });
}

export function listTenantUsageStats(db, params, configAgents = []) {
  const tenantId = String(params.tenantId || "").trim();
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }

  const today = nowIso().slice(0, 10);
  const requestedStart = normalizeUsageDay(params.startDate) || today;
  const requestedEnd = normalizeUsageDay(params.endDate) || requestedStart;
  const startDate = requestedStart <= requestedEnd ? requestedStart : requestedEnd;
  const endDate = requestedStart <= requestedEnd ? requestedEnd : requestedStart;
  const queryParams = {
    tenantId,
    startDate,
    endDate,
  };
  const configMap = new Map(configAgents.map((entry) => [entry.id, entry]));

  const totalsRow =
    db
      .prepare(
        `SELECT COUNT(*) AS responseCount,
              COUNT(DISTINCT user_id) AS memberCount,
              COUNT(DISTINCT tenant_agent_id) AS agentCount,
              COALESCE(SUM(input_tokens), 0) AS inputTokens,
              COALESCE(SUM(output_tokens), 0) AS outputTokens,
              COALESCE(SUM(cache_read_tokens), 0) AS cacheReadTokens,
              COALESCE(SUM(cache_write_tokens), 0) AS cacheWriteTokens,
              COALESCE(SUM(total_tokens), 0) AS totalTokens,
              COALESCE(SUM(total_cost), 0) AS totalCost,
              MAX(message_timestamp) AS lastUsedAt
       FROM tenant_usage_records
       WHERE tenant_id = @tenantId
         AND usage_day >= @startDate
         AND usage_day <= @endDate`,
      )
      .get(queryParams) ?? {};

  const byMember = db
    .prepare(
      `SELECT r.user_id AS userId,
              u.username,
              COUNT(*) AS responseCount,
              COALESCE(SUM(r.input_tokens), 0) AS inputTokens,
              COALESCE(SUM(r.output_tokens), 0) AS outputTokens,
              COALESCE(SUM(r.cache_read_tokens), 0) AS cacheReadTokens,
              COALESCE(SUM(r.cache_write_tokens), 0) AS cacheWriteTokens,
              COALESCE(SUM(r.total_tokens), 0) AS totalTokens,
              COALESCE(SUM(r.total_cost), 0) AS totalCost,
              MAX(r.message_timestamp) AS lastUsedAt
       FROM tenant_usage_records r
       JOIN users u ON u.id = r.user_id
       WHERE r.tenant_id = @tenantId
         AND r.usage_day >= @startDate
         AND r.usage_day <= @endDate
       GROUP BY r.user_id, u.username
       ORDER BY totalTokens DESC, responseCount DESC, lastUsedAt DESC`,
    )
    .all(queryParams);

  const byAgent = db
    .prepare(
      `SELECT r.tenant_agent_id AS tenantAgentId,
              ta.agent_id AS agentId,
              ta.description,
              COUNT(*) AS responseCount,
              COALESCE(SUM(r.input_tokens), 0) AS inputTokens,
              COALESCE(SUM(r.output_tokens), 0) AS outputTokens,
              COALESCE(SUM(r.cache_read_tokens), 0) AS cacheReadTokens,
              COALESCE(SUM(r.cache_write_tokens), 0) AS cacheWriteTokens,
              COALESCE(SUM(r.total_tokens), 0) AS totalTokens,
              COALESCE(SUM(r.total_cost), 0) AS totalCost,
              MAX(r.message_timestamp) AS lastUsedAt
       FROM tenant_usage_records r
       JOIN tenant_agents ta ON ta.id = r.tenant_agent_id
       WHERE r.tenant_id = @tenantId
         AND r.usage_day >= @startDate
         AND r.usage_day <= @endDate
       GROUP BY r.tenant_agent_id, ta.agent_id, ta.description
       ORDER BY totalTokens DESC, responseCount DESC, lastUsedAt DESC`,
    )
    .all(queryParams)
    .map((row) => {
      const configEntry = configMap.get(row.agentId) ?? null;
      return {
        ...row,
        agentName: configEntry?.name ?? row.agentId,
        emoji: configEntry?.emoji ?? null,
        avatar: configEntry?.avatar ?? null,
      };
    });

  const byDay = db
    .prepare(
      `SELECT usage_day AS usageDay,
              COUNT(*) AS responseCount,
              COALESCE(SUM(input_tokens), 0) AS inputTokens,
              COALESCE(SUM(output_tokens), 0) AS outputTokens,
              COALESCE(SUM(cache_read_tokens), 0) AS cacheReadTokens,
              COALESCE(SUM(cache_write_tokens), 0) AS cacheWriteTokens,
              COALESCE(SUM(total_tokens), 0) AS totalTokens,
              COALESCE(SUM(total_cost), 0) AS totalCost,
              MAX(message_timestamp) AS lastUsedAt
       FROM tenant_usage_records
       WHERE tenant_id = @tenantId
         AND usage_day >= @startDate
         AND usage_day <= @endDate
       GROUP BY usage_day
       ORDER BY usage_day DESC`,
    )
    .all(queryParams);

  return {
    range: {
      startDate,
      endDate,
    },
    totals: {
      responseCount: Math.max(0, Math.round(toFiniteNumber(totalsRow.responseCount))),
      memberCount: Math.max(0, Math.round(toFiniteNumber(totalsRow.memberCount))),
      agentCount: Math.max(0, Math.round(toFiniteNumber(totalsRow.agentCount))),
      inputTokens: Math.max(0, Math.round(toFiniteNumber(totalsRow.inputTokens))),
      outputTokens: Math.max(0, Math.round(toFiniteNumber(totalsRow.outputTokens))),
      cacheReadTokens: Math.max(0, Math.round(toFiniteNumber(totalsRow.cacheReadTokens))),
      cacheWriteTokens: Math.max(0, Math.round(toFiniteNumber(totalsRow.cacheWriteTokens))),
      totalTokens: Math.max(0, Math.round(toFiniteNumber(totalsRow.totalTokens))),
      totalCost: toFiniteNumber(totalsRow.totalCost, 0),
      lastUsedAt: totalsRow.lastUsedAt || null,
    },
    byMember,
    byAgent,
    byDay,
  };
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
       WHERE id = @id`,
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
     VALUES (@id, @tenantId, @userId, @tenantAgentId, @openclawSessionKey, @title, @createdAt, @updatedAt)`,
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
     WHERE user_id = @userId AND openclaw_session_key = @openclawSessionKey`,
  ).run({
    userId: params.userId,
    openclawSessionKey: params.openclawSessionKey,
    hiddenAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export function deleteTenantAgentSession(db, params) {
  db.prepare(
    `DELETE FROM tenant_agent_sessions
     WHERE user_id = @userId AND openclaw_session_key = @openclawSessionKey`,
  ).run({
    userId: params.userId,
    openclawSessionKey: params.openclawSessionKey,
  });
}

export function listTenantAgentSessions(db, params) {
  return db
    .prepare(
      `SELECT id, tenant_id AS tenantId, user_id AS userId, tenant_agent_id AS tenantAgentId,
              openclaw_session_key AS openclawSessionKey, openclaw_session_id AS openclawSessionId,
              title, hidden_at AS hiddenAt, created_at AS createdAt, updated_at AS updatedAt
       FROM tenant_agent_sessions
       WHERE user_id = ? AND tenant_agent_id = ?
       ORDER BY updated_at DESC`,
    )
    .all(params.userId, params.tenantAgentId);
}
