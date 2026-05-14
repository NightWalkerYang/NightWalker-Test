import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import JSON5 from "json5";
import { hashPassword } from "./auth.mjs";
import { ensureTenantPlatformDirs } from "./config.mjs";

const MIGRATION_PATH = new URL("./migrations/001_init.sql", import.meta.url);
const BILLING_RATES_PATH = new URL("./billing-rates.json5", import.meta.url);
const LOCAL_BOOTSTRAP_TENANT_CODE = "local";
const LOCAL_BOOTSTRAP_TENANT_NAME = "本地租户";
const LOCAL_BOOTSTRAP_MEMBER_LIMIT = 999;
const DERIVED_AGENT_SEED_ONCE_ENTRIES = [
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
];
const DERIVED_AGENT_SYNC_ALWAYS_ENTRIES = ["hooks"];
const DERIVED_AGENT_METADATA_FILE = ".tenant-derived-agent.json";
const SKILL_CATALOG_COMPATIBLE_ANY = "*";
const SKILL_TEMPLATE_STATE_ENABLED = "enabled";
const SKILL_TEMPLATE_STATE_DISABLED = "disabled";
const SKILL_TEMPLATE_STATE_BLOCKED = "blocked_missing_entitlement";
const SKILL_ENTITLEMENT_ACTIVE = "active";
const SKILL_ENTITLEMENT_PENDING = "pending";
const SKILL_ENTITLEMENT_DISABLED = "disabled";
const SKILL_ENTITLEMENT_REVOKED = "revoked";
const SKILL_ORDER_PENDING_CONFIRMATION = "pending_confirmation";
const SKILL_ORDER_CONFIRMED = "confirmed";
const SKILL_CLASS_BUNDLED = "bundled";
const SKILL_CLASS_FREE = "free";
const SKILL_CLASS_PAID = "paid";
const ASSIGNMENT_STATUS_ACTIVE = "active";
const ASSIGNMENT_STATUS_INACTIVE = "inactive";
const ASSIGNMENT_STATUS_BLOCKED_MISSING_SKILLS = "blocked_missing_skills";
const DEFAULT_BILLING_CURRENCY = "CNY";
const DEFAULT_CONFIG_PRICING_CURRENCY = "USD";
const DEFAULT_ZERO_INTRUSIVE_BILLING_RATES = {
  settlementCurrency: DEFAULT_BILLING_CURRENCY,
  exchangeRates: {
    CNY: 1,
    USD: 7,
  },
  providers: {
    cleannetworkspace: {
      models: {
        "gpt-5.4": {
          currency: "USD",
          input: 2.5,
          output: 15,
          cacheRead: 0.25,
          cacheWrite: 0,
        },
      },
    },
    ollama: {
      fallback: {
        currency: DEFAULT_BILLING_CURRENCY,
        input: 0.3,
        output: 1.2,
        cacheRead: 0,
        cacheWrite: 0,
      },
    },
  },
};
const DEFAULT_TENANT_SYNC_INTERVAL_MINUTES = 5;
const DEFAULT_TENANT_SYNC_DEFAULT_START = "2023-01-01";
const DEFAULT_KINGDEE_BRIDGE_HOST =
  String(process.env.OPENCLAW_KINGDEE_BRIDGE_HOST || "").trim() || "10.20.30.31";
const DEFAULT_KINGDEE_BRIDGE_USER =
  String(process.env.OPENCLAW_KINGDEE_BRIDGE_USER || "").trim() || "root-ai";
const DEFAULT_KINGDEE_SSH_KEY_PATH =
  String(process.env.OPENCLAW_KINGDEE_SSH_KEY_PATH || "").trim() ||
  "/home/node/.openclaw/ssh/kingdee-db-query-ed25519";
const DEFAULT_KINGDEE_BRIDGE_TIMEOUT_SECONDS = Math.max(
  30,
  Number.parseInt(String(process.env.OPENCLAW_KINGDEE_BRIDGE_TIMEOUT_SECONDS || "120"), 10) || 120,
);
const DEFAULT_KINGDEE_ANALYTICS_PROJECT_ROOT =
  String(process.env.OPENCLAW_KINGDEE_ANALYTICS_PROJECT_ROOT || "").trim() ||
  "/home/root-ai/apps/kingdee-analytics";
const DEFAULT_KINGDEE_ANALYTICS_PYTHON =
  String(process.env.OPENCLAW_KINGDEE_ANALYTICS_PYTHON || "").trim() ||
  "/home/root-ai/apps/kingdee-analytics/.venv/bin/python";
const DEFAULT_KINGDEE_OPENAPI_CATALOG_ROOT =
  String(process.env.OPENCLAW_KINGDEE_OPENAPI_CATALOG_ROOT || "").trim() ||
  "/home/root-ai/apps/kingdee-openapi/references/apis/供应链/销售管理";
const DEFAULT_TENANT_PLATFORM_DB_PATH =
  String(process.env.OPENCLAW_TENANT_PLATFORM_DB_PATH || "").trim() ||
  "/home/root-ai/.openclaw/tenant-platform/tenant-platform.sqlite";
let cachedBillingRatesConfig = null;

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function parseJsonObject(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stringifyJsonObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function stringifyJsonArray(value) {
  try {
    return JSON.stringify(Array.isArray(value) ? value : []);
  } catch {
    return "[]";
  }
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function readUtf8FileIfExists(filePath, fallback = "") {
  try {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : fallback;
  } catch {
    return fallback;
  }
}

function roundPoints(value) {
  const numeric = toFiniteNumber(value, 0);
  return Math.round(numeric * 1_000_000) / 1_000_000;
}

function normalizeNonNegativePoints(value) {
  return Math.max(0, roundPoints(value));
}

function normalizeCurrencyCode(value, fallback = DEFAULT_BILLING_CURRENCY) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  return normalized || fallback;
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
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return "";
  }
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
}

function readBillingRatesConfig() {
  if (cachedBillingRatesConfig) {
    return cachedBillingRatesConfig;
  }
  try {
    const raw = fs.readFileSync(BILLING_RATES_PATH, "utf8");
    const parsed = JSON5.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      cachedBillingRatesConfig = parsed;
      return cachedBillingRatesConfig;
    }
  } catch {}
  cachedBillingRatesConfig = DEFAULT_ZERO_INTRUSIVE_BILLING_RATES;
  return cachedBillingRatesConfig;
}

function resolveSettlementCurrency() {
  return normalizeCurrencyCode(
    readBillingRatesConfig()?.settlementCurrency,
    DEFAULT_BILLING_CURRENCY,
  );
}

function resolveCurrencyToSettlementRate(currency) {
  const settlementCurrency = resolveSettlementCurrency();
  const normalizedCurrency = normalizeCurrencyCode(currency, settlementCurrency);
  if (normalizedCurrency === settlementCurrency) {
    return 1;
  }
  const exchangeRates = readBillingRatesConfig()?.exchangeRates;
  if (!exchangeRates || typeof exchangeRates !== "object" || Array.isArray(exchangeRates)) {
    return null;
  }
  for (const [rawCurrency, rawRate] of Object.entries(exchangeRates)) {
    if (normalizeCurrencyCode(rawCurrency) !== normalizedCurrency) {
      continue;
    }
    const rate = roundPoints(toFiniteNumber(rawRate, 0));
    return rate > 0 ? rate : null;
  }
  return null;
}

function convertAmountToSettlementCurrency(amount, currency) {
  const normalizedAmount = normalizeOptionalPositiveCost(amount);
  if (!normalizedAmount) {
    return null;
  }
  const rate = resolveCurrencyToSettlementRate(currency);
  if (!rate) {
    return null;
  }
  return normalizeNonNegativePoints(normalizedAmount * rate);
}

function normalizeTokenPricingEntry(entry, fallbackCurrency = resolveSettlementCurrency()) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  const normalized = {
    currency: normalizeCurrencyCode(entry.currency, fallbackCurrency),
    input: normalizeOptionalPositiveCost(entry.input) ?? 0,
    output: normalizeOptionalPositiveCost(entry.output) ?? 0,
    cacheRead: normalizeOptionalPositiveCost(entry.cacheRead) ?? 0,
    cacheWrite: normalizeOptionalPositiveCost(entry.cacheWrite) ?? 0,
  };
  if (
    normalized.input <= 0 &&
    normalized.output <= 0 &&
    normalized.cacheRead <= 0 &&
    normalized.cacheWrite <= 0
  ) {
    return null;
  }
  return normalized;
}

function resolveBillingProviderEntry(providerId) {
  const normalizedProviderId = String(providerId || "")
    .trim()
    .toLowerCase();
  if (!normalizedProviderId) {
    return null;
  }
  const providers = readBillingRatesConfig()?.providers;
  if (!providers || typeof providers !== "object" || Array.isArray(providers)) {
    return null;
  }
  for (const [rawProviderId, entry] of Object.entries(providers)) {
    if (
      String(rawProviderId || "")
        .trim()
        .toLowerCase() === normalizedProviderId
    ) {
      return entry && typeof entry === "object" && !Array.isArray(entry) ? entry : null;
    }
  }
  return null;
}

function collectSessionStoreAgentCandidates(params = {}) {
  const seen = new Set();
  const result = [];
  for (const value of [
    params.agentId,
    params.derivedAgentId,
    extractAgentIdFromSessionKey(params.openclawSessionKey),
  ]) {
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

function normalizeManagedNodeId(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!normalized) {
    throw new Error("managed_node_id_required");
  }
  return normalized;
}

function normalizeManagedNodeName(value) {
  const normalized = String(value || "")
    .trim()
    .slice(0, 120);
  if (!normalized) {
    throw new Error("managed_node_name_required");
  }
  return normalized;
}

function normalizeManagedNodeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase() === "disabled"
    ? "disabled"
    : "active";
}

function normalizeManagedNodeLeaseStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase() === "disabled"
    ? "disabled"
    : "active";
}

function summarizeManagedNodeLeaseRow(row) {
  if (!row) {
    return {
      status: "missing",
      expiresAt: null,
      readonly: true,
      remainingDays: null,
      reason: "node_lease_missing",
    };
  }
  const configuredStatus = normalizeManagedNodeLeaseStatus(row.leaseStatus || row.status);
  const expiresAt = String(row.expiresAt || "").trim() || null;
  const readonlyAfterExpiry = Number(row.readonlyAfterExpiry || 0) !== 0;
  if (configuredStatus === "disabled") {
    return {
      status: "disabled",
      expiresAt,
      readonly: true,
      remainingDays: null,
      reason: "node_lease_disabled",
    };
  }
  if (expiresAt) {
    const expiresAtMs = Date.parse(expiresAt);
    if (Number.isFinite(expiresAtMs)) {
      const remainingDays = Math.ceil((expiresAtMs - Date.now()) / 86_400_000);
      if (expiresAtMs < Date.now()) {
        return {
          status: "expired",
          expiresAt,
          readonly: readonlyAfterExpiry,
          remainingDays,
          reason: "node_lease_expired",
        };
      }
      return {
        status: "active",
        expiresAt,
        readonly: false,
        remainingDays,
        reason: "node_lease_active",
      };
    }
  }
  return {
    status: "active",
    expiresAt,
    readonly: false,
    remainingDays: null,
    reason: "node_lease_active",
  };
}

function buildManagedNodeAssignmentKey(params = {}) {
  const userId = String(params.userId || "").trim();
  const tenantAgentId = String(params.tenantAgentId || "").trim();
  return `${userId}::${tenantAgentId}`;
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
       name TEXT NOT NULL UNIQUE,
       status TEXT NOT NULL DEFAULT 'active',
       connection_json TEXT,
       k3cloud_profile_json TEXT,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL
     );`,
  );
  db.exec(
    `CREATE TABLE IF NOT EXISTS tenant_data_source_bindings (
       tenant_id TEXT PRIMARY KEY,
       data_source_id TEXT NOT NULL,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
       FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE CASCADE
     );`,
  );
  db.exec(
    `CREATE TABLE IF NOT EXISTS tenant_sync_schedules (
       id TEXT PRIMARY KEY,
       tenant_id TEXT NOT NULL,
       data_source_id TEXT NOT NULL,
       object_code TEXT NOT NULL,
       module_name TEXT NOT NULL DEFAULT '',
       derived_workspace_dir TEXT NOT NULL,
       status TEXT NOT NULL DEFAULT 'active',
       interval_minutes INTEGER NOT NULL DEFAULT 5,
       default_start TEXT NOT NULL DEFAULT '2023-01-01',
       activated_by_user_id TEXT,
       last_run_at TEXT,
       last_run_status TEXT,
       last_run_error TEXT,
       last_run_duration_ms INTEGER,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       UNIQUE(tenant_id, data_source_id, object_code),
       FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
       FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE CASCADE,
       FOREIGN KEY (activated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
     );`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_data_sources_status
       ON data_sources (status, updated_at DESC);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_tenant_sync_schedules_status
       ON tenant_sync_schedules (status, updated_at DESC);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_tenant_sync_schedules_tenant_status
       ON tenant_sync_schedules (tenant_id, status, updated_at DESC);`,
  );

  const dataSourceColumns = db.prepare("PRAGMA table_info(data_sources)").all();
  const knownDataSourceColumns = new Set(
    dataSourceColumns.map((row) => String(row?.name || "").trim()),
  );
  if (!knownDataSourceColumns.has("k3cloud_profile_json")) {
    db.exec("ALTER TABLE data_sources ADD COLUMN k3cloud_profile_json TEXT;");
  }
  if (!knownDataSourceColumns.has("status")) {
    db.exec("ALTER TABLE data_sources ADD COLUMN status TEXT NOT NULL DEFAULT 'active';");
  }
  if (!knownDataSourceColumns.has("source_type")) {
    db.exec(
      "ALTER TABLE data_sources ADD COLUMN source_type TEXT NOT NULL DEFAULT 'kingdee_analytics';",
    );
  }
  if (!knownDataSourceColumns.has("source_dbid")) {
    db.exec("ALTER TABLE data_sources ADD COLUMN source_dbid TEXT;");
  }
  if (!knownDataSourceColumns.has("source_tenant_code")) {
    db.exec("ALTER TABLE data_sources ADD COLUMN source_tenant_code TEXT;");
  }

  const syncScheduleColumns = db.prepare("PRAGMA table_info(tenant_sync_schedules)").all();
  const knownSyncScheduleColumns = new Set(
    syncScheduleColumns.map((row) => String(row?.name || "").trim()),
  );
  if (!knownSyncScheduleColumns.has("default_start")) {
    db.exec(
      `ALTER TABLE tenant_sync_schedules
       ADD COLUMN default_start TEXT NOT NULL DEFAULT '${DEFAULT_TENANT_SYNC_DEFAULT_START}';`,
    );
  }
  if (!knownSyncScheduleColumns.has("last_run_duration_ms")) {
    db.exec("ALTER TABLE tenant_sync_schedules ADD COLUMN last_run_duration_ms INTEGER;");
  }
}

function ensureSkillMarketplaceSchemaCompatibility(db) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS platform_skills (
       id TEXT PRIMARY KEY,
       skill_key TEXT NOT NULL UNIQUE,
       name TEXT NOT NULL,
       description TEXT NOT NULL DEFAULT '',
       classification TEXT NOT NULL DEFAULT 'bundled',
       source_type TEXT NOT NULL DEFAULT 'workspace',
       source_root TEXT NOT NULL DEFAULT '',
       source_workspace_dir TEXT,
       status TEXT NOT NULL DEFAULT 'active',
       price_points REAL NOT NULL DEFAULT 0,
       compatible_base_agents_json TEXT NOT NULL DEFAULT '[]',
       latest_version_id TEXT,
       latest_version_label TEXT,
       latest_version_hash TEXT,
       latest_synced_at TEXT,
       latest_published_at TEXT,
       affected_tenant_count INTEGER NOT NULL DEFAULT 0,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL
     );`,
  );
  db.exec(
    `CREATE TABLE IF NOT EXISTS platform_skill_versions (
       id TEXT PRIMARY KEY,
       skill_id TEXT NOT NULL,
       version_label TEXT NOT NULL,
       version_hash TEXT NOT NULL,
       skill_md_path TEXT NOT NULL,
       skill_md_content TEXT NOT NULL,
       skill_metadata_json TEXT NOT NULL DEFAULT '{}',
       status TEXT NOT NULL DEFAULT 'active',
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       UNIQUE(skill_id, version_hash),
       FOREIGN KEY (skill_id) REFERENCES platform_skills(id) ON DELETE CASCADE
     );`,
  );
  db.exec(
    `CREATE TABLE IF NOT EXISTS platform_skill_agent_bindings (
       id TEXT PRIMARY KEY,
       skill_id TEXT NOT NULL,
       base_agent_id TEXT NOT NULL,
       status TEXT NOT NULL DEFAULT 'active',
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       UNIQUE(skill_id, base_agent_id),
       FOREIGN KEY (skill_id) REFERENCES platform_skills(id) ON DELETE CASCADE
     );`,
  );
  db.exec(
    `CREATE TABLE IF NOT EXISTS tenant_skill_orders (
       id TEXT PRIMARY KEY,
       tenant_id TEXT NOT NULL,
       skill_id TEXT NOT NULL,
       order_status TEXT NOT NULL DEFAULT 'pending_confirmation',
       acquire_type TEXT NOT NULL DEFAULT 'paid_order',
       amount_points REAL NOT NULL DEFAULT 0,
       version_policy TEXT NOT NULL DEFAULT 'latest',
       current_version_id TEXT,
       created_by_user_id TEXT,
       confirmed_by_user_id TEXT,
       confirmed_at TEXT,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
       FOREIGN KEY (skill_id) REFERENCES platform_skills(id) ON DELETE CASCADE,
       FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
       FOREIGN KEY (confirmed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
     );`,
  );
  db.exec(
    `CREATE TABLE IF NOT EXISTS tenant_skill_entitlements (
       id TEXT PRIMARY KEY,
       tenant_id TEXT NOT NULL,
       skill_id TEXT NOT NULL,
       status TEXT NOT NULL DEFAULT 'pending',
       acquire_type TEXT NOT NULL DEFAULT 'bundled',
       version_policy TEXT NOT NULL DEFAULT 'latest',
       current_version_id TEXT,
       enabled_by_tenant INTEGER NOT NULL DEFAULT 0,
       blocked_reason TEXT,
       order_id TEXT,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       UNIQUE(tenant_id, skill_id),
       FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
       FOREIGN KEY (skill_id) REFERENCES platform_skills(id) ON DELETE CASCADE,
       FOREIGN KEY (order_id) REFERENCES tenant_skill_orders(id) ON DELETE SET NULL
     );`,
  );
  db.exec(
    `CREATE TABLE IF NOT EXISTS tenant_agent_skill_templates (
       id TEXT PRIMARY KEY,
       tenant_agent_id TEXT NOT NULL,
       skill_id TEXT NOT NULL,
       template_state TEXT NOT NULL DEFAULT 'enabled',
       source_type TEXT NOT NULL DEFAULT 'base_default',
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       UNIQUE(tenant_agent_id, skill_id),
       FOREIGN KEY (tenant_agent_id) REFERENCES tenant_agents(id) ON DELETE CASCADE,
       FOREIGN KEY (skill_id) REFERENCES platform_skills(id) ON DELETE CASCADE
     );`,
  );
  db.exec(
    `CREATE TABLE IF NOT EXISTS user_agent_skill_overrides (
       id TEXT PRIMARY KEY,
       assignment_id TEXT NOT NULL,
       tenant_agent_id TEXT NOT NULL,
       user_id TEXT NOT NULL,
       skill_id TEXT NOT NULL,
       action TEXT NOT NULL,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       UNIQUE(assignment_id, skill_id, action),
       FOREIGN KEY (assignment_id) REFERENCES user_agent_assignments(id) ON DELETE CASCADE,
       FOREIGN KEY (tenant_agent_id) REFERENCES tenant_agents(id) ON DELETE CASCADE,
       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
       FOREIGN KEY (skill_id) REFERENCES platform_skills(id) ON DELETE CASCADE
     );`,
  );
  db.exec(
    `CREATE TABLE IF NOT EXISTS tenant_agent_skill_snapshots (
       id TEXT PRIMARY KEY,
       assignment_id TEXT NOT NULL,
       tenant_id TEXT NOT NULL,
       tenant_agent_id TEXT NOT NULL,
       user_id TEXT NOT NULL,
       derived_agent_id TEXT NOT NULL,
       resolved_skill_keys_json TEXT NOT NULL,
       resolved_version_ids_json TEXT NOT NULL,
       blocked_reasons_json TEXT NOT NULL,
       applied_at TEXT NOT NULL,
       FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
       FOREIGN KEY (tenant_agent_id) REFERENCES tenant_agents(id) ON DELETE CASCADE,
       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
       FOREIGN KEY (assignment_id) REFERENCES user_agent_assignments(id) ON DELETE CASCADE
     );`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_platform_skills_classification_status
       ON platform_skills (classification, status, updated_at DESC);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_platform_skill_versions_skill
       ON platform_skill_versions (skill_id, created_at DESC);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_tenant_skill_entitlements_tenant_status
       ON tenant_skill_entitlements (tenant_id, status, updated_at DESC);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_tenant_agent_skill_templates_agent
       ON tenant_agent_skill_templates (tenant_agent_id, updated_at DESC);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_user_agent_skill_overrides_assignment
       ON user_agent_skill_overrides (assignment_id, updated_at DESC);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_tenant_agent_skill_snapshots_assignment
       ON tenant_agent_skill_snapshots (assignment_id, applied_at DESC);`,
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
  const userIdForeignKey = foreignKeys.find((row) => String(row?.from || "").trim() === "user_id");
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
  ensureDataSourceSchemaCompatibility(db);
  ensureSkillMarketplaceSchemaCompatibility(db);
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

function computeStableTextHash(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""), "utf8")
    .digest("hex");
}

function normalizeSkillClassification(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (
    normalized === SKILL_CLASS_BUNDLED ||
    normalized === SKILL_CLASS_FREE ||
    normalized === SKILL_CLASS_PAID
  ) {
    return normalized;
  }
  return SKILL_CLASS_BUNDLED;
}

function normalizeSkillEntitlementStatus(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (
    normalized === SKILL_ENTITLEMENT_ACTIVE ||
    normalized === SKILL_ENTITLEMENT_PENDING ||
    normalized === SKILL_ENTITLEMENT_DISABLED ||
    normalized === SKILL_ENTITLEMENT_REVOKED
  ) {
    return normalized;
  }
  return SKILL_ENTITLEMENT_PENDING;
}

function normalizeSkillTemplateState(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (
    normalized === SKILL_TEMPLATE_STATE_ENABLED ||
    normalized === SKILL_TEMPLATE_STATE_DISABLED ||
    normalized === SKILL_TEMPLATE_STATE_BLOCKED
  ) {
    return normalized;
  }
  return SKILL_TEMPLATE_STATE_ENABLED;
}

function normalizeSkillOrderStatus(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === SKILL_ORDER_PENDING_CONFIRMATION || normalized === SKILL_ORDER_CONFIRMED) {
    return normalized;
  }
  return SKILL_ORDER_PENDING_CONFIRMATION;
}

function normalizeSkillOverrideAction(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "force_add" || normalized === "force_remove") {
    return normalized;
  }
  return "";
}

function normalizeAssignmentStatus(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (
    normalized === ASSIGNMENT_STATUS_ACTIVE ||
    normalized === ASSIGNMENT_STATUS_INACTIVE ||
    normalized === ASSIGNMENT_STATUS_BLOCKED_MISSING_SKILLS
  ) {
    return normalized;
  }
  return ASSIGNMENT_STATUS_ACTIVE;
}

function parseSimpleFrontmatter(raw) {
  const text = String(raw || "");
  if (!text.startsWith("---")) {
    return {};
  }
  const lines = text.split(/\r?\n/);
  if (lines[0].trim() !== "---") {
    return {};
  }
  const result = {};
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "---") {
      break;
    }
    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) {
      continue;
    }
    result[match[1]] = match[2];
  }
  return result;
}

function normalizeSkillKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function normalizeSkillName(value, fallback = "") {
  return (
    String(value || "")
      .trim()
      .slice(0, 160) || fallback
  );
}

function normalizeSkillDescription(value) {
  return String(value || "")
    .trim()
    .slice(0, 2000);
}

function listWorkspaceSkillDirectories(workspaceDir) {
  const normalizedWorkspaceDir = String(workspaceDir || "").trim();
  if (!normalizedWorkspaceDir) {
    return [];
  }
  const skillsRoot = path.join(normalizedWorkspaceDir, "skills");
  if (!fs.existsSync(skillsRoot)) {
    return [];
  }
  try {
    return fs
      .readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(skillsRoot, entry.name))
      .filter((skillDir) => fs.existsSync(path.join(skillDir, "SKILL.md")))
      .sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
  } catch {
    return [];
  }
}

function readWorkspaceSkillManifest(skillDir) {
  const normalizedSkillDir = String(skillDir || "").trim();
  const skillMdPath = path.join(normalizedSkillDir, "SKILL.md");
  const raw = readUtf8FileIfExists(skillMdPath);
  if (!raw) {
    return null;
  }
  const frontmatter = parseSimpleFrontmatter(raw);
  const dirName = path.basename(normalizedSkillDir);
  const name = normalizeSkillName(frontmatter.name, dirName);
  const description = normalizeSkillDescription(frontmatter.description);
  const skillKey = normalizeSkillKey(frontmatter.name || dirName);
  const relativePath = path.relative(path.dirname(normalizedSkillDir), normalizedSkillDir);
  return {
    skillKey,
    name,
    description,
    skillDir: normalizedSkillDir,
    skillMdPath,
    skillMdContent: raw,
    versionHash: computeStableTextHash(raw),
    versionLabel: `bundled-${computeStableTextHash(raw).slice(0, 12)}`,
    relativePath,
  };
}

function resolveManagedSkillsStorageRoot(params = {}) {
  return path.join(resolveConfigDir(params), "tenant-platform", "managed-skills");
}

function ensureManagedSkillStorageRoot(params = {}) {
  const root = resolveManagedSkillsStorageRoot(params);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function resolveStoredManagedSkillVersionDir(params = {}) {
  const skillId = String(params.skillId || "").trim();
  const versionId = String(params.versionId || "").trim();
  if (!skillId || !versionId) {
    return "";
  }
  return path.join(ensureManagedSkillStorageRoot(params), skillId, versionId);
}

function mapPlatformSkillRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: String(row.id || "").trim(),
    skillKey: String(row.skillKey || "").trim(),
    name: normalizeSkillName(row.name),
    description: normalizeSkillDescription(row.description),
    classification: normalizeSkillClassification(row.classification),
    sourceType: String(row.sourceType || "").trim() || "workspace",
    sourceRoot: String(row.sourceRoot || "").trim(),
    sourceWorkspaceDir: String(row.sourceWorkspaceDir || "").trim() || null,
    status: String(row.status || "").trim() || "active",
    pricePoints: normalizeNonNegativePoints(row.pricePoints),
    compatibleBaseAgents: parseJsonArray(row.compatibleBaseAgentsJson).map((entry) =>
      String(entry || "").trim(),
    ),
    latestVersionId: String(row.latestVersionId || "").trim() || null,
    latestVersionLabel: String(row.latestVersionLabel || "").trim() || null,
    latestVersionHash: String(row.latestVersionHash || "").trim() || null,
    latestSyncedAt: String(row.latestSyncedAt || "").trim() || null,
    latestPublishedAt: String(row.latestPublishedAt || "").trim() || null,
    affectedTenantCount: Number(row.affectedTenantCount || 0),
    createdAt: String(row.createdAt || "").trim(),
    updatedAt: String(row.updatedAt || "").trim(),
  };
}

function mapPlatformSkillVersionRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: String(row.id || "").trim(),
    skillId: String(row.skillId || "").trim(),
    versionLabel: String(row.versionLabel || "").trim(),
    versionHash: String(row.versionHash || "").trim(),
    skillMdPath: String(row.skillMdPath || "").trim(),
    skillMdContent: String(row.skillMdContent || ""),
    skillMetadata: parseJsonObject(row.skillMetadataJson) || {},
    status: String(row.status || "").trim() || "active",
    createdAt: String(row.createdAt || "").trim(),
    updatedAt: String(row.updatedAt || "").trim(),
  };
}

function getPlatformSkillByKey(db, skillKey) {
  return mapPlatformSkillRow(
    db
      .prepare(
        `SELECT id,
                skill_key AS skillKey,
                name,
                description,
                classification,
                source_type AS sourceType,
                source_root AS sourceRoot,
                source_workspace_dir AS sourceWorkspaceDir,
                status,
                price_points AS pricePoints,
                compatible_base_agents_json AS compatibleBaseAgentsJson,
                latest_version_id AS latestVersionId,
                latest_version_label AS latestVersionLabel,
                latest_version_hash AS latestVersionHash,
                latest_synced_at AS latestSyncedAt,
                latest_published_at AS latestPublishedAt,
                affected_tenant_count AS affectedTenantCount,
                created_at AS createdAt,
                updated_at AS updatedAt
           FROM platform_skills
          WHERE skill_key = ?`,
      )
      .get(normalizeSkillKey(skillKey)),
  );
}

function getPlatformSkillVersionById(db, versionId) {
  return mapPlatformSkillVersionRow(
    db
      .prepare(
        `SELECT id,
                skill_id AS skillId,
                version_label AS versionLabel,
                version_hash AS versionHash,
                skill_md_path AS skillMdPath,
                skill_md_content AS skillMdContent,
                skill_metadata_json AS skillMetadataJson,
                status,
                created_at AS createdAt,
                updated_at AS updatedAt
           FROM platform_skill_versions
          WHERE id = ?`,
      )
      .get(String(versionId || "").trim()),
  );
}

function listPlatformSkillVersionsByIds(db, versionIds = []) {
  const normalizedVersionIds = [
    ...new Set(versionIds.map((entry) => String(entry || "").trim()).filter(Boolean)),
  ];
  if (!normalizedVersionIds.length) {
    return [];
  }
  const placeholders = normalizedVersionIds.map(() => "?").join(", ");
  return db
    .prepare(
      `SELECT id,
              skill_id AS skillId,
              version_label AS versionLabel,
              version_hash AS versionHash,
              skill_md_path AS skillMdPath,
              skill_md_content AS skillMdContent,
              skill_metadata_json AS skillMetadataJson,
              status,
              created_at AS createdAt,
              updated_at AS updatedAt
         FROM platform_skill_versions
        WHERE id IN (${placeholders})
        ORDER BY created_at ASC`,
    )
    .all(...normalizedVersionIds)
    .map(mapPlatformSkillVersionRow)
    .filter(Boolean);
}

