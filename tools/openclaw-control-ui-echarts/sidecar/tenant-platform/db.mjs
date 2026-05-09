import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import JSON5 from "json5";
import { hashPassword } from "./auth.mjs";
import { ensureTenantPlatformDirs } from "./config.mjs";

const MIGRATION_PATH = new URL("./migrations/001_init.sql", import.meta.url);
const LOCAL_BOOTSTRAP_TENANT_CODE = "local";
const LOCAL_BOOTSTRAP_TENANT_NAME = "本地租户";
const LOCAL_BOOTSTRAP_MEMBER_LIMIT = 999;
const LOCAL_DISCOVERED_DATA_SOURCE_CODE = "local-kingdee-analytics";
const LOCAL_DISCOVERED_DATA_SOURCE_NAME = "本机 kingdee-analytics";
const TENANT_PLATFORM_REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const DERIVED_AGENT_TEMPLATE_ENTRIES = [
  "AGENTS.md",
  "SOUL.md",
  "IDENTITY.md",
  "USER.md",
  "TOOLS.md",
  "HEARTBEAT.md",
  "BOOTSTRAP.md",
  "MEMORY.md",
  "memory.md",
  "memory",
  "skills",
];
const DERIVED_AGENT_METADATA_FILE = ".tenant-derived-agent.json";
const DERIVED_AGENT_PATCH_ROOT = new URL("./derived-agent/", import.meta.url);
const TENANT_DATA_ACCESS_RUNTIME_FILE = "tenant-data-access.json";
const DERIVED_AGENT_ANALYTICS_MEMORY_HINT = [
  "## 零侵入采购查询提示",
  "- 当前 kingdee_analytics 库里的表级字典 analytics_table_dictionary 使用的是：",
  "  - relation_name",
  "  - relation_kind",
  "  - object_code",
  "  - storage_role",
  "  - business_grain",
  "  - description",
  "- 不要假设它存在 table_name、subject_area、table_comment 这些列，查采购对象时先按现有字典字段检索。",
  "- 采购域先优先检查：",
  "  - analytics_table_dictionary",
  "  - analytics_column_dictionary",
  "  - sync_object_registry",
  "  - 采购相关 *_current 表",
  "- 如果用户要“采购订单”或“采购数据”，不要先猜 pur_order_current；先查真实存在的采购对象表名，例如 pur_purchaseorder_current、以及面向沙盒推演的 ods_purchase_order。",
  "- 如果查表时报的是 SQL/表不存在错误，要把真实错误返回出来，不要把它误判成数据库凭据问题。",
].join("\n");
const ZERO_INTRUSIVE_MODEL_COST_FALLBACKS = {
  // OpenAI official GPT-5.4 pricing per 1M text tokens. Only used when the
  // runtime config exposes zero pricing and the session store has no positive
  // estimatedCostUsd to reuse.
  "gpt-5.4": {
    input: 2.5,
    output: 15,
    cacheRead: 0.25,
    cacheWrite: 0,
  },
  "gpt-5.4-mini": {
    input: 0.75,
    output: 4.5,
    cacheRead: 0.075,
    cacheWrite: 0,
  },
};
const ZERO_INTRUSIVE_PROVIDER_COST_FALLBACKS = {
  // Some local Ollama deployments intentionally register zero model prices,
  // but tenant overview still needs a stable non-zero token-based usage cost.
  ollama: {
    input: 0.3,
    output: 1.2,
    cacheRead: 0,
    cacheWrite: 0,
  },
};

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

function buildUsageMemberIdSql(recordAlias = "r") {
  return `COALESCE(NULLIF(${recordAlias}.member_user_id, ''), ${recordAlias}.user_id)`;
}

function buildUsageMemberUsernameSql(recordAlias = "r", userAlias = "u", fallbackSql = "''") {
  return `COALESCE(NULLIF(${recordAlias}.member_username, ''), ${userAlias}.username, ${fallbackSql})`;
}

function resolveUsageChargePoints(totalCost, rateMultiplier) {
  const cost = Math.max(0, toFiniteNumber(totalCost, 0));
  const multiplier = Math.max(0, toFiniteNumber(rateMultiplier, 1));
  if (cost <= 0 || multiplier <= 0) {
    return 0;
  }
  return roundPoints(cost * multiplier);
}

function normalizeOptionalPositiveCost(value) {
  const numeric = roundPoints(toFiniteNumber(value, 0));
  return numeric > 0 ? numeric : null;
}

function extractAgentIdFromSessionKey(openclawSessionKey) {
  const normalized = String(openclawSessionKey || "").trim();
  const match = normalized.match(/^agent:([^:]+):/i);
  return match?.[1] ? String(match[1]).trim() : "";
}

function normalizeModelCostLookupKey(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
}

function collectSessionStoreAgentCandidates(params = {}) {
  const seen = new Set();
  const result = [];
  for (const value of [params.agentId, params.derivedAgentId, extractAgentIdFromSessionKey(params.openclawSessionKey)]) {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
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

function normalizeUpdateLogText(value, { maxLength = 4000, preserveNewlines = false } = {}) {
  const raw = String(value ?? "");
  const normalized = preserveNewlines
    ? raw.replace(/\r\n?/g, "\n").trim()
    : raw.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  return normalized.slice(0, maxLength);
}

function buildUpdateLogExcerpt(content, maxLength = 120) {
  const normalized = normalizeUpdateLogText(content, {
    maxLength: Math.max(1, maxLength * 3),
    preserveNewlines: false,
  });
  if (!normalized) {
    return "";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function normalizeUpdateLogVersionLabel(value) {
  return normalizeUpdateLogText(value, { maxLength: 64, preserveNewlines: false });
}

function normalizeUpdateLogTitle(value) {
  return normalizeUpdateLogText(value, { maxLength: 120, preserveNewlines: false });
}

function normalizeUpdateLogContent(value) {
  return normalizeUpdateLogText(value, { maxLength: 8000, preserveNewlines: true });
}

function normalizeEnvScalar(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "";
  }
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    return normalized.slice(1, -1).trim();
  }
  return normalized;
}

function parseEnvFileAssignments(filePath) {
  const normalizedPath = String(filePath || "").trim();
  if (!normalizedPath || !fs.existsSync(normalizedPath)) {
    return null;
  }
  const values = {};
  const lines = fs.readFileSync(normalizedPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = String(line || "").trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }
    values[key] = normalizeEnvScalar(trimmed.slice(separatorIndex + 1));
  }
  return values;
}

function parsePostgresConnectionFromDsn(dsn) {
  const normalized = String(dsn || "").trim();
  if (!normalized) {
    return null;
  }
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return null;
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    return null;
  }
  const database = parsed.pathname.replace(/^\/+/, "").trim();
  if (!database) {
    return null;
  }
  const connection = {
    host: parsed.hostname,
    database,
  };
  const port = Number.parseInt(parsed.port, 10);
  if (Number.isFinite(port) && port > 0) {
    connection.port = port;
  }
  const user = decodeURIComponent(parsed.username || "").trim();
  if (user) {
    connection.user = user;
  }
  const password = decodeURIComponent(parsed.password || "");
  if (password) {
    connection.password = password;
  }
  return connection;
}

function buildAnalyticsEnvFileCandidates(config = {}) {
  const explicitCandidates = [
    config.analyticsEnvFilePath,
    process.env.OPENCLAW_TENANT_PLATFORM_ANALYTICS_ENV_FILE,
    process.env.KINGDEE_ANALYTICS_ENV_FILE,
  ];
  const candidatePaths = [
    ...explicitCandidates,
    path.join(TENANT_PLATFORM_REPO_ROOT, ".env"),
    path.join(TENANT_PLATFORM_REPO_ROOT, "..", "kingdee-analytics", "config", ".env"),
    path.join(path.parse(TENANT_PLATFORM_REPO_ROOT).root, "AI", "kingdee-analytics", "config", ".env"),
  ];
  const seen = new Set();
  const resolved = [];
  for (const candidate of candidatePaths) {
    const normalized = String(candidate || "").trim();
    if (!normalized) {
      continue;
    }
    const absolutePath = path.resolve(normalized);
    if (seen.has(absolutePath)) {
      continue;
    }
    seen.add(absolutePath);
    resolved.push(absolutePath);
  }
  return resolved;
}

function resolveDiscoveredLocalAnalyticsDataSource(config = {}) {
  const explicitEnv = {
    ANALYTICS_PG_DSN:
      normalizeEnvScalar(config.analyticsPgDsn) ||
      normalizeEnvScalar(process.env.OPENCLAW_TENANT_PLATFORM_ANALYTICS_PG_DSN) ||
      normalizeEnvScalar(process.env.ANALYTICS_PG_DSN),
    KINGDEE_DBID:
      normalizeEnvScalar(config.analyticsSourceDbid) ||
      normalizeEnvScalar(process.env.OPENCLAW_TENANT_PLATFORM_ANALYTICS_DBID) ||
      normalizeEnvScalar(process.env.KINGDEE_DBID),
    SOURCE_TENANT_CODE:
      normalizeEnvScalar(config.analyticsSourceTenantCode) ||
      normalizeEnvScalar(process.env.OPENCLAW_TENANT_PLATFORM_ANALYTICS_TENANT_CODE),
  };

  let envValues = explicitEnv;
  if (!envValues.ANALYTICS_PG_DSN) {
    for (const candidatePath of buildAnalyticsEnvFileCandidates(config)) {
      const parsed = parseEnvFileAssignments(candidatePath);
      if (!parsed?.ANALYTICS_PG_DSN && !parsed?.SANDBOX_PG_DSN) {
        continue;
      }
      envValues = {
        ANALYTICS_PG_DSN:
          normalizeEnvScalar(parsed.ANALYTICS_PG_DSN) || normalizeEnvScalar(parsed.SANDBOX_PG_DSN),
        KINGDEE_DBID: normalizeEnvScalar(parsed.KINGDEE_DBID),
        SOURCE_TENANT_CODE:
          normalizeEnvScalar(parsed.KINGDEE_TENANT_CODE) ||
          normalizeEnvScalar(parsed.SANDBOX_TENANT_CODE),
      };
      break;
    }
  }

  const connection = parsePostgresConnectionFromDsn(envValues.ANALYTICS_PG_DSN);
  if (!connection) {
    return null;
  }

  return {
    code: normalizeEnvScalar(config.analyticsDataSourceCode) || LOCAL_DISCOVERED_DATA_SOURCE_CODE,
    name: normalizeEnvScalar(config.analyticsDataSourceName) || LOCAL_DISCOVERED_DATA_SOURCE_NAME,
    sourceType: "kingdee_analytics",
    status: "active",
    connection,
    sourceDbid: envValues.KINGDEE_DBID || null,
    sourceTenantCode: envValues.SOURCE_TENANT_CODE || null,
  };
}

function ensureDiscoveredLocalAnalyticsDataSource(db, config = {}) {
  if (config.disableAutoDiscoveredDataSources) {
    return;
  }
  const dataSourceCount = Number(getScalar(db, "SELECT COUNT(*) AS value FROM data_sources") || 0);
  if (dataSourceCount > 0) {
    return;
  }
  const discovered = resolveDiscoveredLocalAnalyticsDataSource(config);
  if (!discovered) {
    return;
  }
  upsertDataSource(db, discovered);
}

function ensurePlatformUpdateLogSchemaCompatibility(db) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS platform_update_logs (
       id TEXT PRIMARY KEY,
       version_label TEXT NOT NULL,
       title TEXT NOT NULL,
       content TEXT NOT NULL,
       created_by_user_id TEXT,
       created_by_username TEXT NOT NULL DEFAULT '',
       published_at TEXT NOT NULL,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
     );`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_platform_update_logs_published
       ON platform_update_logs (published_at DESC, updated_at DESC);`,
  );
}

function ensureDataSourceSchemaCompatibility(db) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS data_sources (
       id TEXT PRIMARY KEY,
       code TEXT NOT NULL UNIQUE,
       name TEXT NOT NULL,
       source_type TEXT NOT NULL,
       status TEXT NOT NULL DEFAULT 'active',
       connection_json TEXT NOT NULL,
       source_dbid TEXT,
       source_tenant_code TEXT,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL
     );`,
  );
  db.exec(
    `CREATE TABLE IF NOT EXISTS tenant_data_source_bindings (
       id TEXT PRIMARY KEY,
       tenant_id TEXT NOT NULL UNIQUE,
       data_source_id TEXT NOT NULL,
       bound_by_user_id TEXT,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
       FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE CASCADE,
       FOREIGN KEY (bound_by_user_id) REFERENCES users(id) ON DELETE SET NULL
     );`,
  );
  const duplicateBindingCount = Number(
    getScalar(
      db,
      `SELECT COUNT(*) AS value
       FROM (
         SELECT data_source_id
         FROM tenant_data_source_bindings
         GROUP BY data_source_id
         HAVING COUNT(*) > 1
       )`,
    ) || 0,
  );
  if (duplicateBindingCount === 0) {
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_data_source_bindings_data_source_id_unique
         ON tenant_data_source_bindings (data_source_id);`,
    );
  }
  db.exec(
    `CREATE TABLE IF NOT EXISTS tenant_member_source_policies (
       id TEXT PRIMARY KEY,
       tenant_id TEXT NOT NULL,
       user_id TEXT NOT NULL,
       data_source_id TEXT NOT NULL,
       scope_mode TEXT NOT NULL,
       sandbox_enabled INTEGER NOT NULL DEFAULT 0,
       created_by_user_id TEXT,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       UNIQUE (tenant_id, user_id, data_source_id),
       FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
       FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE CASCADE,
       FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
     );`,
  );
  const tenantMemberSourcePolicyColumns = db
    .prepare("PRAGMA table_info(tenant_member_source_policies)")
    .all();
  if (
    !tenantMemberSourcePolicyColumns.some(
      (column) => String(column?.name || "").trim() === "sandbox_enabled",
    )
  ) {
    db.exec(
      "ALTER TABLE tenant_member_source_policies ADD COLUMN sandbox_enabled INTEGER NOT NULL DEFAULT 0;",
    );
  }
  db.exec(
    `CREATE TABLE IF NOT EXISTS tenant_member_org_scopes (
       id TEXT PRIMARY KEY,
       tenant_id TEXT NOT NULL,
       user_id TEXT NOT NULL,
       data_source_id TEXT NOT NULL,
       org_id TEXT NOT NULL,
       org_name_snapshot TEXT NOT NULL DEFAULT '',
       created_at TEXT NOT NULL,
       UNIQUE (tenant_id, user_id, data_source_id, org_id),
       FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
       FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE CASCADE
     );`,
  );
}

function parseJsonObject(value, fallback = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  const normalized = String(value || "").trim();
  if (!normalized) {
    return fallback;
  }
  try {
    const parsed = JSON5.parse(normalized);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeDataSourceConnectionObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...value };
  }
  const normalized = String(value || "").trim();
  if (!normalized) {
    return {};
  }
  const parsed = parseJsonObject(normalized, null);
  if (!parsed) {
    throw new Error("connection_json_invalid");
  }
  return { ...parsed };
}

function serializeDataSourceConnection(value) {
  return JSON.stringify(normalizeDataSourceConnectionObject(value));
}