function isSkillCompatibleWithBaseAgent(skill, baseAgentId) {
  const normalizedBaseAgentId = String(baseAgentId || "").trim();
  if (!normalizedBaseAgentId) {
    return false;
  }
  const compatibleBaseAgents = Array.isArray(skill?.compatibleBaseAgents)
    ? skill.compatibleBaseAgents
    : [];
  if (!compatibleBaseAgents.length) {
    return true;
  }
  return (
    compatibleBaseAgents.includes(SKILL_CATALOG_COMPATIBLE_ANY) ||
    compatibleBaseAgents.includes(normalizedBaseAgentId)
  );
}

function storeManagedSkillVersionFile(params = {}) {
  const skillId = String(params.skillId || "").trim();
  const versionId = String(params.versionId || "").trim();
  const skillKey = normalizeSkillKey(params.skillKey);
  const skillMdContent = String(params.skillMdContent || "");
  if (!skillId || !versionId || !skillKey || !skillMdContent) {
    return "";
  }
  const versionDir = resolveStoredManagedSkillVersionDir({
    ...params,
    skillId,
    versionId,
  });
  if (!versionDir) {
    return "";
  }
  const skillDir = path.join(versionDir, skillKey);
  fs.mkdirSync(skillDir, { recursive: true });
  const skillMdPath = path.join(skillDir, "SKILL.md");
  fs.writeFileSync(skillMdPath, skillMdContent, "utf8");
  return skillMdPath;
}