function buildStoredDataSourceConnection(existingValue, nextValue, preserveExisting = false) {
  if (preserveExisting) {
    return parseJsonObject(existingValue, {});
  }
  const connection = normalizeDataSourceConnectionObject(nextValue);
  const existingConnection = parseJsonObject(existingValue, {});
  if (
    (!Object.prototype.hasOwnProperty.call(connection, "password") || connection.password === "") &&
    typeof existingConnection.password === "string" &&
    existingConnection.password
  ) {
    connection.password = existingConnection.password;
  } else if (connection.password === "") {
    delete connection.password;
  }
  return connection;
}

function normalizeDataSourceStatus(value) {
  const normalized = String(value || "active").trim().toLowerCase();
  return normalized || "active";
}

function normalizeScopeMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "none" || normalized === "custom" || normalized === "all") {
    return normalized;
  }
  return "";
}

function normalizeOrgScopeEntries(value) {
  const entries = [];
  const seen = new Set();
  const input = Array.isArray(value) ? value : [];
  for (const item of input) {
    const normalizedItem =
      typeof item === "string"
        ? {
            orgId: item,
            orgNameSnapshot: "",
          }
        : item && typeof item === "object"
          ? item
          : null;
    const orgId = String(
      normalizedItem?.orgId ?? normalizedItem?.id ?? normalizedItem?.value ?? "",
    ).trim();
    if (!orgId || seen.has(orgId)) {
      continue;
    }
    seen.add(orgId);
    entries.push({
      orgId,
      orgNameSnapshot: String(
        normalizedItem?.orgNameSnapshot ?? normalizedItem?.orgName ?? normalizedItem?.label ?? "",
      ).trim(),
    });
  }
  return entries;
}

function mapDataSourceRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sourceType: row.sourceType,
    status: row.status,
    connectionJson: row.connectionJson,
    connection: parseJsonObject(row.connectionJson, {}),
    sourceDbid: row.sourceDbid ?? null,
    sourceTenantCode: row.sourceTenantCode ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapTenantDataSourceBindingRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    tenantId: row.tenantId,
    dataSourceId: row.dataSourceId,
    boundByUserId: row.boundByUserId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    dataSourceCode: row.dataSourceCode ?? null,
    dataSourceName: row.dataSourceName ?? null,
    dataSourceType: row.dataSourceType ?? null,
    dataSourceStatus: row.dataSourceStatus ?? null,
    connectionJson: row.connectionJson ?? "{}",
    connection: parseJsonObject(row.connectionJson, {}),
    sourceDbid: row.sourceDbid ?? null,
    sourceTenantCode: row.sourceTenantCode ?? null,
  };
}

function getDataSourceById(db, dataSourceId) {
  return mapDataSourceRow(
    db
      .prepare(
        `SELECT id,
                code,
                name,
                source_type AS sourceType,
                status,
                connection_json AS connectionJson,
                source_dbid AS sourceDbid,
                source_tenant_code AS sourceTenantCode,
                created_at AS createdAt,
                updated_at AS updatedAt
         FROM data_sources
         WHERE id = ?`,
      )
      .get(dataSourceId),
  );
}