function upsertPlatformSkillCatalogEntry(db, params = {}) {
  const skillKey = normalizeSkillKey(params.skillKey);
  if (!skillKey) {
    throw new Error("skill_key_required");
  }
  const now = nowIso();
  const classification = normalizeSkillClassification(params.classification);
  const compatibleBaseAgents = Array.isArray(params.compatibleBaseAgents)
    ? [
        ...new Set(
          params.compatibleBaseAgents.map((entry) => String(entry || "").trim()).filter(Boolean),
        ),
      ]
    : [SKILL_CATALOG_COMPATIBLE_ANY];
  const existing = getPlatformSkillByKey(db, skillKey);
  if (existing) {
    db.prepare(
      `UPDATE platform_skills
          SET name = @name,
              description = @description,
              classification = @classification,
              source_type = @sourceType,
              source_root = @sourceRoot,
              source_workspace_dir = @sourceWorkspaceDir,
              status = @status,
              price_points = @pricePoints,
              compatible_base_agents_json = @compatibleBaseAgentsJson,
              latest_synced_at = @latestSyncedAt,
              updated_at = @updatedAt
        WHERE id = @id`,
    ).run({
      id: existing.id,
      name: normalizeSkillName(params.name, skillKey),
      description: normalizeSkillDescription(params.description),
      classification,
      sourceType: String(params.sourceType || "workspace").trim() || "workspace",
      sourceRoot: String(params.sourceRoot || "").trim(),
      sourceWorkspaceDir: String(params.sourceWorkspaceDir || "").trim() || null,
      status: String(params.status || "active").trim() || "active",
      pricePoints: normalizeNonNegativePoints(params.pricePoints),
      compatibleBaseAgentsJson: stringifyJsonArray(compatibleBaseAgents),
      latestSyncedAt: now,
      updatedAt: now,
    });
    return getPlatformSkillByKey(db, skillKey);
  }

  const skillId = createId("platform_skill");
  db.prepare(
    `INSERT INTO platform_skills (
       id,
       skill_key,
       name,
       description,
       classification,
       source_type,
       source_root,
       source_workspace_dir,
       status,
       price_points,
       compatible_base_agents_json,
       latest_synced_at,
       created_at,
       updated_at
     ) VALUES (
       @id,
       @skillKey,
       @name,
       @description,
       @classification,
       @sourceType,
       @sourceRoot,
       @sourceWorkspaceDir,
       @status,
       @pricePoints,
       @compatibleBaseAgentsJson,
       @latestSyncedAt,
       @createdAt,
       @updatedAt
     )`,
  ).run({
    id: skillId,
    skillKey,
    name: normalizeSkillName(params.name, skillKey),
    description: normalizeSkillDescription(params.description),
    classification,
    sourceType: String(params.sourceType || "workspace").trim() || "workspace",
    sourceRoot: String(params.sourceRoot || "").trim(),
    sourceWorkspaceDir: String(params.sourceWorkspaceDir || "").trim() || null,
    status: String(params.status || "active").trim() || "active",
    pricePoints: normalizeNonNegativePoints(params.pricePoints),
    compatibleBaseAgentsJson: stringifyJsonArray(compatibleBaseAgents),
    latestSyncedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return getPlatformSkillByKey(db, skillKey);
}

function upsertPlatformSkillVersion(db, params = {}) {
  const skillId = String(params.skillId || "").trim();
  const skillKey = normalizeSkillKey(params.skillKey);
  const versionHash = String(params.versionHash || "").trim();
  if (!skillId || !skillKey || !versionHash) {
    throw new Error("platform_skill_version_missing_fields");
  }
  const now = nowIso();
  const existing = db
    .prepare(
      `SELECT id
         FROM platform_skill_versions
        WHERE skill_id = ? AND version_hash = ?
        LIMIT 1`,
    )
    .get(skillId, versionHash);
  if (existing?.id) {
    return getPlatformSkillVersionById(db, existing.id);
  }
  const versionId = createId("skill_version");
  const storedSkillMdPath =
    storeManagedSkillVersionFile({
      ...params,
      skillId,
      versionId,
      skillKey,
    }) || String(params.skillMdPath || "").trim();
  db.prepare(
    `INSERT INTO platform_skill_versions (
       id,
       skill_id,
       version_label,
       version_hash,
       skill_md_path,
       skill_md_content,
       skill_metadata_json,
       status,
       created_at,
       updated_at
     ) VALUES (
       @id,
       @skillId,
       @versionLabel,
       @versionHash,
       @skillMdPath,
       @skillMdContent,
       @skillMetadataJson,
       'active',
       @createdAt,
       @updatedAt
     )`,
  ).run({
    id: versionId,
    skillId,
    versionLabel:
      String(params.versionLabel || versionHash.slice(0, 12)).trim() || versionHash.slice(0, 12),
    versionHash,
    skillMdPath: storedSkillMdPath,
    skillMdContent: String(params.skillMdContent || ""),
    skillMetadataJson: stringifyJsonObject(params.skillMetadata || {}),
    createdAt: now,
    updatedAt: now,
  });
  db.prepare(
    `UPDATE platform_skills
        SET latest_version_id = @versionId,
            latest_version_label = @versionLabel,
            latest_version_hash = @versionHash,
            latest_published_at = @publishedAt,
            latest_synced_at = @publishedAt,
            updated_at = @updatedAt
      WHERE id = @skillId`,
  ).run({
    skillId,
    versionId,
    versionLabel:
      String(params.versionLabel || versionHash.slice(0, 12)).trim() || versionHash.slice(0, 12),
    versionHash,
    publishedAt: now,
    updatedAt: now,
  });
  return getPlatformSkillVersionById(db, versionId);
}

function ensurePlatformSkillAgentBindings(db, skillId, baseAgentIds = []) {
  const normalizedBaseAgentIds = [
    ...new Set(baseAgentIds.map((entry) => String(entry || "").trim()).filter(Boolean)),
  ];
  const now = nowIso();
  for (const baseAgentId of normalizedBaseAgentIds) {
    db.prepare(
      `INSERT INTO platform_skill_agent_bindings (
         id,
         skill_id,
         base_agent_id,
         status,
         created_at,
         updated_at
       ) VALUES (
         @id,
         @skillId,
         @baseAgentId,
         'active',
         @createdAt,
         @updatedAt
       )
       ON CONFLICT(skill_id, base_agent_id) DO UPDATE SET
         status = 'active',
         updated_at = excluded.updated_at`,
    ).run({
      id: createId("skill_agent_binding"),
      skillId,
      baseAgentId,
      createdAt: now,
      updatedAt: now,
    });
  }
}

function discoverBundledSkillsForBaseAgent(db, params = {}) {
  const baseAgentId = String(params.baseAgentId || "").trim();
  const workspaceDir = resolveBaseWorkspaceDir(params);
  if (!baseAgentId || !workspaceDir) {
    return [];
  }
  const manifests = listWorkspaceSkillDirectories(workspaceDir)
    .map((skillDir) => readWorkspaceSkillManifest(skillDir))
    .filter(Boolean);
  const discovered = [];
  for (const manifest of manifests) {
    const skill = upsertPlatformSkillCatalogEntry(db, {
      skillKey: manifest.skillKey,
      name: manifest.name,
      description: manifest.description,
      classification: SKILL_CLASS_BUNDLED,
      sourceType: "workspace",
      sourceRoot: manifest.skillDir,
      sourceWorkspaceDir: workspaceDir,
      status: "active",
      pricePoints: 0,
      compatibleBaseAgents: [baseAgentId],
    });
    if (!skill?.id) {
      continue;
    }
    ensurePlatformSkillAgentBindings(db, skill.id, [baseAgentId]);
    const version = upsertPlatformSkillVersion(db, {
      ...params,
      skillId: skill.id,
      skillKey: manifest.skillKey,
      versionHash: manifest.versionHash,
      versionLabel: manifest.versionLabel,
      skillMdPath: manifest.skillMdPath,
      skillMdContent: manifest.skillMdContent,
      skillMetadata: {
        name: manifest.name,
        description: manifest.description,
        relativePath: manifest.relativePath,
      },
    });
    discovered.push({
      ...skill,
      latestVersionId: version?.id || skill.latestVersionId,
      latestVersionLabel: version?.versionLabel || skill.latestVersionLabel,
      latestVersionHash: version?.versionHash || skill.latestVersionHash,
      sourceRoot: manifest.skillDir,
      sourceWorkspaceDir: workspaceDir,
      compatibleBaseAgents: [baseAgentId],
    });
  }
  return discovered;
}

function listPlatformSkillsInternal(db, params = {}) {
  const classification = String(params.classification || "")
    .trim()
    .toLowerCase();
  const includeInactive = Boolean(params.includeInactive);
  const where = [];
  const bindings = {};
  if (!includeInactive) {
    where.push(`status = 'active'`);
  }
  if (classification) {
    where.push(`classification = @classification`);
    bindings.classification = classification;
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return db
    .prepare(
      `SELECT id,
              skill_key AS skillKey,
              name,
              description,
              classification,
              source_type AS sourceType,
              source_root AS sourceRoot,
              source_workspace_dir AS sourceWorkspaceDir,
              status,
              price_points AS pricePoints,
              compatible_base_agents_json AS compatibleBaseAgentsJson,
              latest_version_id AS latestVersionId,
              latest_version_label AS latestVersionLabel,
              latest_version_hash AS latestVersionHash,
              latest_synced_at AS latestSyncedAt,
              latest_published_at AS latestPublishedAt,
              affected_tenant_count AS affectedTenantCount,
              created_at AS createdAt,
              updated_at AS updatedAt
         FROM platform_skills
         ${whereSql}
         ORDER BY updated_at DESC, created_at DESC`,
    )
    .all(bindings)
    .map(mapPlatformSkillRow)
    .filter(Boolean);
}

function listTenantSkillsMarketInternal(db, tenantId, params = {}) {
  const normalizedTenantId = String(tenantId || "").trim();
  const baseAgentId = String(params.baseAgentId || "").trim();
  if (!normalizedTenantId) {
    return [];
  }
  const entitlementBySkillId = new Map(
    listTenantSkillEntitlementsInternal(db, normalizedTenantId).map((entry) => [
      entry.skillId,
      entry,
    ]),
  );
  const pendingOrderBySkillId = new Map(
    db
      .prepare(
        `SELECT id,
                skill_id AS skillId,
                order_status AS orderStatus,
                amount_points AS amountPoints,
                created_at AS createdAt
           FROM tenant_skill_orders
          WHERE tenant_id = ?
          ORDER BY created_at DESC`,
      )
      .all(normalizedTenantId)
      .map((row) => ({
        id: String(row?.id || "").trim(),
        skillId: String(row?.skillId || "").trim(),
        orderStatus: normalizeSkillOrderStatus(row?.orderStatus),
        amountPoints: normalizeNonNegativePoints(row?.amountPoints),
        createdAt: String(row?.createdAt || "").trim(),
      }))
      .filter((row) => row.id)
      .filter(
        (row, index, rows) => rows.findIndex((entry) => entry.skillId === row.skillId) === index,
      )
      .map((row) => [row.skillId, row]),
  );
  const templateCountBySkillId = new Map();
  const assignmentCountBySkillId = new Map();
  for (const row of db
    .prepare(
      `SELECT tats.skill_id AS skillId,
              COUNT(DISTINCT tats.tenant_agent_id) AS tenantAgentCount
         FROM tenant_agent_skill_templates tats
         JOIN tenant_agents ta ON ta.id = tats.tenant_agent_id
        WHERE ta.tenant_id = ?
        GROUP BY tats.skill_id`,
    )
    .all(normalizedTenantId)) {
    templateCountBySkillId.set(
      String(row?.skillId || "").trim(),
      Number(row?.tenantAgentCount || 0) || 0,
    );
  }
  for (const row of db
    .prepare(
      `SELECT uaso.skill_id AS skillId,
              COUNT(DISTINCT uaso.assignment_id) AS assignmentCount
         FROM user_agent_skill_overrides uaso
         JOIN user_agent_assignments ua ON ua.id = uaso.assignment_id
        WHERE ua.tenant_id = ? AND ua.status = 'active'
        GROUP BY uaso.skill_id`,
    )
    .all(normalizedTenantId)) {
    assignmentCountBySkillId.set(
      String(row?.skillId || "").trim(),
      Number(row?.assignmentCount || 0) || 0,
    );
  }

  return listPlatformSkillsInternal(db, { includeInactive: true })
    .filter((skill) => {
      if (skill.status !== "active") {
        return false;
      }
      if (!baseAgentId) {
        return true;
      }
      return isSkillCompatibleWithBaseAgent(skill, baseAgentId);
    })
    .map((skill) => {
      const entitlement = entitlementBySkillId.get(skill.id) || null;
      const isCompatible = !baseAgentId || isSkillCompatibleWithBaseAgent(skill, baseAgentId);
      let marketStatus = "待下单";
      if (!isCompatible) {
        marketStatus = "不兼容";
      } else if (skill.classification === SKILL_CLASS_BUNDLED) {
        marketStatus = "无需购买";
      } else if (skill.classification === SKILL_CLASS_FREE) {
        marketStatus = entitlement?.enabledByTenant ? "已启用" : "免费可启用";
      } else if (!entitlement) {
        marketStatus =
          pendingOrderBySkillId.get(skill.id)?.orderStatus === SKILL_ORDER_PENDING_CONFIRMATION
            ? "待确认"
            : "待下单";
      } else if (entitlement.status === SKILL_ENTITLEMENT_PENDING) {
        marketStatus = "待确认";
      } else if (entitlement.status === SKILL_ENTITLEMENT_ACTIVE) {
        marketStatus = entitlement.enabledByTenant ? "已购买已启用" : "已购买未启用";
      } else {
        marketStatus = "待下单";
      }
      return {
        ...skill,
        entitlementId: entitlement?.id || null,
        entitlementStatus: entitlement?.status || null,
        enabledByTenant: entitlement?.enabledByTenant || false,
        pendingOrderId: pendingOrderBySkillId.get(skill.id)?.id || null,
        pendingOrderStatus: pendingOrderBySkillId.get(skill.id)?.orderStatus || null,
        currentVersionId:
          String(entitlement?.currentVersionId || "").trim() || skill.latestVersionId || null,
        affectedTenantAgentCount: templateCountBySkillId.get(skill.id) || 0,
        affectedAssignmentCount: assignmentCountBySkillId.get(skill.id) || 0,
        marketStatus,
        compatible: isCompatible,
      };
    })
    .sort((left, right) => left.skillKey.localeCompare(right.skillKey));
}

function ensureTenantSkillEntitlement(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const skillId = String(params.skillId || "").trim();
  if (!tenantId || !skillId) {
    throw new Error("tenant_skill_entitlement_missing_fields");
  }
  const existing = db
    .prepare(
      `SELECT id,
              tenant_id AS tenantId,
              skill_id AS skillId,
              status,
              acquire_type AS acquireType,
              version_policy AS versionPolicy,
              current_version_id AS currentVersionId,
              enabled_by_tenant AS enabledByTenant,
              blocked_reason AS blockedReason,
              order_id AS orderId,
              created_at AS createdAt,
              updated_at AS updatedAt
         FROM tenant_skill_entitlements
        WHERE tenant_id = ? AND skill_id = ?`,
    )
    .get(tenantId, skillId);
  const now = nowIso();
  const status = normalizeSkillEntitlementStatus(params.status);
  const enabledByTenant = params.enabledByTenant ? 1 : 0;
  if (existing?.id) {
    db.prepare(
      `UPDATE tenant_skill_entitlements
          SET status = @status,
              acquire_type = @acquireType,
              version_policy = @versionPolicy,
              current_version_id = @currentVersionId,
              enabled_by_tenant = @enabledByTenant,
              blocked_reason = @blockedReason,
              order_id = @orderId,
              updated_at = @updatedAt
        WHERE id = @id`,
    ).run({
      id: existing.id,
      status,
      acquireType: String(params.acquireType || existing.acquireType || "bundled").trim(),
      versionPolicy: String(params.versionPolicy || "latest").trim() || "latest",
      currentVersionId: String(params.currentVersionId || "").trim() || null,
      enabledByTenant,
      blockedReason: String(params.blockedReason || "").trim() || null,
      orderId: String(params.orderId || "").trim() || null,
      updatedAt: now,
    });
    return (
      listTenantSkillEntitlementsInternal(db, tenantId).find((entry) => entry.id === existing.id) ||
      null
    );
  }
  const entitlementId = createId("tenant_skill_entitlement");
  db.prepare(
    `INSERT INTO tenant_skill_entitlements (
       id,
       tenant_id,
       skill_id,
       status,
       acquire_type,
       version_policy,
       current_version_id,
       enabled_by_tenant,
       blocked_reason,
       order_id,
       created_at,
       updated_at
     ) VALUES (
       @id,
       @tenantId,
       @skillId,
       @status,
       @acquireType,
       @versionPolicy,
       @currentVersionId,
       @enabledByTenant,
       @blockedReason,
       @orderId,
       @createdAt,
       @updatedAt
     )`,
  ).run({
    id: entitlementId,
    tenantId,
    skillId,
    status,
    acquireType: String(params.acquireType || "bundled").trim() || "bundled",
    versionPolicy: String(params.versionPolicy || "latest").trim() || "latest",
    currentVersionId: String(params.currentVersionId || "").trim() || null,
    enabledByTenant,
    blockedReason: String(params.blockedReason || "").trim() || null,
    orderId: String(params.orderId || "").trim() || null,
    createdAt: now,
    updatedAt: now,
  });
  return (
    listTenantSkillEntitlementsInternal(db, tenantId).find((entry) => entry.id === entitlementId) ||
    null
  );
}

function createTenantSkillOrderRecord(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const skillId = String(params.skillId || "").trim();
  if (!tenantId || !skillId) {
    throw new Error("tenant_skill_order_missing_fields");
  }
  const now = nowIso();
  const orderId = createId("tenant_skill_order");
  const createdByUserId = String(params.createdByUserId || "").trim();
  const validCreatedByUserId = createdByUserId
    ? String(
        getScalar(db, `SELECT id AS value FROM users WHERE id = ? LIMIT 1`, [createdByUserId]) ||
          "",
      ).trim() || null
    : null;
  db.prepare(
    `INSERT INTO tenant_skill_orders (
       id,
       tenant_id,
       skill_id,
       order_status,
       acquire_type,
       amount_points,
       version_policy,
       current_version_id,
       created_by_user_id,
       confirmed_by_user_id,
       confirmed_at,
       created_at,
       updated_at
     ) VALUES (
       @id,
       @tenantId,
       @skillId,
       @orderStatus,
       @acquireType,
       @amountPoints,
       @versionPolicy,
       @currentVersionId,
       @createdByUserId,
       NULL,
       NULL,
       @createdAt,
       @updatedAt
     )`,
  ).run({
    id: orderId,
    tenantId,
    skillId,
    orderStatus: normalizeSkillOrderStatus(params.orderStatus),
    acquireType: String(params.acquireType || "paid_order").trim() || "paid_order",
    amountPoints: normalizeNonNegativePoints(params.amountPoints),
    versionPolicy: String(params.versionPolicy || "latest").trim() || "latest",
    currentVersionId: String(params.currentVersionId || "").trim() || null,
    createdByUserId: validCreatedByUserId,
    createdAt: now,
    updatedAt: now,
  });
  return getTenantSkillOrderById(db, orderId);
}

function getTenantSkillOrderById(db, orderId) {
  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId) {
    return null;
  }
  const row = db
    .prepare(
      `SELECT tso.id,
              tso.tenant_id AS tenantId,
              tso.skill_id AS skillId,
              tso.order_status AS orderStatus,
              tso.acquire_type AS acquireType,
              tso.amount_points AS amountPoints,
              tso.version_policy AS versionPolicy,
              tso.current_version_id AS currentVersionId,
              tso.created_by_user_id AS createdByUserId,
              tso.confirmed_by_user_id AS confirmedByUserId,
              tso.confirmed_at AS confirmedAt,
              tso.created_at AS createdAt,
              tso.updated_at AS updatedAt,
              ps.skill_key AS skillKey,
              ps.name,
              ps.classification,
              ps.price_points AS pricePoints,
              ps.latest_version_id AS latestVersionId
         FROM tenant_skill_orders tso
         JOIN platform_skills ps ON ps.id = tso.skill_id
        WHERE tso.id = ?
        LIMIT 1`,
    )
    .get(normalizedOrderId);
  if (!row) {
    return null;
  }
  return {
    id: String(row.id || "").trim(),
    tenantId: String(row.tenantId || "").trim(),
    skillId: String(row.skillId || "").trim(),
    orderStatus: normalizeSkillOrderStatus(row.orderStatus),
    acquireType: String(row.acquireType || "").trim() || "paid_order",
    amountPoints: normalizeNonNegativePoints(row.amountPoints),
    versionPolicy: String(row.versionPolicy || "").trim() || "latest",
    currentVersionId: String(row.currentVersionId || "").trim() || null,
    createdByUserId: String(row.createdByUserId || "").trim() || null,
    confirmedByUserId: String(row.confirmedByUserId || "").trim() || null,
    confirmedAt: String(row.confirmedAt || "").trim() || null,
    createdAt: String(row.createdAt || "").trim(),
    updatedAt: String(row.updatedAt || "").trim(),
    skillKey: String(row.skillKey || "").trim(),
    name: normalizeSkillName(row.name, row.skillKey),
    classification: normalizeSkillClassification(row.classification),
    pricePoints: normalizeNonNegativePoints(row.pricePoints),
    latestVersionId: String(row.latestVersionId || "").trim() || null,
  };
}

function ensureTenantAgentSkillTemplate(db, params = {}) {
  const tenantAgentId = String(params.tenantAgentId || "").trim();
  const skillId = String(params.skillId || "").trim();
  if (!tenantAgentId || !skillId) {
    throw new Error("tenant_agent_skill_template_missing_fields");
  }
  const now = nowIso();
  db.prepare(
    `INSERT INTO tenant_agent_skill_templates (
       id,
       tenant_agent_id,
       skill_id,
       template_state,
       source_type,
       created_at,
       updated_at
     ) VALUES (
       @id,
       @tenantAgentId,
       @skillId,
       @templateState,
       @sourceType,
       @createdAt,
       @updatedAt
     )
     ON CONFLICT(tenant_agent_id, skill_id) DO UPDATE SET
       template_state = excluded.template_state,
       source_type = excluded.source_type,
       updated_at = excluded.updated_at`,
  ).run({
    id: createId("tenant_agent_skill_template"),
    tenantAgentId,
    skillId,
    templateState: normalizeSkillTemplateState(params.templateState),
    sourceType: String(params.sourceType || "base_default").trim() || "base_default",
    createdAt: now,
    updatedAt: now,
  });
}

function listTenantAgentSkillTemplates(db, tenantAgentId) {
  const normalizedTenantAgentId = String(tenantAgentId || "").trim();
  if (!normalizedTenantAgentId) {
    return [];
  }
  return db
    .prepare(
      `SELECT tats.id,
              tats.tenant_agent_id AS tenantAgentId,
              tats.skill_id AS skillId,
              tats.template_state AS templateState,
              tats.source_type AS sourceType,
              tats.created_at AS createdAt,
              tats.updated_at AS updatedAt,
              ps.skill_key AS skillKey,
              ps.name,
              ps.description,
              ps.classification,
              ps.status,
              ps.price_points AS pricePoints,
              ps.latest_version_id AS latestVersionId
         FROM tenant_agent_skill_templates tats
         JOIN platform_skills ps ON ps.id = tats.skill_id
        WHERE tats.tenant_agent_id = ?
        ORDER BY tats.created_at ASC, ps.skill_key ASC`,
    )
    .all(normalizedTenantAgentId)
    .map((row) => ({
      id: String(row.id || "").trim(),
      tenantAgentId: String(row.tenantAgentId || "").trim(),
      skillId: String(row.skillId || "").trim(),
      templateState: normalizeSkillTemplateState(row.templateState),
      sourceType: String(row.sourceType || "").trim() || "base_default",
      createdAt: String(row.createdAt || "").trim(),
      updatedAt: String(row.updatedAt || "").trim(),
      skillKey: String(row.skillKey || "").trim(),
      name: normalizeSkillName(row.name, row.skillKey),
      description: normalizeSkillDescription(row.description),
      classification: normalizeSkillClassification(row.classification),
      status: String(row.status || "").trim() || "active",
      pricePoints: normalizeNonNegativePoints(row.pricePoints),
      latestVersionId: String(row.latestVersionId || "").trim() || null,
    }));
}

function setUserAgentSkillOverrides(db, params = {}) {
  const assignmentId = String(params.assignmentId || "").trim();
  const tenantAgentId = String(params.tenantAgentId || "").trim();
  const userId = String(params.userId || "").trim();
  if (!assignmentId || !tenantAgentId || !userId) {
    throw new Error("user_agent_skill_override_missing_fields");
  }
  const overrides = Array.isArray(params.overrides) ? params.overrides : [];
  const now = nowIso();
  db.prepare("DELETE FROM user_agent_skill_overrides WHERE assignment_id = ?").run(assignmentId);
  for (const override of overrides) {
    const action = normalizeSkillOverrideAction(override?.action);
    const skillId = String(override?.skillId || "").trim();
    if (!action || !skillId) {
      continue;
    }
    db.prepare(
      `INSERT INTO user_agent_skill_overrides (
         id,
         assignment_id,
         tenant_agent_id,
         user_id,
         skill_id,
         action,
         created_at,
         updated_at
       ) VALUES (
         @id,
         @assignmentId,
         @tenantAgentId,
         @userId,
         @skillId,
         @action,
         @createdAt,
         @updatedAt
       )`,
    ).run({
      id: createId("user_agent_skill_override"),
      assignmentId,
      tenantAgentId,
      userId,
      skillId,
      action,
      createdAt: now,
      updatedAt: now,
    });
  }
}

function listUserAgentSkillOverrides(db, assignmentId) {
  const normalizedAssignmentId = String(assignmentId || "").trim();
  if (!normalizedAssignmentId) {
    return [];
  }
  return db
    .prepare(
      `SELECT uaso.id,
              uaso.assignment_id AS assignmentId,
              uaso.tenant_agent_id AS tenantAgentId,
              uaso.user_id AS userId,
              uaso.skill_id AS skillId,
              uaso.action,
              uaso.created_at AS createdAt,
              uaso.updated_at AS updatedAt,
              ps.skill_key AS skillKey,
              ps.name,
              ps.description,
              ps.classification,
              ps.status,
              ps.price_points AS pricePoints,
              ps.latest_version_id AS latestVersionId
         FROM user_agent_skill_overrides uaso
         JOIN platform_skills ps ON ps.id = uaso.skill_id
        WHERE uaso.assignment_id = ?
        ORDER BY uaso.created_at ASC, ps.skill_key ASC`,
    )
    .all(normalizedAssignmentId)
    .map((row) => ({
      id: String(row.id || "").trim(),
      assignmentId: String(row.assignmentId || "").trim(),
      tenantAgentId: String(row.tenantAgentId || "").trim(),
      userId: String(row.userId || "").trim(),
      skillId: String(row.skillId || "").trim(),
      action: normalizeSkillOverrideAction(row.action),
      createdAt: String(row.createdAt || "").trim(),
      updatedAt: String(row.updatedAt || "").trim(),
      skillKey: String(row.skillKey || "").trim(),
      name: normalizeSkillName(row.name, row.skillKey),
      description: normalizeSkillDescription(row.description),
      classification: normalizeSkillClassification(row.classification),
      status: String(row.status || "").trim() || "active",
      pricePoints: normalizeNonNegativePoints(row.pricePoints),
      latestVersionId: String(row.latestVersionId || "").trim() || null,
    }));
}

function listTenantSkillEntitlementsInternal(db, tenantId) {
  const normalizedTenantId = String(tenantId || "").trim();
  if (!normalizedTenantId) {
    return [];
  }
  return db
    .prepare(
      `SELECT tse.id,
              tse.tenant_id AS tenantId,
              tse.skill_id AS skillId,
              tse.status,
              tse.acquire_type AS acquireType,
              tse.version_policy AS versionPolicy,
              tse.current_version_id AS currentVersionId,
              tse.enabled_by_tenant AS enabledByTenant,
              tse.blocked_reason AS blockedReason,
              tse.order_id AS orderId,
              tse.created_at AS createdAt,
              tse.updated_at AS updatedAt,
              ps.skill_key AS skillKey,
              ps.name,
              ps.description,
              ps.classification,
              ps.status AS skillStatus,
              ps.price_points AS pricePoints,
              ps.latest_version_id AS latestVersionId
         FROM tenant_skill_entitlements tse
         JOIN platform_skills ps ON ps.id = tse.skill_id
        WHERE tse.tenant_id = ?
        ORDER BY tse.updated_at DESC, tse.created_at DESC`,
    )
    .all(normalizedTenantId)
    .map((row) => ({
      id: String(row.id || "").trim(),
      tenantId: String(row.tenantId || "").trim(),
      skillId: String(row.skillId || "").trim(),
      status: normalizeSkillEntitlementStatus(row.status),
      acquireType: String(row.acquireType || "").trim() || "bundled",
      versionPolicy: String(row.versionPolicy || "").trim() || "latest",
      currentVersionId: String(row.currentVersionId || "").trim() || null,
      enabledByTenant: Number(row.enabledByTenant || 0) > 0,
      blockedReason: String(row.blockedReason || "").trim() || null,
      orderId: String(row.orderId || "").trim() || null,
      createdAt: String(row.createdAt || "").trim(),
      updatedAt: String(row.updatedAt || "").trim(),
      skillKey: String(row.skillKey || "").trim(),
      name: normalizeSkillName(row.name, row.skillKey),
      description: normalizeSkillDescription(row.description),
      classification: normalizeSkillClassification(row.classification),
      skillStatus: String(row.skillStatus || "").trim() || "active",
      pricePoints: normalizeNonNegativePoints(row.pricePoints),
      latestVersionId: String(row.latestVersionId || "").trim() || null,
    }));
}

function listTenantSkillAssignmentsInternal(db, tenantId) {
  const normalizedTenantId = String(tenantId || "").trim();
  if (!normalizedTenantId) {
    return [];
  }
  const tenantAgents = db
    .prepare(
      `SELECT ta.id,
              ta.agent_id AS baseAgentId,
              ta.description,
              ta.status,
              COUNT(DISTINCT CASE WHEN ua.status = 'active' THEN ua.id END) AS assignmentCount
         FROM tenant_agents ta
         LEFT JOIN user_agent_assignments ua ON ua.tenant_agent_id = ta.id
        WHERE ta.tenant_id = ?
        GROUP BY ta.id
        ORDER BY ta.updated_at DESC, ta.created_at DESC`,
    )
    .all(normalizedTenantId);
  return tenantAgents.map((row) => {
    const tenantAgentId = String(row?.id || "").trim();
    const templates = listTenantAgentSkillTemplates(db, tenantAgentId);
    const assignmentRows = db
      .prepare(
        `SELECT ua.id,
                ua.user_id AS userId,
                ua.derived_agent_id AS derivedAgentId,
                ua.status,
                u.username
           FROM user_agent_assignments ua
           JOIN users u ON u.id = ua.user_id
          WHERE ua.tenant_agent_id = ? AND ua.status = 'active'
          ORDER BY ua.created_at ASC`,
      )
      .all(tenantAgentId)
      .map((assignment) => {
        const assignmentId = String(assignment?.id || "").trim();
        const overrides = listUserAgentSkillOverrides(db, assignmentId);
        const resolved = resolveAssignmentSkillState(db, {
          tenantId: normalizedTenantId,
          tenantAgentId,
          assignmentId,
        });
        return {
          assignmentId,
          userId: String(assignment?.userId || "").trim(),
          username: String(assignment?.username || "").trim(),
          derivedAgentId: String(assignment?.derivedAgentId || "").trim() || null,
          status: String(assignment?.status || "").trim() || "active",
          overrideRows: overrides,
          overrideSummary: overrides.map((entry) => ({
            skillKey: entry.skillKey,
            action: entry.action,
          })),
          resolvedSkillKeys: resolved.resolvedEntries.map((entry) => entry.skillKey),
          blockedReasons: resolved.blockedReasons,
        };
      });
    const blockedSkillKeys = templates
      .filter((entry) => entry.templateState === SKILL_TEMPLATE_STATE_BLOCKED)
      .map((entry) => entry.skillKey);
    return {
      tenantAgentId,
      baseAgentId: String(row?.baseAgentId || "").trim(),
      description: String(row?.description || "").trim() || null,
      status: String(row?.status || "").trim() || "active",
      assignmentCount: Number(row?.assignmentCount || 0) || 0,
      templateRows: templates,
      templateSkillKeys: templates
        .filter((entry) => entry.templateState === SKILL_TEMPLATE_STATE_ENABLED)
        .map((entry) => entry.skillKey),
      blockedSkillKeys,
      assignments: assignmentRows,
    };
  });
}

function resolveSkillVersionForEntitlement(db, entitlement) {
  const versionId =
    String(entitlement?.currentVersionId || "").trim() ||
    String(entitlement?.latestVersionId || "").trim();
  return versionId ? getPlatformSkillVersionById(db, versionId) : null;
}

function isSkillEntitlementUsable(classification, entitlement) {
  const normalizedClassification = normalizeSkillClassification(classification);
  if (normalizedClassification === SKILL_CLASS_BUNDLED) {
    return true;
  }
  return (
    normalizeSkillEntitlementStatus(entitlement?.status) === SKILL_ENTITLEMENT_ACTIVE &&
    Boolean(entitlement?.enabledByTenant)
  );
}

function ensureTenantBundledSkillState(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const tenantAgentId = String(params.tenantAgentId || "").trim();
  const baseAgentId = String(params.baseAgentId || "").trim();
  if (!tenantId || !tenantAgentId || !baseAgentId) {
    return [];
  }
  const discoveredBundledSkills = discoverBundledSkillsForBaseAgent(db, {
    ...params,
    baseAgentId,
  });
  for (const skill of discoveredBundledSkills) {
    ensureTenantSkillEntitlement(db, {
      tenantId,
      skillId: skill.id,
      status: SKILL_ENTITLEMENT_ACTIVE,
      acquireType: "bundled",
      versionPolicy: "latest",
      currentVersionId: skill.latestVersionId,
      enabledByTenant: true,
    });
    ensureTenantAgentSkillTemplate(db, {
      tenantAgentId,
      skillId: skill.id,
      templateState: SKILL_TEMPLATE_STATE_ENABLED,
      sourceType: "base_default",
    });
  }
  return discoveredBundledSkills;
}

function upsertTenantAgentSkillSnapshot(db, params = {}) {
  const assignmentId = String(params.assignmentId || "").trim();
  if (!assignmentId) {
    return null;
  }
  const now = nowIso();
  db.prepare("DELETE FROM tenant_agent_skill_snapshots WHERE assignment_id = ?").run(assignmentId);
  const snapshotId = createId("tenant_agent_skill_snapshot");
  db.prepare(
    `INSERT INTO tenant_agent_skill_snapshots (
       id,
       assignment_id,
       tenant_id,
       tenant_agent_id,
       user_id,
       derived_agent_id,
       resolved_skill_keys_json,
       resolved_version_ids_json,
       blocked_reasons_json,
       applied_at
     ) VALUES (
       @id,
       @assignmentId,
       @tenantId,
       @tenantAgentId,
       @userId,
       @derivedAgentId,
       @resolvedSkillKeysJson,
       @resolvedVersionIdsJson,
       @blockedReasonsJson,
       @appliedAt
     )`,
  ).run({
    id: snapshotId,
    assignmentId,
    tenantId: String(params.tenantId || "").trim(),
    tenantAgentId: String(params.tenantAgentId || "").trim(),
    userId: String(params.userId || "").trim(),
    derivedAgentId: String(params.derivedAgentId || "").trim(),
    resolvedSkillKeysJson: stringifyJsonArray(params.resolvedSkillKeys),
    resolvedVersionIdsJson: stringifyJsonArray(params.resolvedVersionIds),
    blockedReasonsJson: stringifyJsonArray(params.blockedReasons),
    appliedAt: now,
  });
  return snapshotId;
}

function resolveAssignmentSkillState(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const tenantAgentId = String(params.tenantAgentId || "").trim();
  const assignmentId = String(params.assignmentId || "").trim();
  const baseAgentId = String(params.baseAgentId || "").trim();
  if (!tenantId || !tenantAgentId) {
    throw new Error("resolve_assignment_skill_state_missing_fields");
  }
  if (baseAgentId) {
    ensureTenantBundledSkillState(db, {
      ...params,
      tenantId,
      tenantAgentId,
      baseAgentId,
    });
  }
  const entitlements = listTenantSkillEntitlementsInternal(db, tenantId);
  const entitlementBySkillId = new Map(entitlements.map((entry) => [entry.skillId, entry]));
  const templates = listTenantAgentSkillTemplates(db, tenantAgentId);
  const overrides = assignmentId ? listUserAgentSkillOverrides(db, assignmentId) : [];
  const enabledTemplateSkillIds = new Set();
  const blockedReasons = [];

  for (const template of templates) {
    const entitlement = entitlementBySkillId.get(template.skillId);
    const hasActiveEntitlement = isSkillEntitlementUsable(template.classification, entitlement);
    if (template.templateState === SKILL_TEMPLATE_STATE_BLOCKED) {
      blockedReasons.push(`${template.skillKey}:missing_entitlement`);
      continue;
    }
    if (template.templateState !== SKILL_TEMPLATE_STATE_ENABLED) {
      continue;
    }
    if (!hasActiveEntitlement) {
      blockedReasons.push(`${template.skillKey}:missing_entitlement`);
      continue;
    }
    enabledTemplateSkillIds.add(template.skillId);
  }

  const forceAddSkillIds = new Set(
    overrides.filter((entry) => entry.action === "force_add").map((entry) => entry.skillId),
  );
  const forceRemoveSkillIds = new Set(
    overrides.filter((entry) => entry.action === "force_remove").map((entry) => entry.skillId),
  );

  for (const skillId of forceAddSkillIds) {
    const entitlement = entitlementBySkillId.get(skillId);
    const hasActiveEntitlement = isSkillEntitlementUsable(entitlement?.classification, entitlement);
    if (!hasActiveEntitlement) {
      const skillKey = entitlement?.skillKey || skillId;
      blockedReasons.push(`${skillKey}:force_add_missing_entitlement`);
      continue;
    }
    enabledTemplateSkillIds.add(skillId);
  }

  for (const skillId of forceRemoveSkillIds) {
    enabledTemplateSkillIds.delete(skillId);
  }

  const resolvedEntries = [];
  for (const skillId of enabledTemplateSkillIds) {
    const entitlement = entitlementBySkillId.get(skillId);
    const version = resolveSkillVersionForEntitlement(db, entitlement);
    if (!entitlement || !version) {
      blockedReasons.push(`${entitlement?.skillKey || skillId}:version_unresolved`);
      continue;
    }
    resolvedEntries.push({
      skillId,
      skillKey: entitlement.skillKey,
      versionId: version.id,
      version,
      entitlement,
    });
  }

  return {
    resolvedEntries: resolvedEntries.sort((left, right) =>
      left.skillKey.localeCompare(right.skillKey),
    ),
    blockedReasons: [...new Set(blockedReasons)].sort((left, right) => left.localeCompare(right)),
    templateRows: templates,
    overrideRows: overrides,
    entitlementRows: entitlements,
  };
}

function createResolvedSkillError(blockedReasons = []) {
  const uniqueReasons = [
    ...new Set((blockedReasons || []).map((entry) => String(entry || "").trim()).filter(Boolean)),
  ];
  const error = new Error("tenant_agent_skills_blocked");
  error.code = "tenant_agent_skills_blocked";
  error.blockedReasons = uniqueReasons;
  error.missingSkills = uniqueReasons
    .map((entry) =>
      String(entry || "")
        .split(":")[0]
        ?.trim(),
    )
    .filter(Boolean);
  return error;
}

function updatePlatformSkillAffectedTenantCounts(db, skillId) {
  const normalizedSkillId = String(skillId || "").trim();
  if (!normalizedSkillId) {
    return;
  }
  const affectedTenantCount = Number(
    getScalar(
      db,
      `SELECT COUNT(DISTINCT ta.tenant_id) AS value
         FROM tenant_agent_skill_templates tats
         JOIN tenant_agents ta ON ta.id = tats.tenant_agent_id
        WHERE tats.skill_id = ?`,
      [normalizedSkillId],
    ) || 0,
  );
  db.prepare(
    `UPDATE platform_skills
        SET affected_tenant_count = @affectedTenantCount,
            updated_at = @updatedAt
      WHERE id = @skillId`,
  ).run({
    skillId: normalizedSkillId,
    affectedTenantCount,
    updatedAt: nowIso(),
  });
}

function listActiveAssignmentsForTenantAgent(db, tenantAgentId) {
  const normalizedTenantAgentId = String(tenantAgentId || "").trim();
  if (!normalizedTenantAgentId) {
    return [];
  }
  return db
    .prepare(
      `SELECT id,
              tenant_id AS tenantId,
              user_id AS userId,
              tenant_agent_id AS tenantAgentId,
              derived_agent_id AS derivedAgentId,
              derived_workspace_dir AS derivedWorkspaceDir,
              status
         FROM user_agent_assignments
        WHERE tenant_agent_id = ?
          AND status IN ('active', 'blocked_missing_skills')
        ORDER BY created_at ASC`,
    )
    .all(normalizedTenantAgentId)
    .map((row) => ({
      id: String(row?.id || "").trim(),
      tenantId: String(row?.tenantId || "").trim(),
      userId: String(row?.userId || "").trim(),
      tenantAgentId: String(row?.tenantAgentId || "").trim(),
      derivedAgentId: String(row?.derivedAgentId || "").trim(),
      derivedWorkspaceDir: String(row?.derivedWorkspaceDir || "").trim(),
      status: normalizeAssignmentStatus(row?.status),
    }))
    .filter((row) => row.id);
}

function setAssignmentStatus(db, params = {}) {
  const assignmentId = String(params.assignmentId || "").trim();
  const status = normalizeAssignmentStatus(params.status);
  if (!assignmentId) {
    return;
  }
  db.prepare(
    `UPDATE user_agent_assignments
        SET status = @status,
            derived_agent_id = @derivedAgentId,
            derived_workspace_dir = @derivedWorkspaceDir
      WHERE id = @assignmentId`,
  ).run({
    assignmentId,
    status,
    derivedAgentId: String(params.derivedAgentId || "").trim() || null,
    derivedWorkspaceDir: String(params.derivedWorkspaceDir || "").trim() || null,
  });
}

function reconcileTenantAgentAssignments(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const tenantAgentId = String(params.tenantAgentId || "").trim();
  const baseAgentId = String(params.baseAgentId || "").trim();
  if (!tenantId || !tenantAgentId || !baseAgentId) {
    return {
      blockedAssignmentCount: 0,
      activeAssignmentCount: 0,
      blockedAssignmentIds: [],
      activeAssignmentIds: [],
    };
  }
  const assignments = listActiveAssignmentsForTenantAgent(db, tenantAgentId);
  const blockedAssignmentIds = [];
  const activeAssignmentIds = [];
  for (const assignment of assignments) {
    const derivedAgentId =
      String(assignment?.derivedAgentId || "").trim() ||
      deriveTenantMemberAgentId({
        tenantId,
        userId: assignment.userId,
        tenantAgentId,
        baseAgentId,
      });
    const resolved = resolveAssignmentSkillState(db, {
      tenantId,
      tenantAgentId,
      assignmentId: assignment.id,
      baseAgentId,
      configPath: params.configPath,
      configDir: params.configDir,
    });
    if (resolved.blockedReasons.length) {
      setAssignmentStatus(db, {
        assignmentId: assignment.id,
        status: ASSIGNMENT_STATUS_BLOCKED_MISSING_SKILLS,
        derivedAgentId,
        derivedWorkspaceDir:
          String(assignment.derivedWorkspaceDir || "").trim() ||
          buildDerivedAgentWorkspacePath({
            ...params,
            tenantId,
            userId: assignment.userId,
            tenantAgentId,
            baseAgentId,
            derivedAgentId,
          }),
      });
      upsertTenantAgentSkillSnapshot(db, {
        assignmentId: assignment.id,
        tenantId,
        tenantAgentId,
        userId: assignment.userId,
        derivedAgentId,
        resolvedSkillKeys: resolved.resolvedEntries.map((entry) => entry.skillKey),
        resolvedVersionIds: resolved.resolvedEntries.map((entry) => entry.versionId),
        blockedReasons: resolved.blockedReasons,
      });
      blockedAssignmentIds.push(assignment.id);
      continue;
    }
    const workspace = ensureTenantDerivedWorkspace({
      db,
      tenantId,
      userId: assignment.userId,
      tenantAgentId,
      baseAgentId,
      derivedAgentId,
      assignmentId: assignment.id,
      configPath: params.configPath,
      configDir: params.configDir,
    });
    setAssignmentStatus(db, {
      assignmentId: assignment.id,
      status: ASSIGNMENT_STATUS_ACTIVE,
      derivedAgentId,
      derivedWorkspaceDir: workspace.canonicalWorkspace,
    });
    syncDerivedAgentRuntimeConfigEntry({
      baseAgentId,
      derivedAgentId,
      skills: workspace.resolvedSkillKeys,
      configPath: params.configPath,
      configDir: params.configDir,
    });
    upsertTenantAgentSkillSnapshot(db, {
      assignmentId: assignment.id,
      tenantId,
      tenantAgentId,
      userId: assignment.userId,
      derivedAgentId,
      resolvedSkillKeys: workspace.resolvedSkillKeys,
      resolvedVersionIds: workspace.resolvedVersionIds,
      blockedReasons: workspace.blockedReasons,
    });
    activeAssignmentIds.push(assignment.id);
  }
  return {
    blockedAssignmentCount: blockedAssignmentIds.length,
    activeAssignmentCount: activeAssignmentIds.length,
    blockedAssignmentIds,
    activeAssignmentIds,
  };
}

function reconcileTenantAgentSkillState(db, params = {}) {
  const tenantAgentId = String(params.tenantAgentId || "").trim();
  if (!tenantAgentId) {
    return {
      tenantAgentId: "",
      blockedSkillKeys: [],
      blockedAssignmentCount: 0,
      activeAssignmentCount: 0,
    };
  }
  const tenantAgent = db
    .prepare(
      `SELECT id,
              tenant_id AS tenantId,
              agent_id AS baseAgentId
         FROM tenant_agents
        WHERE id = ?
        LIMIT 1`,
    )
    .get(tenantAgentId);
  if (!tenantAgent?.id) {
    return {
      tenantAgentId,
      blockedSkillKeys: [],
      blockedAssignmentCount: 0,
      activeAssignmentCount: 0,
    };
  }
  const tenantId = String(tenantAgent.tenantId || "").trim();
  const baseAgentId = String(tenantAgent.baseAgentId || "").trim();
  ensureTenantBundledSkillState(db, {
    ...params,
    tenantId,
    tenantAgentId,
    baseAgentId,
  });
  const entitlements = listTenantSkillEntitlementsInternal(db, tenantId);
  const entitlementBySkillId = new Map(entitlements.map((entry) => [entry.skillId, entry]));
  const templates = listTenantAgentSkillTemplates(db, tenantAgentId);
  const blockedSkillKeys = [];
  for (const template of templates) {
    const entitlement = entitlementBySkillId.get(template.skillId);
    const classification = normalizeSkillClassification(template.classification);
    const shouldBeBlocked =
      classification !== SKILL_CLASS_BUNDLED &&
      !isSkillEntitlementUsable(classification, entitlement);
    const nextTemplateState = shouldBeBlocked
      ? SKILL_TEMPLATE_STATE_BLOCKED
      : template.templateState === SKILL_TEMPLATE_STATE_BLOCKED
        ? SKILL_TEMPLATE_STATE_ENABLED
        : template.templateState;
    if (nextTemplateState !== template.templateState) {
      ensureTenantAgentSkillTemplate(db, {
        tenantAgentId,
        skillId: template.skillId,
        templateState: nextTemplateState,
        sourceType: template.sourceType,
      });
    }
    if (nextTemplateState === SKILL_TEMPLATE_STATE_BLOCKED) {
      blockedSkillKeys.push(template.skillKey);
    }
    updatePlatformSkillAffectedTenantCounts(db, template.skillId);
  }
  const reconcileResult = reconcileTenantAgentAssignments(db, {
    ...params,
    tenantId,
    tenantAgentId,
    baseAgentId,
  });
  return {
    tenantAgentId,
    tenantId,
    baseAgentId,
    blockedSkillKeys: [...new Set(blockedSkillKeys)].sort((left, right) =>
      left.localeCompare(right),
    ),
    blockedAssignmentCount: reconcileResult.blockedAssignmentCount,
    activeAssignmentCount: reconcileResult.activeAssignmentCount,
    blockedAssignmentIds: reconcileResult.blockedAssignmentIds,
    activeAssignmentIds: reconcileResult.activeAssignmentIds,
  };
}

function reconcileTenantSkillAcrossTenantAgents(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const skillId = String(params.skillId || "").trim();
  if (!tenantId || !skillId) {
    return [];
  }
  const tenantAgentIds = db
    .prepare(
      `SELECT DISTINCT ta.id
         FROM tenant_agents ta
         LEFT JOIN tenant_agent_skill_templates tats ON tats.tenant_agent_id = ta.id
        WHERE ta.tenant_id = ?
          AND (
            tats.skill_id = ?
            OR ta.id IN (
              SELECT ua.tenant_agent_id
                FROM user_agent_skill_overrides ua
               WHERE ua.skill_id = ?
            )
          )
        ORDER BY ta.created_at ASC`,
    )
    .all(tenantId, skillId, skillId)
    .map((row) => String(row?.id || "").trim())
    .filter(Boolean);
  return tenantAgentIds.map((tenantAgentId) =>
    reconcileTenantAgentSkillState(db, {
      ...params,
      tenantAgentId,
    }),
  );
}

export function listPlatformSkills(db, params = {}) {
  return listPlatformSkillsInternal(db, params);
}

export function listTenantSkillsMarket(db, tenantId, params = {}) {
  return listTenantSkillsMarketInternal(db, tenantId, params);
}

export function listTenantSkillEntitlements(db, tenantId) {
  return listTenantSkillEntitlementsInternal(db, tenantId);
}

export function listTenantSkillAssignments(db, tenantId) {
  return listTenantSkillAssignmentsInternal(db, tenantId);
}

export function savePlatformSkill(db, params = {}) {
  const skillKey = normalizeSkillKey(params.skillKey);
  const skillMdContent = String(params.skillMdContent || "").trim();
  if (!skillKey) {
    throw new Error("skill_key_required");
  }
  if (!skillMdContent) {
    throw new Error("skill_md_content_required");
  }
  const now = nowIso();
  const skill = upsertPlatformSkillCatalogEntry(db, {
    skillKey,
    name: params.name,
    description: params.description,
    classification: params.classification,
    sourceType: params.sourceType || "managed",
    sourceRoot: String(params.sourceRoot || "managed").trim() || "managed",
    sourceWorkspaceDir: String(params.sourceWorkspaceDir || "").trim() || null,
    status: String(params.status || "active").trim() || "active",
    pricePoints: params.pricePoints,
    compatibleBaseAgents: params.compatibleBaseAgents,
  });
  const versionHash = computeStableTextHash(skillMdContent);
  const version = upsertPlatformSkillVersion(db, {
    ...params,
    skillId: skill.id,
    skillKey,
    versionHash,
    versionLabel:
      String(params.versionLabel || "").trim() ||
      `${normalizeSkillClassification(params.classification)}-${versionHash.slice(0, 12)}`,
    skillMdContent,
    skillMetadata: {
      savedAt: now,
      managed: true,
    },
  });
  ensurePlatformSkillAgentBindings(
    db,
    skill.id,
    Array.isArray(params.compatibleBaseAgents)
      ? params.compatibleBaseAgents
      : [SKILL_CATALOG_COMPATIBLE_ANY],
  );
  updatePlatformSkillAffectedTenantCounts(db, skill.id);
  return {
    skill: getPlatformSkillByKey(db, skillKey),
    version,
  };
}

export function discoverPlatformSkills(db, params = {}) {
  const configAgents = Array.isArray(params.configAgents) ? params.configAgents : [];
  const discovered = [];
  for (const agent of configAgents) {
    const baseAgentId = String(agent?.id || "").trim();
    if (!baseAgentId) {
      continue;
    }
    const entries = discoverBundledSkillsForBaseAgent(db, {
      ...params,
      baseAgentId,
    });
    discovered.push(...entries);
  }
  return discovered;
}

export function reclassifyPlatformSkill(db, params = {}) {
  const skillId = String(params.skillId || "").trim();
  if (!skillId) {
    throw new Error("skill_id_required");
  }
  const existing = db
    .prepare(`SELECT skill_key AS skillKey FROM platform_skills WHERE id = ? LIMIT 1`)
    .get(skillId);
  if (!existing?.skillKey) {
    throw new Error("platform_skill_not_found");
  }
  db.prepare(
    `UPDATE platform_skills
        SET classification = @classification,
            price_points = @pricePoints,
            status = @status,
            updated_at = @updatedAt
      WHERE id = @skillId`,
  ).run({
    skillId,
    classification: normalizeSkillClassification(params.classification),
    pricePoints: normalizeNonNegativePoints(params.pricePoints),
    status: String(params.status || "active").trim() || "active",
    updatedAt: nowIso(),
  });
  const tenantIds = db
    .prepare(
      `SELECT DISTINCT tenant_id AS tenantId
         FROM tenant_skill_entitlements
        WHERE skill_id = ?`,
    )
    .all(skillId)
    .map((row) => String(row?.tenantId || "").trim())
    .filter(Boolean);
  for (const tenantId of tenantIds) {
    const entitlement = listTenantSkillEntitlementsInternal(db, tenantId).find(
      (entry) => entry.skillId === skillId,
    );
    const classification = normalizeSkillClassification(params.classification);
    if (classification === SKILL_CLASS_BUNDLED) {
      ensureTenantSkillEntitlement(db, {
        tenantId,
        skillId,
        status: SKILL_ENTITLEMENT_ACTIVE,
        acquireType: "bundled",
        versionPolicy: "latest",
        currentVersionId:
          entitlement?.currentVersionId ||
          getPlatformSkillByKey(db, existing.skillKey)?.latestVersionId,
        enabledByTenant: true,
      });
    } else if (
      classification === SKILL_CLASS_FREE &&
      entitlement?.status === SKILL_ENTITLEMENT_PENDING
    ) {
      ensureTenantSkillEntitlement(db, {
        tenantId,
        skillId,
        status: SKILL_ENTITLEMENT_DISABLED,
        acquireType: "free_enable",
        versionPolicy: entitlement?.versionPolicy || "latest",
        currentVersionId: entitlement?.currentVersionId,
        enabledByTenant: false,
      });
    } else if (
      classification === SKILL_CLASS_PAID &&
      (!entitlement || entitlement.status !== SKILL_ENTITLEMENT_ACTIVE)
    ) {
      ensureTenantSkillEntitlement(db, {
        tenantId,
        skillId,
        status: SKILL_ENTITLEMENT_DISABLED,
        acquireType: "paid_order",
        versionPolicy: entitlement?.versionPolicy || "latest",
        currentVersionId: entitlement?.currentVersionId,
        enabledByTenant: false,
        blockedReason: "reclassified_to_paid",
      });
    }
    reconcileTenantSkillAcrossTenantAgents(db, {
      ...params,
      tenantId,
      skillId,
    });
  }
  updatePlatformSkillAffectedTenantCounts(db, skillId);
  return getPlatformSkillByKey(db, existing.skillKey);
}

export function resyncPlatformSkill(db, params = {}) {
  const skillId = String(params.skillId || "").trim();
  if (!skillId) {
    throw new Error("skill_id_required");
  }
  const skill = db
    .prepare(
      `SELECT id,
              skill_key AS skillKey,
              source_type AS sourceType,
              source_root AS sourceRoot,
              source_workspace_dir AS sourceWorkspaceDir
         FROM platform_skills
        WHERE id = ?
        LIMIT 1`,
    )
    .get(skillId);
  if (!skill?.id) {
    throw new Error("platform_skill_not_found");
  }
  if (String(skill.sourceType || "").trim() === "workspace") {
    const baseAgentIds = db
      .prepare(
        `SELECT base_agent_id AS baseAgentId
           FROM platform_skill_agent_bindings
          WHERE skill_id = ? AND status = 'active'
          ORDER BY created_at ASC`,
      )
      .all(skillId)
      .map((row) => String(row?.baseAgentId || "").trim())
      .filter(Boolean);
    for (const baseAgentId of baseAgentIds) {
      discoverBundledSkillsForBaseAgent(db, {
        ...params,
        baseAgentId,
      });
    }
  }
  const tenantIds = db
    .prepare(
      `SELECT DISTINCT tenant_id AS tenantId
         FROM tenant_skill_entitlements
        WHERE skill_id = ?`,
    )
    .all(skillId)
    .map((row) => String(row?.tenantId || "").trim())
    .filter(Boolean);
  for (const tenantId of tenantIds) {
    const entitlement = listTenantSkillEntitlementsInternal(db, tenantId).find(
      (entry) => entry.skillId === skillId,
    );
    if (entitlement?.versionPolicy === "latest") {
      ensureTenantSkillEntitlement(db, {
        tenantId,
        skillId,
        status: entitlement.status,
        acquireType: entitlement.acquireType,
        versionPolicy: "latest",
        currentVersionId: getPlatformSkillByKey(db, skill.skillKey)?.latestVersionId,
        enabledByTenant: entitlement.enabledByTenant,
        blockedReason: entitlement.blockedReason,
        orderId: entitlement.orderId,
      });
    }
    reconcileTenantSkillAcrossTenantAgents(db, {
      ...params,
      tenantId,
      skillId,
    });
  }
  updatePlatformSkillAffectedTenantCounts(db, skillId);
  return getPlatformSkillByKey(db, skill.skillKey);
}

export function listPlatformSkillVersions(db, skillId) {
  const normalizedSkillId = String(skillId || "").trim();
  if (!normalizedSkillId) {
    throw new Error("skill_id_required");
  }
  return db
    .prepare(
      `SELECT id,
              skill_id AS skillId,
              version_label AS versionLabel,
              version_hash AS versionHash,
              skill_md_path AS skillMdPath,
              skill_md_content AS skillMdContent,
              skill_metadata_json AS skillMetadataJson,
              status,
              created_at AS createdAt,
              updated_at AS updatedAt
         FROM platform_skill_versions
        WHERE skill_id = ?
        ORDER BY created_at DESC`,
    )
    .all(normalizedSkillId)
    .map(mapPlatformSkillVersionRow)
    .filter(Boolean);
}

export function createTenantSkillOrder(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const skillId = String(params.skillId || "").trim();
  if (!tenantId || !skillId) {
    throw new Error("tenant_skill_order_missing_fields");
  }
  const skill = db
    .prepare(
      `SELECT id,
              classification,
              price_points AS pricePoints,
              latest_version_id AS latestVersionId
         FROM platform_skills
        WHERE id = ?
        LIMIT 1`,
    )
    .get(skillId);
  if (!skill?.id) {
    throw new Error("platform_skill_not_found");
  }
  const classification = normalizeSkillClassification(skill.classification);
  if (classification === SKILL_CLASS_FREE) {
    return ensureTenantSkillEntitlement(db, {
      tenantId,
      skillId,
      status: SKILL_ENTITLEMENT_ACTIVE,
      acquireType: "free_enable",
      versionPolicy: "latest",
      currentVersionId: String(skill.latestVersionId || "").trim() || null,
      enabledByTenant: true,
      blockedReason: null,
    });
  }
  if (classification !== SKILL_CLASS_PAID) {
    throw new Error("skill_order_only_for_paid_skill");
  }
  const existing = db
    .prepare(
      `SELECT id
         FROM tenant_skill_orders
        WHERE tenant_id = ? AND skill_id = ? AND order_status = ?
        ORDER BY created_at DESC
        LIMIT 1`,
    )
    .get(tenantId, skillId, SKILL_ORDER_PENDING_CONFIRMATION);
  if (existing?.id) {
    return getTenantSkillOrderById(db, existing.id);
  }
  return createTenantSkillOrderRecord(db, {
    tenantId,
    skillId,
    orderStatus: SKILL_ORDER_PENDING_CONFIRMATION,
    acquireType: "paid_order",
    amountPoints: skill.pricePoints,
    versionPolicy: "latest",
    currentVersionId: String(skill.latestVersionId || "").trim() || null,
    createdByUserId: params.createdByUserId,
  });
}

export function confirmTenantSkillOrder(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const orderId = String(params.orderId || "").trim();
  const actorUserId = String(params.actorUserId || "").trim();
  if (!tenantId || !orderId) {
    throw new Error("tenant_skill_order_missing_fields");
  }
  return runInTransaction(db, () => {
    const order = getTenantSkillOrderById(db, orderId);
    if (!order || order.tenantId !== tenantId) {
      throw new Error("tenant_skill_order_not_found");
    }
    if (order.orderStatus === SKILL_ORDER_CONFIRMED) {
      return {
        confirmed: false,
        alreadyConfirmed: true,
        order,
        entitlement:
          listTenantSkillEntitlementsInternal(db, tenantId).find(
            (entry) => entry.orderId === order.id || entry.skillId === order.skillId,
          ) || null,
        walletBalance: getTenantWalletBalance(db, tenantId),
      };
    }
    const walletBalanceBefore = getTenantWalletBalance(db, tenantId);
    if (walletBalanceBefore < order.amountPoints) {
      throw new Error("insufficient_wallet_balance");
    }
    const walletBalanceAfter = normalizeNonNegativePoints(walletBalanceBefore - order.amountPoints);
    const updatedAt = nowIso();
    const validActorUserId = actorUserId
      ? String(
          getScalar(db, `SELECT id AS value FROM users WHERE id = ? LIMIT 1`, [actorUserId]) || "",
        ).trim() || null
      : null;
    db.prepare(
      `UPDATE tenant_wallets
          SET balance_points = @balancePoints,
              updated_at = @updatedAt
        WHERE tenant_id = @tenantId`,
    ).run({
      tenantId,
      balancePoints: walletBalanceAfter,
      updatedAt,
    });
    db.prepare(
      `UPDATE tenant_skill_orders
          SET order_status = @orderStatus,
              confirmed_by_user_id = @confirmedByUserId,
              confirmed_at = @confirmedAt,
              updated_at = @updatedAt
        WHERE id = @orderId`,
    ).run({
      orderId,
      orderStatus: SKILL_ORDER_CONFIRMED,
      confirmedByUserId: validActorUserId,
      confirmedAt: updatedAt,
      updatedAt,
    });
    db.prepare(
      `INSERT INTO tenant_wallet_ledger (
         id,
         tenant_id,
         direction,
         category,
         amount_points,
         balance_after,
         actor_user_id,
         note,
         created_at
       ) VALUES (
         @id,
         @tenantId,
         'debit',
         'skill_purchase',
         @amountPoints,
         @balanceAfter,
         @actorUserId,
         @note,
         @createdAt
       )`,
    ).run({
      id: createId("ledger"),
      tenantId,
      amountPoints: order.amountPoints,
      balanceAfter: walletBalanceAfter,
      actorUserId: validActorUserId,
      note: `skill_purchase:${order.id}:${order.skillKey}`,
      createdAt: updatedAt,
    });
    const entitlement = ensureTenantSkillEntitlement(db, {
      tenantId,
      skillId: order.skillId,
      status: SKILL_ENTITLEMENT_ACTIVE,
      acquireType: order.acquireType,
      versionPolicy: order.versionPolicy,
      currentVersionId: order.currentVersionId || order.latestVersionId,
      enabledByTenant: true,
      blockedReason: null,
      orderId: order.id,
    });
    reconcileTenantSkillAcrossTenantAgents(db, {
      ...params,
      tenantId,
      skillId: order.skillId,
    });
    updatePlatformSkillAffectedTenantCounts(db, order.skillId);
    return {
      confirmed: true,
      alreadyConfirmed: false,
      order: getTenantSkillOrderById(db, orderId),
      entitlement,
      walletBalance: getTenantWalletBalance(db, tenantId),
    };
  });
}

export function setTenantSkillEntitlementEnabled(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const entitlementId = String(params.entitlementId || "").trim();
  if (!tenantId || !entitlementId) {
    throw new Error("tenant_skill_entitlement_missing_fields");
  }
  const entitlement = listTenantSkillEntitlementsInternal(db, tenantId).find(
    (entry) => entry.id === entitlementId,
  );
  if (!entitlement) {
    throw new Error("tenant_skill_entitlement_not_found");
  }
  const classification = normalizeSkillClassification(entitlement.classification);
  const enabledByTenant = Boolean(params.enabledByTenant);
  const status =
    classification === SKILL_CLASS_FREE
      ? enabledByTenant
        ? SKILL_ENTITLEMENT_ACTIVE
        : SKILL_ENTITLEMENT_DISABLED
      : classification === SKILL_CLASS_BUNDLED
        ? SKILL_ENTITLEMENT_ACTIVE
        : entitlement.status;
  const updatedEntitlement = ensureTenantSkillEntitlement(db, {
    tenantId,
    skillId: entitlement.skillId,
    status,
    acquireType:
      classification === SKILL_CLASS_FREE ? "free_enable" : entitlement.acquireType || "bundled",
    versionPolicy: entitlement.versionPolicy || "latest",
    currentVersionId: entitlement.currentVersionId || entitlement.latestVersionId,
    enabledByTenant,
    blockedReason: enabledByTenant ? null : entitlement.blockedReason,
    orderId: entitlement.orderId,
  });
  reconcileTenantSkillAcrossTenantAgents(db, {
    ...params,
    tenantId,
    skillId: entitlement.skillId,
  });
  updatePlatformSkillAffectedTenantCounts(db, entitlement.skillId);
  return updatedEntitlement;
}

export function saveTenantAgentSkillTemplateSet(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const tenantAgentId = String(params.tenantAgentId || "").trim();
  const skillKeys = Array.isArray(params.skillKeys)
    ? [...new Set(params.skillKeys.map((entry) => normalizeSkillKey(entry)).filter(Boolean))]
    : [];
  if (!tenantId || !tenantAgentId) {
    throw new Error("tenant_agent_skill_template_missing_fields");
  }
  const tenantAgent = db
    .prepare(
      `SELECT id,
              tenant_id AS tenantId,
              agent_id AS baseAgentId
         FROM tenant_agents
        WHERE id = ?
        LIMIT 1`,
    )
    .get(tenantAgentId);
  if (!tenantAgent?.id || String(tenantAgent.tenantId || "").trim() !== tenantId) {
    throw new Error("tenant_agent_not_found");
  }
  ensureTenantBundledSkillState(db, {
    ...params,
    tenantId,
    tenantAgentId,
    baseAgentId: String(tenantAgent.baseAgentId || "").trim(),
  });
  const availableTemplates = listTenantAgentSkillTemplates(db, tenantAgentId);
  const templateBySkillKey = new Map(availableTemplates.map((entry) => [entry.skillKey, entry]));
  const sourceTypeBySkillId = new Map(
    availableTemplates.map((entry) => [entry.skillId, entry.sourceType]),
  );
  for (const template of availableTemplates) {
    const nextState = skillKeys.includes(template.skillKey)
      ? template.templateState === SKILL_TEMPLATE_STATE_BLOCKED
        ? SKILL_TEMPLATE_STATE_BLOCKED
        : SKILL_TEMPLATE_STATE_ENABLED
      : SKILL_TEMPLATE_STATE_DISABLED;
    ensureTenantAgentSkillTemplate(db, {
      tenantAgentId,
      skillId: template.skillId,
      templateState: nextState,
      sourceType: template.sourceType,
    });
  }
  for (const skillKey of skillKeys) {
    if (templateBySkillKey.has(skillKey)) {
      continue;
    }
    const skill = getPlatformSkillByKey(db, skillKey);
    if (!skill?.id) {
      throw new Error(`platform_skill_not_found:${skillKey}`);
    }
    ensureTenantAgentSkillTemplate(db, {
      tenantAgentId,
      skillId: skill.id,
      templateState: SKILL_TEMPLATE_STATE_ENABLED,
      sourceType: sourceTypeBySkillId.get(skill.id) || "tenant_added",
    });
  }
  const result = reconcileTenantAgentSkillState(db, {
    ...params,
    tenantId,
    tenantAgentId,
    baseAgentId: String(tenantAgent.baseAgentId || "").trim(),
  });
  for (const template of listTenantAgentSkillTemplates(db, tenantAgentId)) {
    updatePlatformSkillAffectedTenantCounts(db, template.skillId);
  }
  return {
    tenantAgentId,
    templateRows: listTenantAgentSkillTemplates(db, tenantAgentId),
    blockedSkillKeys: result.blockedSkillKeys,
    blockedAssignmentCount: result.blockedAssignmentCount,
  };
}

export function saveUserAgentSkillOverrideSet(db, params = {}) {
  const assignmentId = String(params.assignmentId || "").trim();
  const overrideEntries = Array.isArray(params.overrides) ? params.overrides : [];
  if (!assignmentId) {
    throw new Error("assignment_id_required");
  }
  const assignment = db
    .prepare(
      `SELECT id,
              tenant_id AS tenantId,
              user_id AS userId,
              tenant_agent_id AS tenantAgentId,
              derived_agent_id AS derivedAgentId
         FROM user_agent_assignments
        WHERE id = ?
        LIMIT 1`,
    )
    .get(assignmentId);
  if (!assignment?.id) {
    throw new Error("assignment_not_found");
  }
  const tenantAgent = db
    .prepare(
      `SELECT agent_id AS baseAgentId
         FROM tenant_agents
        WHERE id = ?
        LIMIT 1`,
    )
    .get(assignment.tenantAgentId);
  if (!tenantAgent?.baseAgentId) {
    throw new Error("tenant_agent_not_found");
  }
  const normalizedOverrides = overrideEntries
    .map((entry) => {
      const action = normalizeSkillOverrideAction(entry?.action);
      const skillKey = normalizeSkillKey(entry?.skillKey);
      const skillId =
        String(entry?.skillId || "").trim() || getPlatformSkillByKey(db, skillKey)?.id || "";
      if (!action || !skillId) {
        return null;
      }
      return {
        skillId,
        action,
      };
    })
    .filter(Boolean);
  setUserAgentSkillOverrides(db, {
    assignmentId,
    tenantAgentId: assignment.tenantAgentId,
    userId: assignment.userId,
    overrides: normalizedOverrides,
  });
  const result = reconcileTenantAgentSkillState(db, {
    ...params,
    tenantId: String(assignment.tenantId || "").trim(),
    tenantAgentId: String(assignment.tenantAgentId || "").trim(),
    baseAgentId: String(tenantAgent.baseAgentId || "").trim(),
  });
  const refreshedOverrides = listUserAgentSkillOverrides(db, assignmentId);
  return {
    assignmentId,
    overrideRows: refreshedOverrides,
    blockedAssignmentIds: result.blockedAssignmentIds,
    activeAssignmentIds: result.activeAssignmentIds,
  };
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

function writeOpenClawConfig(configPath, payload) {
  const nextPayload =
    payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(nextPayload, null, 2)}\n`, "utf8");
}

function cloneJsonValue(value) {
  if (value === null || value === undefined) {
    return value ?? null;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function mapDataSourceRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: String(row.id || "").trim(),
    name: String(row.name || "").trim(),
    sourceType: String((row.sourceType ?? row.source_type) || "").trim(),
    status: normalizeDataSourceStatus(row.status),
    connectionJson: parseJsonObject(row.connectionJson ?? row.connection_json),
    sourceDbid: String((row.sourceDbid ?? row.source_dbid) || "").trim() || null,
    sourceTenantCode: String((row.sourceTenantCode ?? row.source_tenant_code) || "").trim() || null,
    k3cloudProfileJson: parseJsonObject(row.k3cloudProfileJson ?? row.k3cloud_profile_json),
    createdAt: String((row.createdAt ?? row.created_at) || "").trim(),
    updatedAt: String((row.updatedAt ?? row.updated_at) || "").trim(),
  };
}

function mapTenantDataSourceBindingRow(row) {
  if (!row) {
    return null;
  }
  return {
    tenantId: String((row.tenantId ?? row.tenant_id) || "").trim(),
    dataSourceId: String((row.dataSourceId ?? row.data_source_id) || "").trim(),
    dataSourceName: String((row.dataSourceName ?? row.data_source_name) || "").trim(),
    createdAt: String((row.createdAt ?? row.created_at) || "").trim(),
    updatedAt: String((row.updatedAt ?? row.updated_at) || "").trim(),
  };
}

function inferLegacyDataSourceTenantMetadata(dataSource) {
  const connection = cloneJsonValue(dataSource?.connectionJson);
  const profile = cloneJsonValue(dataSource?.k3cloudProfileJson);
  const profileTenant = profile?.tenant && typeof profile.tenant === "object" ? profile.tenant : {};
  return {
    sourceType:
      String(dataSource?.sourceType || "").trim() ||
      String(connection?.sourceType || "").trim() ||
      "kingdee_analytics",
    sourceDbid:
      String(dataSource?.sourceDbid || "").trim() ||
      String(connection?.sourceDbid || "").trim() ||
      String(profileTenant?.dbid || "").trim() ||
      null,
    sourceTenantCode:
      String(dataSource?.sourceTenantCode || "").trim() ||
      String(connection?.sourceTenantCode || "").trim() ||
      String(profileTenant?.tenantId || "").trim() ||
      String(profileTenant?.code || "").trim() ||
      "demo-tenant",
  };
}

function ensureDataSourceLegacyMetadata(db, dataSourceId) {
  const dataSource = getDataSourceById(db, dataSourceId);
  if (!dataSource) {
    return null;
  }
  const inferred = inferLegacyDataSourceTenantMetadata(dataSource);
  const needsUpdate =
    String(dataSource.sourceType || "").trim() !== inferred.sourceType ||
    String(dataSource.sourceDbid || "").trim() !== String(inferred.sourceDbid || "").trim() ||
    String(dataSource.sourceTenantCode || "").trim() !==
      String(inferred.sourceTenantCode || "").trim();
  if (!needsUpdate) {
    return dataSource;
  }
  db.prepare(
    `UPDATE data_sources
       SET source_type = @sourceType,
           source_dbid = @sourceDbid,
           source_tenant_code = @sourceTenantCode,
           updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: dataSource.id,
    sourceType: inferred.sourceType,
    sourceDbid: inferred.sourceDbid,
    sourceTenantCode: inferred.sourceTenantCode,
    updatedAt: nowIso(),
  });
  return getDataSourceById(db, dataSourceId);
}