function getScalar(db, sql, params) {
  const stmt = db.prepare(sql);
  let row;
  if (params === undefined) {
    row = stmt.get();
  } else if (Array.isArray(params)) {
    row = stmt.get(...params);
  } else {
    row = stmt.get(params);
  }
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

function ensureTenantUsageRecordSchemaCompatibility(db) {
  const columns = db.prepare("PRAGMA table_info(tenant_usage_records)").all();
  if (!columns.length) {
    return;
  }

  const knownColumns = new Set(columns.map((row) => String(row?.name || "").trim()));
  const hasMemberUserId = knownColumns.has("member_user_id");
  const hasMemberUsername = knownColumns.has("member_username");
  const userIdColumn = columns.find((row) => String(row?.name || "").trim() === "user_id");
  const userIdNullable = Number(userIdColumn?.notnull || 0) === 0;
  const foreignKeys = db.prepare("PRAGMA foreign_key_list(tenant_usage_records)").all();
  const userIdForeignKey = foreignKeys.find(
    (row) => String(row?.from || "").trim() === "user_id",
  );
  const userIdOnDelete = String(userIdForeignKey?.on_delete || "")
    .trim()
    .toUpperCase();
  if (hasMemberUserId && hasMemberUsername && userIdNullable && userIdOnDelete === "SET NULL") {
    return;
  }

  const legacyTableName = "tenant_usage_records_legacy_migration";
  const legacyMemberUserIdSql = hasMemberUserId
    ? "COALESCE(NULLIF(r.member_user_id, ''), r.user_id)"
    : "r.user_id";
  const legacyMemberUsernameSql = hasMemberUsername
    ? "COALESCE(NULLIF(r.member_username, ''), u.username, '')"
    : "COALESCE(u.username, '')";
  const foreignKeysEnabled = Number(getScalar(db, "PRAGMA foreign_keys") || 0) > 0;

  if (foreignKeysEnabled) {
    db.exec("PRAGMA foreign_keys = OFF;");
  }
  try {
    db.exec(`ALTER TABLE tenant_usage_records RENAME TO ${legacyTableName};`);
    db.exec(
      `CREATE TABLE tenant_usage_records (
         id TEXT PRIMARY KEY,
         tenant_id TEXT NOT NULL,
         user_id TEXT,
         member_user_id TEXT,
         member_username TEXT NOT NULL DEFAULT '',
         tenant_agent_id TEXT NOT NULL,
         openclaw_session_key TEXT NOT NULL,
         source_fingerprint TEXT NOT NULL,
         message_timestamp TEXT NOT NULL,
         usage_day TEXT NOT NULL,
         provider TEXT,
         model TEXT,
         input_tokens INTEGER NOT NULL DEFAULT 0,
         output_tokens INTEGER NOT NULL DEFAULT 0,
         cache_read_tokens INTEGER NOT NULL DEFAULT 0,
         cache_write_tokens INTEGER NOT NULL DEFAULT 0,
         total_tokens INTEGER NOT NULL DEFAULT 0,
         total_cost REAL,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL,
         UNIQUE(openclaw_session_key, source_fingerprint),
         FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
         FOREIGN KEY (tenant_agent_id) REFERENCES tenant_agents(id) ON DELETE CASCADE
       );`,
    );
    db.exec(
      `INSERT INTO tenant_usage_records (
         id,
         tenant_id,
         user_id,
         member_user_id,
         member_username,
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
       )
       SELECT r.id,
              r.tenant_id,
              r.user_id,
              ${legacyMemberUserIdSql},
              ${legacyMemberUsernameSql},
              r.tenant_agent_id,
              r.openclaw_session_key,
              r.source_fingerprint,
              r.message_timestamp,
              r.usage_day,
              r.provider,
              r.model,
              r.input_tokens,
              r.output_tokens,
              r.cache_read_tokens,
              r.cache_write_tokens,
              r.total_tokens,
              r.total_cost,
              r.created_at,
              r.updated_at
       FROM ${legacyTableName} r
       LEFT JOIN users u ON u.id = r.user_id;`,
    );
    db.exec(`DROP TABLE ${legacyTableName};`);
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_tenant_usage_records_tenant_day
         ON tenant_usage_records (tenant_id, usage_day, message_timestamp DESC);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_tenant_usage_records_user_day
         ON tenant_usage_records (user_id, usage_day, message_timestamp DESC);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_tenant_usage_records_agent_day
         ON tenant_usage_records (tenant_agent_id, usage_day, message_timestamp DESC);`,
    );
  } finally {
    if (foreignKeysEnabled) {
      db.exec("PRAGMA foreign_keys = ON;");
    }
  }
}

function ensureSchemaCompatibility(db) {
  ensureDataSourceSchemaCompatibility(db);
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
  ensureTenantUsageRecordSchemaCompatibility(db);
  ensurePlatformUpdateLogSchemaCompatibility(db);
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

function resolveConfigPath(params = {}) {
  const explicit = String(params.configPath || "").trim();
  if (explicit) {
    return explicit;
  }
  return path.join(resolveConfigDir(params), "openclaw.json");
}

function resolveExecApprovalsFilePath(params = {}) {
  return path.join(resolveConfigDir(params), "exec-approvals.json");
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

function resolveConfiguredModelTokenCosts(params = {}) {
  const providerId = String(params.provider || "").trim();
  const modelKey = normalizeModelCostLookupKey(params.model);
  if (!providerId || !modelKey) {
    return null;
  }
  const configPayload = parseOpenClawConfig(resolveConfigPath(params));
  const providerModels =
    configPayload?.models?.providers &&
    typeof configPayload.models.providers === "object" &&
    !Array.isArray(configPayload.models.providers)
      ? configPayload.models.providers[providerId]?.models
      : null;
  if (!Array.isArray(providerModels)) {
    return null;
  }
  const matchedModel = providerModels.find(
    (entry) => normalizeModelCostLookupKey(entry?.id) === modelKey,
  );
  if (!matchedModel?.cost || typeof matchedModel.cost !== "object") {
    return null;
  }
  return {
    input: normalizeOptionalPositiveCost(matchedModel.cost.input) ?? 0,
    output: normalizeOptionalPositiveCost(matchedModel.cost.output) ?? 0,
    cacheRead: normalizeOptionalPositiveCost(matchedModel.cost.cacheRead) ?? 0,
    cacheWrite: normalizeOptionalPositiveCost(matchedModel.cost.cacheWrite) ?? 0,
  };
}

function resolveFallbackModelTokenCosts(params = {}) {
  const modelKey = normalizeModelCostLookupKey(params.model);
  const fallback = ZERO_INTRUSIVE_MODEL_COST_FALLBACKS[modelKey];
  if (fallback) {
    return { ...fallback };
  }
  const providerKey = String(params.provider || "")
    .trim()
    .toLowerCase();
  const providerFallback = ZERO_INTRUSIVE_PROVIDER_COST_FALLBACKS[providerKey];
  return providerFallback ? { ...providerFallback } : null;
}

function resolveModelTokenCosts(params = {}) {
  const configured = resolveConfiguredModelTokenCosts(params);
  if (
    configured &&
    (configured.input > 0 ||
      configured.output > 0 ||
      configured.cacheRead > 0 ||
      configured.cacheWrite > 0)
  ) {
    return configured;
  }
  return resolveFallbackModelTokenCosts(params);
}

function estimateUsageCostUsdFromTokenRates(usage, tokenCosts) {
  if (!tokenCosts) {
    return null;
  }
  const inputTokens = Math.max(0, Math.round(toFiniteNumber(usage?.inputTokens)));
  const outputTokens = Math.max(0, Math.round(toFiniteNumber(usage?.outputTokens)));
  const cacheReadTokens = Math.max(0, Math.round(toFiniteNumber(usage?.cacheReadTokens)));
  const cacheWriteTokens = Math.max(0, Math.round(toFiniteNumber(usage?.cacheWriteTokens)));
  const estimatedCostUsd = roundPoints(
    (inputTokens * Math.max(0, toFiniteNumber(tokenCosts.input))) / 1_000_000 +
      (outputTokens * Math.max(0, toFiniteNumber(tokenCosts.output))) / 1_000_000 +
      (cacheReadTokens * Math.max(0, toFiniteNumber(tokenCosts.cacheRead))) / 1_000_000 +
      (cacheWriteTokens * Math.max(0, toFiniteNumber(tokenCosts.cacheWrite))) / 1_000_000,
  );
  return estimatedCostUsd > 0 ? estimatedCostUsd : null;
}

function resolveSessionStorePathForAgentId(agentId, params = {}) {
  if (!agentId) {
    return "";
  }
  const configDir = resolveConfigDir(params);
  const configPayload = parseOpenClawConfig(resolveConfigPath(params));
  const configuredStore = String(configPayload?.session?.store || "").trim();
  if (!configuredStore) {
    return path.join(configDir, "agents", agentId, "sessions", "sessions.json");
  }
  const templatedStore = configuredStore.replaceAll("{agentId}", agentId);
  const resolvedStorePath = resolveHomePath(templatedStore, configDir);
  if (!resolvedStorePath) {
    return path.join(configDir, "agents", agentId, "sessions", "sessions.json");
  }
  if (path.basename(resolvedStorePath).toLowerCase() === "sessions.json") {
    return resolvedStorePath;
  }
  return path.join(resolvedStorePath, "sessions.json");
}

function resolveSessionStorePath(params = {}) {
  const agentIds = collectSessionStoreAgentCandidates(params);
  let firstCandidatePath = "";
  for (const agentId of agentIds) {
    const candidatePath = resolveSessionStorePathForAgentId(agentId, params);
    if (!candidatePath) {
      continue;
    }
    if (!firstCandidatePath) {
      firstCandidatePath = candidatePath;
    }
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return firstCandidatePath;
}

function readSessionStore(params = {}, cache = null) {
  const storePath = resolveSessionStorePath(params);
  if (!storePath) {
    return null;
  }
  if (cache?.has(storePath)) {
    return cache.get(storePath);
  }
  let parsed = null;
  try {
    const raw = fs.readFileSync(storePath, "utf8");
    const payload = JSON.parse(raw);
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      parsed = payload;
    }
  } catch {
    parsed = null;
  }
  cache?.set(storePath, parsed);
  return parsed;
}

function readSessionStoreEntry(params = {}, cache = null) {
  const sessionKey = String(params.openclawSessionKey || "").trim();
  if (!sessionKey) {
    return null;
  }
  const store = readSessionStore(params, cache);
  if (!store || typeof store !== "object") {
    return null;
  }
  const direct = store[sessionKey];
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return direct;
  }
  const normalizedSessionKey = sessionKey.toLowerCase();
  for (const [key, value] of Object.entries(store)) {
    if (
      String(key || "")
        .trim()
        .toLowerCase() === normalizedSessionKey &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      return value;
    }
  }
  return null;
}

function resolveSessionEstimatedCostUsd(params = {}, cache = null) {
  const sessionEntry = readSessionStoreEntry(params, cache);
  const explicitEstimatedCostUsd = normalizeOptionalPositiveCost(sessionEntry?.estimatedCostUsd);
  if (explicitEstimatedCostUsd) {
    return explicitEstimatedCostUsd;
  }
  return estimateUsageCostUsdFromTokenRates(
    {
      inputTokens: sessionEntry?.inputTokens,
      outputTokens: sessionEntry?.outputTokens,
      cacheReadTokens: sessionEntry?.cacheRead ?? sessionEntry?.cacheReadTokens,
      cacheWriteTokens: sessionEntry?.cacheWrite ?? sessionEntry?.cacheWriteTokens,
    },
    resolveModelTokenCosts({
      provider: sessionEntry?.modelProvider || sessionEntry?.provider,
      model: sessionEntry?.model,
      configDir: params.configDir,
      configPath: params.configPath,
    }),
  );
}

function resolveSessionUsageModelIdentity(sessionEntry) {
  return {
    provider: String(sessionEntry?.modelProvider || sessionEntry?.provider || "").trim() || null,
    model: String(sessionEntry?.model || "").trim() || null,
  };
}

function normalizeTenantUsageSyncRecords(records, fallbackTimestamp = nowIso()) {
  return (Array.isArray(records) ? records : []).flatMap((record) => {
    const sourceFingerprint = String(record?.sourceFingerprint || "").trim();
    if (!sourceFingerprint) {
      return [];
    }
    const messageTimestamp = normalizeIsoTimestamp(record?.messageTimestamp, fallbackTimestamp);
    const usageDay =
      normalizeUsageDay(record?.usageDay || messageTimestamp) || fallbackTimestamp.slice(0, 10);
    const inputTokens = Math.max(0, Math.round(toFiniteNumber(record?.inputTokens)));
    const outputTokens = Math.max(0, Math.round(toFiniteNumber(record?.outputTokens)));
    const cacheReadTokens = Math.max(0, Math.round(toFiniteNumber(record?.cacheReadTokens)));
    const cacheWriteTokens = Math.max(0, Math.round(toFiniteNumber(record?.cacheWriteTokens)));
    const totalTokensRaw = Math.round(toFiniteNumber(record?.totalTokens));
    const totalTokens =
      totalTokensRaw > 0
        ? totalTokensRaw
        : inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
    return [
      {
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
        totalCost: normalizeOptionalPositiveCost(record?.totalCost),
      },
    ];
  });
}

function applySessionEstimatedCostFallbackToUsageRecords(
  records,
  sessionParams = {},
  cache = null,
) {
  if (!Array.isArray(records) || records.length === 0) {
    return [];
  }
  const sessionEntry = readSessionStoreEntry(sessionParams, cache);
  const sessionIdentity = resolveSessionUsageModelIdentity(sessionEntry);
  const explicitSessionEstimatedCostUsd = normalizeOptionalPositiveCost(sessionEntry?.estimatedCostUsd);
  const nextRecords = records.map((record) => {
    const nextRecord = { ...record };
    if (!nextRecord.provider && sessionIdentity.provider) {
      nextRecord.provider = sessionIdentity.provider;
    }
    if (!nextRecord.model && sessionIdentity.model) {
      nextRecord.model = sessionIdentity.model;
    }
    if (!nextRecord.totalCost && !explicitSessionEstimatedCostUsd) {
      nextRecord.totalCost = estimateUsageCostUsdFromTokenRates(
        {
          inputTokens: nextRecord.inputTokens,
          outputTokens: nextRecord.outputTokens,
          cacheReadTokens: nextRecord.cacheReadTokens,
          cacheWriteTokens: nextRecord.cacheWriteTokens,
        },
        resolveModelTokenCosts({
          provider: nextRecord.provider,
          model: nextRecord.model,
          configDir: sessionParams.configDir,
          configPath: sessionParams.configPath,
        }),
      );
    }
    return nextRecord;
  });
  const pendingIndexes = [];
  let knownCostUsd = 0;
  for (let index = 0; index < nextRecords.length; index += 1) {
    const record = nextRecords[index];
    const totalCost = normalizeOptionalPositiveCost(record?.totalCost);
    if (totalCost) {
      knownCostUsd = roundPoints(knownCostUsd + totalCost);
      continue;
    }
    pendingIndexes.push(index);
  }
  if (pendingIndexes.length === 0) {
    return nextRecords;
  }
  if (!explicitSessionEstimatedCostUsd) {
    return nextRecords;
  }
  const remainingCostUsd = roundPoints(explicitSessionEstimatedCostUsd - knownCostUsd);
  if (remainingCostUsd <= 0) {
    return nextRecords;
  }
  const weightedTokens = pendingIndexes.reduce(
    (sum, index) => sum + Math.max(0, Math.round(toFiniteNumber(nextRecords[index]?.totalTokens))),
    0,
  );
  let allocatedCostUsd = 0;

  for (let pendingIndex = 0; pendingIndex < pendingIndexes.length; pendingIndex += 1) {
    const recordIndex = pendingIndexes[pendingIndex];
    const isLastPending = pendingIndex === pendingIndexes.length - 1;
    const currentRecord = nextRecords[recordIndex];
    const weight = Math.max(0, Math.round(toFiniteNumber(currentRecord?.totalTokens)));
    let shareCostUsd = 0;

    if (isLastPending) {
      shareCostUsd = Math.max(0, roundPoints(remainingCostUsd - allocatedCostUsd));
    } else if (weightedTokens > 0) {
      shareCostUsd = Math.max(0, roundPoints((remainingCostUsd * weight) / weightedTokens));
    } else {
      shareCostUsd = Math.max(
        0,
        roundPoints(remainingCostUsd / Math.max(1, pendingIndexes.length)),
      );
    }

    allocatedCostUsd = roundPoints(allocatedCostUsd + shareCostUsd);
    if (shareCostUsd > 0) {
      currentRecord.totalCost = shareCostUsd;
    }
  }

  return nextRecords;
}

function readExecApprovalsFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  try {
    const text = fs.readFileSync(filePath, "utf8");
    const parsed = JSON5.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeExecApprovalsFile(filePath, payload) {
  if (!filePath || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return true;
}

function normalizeExecApprovalPattern(value) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.toLowerCase() : "";
}

function mergeExecApprovalAllowlists(...lists) {
  const merged = [];
  const seen = new Set();
  for (const list of lists) {
    if (!Array.isArray(list)) {
      continue;
    }
    for (const item of list) {
      let entry = null;
      if (typeof item === "string") {
        const pattern = item.trim();
        if (pattern) {
          entry = { pattern };
        }
      } else if (item && typeof item === "object" && !Array.isArray(item)) {
        const pattern = String(item.pattern || "").trim();
        if (pattern) {
          entry = {
            ...item,
            pattern,
          };
        }
      }
      if (!entry) {
        continue;
      }
      const key = normalizeExecApprovalPattern(entry.pattern);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(entry);
    }
  }
  return merged;
}

function normalizeExecApprovalAgentBucket(bucket) {
  if (!bucket || typeof bucket !== "object" || Array.isArray(bucket)) {
    return null;
  }
  const normalized = { ...bucket };

  const security = String(bucket.security || "").trim();
  if (security) {
    normalized.security = security;
  } else {
    delete normalized.security;
  }

  const ask = String(bucket.ask || "").trim();
  if (ask) {
    normalized.ask = ask;
  } else {
    delete normalized.ask;
  }

  const askFallback = String(bucket.askFallback || "").trim();
  if (askFallback) {
    normalized.askFallback = askFallback;
  } else {
    delete normalized.askFallback;
  }

  if (Object.prototype.hasOwnProperty.call(bucket, "autoAllowSkills")) {
    normalized.autoAllowSkills = Boolean(bucket.autoAllowSkills);
  } else {
    delete normalized.autoAllowSkills;
  }

  const allowlist = mergeExecApprovalAllowlists(bucket.allowlist);
  if (allowlist.length) {
    normalized.allowlist = allowlist;
  } else {
    delete normalized.allowlist;
  }

  return normalized;
}

function mergeExecApprovalAgentBuckets(sourceBucket, targetBucket) {
  const source = normalizeExecApprovalAgentBucket(sourceBucket);
  if (!source) {
    return normalizeExecApprovalAgentBucket(targetBucket);
  }
  const target = normalizeExecApprovalAgentBucket(targetBucket) || {};
  const merged = {
    ...target,
    allowlist: mergeExecApprovalAllowlists(target.allowlist, source.allowlist),
  };

  for (const field of ["security", "ask", "askFallback", "autoAllowSkills"]) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      merged[field] = source[field];
    }
  }

  if (!merged.allowlist?.length) {
    delete merged.allowlist;
  }

  return merged;
}

function syncDerivedAgentExecApprovals(params = {}) {
  const baseAgentId = String(params.baseAgentId || "").trim();
  const derivedAgentId = String(params.derivedAgentId || "").trim();
  if (!baseAgentId || !derivedAgentId || baseAgentId === derivedAgentId) {
    return false;
  }

  const filePath = resolveExecApprovalsFilePath(params);
  const current = readExecApprovalsFile(filePath);
  if (!current) {
    return false;
  }

  const agents =
    current.agents && typeof current.agents === "object" && !Array.isArray(current.agents)
      ? { ...current.agents }
      : {};
  const sourceBucket = agents[baseAgentId] ?? (baseAgentId === "main" ? agents.default : null);
  const mergedBucket = mergeExecApprovalAgentBuckets(sourceBucket, agents[derivedAgentId]);
  if (!sourceBucket || !mergedBucket) {
    return false;
  }

  const next = {
    ...current,
    agents: {
      ...agents,
      [derivedAgentId]: mergedBucket,
    },
  };
  if (JSON.stringify(current) === JSON.stringify(next)) {
    return false;
  }
  return writeExecApprovalsFile(filePath, next);
}

function resolveAgentRuntimeDir(agentId, params = {}) {
  const normalizedAgentId = String(agentId || "").trim();
  if (!normalizedAgentId) {
    return "";
  }
  return path.join(resolveConfigDir(params), "agents", normalizedAgentId, "agent");
}

function cloneJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveConfiguredModelProviders(params = {}) {
  const configPayload = parseOpenClawConfig(resolveConfigPath(params));
  const providers =
    configPayload?.models?.providers &&
    typeof configPayload.models.providers === "object" &&
    !Array.isArray(configPayload.models.providers)
      ? configPayload.models.providers
      : null;
  if (!providers || Object.keys(providers).length === 0) {
    return null;
  }
  return cloneJsonValue(providers);
}

function buildDerivedAgentModelsPayload(params = {}) {
  const providers = resolveConfiguredModelProviders(params);
  if (!providers) {
    return null;
  }
  return { providers };
}

function buildDerivedAgentAuthProfilesPayload(params = {}) {
  const providers = resolveConfiguredModelProviders(params);
  if (!providers) {
    return null;
  }
  const profiles = {};
  for (const [providerId, providerConfig] of Object.entries(providers)) {
    const apiKey = String(providerConfig?.apiKey || "").trim();
    if (!apiKey) {
      continue;
    }
    profiles[`${providerId}:default`] = {
      type: "api_key",
      provider: providerId,
      apiKey,
      key: apiKey,
    };
  }
  return {
    version: 1,
    profiles,
  };
}

function writeJsonFileIfChanged(filePath, payload) {
  const nextBuffer = Buffer.from(JSON.stringify(payload, null, 2), "utf8");
  if (fs.existsSync(filePath)) {
    const currentBuffer = fs.readFileSync(filePath);
    if (Buffer.compare(currentBuffer, nextBuffer) === 0) {
      return false;
    }
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, nextBuffer);
  return true;
}

function patchDerivedAgentWorkspaceFiles(params = {}) {
  const derivedAgentId = String(params.derivedAgentId || "").trim();
  if (!derivedAgentId) {
    return false;
  }
  const configDir = resolveConfigDir(params);
  const workspace = {
    canonicalWorkspace: path.join(configDir, "workspace-agents", derivedAgentId),
    runtimeWorkspace: path.join(configDir, `workspace-${derivedAgentId}`),
  };
  if (!fs.existsSync(workspace.canonicalWorkspace) && !fs.existsSync(workspace.runtimeWorkspace)) {
    return false;
  }
  const patchRootPath = fileURLToPath(DERIVED_AGENT_PATCH_ROOT);
  if (!fs.existsSync(patchRootPath)) {
    return false;
  }

  let changed = false;
  const skillPatchRoot = path.join(patchRootPath, "kingdee-analytics-ops");
  if (!fs.existsSync(skillPatchRoot)) {
    return false;
  }

  const workspaceSkillRoots = [
    path.join(workspace.canonicalWorkspace, "skills", "kingdee-analytics-ops"),
    path.join(workspace.runtimeWorkspace, "skills", "kingdee-analytics-ops"),
  ];
  changed = appendDerivedAgentMemoryHint(workspace.canonicalWorkspace) || changed;
  changed = appendDerivedAgentMemoryHint(workspace.runtimeWorkspace) || changed;
  for (const skillRoot of workspaceSkillRoots) {
    if (!fs.existsSync(skillRoot)) {
      continue;
    }
    const skillDocSourcePath = path.join(skillPatchRoot, "SKILL.md");
    if (fs.existsSync(skillDocSourcePath)) {
      const skillDocTargetPath = path.join(skillRoot, "SKILL.md");
      const nextContent = fs.readFileSync(skillDocSourcePath);
      const currentContent = fs.existsSync(skillDocTargetPath) ? fs.readFileSync(skillDocTargetPath) : null;
      if (!currentContent || Buffer.compare(currentContent, nextContent) !== 0) {
        fs.writeFileSync(skillDocTargetPath, nextContent);
        changed = true;
      }
    }
    for (const fileName of ["_bridge_client.py", "tenant_local_pg_bridge.mjs", "local_sync_engine.py", "manage_analytics_db.py"]) {
      const sourcePath = path.join(skillPatchRoot, fileName);
      if (!fs.existsSync(sourcePath)) {
        continue;
      }
      const targetPath = path.join(skillRoot, "scripts", fileName);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      const nextContent = fs.readFileSync(sourcePath);
      const currentContent = fs.existsSync(targetPath) ? fs.readFileSync(targetPath) : null;
      if (currentContent && Buffer.compare(currentContent, nextContent) === 0) {
        continue;
      }
      fs.writeFileSync(targetPath, nextContent);
      changed = true;
    }
  }
  return changed;
}

function buildTenantDataAccessRuntimePayload(db, params = {}) {
  try {
    const context = resolveMemberDataAccessContext(db, {
      tenantId: params.tenantId,
      userId: params.userId,
    });
    return {
      version: 1,
      tenantId: context.tenantId,
      userId: context.userId,
      dataSourceId: context.dataSourceId,
      sourceType: context.sourceType,
      connection: context.connection,
      scopeMode: context.scopeMode,
      allowedOrgIds: Array.isArray(context.allowedOrgIds) ? context.allowedOrgIds : null,
      updatedAt: nowIso(),
    };
  } catch (error) {
    if (
      error instanceof Error &&
      [
        "tenant_data_source_unbound",
        "member_org_scope_empty",
        "data_source_not_found",
        "member_not_found",
      ].includes(error.message)
    ) {
      return null;
    }
    throw error;
  }
}

function syncTenantDerivedAgentDataAccessRuntime(db, params = {}) {
  const derivedAgentId = String(params.derivedAgentId || "").trim();
  if (!derivedAgentId) {
    return false;
  }
  const derivedAgentRuntimeDir = resolveAgentRuntimeDir(derivedAgentId, params);
  if (!derivedAgentRuntimeDir) {
    return false;
  }
  fs.mkdirSync(derivedAgentRuntimeDir, { recursive: true });
  const targetPath = path.join(derivedAgentRuntimeDir, TENANT_DATA_ACCESS_RUNTIME_FILE);
  const payload = buildTenantDataAccessRuntimePayload(db, params);
  if (!payload) {
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { force: true });
      return true;
    }
    return false;
  }
  return writeJsonFileIfChanged(targetPath, payload);
}

function syncTenantDerivedAgentContext(db, params = {}) {
  const workspaceChanged = patchDerivedAgentWorkspaceFiles(params);
  const runtimeChanged = syncTenantDerivedAgentDataAccessRuntime(db, params);
  return workspaceChanged || runtimeChanged;
}

function syncDerivedAgentRuntimeFiles(params = {}) {
  const baseAgentId = String(params.baseAgentId || "").trim();
  const derivedAgentId = String(params.derivedAgentId || "").trim();
  if (!baseAgentId || !derivedAgentId || baseAgentId === derivedAgentId) {
    return false;
  }

  const baseAgentRuntimeDir = resolveAgentRuntimeDir(baseAgentId, params);
  const derivedAgentRuntimeDir = resolveAgentRuntimeDir(derivedAgentId, params);
  if (!baseAgentRuntimeDir || !derivedAgentRuntimeDir || !fs.existsSync(baseAgentRuntimeDir)) {
    return false;
  }

  let changed = false;
  fs.mkdirSync(derivedAgentRuntimeDir, { recursive: true });
  const configuredModelsPayload = buildDerivedAgentModelsPayload(params);
  if (configuredModelsPayload) {
    changed =
      writeJsonFileIfChanged(
        path.join(derivedAgentRuntimeDir, "models.json"),
        configuredModelsPayload,
      ) || changed;
  }
  const configuredAuthProfilesPayload = buildDerivedAgentAuthProfilesPayload(params);
  if (configuredAuthProfilesPayload) {
    changed =
      writeJsonFileIfChanged(
        path.join(derivedAgentRuntimeDir, "auth-profiles.json"),
        configuredAuthProfilesPayload,
      ) || changed;
  }
  if (configuredModelsPayload || configuredAuthProfilesPayload) {
    return changed;
  }
  for (const fileName of ["models.json", "auth-profiles.json"]) {
    const sourcePath = path.join(baseAgentRuntimeDir, fileName);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }
    const targetPath = path.join(derivedAgentRuntimeDir, fileName);
    const nextContent = fs.readFileSync(sourcePath);
    const currentContent = fs.existsSync(targetPath) ? fs.readFileSync(targetPath) : null;
    if (currentContent && Buffer.compare(currentContent, nextContent) === 0) {
      continue;
    }
    fs.writeFileSync(targetPath, nextContent);
    changed = true;
  }
  return changed;
}

function cleanupDerivedAgentExecApprovals(entries, params = {}) {
  if (!Array.isArray(entries) || !entries.length) {
    return 0;
  }

  const filePath = resolveExecApprovalsFilePath(params);
  const current = readExecApprovalsFile(filePath);
  if (!current) {
    return 0;
  }

  const agents =
    current.agents && typeof current.agents === "object" && !Array.isArray(current.agents)
      ? { ...current.agents }
      : null;
  if (!agents) {
    return 0;
  }

  let removedCount = 0;
  for (const entry of entries) {
    const derivedAgentId = String(entry?.derivedAgentId || "").trim();
    if (!derivedAgentId || !Object.prototype.hasOwnProperty.call(agents, derivedAgentId)) {
      continue;
    }
    delete agents[derivedAgentId];
    removedCount += 1;
  }
  if (!removedCount) {
    return 0;
  }

  if (
    !writeExecApprovalsFile(filePath, {
      ...current,
      agents,
    })
  ) {
    return 0;
  }
  return removedCount;
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
  const runtimeWorkspaceDir = resolveHomePath(
    params.workspaceDir || process.env.OPENCLAW_WORKSPACE_DIR,
    configDir,
  );
  const candidates = [];

  const configuredWorkspace = resolveHomePath(entry?.workspace, configDir);
  if (configuredWorkspace) {
    candidates.push(configuredWorkspace);
  }

  if (runtimeWorkspaceDir && (!baseAgentId || baseAgentId === defaultAgentId)) {
    candidates.push(runtimeWorkspaceDir);
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

function appendDerivedAgentMemoryHint(workspaceRoot) {
  const memoryPath = path.join(workspaceRoot, "MEMORY.md");
  if (!fs.existsSync(memoryPath)) {
    return false;
  }
  const current = fs.readFileSync(memoryPath, "utf8");
  if (current.includes("## 零侵入采购查询提示")) {
    return false;
  }
  const next = `${current.replace(/\s*$/, "")}\n\n${DERIVED_AGENT_ANALYTICS_MEMORY_HINT}\n`;
  fs.writeFileSync(memoryPath, next, "utf8");
  return true;
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
  appendDerivedAgentMemoryHint(canonicalWorkspace);

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
  appendDerivedAgentMemoryHint(runtimeWorkspace);

  return {
    canonicalWorkspace,
    runtimeWorkspace,
  };
}

function isPathInside(basePath, candidatePath) {
  const base = path.resolve(String(basePath || "").trim());
  const candidate = path.resolve(String(candidatePath || "").trim());
  if (!base || !candidate) {
    return false;
  }
  const relative = path.relative(base, candidate);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function removeWorkspacePath(targetPath) {
  const normalized = String(targetPath || "").trim();
  if (!normalized) {
    return false;
  }
  let stats;
  try {
    stats = fs.lstatSync(normalized);
  } catch {
    return false;
  }
  if (stats.isSymbolicLink()) {
    fs.rmSync(normalized, { force: true });
    return true;
  }
  if (stats.isDirectory()) {
    fs.rmSync(normalized, { recursive: true, force: true });
    return true;
  }
  fs.rmSync(normalized, { force: true });
  return true;
}

function collectMemberDerivedWorkspaceEntries(db, params) {
  const tenantId = String(params.tenantId || "").trim();
  const userId = String(params.userId || "").trim();
  if (!tenantId || !userId) {
    return [];
  }
  return db
    .prepare(
      `SELECT derived_agent_id AS derivedAgentId,
              derived_workspace_dir AS derivedWorkspaceDir
       FROM user_agent_assignments
       WHERE tenant_id = ? AND user_id = ?`,
    )
    .all(tenantId, userId)
    .map((row) => ({
      derivedAgentId: String(row?.derivedAgentId || "").trim(),
      derivedWorkspaceDir: String(row?.derivedWorkspaceDir || "").trim(),
    }))
    .filter((row) => row.derivedAgentId || row.derivedWorkspaceDir);
}

function cleanupMemberDerivedWorkspaces(entries, params = {}) {
  if (!Array.isArray(entries) || !entries.length) {
    return {
      removedWorkspaceCount: 0,
      removedPathCount: 0,
    };
  }

  const configDir = resolveConfigDir(params);
  const workspaceAgentsRoot = path.join(configDir, "workspace-agents");
  const removedWorkspaceIds = new Set();
  const removedPaths = new Set();

  for (const entry of entries) {
    const derivedAgentId =
      String(entry?.derivedAgentId || "").trim() ||
      path.basename(String(entry?.derivedWorkspaceDir || "").trim());
    if (!derivedAgentId) {
      continue;
    }

    let canonicalWorkspace = "";
    const recordedWorkspace = String(entry?.derivedWorkspaceDir || "").trim();
    if (recordedWorkspace) {
      const resolvedRecordedWorkspace = path.resolve(recordedWorkspace);
      if (
        isPathInside(workspaceAgentsRoot, resolvedRecordedWorkspace) &&
        path.basename(resolvedRecordedWorkspace) === derivedAgentId
      ) {
        canonicalWorkspace = resolvedRecordedWorkspace;
      }
    }
    if (!canonicalWorkspace) {
      canonicalWorkspace = path.join(workspaceAgentsRoot, derivedAgentId);
    }

    const runtimeWorkspace = path.join(configDir, `workspace-${derivedAgentId}`);
    const targets = [runtimeWorkspace, canonicalWorkspace];
    let removedForWorkspace = false;
    for (const target of targets) {
      const resolvedTarget = path.resolve(target);
      if (!isPathInside(configDir, resolvedTarget)) {
        continue;
      }
      try {
        if (removeWorkspacePath(resolvedTarget)) {
          removedPaths.add(resolvedTarget);
          removedForWorkspace = true;
        }
      } catch {
        // Best-effort cleanup only. Member deletion must not be blocked by stale workspace files.
      }
    }
    if (removedForWorkspace) {
      removedWorkspaceIds.add(derivedAgentId);
    }
  }

  return {
    removedWorkspaceCount: removedWorkspaceIds.size,
    removedPathCount: removedPaths.size,
  };
}

function snapshotMemberUsageHistory(db, params) {
  const tenantId = String(params?.tenantId || "").trim();
  const userId = String(params?.userId || "").trim();
  const memberUsername = String(params?.memberUsername || "").trim();
  if (!tenantId || !userId) {
    return 0;
  }

  return Number(
    db
      .prepare(
        `UPDATE tenant_usage_records
         SET user_id = NULL,
             member_user_id = COALESCE(NULLIF(member_user_id, ''), @memberUserId),
             member_username = CASE
               WHEN TRIM(COALESCE(member_username, '')) != '' THEN member_username
               ELSE @memberUsername
             END,
             updated_at = @updatedAt
         WHERE tenant_id = @tenantId AND user_id = @userId`,
      )
      .run({
        tenantId,
        userId,
        memberUserId: userId,
        memberUsername,
        updatedAt: nowIso(),
      })?.changes || 0,
  );
}

function purgeTenantMemberUserData(db, params = {}) {
  const tenantId = String(params?.tenantId || "").trim();
  const userId = String(params?.userId || "").trim();
  const memberUsername = String(params?.memberUsername || "").trim();
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }
  if (!userId) {
    throw new Error("user_id_required");
  }

  const cleanupEntries = collectMemberDerivedWorkspaceEntries(db, { tenantId, userId });
  const preservedUsageCount = snapshotMemberUsageHistory(db, {
    tenantId,
    userId,
    memberUsername,
  });
  const deletedAssignments = db.prepare(
    `DELETE FROM user_agent_assignments
     WHERE tenant_id = @tenantId AND user_id = @userId`,
  ).run({
    tenantId,
    userId,
  });
  // Keep explicit cleanup for Task 1-upgraded databases created before these
  // scope tables gained foreign keys; fresh installs cascade, upgraded ones may not.
  db.prepare(
    `DELETE FROM tenant_member_org_scopes
     WHERE tenant_id = @tenantId AND user_id = @userId`,
  ).run({
    tenantId,
    userId,
  });
  db.prepare(
    `DELETE FROM tenant_member_source_policies
     WHERE tenant_id = @tenantId AND user_id = @userId`,
  ).run({
    tenantId,
    userId,
  });
  const deletedUser = db.prepare(
    `DELETE FROM users
     WHERE id = @userId AND role = 'member'`,
  ).run({
    userId,
  });
  if (!Number(deletedUser?.changes || 0)) {
    throw new Error("成员不存在");
  }
  const cleanupResult = cleanupMemberDerivedWorkspaces(cleanupEntries, params);
  try {
    cleanupDerivedAgentExecApprovals(cleanupEntries, params);
  } catch {
    // Best-effort cleanup only. Member deletion must not be blocked by stale approval buckets.
  }

  return {
    deletedAssignmentCount: Number(deletedAssignments?.changes || 0),
    preservedUsageCount,
    removedWorkspaceCount: Number(cleanupResult?.removedWorkspaceCount || 0),
    removedWorkspacePathCount: Number(cleanupResult?.removedPathCount || 0),
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

function resolveAssignedAgentDisplayName(...candidates) {
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value) {
      continue;
    }
    const normalized = value.toLowerCase();
    if (normalized === "not_found" || normalized === "not found" || normalized === "unknown") {
      continue;
    }
    if (normalized === "未知 agent") {
      continue;
    }
    return value;
  }
  return "";
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
  ensureDiscoveredLocalAnalyticsDataSource(db, config);
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

export function listDataSources(db) {
  return db
    .prepare(
      `SELECT id,
              code,
              name,
              source_type AS sourceType,
              status,
              connection_json AS connectionJson,
              source_dbid AS sourceDbid,
              source_tenant_code AS sourceTenantCode,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM data_sources
       ORDER BY created_at DESC, updated_at DESC`,
    )
    .all()
    .map(mapDataSourceRow);
}

export function upsertDataSource(db, params = {}) {
  const code = String(params.code || "").trim();
  const name = String(params.name || "").trim();
  const sourceType = String(params.sourceType || "").trim();
  if (!code) {
    throw new Error("data_source_code_required");
  }
  if (!name) {
    throw new Error("data_source_name_required");
  }
  if (!sourceType) {
    throw new Error("data_source_type_required");
  }

  const existing =
    (params.id
      ? db
          .prepare("SELECT id, connection_json AS connectionJson FROM data_sources WHERE id = ?")
          .get(String(params.id).trim())
      : null) ??
    db.prepare("SELECT id, connection_json AS connectionJson FROM data_sources WHERE code = ?").get(code);
  const now = nowIso();
  const hasExplicitConnection =
    Object.prototype.hasOwnProperty.call(params, "connection") ||
    Object.prototype.hasOwnProperty.call(params, "connectionJson");
  const storedConnection = buildStoredDataSourceConnection(
    existing?.connectionJson,
    params.connection ?? params.connectionJson,
    Boolean(existing?.id) && !hasExplicitConnection,
  );
  const connectionJson = serializeDataSourceConnection(storedConnection);
  const status = normalizeDataSourceStatus(params.status);

  if (existing?.id) {
    db.prepare(
      `UPDATE data_sources
       SET code = @code,
           name = @name,
           source_type = @sourceType,
           status = @status,
           connection_json = @connectionJson,
           source_dbid = @sourceDbid,
           source_tenant_code = @sourceTenantCode,
           updated_at = @updatedAt
       WHERE id = @id`,
    ).run({
      id: existing.id,
      code,
      name,
      sourceType,
      status,
      connectionJson,
      sourceDbid: params.sourceDbid || null,
      sourceTenantCode: params.sourceTenantCode || null,
      updatedAt: now,
    });
    return getDataSourceById(db, existing.id);
  }

  const dataSourceId = createId("data_source");
  db.prepare(
    `INSERT INTO data_sources (
       id,
       code,
       name,
       source_type,
       status,
       connection_json,
       source_dbid,
       source_tenant_code,
       created_at,
       updated_at
     ) VALUES (
       @id,
       @code,
       @name,
       @sourceType,
       @status,
       @connectionJson,
       @sourceDbid,
       @sourceTenantCode,
       @createdAt,
       @updatedAt
     )`,
  ).run({
    id: dataSourceId,
    code,
    name,
    sourceType,
    status,
    connectionJson,
    sourceDbid: params.sourceDbid || null,
    sourceTenantCode: params.sourceTenantCode || null,
    createdAt: now,
    updatedAt: now,
  });
  return getDataSourceById(db, dataSourceId);
}

export function getTenantDataSourceBinding(db, tenantId) {
  const normalizedTenantId = String(tenantId || "").trim();
  if (!normalizedTenantId) {
    return null;
  }
  return mapTenantDataSourceBindingRow(
    db
      .prepare(
        `SELECT b.id,
                b.tenant_id AS tenantId,
                b.data_source_id AS dataSourceId,
                b.bound_by_user_id AS boundByUserId,
                b.created_at AS createdAt,
                b.updated_at AS updatedAt,
                ds.code AS dataSourceCode,
                ds.name AS dataSourceName,
                ds.source_type AS dataSourceType,
                ds.status AS dataSourceStatus,
                ds.connection_json AS connectionJson,
                ds.source_dbid AS sourceDbid,
                ds.source_tenant_code AS sourceTenantCode
         FROM tenant_data_source_bindings b
         JOIN data_sources ds ON ds.id = b.data_source_id
         WHERE b.tenant_id = ?`,
      )
      .get(normalizedTenantId),
  );
}

export function setTenantDataSourceBinding(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const dataSourceId = String(params.dataSourceId || "").trim();
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }
  if (!dataSourceId) {
    throw new Error("data_source_id_required");
  }
  if (!getDataSourceById(db, dataSourceId)) {
    throw new Error("data_source_not_found");
  }

  return runInTransaction(db, () => {
    const occupiedBinding = db
      .prepare(
        `SELECT tenant_id AS tenantId
         FROM tenant_data_source_bindings
         WHERE data_source_id = ?`,
      )
      .get(dataSourceId);
    if (occupiedBinding?.tenantId && String(occupiedBinding.tenantId || "").trim() !== tenantId) {
      throw new Error("data_source_already_bound");
    }
    const existing = db
      .prepare(
        `SELECT id, data_source_id AS dataSourceId
         FROM tenant_data_source_bindings
         WHERE tenant_id = ?`,
      )
      .get(tenantId);
    const now = nowIso();
    if (existing?.id) {
      db.prepare(
        `UPDATE tenant_data_source_bindings
         SET data_source_id = @dataSourceId,
             bound_by_user_id = @boundByUserId,
             updated_at = @updatedAt
         WHERE id = @id`,
      ).run({
        id: existing.id,
        dataSourceId,
        boundByUserId: params.boundByUserId || null,
        updatedAt: now,
      });
      if (String(existing.dataSourceId || "").trim() !== dataSourceId) {
        db.prepare("DELETE FROM tenant_member_org_scopes WHERE tenant_id = ?").run(tenantId);
        db.prepare(
          `UPDATE tenant_member_source_policies
           SET scope_mode = 'none',
               updated_at = @updatedAt
           WHERE tenant_id = @tenantId`,
        ).run({
          tenantId,
          updatedAt: now,
        });
      }
    } else {
      db.prepare(
        `INSERT INTO tenant_data_source_bindings (
           id,
           tenant_id,
           data_source_id,
           bound_by_user_id,
           created_at,
           updated_at
         ) VALUES (
           @id,
           @tenantId,
           @dataSourceId,
           @boundByUserId,
           @createdAt,
           @updatedAt
         )`,
      ).run({
        id: createId("tenant_binding"),
        tenantId,
        dataSourceId,
        boundByUserId: params.boundByUserId || null,
        createdAt: now,
        updatedAt: now,
      });
    }
    const binding = getTenantDataSourceBinding(db, tenantId);
    const derivedAssignments = db
      .prepare(
        `SELECT ua.derived_agent_id AS derivedAgentId,
                ua.tenant_agent_id AS tenantAgentId,
                ta.agent_id AS baseAgentId,
                ua.user_id AS userId
         FROM user_agent_assignments ua
         JOIN tenant_agents ta ON ta.id = ua.tenant_agent_id
         WHERE ua.tenant_id = ? AND ua.status = 'active'`,
      )
      .all(tenantId);
    for (const assignment of derivedAssignments) {
      syncTenantDerivedAgentContext(db, {
        tenantId,
        userId: assignment.userId,
        tenantAgentId: assignment.tenantAgentId,
        baseAgentId: assignment.baseAgentId,
        derivedAgentId: assignment.derivedAgentId,
        configPath: params.configPath,
        configDir: params.configDir,
      });
    }
    return binding;
  });
}

export function getTenantMemberOrgScope(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const userId = String(params.userId || "").trim();
  const resolvedDataSourceId =
    String(params.dataSourceId || "").trim() ||
    String(getTenantDataSourceBinding(db, tenantId)?.dataSourceId || "").trim();
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }
  if (!userId) {
    throw new Error("user_id_required");
  }

  const policy =
    resolvedDataSourceId
      ? db
          .prepare(
            `SELECT id,
                    scope_mode AS scopeMode,
                    sandbox_enabled AS sandboxEnabled,
                    created_by_user_id AS createdByUserId,
                    created_at AS createdAt,
                    updated_at AS updatedAt
             FROM tenant_member_source_policies
             WHERE tenant_id = @tenantId
               AND user_id = @userId
               AND data_source_id = @dataSourceId`,
          )
          .get({
            tenantId,
            userId,
            dataSourceId: resolvedDataSourceId,
          })
      : null;
  const orgScopes =
    resolvedDataSourceId
      ? db
          .prepare(
            `SELECT org_id AS orgId,
                    org_name_snapshot AS orgNameSnapshot,
                    created_at AS createdAt
             FROM tenant_member_org_scopes
             WHERE tenant_id = @tenantId
               AND user_id = @userId
               AND data_source_id = @dataSourceId
             ORDER BY org_id ASC`,
          )
          .all({
            tenantId,
            userId,
            dataSourceId: resolvedDataSourceId,
          })
      : [];
  const scopeMode = normalizeScopeMode(policy?.scopeMode) || "none";

  return {
    id: policy?.id ?? null,
    tenantId,
    userId,
    dataSourceId: resolvedDataSourceId || null,
    scopeMode,
    sandboxEnabled: Number(policy?.sandboxEnabled || 0) > 0,
    orgScopeCount: scopeMode === "custom" ? orgScopes.length : 0,
    orgScopes,
    createdByUserId: policy?.createdByUserId ?? null,
    createdAt: policy?.createdAt ?? null,
    updatedAt: policy?.updatedAt ?? null,
  };
}

export function setTenantMemberOrgScope(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const userId = String(params.userId || "").trim();
  const dataSourceId = String(params.dataSourceId || "").trim();
  const scopeMode = normalizeScopeMode(params.scopeMode);
  const orgScopes =
    scopeMode === "custom" ? normalizeOrgScopeEntries(params.orgScopes ?? params.orgIds) : [];
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }
  if (!userId) {
    throw new Error("user_id_required");
  }
  if (!dataSourceId) {
    throw new Error("data_source_id_required");
  }
  if (!scopeMode) {
    throw new Error("scope_mode_invalid");
  }
  if (scopeMode === "custom" && orgScopes.length === 0) {
    throw new Error("member_org_scope_empty");
  }
  const binding = getTenantDataSourceBinding(db, tenantId);
  if (!binding || String(binding.dataSourceId || "").trim() !== dataSourceId) {
    throw new Error("tenant_data_source_unbound");
  }
  if (!getTenantMemberRow(db, tenantId, userId)) {
    throw new Error("member_not_found");
  }

  return runInTransaction(db, () => {
    const now = nowIso();
    const existing = db
      .prepare(
        `SELECT id,
                sandbox_enabled AS sandboxEnabled
         FROM tenant_member_source_policies
         WHERE tenant_id = @tenantId
           AND user_id = @userId
           AND data_source_id = @dataSourceId`,
      )
      .get({
        tenantId,
        userId,
        dataSourceId,
      });
    const sandboxEnabled =
      params.sandboxEnabled === true ||
      params.sandboxEnabled === false ||
      Number(params.sandboxEnabled) > 0
        ? Number(params.sandboxEnabled) > 0 || params.sandboxEnabled === true
        : Number(existing?.sandboxEnabled || 0) > 0 || !existing?.id;
    if (existing?.id) {
      db.prepare(
        `UPDATE tenant_member_source_policies
         SET scope_mode = @scopeMode,
             sandbox_enabled = @sandboxEnabled,
             created_by_user_id = @createdByUserId,
             updated_at = @updatedAt
         WHERE id = @id`,
      ).run({
        id: existing.id,
        scopeMode,
        sandboxEnabled: sandboxEnabled ? 1 : 0,
        createdByUserId: params.createdByUserId || null,
        updatedAt: now,
      });
    } else {
      db.prepare(
        `INSERT INTO tenant_member_source_policies (
           id,
           tenant_id,
           user_id,
           data_source_id,
           scope_mode,
           sandbox_enabled,
           created_by_user_id,
           created_at,
           updated_at
         ) VALUES (
           @id,
           @tenantId,
           @userId,
           @dataSourceId,
           @scopeMode,
           @sandboxEnabled,
           @createdByUserId,
           @createdAt,
           @updatedAt
         )`,
      ).run({
        id: createId("member_scope"),
        tenantId,
        userId,
        dataSourceId,
        scopeMode,
        sandboxEnabled: sandboxEnabled ? 1 : 0,
        createdByUserId: params.createdByUserId || null,
        createdAt: now,
        updatedAt: now,
      });
    }

    db.prepare(
      `DELETE FROM tenant_member_org_scopes
       WHERE tenant_id = @tenantId
         AND user_id = @userId
         AND data_source_id = @dataSourceId`,
    ).run({
      tenantId,
      userId,
      dataSourceId,
    });

    if (scopeMode === "custom") {
      const insertScope = db.prepare(
        `INSERT INTO tenant_member_org_scopes (
           id,
           tenant_id,
           user_id,
           data_source_id,
           org_id,
           org_name_snapshot,
           created_at
         ) VALUES (
           @id,
           @tenantId,
           @userId,
           @dataSourceId,
           @orgId,
           @orgNameSnapshot,
           @createdAt
         )`,
      );
      for (const orgScope of orgScopes) {
        insertScope.run({
          id: createId("member_org"),
          tenantId,
          userId,
          dataSourceId,
          orgId: orgScope.orgId,
          orgNameSnapshot: orgScope.orgNameSnapshot,
          createdAt: now,
        });
      }
    }

    const scope = getTenantMemberOrgScope(db, {
      tenantId,
      userId,
      dataSourceId,
    });
    const derivedAssignments = db
      .prepare(
        `SELECT ua.derived_agent_id AS derivedAgentId,
                ua.tenant_agent_id AS tenantAgentId,
                ta.agent_id AS baseAgentId
         FROM user_agent_assignments ua
         JOIN tenant_agents ta ON ta.id = ua.tenant_agent_id
         WHERE ua.tenant_id = ? AND ua.user_id = ? AND ua.status = 'active'`,
      )
      .all(tenantId, userId);
    for (const assignment of derivedAssignments) {
      syncTenantDerivedAgentContext(db, {
        tenantId,
        userId,
        tenantAgentId: assignment.tenantAgentId,
        baseAgentId: assignment.baseAgentId,
        derivedAgentId: assignment.derivedAgentId,
        configPath: params.configPath,
        configDir: params.configDir,
      });
    }
    return scope;
  });
}

export function resolveMemberDataAccessContext(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const userId = String(params.userId || "").trim();
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }
  if (!userId) {
    throw new Error("user_id_required");
  }
  if (!getTenantMemberRow(db, tenantId, userId)) {
    throw new Error("member_not_found");
  }
  const binding = getTenantDataSourceBinding(db, tenantId);
  if (!binding) {
    throw new Error("tenant_data_source_unbound");
  }
  const dataSource = getDataSourceById(db, binding.dataSourceId);
  if (!dataSource) {
    throw new Error("data_source_not_found");
  }
  const scope = getTenantMemberOrgScope(db, {
    tenantId,
    userId,
    dataSourceId: binding.dataSourceId,
  });
  if (scope.scopeMode === "all") {
    return {
      tenantId,
      userId,
      dataSourceId: binding.dataSourceId,
      sourceType: dataSource.sourceType,
      connection: dataSource.connection,
      scopeMode: "all",
      allowedOrgIds: null,
    };
  }
  if (scope.scopeMode === "custom" && scope.orgScopeCount > 0) {
    return {
      tenantId,
      userId,
      dataSourceId: binding.dataSourceId,
      sourceType: dataSource.sourceType,
      connection: dataSource.connection,
      scopeMode: "custom",
      allowedOrgIds: scope.orgScopes.map((entry) => entry.orgId),
    };
  }
  throw new Error("member_org_scope_empty");
}

function mapPlatformUpdateLogRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: String(row.id || "").trim(),
    versionLabel: String(row.versionLabel || "").trim(),
    title: String(row.title || "").trim(),
    content: String(row.content || ""),
    excerpt: buildUpdateLogExcerpt(row.content),
    createdByUserId: String(row.createdByUserId || "").trim() || null,
    createdByUsername: String(row.createdByUsername || "").trim() || "平台管理员",
    publishedAt: String(row.publishedAt || "").trim(),
    createdAt: String(row.createdAt || "").trim(),
    updatedAt: String(row.updatedAt || "").trim(),
  };
}

export function listPlatformUpdateLogs(db) {
  return db
    .prepare(
      `SELECT id,
              version_label AS versionLabel,
              title,
              content,
              created_by_user_id AS createdByUserId,
              created_by_username AS createdByUsername,
              published_at AS publishedAt,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM platform_update_logs
       ORDER BY published_at DESC, updated_at DESC, created_at DESC`,
    )
    .all()
    .map(mapPlatformUpdateLogRow)
    .filter(Boolean);
}

export function createPlatformUpdateLog(db, params) {
  const versionLabel = normalizeUpdateLogVersionLabel(params?.versionLabel);
  const title = normalizeUpdateLogTitle(params?.title);
  const content = normalizeUpdateLogContent(params?.content);
  if (!versionLabel) {
    throw new Error("update_log_version_required");
  }
  if (!title) {
    throw new Error("update_log_title_required");
  }
  if (!content) {
    throw new Error("update_log_content_required");
  }
  const now = nowIso();
  const id = createId("update_log");
  db.prepare(
    `INSERT INTO platform_update_logs (
       id,
       version_label,
       title,
       content,
       created_by_user_id,
       created_by_username,
       published_at,
       created_at,
       updated_at
     )
     VALUES (
       @id,
       @versionLabel,
       @title,
       @content,
       @createdByUserId,
       @createdByUsername,
       @publishedAt,
       @createdAt,
       @updatedAt
     )`,
  ).run({
    id,
    versionLabel,
    title,
    content,
    createdByUserId: String(params?.createdByUserId || "").trim() || null,
    createdByUsername:
      normalizeUpdateLogText(params?.createdByUsername, { maxLength: 64, preserveNewlines: false }) ||
      "平台管理员",
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return listPlatformUpdateLogs(db).find((row) => row.id === id) ?? null;
}

export function updatePlatformUpdateLog(db, params) {
  const id = String(params?.id || "").trim();
  if (!id) {
    throw new Error("update_log_id_required");
  }
  const existing = db.prepare("SELECT id FROM platform_update_logs WHERE id = ?").get(id);
  if (!existing) {
    throw new Error("update_log_not_found");
  }
  const versionLabel = normalizeUpdateLogVersionLabel(params?.versionLabel);
  const title = normalizeUpdateLogTitle(params?.title);
  const content = normalizeUpdateLogContent(params?.content);
  if (!versionLabel) {
    throw new Error("update_log_version_required");
  }
  if (!title) {
    throw new Error("update_log_title_required");
  }
  if (!content) {
    throw new Error("update_log_content_required");
  }
  db.prepare(
    `UPDATE platform_update_logs
     SET version_label = @versionLabel,
         title = @title,
         content = @content,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id,
    versionLabel,
    title,
    content,
    updatedAt: nowIso(),
  });
  return listPlatformUpdateLogs(db).find((row) => row.id === id) ?? null;
}