function ensureTenantLegacyDefaultDataSourceBinding(db, tenantId) {
  const normalizedTenantId = String(tenantId || "").trim();
  if (!normalizedTenantId) {
    return null;
  }
  const existing = db
    .prepare(
      `SELECT tenant_id AS tenantId,
              data_source_id AS dataSourceId,
              created_at AS createdAt,
              updated_at AS updatedAt
         FROM tenant_data_source_bindings
        WHERE tenant_id = ?`,
    )
    .get(normalizedTenantId);
  if (existing?.dataSourceId) {
    return getTenantDataSourceBinding(db, normalizedTenantId);
  }
  const activeSources = db
    .prepare(
      `SELECT id
         FROM data_sources
        WHERE COALESCE(status, 'active') = 'active'
        ORDER BY updated_at DESC, created_at DESC, id ASC`,
    )
    .all();
  if (activeSources.length !== 1) {
    return null;
  }
  const onlySourceId = String(activeSources[0]?.id || "").trim();
  if (!onlySourceId) {
    return null;
  }
  ensureDataSourceLegacyMetadata(db, onlySourceId);
  const now = nowIso();
  db.prepare(
    `INSERT INTO tenant_data_source_bindings (
       tenant_id,
       data_source_id,
       created_at,
       updated_at
     ) VALUES (
       @tenantId,
       @dataSourceId,
       @createdAt,
       @updatedAt
     )
     ON CONFLICT(tenant_id) DO UPDATE SET
       data_source_id = excluded.data_source_id,
       updated_at = excluded.updated_at`,
  ).run({
    tenantId: normalizedTenantId,
    dataSourceId: onlySourceId,
    createdAt: now,
    updatedAt: now,
  });
  return getTenantDataSourceBinding(db, normalizedTenantId);
}

function mapTenantSyncScheduleRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: String(row.id || "").trim(),
    tenantId: String((row.tenantId ?? row.tenant_id) || "").trim(),
    dataSourceId: String((row.dataSourceId ?? row.data_source_id) || "").trim(),
    objectCode: String((row.objectCode ?? row.object_code) || "").trim(),
    moduleName: String((row.moduleName ?? row.module_name) || "").trim(),
    derivedWorkspaceDir: String(
      (row.derivedWorkspaceDir ?? row.derived_workspace_dir) || "",
    ).trim(),
    status: normalizeTenantSyncScheduleStatus(row.status),
    intervalMinutes: normalizeTenantSyncIntervalMinutes(
      row.intervalMinutes ?? row.interval_minutes,
    ),
    defaultStart: normalizeDefaultStart(row.defaultStart ?? row.default_start),
    activatedByUserId:
      String((row.activatedByUserId ?? row.activated_by_user_id) || "").trim() || null,
    lastRunAt: String((row.lastRunAt ?? row.last_run_at) || "").trim() || null,
    lastRunStatus: String((row.lastRunStatus ?? row.last_run_status) || "").trim() || null,
    lastRunError: String((row.lastRunError ?? row.last_run_error) || "").trim() || null,
    lastRunDurationMs: row.lastRunDurationMs ?? row.last_run_duration_ms ?? null,
    createdAt: String((row.createdAt ?? row.created_at) || "").trim(),
    updatedAt: String((row.updatedAt ?? row.updated_at) || "").trim(),
  };
}

function buildTenantAnalyticsConnectionProfile(db, tenantId) {
  const binding = getTenantDataSourceBinding(db, tenantId);
  if (!binding?.dataSourceId) {
    return null;
  }
  const dataSource = getDataSourceById(db, binding.dataSourceId);
  const connection = dataSource?.connectionJson;
  if (!connection || typeof connection !== "object") {
    return null;
  }
  return {
    ...connection,
    dataSourceId: dataSource.id,
    dataSourceName: dataSource.name,
    tenantId: String(tenantId || "").trim(),
    bridgeHost: DEFAULT_KINGDEE_BRIDGE_HOST,
    bridgeUser: DEFAULT_KINGDEE_BRIDGE_USER,
    sshKeyPath: DEFAULT_KINGDEE_SSH_KEY_PATH,
    timeoutSeconds: DEFAULT_KINGDEE_BRIDGE_TIMEOUT_SECONDS,
    analyticsProjectRoot:
      String(connection.analyticsProjectRoot || "").trim() ||
      DEFAULT_KINGDEE_ANALYTICS_PROJECT_ROOT,
    analyticsPython:
      String(connection.analyticsPython || "").trim() || DEFAULT_KINGDEE_ANALYTICS_PYTHON,
    analyticsPgDsn:
      String(connection.analyticsPgDsn || connection.pgDsn || connection.dsn || "").trim() || null,
    catalogRoot:
      String(connection.catalogRoot || "").trim() || DEFAULT_KINGDEE_OPENAPI_CATALOG_ROOT,
    tenantPlatformDbPath:
      String(connection.tenantPlatformDbPath || "").trim() || DEFAULT_TENANT_PLATFORM_DB_PATH,
  };
}

function getDerivedAgentK3CloudProfile(db, tenantId) {
  if (!tenantId) {
    return null;
  }
  const binding = getTenantDataSourceBinding(db, tenantId);
  if (!binding?.dataSourceId) {
    return null;
  }
  const dataSource = getDataSourceById(db, binding.dataSourceId);
  return dataSource?.k3cloudProfileJson ?? null;
}

function hasKingdeeAnalyticsSkillWorkspace(workspaceDir) {
  const normalizedWorkspaceDir = String(workspaceDir || "").trim();
  if (!normalizedWorkspaceDir) {
    return false;
  }
  const skillDir = path.join(normalizedWorkspaceDir, "skills", "kingdee-analytics-ops");
  try {
    return fs.existsSync(skillDir) && fs.statSync(skillDir).isDirectory();
  } catch {
    return false;
  }
}

function syncDerivedAgentTenantAnalyticsProfile(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const workspaceDir = String(params.workspaceDir || params.derivedWorkspaceDir || "").trim();
  if (!tenantId || !workspaceDir || !hasKingdeeAnalyticsSkillWorkspace(workspaceDir)) {
    return false;
  }
  const profile = buildTenantAnalyticsConnectionProfile(db, tenantId);
  if (!profile) {
    return false;
  }
  const referencesDir = path.join(workspaceDir, "skills", "kingdee-analytics-ops", "references");
  const targetPath = path.join(referencesDir, "tenant-analytics-connection.json");
  return writeJsonFileIfChanged(targetPath, profile);
}

function syncDerivedAgentK3CloudProfile(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const workspaceDir = String(params.workspaceDir || params.derivedWorkspaceDir || "").trim();
  if (!tenantId || !workspaceDir || !hasKingdeeAnalyticsSkillWorkspace(workspaceDir)) {
    return false;
  }
  const profile = getDerivedAgentK3CloudProfile(db, tenantId);
  if (!profile) {
    return false;
  }
  const referencesDir = path.join(workspaceDir, "skills", "kingdee-analytics-ops", "references");
  const targetPath = path.join(referencesDir, "k3cloud-connection-profile.json");
  return writeJsonFileIfChanged(targetPath, profile);
}

function syncTenantDerivedAgentProfiles(db, tenantId) {
  const normalizedTenantId = String(tenantId || "").trim();
  if (!normalizedTenantId) {
    return 0;
  }
  const rows = db
    .prepare(
      `SELECT DISTINCT derived_workspace_dir AS derivedWorkspaceDir
       FROM user_agent_assignments
       WHERE tenant_id = ? AND status = 'active'`,
    )
    .all(normalizedTenantId);
  let changedCount = 0;
  for (const row of rows) {
    const workspaceDir = String(row?.derivedWorkspaceDir || "").trim();
    if (!workspaceDir) {
      continue;
    }
    if (
      syncDerivedAgentTenantAnalyticsProfile(db, {
        tenantId: normalizedTenantId,
        derivedWorkspaceDir: workspaceDir,
        workspaceDir,
      })
    ) {
      changedCount += 1;
    }
    if (
      syncDerivedAgentK3CloudProfile(db, {
        tenantId: normalizedTenantId,
        derivedWorkspaceDir: workspaceDir,
        workspaceDir,
      })
    ) {
      changedCount += 1;
    }
  }
  return changedCount;
}

export function resolveWorkspaceSandboxRunDir(workspaceDir, runId) {
  const normalizedWorkspaceDir = String(workspaceDir || "").trim();
  const normalizedRunId = String(runId || "").trim();
  if (!normalizedWorkspaceDir || !normalizedRunId) {
    return "";
  }
  return path.join(normalizedWorkspaceDir, "Sandbox", "runs", normalizedRunId);
}

export function readWorkspaceSandboxRunJson(workspaceDir, runId, fileName, fallback = null) {
  const runDir = resolveWorkspaceSandboxRunDir(workspaceDir, runId);
  const normalizedFileName = String(fileName || "").trim();
  if (!runDir || !normalizedFileName) {
    return fallback;
  }
  try {
    const targetPath = path.join(runDir, normalizedFileName);
    return JSON.parse(fs.readFileSync(targetPath, "utf8"));
  } catch {
    return fallback;
  }
}

function resolveConfiguredModelTokenPricing(params = {}) {
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
  return normalizeTokenPricingEntry(
    {
      ...matchedModel.cost,
      currency: matchedModel.cost.currency || DEFAULT_CONFIG_PRICING_CURRENCY,
    },
    DEFAULT_CONFIG_PRICING_CURRENCY,
  );
}

function resolveStaticModelTokenPricing(params = {}) {
  const modelKey = normalizeModelCostLookupKey(params.model);
  const providerEntry = resolveBillingProviderEntry(params.provider);
  const settlementCurrency = resolveSettlementCurrency();
  const exactModelPricing = normalizeTokenPricingEntry(
    providerEntry?.models?.[modelKey],
    settlementCurrency,
  );
  if (exactModelPricing) {
    return exactModelPricing;
  }
  const genericModelPricing = normalizeTokenPricingEntry(
    readBillingRatesConfig()?.models?.[modelKey],
    settlementCurrency,
  );
  if (genericModelPricing) {
    return genericModelPricing;
  }
  return normalizeTokenPricingEntry(providerEntry?.fallback, settlementCurrency);
}

function resolveModelTokenPricing(params = {}) {
  const staticPricing = resolveStaticModelTokenPricing(params);
  if (staticPricing) {
    return staticPricing;
  }
  return resolveConfiguredModelTokenPricing(params);
}