export function deletePlatformUpdateLog(db, params) {
  const id = String(params?.id || "").trim();
  if (!id) {
    throw new Error("update_log_id_required");
  }
  const existing = db
    .prepare(
      `SELECT id,
              version_label AS versionLabel,
              title,
              content,
              created_by_user_id AS createdByUserId,
              created_by_username AS createdByUsername,
              published_at AS publishedAt,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM platform_update_logs
       WHERE id = ?`,
    )
    .get(id);
  if (!existing) {
    throw new Error("update_log_not_found");
  }
  db.prepare("DELETE FROM platform_update_logs WHERE id = ?").run(id);
  return mapPlatformUpdateLogRow(existing);
}

export function getTenantSummary(db, tenantId) {
  return (
    db
      .prepare(
        `SELECT t.id, t.code, t.name, t.status, t.deployment_mode AS deploymentMode,
              tq.member_limit AS memberLimit, tq.license_expires_at AS licenseExpiresAt,
              tw.balance_points AS walletBalance,
              b.data_source_id AS dataSourceId,
              ds.name AS dataSourceName,
              ds.source_type AS dataSourceType,
              COUNT(DISTINCT CASE WHEN tm.role = 'member' AND tm.status = 'active' THEN tm.user_id END) AS memberCount,
              COUNT(DISTINCT CASE WHEN ta.status = 'active' THEN ta.id END) AS agentCount
       FROM tenants t
       LEFT JOIN tenant_quotas tq ON tq.tenant_id = t.id
       LEFT JOIN tenant_wallets tw ON tw.tenant_id = t.id
       LEFT JOIN tenant_data_source_bindings b ON b.tenant_id = t.id
       LEFT JOIN data_sources ds ON ds.id = b.data_source_id
       LEFT JOIN tenant_memberships tm ON tm.tenant_id = t.id
       LEFT JOIN tenant_agents ta ON ta.tenant_id = t.id
       WHERE t.id = ?
       GROUP BY t.id, tq.member_limit, tq.license_expires_at, tw.balance_points, b.data_source_id, ds.name, ds.source_type`,
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
              b.data_source_id AS dataSourceId,
              ds.name AS dataSourceName,
              ds.source_type AS dataSourceType,
              COUNT(DISTINCT CASE WHEN tm.role = 'member' AND tm.status = 'active' THEN tm.user_id END) AS memberCount,
              COUNT(DISTINCT CASE WHEN ta.status = 'active' THEN ta.id END) AS agentCount
       FROM tenants t
       LEFT JOIN tenant_quotas tq ON tq.tenant_id = t.id
       LEFT JOIN tenant_wallets tw ON tw.tenant_id = t.id
       LEFT JOIN tenant_data_source_bindings b ON b.tenant_id = t.id
       LEFT JOIN data_sources ds ON ds.id = b.data_source_id
       LEFT JOIN tenant_memberships tm ON tm.tenant_id = t.id
       LEFT JOIN tenant_agents ta ON ta.tenant_id = t.id
       GROUP BY t.id, tq.member_limit, tq.license_expires_at, tw.balance_points, b.data_source_id, ds.name, ds.source_type
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
  const tenantId = String(params.tenantId || "").trim();
  const username = String(params.username || "").trim();
  const password = String(params.password || "");
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }
  if (!username) {
    throw new Error("成员账号不能为空");
  }
  if (!password.trim()) {
    throw new Error("成员密码不能为空");
  }
  const quota = db
    .prepare("SELECT member_limit AS memberLimit FROM tenant_quotas WHERE tenant_id = ?")
    .get(tenantId);
  if (!quota) {
    throw new Error("租户额度不存在");
  }
  if (countTenantMembers(db, tenantId) >= Number(quota.memberLimit || 0)) {
    throw new Error("租户人数已达上限");
  }

  const userId = runInTransaction(db, () => {
    const now = nowIso();
    const existingUser = db
      .prepare("SELECT id, role, status FROM users WHERE username = ?")
      .get(username);
    if (existingUser) {
      const memberships = db
        .prepare(
          `SELECT id, tenant_id AS tenantId, role, status
           FROM tenant_memberships
           WHERE user_id = ?
           ORDER BY created_at ASC`,
        )
        .all(existingUser.id);
      const canPurgeLegacyDeletedMember =
        String(existingUser.role || "").trim() === "member" &&
        memberships.length === 1 &&
        String(memberships[0]?.tenantId || "").trim() === tenantId &&
        String(memberships[0]?.role || "").trim() === "member" &&
        String(memberships[0]?.status || "").trim() === "deleted";
      if (!canPurgeLegacyDeletedMember) {
        throw new Error("成员账号已存在");
      }
      purgeTenantMemberUserData(db, {
        tenantId,
        userId: existingUser.id,
        memberUsername: username,
        configDir: params.configDir,
        configPath: params.configPath,
      });
    }

    const nextUserId = createId("user");
    const membershipId = createId("membership");

    try {
      db.prepare(
        `INSERT INTO users (id, username, password_hash, role, status, created_at, updated_at)
         VALUES (@id, @username, @passwordHash, 'member', 'active', @createdAt, @updatedAt)`,
      ).run({
        id: nextUserId,
        username,
        passwordHash: hashPassword(password),
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("unique")) {
        throw new Error("成员账号已存在");
      }
      throw error;
    }

    db.prepare(
      `INSERT INTO tenant_memberships (id, tenant_id, user_id, role, status, created_at)
       VALUES (@id, @tenantId, @userId, 'member', 'active', @createdAt)`,
    ).run({
      id: membershipId,
      tenantId,
      userId: nextUserId,
      createdAt: now,
    });

    return nextUserId;
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

function getTenantMemberRow(db, tenantId, userId) {
  return (
    db
      .prepare(
        `SELECT u.id, u.username, u.status,
              tm.role, tm.created_at AS createdAt,
              COUNT(DISTINCT ua.tenant_agent_id) AS assignedAgentCount,
              COALESCE(sp.scope_mode, 'none') AS orgScopeMode,
              COALESCE(sp.sandbox_enabled, 0) AS sandboxEnabled,
              CASE
                WHEN COALESCE(sp.scope_mode, 'none') = 'custom' THEN COUNT(DISTINCT os.org_id)
                ELSE 0
              END AS orgScopeCount
       FROM users u
       JOIN tenant_memberships tm ON tm.user_id = u.id
       LEFT JOIN user_agent_assignments ua ON ua.user_id = u.id AND ua.status = 'active'
       LEFT JOIN tenant_data_source_bindings b ON b.tenant_id = tm.tenant_id
       LEFT JOIN tenant_member_source_policies sp
         ON sp.tenant_id = tm.tenant_id
        AND sp.user_id = u.id
        AND sp.data_source_id = b.data_source_id
       LEFT JOIN tenant_member_org_scopes os
         ON os.tenant_id = tm.tenant_id
        AND os.user_id = u.id
        AND os.data_source_id = b.data_source_id
       WHERE tm.tenant_id = ? AND tm.role = 'member' AND tm.status != 'deleted' AND u.id = ?
       GROUP BY u.id, tm.role, tm.created_at, sp.scope_mode, sp.sandbox_enabled`,
      )
      .get(tenantId, userId) ?? null
  );
}

export function listTenantMembers(db, tenantId) {
  return db
    .prepare(
      `SELECT u.id, u.username, u.status,
              tm.role, tm.created_at AS createdAt,
              COUNT(DISTINCT ua.tenant_agent_id) AS assignedAgentCount,
              COALESCE(sp.scope_mode, 'none') AS orgScopeMode,
              COALESCE(sp.sandbox_enabled, 0) AS sandboxEnabled,
              CASE
                WHEN COALESCE(sp.scope_mode, 'none') = 'custom' THEN COUNT(DISTINCT os.org_id)
                ELSE 0
              END AS orgScopeCount
       FROM users u
       JOIN tenant_memberships tm ON tm.user_id = u.id
       LEFT JOIN user_agent_assignments ua ON ua.user_id = u.id AND ua.status = 'active'
       LEFT JOIN tenant_data_source_bindings b ON b.tenant_id = tm.tenant_id
       LEFT JOIN tenant_member_source_policies sp
         ON sp.tenant_id = tm.tenant_id
        AND sp.user_id = u.id
        AND sp.data_source_id = b.data_source_id
       LEFT JOIN tenant_member_org_scopes os
         ON os.tenant_id = tm.tenant_id
        AND os.user_id = u.id
        AND os.data_source_id = b.data_source_id
       WHERE tm.tenant_id = ? AND tm.role = 'member' AND tm.status != 'deleted'
       GROUP BY u.id, tm.role, tm.created_at, sp.scope_mode, sp.sandbox_enabled
       ORDER BY tm.created_at DESC`,
    )
    .all(tenantId);
}

function normalizeMemberStatus(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "active" || normalized === "inactive") {
    return normalized;
  }
  return "";
}

export function updateTenantMemberPassword(db, params) {
  const tenantId = String(params.tenantId || "").trim();
  const userId = String(params.userId || "").trim();
  const password = String(params.password || "").trim();
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }
  if (!userId) {
    throw new Error("user_id_required");
  }
  if (!password) {
    throw new Error("密码不能为空");
  }

  return runInTransaction(db, () => {
    const current = getTenantMemberRow(db, tenantId, userId);
    if (!current) {
      throw new Error("成员不存在");
    }
    db.prepare(
      `UPDATE users
       SET password_hash = @passwordHash,
           updated_at = @updatedAt
       WHERE id = @userId`,
    ).run({
      userId,
      passwordHash: hashPassword(password),
      updatedAt: nowIso(),
    });
    return getTenantMemberRow(db, tenantId, userId);
  });
}

export function updateTenantMemberStatus(db, params) {
  const tenantId = String(params.tenantId || "").trim();
  const userId = String(params.userId || "").trim();
  const status = normalizeMemberStatus(params.status);
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }
  if (!userId) {
    throw new Error("user_id_required");
  }
  if (!status) {
    throw new Error("成员状态无效");
  }

  return runInTransaction(db, () => {
    const current = getTenantMemberRow(db, tenantId, userId);
    if (!current) {
      throw new Error("成员不存在");
    }
    if (
      String(current.status || "")
        .trim()
        .toLowerCase() === status
    ) {
      return current;
    }
    db.prepare(
      `UPDATE users
       SET status = @status,
           updated_at = @updatedAt
       WHERE id = @userId`,
    ).run({
      userId,
      status,
      updatedAt: nowIso(),
    });
    return getTenantMemberRow(db, tenantId, userId);
  });
}

export function deleteTenantMember(db, params) {
  const tenantId = String(params.tenantId || "").trim();
  const userId = String(params.userId || "").trim();
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }
  if (!userId) {
    throw new Error("user_id_required");
  }

  ensureSchemaCompatibility(db);
  return runInTransaction(db, () => {
    const current = getTenantMemberRow(db, tenantId, userId);
    if (!current) {
      throw new Error("成员不存在");
    }
    const cleanupResult = purgeTenantMemberUserData(db, {
      tenantId,
      userId,
      memberUsername: current.username,
      configDir: params.configDir,
      configPath: params.configPath,
    });

    return {
      id: current.id,
      username: current.username,
      revokedAssignmentCount: Number(cleanupResult?.deletedAssignmentCount || 0),
      preservedUsageCount: Number(cleanupResult?.preservedUsageCount || 0),
      removedWorkspaceCount: Number(cleanupResult?.removedWorkspaceCount || 0),
      removedWorkspacePathCount: Number(cleanupResult?.removedWorkspacePathCount || 0),
    };
  });
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

export function listTenantAgents(db, tenantId, configAgents = [], options = {}) {
  const configMap = new Map(configAgents.map((entry) => [entry.id, entry]));
  const includeInactive = Boolean(options?.includeInactive);
  return db
    .prepare(
      `SELECT id, agent_id AS agentId, description, rate_multiplier AS rateMultiplier,
              status, balance_points AS balancePoints, created_at AS createdAt, updated_at AS updatedAt
       FROM tenant_agents
       WHERE tenant_id = ? ${includeInactive ? "" : "AND status = 'active'"}
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
  const memberUsernameSql = buildUsageMemberUsernameSql("r", "u", "''");
  const memberIdSql = buildUsageMemberIdSql("r");

  const whereClauses = ["r.tenant_id = @tenantId"];
  const bindings = { tenantId };
  if (search) {
    whereClauses.push(
      `(
        LOWER(${memberUsernameSql}) LIKE @search OR
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
              ${memberIdSql} AS memberId,
              ${memberUsernameSql} AS memberUsername,
              r.tenant_agent_id AS tenantAgentId,
              ta.agent_id AS agentId,
              r.input_tokens AS inputTokens,
              r.input_tokens AS input_tokens,
              r.output_tokens AS outputTokens,
              r.output_tokens AS output_tokens,
              r.cache_read_tokens AS cacheReadTokens,
              r.cache_read_tokens AS cache_read_tokens,
              r.cache_write_tokens AS cacheWriteTokens,
              r.cache_write_tokens AS cache_write_tokens,
              r.total_tokens AS tokens,
              r.total_tokens AS totalTokens,
              r.total_tokens AS total_tokens,
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

function assignTenantAgentToUserCore(db, params) {
  const tenantAgent = db
    .prepare(
      `SELECT id, tenant_id AS tenantId, agent_id AS baseAgentId, status
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
  if (String(tenantAgent.status || "").trim() !== "active") {
    throw new Error("tenant_agent_inactive");
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
  syncDerivedAgentExecApprovals({
    baseAgentId: tenantAgent.baseAgentId,
    derivedAgentId,
    configPath: params.configPath,
    configDir: params.configDir,
  });
  syncDerivedAgentRuntimeFiles({
    baseAgentId: tenantAgent.baseAgentId,
    derivedAgentId,
    configPath: params.configPath,
    configDir: params.configDir,
  });
  syncTenantDerivedAgentContext(db, {
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
}

export function assignTenantAgentToUser(db, params) {
  return runInTransaction(db, () => assignTenantAgentToUserCore(db, params));
}

export function assignTenantAgentsToUser(db, params) {
  const tenantId = String(params.tenantId || "").trim();
  const userId = String(params.userId || "").trim();
  const tenantAgentIds = Array.isArray(params.tenantAgentIds)
    ? [...new Set(params.tenantAgentIds.map((tenantAgentId) => String(tenantAgentId || "").trim()).filter(Boolean))]
    : String(params.tenantAgentId || "").trim()
      ? [String(params.tenantAgentId || "").trim()]
      : [];
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }
  if (!userId) {
    throw new Error("user_id_required");
  }
  if (!tenantAgentIds.length) {
    throw new Error("tenant_agent_ids_required");
  }

  return runInTransaction(db, () => {
    const assignmentIds = [];
    const derivedAgentIds = [];
    for (const tenantAgentId of tenantAgentIds) {
      const result = assignTenantAgentToUserCore(db, {
        ...params,
        tenantId,
        userId,
        tenantAgentId,
      });
      if (result?.assignmentId) {
        assignmentIds.push(result.assignmentId);
      }
      if (result?.derivedAgentId) {
        derivedAgentIds.push(result.derivedAgentId);
      }
    }
    const affectedUserIds = userId ? [userId] : [];
    return {
      assignmentId: assignmentIds[0] || null,
      derivedAgentId: derivedAgentIds[0] || null,
      assignmentIds,
      derivedAgentIds,
      assignedAssignmentCount: assignmentIds.length,
      affectedUserIds,
      affectedMemberCount: affectedUserIds.length,
    };
  });
}

export function revokePlatformTenantAgents(db, params) {
  const tenantId = String(params.tenantId || "").trim();
  const tenantAgentIds = Array.isArray(params.tenantAgentIds)
    ? [
        ...new Set(
          params.tenantAgentIds
            .map((tenantAgentId) => String(tenantAgentId || "").trim())
            .filter(Boolean),
        ),
      ]
    : String(params.tenantAgentId || "").trim()
      ? [String(params.tenantAgentId || "").trim()]
      : [];
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }
  if (!tenantAgentIds.length) {
    throw new Error("tenant_agent_ids_required");
  }

  return runInTransaction(db, () => {
    const placeholders = tenantAgentIds.map(() => "?").join(", ");
    const selectedTenantAgents = db
      .prepare(
        `SELECT id
         FROM tenant_agents
         WHERE tenant_id = ? AND status = 'active' AND id IN (${placeholders})`,
      )
      .all(tenantId, ...tenantAgentIds);

    if (!selectedTenantAgents.length) {
      return {
        revokedTenantAgentCount: 0,
        revokedAssignmentCount: 0,
        tenantAgentIds: [],
        affectedUserIds: [],
        affectedMemberCount: 0,
      };
    }

    const revokedTenantAgentIds = selectedTenantAgents
      .map((tenantAgent) => String(tenantAgent.id || "").trim())
      .filter(Boolean);
    const resolvedPlaceholders = revokedTenantAgentIds.map(() => "?").join(", ");
    const revokedAssignments = db
      .prepare(
        `SELECT id, user_id AS userId
         FROM user_agent_assignments
         WHERE tenant_id = ? AND status = 'active' AND tenant_agent_id IN (${resolvedPlaceholders})`,
      )
      .all(tenantId, ...revokedTenantAgentIds);

    db.prepare(
      `UPDATE tenant_agents
       SET status = 'inactive',
           updated_at = ?
       WHERE tenant_id = ? AND status = 'active' AND id IN (${resolvedPlaceholders})`,
    ).run(nowIso(), tenantId, ...revokedTenantAgentIds);

    if (revokedAssignments.length) {
      db.prepare(
        `UPDATE user_agent_assignments
         SET status = 'inactive'
         WHERE tenant_id = ? AND status = 'active' AND tenant_agent_id IN (${resolvedPlaceholders})`,
      ).run(tenantId, ...revokedTenantAgentIds);
    }

    const affectedUserIds = [...new Set(revokedAssignments.map((assignment) => assignment.userId))];
    return {
      revokedTenantAgentCount: revokedTenantAgentIds.length,
      revokedAssignmentCount: revokedAssignments.length,
      tenantAgentIds: revokedTenantAgentIds,
      affectedUserIds,
      affectedMemberCount: affectedUserIds.length,
    };
  });
}

export function revokeTenantAgentAssignments(db, params) {
  const tenantId = String(params.tenantId || "").trim();
  const userId = String(params.userId || "").trim();
  const userIds = Array.isArray(params.userIds)
    ? [...new Set(params.userIds.map((userId) => String(userId || "").trim()).filter(Boolean))]
    : [];
  const assignmentIds = Array.isArray(params.assignmentIds)
    ? [
        ...new Set(
          params.assignmentIds
            .map((assignmentId) => String(assignmentId || "").trim())
            .filter(Boolean),
        ),
      ]
    : [];
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }
  if (!userIds.length && !assignmentIds.length) {
    throw new Error("user_ids_required");
  }

  return runInTransaction(db, () => {
    if (assignmentIds.length) {
      const placeholders = assignmentIds.map(() => "?").join(", ");
      const selectClauses = ["tenant_id = ?", "status = 'active'", `id IN (${placeholders})`];
      const bindings = [tenantId, ...assignmentIds];
      if (userId) {
        selectClauses.push("user_id = ?");
        bindings.push(userId);
      }
      const selectAssignments = db
        .prepare(
          `SELECT id, user_id AS userId
           FROM user_agent_assignments
           WHERE ${selectClauses.join(" AND ")}`,
        )
        .all(...bindings);

      if (!selectAssignments.length) {
        return {
          revokedAssignmentCount: 0,
          affectedUserIds: [],
          affectedMemberCount: 0,
        };
      }

      db.prepare(
        `UPDATE user_agent_assignments
         SET status = 'inactive'
         WHERE ${selectClauses.join(" AND ")}`,
      ).run(...bindings);

      const affectedUserIds = [
        ...new Set(selectAssignments.map((assignment) => assignment.userId)),
      ];
      return {
        revokedAssignmentCount: selectAssignments.length,
        affectedUserIds,
        affectedMemberCount: affectedUserIds.length,
      };
    }

    const placeholders = userIds.map(() => "?").join(", ");
    const selectAssignments = db
      .prepare(
        `SELECT id, user_id AS userId
         FROM user_agent_assignments
         WHERE tenant_id = ? AND status = 'active' AND user_id IN (${placeholders})`,
      )
      .all(tenantId, ...userIds);

    if (!selectAssignments.length) {
      return {
        revokedAssignmentCount: 0,
        affectedUserIds: [],
        affectedMemberCount: 0,
      };
    }

    db.prepare(
      `UPDATE user_agent_assignments
       SET status = 'inactive'
       WHERE tenant_id = ? AND status = 'active' AND user_id IN (${placeholders})`,
    ).run(tenantId, ...userIds);

    const affectedUserIds = [...new Set(selectAssignments.map((assignment) => assignment.userId))];
    return {
      revokedAssignmentCount: selectAssignments.length,
      affectedUserIds,
      affectedMemberCount: affectedUserIds.length,
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
      syncDerivedAgentExecApprovals({
        baseAgentId: row.baseAgentId,
        derivedAgentId: resolvedAgentId,
        configPath: params.configPath,
        configDir: params.configDir,
      });
      syncDerivedAgentRuntimeFiles({
        baseAgentId: row.baseAgentId,
        derivedAgentId: resolvedAgentId,
        configPath: params.configPath,
        configDir: params.configDir,
      });
      syncTenantDerivedAgentContext(db, {
        tenantId: row.tenantId,
        userId: row.userId,
        tenantAgentId: row.tenantAgentId,
        baseAgentId: row.baseAgentId,
        derivedAgentId: resolvedAgentId,
        configPath: params.configPath,
        configDir: params.configDir,
      });

      const baseAgentId = String(row.baseAgentId || "").trim();
      const agentId = resolvedAgentId || baseAgentId;
      const configEntry = configMap.get(baseAgentId) ?? configMap.get(resolvedAgentId) ?? null;
      const displayName = resolveAssignedAgentDisplayName(
        configEntry?.name,
        row.description,
        baseAgentId,
        agentId,
        resolvedAgentId,
      );
      return {
        ...row,
        agentId,
        baseAgentId,
        agentName: displayName || baseAgentId || agentId,
        displayName,
        emoji: configEntry?.emoji ?? null,
        avatar: configEntry?.avatar ?? null,
      };
    });
}

const WORKSPACE_VISUALIZATION_FILE_PATTERN = /_index(?:\.dashboard\.json|\.html)$/i;
const WORKSPACE_SANDBOX_FILE_PATTERN = /\.json$/i;

function listWorkspaceVisualizationFiles(workspaceDir) {
  const normalizedWorkspaceDir = String(workspaceDir || "").trim();
  if (!normalizedWorkspaceDir) {
    return [];
  }
  const echartsDir = path.join(normalizedWorkspaceDir, "Echarts");
  try {
    if (!fs.existsSync(echartsDir) || !fs.statSync(echartsDir).isDirectory()) {
      return [];
    }
    return fs
      .readdirSync(echartsDir, { withFileTypes: true })
      .filter(
        (entry) => entry.isFile() && WORKSPACE_VISUALIZATION_FILE_PATTERN.test(entry.name),
      )
      .map((entry) => entry.name)
      .toSorted((left, right) => left.localeCompare(right, "zh-Hans-CN"))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function stripVisualizationIndexSuffix(fileName) {
  return String(fileName || "")
    .trim()
    .replace(/_index(?:\.dashboard\.json|\.html)$/i, "");
}

function readVisualizationType(fileName) {
  return /\.dashboard\.json$/i.test(String(fileName || "").trim())
    ? "dashboard_manifest"
    : "html";
}

export function listAssignedAgentVisualizationsForUser(db, params, configAgents = []) {
  return listAssignedAgentsForUser(db, params, configAgents).flatMap((agent) =>
    listWorkspaceVisualizationFiles(agent.derivedWorkspaceDir).map((visualizationFileName) => ({
      ...agent,
      visualizationType: readVisualizationType(visualizationFileName),
      visualizationFileName,
      visualizationName: stripVisualizationIndexSuffix(visualizationFileName),
      visualizationRelativePath: path.posix.join("Echarts", visualizationFileName),
    })),
  );
}

function listWorkspaceSandboxFiles(workspaceDir) {
  const normalizedWorkspaceDir = String(workspaceDir || "").trim();
  if (!normalizedWorkspaceDir) {
    return [];
  }
  const sandboxDir = path.join(normalizedWorkspaceDir, "Sandbox");
  try {
    if (!fs.existsSync(sandboxDir) || !fs.statSync(sandboxDir).isDirectory()) {
      return [];
    }
    return fs
      .readdirSync(sandboxDir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() &&
          WORKSPACE_SANDBOX_FILE_PATTERN.test(entry.name) &&
          !String(entry.name || "")
            .trim()
            .toLowerCase()
            .startsWith("runs"),
      )
      .map((entry) => entry.name)
      .toSorted((left, right) => left.localeCompare(right, "zh-Hans-CN"))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function stripSandboxFileSuffix(fileName) {
  return String(fileName || "")
    .trim()
    .replace(/_sandbox\.json$/i, "")
    .replace(/\.json$/i, "");
}

function sanitizeSandboxRunId(runId) {
  const normalized = String(runId || "").trim();
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(normalized)) {
    throw new Error("sandbox_run_not_found");
  }
  return normalized;
}

export function resolveWorkspaceSandboxRunsDir(workspaceDir) {
  return path.join(String(workspaceDir || "").trim(), "Sandbox", "runs");
}

export function resolveWorkspaceSandboxRunDir(workspaceDir, runId) {
  return path.join(resolveWorkspaceSandboxRunsDir(workspaceDir), sanitizeSandboxRunId(runId));
}

export function readWorkspaceSandboxRunJson(workspaceDir, runId, fileName, fallback = null) {
  const normalizedWorkspaceDir = String(workspaceDir || "").trim();
  const normalizedFileName = String(fileName || "").trim();
  if (!normalizedWorkspaceDir || !normalizedFileName) {
    return fallback;
  }
  try {
    const runDir = resolveWorkspaceSandboxRunDir(normalizedWorkspaceDir, runId);
    const filePath = path.join(runDir, normalizedFileName);
    const relativePath = path.relative(runDir, filePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

function listTenantSandboxAgents(db, tenantId, configAgents = []) {
  const configMap = new Map(configAgents.map((entry) => [entry.id, entry]));
  return db
    .prepare(
      `SELECT id,
              tenant_id AS tenantId,
              agent_id AS baseAgentId,
              description,
              rate_multiplier AS rateMultiplier,
              status,
              balance_points AS balancePoints,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM tenant_agents
       WHERE tenant_id = ? AND status = 'active'
       ORDER BY updated_at DESC, created_at DESC`,
    )
    .all(tenantId)
    .map((row) => {
      const configEntry = configMap.get(String(row.baseAgentId || "").trim()) ?? null;
      const displayName = resolveAssignedAgentDisplayName(
        configEntry?.name,
        row.description,
        row.baseAgentId,
        row.id,
      );
      return {
        ...row,
        tenantAgentId: String(row.id || "").trim(),
        baseAgentId: String(row.baseAgentId || "").trim(),
        agentName: displayName || String(row.baseAgentId || row.id || "").trim(),
        displayName,
        emoji: configEntry?.emoji ?? null,
        avatar: configEntry?.avatar ?? null,
      };
    });
}

function listTenantSandboxWorkspaceCandidates(db, tenantAgent, params = {}) {
  const candidates = [];
  const seen = new Set();

  const pushCandidate = (workspaceDir, derivedAgentId = "") => {
    const normalizedWorkspaceDir = String(workspaceDir || "").trim();
    if (!normalizedWorkspaceDir || seen.has(normalizedWorkspaceDir)) {
      return;
    }
    seen.add(normalizedWorkspaceDir);
    candidates.push({
      workspaceDir: normalizedWorkspaceDir,
      derivedAgentId: String(derivedAgentId || "").trim(),
    });
  };

  const baseWorkspaceDir = resolveBaseWorkspaceDir({
    ...params,
    tenantId: tenantAgent.tenantId,
    baseAgentId: tenantAgent.baseAgentId,
  });
  pushCandidate(baseWorkspaceDir);

  const assignmentWorkspaces = db
    .prepare(
      `SELECT derived_agent_id AS derivedAgentId,
              derived_workspace_dir AS derivedWorkspaceDir
       FROM user_agent_assignments
       WHERE tenant_id = ? AND tenant_agent_id = ? AND status = 'active'
       ORDER BY created_at DESC`,
    )
    .all(tenantAgent.tenantId, tenantAgent.tenantAgentId);
  for (const row of assignmentWorkspaces) {
    pushCandidate(row?.derivedWorkspaceDir, row?.derivedAgentId);
  }

  return candidates;
}

export function listTenantVisibleSandboxesForUser(db, params, configAgents = []) {
  const tenantId = String(params?.tenantId || "").trim();
  const userId = String(params?.userId || "").trim();
  if (!tenantId || !userId) {
    return [];
  }

  const membership = db
    .prepare(
      `SELECT 1
       FROM tenant_memberships
       WHERE tenant_id = ? AND user_id = ? AND role = 'member' AND status = 'active'
       LIMIT 1`,
    )
    .get(tenantId, userId);
  if (!membership) {
    return [];
  }

  const items = [];
  const seen = new Set();
  for (const tenantAgent of listTenantSandboxAgents(db, tenantId, configAgents)) {
    for (const candidate of listTenantSandboxWorkspaceCandidates(db, tenantAgent, params)) {
      for (const sandboxFileName of listWorkspaceSandboxFiles(candidate.workspaceDir)) {
        const dedupeKey = `${tenantAgent.tenantAgentId}:${sandboxFileName}`;
        if (seen.has(dedupeKey)) {
          continue;
        }
        seen.add(dedupeKey);
        items.push({
          ...tenantAgent,
          id: dedupeKey,
          userId,
          derivedAgentId: candidate.derivedAgentId || "",
          derivedWorkspaceDir: candidate.workspaceDir,
          sandboxWorkspaceDir: candidate.workspaceDir,
          sandboxFileName,
          sandboxName: stripSandboxFileSuffix(sandboxFileName),
          sandboxRelativePath: path.posix.join("Sandbox", sandboxFileName),
        });
      }
    }
  }

  return items;
}

export function listAssignedAgentSandboxesForUser(db, params, configAgents = []) {
  return listAssignedAgentsForUser(db, params, configAgents).flatMap((agent) =>
    listWorkspaceSandboxFiles(agent.derivedWorkspaceDir).map((sandboxFileName) => ({
      ...agent,
      sandboxFileName,
      sandboxName: stripSandboxFileSuffix(sandboxFileName),
      sandboxRelativePath: path.posix.join("Sandbox", sandboxFileName),
    })),
  );
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
                t.deployment_mode AS deploymentMode,
                u.username AS memberUsername,
                ua.derived_agent_id AS derivedAgentId
         FROM tenant_agents ta
       JOIN tenants t ON t.id = ta.tenant_id
       JOIN tenant_memberships tm ON tm.tenant_id = ta.tenant_id
       JOIN users u ON u.id = tm.user_id
       JOIN user_agent_assignments ua
         ON ua.tenant_id = ta.tenant_id
        AND ua.tenant_agent_id = ta.id
        AND ua.user_id = tm.user_id
       WHERE ta.id = @tenantAgentId
         AND ta.tenant_id = @tenantId
         AND ta.status = 'active'
         AND tm.user_id = @userId
         AND tm.role = 'member'
         AND tm.status = 'active'
         AND ua.status = 'active'
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

  const now = nowIso();
  const normalizedRecords = applySessionEstimatedCostFallbackToUsageRecords(
    normalizeTenantUsageSyncRecords(records, now),
    {
      openclawSessionKey,
      derivedAgentId: String(tenantAgent.derivedAgentId || "").trim(),
      configDir: params.configDir,
      configPath: params.configPath,
    },
  );

  return runInTransaction(db, () => {
    const selectExisting = db.prepare(
      `SELECT id
       FROM tenant_usage_records
       WHERE openclaw_session_key = @openclawSessionKey
         AND source_fingerprint = @sourceFingerprint`,
    );
    const selectLegacyExisting = db.prepare(
      `SELECT id,
              source_fingerprint AS sourceFingerprint,
              input_tokens AS inputTokens,
              output_tokens AS outputTokens,
              cache_read_tokens AS cacheReadTokens,
              cache_write_tokens AS cacheWriteTokens,
              total_tokens AS totalTokens,
              total_cost AS totalCost
       FROM tenant_usage_records
       WHERE openclaw_session_key = @openclawSessionKey
         AND message_timestamp = @messageTimestamp
         AND user_id = @userId
         AND tenant_agent_id = @tenantAgentId
         AND COALESCE(provider, '') = COALESCE(@provider, '')
         AND COALESCE(model, '') = COALESCE(@model, '')
         AND input_tokens = 0
         AND output_tokens = 0
         AND total_tokens = @totalTokens
       ORDER BY created_at DESC
       LIMIT 1`,
    );
    const selectUsageLedger = db.prepare(
      `SELECT id, amount_points AS amountPoints, note
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
         member_user_id,
         member_username,
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
         @memberUserId,
         @memberUsername,
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
         user_id = excluded.user_id,
         member_user_id = excluded.member_user_id,
         member_username = excluded.member_username,
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
    const updateLegacyUsageRecord = db.prepare(
      `UPDATE tenant_usage_records
       SET user_id = @userId,
           member_user_id = @memberUserId,
           member_username = @memberUsername,
           source_fingerprint = @sourceFingerprint,
           tenant_agent_id = @tenantAgentId,
           message_timestamp = @messageTimestamp,
           usage_day = @usageDay,
           provider = @provider,
           model = @model,
           input_tokens = @inputTokens,
           output_tokens = @outputTokens,
           cache_read_tokens = @cacheReadTokens,
           cache_write_tokens = @cacheWriteTokens,
           total_tokens = @totalTokens,
           total_cost = @totalCost,
           updated_at = @updatedAt
       WHERE id = @id`,
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
    const billingEnabled =
      String(tenantAgent.deploymentMode || "")
        .trim()
        .toLowerCase() !== "local";
    const rateMultiplier = Math.max(0, toFiniteNumber(tenantAgent.rateMultiplier, 1));
    let currentAgentBalance = normalizeNonNegativePoints(tenantAgent.balancePoints);

    for (const record of normalizedRecords) {
      if (record.totalTokens <= 0 && !record.totalCost) {
        continue;
      }

      const {
        sourceFingerprint,
        messageTimestamp,
        usageDay,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        totalTokens,
        totalCost,
      } = record;
      const existing = selectExisting.get({
        openclawSessionKey,
        sourceFingerprint,
      });
      const legacyExisting = existing
        ? null
        : selectLegacyExisting.get({
            openclawSessionKey,
            messageTimestamp,
            userId,
            tenantAgentId,
            provider: record.provider,
            model: record.model,
            totalTokens,
          });
      if (existing) {
        upsert.run({
          id: existing.id,
          tenantId,
          userId,
          memberUserId: userId,
          memberUsername: String(tenantAgent.memberUsername || "").trim(),
          tenantAgentId,
          openclawSessionKey,
          sourceFingerprint,
          messageTimestamp,
          usageDay,
          provider: record.provider,
          model: record.model,
          inputTokens,
          outputTokens,
          cacheReadTokens,
          cacheWriteTokens,
          totalTokens,
          totalCost,
          createdAt: now,
          updatedAt: now,
        });
      } else if (legacyExisting?.id) {
        updateLegacyUsageRecord.run({
          id: legacyExisting.id,
          userId,
          memberUserId: userId,
          memberUsername: String(tenantAgent.memberUsername || "").trim(),
          tenantAgentId,
          sourceFingerprint,
          messageTimestamp,
          usageDay,
          provider: record.provider,
          model: record.model,
          inputTokens,
          outputTokens,
          cacheReadTokens,
          cacheWriteTokens,
          totalTokens,
          totalCost,
          updatedAt: now,
        });
      } else {
        upsert.run({
          id: createId("usage"),
          tenantId,
          userId,
          memberUserId: userId,
          memberUsername: String(tenantAgent.memberUsername || "").trim(),
          tenantAgentId,
          openclawSessionKey,
          sourceFingerprint,
          messageTimestamp,
          usageDay,
          provider: record.provider,
          model: record.model,
          inputTokens,
          outputTokens,
          cacheReadTokens,
          cacheWriteTokens,
          totalTokens,
          totalCost,
          createdAt: now,
          updatedAt: now,
        });
      }

      const usageLedgerNote = buildUsageLedgerNote(openclawSessionKey, sourceFingerprint);
      const legacyUsageLedgerNote = legacyExisting?.sourceFingerprint
        ? buildUsageLedgerNote(openclawSessionKey, legacyExisting.sourceFingerprint)
        : usageLedgerNote;
      const existingLedger =
        selectUsageLedger.get({
          tenantId,
          note: usageLedgerNote,
        }) ??
        (legacyUsageLedgerNote === usageLedgerNote
          ? null
          : selectUsageLedger.get({
              tenantId,
              note: legacyUsageLedgerNote,
            }));
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

      if (existing?.id || legacyExisting?.id) {
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

export function repairTenantUsageCostGaps(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }

  const candidateGroups = db
    .prepare(
      `SELECT DISTINCT r.user_id AS userId,
              r.tenant_agent_id AS tenantAgentId,
              r.openclaw_session_key AS openclawSessionKey
       FROM tenant_usage_records r
       JOIN tenants t ON t.id = r.tenant_id
       WHERE r.tenant_id = @tenantId
         AND t.deployment_mode != 'local'
         AND COALESCE(r.total_cost, 0) <= 0
         AND COALESCE(r.user_id, '') != ''
         AND COALESCE(r.tenant_agent_id, '') != ''
         AND COALESCE(r.openclaw_session_key, '') != ''`,
    )
    .all({ tenantId });

  const sessionStoreCache = new Map();
  let repairedSessions = 0;
  let repairedRows = 0;
  let skippedSessions = 0;

  for (const group of candidateGroups) {
    const assignment = db
      .prepare(
        `SELECT derived_agent_id AS derivedAgentId
         FROM user_agent_assignments
         WHERE tenant_id = @tenantId
           AND user_id = @userId
           AND tenant_agent_id = @tenantAgentId
         ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at DESC
         LIMIT 1`,
      )
      .get({
        tenantId,
        userId: group.userId,
        tenantAgentId: group.tenantAgentId,
      });
    const records = db
      .prepare(
        `SELECT source_fingerprint AS sourceFingerprint,
                message_timestamp AS messageTimestamp,
                usage_day AS usageDay,
                provider,
                model,
                input_tokens AS inputTokens,
                output_tokens AS outputTokens,
                cache_read_tokens AS cacheReadTokens,
                cache_write_tokens AS cacheWriteTokens,
                total_tokens AS totalTokens,
                total_cost AS totalCost
         FROM tenant_usage_records
         WHERE tenant_id = @tenantId
           AND user_id = @userId
           AND tenant_agent_id = @tenantAgentId
           AND openclaw_session_key = @openclawSessionKey
         ORDER BY message_timestamp ASC, created_at ASC`,
      )
      .all({
        tenantId,
        userId: group.userId,
        tenantAgentId: group.tenantAgentId,
        openclawSessionKey: group.openclawSessionKey,
      });
    if (!records.length) {
      skippedSessions += 1;
      continue;
    }

    const previewRecords = applySessionEstimatedCostFallbackToUsageRecords(
      normalizeTenantUsageSyncRecords(records),
      {
        openclawSessionKey: group.openclawSessionKey,
        derivedAgentId: String(assignment?.derivedAgentId || "").trim(),
        configDir: params.configDir,
        configPath: params.configPath,
      },
      sessionStoreCache,
    );
    const nextFilledRows = previewRecords.filter(
      (record, index) => !normalizeOptionalPositiveCost(records[index]?.totalCost) && record.totalCost,
    ).length;
    if (nextFilledRows <= 0) {
      skippedSessions += 1;
      continue;
    }

    try {
      syncTenantUsageRecords(db, {
        tenantId,
        userId: group.userId,
        tenantAgentId: group.tenantAgentId,
        openclawSessionKey: group.openclawSessionKey,
        records: previewRecords,
        configDir: params.configDir,
        configPath: params.configPath,
      });
      repairedSessions += 1;
      repairedRows += nextFilledRows;
    } catch {
      skippedSessions += 1;
    }
  }

  return {
    scannedSessions: candidateGroups.length,
    repairedSessions,
    repairedRows,
    skippedSessions,
  };
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
  const usageMemberIdSql = buildUsageMemberIdSql("r");
  const usageMemberUsernameSql = buildUsageMemberUsernameSql("r", "u", "'已删除成员'");

  const totalsRow =
    db
      .prepare(
        `SELECT COUNT(*) AS responseCount,
              COUNT(DISTINCT COALESCE(NULLIF(member_user_id, ''), user_id)) AS memberCount,
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
      `SELECT ${usageMemberIdSql} AS userId,
              ${usageMemberUsernameSql} AS username,
              COUNT(*) AS responseCount,
              COALESCE(SUM(r.input_tokens), 0) AS inputTokens,
              COALESCE(SUM(r.output_tokens), 0) AS outputTokens,
              COALESCE(SUM(r.cache_read_tokens), 0) AS cacheReadTokens,
              COALESCE(SUM(r.cache_write_tokens), 0) AS cacheWriteTokens,
              COALESCE(SUM(r.total_tokens), 0) AS totalTokens,
              COALESCE(SUM(r.total_cost), 0) AS totalCost,
              MAX(r.message_timestamp) AS lastUsedAt
       FROM tenant_usage_records r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.tenant_id = @tenantId
         AND r.usage_day >= @startDate
         AND r.usage_day <= @endDate
       GROUP BY ${usageMemberIdSql}, ${usageMemberUsernameSql}
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

function getTenantConsumedCredits(db, tenantId) {
  const row = db
    .prepare(
      `SELECT SUM(
         CASE
           WHEN l.amount_points IS NOT NULL THEN l.amount_points
           WHEN t.deployment_mode = 'local' THEN 0
           ELSE COALESCE(r.total_cost, 0) * COALESCE(ta.rate_multiplier, 1)
         END
       ) AS consumedCredits
       FROM tenant_usage_records r
       JOIN tenants t ON t.id = r.tenant_id
       JOIN tenant_agents ta ON ta.id = r.tenant_agent_id
       LEFT JOIN tenant_wallet_ledger l
         ON l.tenant_id = r.tenant_id
        AND l.category = 'usage_charge'
        AND l.note = 'usage:' || r.openclaw_session_key || ':' || r.source_fingerprint
       WHERE r.tenant_id = ?`,
    )
    .get(tenantId);
  return Number(row?.consumedCredits || 0);
}

export function getTenantOverview(db, params, configAgents = []) {
  const tenantId = String(params.tenantId || "").trim();
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }
  const usageMemberIdSql = buildUsageMemberIdSql("r");
  const usageMemberUsernameSql = buildUsageMemberUsernameSql("r", "u", "'已删除成员'");

  const now = new Date();
  const days = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const summary = db
    .prepare(
      `SELECT
        SUM(total_tokens) as totalTokens,
        SUM(input_tokens) as inputTokens,
        SUM(output_tokens) as outputTokens,
        SUM(cache_read_tokens) as cacheReadTokens,
        SUM(cache_write_tokens) as cacheWriteTokens,
        COUNT(DISTINCT COALESCE(NULLIF(member_user_id, ''), user_id)) as activeUsers,
        COUNT(DISTINCT tenant_agent_id) as activeAgents
      FROM tenant_usage_records
      WHERE tenant_id = ?`,
    )
    .get(tenantId);

  const wallet = db
    .prepare(
      `SELECT balance_points as balance
      FROM tenant_wallets
      WHERE tenant_id = ?`,
    )
    .get(tenantId);
  const consumedCredits = getTenantConsumedCredits(db, tenantId);

  const dailyUsage = db
    .prepare(
      `SELECT usage_day as day, SUM(total_tokens) as tokens
      FROM tenant_usage_records
      WHERE tenant_id = ? AND usage_day >= ?
      GROUP BY usage_day`,
    )
    .all(tenantId, days[0]);

  const memberCount = Number(
    getScalar(
      db,
      "SELECT COUNT(*) FROM tenant_memberships WHERE tenant_id = ? AND role = 'member' AND status = 'active'",
      [tenantId],
    ) || 0,
  );

  const topMembers = db
    .prepare(
      `SELECT ${usageMemberUsernameSql} AS username, SUM(r.total_tokens) as tokens
       FROM tenant_usage_records r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.tenant_id = ?
       GROUP BY ${usageMemberIdSql}, ${usageMemberUsernameSql}
       ORDER BY tokens DESC
       LIMIT 10`,
    )
    .all(tenantId);

  const topAgents = db
    .prepare(
      `SELECT ta.agent_id as agentId, ta.description, SUM(r.total_tokens) as tokens
      FROM tenant_usage_records r
      JOIN tenant_agents ta ON ta.id = r.tenant_agent_id
      WHERE r.tenant_id = ?
      GROUP BY r.tenant_agent_id
      ORDER BY tokens DESC
      LIMIT 10`,
    )
    .all(tenantId);

  const configMap = new Map((configAgents || []).map((a) => [a.id, a]));

  return {
    summary: {
      totalTokens: Number(summary?.totalTokens || 0),
      inputTokens: Number(summary?.inputTokens || 0),
      outputTokens: Number(summary?.outputTokens || 0),
      cacheReadTokens: Number(summary?.cacheReadTokens || 0),
      cacheWriteTokens: Number(summary?.cacheWriteTokens || 0),
      activeUsers: Number(summary?.activeUsers || 0),
      activeAgents: Number(summary?.activeAgents || 0),
      memberCount,
      walletBalance: Number(wallet?.balance || 0),
      consumedCredits,
    },
    trend: days.map((day) => ({
      day,
      tokens: Number(dailyUsage.find((d) => d.day === day)?.tokens || 0),
    })),
    topMembers: topMembers.map((m) => ({
      username: m.username,
      tokens: Number(m.tokens || 0),
    })),
    topAgents: topAgents.map((a) => {
      const configEntry = configMap.get(a.agentId) ?? null;
      const displayName = configEntry?.name || a.description || a.agentId || "未知 Agent";
      return {
        name: displayName,
        displayName,
        agentName: displayName,
        label: displayName,
        agentId: a.agentId,
        description: a.description ?? null,
        tokens: Number(a.tokens || 0),
      };
    }),
  };
}