function estimateUsageSettlementCostFromTokenPricing(usage, tokenPricing) {
  if (!tokenPricing) {
    return null;
  }
  const inputTokens = Math.max(0, Math.round(toFiniteNumber(usage?.inputTokens)));
  const outputTokens = Math.max(0, Math.round(toFiniteNumber(usage?.outputTokens)));
  const cacheReadTokens = Math.max(0, Math.round(toFiniteNumber(usage?.cacheReadTokens)));
  const cacheWriteTokens = Math.max(0, Math.round(toFiniteNumber(usage?.cacheWriteTokens)));
  const estimatedProviderCost = roundPoints(
    (inputTokens * Math.max(0, toFiniteNumber(tokenPricing.input))) / 1_000_000 +
      (outputTokens * Math.max(0, toFiniteNumber(tokenPricing.output))) / 1_000_000 +
      (cacheReadTokens * Math.max(0, toFiniteNumber(tokenPricing.cacheRead))) / 1_000_000 +
      (cacheWriteTokens * Math.max(0, toFiniteNumber(tokenPricing.cacheWrite))) / 1_000_000,
  );
  return convertAmountToSettlementCurrency(estimatedProviderCost, tokenPricing.currency);
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

function resolveSessionEstimatedSettlementCost(params = {}, cache = null, sessionEntry = null) {
  const resolvedSessionEntry = sessionEntry || readSessionStoreEntry(params, cache);
  const explicitEstimatedCostUsd = normalizeOptionalPositiveCost(
    resolvedSessionEntry?.estimatedCostUsd,
  );
  if (explicitEstimatedCostUsd) {
    return convertAmountToSettlementCurrency(explicitEstimatedCostUsd, "USD");
  }
  return estimateUsageSettlementCostFromTokenPricing(
    {
      inputTokens: resolvedSessionEntry?.inputTokens,
      outputTokens: resolvedSessionEntry?.outputTokens,
      cacheReadTokens: resolvedSessionEntry?.cacheRead ?? resolvedSessionEntry?.cacheReadTokens,
      cacheWriteTokens: resolvedSessionEntry?.cacheWrite ?? resolvedSessionEntry?.cacheWriteTokens,
    },
    resolveModelTokenPricing({
      provider: resolvedSessionEntry?.modelProvider || resolvedSessionEntry?.provider,
      model: resolvedSessionEntry?.model,
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

function resolveUsageRecordSettlementCost(record, sessionParams = {}) {
  const staticTokenPricing = resolveStaticModelTokenPricing({
    provider: record?.provider,
    model: record?.model,
  });
  if (staticTokenPricing) {
    const staticEstimatedCost = estimateUsageSettlementCostFromTokenPricing(
      record,
      staticTokenPricing,
    );
    if (staticEstimatedCost) {
      return staticEstimatedCost;
    }
  }
  const explicitTotalCost = normalizeOptionalPositiveCost(record?.totalCost);
  if (explicitTotalCost) {
    return explicitTotalCost;
  }
  return estimateUsageSettlementCostFromTokenPricing(
    record,
    resolveModelTokenPricing({
      provider: record?.provider,
      model: record?.model,
      configDir: sessionParams.configDir,
      configPath: sessionParams.configPath,
    }),
  );
}

function applyUsageSettlementFallbackToUsageRecords(records, sessionParams = {}, cache = null) {
  if (!Array.isArray(records) || records.length === 0) {
    return [];
  }
  const sessionEntry = readSessionStoreEntry(sessionParams, cache);
  const sessionIdentity = resolveSessionUsageModelIdentity(sessionEntry);
  const sessionEstimatedSettlementCost = resolveSessionEstimatedSettlementCost(
    sessionParams,
    cache,
    sessionEntry,
  );
  const nextRecords = records.map((record) => {
    const nextRecord = { ...record };
    if (!nextRecord.provider && sessionIdentity.provider) {
      nextRecord.provider = sessionIdentity.provider;
    }
    if (!nextRecord.model && sessionIdentity.model) {
      nextRecord.model = sessionIdentity.model;
    }
    nextRecord.totalCost = resolveUsageRecordSettlementCost(nextRecord, sessionParams);
    return nextRecord;
  });
  const pendingIndexes = [];
  let knownSettlementCost = 0;
  for (let index = 0; index < nextRecords.length; index += 1) {
    const record = nextRecords[index];
    const totalCost = normalizeOptionalPositiveCost(record?.totalCost);
    if (totalCost) {
      knownSettlementCost = roundPoints(knownSettlementCost + totalCost);
      continue;
    }
    pendingIndexes.push(index);
  }
  if (pendingIndexes.length === 0) {
    return nextRecords;
  }
  if (!sessionEstimatedSettlementCost) {
    return nextRecords;
  }
  const remainingSettlementCost = roundPoints(sessionEstimatedSettlementCost - knownSettlementCost);
  if (remainingSettlementCost <= 0) {
    return nextRecords;
  }
  const weightedTokens = pendingIndexes.reduce(
    (sum, index) => sum + Math.max(0, Math.round(toFiniteNumber(nextRecords[index]?.totalTokens))),
    0,
  );
  let allocatedSettlementCost = 0;

  for (let pendingIndex = 0; pendingIndex < pendingIndexes.length; pendingIndex += 1) {
    const recordIndex = pendingIndexes[pendingIndex];
    const isLastPending = pendingIndex === pendingIndexes.length - 1;
    const currentRecord = nextRecords[recordIndex];
    const weight = Math.max(0, Math.round(toFiniteNumber(currentRecord?.totalTokens)));
    let shareSettlementCost = 0;

    if (isLastPending) {
      shareSettlementCost = Math.max(
        0,
        roundPoints(remainingSettlementCost - allocatedSettlementCost),
      );
    } else if (weightedTokens > 0) {
      shareSettlementCost = Math.max(
        0,
        roundPoints((remainingSettlementCost * weight) / weightedTokens),
      );
    } else {
      shareSettlementCost = Math.max(
        0,
        roundPoints(remainingSettlementCost / Math.max(1, pendingIndexes.length)),
      );
    }

    allocatedSettlementCost = roundPoints(allocatedSettlementCost + shareSettlementCost);
    if (shareSettlementCost > 0) {
      currentRecord.totalCost = shareSettlementCost;
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

function writeJsonFileIfChanged(filePath, payload) {
  if (!filePath || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  const nextText = `${JSON.stringify(payload, null, 2)}\n`;
  try {
    if (fs.existsSync(filePath)) {
      const currentText = fs.readFileSync(filePath, "utf8");
      if (currentText === nextText) {
        return false;
      }
    }
  } catch {}
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, nextText, "utf8");
  return true;
}

function normalizeDataSourceStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase() === "inactive"
    ? "inactive"
    : "active";
}

function normalizeTenantSyncScheduleStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase() === "paused"
    ? "paused"
    : "active";
}

function normalizeTenantSyncIntervalMinutes(value) {
  return Math.max(
    1,
    Number.parseInt(String(value || DEFAULT_TENANT_SYNC_INTERVAL_MINUTES), 10) ||
      DEFAULT_TENANT_SYNC_INTERVAL_MINUTES,
  );
}

function normalizeDefaultStart(value) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : DEFAULT_TENANT_SYNC_DEFAULT_START;
}

function normalizeConnectionJson(value) {
  const parsed = parseJsonObject(value);
  return parsed ? stringifyJsonObject(parsed) : null;
}

function normalizeK3CloudProfileJson(value) {
  const parsed = parseJsonObject(value);
  return parsed ? stringifyJsonObject(parsed) : null;
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

function cleanupDerivedAgentRuntimeConfig(entries, params = {}) {
  if (!Array.isArray(entries) || !entries.length) {
    return 0;
  }
  try {
    return removeDerivedAgentRuntimeConfigEntries(entries, params);
  } catch {
    return 0;
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

function buildDerivedAgentWorkspacePath(params = {}) {
  const configDir = resolveConfigDir(params);
  const derivedAgentId = String(params.derivedAgentId || "").trim();
  if (!derivedAgentId) {
    return "";
  }
  return path.join(configDir, "workspace-agents", derivedAgentId);
}

function buildDerivedAgentRuntimeWorkspacePath(params = {}) {
  const configDir = resolveConfigDir(params);
  const derivedAgentId = String(params.derivedAgentId || "").trim();
  if (!derivedAgentId) {
    return "";
  }
  return path.join(configDir, `workspace-${derivedAgentId}`);
}

function syncDerivedAgentRuntimeConfigEntry(params = {}) {
  const baseAgentId = String(params.baseAgentId || "").trim();
  const derivedAgentId = String(params.derivedAgentId || "").trim();
  const configPath = resolveConfigPath(params);
  if (!baseAgentId || !derivedAgentId || baseAgentId === derivedAgentId) {
    return null;
  }
  const configPayload = parseOpenClawConfig(configPath);
  const agents =
    configPayload?.agents && typeof configPayload.agents === "object" ? configPayload.agents : {};
  const nextList = Array.isArray(agents.list) ? agents.list.slice() : [];
  const baseIndex = nextList.findIndex(
    (entry) =>
      String(entry?.id || "")
        .trim()
        .toLowerCase() === baseAgentId.toLowerCase(),
  );
  if (baseIndex < 0) {
    return null;
  }
  const derivedWorkspace = buildDerivedAgentWorkspacePath({ ...params, derivedAgentId });
  const derivedAgentDir = path.join(resolveConfigDir(params), "agents", derivedAgentId, "agent");
  const nextEntry = {
    ...cloneJsonValue(nextList[baseIndex]),
    id: derivedAgentId,
    workspace: derivedWorkspace,
    agentDir: derivedAgentDir,
    skills: Array.isArray(params.skills)
      ? [...new Set(params.skills.map((entry) => normalizeSkillKey(entry)).filter(Boolean))]
      : cloneJsonValue(nextList[baseIndex]?.skills),
  };
  const existingIndex = nextList.findIndex(
    (entry) =>
      String(entry?.id || "")
        .trim()
        .toLowerCase() === derivedAgentId.toLowerCase(),
  );
  if (existingIndex >= 0) {
    nextList[existingIndex] = {
      ...cloneJsonValue(nextList[existingIndex]),
      ...nextEntry,
    };
  } else {
    nextList.push(nextEntry);
  }
  const nextConfig = {
    ...configPayload,
    agents: {
      ...agents,
      list: nextList,
    },
  };
  writeOpenClawConfig(configPath, nextConfig);
  return nextEntry;
}

function removeDerivedAgentRuntimeConfigEntries(entries = [], params = {}) {
  const derivedIds = [
    ...new Set(entries.map((entry) => String(entry?.derivedAgentId || "").trim()).filter(Boolean)),
  ];
  if (!derivedIds.length) {
    return 0;
  }
  const configPath = resolveConfigPath(params);
  const configPayload = parseOpenClawConfig(configPath);
  const agents =
    configPayload?.agents && typeof configPayload.agents === "object" ? configPayload.agents : {};
  const currentList = Array.isArray(agents.list) ? agents.list : [];
  const derivedIdSet = new Set(derivedIds.map((id) => id.toLowerCase()));
  const nextList = currentList.filter(
    (entry) =>
      !derivedIdSet.has(
        String(entry?.id || "")
          .trim()
          .toLowerCase(),
      ),
  );
  if (nextList.length === currentList.length) {
    return 0;
  }
  const nextConfig = {
    ...configPayload,
    agents: {
      ...agents,
      list: nextList,
    },
  };
  writeOpenClawConfig(configPath, nextConfig);
  return currentList.length - nextList.length;
}

function copySeedEntry(source, target) {
  if (!fs.existsSync(source)) {
    return;
  }
  const sourceStats = fs.statSync(source);
  if (sourceStats.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copySeedEntry(path.join(source, entry), path.join(target, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copySeedEntryIfMissing(source, target) {
  if (!fs.existsSync(source) || fs.existsSync(target)) {
    return;
  }
  const sourceStats = fs.statSync(source);
  if (sourceStats.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copySeedEntryIfMissing(path.join(source, entry), path.join(target, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function removePathIfExists(targetPath) {
  const normalizedTargetPath = String(targetPath || "").trim();
  if (!normalizedTargetPath || !fs.existsSync(normalizedTargetPath)) {
    return false;
  }
  fs.rmSync(normalizedTargetPath, { recursive: true, force: true });
  return true;
}

function materializeResolvedSkillsIntoWorkspace(workspaceDir, resolvedEntries = []) {
  const normalizedWorkspaceDir = String(workspaceDir || "").trim();
  if (!normalizedWorkspaceDir) {
    return [];
  }
  const skillsRoot = path.join(normalizedWorkspaceDir, "skills");
  removePathIfExists(skillsRoot);
  fs.mkdirSync(skillsRoot, { recursive: true });
  const resolvedSkillKeys = [];
  for (const entry of resolvedEntries) {
    const skillKey = normalizeSkillKey(entry?.skillKey);
    const skillMdContent = String(entry?.version?.skillMdContent || "").trim();
    if (!skillKey || !skillMdContent) {
      continue;
    }
    const skillDir = path.join(skillsRoot, skillKey);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), `${entry.version.skillMdContent}`, "utf8");
    resolvedSkillKeys.push(skillKey);
  }
  return resolvedSkillKeys;
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

  const canonicalWorkspace = buildDerivedAgentWorkspacePath({ ...params, derivedAgentId });
  const runtimeWorkspace = buildDerivedAgentRuntimeWorkspacePath({ ...params, derivedAgentId });
  const canonicalWorkspaceExisted = fs.existsSync(canonicalWorkspace);
  fs.mkdirSync(canonicalWorkspace, { recursive: true });

  const sourceWorkspace = resolveBaseWorkspaceDir(params);
  if (sourceWorkspace) {
    const seedMode = canonicalWorkspaceExisted ? copySeedEntryIfMissing : copySeedEntry;
    for (const entry of DERIVED_AGENT_SEED_ONCE_ENTRIES) {
      seedMode(path.join(sourceWorkspace, entry), path.join(canonicalWorkspace, entry));
    }
    for (const entry of DERIVED_AGENT_SYNC_ALWAYS_ENTRIES) {
      copySeedEntry(path.join(sourceWorkspace, entry), path.join(canonicalWorkspace, entry));
    }
  }

  const resolvedSkillState = resolveAssignmentSkillState(params.db, {
    tenantId: params.tenantId,
    tenantAgentId: params.tenantAgentId,
    assignmentId: params.assignmentId,
    baseAgentId: params.baseAgentId,
    configPath: params.configPath,
    configDir: params.configDir,
    workspaceDir: params.workspaceDir,
  });
  const resolvedSkillKeys = materializeResolvedSkillsIntoWorkspace(
    canonicalWorkspace,
    resolvedSkillState.resolvedEntries,
  );
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
  if (!linked) {
    fs.mkdirSync(runtimeWorkspace, { recursive: true });
    for (const entry of [
      ...DERIVED_AGENT_SEED_ONCE_ENTRIES,
      ...DERIVED_AGENT_SYNC_ALWAYS_ENTRIES,
    ]) {
      copySeedEntry(path.join(canonicalWorkspace, entry), path.join(runtimeWorkspace, entry));
    }
  }

  return {
    canonicalWorkspace,
    runtimeWorkspace,
    resolvedSkillKeys,
    resolvedVersionIds: resolvedSkillState.resolvedEntries.map((entry) => entry.versionId),
    blockedReasons: resolvedSkillState.blockedReasons,
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

function collectAssignmentWorkspaceEntriesByWhereClause(db, whereClause, bindings = []) {
  const normalizedWhereClause = String(whereClause || "").trim();
  if (!normalizedWhereClause) {
    return [];
  }
  return db
    .prepare(
      `SELECT id,
              user_id AS userId,
              tenant_agent_id AS tenantAgentId,
              derived_agent_id AS derivedAgentId,
              derived_workspace_dir AS derivedWorkspaceDir
       FROM user_agent_assignments
       WHERE ${normalizedWhereClause}`,
    )
    .all(...bindings)
    .map((row) => ({
      id: String(row?.id || "").trim(),
      userId: String(row?.userId || "").trim(),
      tenantAgentId: String(row?.tenantAgentId || "").trim(),
      derivedAgentId: String(row?.derivedAgentId || "").trim(),
      derivedWorkspaceDir: String(row?.derivedWorkspaceDir || "").trim(),
    }))
    .filter((row) => row.id);
}

function revokeAssignmentEntriesWithCleanup(db, params = {}) {
  const normalizedWhereClause = String(params.whereClause || "").trim();
  const bindings = Array.isArray(params.bindings) ? params.bindings : [];
  if (!normalizedWhereClause) {
    return {
      revokedAssignmentCount: 0,
      affectedUserIds: [],
      affectedMemberCount: 0,
      removedWorkspaceCount: 0,
      removedWorkspacePathCount: 0,
      cleanedApprovalBucketCount: 0,
    };
  }

  const selectedAssignments = collectAssignmentWorkspaceEntriesByWhereClause(
    db,
    normalizedWhereClause,
    bindings,
  );
  if (!selectedAssignments.length) {
    return {
      revokedAssignmentCount: 0,
      affectedUserIds: [],
      affectedMemberCount: 0,
      removedWorkspaceCount: 0,
      removedWorkspacePathCount: 0,
      cleanedApprovalBucketCount: 0,
    };
  }

  db.prepare(
    `UPDATE user_agent_assignments
     SET status = 'inactive'
     WHERE ${normalizedWhereClause}`,
  ).run(...bindings);

  const cleanupResult = cleanupMemberDerivedWorkspaces(selectedAssignments, params);
  let cleanedApprovalBucketCount = 0;
  let cleanedRuntimeConfigEntryCount = 0;
  try {
    cleanedApprovalBucketCount = cleanupDerivedAgentExecApprovals(selectedAssignments, params);
  } catch {
    // Best-effort cleanup only. Assignment revocation must not be blocked by stale approval buckets.
  }
  try {
    cleanedRuntimeConfigEntryCount = cleanupDerivedAgentRuntimeConfig(selectedAssignments, params);
  } catch {
    // Best-effort cleanup only. Assignment revocation must not be blocked by stale derived config entries.
  }

  const affectedUserIds = [
    ...new Set(selectedAssignments.map((assignment) => assignment.userId).filter(Boolean)),
  ];
  return {
    revokedAssignmentCount: selectedAssignments.length,
    affectedUserIds,
    affectedMemberCount: affectedUserIds.length,
    removedWorkspaceCount: Number(cleanupResult?.removedWorkspaceCount || 0),
    removedWorkspacePathCount: Number(cleanupResult?.removedPathCount || 0),
    cleanedApprovalBucketCount: Number(cleanedApprovalBucketCount || 0),
    cleanedRuntimeConfigEntryCount: Number(cleanedRuntimeConfigEntryCount || 0),
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
  const deletedAssignments = db
    .prepare(
      `DELETE FROM user_agent_assignments
     WHERE tenant_id = @tenantId AND user_id = @userId`,
    )
    .run({
      tenantId,
      userId,
    });
  const deletedUser = db
    .prepare(
      `DELETE FROM users
     WHERE id = @userId AND role = 'member'`,
    )
    .run({
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
  try {
    cleanupDerivedAgentRuntimeConfig(cleanupEntries, params);
  } catch {
    // Best-effort cleanup only. Member deletion must not be blocked by stale derived config entries.
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
  return db;
}

export function closeTenantPlatformDb(db) {
  if (db && typeof db.close === "function") {
    db.close();
  }
}

export function getBootstrapStatus(db, edition = "cloud", nodeRole = "control-plane") {
  const normalizedEdition = String(edition || "cloud")
    .trim()
    .toLowerCase();
  const normalizedNodeRole = String(nodeRole || "control-plane")
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
  const managedNodeTenantAdminCount = Number(
    getScalar(
      db,
      `SELECT COUNT(*) AS value
       FROM tenant_memberships
       WHERE role = 'tenant_admin' AND status = 'active'`,
    ) || 0,
  );
  return {
    initialized:
      normalizedNodeRole === "managed-node"
        ? managedNodeTenantAdminCount > 0
        : normalizedEdition === "local"
          ? localTenantAdminCount > 0
          : platformAdminCount > 0,
    platformAdminCount,
    localTenantAdminCount,
    managedNodeTenantAdminCount,
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
      normalizeUpdateLogText(params?.createdByUsername, {
        maxLength: 64,
        preserveNewlines: false,
      }) || "平台管理员",
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

function mapManagedNodeRow(row) {
  if (!row) {
    return null;
  }
  const lease = summarizeManagedNodeLeaseRow(row);
  return {
    id: String(row.id || "").trim(),
    name: String(row.name || "").trim(),
    status: normalizeManagedNodeStatus(row.status),
    nodeRole: String(row.nodeRole || "managed-node").trim() || "managed-node",
    createdAt: String(row.createdAt || "").trim(),
    updatedAt: String(row.updatedAt || "").trim(),
    desiredRevision: Number(row.desiredRevision || 1),
    lastAppliedRevision: Number(row.lastAppliedRevision || 0),
    lastRegisteredAt: String(row.lastRegisteredAt || "").trim() || null,
    lastHeartbeatAt: String(row.lastHeartbeatAt || "").trim() || null,
    lastInventoryAt: String(row.lastInventoryAt || "").trim() || null,
    lastSyncAt: String(row.lastSyncAt || "").trim() || null,
    lastSeenIp: String(row.lastSeenIp || "").trim() || null,
    lastError: String(row.lastError || "").trim() || null,
    boundTenantCount: Number(row.boundTenantCount || 0),
    agentCount: Number(row.agentCount || 0),
    leaseStatus: lease.status,
    leaseExpiresAt: lease.expiresAt,
    leaseReadonly: lease.readonly,
    leaseRemainingDays: lease.remainingDays,
    leaseReason: lease.reason,
  };
}

function getManagedNodeSummary(db, nodeId) {
  return mapManagedNodeRow(
    db
      .prepare(
        `SELECT n.id,
                n.name,
                n.status,
                n.node_role AS nodeRole,
                n.created_at AS createdAt,
                n.updated_at AS updatedAt,
                ms.desired_revision AS desiredRevision,
                ms.last_applied_revision AS lastAppliedRevision,
                ms.last_registered_at AS lastRegisteredAt,
                ms.last_heartbeat_at AS lastHeartbeatAt,
                ms.last_inventory_at AS lastInventoryAt,
                ms.last_sync_at AS lastSyncAt,
                ms.last_seen_ip AS lastSeenIp,
                ms.last_error AS lastError,
                ml.lease_status AS leaseStatus,
                ml.expires_at AS expiresAt,
                ml.readonly_after_expiry AS readonlyAfterExpiry,
                COUNT(DISTINCT tnb.tenant_id) AS boundTenantCount,
                COUNT(DISTINCT CASE WHEN mai.status = 'active' THEN mai.agent_id END) AS agentCount
         FROM managed_nodes n
         LEFT JOIN managed_node_sync_state ms ON ms.node_id = n.id
         LEFT JOIN managed_node_leases ml ON ml.node_id = n.id
         LEFT JOIN tenant_node_bindings tnb ON tnb.node_id = n.id
         LEFT JOIN managed_node_agent_inventory mai ON mai.node_id = n.id
         WHERE n.id = ?
         GROUP BY n.id, n.name, n.status, n.node_role, n.created_at, n.updated_at,
                  ms.desired_revision, ms.last_applied_revision, ms.last_registered_at,
                  ms.last_heartbeat_at, ms.last_inventory_at, ms.last_sync_at,
                  ms.last_seen_ip, ms.last_error, ml.lease_status, ml.expires_at,
                  ml.readonly_after_expiry`,
      )
      .get(nodeId),
  );
}

function ensureManagedNodeSyncStateRow(db, nodeId) {
  const normalizedNodeId = normalizeManagedNodeId(nodeId);
  db.prepare(
    `INSERT INTO managed_node_sync_state (
       node_id,
       desired_revision,
       last_applied_revision,
       updated_at
     )
     VALUES (@nodeId, 1, 0, @updatedAt)
     ON CONFLICT(node_id) DO NOTHING`,
  ).run({
    nodeId: normalizedNodeId,
    updatedAt: nowIso(),
  });
}

function bumpManagedNodeDesiredRevisionByNodeId(db, nodeId) {
  const normalizedNodeId = normalizeManagedNodeId(nodeId);
  ensureManagedNodeSyncStateRow(db, normalizedNodeId);
  db.prepare(
    `UPDATE managed_node_sync_state
     SET desired_revision = desired_revision + 1,
         updated_at = @updatedAt
     WHERE node_id = @nodeId`,
  ).run({
    nodeId: normalizedNodeId,
    updatedAt: nowIso(),
  });
}

function bumpManagedNodeDesiredRevisionForTenant(db, tenantId) {
  const normalizedTenantId = String(tenantId || "").trim();
  if (!normalizedTenantId) {
    return;
  }
  const rows = db
    .prepare(
      `SELECT node_id AS nodeId
       FROM tenant_node_bindings
       WHERE tenant_id = ?`,
    )
    .all(normalizedTenantId);
  for (const row of rows) {
    const nodeId = String(row?.nodeId || "").trim();
    if (nodeId) {
      bumpManagedNodeDesiredRevisionByNodeId(db, nodeId);
    }
  }
}

function syncManagedNodeInventory(db, params) {
  const nodeId = normalizeManagedNodeId(params?.nodeId);
  const catalog = Array.isArray(params?.agentCatalog) ? params.agentCatalog : [];
  const now = nowIso();
  const activeAgentIds = new Set();
  for (const entry of catalog) {
    const agentId = String(entry?.id || "").trim();
    if (!agentId) {
      continue;
    }
    activeAgentIds.add(agentId);
    db.prepare(
      `INSERT INTO managed_node_agent_inventory (
         id,
         node_id,
         agent_id,
         agent_name,
         agent_emoji,
         status,
         updated_at
       )
       VALUES (@id, @nodeId, @agentId, @agentName, @agentEmoji, 'active', @updatedAt)
       ON CONFLICT(node_id, agent_id) DO UPDATE SET
         agent_name = excluded.agent_name,
         agent_emoji = excluded.agent_emoji,
         status = 'active',
         updated_at = excluded.updated_at`,
    ).run({
      id: createId("node_agent"),
      nodeId,
      agentId,
      agentName: String(entry?.name || entry?.agentName || agentId).trim() || agentId,
      agentEmoji: String(entry?.emoji || entry?.identity?.emoji || "").trim() || null,
      updatedAt: now,
    });
  }
  const existing = db
    .prepare(
      `SELECT agent_id AS agentId
       FROM managed_node_agent_inventory
       WHERE node_id = ?`,
    )
    .all(nodeId);
  for (const row of existing) {
    const agentId = String(row?.agentId || "").trim();
    if (!agentId || activeAgentIds.has(agentId)) {
      continue;
    }
    db.prepare(
      `UPDATE managed_node_agent_inventory
       SET status = 'inactive',
           updated_at = @updatedAt
       WHERE node_id = @nodeId AND agent_id = @agentId`,
    ).run({
      nodeId,
      agentId,
      updatedAt: now,
    });
  }
}

export function getManagedNodeLeaseState(db, nodeId) {
  const normalizedNodeId = String(nodeId || "").trim();
  if (!normalizedNodeId) {
    return summarizeManagedNodeLeaseRow(null);
  }
  const row = db
    .prepare(
      `SELECT node_id AS nodeId,
              lease_status AS leaseStatus,
              expires_at AS expiresAt,
              readonly_after_expiry AS readonlyAfterExpiry
       FROM managed_node_leases
       WHERE node_id = ?`,
    )
    .get(normalizedNodeId);
  return summarizeManagedNodeLeaseRow(row);
}

export function getManagedNodeSyncCheckpoint(db, nodeId) {
  const normalizedNodeId = normalizeManagedNodeId(nodeId);
  const existingNode = db
    .prepare("SELECT id FROM managed_nodes WHERE id = ?")
    .get(normalizedNodeId);
  if (existingNode) {
    ensureManagedNodeSyncStateRow(db, normalizedNodeId);
  }
  const row = db
    .prepare(
      `SELECT desired_revision AS desiredRevision,
              last_applied_revision AS lastAppliedRevision,
              last_registered_at AS lastRegisteredAt,
              last_heartbeat_at AS lastHeartbeatAt,
              last_inventory_at AS lastInventoryAt,
              last_sync_at AS lastSyncAt,
              last_seen_ip AS lastSeenIp,
              last_error AS lastError
       FROM managed_node_sync_state
       WHERE node_id = ?`,
    )
    .get(normalizedNodeId);
  return {
    nodeId: normalizedNodeId,
    desiredRevision: Number(row?.desiredRevision || 1),
    lastAppliedRevision: Number(row?.lastAppliedRevision || 0),
    lastRegisteredAt: String(row?.lastRegisteredAt || "").trim() || null,
    lastHeartbeatAt: String(row?.lastHeartbeatAt || "").trim() || null,
    lastInventoryAt: String(row?.lastInventoryAt || "").trim() || null,
    lastSyncAt: String(row?.lastSyncAt || "").trim() || null,
    lastSeenIp: String(row?.lastSeenIp || "").trim() || null,
    lastError: String(row?.lastError || "").trim() || null,
  };
}

export function recordManagedNodeSyncError(db, params = {}) {
  const nodeId = normalizeManagedNodeId(params?.nodeId);
  const existingNode = db.prepare("SELECT id FROM managed_nodes WHERE id = ?").get(nodeId);
  if (!existingNode) {
    return {
      ...getManagedNodeSyncCheckpoint(db, nodeId),
      lastError: String(params?.lastError || "").trim() || null,
    };
  }
  ensureManagedNodeSyncStateRow(db, nodeId);
  db.prepare(
    `UPDATE managed_node_sync_state
     SET last_error = @lastError,
         updated_at = @updatedAt
     WHERE node_id = @nodeId`,
  ).run({
    nodeId,
    lastError: String(params?.lastError || "").trim() || null,
    updatedAt: nowIso(),
  });
  return getManagedNodeSyncCheckpoint(db, nodeId);
}

export function listManagedNodes(db) {
  return db
    .prepare(
      `SELECT n.id,
              n.name,
              n.status,
              n.node_role AS nodeRole,
              n.created_at AS createdAt,
              n.updated_at AS updatedAt,
              ms.desired_revision AS desiredRevision,
              ms.last_applied_revision AS lastAppliedRevision,
              ms.last_registered_at AS lastRegisteredAt,
              ms.last_heartbeat_at AS lastHeartbeatAt,
              ms.last_inventory_at AS lastInventoryAt,
              ms.last_sync_at AS lastSyncAt,
              ms.last_seen_ip AS lastSeenIp,
              ms.last_error AS lastError,
              ml.lease_status AS leaseStatus,
              ml.expires_at AS expiresAt,
              ml.readonly_after_expiry AS readonlyAfterExpiry,
              COUNT(DISTINCT tnb.tenant_id) AS boundTenantCount,
              COUNT(DISTINCT CASE WHEN mai.status = 'active' THEN mai.agent_id END) AS agentCount
       FROM managed_nodes n
       LEFT JOIN managed_node_sync_state ms ON ms.node_id = n.id
       LEFT JOIN managed_node_leases ml ON ml.node_id = n.id
       LEFT JOIN tenant_node_bindings tnb ON tnb.node_id = n.id
       LEFT JOIN managed_node_agent_inventory mai ON mai.node_id = n.id
       GROUP BY n.id, n.name, n.status, n.node_role, n.created_at, n.updated_at,
                ms.desired_revision, ms.last_applied_revision, ms.last_registered_at,
                ms.last_heartbeat_at, ms.last_inventory_at, ms.last_sync_at,
                ms.last_seen_ip, ms.last_error, ml.lease_status, ml.expires_at,
                ml.readonly_after_expiry
       ORDER BY n.created_at DESC`,
    )
    .all()
    .map(mapManagedNodeRow)
    .filter(Boolean);
}

export function upsertManagedNode(db, params = {}) {
  const nodeId = normalizeManagedNodeId(params?.id || params?.nodeId);
  const name = normalizeManagedNodeName(params?.name);
  const sharedSecret = String(params?.sharedSecret || "").trim();
  const status = normalizeManagedNodeStatus(params?.status);
  const leaseStatus = normalizeManagedNodeLeaseStatus(params?.leaseStatus);
  const leaseExpiresAt = String(params?.leaseExpiresAt || "").trim()
    ? normalizeIsoTimestamp(params.leaseExpiresAt)
    : null;
  const readonlyAfterExpiry = Number(params?.readonlyAfterExpiry ?? 1) === 0 ? 0 : 1;
  const existing = db
    .prepare(
      `SELECT id,
              shared_secret_hash AS sharedSecretHash
       FROM managed_nodes
       WHERE id = ?`,
    )
    .get(nodeId);
  if (!existing && !sharedSecret) {
    throw new Error("managed_node_secret_required");
  }
  runInTransaction(db, () => {
    const now = nowIso();
    if (existing) {
      db.prepare(
        `UPDATE managed_nodes
         SET name = @name,
             shared_secret_hash = @sharedSecretHash,
             status = @status,
             node_role = 'managed-node',
             updated_at = @updatedAt
         WHERE id = @id`,
      ).run({
        id: nodeId,
        name,
        sharedSecretHash: sharedSecret ? hashPassword(sharedSecret) : existing.sharedSecretHash,
        status,
        updatedAt: now,
      });
    } else {
      db.prepare(
        `INSERT INTO managed_nodes (
           id,
           name,
           shared_secret_hash,
           status,
           node_role,
           created_at,
           updated_at
         )
         VALUES (
           @id,
           @name,
           @sharedSecretHash,
           @status,
           'managed-node',
           @createdAt,
           @updatedAt
         )`,
      ).run({
        id: nodeId,
        name,
        sharedSecretHash: hashPassword(sharedSecret),
        status,
        createdAt: now,
        updatedAt: now,
      });
    }
    db.prepare(
      `INSERT INTO managed_node_leases (
         node_id,
         lease_status,
         expires_at,
         readonly_after_expiry,
         issued_at,
         updated_at
       )
       VALUES (
         @nodeId,
         @leaseStatus,
         @expiresAt,
         @readonlyAfterExpiry,
         @issuedAt,
         @updatedAt
       )
       ON CONFLICT(node_id) DO UPDATE SET
         lease_status = excluded.lease_status,
         expires_at = excluded.expires_at,
         readonly_after_expiry = excluded.readonly_after_expiry,
         updated_at = excluded.updated_at`,
    ).run({
      nodeId,
      leaseStatus,
      expiresAt: leaseExpiresAt,
      readonlyAfterExpiry,
      issuedAt: now,
      updatedAt: now,
    });
    ensureManagedNodeSyncStateRow(db, nodeId);
    if (existing) {
      bumpManagedNodeDesiredRevisionByNodeId(db, nodeId);
    }
  });
  return getManagedNodeSummary(db, nodeId);
}

export function bindTenantToManagedNode(db, params = {}) {
  const tenantId = String(params?.tenantId || "").trim();
  const nextNodeId = String(params?.nodeId || "").trim();
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }
  runInTransaction(db, () => {
    const tenant = db.prepare("SELECT id FROM tenants WHERE id = ?").get(tenantId);
    if (!tenant) {
      throw new Error("tenant_not_found");
    }
    const previous = db
      .prepare(
        `SELECT node_id AS nodeId
         FROM tenant_node_bindings
         WHERE tenant_id = ?`,
      )
      .get(tenantId);
    const previousNodeId = String(previous?.nodeId || "").trim();
    const now = nowIso();
    if (nextNodeId) {
      const normalizedNodeId = normalizeManagedNodeId(nextNodeId);
      const node = db.prepare("SELECT id FROM managed_nodes WHERE id = ?").get(normalizedNodeId);
      if (!node) {
        throw new Error("managed_node_not_found");
      }
      db.prepare(
        `INSERT INTO tenant_node_bindings (tenant_id, node_id, created_at, updated_at)
         VALUES (@tenantId, @nodeId, @createdAt, @updatedAt)
         ON CONFLICT(tenant_id) DO UPDATE SET
           node_id = excluded.node_id,
           updated_at = excluded.updated_at`,
      ).run({
        tenantId,
        nodeId: normalizedNodeId,
        createdAt: now,
        updatedAt: now,
      });
      if (previousNodeId && previousNodeId !== normalizedNodeId) {
        bumpManagedNodeDesiredRevisionByNodeId(db, previousNodeId);
      }
      bumpManagedNodeDesiredRevisionByNodeId(db, normalizedNodeId);
      return;
    }
    db.prepare("DELETE FROM tenant_node_bindings WHERE tenant_id = ?").run(tenantId);
    if (previousNodeId) {
      bumpManagedNodeDesiredRevisionByNodeId(db, previousNodeId);
    }
  });
  return getTenantSummary(db, tenantId);
}

export function registerManagedNodeHeartbeat(db, params = {}) {
  const nodeId = normalizeManagedNodeId(params?.nodeId);
  const node = db
    .prepare(
      `SELECT id
       FROM managed_nodes
       WHERE id = ?`,
    )
    .get(nodeId);
  if (!node) {
    throw new Error("managed_node_not_found");
  }
  runInTransaction(db, () => {
    const now = nowIso();
    ensureManagedNodeSyncStateRow(db, nodeId);
    if (String(params?.nodeName || "").trim()) {
      db.prepare(
        `UPDATE managed_nodes
         SET name = @name,
             updated_at = @updatedAt
         WHERE id = @id`,
      ).run({
        id: nodeId,
        name: normalizeManagedNodeName(params.nodeName),
        updatedAt: now,
      });
    }
    if (Array.isArray(params?.agentCatalog)) {
      syncManagedNodeInventory(db, {
        nodeId,
        agentCatalog: params.agentCatalog,
      });
    }
    db.prepare(
      `UPDATE managed_node_sync_state
       SET last_registered_at = CASE
             WHEN @registeredAt IS NOT NULL THEN @registeredAt
             ELSE last_registered_at
           END,
           last_heartbeat_at = @heartbeatAt,
           last_inventory_at = CASE
             WHEN @inventoryAt IS NOT NULL THEN @inventoryAt
             ELSE last_inventory_at
           END,
           last_applied_revision = CASE
             WHEN @lastAppliedRevision IS NOT NULL THEN @lastAppliedRevision
             ELSE last_applied_revision
           END,
           last_seen_ip = @lastSeenIp,
           last_error = @lastError,
           updated_at = @updatedAt
       WHERE node_id = @nodeId`,
    ).run({
      nodeId,
      registeredAt: params?.registration ? now : null,
      heartbeatAt: now,
      inventoryAt: Array.isArray(params?.agentCatalog) ? now : null,
      lastAppliedRevision:
        params?.lastAppliedRevision === undefined || params?.lastAppliedRevision === null
          ? null
          : Math.max(0, Number.parseInt(String(params.lastAppliedRevision), 10) || 0),
      lastSeenIp: String(params?.lastSeenIp || "").trim() || null,
      lastError: String(params?.lastError || "").trim() || null,
      updatedAt: now,
    });
  });
  return getManagedNodeSummary(db, nodeId);
}

export function buildManagedNodeDesiredState(db, params = {}) {
  const nodeId = normalizeManagedNodeId(params?.nodeId);
  const node = getManagedNodeSummary(db, nodeId);
  if (!node) {
    throw new Error("managed_node_not_found");
  }
  const bindingRows = db
    .prepare(
      `SELECT tenant_id AS tenantId
       FROM tenant_node_bindings
       WHERE node_id = ?
       ORDER BY updated_at ASC, created_at ASC`,
    )
    .all(nodeId);
  const tenantIds = bindingRows.map((row) => String(row?.tenantId || "").trim()).filter(Boolean);
  const checkpoint = getManagedNodeSyncCheckpoint(db, nodeId);
  if (!tenantIds.length) {
    return {
      node,
      lease: getManagedNodeLeaseState(db, nodeId),
      desiredRevision: checkpoint.desiredRevision,
      tenants: [],
      users: [],
      memberships: [],
      tenantAgents: [],
      platformSkills: [],
      platformSkillVersions: [],
      tenantSkillEntitlements: [],
      tenantAgentSkillTemplates: [],
      userAgentSkillOverrides: [],
      userAssignments: [],
      generatedAt: nowIso(),
    };
  }
  const placeholders = tenantIds.map(() => "?").join(", ");
  const tenants = db
    .prepare(
      `SELECT t.id,
              t.code,
              t.name,
              t.status,
              t.deployment_mode AS deploymentMode,
              t.created_at AS createdAt,
              t.updated_at AS updatedAt,
              tq.member_limit AS memberLimit,
              tq.license_expires_at AS licenseExpiresAt,
              tq.readonly_after_expiry AS readonlyAfterExpiry,
              COALESCE(tw.balance_points, 0) AS walletBalance
       FROM tenants t
       LEFT JOIN tenant_quotas tq ON tq.tenant_id = t.id
       LEFT JOIN tenant_wallets tw ON tw.tenant_id = t.id
       WHERE t.id IN (${placeholders})
       ORDER BY t.created_at ASC`,
    )
    .all(...tenantIds);
  const users = db
    .prepare(
      `SELECT DISTINCT u.id,
              u.username,
              u.password_hash AS passwordHash,
              u.role,
              u.status,
              u.created_at AS createdAt,
              u.updated_at AS updatedAt
       FROM users u
       JOIN tenant_memberships tm ON tm.user_id = u.id
       WHERE tm.tenant_id IN (${placeholders})
       ORDER BY u.created_at ASC`,
    )
    .all(...tenantIds);
  const memberships = db
    .prepare(
      `SELECT id,
              tenant_id AS tenantId,
              user_id AS userId,
              role,
              status,
              created_at AS createdAt
       FROM tenant_memberships
       WHERE tenant_id IN (${placeholders})
       ORDER BY created_at ASC`,
    )
    .all(...tenantIds);
  const tenantAgents = db
    .prepare(
      `SELECT id,
              tenant_id AS tenantId,
              agent_id AS agentId,
              description,
              rate_multiplier AS rateMultiplier,
              status,
              balance_points AS balancePoints,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM tenant_agents
       WHERE tenant_id IN (${placeholders})
       ORDER BY created_at ASC`,
    )
    .all(...tenantIds);
  const platformSkills = listPlatformSkillsInternal(db, { includeInactive: true });
  const platformSkillVersions = listPlatformSkillVersionsByIds(
    db,
    platformSkills.map((entry) => entry.latestVersionId),
  );
  const tenantSkillEntitlements = tenantIds.flatMap((tenantId) =>
    listTenantSkillEntitlementsInternal(db, tenantId),
  );
  const tenantAgentSkillTemplates = db
    .prepare(
      `SELECT tats.id,
              tats.tenant_agent_id AS tenantAgentId,
              tats.skill_id AS skillId,
              tats.template_state AS templateState,
              tats.source_type AS sourceType,
              tats.created_at AS createdAt,
              tats.updated_at AS updatedAt
         FROM tenant_agent_skill_templates tats
         JOIN tenant_agents ta ON ta.id = tats.tenant_agent_id
        WHERE ta.tenant_id IN (${placeholders})
        ORDER BY tats.created_at ASC`,
    )
    .all(...tenantIds)
    .map((row) => ({
      id: String(row?.id || "").trim(),
      tenantAgentId: String(row?.tenantAgentId || "").trim(),
      skillId: String(row?.skillId || "").trim(),
      templateState: normalizeSkillTemplateState(row?.templateState),
      sourceType: String(row?.sourceType || "").trim() || "base_default",
      createdAt: String(row?.createdAt || "").trim(),
      updatedAt: String(row?.updatedAt || "").trim(),
    }));
  const userAgentSkillOverrides = db
    .prepare(
      `SELECT uaso.id,
              uaso.assignment_id AS assignmentId,
              uaso.tenant_agent_id AS tenantAgentId,
              uaso.user_id AS userId,
              uaso.skill_id AS skillId,
              uaso.action,
              uaso.created_at AS createdAt,
              uaso.updated_at AS updatedAt
         FROM user_agent_skill_overrides uaso
         JOIN user_agent_assignments ua ON ua.id = uaso.assignment_id
        WHERE ua.tenant_id IN (${placeholders}) AND ua.status = 'active'
        ORDER BY uaso.created_at ASC`,
    )
    .all(...tenantIds)
    .map((row) => ({
      id: String(row?.id || "").trim(),
      assignmentId: String(row?.assignmentId || "").trim(),
      tenantAgentId: String(row?.tenantAgentId || "").trim(),
      userId: String(row?.userId || "").trim(),
      skillId: String(row?.skillId || "").trim(),
      action: normalizeSkillOverrideAction(row?.action),
      createdAt: String(row?.createdAt || "").trim(),
      updatedAt: String(row?.updatedAt || "").trim(),
    }));
  const dataSources = db
    .prepare(
      `SELECT DISTINCT d.id,
                       d.name,
                       d.status,
                       d.connection_json AS connectionJson,
                       d.k3cloud_profile_json AS k3cloudProfileJson,
                       d.created_at AS createdAt,
                       d.updated_at AS updatedAt
       FROM data_sources d
       JOIN tenant_data_source_bindings b ON b.data_source_id = d.id
       WHERE b.tenant_id IN (${placeholders})
       ORDER BY d.updated_at DESC, d.created_at DESC`,
    )
    .all(...tenantIds);
  const tenantDataSourceBindings = db
    .prepare(
      `SELECT b.tenant_id AS tenantId,
              b.data_source_id AS dataSourceId,
              d.name AS dataSourceName,
              b.created_at AS createdAt,
              b.updated_at AS updatedAt
       FROM tenant_data_source_bindings b
       LEFT JOIN data_sources d ON d.id = b.data_source_id
       WHERE b.tenant_id IN (${placeholders})
       ORDER BY b.updated_at DESC, b.created_at DESC`,
    )
    .all(...tenantIds);
  const userAssignments = db
    .prepare(
      `SELECT ua.tenant_id AS tenantId,
              ua.user_id AS userId,
              ua.tenant_agent_id AS tenantAgentId,
              ua.derived_agent_id AS derivedAgentId,
              ua.derived_workspace_dir AS derivedWorkspaceDir
       FROM user_agent_assignments ua
       JOIN tenant_agents ta ON ta.id = ua.tenant_agent_id
       WHERE ua.status = 'active'
         AND ta.status = 'active'
         AND ua.tenant_id IN (${placeholders})
       ORDER BY ua.created_at ASC`,
    )
    .all(...tenantIds);
  return {
    node,
    lease: getManagedNodeLeaseState(db, nodeId),
    desiredRevision: checkpoint.desiredRevision,
    tenants,
    users,
    memberships,
    tenantAgents,
    platformSkills,
    platformSkillVersions,
    tenantSkillEntitlements,
    tenantAgentSkillTemplates,
    userAgentSkillOverrides,
    dataSources,
    tenantDataSourceBindings,
    userAssignments,
    generatedAt: nowIso(),
  };
}

export function applyManagedNodeDesiredState(db, params = {}) {
  const nodeId = normalizeManagedNodeId(params?.nodeId || params?.node?.id);
  const desiredRevision = Math.max(
    0,
    Number.parseInt(String(params?.desiredRevision || "0"), 10) || 0,
  );
  const node = params?.node && typeof params.node === "object" ? params.node : { id: nodeId };
  const lease = params?.lease && typeof params.lease === "object" ? params.lease : {};
  const tenants = Array.isArray(params?.tenants) ? params.tenants : [];
  const users = Array.isArray(params?.users) ? params.users : [];
  const memberships = Array.isArray(params?.memberships) ? params.memberships : [];
  const tenantAgents = Array.isArray(params?.tenantAgents) ? params.tenantAgents : [];
  const platformSkills = Array.isArray(params?.platformSkills) ? params.platformSkills : [];
  const platformSkillVersions = Array.isArray(params?.platformSkillVersions)
    ? params.platformSkillVersions
    : [];
  const tenantSkillEntitlements = Array.isArray(params?.tenantSkillEntitlements)
    ? params.tenantSkillEntitlements
    : [];
  const tenantAgentSkillTemplates = Array.isArray(params?.tenantAgentSkillTemplates)
    ? params.tenantAgentSkillTemplates
    : [];
  const userAgentSkillOverrides = Array.isArray(params?.userAgentSkillOverrides)
    ? params.userAgentSkillOverrides
    : [];
  const dataSources = Array.isArray(params?.dataSources) ? params.dataSources : [];
  const tenantDataSourceBindings = Array.isArray(params?.tenantDataSourceBindings)
    ? params.tenantDataSourceBindings
    : [];
  const userAssignments = Array.isArray(params?.userAssignments) ? params.userAssignments : [];
  const configPath = String(params?.configPath || "").trim();
  const configDir = String(params?.configDir || "").trim();
  const tenantIds = tenants.map((entry) => String(entry?.id || "").trim()).filter(Boolean);
  const userIds = users.map((entry) => String(entry?.id || "").trim()).filter(Boolean);
  const membershipKeys = new Set(
    memberships.map(
      (entry) => `${String(entry?.tenantId || "").trim()}::${String(entry?.userId || "").trim()}`,
    ),
  );
  const tenantAgentIds = new Set(
    tenantAgents.map((entry) => String(entry?.id || "").trim()).filter(Boolean),
  );
  const dataSourceIds = new Set(
    dataSources.map((entry) => String(entry?.id || "").trim()).filter(Boolean),
  );
  const tenantBindingTenantIds = new Set(
    tenantDataSourceBindings.map((entry) => String(entry?.tenantId || "").trim()).filter(Boolean),
  );
  const activeAssignmentKeys = new Set(
    userAssignments.map((entry) =>
      buildManagedNodeAssignmentKey({
        userId: entry?.userId,
        tenantAgentId: entry?.tenantAgentId,
      }),
    ),
  );
  return runInTransaction(db, () => {
    const now = nowIso();
    db.prepare(
      `INSERT INTO managed_nodes (
         id,
         name,
         shared_secret_hash,
         status,
         node_role,
         created_at,
         updated_at
       )
       VALUES (
         @id,
         @name,
         @sharedSecretHash,
         @status,
         'managed-node',
         @createdAt,
         @updatedAt
       )
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         status = excluded.status,
         node_role = excluded.node_role,
         updated_at = excluded.updated_at`,
    ).run({
      id: nodeId,
      name: normalizeManagedNodeName(node?.name || nodeId),
      // The local node never authenticates inbound requests with this hash, so preserve or seed a placeholder.
      sharedSecretHash: hashPassword(`managed-node:${nodeId}`),
      status: normalizeManagedNodeStatus(node?.status),
      createdAt: now,
      updatedAt: now,
    });
    db.prepare(
      `INSERT INTO managed_node_leases (
         node_id,
         lease_status,
         expires_at,
         readonly_after_expiry,
         issued_at,
         updated_at
       )
       VALUES (
         @nodeId,
         @leaseStatus,
         @expiresAt,
         @readonlyAfterExpiry,
         @issuedAt,
         @updatedAt
       )
       ON CONFLICT(node_id) DO UPDATE SET
         lease_status = excluded.lease_status,
         expires_at = excluded.expires_at,
         readonly_after_expiry = excluded.readonly_after_expiry,
         updated_at = excluded.updated_at`,
    ).run({
      nodeId,
      leaseStatus: lease?.status === "disabled" ? "disabled" : "active",
      expiresAt: String(lease?.expiresAt || "").trim()
        ? normalizeIsoTimestamp(lease.expiresAt)
        : null,
      readonlyAfterExpiry: lease?.readonly === false ? 0 : 1,
      issuedAt: now,
      updatedAt: now,
    });
    ensureManagedNodeSyncStateRow(db, nodeId);
    db.prepare(
      `UPDATE managed_node_sync_state
       SET desired_revision = CASE
             WHEN @desiredRevision > desired_revision THEN @desiredRevision
             ELSE desired_revision
           END,
           last_error = NULL,
           updated_at = @updatedAt
       WHERE node_id = @nodeId`,
    ).run({
      nodeId,
      desiredRevision: desiredRevision > 0 ? desiredRevision : 1,
      updatedAt: now,
    });

    if (tenantIds.length) {
      const tenantPlaceholders = tenantIds.map(() => "?").join(", ");
      db.prepare(`DELETE FROM tenants WHERE id NOT IN (${tenantPlaceholders})`).run(...tenantIds);
      const userPlaceholders = userIds.length ? userIds.map(() => "?").join(", ") : "";
      if (userIds.length) {
        db.prepare(`DELETE FROM users WHERE id NOT IN (${userPlaceholders})`).run(...userIds);
      } else {
        db.prepare("DELETE FROM users").run();
      }
      for (const tenant of tenants) {
        const tenantId = String(tenant?.id || "").trim();
        if (!tenantId) {
          continue;
        }
        db.prepare(
          `INSERT INTO tenants (id, code, name, status, deployment_mode, created_at, updated_at)
           VALUES (@id, @code, @name, @status, @deploymentMode, @createdAt, @updatedAt)
           ON CONFLICT(id) DO UPDATE SET
             code = excluded.code,
             name = excluded.name,
             status = excluded.status,
             deployment_mode = excluded.deployment_mode,
             updated_at = excluded.updated_at`,
        ).run({
          id: tenantId,
          code: String(tenant?.code || tenantId).trim() || tenantId,
          name: String(tenant?.name || tenantId).trim() || tenantId,
          status: String(tenant?.status || "active").trim() || "active",
          deploymentMode:
            String(tenant?.deploymentMode || "cloud").trim() === "local" ? "local" : "cloud",
          createdAt: normalizeIsoTimestamp(tenant?.createdAt, now),
          updatedAt: normalizeIsoTimestamp(tenant?.updatedAt, now),
        });
        db.prepare(
          `INSERT INTO tenant_quotas (
             tenant_id,
             member_limit,
             license_expires_at,
             renewal_code,
             readonly_after_expiry,
             created_at,
             updated_at
           )
           VALUES (@tenantId, @memberLimit, @licenseExpiresAt, NULL, @readonlyAfterExpiry, @createdAt, @updatedAt)
           ON CONFLICT(tenant_id) DO UPDATE SET
             member_limit = excluded.member_limit,
             license_expires_at = excluded.license_expires_at,
             readonly_after_expiry = excluded.readonly_after_expiry,
             updated_at = excluded.updated_at`,
        ).run({
          tenantId,
          memberLimit: Math.max(1, Number.parseInt(String(tenant?.memberLimit || "1"), 10) || 1),
          licenseExpiresAt: String(tenant?.licenseExpiresAt || "").trim() || null,
          readonlyAfterExpiry: Number(tenant?.readonlyAfterExpiry || 0) === 0 ? 0 : 1,
          createdAt: normalizeIsoTimestamp(tenant?.createdAt, now),
          updatedAt: normalizeIsoTimestamp(tenant?.updatedAt, now),
        });
        db.prepare(
          `INSERT INTO tenant_wallets (tenant_id, balance_points, created_at, updated_at)
           VALUES (@tenantId, @balancePoints, @createdAt, @updatedAt)
           ON CONFLICT(tenant_id) DO UPDATE SET
             balance_points = excluded.balance_points,
             updated_at = excluded.updated_at`,
        ).run({
          tenantId,
          balancePoints: roundPoints(toFiniteNumber(tenant?.walletBalance, 0)),
          createdAt: normalizeIsoTimestamp(tenant?.createdAt, now),
          updatedAt: normalizeIsoTimestamp(tenant?.updatedAt, now),
        });
      }
    } else {
      db.prepare("DELETE FROM tenants").run();
      db.prepare("DELETE FROM users").run();
    }

    for (const user of users) {
      const userId = String(user?.id || "").trim();
      if (!userId) {
        continue;
      }
      db.prepare(
        `INSERT INTO users (id, username, password_hash, role, status, created_at, updated_at)
         VALUES (@id, @username, @passwordHash, @role, @status, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           username = excluded.username,
           password_hash = excluded.password_hash,
           role = excluded.role,
           status = excluded.status,
           updated_at = excluded.updated_at`,
      ).run({
        id: userId,
        username: String(user?.username || userId).trim() || userId,
        passwordHash: String(user?.passwordHash || "").trim(),
        role: String(user?.role || "member").trim() || "member",
        status: String(user?.status || "active").trim() || "active",
        createdAt: normalizeIsoTimestamp(user?.createdAt, now),
        updatedAt: normalizeIsoTimestamp(user?.updatedAt, now),
      });
    }

    for (const membership of memberships) {
      const tenantId = String(membership?.tenantId || "").trim();
      const userId = String(membership?.userId || "").trim();
      if (!tenantId || !userId) {
        continue;
      }
      db.prepare(
        `INSERT INTO tenant_memberships (id, tenant_id, user_id, role, status, created_at)
         VALUES (@id, @tenantId, @userId, @role, @status, @createdAt)
         ON CONFLICT(tenant_id, user_id) DO UPDATE SET
           role = excluded.role,
           status = excluded.status`,
      ).run({
        id: String(membership?.id || createId("membership")).trim(),
        tenantId,
        userId,
        role: String(membership?.role || "member").trim() || "member",
        status: String(membership?.status || "active").trim() || "active",
        createdAt: normalizeIsoTimestamp(membership?.createdAt, now),
      });
    }

    if (tenantIds.length) {
      const tenantPlaceholders = tenantIds.map(() => "?").join(", ");
      const localMemberships = db
        .prepare(
          `SELECT tenant_id AS tenantId, user_id AS userId
           FROM tenant_memberships
           WHERE tenant_id IN (${tenantPlaceholders})`,
        )
        .all(...tenantIds);
      for (const row of localMemberships) {
        const membershipKey = `${String(row?.tenantId || "").trim()}::${String(row?.userId || "").trim()}`;
        if (membershipKeys.has(membershipKey)) {
          continue;
        }
        db.prepare(
          `DELETE FROM tenant_memberships
           WHERE tenant_id = @tenantId AND user_id = @userId`,
        ).run({
          tenantId: String(row?.tenantId || "").trim(),
          userId: String(row?.userId || "").trim(),
        });
      }
    }

    for (const tenantAgent of tenantAgents) {
      const tenantAgentId = String(tenantAgent?.id || "").trim();
      if (!tenantAgentId) {
        continue;
      }
      db.prepare(
        `INSERT INTO tenant_agents (
           id,
           tenant_id,
           agent_id,
           description,
           rate_multiplier,
           status,
           balance_points,
           created_at,
           updated_at
         )
         VALUES (
           @id,
           @tenantId,
           @agentId,
           @description,
           @rateMultiplier,
           @status,
           @balancePoints,
           @createdAt,
           @updatedAt
         )
         ON CONFLICT(id) DO UPDATE SET
           tenant_id = excluded.tenant_id,
           agent_id = excluded.agent_id,
           description = excluded.description,
           rate_multiplier = excluded.rate_multiplier,
           status = excluded.status,
           balance_points = excluded.balance_points,
           updated_at = excluded.updated_at`,
      ).run({
        id: tenantAgentId,
        tenantId: String(tenantAgent?.tenantId || "").trim(),
        agentId: String(tenantAgent?.agentId || "").trim(),
        description: String(tenantAgent?.description || "").trim() || null,
        rateMultiplier: toFiniteNumber(tenantAgent?.rateMultiplier, 1),
        status: String(tenantAgent?.status || "active").trim() || "active",
        balancePoints: roundPoints(toFiniteNumber(tenantAgent?.balancePoints, 0)),
        createdAt: normalizeIsoTimestamp(tenantAgent?.createdAt, now),
        updatedAt: normalizeIsoTimestamp(tenantAgent?.updatedAt, now),
      });
    }

    const skillIdByKey = new Map();
    for (const skill of platformSkills) {
      const upsertedSkill = upsertPlatformSkillCatalogEntry(db, {
        skillKey: skill?.skillKey,
        name: skill?.name,
        description: skill?.description,
        classification: skill?.classification,
        sourceType: skill?.sourceType,
        sourceRoot: skill?.sourceRoot,
        sourceWorkspaceDir: skill?.sourceWorkspaceDir,
        status: skill?.status,
        pricePoints: skill?.pricePoints,
        compatibleBaseAgents: skill?.compatibleBaseAgents,
      });
      if (upsertedSkill?.id) {
        skillIdByKey.set(upsertedSkill.skillKey, upsertedSkill.id);
      }
    }
    for (const version of platformSkillVersions) {
      const remoteSkillId = String(version?.skillId || "").trim();
      const localSkillId =
        [...skillIdByKey.entries()].find(([, skillId]) => skillId === remoteSkillId)?.[1] ||
        skillIdByKey.get(
          String(
            platformSkills.find(
              (entry) => String(entry?.latestVersionId || "").trim() === version.id,
            )?.skillKey || "",
          ).trim(),
        ) ||
        remoteSkillId;
      if (!localSkillId) {
        continue;
      }
      const existingVersion = getPlatformSkillVersionById(db, version?.id);
      if (existingVersion?.id) {
        continue;
      }
      db.prepare(
        `INSERT INTO platform_skill_versions (
           id,
           skill_id,
           version_label,
           version_hash,
           skill_md_path,
           skill_md_content,
           skill_metadata_json,
           status,
           created_at,
           updated_at
         ) VALUES (
           @id,
           @skillId,
           @versionLabel,
           @versionHash,
           @skillMdPath,
           @skillMdContent,
           @skillMetadataJson,
           'active',
           @createdAt,
           @updatedAt
         )`,
      ).run({
        id: String(version?.id || "").trim(),
        skillId: localSkillId,
        versionLabel: String(version?.versionLabel || version?.versionHash || "").trim(),
        versionHash: String(version?.versionHash || "").trim(),
        skillMdPath: String(version?.skillMdPath || "").trim(),
        skillMdContent: String(version?.skillMdContent || ""),
        skillMetadataJson: stringifyJsonObject(version?.skillMetadata || {}),
        createdAt: normalizeIsoTimestamp(version?.createdAt, now),
        updatedAt: normalizeIsoTimestamp(version?.updatedAt, now),
      });
    }

    for (const entitlement of tenantSkillEntitlements) {
      ensureTenantSkillEntitlement(db, {
        tenantId: entitlement?.tenantId,
        skillId: entitlement?.skillId,
        status: entitlement?.status,
        acquireType: entitlement?.acquireType,
        versionPolicy: entitlement?.versionPolicy,
        currentVersionId: entitlement?.currentVersionId,
        enabledByTenant: entitlement?.enabledByTenant,
        blockedReason: entitlement?.blockedReason,
        orderId: entitlement?.orderId,
      });
    }

    db.prepare(
      `DELETE FROM tenant_agent_skill_templates
        WHERE tenant_agent_id IN (
          SELECT id FROM tenant_agents WHERE tenant_id IN (${tenantIds.map(() => "?").join(", ")})
        )`,
    ).run(...tenantIds);
    for (const template of tenantAgentSkillTemplates) {
      ensureTenantAgentSkillTemplate(db, {
        tenantAgentId: template?.tenantAgentId,
        skillId: template?.skillId,
        templateState: template?.templateState,
        sourceType: template?.sourceType,
      });
    }

    for (const dataSource of dataSources) {
      const dataSourceId = String(dataSource?.id || "").trim();
      if (!dataSourceId) {
        continue;
      }
      db.prepare(
        `INSERT INTO data_sources (
           id,
           name,
           status,
           connection_json,
           k3cloud_profile_json,
           created_at,
           updated_at
         ) VALUES (
           @id,
           @name,
           @status,
           @connectionJson,
           @k3cloudProfileJson,
           @createdAt,
           @updatedAt
         )
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           status = excluded.status,
           connection_json = excluded.connection_json,
           k3cloud_profile_json = excluded.k3cloud_profile_json,
           updated_at = excluded.updated_at`,
      ).run({
        id: dataSourceId,
        name: String(dataSource?.name || dataSourceId).trim() || dataSourceId,
        status: normalizeDataSourceStatus(dataSource?.status),
        connectionJson: normalizeConnectionJson(
          dataSource?.connectionJson ?? dataSource?.connection_json,
        ),
        k3cloudProfileJson: normalizeK3CloudProfileJson(
          dataSource?.k3cloudProfileJson ?? dataSource?.k3cloud_profile_json,
        ),
        createdAt: normalizeIsoTimestamp(dataSource?.createdAt, now),
        updatedAt: normalizeIsoTimestamp(dataSource?.updatedAt, now),
      });
    }

    for (const binding of tenantDataSourceBindings) {
      const tenantId = String(binding?.tenantId || "").trim();
      const dataSourceId = String(binding?.dataSourceId || "").trim();
      if (!tenantId || !dataSourceId) {
        continue;
      }
      db.prepare(
        `INSERT INTO tenant_data_source_bindings (
           tenant_id,
           data_source_id,
           created_at,
           updated_at
         ) VALUES (
           @tenantId,
           @dataSourceId,
           @createdAt,
           @updatedAt
         )
         ON CONFLICT(tenant_id) DO UPDATE SET
           data_source_id = excluded.data_source_id,
           updated_at = excluded.updated_at`,
      ).run({
        tenantId,
        dataSourceId,
        createdAt: normalizeIsoTimestamp(binding?.createdAt, now),
        updatedAt: normalizeIsoTimestamp(binding?.updatedAt, now),
      });
    }

    if (tenantIds.length) {
      const tenantPlaceholders = tenantIds.map(() => "?").join(", ");
      const localTenantAgents = db
        .prepare(
          `SELECT id
           FROM tenant_agents
           WHERE tenant_id IN (${tenantPlaceholders})`,
        )
        .all(...tenantIds);
      for (const row of localTenantAgents) {
        const tenantAgentId = String(row?.id || "").trim();
        if (!tenantAgentId || tenantAgentIds.has(tenantAgentId)) {
          continue;
        }
        db.prepare(
          `UPDATE tenant_agents
           SET status = 'inactive',
               updated_at = @updatedAt
           WHERE id = @tenantAgentId`,
        ).run({
          tenantAgentId,
          updatedAt: now,
        });
      }
    }

    if (tenantIds.length) {
      const tenantPlaceholders = tenantIds.map(() => "?").join(", ");
      const localAssignments = db
        .prepare(
          `SELECT ua.id AS id,
                  ua.user_id AS userId,
                  ua.tenant_agent_id AS tenantAgentId,
                  ua.derived_agent_id AS derivedAgentId,
                  ua.derived_workspace_dir AS derivedWorkspaceDir
           FROM user_agent_assignments ua
           WHERE ua.tenant_id IN (${tenantPlaceholders}) AND ua.status = 'active'`,
        )
        .all(...tenantIds);
      for (const assignment of userAssignments) {
        const tenantId = String(assignment?.tenantId || "").trim();
        const userId = String(assignment?.userId || "").trim();
        const tenantAgentId = String(assignment?.tenantAgentId || "").trim();
        const derivedAgentId = String(assignment?.derivedAgentId || "").trim();
        if (!tenantId || !userId || !tenantAgentId) {
          continue;
        }
        if (derivedAgentId) {
          const tenantAgent = tenantAgents.find(
            (entry) => String(entry?.id || "").trim() === tenantAgentId,
          );
          const baseAgentId = String(tenantAgent?.agentId || "").trim();
          if (baseAgentId) {
            syncDerivedAgentRuntimeConfigEntry({
              baseAgentId,
              derivedAgentId,
              configPath,
              configDir,
            });
          }
        }
        // Managed-node reconciliation already owns the transaction and must not
        // mutate the control-plane desired revision locally.
        assignTenantAgentToUserCore(db, {
          tenantId,
          userId,
          tenantAgentId,
          configPath,
          configDir,
        });
      }
      const overridesByAssignmentId = new Map();
      for (const override of userAgentSkillOverrides) {
        const assignmentId = String(override?.assignmentId || "").trim();
        if (!assignmentId) {
          continue;
        }
        const existingOverrides = overridesByAssignmentId.get(assignmentId) || [];
        existingOverrides.push({
          skillId: override?.skillId,
          action: override?.action,
        });
        overridesByAssignmentId.set(assignmentId, existingOverrides);
      }
      db.prepare(
        `DELETE FROM user_agent_skill_overrides
          WHERE assignment_id IN (
            SELECT id FROM user_agent_assignments WHERE tenant_id IN (${tenantPlaceholders})
          )`,
      ).run(...tenantIds);
      for (const [assignmentId, overrides] of overridesByAssignmentId.entries()) {
        const assignmentRow = db
          .prepare(
            `SELECT tenant_id AS tenantId,
                    tenant_agent_id AS tenantAgentId,
                    user_id AS userId,
                    derived_agent_id AS derivedAgentId
               FROM user_agent_assignments
              WHERE id = ?`,
          )
          .get(assignmentId);
        if (!assignmentRow) {
          continue;
        }
        setUserAgentSkillOverrides(db, {
          assignmentId,
          tenantAgentId: assignmentRow.tenantAgentId,
          userId: assignmentRow.userId,
          overrides,
        });
        const tenantAgentRow = db
          .prepare(
            `SELECT agent_id AS baseAgentId
               FROM tenant_agents
              WHERE id = ?`,
          )
          .get(assignmentRow.tenantAgentId);
        if (tenantAgentRow?.baseAgentId) {
          const workspace = ensureTenantDerivedWorkspace({
            db,
            tenantId: assignmentRow.tenantId,
            userId: assignmentRow.userId,
            tenantAgentId: assignmentRow.tenantAgentId,
            baseAgentId: tenantAgentRow.baseAgentId,
            derivedAgentId: assignmentRow.derivedAgentId,
            assignmentId,
            configPath,
            configDir,
          });
          syncDerivedAgentRuntimeConfigEntry({
            baseAgentId: tenantAgentRow.baseAgentId,
            derivedAgentId: assignmentRow.derivedAgentId,
            skills: workspace?.resolvedSkillKeys || [],
            configPath,
            configDir,
          });
        }
      }
      for (const row of localAssignments) {
        const assignmentKey = buildManagedNodeAssignmentKey(row);
        if (activeAssignmentKeys.has(assignmentKey)) {
          continue;
        }
        revokeAssignmentEntriesWithCleanup(db, {
          whereClause: "id = ? AND status = 'active'",
          bindings: [String(row?.id || "").trim()],
          configPath,
          configDir,
        });
      }

      const localBindings = db
        .prepare(
          `SELECT tenant_id AS tenantId, data_source_id AS dataSourceId
           FROM tenant_data_source_bindings
           WHERE tenant_id IN (${tenantPlaceholders})`,
        )
        .all(...tenantIds);
      for (const row of localBindings) {
        const tenantId = String(row?.tenantId || "").trim();
        if (tenantBindingTenantIds.has(tenantId)) {
          continue;
        }
        db.prepare("DELETE FROM tenant_data_source_bindings WHERE tenant_id = ?").run(tenantId);
      }
    }

    db.prepare(
      `UPDATE managed_node_sync_state
       SET desired_revision = CASE
             WHEN @desiredRevision > desired_revision THEN @desiredRevision
             ELSE desired_revision
           END,
           last_applied_revision = @lastAppliedRevision,
           last_sync_at = @lastSyncAt,
           last_error = NULL,
           updated_at = @updatedAt
       WHERE node_id = @nodeId`,
    ).run({
      nodeId,
      desiredRevision: desiredRevision > 0 ? desiredRevision : 1,
      lastAppliedRevision: desiredRevision > 0 ? desiredRevision : 0,
      lastSyncAt: now,
      updatedAt: now,
    });
    return {
      nodeId,
      tenantCount: tenantIds.length,
      userCount: userIds.length,
      assignmentCount: activeAssignmentKeys.size,
      desiredRevision: desiredRevision > 0 ? desiredRevision : 1,
    };
  });
}

export function getTenantSummary(db, tenantId) {
  return (
    db
      .prepare(
        `SELECT t.id, t.code, t.name, t.status, t.deployment_mode AS deploymentMode,
              tq.member_limit AS memberLimit, tq.license_expires_at AS licenseExpiresAt,
              tw.balance_points AS walletBalance,
              tnb.node_id AS boundNodeId,
              mn.name AS boundNodeName,
              COUNT(DISTINCT CASE WHEN tm.role = 'member' AND tm.status = 'active' THEN tm.user_id END) AS memberCount,
              COUNT(DISTINCT CASE WHEN ta.status = 'active' THEN ta.id END) AS agentCount
       FROM tenants t
       LEFT JOIN tenant_quotas tq ON tq.tenant_id = t.id
       LEFT JOIN tenant_wallets tw ON tw.tenant_id = t.id
       LEFT JOIN tenant_node_bindings tnb ON tnb.tenant_id = t.id
       LEFT JOIN managed_nodes mn ON mn.id = tnb.node_id
       LEFT JOIN tenant_memberships tm ON tm.tenant_id = t.id
       LEFT JOIN tenant_agents ta ON ta.tenant_id = t.id
       WHERE t.id = ?
       GROUP BY t.id, tq.member_limit, tq.license_expires_at, tw.balance_points, tnb.node_id, mn.name`,
      )
      .get(tenantId) ?? null
  );
}

export function listDataSources(db, params = {}) {
  const search = normalizeLikeSearch(params.search);
  const whereSql = search
    ? `WHERE name LIKE @search ESCAPE '\\' OR id LIKE @search ESCAPE '\\'`
    : "";
  return db
    .prepare(
      `SELECT id,
              name,
              source_type AS sourceType,
              status,
              connection_json AS connectionJson,
              source_dbid AS sourceDbid,
              source_tenant_code AS sourceTenantCode,
              k3cloud_profile_json AS k3cloudProfileJson,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM data_sources
       ${whereSql}
       ORDER BY updated_at DESC, created_at DESC`,
    )
    .all(search ? { search } : {})
    .map(mapDataSourceRow);
}

export function getDataSourceById(db, dataSourceId) {
  const normalized = String(dataSourceId || "").trim();
  if (!normalized) {
    return null;
  }
  return mapDataSourceRow(
    db
      .prepare(
        `SELECT id,
                name,
                source_type AS sourceType,
                status,
                connection_json AS connectionJson,
                source_dbid AS sourceDbid,
                source_tenant_code AS sourceTenantCode,
                k3cloud_profile_json AS k3cloudProfileJson,
                created_at AS createdAt,
                updated_at AS updatedAt
         FROM data_sources
         WHERE id = ?`,
      )
      .get(normalized),
  );
}

export function upsertDataSource(db, params = {}) {
  const id = String(params.id || "").trim();
  const name = String(params.name || "").trim();
  if (!name) {
    throw new Error("data_source_name_required");
  }
  const now = nowIso();
  const status = normalizeDataSourceStatus(params.status);
  const connectionJson = normalizeConnectionJson(params.connectionJson ?? params.connection_json);
  const k3cloudProfileJson = normalizeK3CloudProfileJson(
    params.k3cloudProfileJson ?? params.k3cloud_profile_json,
  );
  if (id) {
    const existing = getDataSourceById(db, id);
    if (!existing) {
      throw new Error("data_source_not_found");
    }
    db.prepare(
      `UPDATE data_sources
       SET name = @name,
           status = @status,
           connection_json = @connectionJson,
           k3cloud_profile_json = @k3cloudProfileJson,
           updated_at = @updatedAt
       WHERE id = @id`,
    ).run({
      id,
      name,
      status,
      connectionJson,
      k3cloudProfileJson,
      updatedAt: now,
    });
    return getDataSourceById(db, id);
  }

  const nextId = createId("data_source");
  db.prepare(
    `INSERT INTO data_sources (
       id,
       name,
       status,
       connection_json,
       k3cloud_profile_json,
       created_at,
       updated_at
     ) VALUES (
       @id,
       @name,
       @status,
       @connectionJson,
       @k3cloudProfileJson,
       @createdAt,
       @updatedAt
     )`,
  ).run({
    id: nextId,
    name,
    status,
    connectionJson,
    k3cloudProfileJson,
    createdAt: now,
    updatedAt: now,
  });
  return getDataSourceById(db, nextId);
}

export function getTenantDataSourceBinding(db, tenantId) {
  const normalizedTenantId = String(tenantId || "").trim();
  if (!normalizedTenantId) {
    return null;
  }
  const mapped = mapTenantDataSourceBindingRow(
    db
      .prepare(
        `SELECT b.tenant_id AS tenantId,
                b.data_source_id AS dataSourceId,
                d.name AS dataSourceName,
                b.created_at AS createdAt,
                b.updated_at AS updatedAt
         FROM tenant_data_source_bindings b
         LEFT JOIN data_sources d ON d.id = b.data_source_id
         WHERE b.tenant_id = ?`,
      )
      .get(normalizedTenantId),
  );
  if (mapped?.dataSourceId) {
    ensureDataSourceLegacyMetadata(db, mapped.dataSourceId);
    return mapTenantDataSourceBindingRow({
      ...mapped,
    });
  }
  return ensureTenantLegacyDefaultDataSourceBinding(db, normalizedTenantId);
}

export function listTenantDataSourceBindings(db) {
  return db
    .prepare(
      `SELECT b.tenant_id AS tenantId,
              b.data_source_id AS dataSourceId,
              d.name AS dataSourceName,
              b.created_at AS createdAt,
              b.updated_at AS updatedAt
       FROM tenant_data_source_bindings b
       LEFT JOIN data_sources d ON d.id = b.data_source_id
       ORDER BY b.updated_at DESC, b.created_at DESC`,
    )
    .all()
    .map(mapTenantDataSourceBindingRow);
}

export function bindTenantDataSource(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const dataSourceId = String(params.dataSourceId || "").trim();
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }
  if (!dataSourceId) {
    throw new Error("data_source_id_required");
  }
  const tenant = getTenantSummary(db, tenantId);
  if (!tenant) {
    throw new Error("tenant_not_found");
  }
  const dataSource = getDataSourceById(db, dataSourceId);
  if (!dataSource) {
    throw new Error("data_source_not_found");
  }
  const now = nowIso();
  db.prepare(
    `INSERT INTO tenant_data_source_bindings (
       tenant_id,
       data_source_id,
       created_at,
       updated_at
     ) VALUES (
       @tenantId,
       @dataSourceId,
       @createdAt,
       @updatedAt
     )
     ON CONFLICT(tenant_id) DO UPDATE SET
       data_source_id = excluded.data_source_id,
       updated_at = excluded.updated_at`,
  ).run({
    tenantId,
    dataSourceId,
    createdAt: now,
    updatedAt: now,
  });
  syncTenantDerivedAgentProfiles(db, tenantId);
  bumpManagedNodeDesiredRevisionForTenant(db, tenantId);
  return getTenantDataSourceBinding(db, tenantId);
}

export function clearTenantDataSourceBinding(db, tenantId) {
  const normalizedTenantId = String(tenantId || "").trim();
  if (!normalizedTenantId) {
    throw new Error("tenant_id_required");
  }
  db.prepare("DELETE FROM tenant_data_source_bindings WHERE tenant_id = ?").run(normalizedTenantId);
  bumpManagedNodeDesiredRevisionForTenant(db, normalizedTenantId);
  return true;
}

export function upsertSyncSchedule(db, params = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const dataSourceId = String(params.dataSourceId || "").trim();
  const objectCode = String(params.objectCode || "").trim();
  const moduleName = String(params.moduleName || "").trim();
  const derivedWorkspaceDir = String(
    params.derivedWorkspaceDir || params.workspaceDir || "",
  ).trim();
  if (!tenantId || !dataSourceId || !objectCode || !derivedWorkspaceDir) {
    throw new Error("sync_schedule_params_required");
  }
  const intervalMinutes = normalizeTenantSyncIntervalMinutes(params.intervalMinutes);
  const defaultStart = normalizeDefaultStart(params.defaultStart);
  const status = normalizeTenantSyncScheduleStatus(params.status);
  const activatedByUserId = String(params.activatedByUserId || "").trim() || null;
  const now = nowIso();
  const existing = db
    .prepare(
      `SELECT id
       FROM tenant_sync_schedules
       WHERE tenant_id = ? AND data_source_id = ? AND object_code = ?`,
    )
    .get(tenantId, dataSourceId, objectCode);
  if (existing?.id) {
    db.prepare(
      `UPDATE tenant_sync_schedules
       SET module_name = @moduleName,
           derived_workspace_dir = @derivedWorkspaceDir,
           status = @status,
           interval_minutes = @intervalMinutes,
           default_start = @defaultStart,
           activated_by_user_id = @activatedByUserId,
           updated_at = @updatedAt
       WHERE id = @id`,
    ).run({
      id: existing.id,
      moduleName,
      derivedWorkspaceDir,
      status,
      intervalMinutes,
      defaultStart,
      activatedByUserId,
      updatedAt: now,
    });
    return getSyncScheduleById(db, existing.id);
  }

  const id = createId("sync_sched");
  db.prepare(
    `INSERT INTO tenant_sync_schedules (
       id,
       tenant_id,
       data_source_id,
       object_code,
       module_name,
       derived_workspace_dir,
       status,
       interval_minutes,
       default_start,
       activated_by_user_id,
       created_at,
       updated_at
     ) VALUES (
       @id,
       @tenantId,
       @dataSourceId,
       @objectCode,
       @moduleName,
       @derivedWorkspaceDir,
       @status,
       @intervalMinutes,
       @defaultStart,
       @activatedByUserId,
       @createdAt,
       @updatedAt
     )`,
  ).run({
    id,
    tenantId,
    dataSourceId,
    objectCode,
    moduleName,
    derivedWorkspaceDir,
    status,
    intervalMinutes,
    defaultStart,
    activatedByUserId,
    createdAt: now,
    updatedAt: now,
  });
  return getSyncScheduleById(db, id);
}

export function getSyncScheduleById(db, scheduleId) {
  const normalized = String(scheduleId || "").trim();
  if (!normalized) {
    return null;
  }
  return mapTenantSyncScheduleRow(
    db
      .prepare(
        `SELECT id,
                tenant_id AS tenantId,
                data_source_id AS dataSourceId,
                object_code AS objectCode,
                module_name AS moduleName,
                derived_workspace_dir AS derivedWorkspaceDir,
                status,
                interval_minutes AS intervalMinutes,
                default_start AS defaultStart,
                activated_by_user_id AS activatedByUserId,
                last_run_at AS lastRunAt,
                last_run_status AS lastRunStatus,
                last_run_error AS lastRunError,
                last_run_duration_ms AS lastRunDurationMs,
                created_at AS createdAt,
                updated_at AS updatedAt
         FROM tenant_sync_schedules
         WHERE id = ?`,
      )
      .get(normalized),
  );
}

export function listActiveSyncSchedules(db) {
  return db
    .prepare(
      `SELECT id,
              tenant_id AS tenantId,
              data_source_id AS dataSourceId,
              object_code AS objectCode,
              module_name AS moduleName,
              derived_workspace_dir AS derivedWorkspaceDir,
              status,
              interval_minutes AS intervalMinutes,
              default_start AS defaultStart,
              activated_by_user_id AS activatedByUserId,
              last_run_at AS lastRunAt,
              last_run_status AS lastRunStatus,
              last_run_error AS lastRunError,
              last_run_duration_ms AS lastRunDurationMs,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM tenant_sync_schedules
       WHERE status = 'active'
       ORDER BY COALESCE(last_run_at, '') ASC, created_at ASC`,
    )
    .all()
    .map(mapTenantSyncScheduleRow);
}

export function listTenantSyncSchedules(db, tenantId) {
  const normalizedTenantId = String(tenantId || "").trim();
  if (!normalizedTenantId) {
    return [];
  }
  return db
    .prepare(
      `SELECT id,
              tenant_id AS tenantId,
              data_source_id AS dataSourceId,
              object_code AS objectCode,
              module_name AS moduleName,
              derived_workspace_dir AS derivedWorkspaceDir,
              status,
              interval_minutes AS intervalMinutes,
              default_start AS defaultStart,
              activated_by_user_id AS activatedByUserId,
              last_run_at AS lastRunAt,
              last_run_status AS lastRunStatus,
              last_run_error AS lastRunError,
              last_run_duration_ms AS lastRunDurationMs,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM tenant_sync_schedules
       WHERE tenant_id = ?
       ORDER BY updated_at DESC, created_at DESC`,
    )
    .all(normalizedTenantId)
    .map(mapTenantSyncScheduleRow);
}

export function deactivateSyncSchedule(db, scheduleId) {
  const normalized = String(scheduleId || "").trim();
  if (!normalized) {
    throw new Error("sync_schedule_id_required");
  }
  db.prepare(
    `UPDATE tenant_sync_schedules
     SET status = 'paused',
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: normalized,
    updatedAt: nowIso(),
  });
  return getSyncScheduleById(db, normalized);
}

export function updateSyncScheduleRunResult(db, scheduleId, params = {}) {
  const normalized = String(scheduleId || "").trim();
  if (!normalized) {
    throw new Error("sync_schedule_id_required");
  }
  db.prepare(
    `UPDATE tenant_sync_schedules
     SET last_run_at = @lastRunAt,
         last_run_status = @lastRunStatus,
         last_run_error = @lastRunError,
         last_run_duration_ms = @lastRunDurationMs,
         updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: normalized,
    lastRunAt: nowIso(),
    lastRunStatus: String(params.status || "").trim() || null,
    lastRunError: String(params.error || "").trim() || null,
    lastRunDurationMs:
      params.durationMs === undefined || params.durationMs === null
        ? null
        : Math.max(0, Number.parseInt(String(params.durationMs), 10) || 0),
    updatedAt: nowIso(),
  });
  return getSyncScheduleById(db, normalized);
}

export function listTenants(db) {
  return db
    .prepare(
      `SELECT t.id, t.code, t.name, t.status, t.deployment_mode AS deploymentMode,
              tq.member_limit AS memberLimit, tq.license_expires_at AS licenseExpiresAt,
              tw.balance_points AS walletBalance,
              tnb.node_id AS boundNodeId,
              mn.name AS boundNodeName,
              COUNT(DISTINCT CASE WHEN tm.role = 'member' AND tm.status = 'active' THEN tm.user_id END) AS memberCount,
              COUNT(DISTINCT CASE WHEN ta.status = 'active' THEN ta.id END) AS agentCount
       FROM tenants t
       LEFT JOIN tenant_quotas tq ON tq.tenant_id = t.id
       LEFT JOIN tenant_wallets tw ON tw.tenant_id = t.id
       LEFT JOIN tenant_node_bindings tnb ON tnb.tenant_id = t.id
       LEFT JOIN managed_nodes mn ON mn.id = tnb.node_id
       LEFT JOIN tenant_memberships tm ON tm.tenant_id = t.id
       LEFT JOIN tenant_agents ta ON ta.tenant_id = t.id
       GROUP BY t.id, tq.member_limit, tq.license_expires_at, tw.balance_points, tnb.node_id, mn.name
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

  bumpManagedNodeDesiredRevisionForTenant(db, tenantId);
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

  bumpManagedNodeDesiredRevisionForTenant(db, tenantId);
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
              COUNT(DISTINCT ua.tenant_agent_id) AS assignedAgentCount
       FROM users u
       JOIN tenant_memberships tm ON tm.user_id = u.id
       LEFT JOIN user_agent_assignments ua ON ua.user_id = u.id AND ua.status = 'active'
       WHERE tm.tenant_id = ? AND tm.role = 'member' AND tm.status != 'deleted' AND u.id = ?
       GROUP BY u.id, tm.role, tm.created_at`,
      )
      .get(tenantId, userId) ?? null
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
       WHERE tm.tenant_id = ? AND tm.role = 'member' AND tm.status != 'deleted'
       GROUP BY u.id, tm.role, tm.created_at
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
    bumpManagedNodeDesiredRevisionForTenant(db, tenantId);
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
    bumpManagedNodeDesiredRevisionForTenant(db, tenantId);
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
    bumpManagedNodeDesiredRevisionForTenant(db, tenantId);

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
    bumpManagedNodeDesiredRevisionForTenant(db, params.tenantId);
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
  bumpManagedNodeDesiredRevisionForTenant(db, params.tenantId);
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
      const blockedSkillKeys = listTenantAgentSkillTemplates(db, String(row.id || "").trim())
        .filter((entry) => entry.templateState === SKILL_TEMPLATE_STATE_BLOCKED)
        .map((entry) => entry.skillKey);
      return {
        ...row,
        agentName: configEntry?.name ?? row.agentId,
        emoji: configEntry?.emoji ?? null,
        avatar: configEntry?.avatar ?? null,
        blockedSkillKeys,
        assignmentBlocked: blockedSkillKeys.length > 0,
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

  const nextAssignmentId = String(existing?.id || "").trim() || createId("assignment");

  if (!existing) {
    db.prepare(
      `INSERT INTO user_agent_assignments
         (id, tenant_id, user_id, tenant_agent_id, derived_agent_id, derived_workspace_dir, status, created_at)
       VALUES
         (@id, @tenantId, @userId, @tenantAgentId, @derivedAgentId, NULL, 'active', @createdAt)`,
    ).run({
      id: nextAssignmentId,
      tenantId: params.tenantId,
      userId: params.userId,
      tenantAgentId: params.tenantAgentId,
      derivedAgentId,
      createdAt: nowIso(),
    });
  }

  const resolvedSkillState = resolveAssignmentSkillState(db, {
    tenantId: params.tenantId,
    tenantAgentId: params.tenantAgentId,
    assignmentId: nextAssignmentId,
    baseAgentId: tenantAgent.baseAgentId,
    configPath: params.configPath,
    configDir: params.configDir,
  });
  if (resolvedSkillState.blockedReasons.length) {
    setAssignmentStatus(db, {
      assignmentId: nextAssignmentId,
      status: ASSIGNMENT_STATUS_BLOCKED_MISSING_SKILLS,
      derivedAgentId,
      derivedWorkspaceDir: existing?.derivedWorkspaceDir || null,
    });
    upsertTenantAgentSkillSnapshot(db, {
      assignmentId: nextAssignmentId,
      tenantId: params.tenantId,
      tenantAgentId: params.tenantAgentId,
      userId: params.userId,
      derivedAgentId,
      resolvedSkillKeys: resolvedSkillState.resolvedEntries.map((entry) => entry.skillKey),
      resolvedVersionIds: resolvedSkillState.resolvedEntries.map((entry) => entry.versionId),
      blockedReasons: resolvedSkillState.blockedReasons,
    });
    throw createResolvedSkillError(resolvedSkillState.blockedReasons);
  }

  const workspace = ensureTenantDerivedWorkspace({
    db,
    tenantId: params.tenantId,
    userId: params.userId,
    tenantAgentId: params.tenantAgentId,
    baseAgentId: tenantAgent.baseAgentId,
    derivedAgentId,
    assignmentId: nextAssignmentId,
    configPath: params.configPath,
    configDir: params.configDir,
  });
  syncDerivedAgentRuntimeConfigEntry({
    baseAgentId: tenantAgent.baseAgentId,
    derivedAgentId,
    skills: workspace.resolvedSkillKeys,
    configPath: params.configPath,
    configDir: params.configDir,
  });
  syncDerivedAgentExecApprovals({
    baseAgentId: tenantAgent.baseAgentId,
    derivedAgentId,
    configPath: params.configPath,
    configDir: params.configDir,
  });
  syncDerivedAgentTenantAnalyticsProfile(db, {
    tenantId: params.tenantId,
    derivedWorkspaceDir: workspace.canonicalWorkspace,
    workspaceDir: workspace.canonicalWorkspace,
  });
  syncDerivedAgentK3CloudProfile(db, {
    tenantId: params.tenantId,
    derivedWorkspaceDir: workspace.canonicalWorkspace,
    workspaceDir: workspace.canonicalWorkspace,
  });

  upsertTenantAgentSkillSnapshot(db, {
    assignmentId: nextAssignmentId,
    tenantId: params.tenantId,
    tenantAgentId: params.tenantAgentId,
    userId: params.userId,
    derivedAgentId,
    resolvedSkillKeys: workspace.resolvedSkillKeys,
    resolvedVersionIds: workspace.resolvedVersionIds,
    blockedReasons: workspace.blockedReasons,
  });

  if (existing) {
    setAssignmentStatus(db, {
      assignmentId: existing.id,
      status: ASSIGNMENT_STATUS_ACTIVE,
      derivedAgentId,
      derivedWorkspaceDir: workspace.canonicalWorkspace,
    });
    return {
      assignmentId: existing.id,
      derivedAgentId,
      blockedReasons: workspace.blockedReasons,
    };
  }
  setAssignmentStatus(db, {
    assignmentId: nextAssignmentId,
    status: ASSIGNMENT_STATUS_ACTIVE,
    derivedAgentId,
    derivedWorkspaceDir: workspace.canonicalWorkspace,
  });
  return {
    assignmentId: nextAssignmentId,
    derivedAgentId,
    blockedReasons: workspace.blockedReasons,
  };
}

export function assignTenantAgentToUser(db, params) {
  const result = runInTransaction(db, () => assignTenantAgentToUserCore(db, params));
  bumpManagedNodeDesiredRevisionForTenant(db, params.tenantId);
  return result;
}

export function assignTenantAgentsToUser(db, params) {
  const tenantId = String(params.tenantId || "").trim();
  const userId = String(params.userId || "").trim();
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
  if (!userId) {
    throw new Error("user_id_required");
  }
  if (!tenantAgentIds.length) {
    throw new Error("tenant_agent_ids_required");
  }

  const result = runInTransaction(db, () => {
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
  bumpManagedNodeDesiredRevisionForTenant(db, tenantId);
  return result;
}

export function revokePlatformTenantAgents(db, params) {
  const tenantId = String(params.tenantId || "").trim();
  const actorUserId = String(params.actorUserId || "").trim();
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

  const result = runInTransaction(db, () => {
    const placeholders = tenantAgentIds.map(() => "?").join(", ");
    const updatedAt = nowIso();
    const selectedTenantAgents = db
      .prepare(
        `SELECT id, agent_id AS agentId, balance_points AS balancePoints
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
    const refundableAgents = selectedTenantAgents
      .map((tenantAgent) => ({
        id: String(tenantAgent.id || "").trim(),
        agentId: String(tenantAgent.agentId || "").trim(),
        balancePoints: normalizeNonNegativePoints(tenantAgent.balancePoints),
      }))
      .filter((tenantAgent) => tenantAgent.id);
    db.prepare(
      `UPDATE tenant_agents
       SET status = 'inactive',
           balance_points = 0,
           updated_at = ?
       WHERE tenant_id = ? AND status = 'active' AND id IN (${resolvedPlaceholders})`,
    ).run(updatedAt, tenantId, ...revokedTenantAgentIds);

    let refundedPoints = 0;
    let walletBalanceAfter = getTenantWalletBalance(db, tenantId);
    for (const tenantAgent of refundableAgents) {
      if (tenantAgent.balancePoints <= 0) {
        continue;
      }
      refundedPoints = normalizeNonNegativePoints(refundedPoints + tenantAgent.balancePoints);
      walletBalanceAfter = normalizeNonNegativePoints(
        walletBalanceAfter + tenantAgent.balancePoints,
      );
      db.prepare(
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
           'credit',
           'agent_revoke_refund',
           @amountPoints,
           @balanceAfter,
           @tenantAgentId,
           @actorUserId,
           @note,
           @createdAt
         )`,
      ).run({
        id: createId("ledger"),
        tenantId,
        amountPoints: tenantAgent.balancePoints,
        balanceAfter: walletBalanceAfter,
        tenantAgentId: tenantAgent.id,
        actorUserId: actorUserId || null,
        note: `revoke:${tenantAgent.id}:${tenantAgent.agentId || tenantAgent.id}`,
        createdAt: updatedAt,
      });
    }

    if (refundedPoints > 0) {
      db.prepare(
        `UPDATE tenant_wallets
         SET balance_points = @balancePoints,
             updated_at = @updatedAt
         WHERE tenant_id = @tenantId`,
      ).run({
        tenantId,
        balancePoints: walletBalanceAfter,
        updatedAt,
      });
    }

    const revokedAssignments = revokeAssignmentEntriesWithCleanup(db, {
      ...params,
      whereClause: `tenant_id = ? AND status = 'active' AND tenant_agent_id IN (${resolvedPlaceholders})`,
      bindings: [tenantId, ...revokedTenantAgentIds],
    });
    return {
      revokedTenantAgentCount: revokedTenantAgentIds.length,
      revokedAssignmentCount: revokedAssignments.revokedAssignmentCount,
      tenantAgentIds: revokedTenantAgentIds,
      affectedUserIds: revokedAssignments.affectedUserIds,
      affectedMemberCount: revokedAssignments.affectedMemberCount,
      refundedPoints,
      walletBalance: walletBalanceAfter,
      removedWorkspaceCount: revokedAssignments.removedWorkspaceCount,
      removedWorkspacePathCount: revokedAssignments.removedWorkspacePathCount,
      cleanedApprovalBucketCount: revokedAssignments.cleanedApprovalBucketCount,
    };
  });
  bumpManagedNodeDesiredRevisionForTenant(db, tenantId);
  return result;
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

  const result = runInTransaction(db, () => {
    if (assignmentIds.length) {
      const placeholders = assignmentIds.map(() => "?").join(", ");
      const selectClauses = ["tenant_id = ?", "status = 'active'", `id IN (${placeholders})`];
      const bindings = [tenantId, ...assignmentIds];
      if (userId) {
        selectClauses.push("user_id = ?");
        bindings.push(userId);
      }
      return revokeAssignmentEntriesWithCleanup(db, {
        ...params,
        whereClause: selectClauses.join(" AND "),
        bindings,
      });
    }

    const placeholders = userIds.map(() => "?").join(", ");
    return revokeAssignmentEntriesWithCleanup(db, {
      ...params,
      whereClause: `tenant_id = ? AND status = 'active' AND user_id IN (${placeholders})`,
      bindings: [tenantId, ...userIds],
    });
  });
  bumpManagedNodeDesiredRevisionForTenant(db, tenantId);
  return result;
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
      let workspace = null;
      if (!resolvedAgentId) {
        resolvedAgentId = deriveTenantMemberAgentId({
          tenantId: row.tenantId,
          userId: row.userId,
          tenantAgentId: row.tenantAgentId,
          baseAgentId: row.baseAgentId,
        });
      }
      workspace = ensureTenantDerivedWorkspace({
        db,
        tenantId: row.tenantId,
        userId: row.userId,
        tenantAgentId: row.tenantAgentId,
        baseAgentId: row.baseAgentId,
        derivedAgentId: resolvedAgentId,
        assignmentId: row.assignmentId,
        configPath: params.configPath,
        configDir: params.configDir,
      });
      upsertTenantAgentSkillSnapshot(db, {
        assignmentId: row.assignmentId,
        tenantId: row.tenantId,
        tenantAgentId: row.tenantAgentId,
        userId: row.userId,
        derivedAgentId: resolvedAgentId,
        resolvedSkillKeys: workspace?.resolvedSkillKeys || [],
        resolvedVersionIds: workspace?.resolvedVersionIds || [],
        blockedReasons: workspace?.blockedReasons || [],
      });
      syncDerivedAgentRuntimeConfigEntry({
        baseAgentId: row.baseAgentId,
        derivedAgentId: resolvedAgentId,
        skills: workspace?.resolvedSkillKeys,
        configPath: params.configPath,
        configDir: params.configDir,
      });
      if (Array.isArray(workspace?.blockedReasons) && workspace.blockedReasons.length) {
        setAssignmentStatus(db, {
          assignmentId: row.assignmentId,
          status: ASSIGNMENT_STATUS_BLOCKED_MISSING_SKILLS,
          derivedAgentId: resolvedAgentId,
          derivedWorkspaceDir:
            workspace?.canonicalWorkspace || String(row.derivedWorkspaceDir || "").trim(),
        });
        return null;
      }
      setAssignmentStatus(db, {
        assignmentId: row.assignmentId,
        status: ASSIGNMENT_STATUS_ACTIVE,
        derivedAgentId: resolvedAgentId,
        derivedWorkspaceDir:
          workspace?.canonicalWorkspace || String(row.derivedWorkspaceDir || "").trim(),
      });
      if (
        String(row.derivedAgentId || "").trim() !== resolvedAgentId ||
        String(row.derivedWorkspaceDir || "").trim() !== workspace.canonicalWorkspace
      ) {
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
      syncDerivedAgentTenantAnalyticsProfile(db, {
        tenantId: row.tenantId,
        derivedWorkspaceDir:
          workspace?.canonicalWorkspace || String(row.derivedWorkspaceDir || "").trim(),
        workspaceDir: workspace?.canonicalWorkspace || String(row.derivedWorkspaceDir || "").trim(),
      });
      syncDerivedAgentK3CloudProfile(db, {
        tenantId: row.tenantId,
        derivedWorkspaceDir:
          workspace?.canonicalWorkspace || String(row.derivedWorkspaceDir || "").trim(),
        workspaceDir: workspace?.canonicalWorkspace || String(row.derivedWorkspaceDir || "").trim(),
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
        derivedAgentId: resolvedAgentId,
        derivedWorkspaceDir:
          workspace?.canonicalWorkspace || String(row.derivedWorkspaceDir || "").trim(),
        agentId,
        baseAgentId,
        agentName: displayName || baseAgentId || agentId,
        displayName,
        emoji: configEntry?.emoji ?? null,
        avatar: configEntry?.avatar ?? null,
        blockedSkillReasons: workspace?.blockedReasons || [],
      };
    })
    .filter(Boolean);
}

function normalizeWorkspaceVisualizationRelativePath(relativePath) {
  const normalized = path.posix
    .normalize(
      String(relativePath || "")
        .trim()
        .replace(/\\/g, "/"),
    )
    .replace(/^(\.\/)+/, "");
  if (
    !normalized ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    path.posix.isAbsolute(normalized)
  ) {
    return "";
  }
  return normalized;
}

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
    const files = [];
    const pendingDirs = [{ absoluteDir: echartsDir, relativeDir: "" }];
    while (pendingDirs.length > 0) {
      const current = pendingDirs.pop();
      if (!current) {
        continue;
      }
      const entries = fs
        .readdirSync(current.absoluteDir, { withFileTypes: true })
        .toSorted((left, right) => left.name.localeCompare(right.name, "zh-Hans-CN"));
      for (const entry of entries) {
        const relativePath = normalizeWorkspaceVisualizationRelativePath(
          current.relativeDir ? path.posix.join(current.relativeDir, entry.name) : entry.name,
        );
        if (!relativePath) {
          continue;
        }
        if (entry.isDirectory()) {
          pendingDirs.push({
            absoluteDir: path.join(current.absoluteDir, entry.name),
            relativeDir: relativePath,
          });
          continue;
        }
        if (entry.isFile() && /_index\.html$/i.test(entry.name)) {
          files.push(relativePath);
        }
      }
    }
    return files.toSorted((left, right) => left.localeCompare(right, "zh-Hans-CN"));
  } catch {
    return [];
  }
}

function stripVisualizationIndexSuffix(fileName) {
  return String(fileName || "")
    .trim()
    .replace(/_index\.html$/i, "");
}

export function listAssignedAgentVisualizationsForUser(db, params, configAgents = []) {
  return listAssignedAgentsForUser(db, params, configAgents).flatMap((agent) =>
    listWorkspaceVisualizationFiles(agent.derivedWorkspaceDir).map((visualizationRelativePath) => {
      const visualizationFileName = path.posix.basename(visualizationRelativePath);
      return {
        ...agent,
        visualizationFileName,
        visualizationName: stripVisualizationIndexSuffix(visualizationRelativePath),
        visualizationRelativePath,
      };
    }),
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
      .filter((entry) => entry.isFile() && /_sandbox\.json$/i.test(entry.name))
      .map((entry) => entry.name)
      .toSorted((left, right) => left.localeCompare(right, "zh-Hans-CN"))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function stripSandboxJsonSuffix(fileName) {
  return String(fileName || "")
    .trim()
    .replace(/_sandbox\.json$/i, "");
}

const DEFAULT_SANDBOX_FILE_NAME = "采购沙盒模拟_sandbox.json";

function createDefaultSandboxEntry(agent) {
  const baseAgentId = String(agent?.baseAgentId || "").trim();
  const sandboxName = baseAgentId === "kingdee-cloud" ? "真实金蝶采购预测验证" : "采购沙盒模拟";
  return {
    ...agent,
    sandboxFileName: DEFAULT_SANDBOX_FILE_NAME,
    sandboxName,
    sandboxRelativePath: path.posix.join("Sandbox", DEFAULT_SANDBOX_FILE_NAME),
    isVirtualSandbox: true,
  };
}

export function listAssignedAgentSandboxesForUser(db, params, configAgents = []) {
  return listAssignedAgentsForUser(db, params, configAgents).flatMap((agent) => {
    const sandboxFiles = listWorkspaceSandboxFiles(agent.derivedWorkspaceDir);
    if (!sandboxFiles.length) {
      return [createDefaultSandboxEntry(agent)];
    }
    return sandboxFiles.map((sandboxFileName) => ({
      ...agent,
      sandboxFileName,
      sandboxName: stripSandboxJsonSuffix(sandboxFileName),
      sandboxRelativePath: path.posix.join("Sandbox", sandboxFileName),
      isVirtualSandbox: false,
    }));
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
  const normalizedRecords = applyUsageSettlementFallbackToUsageRecords(
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

    const previewRecords = applyUsageSettlementFallbackToUsageRecords(
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
      (record, index) =>
        !normalizeOptionalPositiveCost(records[index]?.totalCost) && record.totalCost,
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

function normalizePaymentAmount(value) {
  const numeric = Math.round(toFiniteNumber(value, 0) * 100) / 100;
  return numeric > 0 ? numeric : 0;
}

function readPaymentProviderPayload(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stringifyPaymentProviderPayload(value) {
  return JSON.stringify(value && typeof value === "object" ? value : {});
}

function hydratePaymentOrderRow(row) {
  if (!row) {
    return null;
  }
  const providerPayload = readPaymentProviderPayload(row.providerPayload);
  return {
    id: String(row.id || "").trim(),
    tenantId: String(row.tenantId || row.tenant_id || "").trim(),
    amountCny: normalizePaymentAmount(row.amountCny ?? row.amount_cny),
    amountPoints: normalizeNonNegativePoints(row.amountPoints ?? row.amount_points),
    provider: String(row.provider || "").trim(),
    status: String(row.status || "").trim(),
    providerOrderId: String(row.providerOrderId || row.provider_order_id || "").trim(),
    providerPayload,
    channel: String(providerPayload.channel || "").trim(),
    createdAt: String(row.createdAt || row.created_at || "").trim(),
    updatedAt: String(row.updatedAt || row.updated_at || "").trim(),
  };
}

function getTenantWalletBalance(db, tenantId) {
  return normalizeNonNegativePoints(
    getScalar(db, "SELECT balance_points FROM tenant_wallets WHERE tenant_id = ?", [tenantId]) || 0,
  );
}

function getPendingPaymentOrderCount(db, tenantId) {
  return Number(
    getScalar(
      db,
      `SELECT COUNT(*)
       FROM payment_orders
       WHERE tenant_id = ?
         AND status IN ('pending_payment', 'processing', 'pending_confirmation')`,
      [tenantId],
    ) || 0,
  );
}

function resolveTenantAgentDisplayName(agentRow, configMap) {
  const agentId = String(agentRow?.agentId || agentRow?.agent_id || "").trim();
  const configEntry = configMap?.get(agentId) ?? null;
  return (
    String(configEntry?.name || "").trim() ||
    String(agentRow?.tenantAgentDescription || agentRow?.description || "").trim() ||
    agentId ||
    String(agentRow?.tenantAgentId || agentRow?.tenant_agent_id || "").trim() ||
    "未知 Agent"
  );
}

export function createTenantPaymentOrder(db, params) {
  const tenantId = String(params.tenantId || "").trim();
  const createdByUserId = String(params.createdByUserId || "").trim();
  const provider = String(params.provider || "allinpay").trim() || "allinpay";
  const amountCny = normalizePaymentAmount(params.amountCny);
  const amountPoints = normalizePaymentAmount(params.amountPoints || amountCny);
  const channel = String(params.channel || "").trim() || "allinpay_h5_auto";
  if (!tenantId || !createdByUserId || amountCny <= 0 || amountPoints <= 0) {
    throw new Error("missing_fields");
  }

  const tenant = db
    .prepare(
      `SELECT id
       FROM tenants
       WHERE id = ?
       LIMIT 1`,
    )
    .get(tenantId);
  if (!tenant) {
    throw new Error("tenant_not_found");
  }

  const now = nowIso();
  const id = createId("payment");
  const providerPayload = {
    channel,
    createdByUserId,
    latestProviderResult: null,
  };

  db.prepare(
    `INSERT INTO payment_orders (
       id,
       tenant_id,
       amount_cny,
       amount_points,
       provider,
       status,
       provider_order_id,
       provider_payload,
       created_at,
       updated_at
     ) VALUES (
       @id,
       @tenantId,
       @amountCny,
       @amountPoints,
       @provider,
       'pending_payment',
       NULL,
       @providerPayload,
       @createdAt,
       @updatedAt
     )`,
  ).run({
    id,
    tenantId,
    amountCny,
    amountPoints,
    provider,
    providerPayload: stringifyPaymentProviderPayload(providerPayload),
    createdAt: now,
    updatedAt: now,
  });

  return getTenantPaymentOrderById(db, {
    tenantId,
    orderId: id,
  });
}

export function getTenantPaymentOrderById(db, params) {
  const tenantId = String(params.tenantId || "").trim();
  const orderId = String(params.orderId || params.id || "").trim();
  if (!tenantId || !orderId) {
    return null;
  }
  const row = db
    .prepare(
      `SELECT
         id,
         tenant_id AS tenantId,
         amount_cny AS amountCny,
         amount_points AS amountPoints,
         provider,
         status,
         provider_order_id AS providerOrderId,
         provider_payload AS providerPayload,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM payment_orders
       WHERE tenant_id = ? AND id = ?
       LIMIT 1`,
    )
    .get(tenantId, orderId);
  return hydratePaymentOrderRow(row);
}

function normalizePagedListSize(value, fallback = 20) {
  return Math.min(100, Math.max(1, Number.parseInt(String(value || fallback), 10) || fallback));
}

function normalizePagedListPage(value) {
  return Math.max(1, Number.parseInt(String(value || "1"), 10) || 1);
}

function normalizeLikeSearch(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  return `%${normalized.replace(/[\\%_]/g, "\\$&")}%`;
}

export function listTenantPaymentOrdersPage(db, params) {
  const tenantId = String(params.tenantId || "").trim();
  const page = normalizePagedListPage(params.page);
  const pageSize = normalizePagedListSize(params.pageSize, 20);
  const offset = (page - 1) * pageSize;
  const search = normalizeLikeSearch(params.search);
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }

  const searchClause = search
    ? `
         AND (
           id LIKE @search ESCAPE '\\'
           OR status LIKE @search ESCAPE '\\'
           OR provider LIKE @search ESCAPE '\\'
           OR provider_order_id LIKE @search ESCAPE '\\'
         )`
    : "";
  const bindings = search
    ? {
        tenantId,
        search,
        limit: pageSize,
        offset,
      }
    : {
        tenantId,
        limit: pageSize,
        offset,
      };
  const countBindings = search ? { tenantId, search } : { tenantId };
  const total = Number(
    getScalar(
      db,
      `SELECT COUNT(*) AS value
       FROM payment_orders
       WHERE tenant_id = @tenantId${searchClause}`,
      countBindings,
    ) || 0,
  );
  const rows = db
    .prepare(
      `SELECT
         id,
         tenant_id AS tenantId,
         amount_cny AS amountCny,
         amount_points AS amountPoints,
         provider,
         status,
         provider_order_id AS providerOrderId,
         provider_payload AS providerPayload,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM payment_orders
       WHERE tenant_id = @tenantId${searchClause}
       ORDER BY created_at DESC
       LIMIT @limit OFFSET @offset`,
    )
    .all(bindings);
  return {
    items: rows.map((row) => hydratePaymentOrderRow(row)),
    total,
    page,
    pageSize,
  };
}

export function listTenantPaymentOrders(db, params) {
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(params.limit || "20"), 10) || 20));
  return listTenantPaymentOrdersPage(db, {
    tenantId: params.tenantId,
    page: 1,
    pageSize: limit,
  }).items;
}

export function listTenantWalletLedgerEntriesPage(db, params, configAgents = [], options = {}) {
  const tenantId = String(params.tenantId || "").trim();
  const page = normalizePagedListPage(params.page);
  const pageSize = normalizePagedListSize(params.pageSize, 20);
  const offset = (page - 1) * pageSize;
  const search = normalizeLikeSearch(params.search);
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }
  const configMap = new Map((configAgents || []).map((entry) => [entry.id, entry]));
  const categories = Array.isArray(options.categories)
    ? [
        ...new Set(
          options.categories.map((category) => String(category || "").trim()).filter(Boolean),
        ),
      ]
    : [];
  const excludeCategories = Array.isArray(options.excludeCategories)
    ? [
        ...new Set(
          options.excludeCategories
            .map((category) => String(category || "").trim())
            .filter(Boolean),
        ),
      ]
    : [];
  let categoryClause = "";
  const categoryBindings = {};
  const countCategoryBindings = {};
  if (categories.length) {
    const placeholders = categories.map((_, index) => `@category_${index}`).join(", ");
    categoryClause = ` AND l.category IN (${placeholders})`;
    categories.forEach((category, index) => {
      categoryBindings[`category_${index}`] = category;
      countCategoryBindings[`category_${index}`] = category;
    });
  } else if (excludeCategories.length) {
    const placeholders = excludeCategories
      .map((_, index) => `@exclude_category_${index}`)
      .join(", ");
    categoryClause = ` AND l.category NOT IN (${placeholders})`;
    excludeCategories.forEach((category, index) => {
      categoryBindings[`exclude_category_${index}`] = category;
      countCategoryBindings[`exclude_category_${index}`] = category;
    });
  }
  const searchClause = search
    ? `
         AND (
           l.id LIKE @search ESCAPE '\\'
           OR l.category LIKE @search ESCAPE '\\'
           OR l.direction LIKE @search ESCAPE '\\'
           OR l.payment_order_id LIKE @search ESCAPE '\\'
           OR l.note LIKE @search ESCAPE '\\'
           OR ta.agent_id LIKE @search ESCAPE '\\'
           OR ta.description LIKE @search ESCAPE '\\'
         )`
    : "";
  const bindings = search
    ? {
        tenantId,
        search,
        limit: pageSize,
        offset,
        ...categoryBindings,
      }
    : {
        tenantId,
        limit: pageSize,
        offset,
        ...categoryBindings,
      };
  const countBindings = search
    ? { tenantId, search, ...countCategoryBindings }
    : { tenantId, ...countCategoryBindings };
  const total = Number(
    getScalar(
      db,
      `SELECT COUNT(*) AS value
       FROM tenant_wallet_ledger l
       LEFT JOIN tenant_agents ta ON ta.id = l.tenant_agent_id
       WHERE l.tenant_id = @tenantId${categoryClause}${searchClause}`,
      countBindings,
    ) || 0,
  );
  const rows = db
    .prepare(
      `SELECT
         l.id,
         l.direction,
         l.category,
         l.amount_points AS amountPoints,
         l.balance_after AS balanceAfter,
         l.tenant_agent_id AS tenantAgentId,
         l.payment_order_id AS paymentOrderId,
         l.actor_user_id AS actorUserId,
         l.note,
         l.created_at AS createdAt,
         ta.agent_id AS agentId,
         ta.description AS tenantAgentDescription
       FROM tenant_wallet_ledger l
       LEFT JOIN tenant_agents ta ON ta.id = l.tenant_agent_id
       WHERE l.tenant_id = @tenantId${categoryClause}${searchClause}
       ORDER BY l.created_at DESC
       LIMIT @limit OFFSET @offset`,
    )
    .all(bindings);

  return {
    items: rows.map((row) => ({
      id: String(row.id || "").trim(),
      direction: String(row.direction || "").trim(),
      category: String(row.category || "").trim(),
      amountPoints: normalizeNonNegativePoints(row.amountPoints),
      balanceAfter: normalizeNonNegativePoints(row.balanceAfter),
      tenantAgentId: String(row.tenantAgentId || "").trim(),
      paymentOrderId: String(row.paymentOrderId || "").trim(),
      actorUserId: String(row.actorUserId || "").trim(),
      note: String(row.note || "").trim(),
      createdAt: String(row.createdAt || "").trim(),
      agentId: String(row.agentId || "").trim(),
      tenantAgentName: resolveTenantAgentDisplayName(row, configMap),
    })),
    total,
    page,
    pageSize,
  };
}

export function listTenantModelUsageEntriesPage(db, params, configAgents = []) {
  return listTenantWalletLedgerEntriesPage(db, params, configAgents, {
    categories: ["usage_charge"],
  });
}

export function listTenantWalletFlowEntriesPage(db, params, configAgents = []) {
  return listTenantWalletLedgerEntriesPage(db, params, configAgents, {
    excludeCategories: ["usage_charge"],
  });
}

export function listTenantWalletLedgerEntries(db, params, configAgents = []) {
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(params.limit || "20"), 10) || 20));
  return listTenantWalletLedgerEntriesPage(
    db,
    {
      tenantId: params.tenantId,
      page: 1,
      pageSize: limit,
    },
    configAgents,
  ).items;
}

export function getTenantWalletDashboard(db, params, configAgents = []) {
  const tenantId = String(params.tenantId || "").trim();
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }

  const totalRecharged = normalizeNonNegativePoints(
    getScalar(
      db,
      `SELECT SUM(amount_points)
       FROM tenant_wallet_ledger
       WHERE tenant_id = ?
         AND direction = 'credit'
         AND category = 'recharge'`,
      [tenantId],
    ) || 0,
  );
  const totalTransferred = normalizeNonNegativePoints(
    getScalar(
      db,
      `SELECT SUM(amount_points)
       FROM tenant_wallet_ledger
       WHERE tenant_id = ?
         AND direction = 'debit'
         AND category = 'agent_transfer'`,
      [tenantId],
    ) || 0,
  );
  const latestPaidOrder = db
    .prepare(
      `SELECT updated_at AS updatedAt
       FROM payment_orders
       WHERE tenant_id = ? AND status = 'paid'
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .get(tenantId);

  return {
    summary: {
      walletBalance: getTenantWalletBalance(db, tenantId),
      totalRecharged,
      totalTransferred,
      consumedCredits: getTenantConsumedCredits(db, tenantId),
      pendingOrderCount: getPendingPaymentOrderCount(db, tenantId),
      latestPaidAt: String(latestPaidOrder?.updatedAt || "").trim() || null,
    },
    orders: listTenantPaymentOrders(db, { tenantId, limit: params.orderLimit || 20 }),
    ledger: listTenantWalletLedgerEntries(
      db,
      { tenantId, limit: params.ledgerLimit || 20 },
      configAgents,
    ),
  };
}

export function updateTenantPaymentOrderStatus(db, params) {
  const tenantId = String(params.tenantId || "").trim();
  const orderId = String(params.orderId || params.id || "").trim();
  const status = String(params.status || "").trim();
  if (!tenantId || !orderId || !status) {
    throw new Error("missing_fields");
  }
  return runInTransaction(db, () => {
    const existing = getTenantPaymentOrderById(db, { tenantId, orderId });
    if (!existing) {
      throw new Error("payment_order_not_found");
    }
    const providerPayload = {
      ...existing.providerPayload,
      ...(params.providerPayload && typeof params.providerPayload === "object"
        ? params.providerPayload
        : {}),
    };
    const updatedAt = nowIso();
    db.prepare(
      `UPDATE payment_orders
       SET status = @status,
           provider_order_id = @providerOrderId,
           provider_payload = @providerPayload,
           updated_at = @updatedAt
       WHERE tenant_id = @tenantId AND id = @orderId`,
    ).run({
      tenantId,
      orderId,
      status,
      providerOrderId:
        String(
          params.providerOrderId ||
            existing.providerOrderId ||
            providerPayload.providerOrderId ||
            "",
        ).trim() || null,
      providerPayload: stringifyPaymentProviderPayload(providerPayload),
      updatedAt,
    });
    return getTenantPaymentOrderById(db, { tenantId, orderId });
  });
}

export function confirmTenantPaymentOrderPaid(db, params) {
  const tenantId = String(params.tenantId || "").trim();
  const orderId = String(params.orderId || params.id || "").trim();
  const providerOrderId = String(params.providerOrderId || "").trim();
  if (!tenantId || !orderId) {
    throw new Error("missing_fields");
  }

  return runInTransaction(db, () => {
    const order = getTenantPaymentOrderById(db, { tenantId, orderId });
    if (!order) {
      throw new Error("payment_order_not_found");
    }

    const existingLedger = db
      .prepare(
        `SELECT id
         FROM tenant_wallet_ledger
         WHERE tenant_id = ?
           AND payment_order_id = ?
           AND category = 'recharge'
         LIMIT 1`,
      )
      .get(tenantId, orderId);

    const mergedProviderPayload = {
      ...order.providerPayload,
      ...(params.providerPayload && typeof params.providerPayload === "object"
        ? params.providerPayload
        : {}),
    };
    if (providerOrderId) {
      mergedProviderPayload.providerOrderId = providerOrderId;
    }
    mergedProviderPayload.paidAt = nowIso();

    if (existingLedger) {
      db.prepare(
        `UPDATE payment_orders
         SET status = 'paid',
             provider_order_id = @providerOrderId,
             provider_payload = @providerPayload,
             updated_at = @updatedAt
         WHERE tenant_id = @tenantId AND id = @orderId`,
      ).run({
        tenantId,
        orderId,
        providerOrderId: providerOrderId || order.providerOrderId || null,
        providerPayload: stringifyPaymentProviderPayload(mergedProviderPayload),
        updatedAt: nowIso(),
      });
      return {
        credited: false,
        alreadyPaid: true,
        order: getTenantPaymentOrderById(db, { tenantId, orderId }),
        walletBalance: getTenantWalletBalance(db, tenantId),
      };
    }

    const walletBalanceBefore = getTenantWalletBalance(db, tenantId);
    const walletBalanceAfter = normalizeNonNegativePoints(walletBalanceBefore + order.amountPoints);
    const updatedAt = nowIso();
    db.prepare(
      `UPDATE tenant_wallets
       SET balance_points = @balancePoints,
           updated_at = @updatedAt
       WHERE tenant_id = @tenantId`,
    ).run({
      tenantId,
      balancePoints: walletBalanceAfter,
      updatedAt,
    });

    db.prepare(
      `UPDATE payment_orders
       SET status = 'paid',
           provider_order_id = @providerOrderId,
           provider_payload = @providerPayload,
           updated_at = @updatedAt
       WHERE tenant_id = @tenantId AND id = @orderId`,
    ).run({
      tenantId,
      orderId,
      providerOrderId: providerOrderId || order.providerOrderId || null,
      providerPayload: stringifyPaymentProviderPayload(mergedProviderPayload),
      updatedAt,
    });

    db.prepare(
      `INSERT INTO tenant_wallet_ledger (
         id,
         tenant_id,
         direction,
         category,
         amount_points,
         balance_after,
         payment_order_id,
         actor_user_id,
         note,
         created_at
       ) VALUES (
         @id,
         @tenantId,
         'credit',
         'recharge',
         @amountPoints,
         @balanceAfter,
         @paymentOrderId,
         @actorUserId,
         @note,
         @createdAt
       )`,
    ).run({
      id: createId("ledger"),
      tenantId,
      amountPoints: order.amountPoints,
      balanceAfter: walletBalanceAfter,
      paymentOrderId: order.id,
      actorUserId:
        String(params.actorUserId || order.providerPayload.createdByUserId || "").trim() || null,
      note: String(params.note || `recharge:${order.id}`).trim(),
      createdAt: updatedAt,
    });

    return {
      credited: true,
      alreadyPaid: false,
      order: getTenantPaymentOrderById(db, { tenantId, orderId }),
      walletBalance: getTenantWalletBalance(db, tenantId),
    };
  });
}

export function transferTenantWalletToAgent(db, params) {
  const tenantId = String(params.tenantId || "").trim();
  const tenantAgentId = String(params.tenantAgentId || "").trim();
  const actorUserId = String(params.actorUserId || "").trim();
  const amountPoints = normalizePaymentAmount(params.amountPoints);
  if (!tenantId || !tenantAgentId || !actorUserId || amountPoints <= 0) {
    throw new Error("missing_fields");
  }

  return runInTransaction(db, () => {
    const tenantAgent = db
      .prepare(
        `SELECT id, tenant_id AS tenantId, agent_id AS agentId, description, balance_points AS balancePoints, status
         FROM tenant_agents
         WHERE tenant_id = ? AND id = ?
         LIMIT 1`,
      )
      .get(tenantId, tenantAgentId);
    if (!tenantAgent) {
      throw new Error("tenant_agent_not_found");
    }
    if (String(tenantAgent.status || "").trim() !== "active") {
      throw new Error("tenant_agent_inactive");
    }

    const walletBalanceBefore = getTenantWalletBalance(db, tenantId);
    if (walletBalanceBefore < amountPoints) {
      throw new Error("insufficient_wallet_balance");
    }

    const walletBalanceAfter = normalizeNonNegativePoints(walletBalanceBefore - amountPoints);
    const agentBalanceAfter = normalizeNonNegativePoints(
      normalizeNonNegativePoints(tenantAgent.balancePoints) + amountPoints,
    );
    const createdAt = nowIso();
    const budgetId = createId("budget");

    db.prepare(
      `UPDATE tenant_wallets
       SET balance_points = @balancePoints,
           updated_at = @updatedAt
       WHERE tenant_id = @tenantId`,
    ).run({
      tenantId,
      balancePoints: walletBalanceAfter,
      updatedAt: createdAt,
    });

    db.prepare(
      `UPDATE tenant_agents
       SET balance_points = @balancePoints,
           updated_at = @updatedAt
       WHERE id = @tenantAgentId`,
    ).run({
      tenantAgentId,
      balancePoints: agentBalanceAfter,
      updatedAt: createdAt,
    });

    db.prepare(
      `INSERT INTO tenant_agent_budgets (
         id,
         tenant_id,
         tenant_agent_id,
         amount_points,
         created_by_user_id,
         created_at
       ) VALUES (
         @id,
         @tenantId,
         @tenantAgentId,
         @amountPoints,
         @actorUserId,
         @createdAt
       )`,
    ).run({
      id: budgetId,
      tenantId,
      tenantAgentId,
      amountPoints,
      actorUserId,
      createdAt,
    });

    db.prepare(
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
         'agent_transfer',
         @amountPoints,
         @balanceAfter,
         @tenantAgentId,
         @actorUserId,
         @note,
         @createdAt
       )`,
    ).run({
      id: createId("ledger"),
      tenantId,
      amountPoints,
      balanceAfter: walletBalanceAfter,
      tenantAgentId,
      actorUserId,
      note:
        String(params.note || "").trim() ||
        `transfer:${budgetId}:${String(tenantAgent.agentId || "").trim() || tenantAgentId}`,
      createdAt,
    });

    return {
      budgetId,
      tenantAgentId,
      walletBalance: walletBalanceAfter,
      agentBalance: agentBalanceAfter,
      amountPoints,
    };
  });
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
  const pendingPaymentOrderCount = getPendingPaymentOrderCount(db, tenantId);

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
      pendingPaymentOrderCount,
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
