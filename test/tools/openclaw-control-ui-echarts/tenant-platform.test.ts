import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  openTenantPlatformDb,
  closeTenantPlatformDb,
  createPlatformUpdateLog,
  createBootstrapPlatformAdmin,
  deleteTenantMember,
  deletePlatformUpdateLog,
  createTenantWithAdmin,
  createTenantMember,
  getUserByUsername,
  listTenants,
  listPlatformUpdateLogs,
  listTenantAgents,
  listTenantMembers,
  readOpenClawAgentCatalog,
  repairTenantUsageCostGaps,
  upsertTenantAgent,
  assignTenantAgentToUser,
  revokePlatformTenantAgents,
  listAssignedAgentsForUser,
  listAssignedAgentVisualizationsForUser,
  getTenantOverview,
  listTenantUsageRecords,
  syncTenantUsageRecords,
  updatePlatformUpdateLog,
  updateTenantMemberLimit,
  updateTenantMemberPassword,
  updateTenantMemberStatus,
} from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/db.mjs";
import {
  buildDashboardManifestHtml,
  createTenantPlatformRouter,
  rewriteVisualizationHtml,
} from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/routes.mjs";
import {
  issueSessionToken,
  verifyPassword,
} from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/auth.mjs";

const cleanupRoots = new Set();
const cleanupServers = new Set();
const TENANT_DB_MODULE_PATH =
  "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/db.mjs";

function createTempSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-tenant-platform-"));
  cleanupRoots.add(root);
  const configDir = path.join(root, ".openclaw");
  fs.mkdirSync(configDir, { recursive: true });
  const configPath = path.join(configDir, "openclaw.json");
  fs.writeFileSync(
    configPath,
      JSON.stringify({
        agents: {
          list: [
            {
              id: "finance",
            name: "财务分析助手",
            identity: {
              emoji: "💼",
              avatar: "avatars/finance.png",
            },
          },
        ],
      },
    }),
    "utf8",
  );
  return {
    root,
    config: {
      configDir,
      stateDir: path.join(configDir, "tenant-platform"),
      dbPath: path.join(configDir, "tenant-platform", "tenant-platform.sqlite"),
      configPath,
      disableAutoDiscoveredDataSources: true,
    },
  };
}

function readExecApprovals(sandbox) {
  const approvalsPath = path.join(sandbox.config.configDir, "exec-approvals.json");
  if (!fs.existsSync(approvalsPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(approvalsPath, "utf8"));
}

function writeExecApprovals(sandbox, payload) {
  const approvalsPath = path.join(sandbox.config.configDir, "exec-approvals.json");
  fs.writeFileSync(approvalsPath, JSON.stringify(payload, null, 2), "utf8");
}

function writeSessionStoreEntry(sandbox, agentId, sessionKey, entry) {
  const sessionsDir = path.join(sandbox.config.configDir, "agents", agentId, "sessions");
  fs.mkdirSync(sessionsDir, { recursive: true });
  const storePath = path.join(sessionsDir, "sessions.json");
  const current =
    fs.existsSync(storePath) && fs.statSync(storePath).size > 0
      ? JSON.parse(fs.readFileSync(storePath, "utf8"))
      : {};
  current[sessionKey] = {
    ...(current[sessionKey] && typeof current[sessionKey] === "object" ? current[sessionKey] : {}),
    ...entry,
  };
  fs.writeFileSync(storePath, JSON.stringify(current, null, 2), "utf8");
}

async function loadTenantPlatformDbModule() {
  return import(TENANT_DB_MODULE_PATH);
}

function createTenantPlatformServerConfig(sandbox) {
  return {
    edition: "cloud",
    bindHost: "127.0.0.1",
    port: 0,
    apiBasePath: "/tenant-platform-api/v1",
    sessionSecret: "tenant-platform-route-test-secret",
    localLicensePath: path.join(sandbox.config.stateDir, "local-license.json"),
    localLicensePublicKey: "",
    localLicensePublicKeyPath: path.join(sandbox.config.stateDir, "license-public.pem"),
    ...sandbox.config,
  };
}

async function startTenantPlatformServer(sandbox, extraDeps = {}) {
  const config = createTenantPlatformServerConfig(sandbox);
  const db = openTenantPlatformDb(config);
  const router = createTenantPlatformRouter({ config, db, ...extraDeps });
  const server = http.createServer((request, response) => {
    Promise.resolve(router(request, response)).catch((error) => {
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanupServers.add({ server, db });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("tenant_platform_server_address_invalid");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}${config.apiBasePath}`,
    config,
    db,
  };
}

async function requestTenantPlatformJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  return {
    status: response.status,
    payload,
  };
}

function issueTenantPlatformTestToken(config, session) {
  return issueSessionToken(session, config.sessionSecret);
}

afterEach(async () => {
  for (const item of cleanupServers) {
    await new Promise((resolve) => item.server.close(resolve));
    closeTenantPlatformDb(item.db);
  }
  cleanupServers.clear();
  for (const root of cleanupRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  cleanupRoots.clear();
});

describe("tenant platform database foundation", () => {
  describe("data source persistence", () => {
    it("creates and lists data source records", async () => {
      const { listDataSources, upsertDataSource } = await loadTenantPlatformDbModule();
      const sandbox = createTempSandbox();
      const db = openTenantPlatformDb(sandbox.config);
      try {
        const created = upsertDataSource(db, {
          code: "kd-main",
          name: "金蝶主账套",
          sourceType: "kingdee_analytics",
          status: "active",
          connection: {
            host: "db.internal",
            port: 5432,
            database: "kingdee_main",
          },
          sourceDbid: "db-main",
          sourceTenantCode: "tenant-main",
        });

        expect(created).toMatchObject({
          code: "kd-main",
          name: "金蝶主账套",
          sourceType: "kingdee_analytics",
          status: "active",
          sourceDbid: "db-main",
          sourceTenantCode: "tenant-main",
        });
        expect(created.connection).toMatchObject({
          host: "db.internal",
          port: 5432,
          database: "kingdee_main",
        });
        expect(listDataSources(db)).toEqual([
          expect.objectContaining({
            id: created.id,
            code: "kd-main",
            name: "金蝶主账套",
            sourceType: "kingdee_analytics",
          }),
        ]);
      } finally {
        closeTenantPlatformDb(db);
      }
    });

    it("keeps one data source binding per tenant and exposes binding summaries", async () => {
      const { getTenantDataSourceBinding, setTenantDataSourceBinding, upsertDataSource } =
        await loadTenantPlatformDbModule();
      const sandbox = createTempSandbox();
      const db = openTenantPlatformDb(sandbox.config);
      try {
        const platformAdmin = createBootstrapPlatformAdmin(db, {
          username: "platform-root",
          password: "secret",
        });
        const tenant = createTenantWithAdmin(db, {
          code: "binding-alpha",
          name: "租户 Binding Alpha",
          adminUsername: "binding-alpha-admin",
          adminPassword: "secret",
          memberLimit: 3,
          deploymentMode: "cloud",
          licenseExpiresAt: null,
          renewalCode: null,
        });
        const firstSource = upsertDataSource(db, {
          code: "kd-binding-a",
          name: "绑定账套 A",
          sourceType: "kingdee_analytics",
          connection: { host: "db-a.internal" },
        });
        const secondSource = upsertDataSource(db, {
          code: "kd-binding-b",
          name: "绑定账套 B",
          sourceType: "kingdee_analytics",
          connection: { host: "db-b.internal" },
        });

        setTenantDataSourceBinding(db, {
          tenantId: tenant.id,
          dataSourceId: firstSource.id,
          boundByUserId: platformAdmin?.id,
        });
        const rebound = setTenantDataSourceBinding(db, {
          tenantId: tenant.id,
          dataSourceId: secondSource.id,
          boundByUserId: platformAdmin?.id,
        });

        expect(rebound).toMatchObject({
          tenantId: tenant.id,
          dataSourceId: secondSource.id,
          dataSourceName: "绑定账套 B",
          dataSourceType: "kingdee_analytics",
        });
        expect(getTenantDataSourceBinding(db, tenant.id)).toMatchObject({
          tenantId: tenant.id,
          dataSourceId: secondSource.id,
          dataSourceName: "绑定账套 B",
          dataSourceType: "kingdee_analytics",
        });
        expect(
          db
            .prepare(
              `SELECT COUNT(*) AS count
               FROM tenant_data_source_bindings
               WHERE tenant_id = ?`,
            )
            .get(tenant.id)?.count,
        ).toBe(1);
        expect(listTenants(db)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: tenant.id,
              dataSourceId: secondSource.id,
              dataSourceName: "绑定账套 B",
              dataSourceType: "kingdee_analytics",
            }),
          ]),
        );
      } finally {
        closeTenantPlatformDb(db);
      }
    });

    it("rejects binding one data source to multiple platform tenants", async () => {
      const { getTenantDataSourceBinding, setTenantDataSourceBinding, upsertDataSource } =
        await loadTenantPlatformDbModule();
      const sandbox = createTempSandbox();
      const db = openTenantPlatformDb(sandbox.config);
      try {
        const platformAdmin = createBootstrapPlatformAdmin(db, {
          username: "platform-root",
          password: "secret",
        });
        const firstTenant = createTenantWithAdmin(db, {
          code: "binding-first",
          name: "租户 First",
          adminUsername: "binding-first-admin",
          adminPassword: "secret",
          memberLimit: 3,
          deploymentMode: "cloud",
          licenseExpiresAt: null,
          renewalCode: null,
        });
        const secondTenant = createTenantWithAdmin(db, {
          code: "binding-second",
          name: "租户 Second",
          adminUsername: "binding-second-admin",
          adminPassword: "secret",
          memberLimit: 3,
          deploymentMode: "cloud",
          licenseExpiresAt: null,
          renewalCode: null,
        });
        const source = upsertDataSource(db, {
          code: "kd-shared",
          name: "共享账套",
          sourceType: "kingdee_analytics",
          connection: { host: "db-shared.internal" },
        });

        setTenantDataSourceBinding(db, {
          tenantId: firstTenant.id,
          dataSourceId: source.id,
          boundByUserId: platformAdmin?.id,
        });

        expect(() =>
          setTenantDataSourceBinding(db, {
            tenantId: secondTenant.id,
            dataSourceId: source.id,
            boundByUserId: platformAdmin?.id,
          }),
        ).toThrow("data_source_already_bound");
        expect(getTenantDataSourceBinding(db, firstTenant.id)).toMatchObject({
          tenantId: firstTenant.id,
          dataSourceId: source.id,
        });
        expect(getTenantDataSourceBinding(db, secondTenant.id)).toBeNull();
      } finally {
        closeTenantPlatformDb(db);
      }
    });

    it("stores binding-aware data source org scopes and clears custom scopes after rebinding", async () => {
      const {
        getTenantDataSourceBinding,
        getTenantMemberOrgScope,
        resolveMemberDataAccessContext,
        setTenantDataSourceBinding,
        setTenantMemberOrgScope,
        upsertDataSource,
      } = await loadTenantPlatformDbModule();
      const sandbox = createTempSandbox();
      const db = openTenantPlatformDb(sandbox.config);
      try {
        createBootstrapPlatformAdmin(db, {
          username: "platform-root",
          password: "secret",
        });
        const tenant = createTenantWithAdmin(db, {
          code: "scope-alpha",
          name: "租户 Scope Alpha",
          adminUsername: "scope-alpha-admin",
          adminPassword: "secret",
          memberLimit: 3,
          deploymentMode: "cloud",
          licenseExpiresAt: null,
          renewalCode: null,
        });
        const tenantAdmin = getUserByUsername(db, "scope-alpha-admin");
        const member = createTenantMember(db, {
          tenantId: tenant.id,
          username: "scope-member",
          password: "secret",
        });
        const firstSource = upsertDataSource(db, {
          code: "kd-scope-a",
          name: "组织账套 A",
          sourceType: "kingdee_analytics",
          connection: {
            host: "db-scope-a.internal",
            database: "scope_a",
          },
        });
        const secondSource = upsertDataSource(db, {
          code: "kd-scope-b",
          name: "组织账套 B",
          sourceType: "kingdee_analytics",
          connection: {
            host: "db-scope-b.internal",
            database: "scope_b",
          },
        });

        setTenantDataSourceBinding(db, {
          tenantId: tenant.id,
          dataSourceId: firstSource.id,
          boundByUserId: tenantAdmin?.id,
        });
        expect(listTenantMembers(db, tenant.id)).toEqual([
          expect.objectContaining({
            id: member.id,
            orgScopeMode: "none",
            orgScopeCount: 0,
          }),
        ]);
        expect(() =>
          resolveMemberDataAccessContext(db, {
            tenantId: tenant.id,
            userId: member.id,
          }),
        ).toThrowError("member_org_scope_empty");

        setTenantMemberOrgScope(db, {
          tenantId: tenant.id,
          userId: member.id,
          dataSourceId: firstSource.id,
          scopeMode: "custom",
          createdByUserId: tenantAdmin?.id,
          orgScopes: [
            {
              orgId: "1001",
              orgNameSnapshot: "华东事业部",
            },
            {
              orgId: "1002",
              orgNameSnapshot: "华南事业部",
            },
          ],
        });

        expect(
          db
            .prepare(
              `SELECT scope_mode AS scopeMode
               FROM tenant_member_source_policies
               WHERE tenant_id = ? AND user_id = ? AND data_source_id = ?`,
            )
            .get(tenant.id, member.id, firstSource.id),
        ).toMatchObject({
          scopeMode: "custom",
        });
        expect(
          db
            .prepare(
              `SELECT org_id AS orgId, org_name_snapshot AS orgNameSnapshot
               FROM tenant_member_org_scopes
               WHERE tenant_id = ? AND user_id = ? AND data_source_id = ?
               ORDER BY org_id ASC`,
            )
            .all(tenant.id, member.id, firstSource.id),
        ).toEqual([
          {
            orgId: "1001",
            orgNameSnapshot: "华东事业部",
          },
          {
            orgId: "1002",
            orgNameSnapshot: "华南事业部",
          },
        ]);
        expect(
          getTenantMemberOrgScope(db, {
            tenantId: tenant.id,
            userId: member.id,
            dataSourceId: firstSource.id,
          }),
        ).toMatchObject({
          tenantId: tenant.id,
          userId: member.id,
          dataSourceId: firstSource.id,
          scopeMode: "custom",
          orgScopeCount: 2,
        });
        expect(listTenantMembers(db, tenant.id)).toEqual([
          expect.objectContaining({
            id: member.id,
            orgScopeMode: "custom",
            orgScopeCount: 2,
          }),
        ]);
        expect(
          resolveMemberDataAccessContext(db, {
            tenantId: tenant.id,
            userId: member.id,
          }),
        ).toMatchObject({
          tenantId: tenant.id,
          userId: member.id,
          dataSourceId: firstSource.id,
          sourceType: "kingdee_analytics",
          scopeMode: "custom",
          allowedOrgIds: ["1001", "1002"],
        });

        setTenantMemberOrgScope(db, {
          tenantId: tenant.id,
          userId: member.id,
          dataSourceId: firstSource.id,
          scopeMode: "all",
          createdByUserId: tenantAdmin?.id,
        });
        expect(
          getTenantMemberOrgScope(db, {
            tenantId: tenant.id,
            userId: member.id,
            dataSourceId: firstSource.id,
          }),
        ).toMatchObject({
          scopeMode: "all",
          orgScopeCount: 0,
        });
        expect(
          db
            .prepare(
              `SELECT COUNT(*) AS count
               FROM tenant_member_org_scopes
               WHERE tenant_id = ? AND user_id = ? AND data_source_id = ?`,
            )
            .get(tenant.id, member.id, firstSource.id)?.count,
        ).toBe(0);

        setTenantMemberOrgScope(db, {
          tenantId: tenant.id,
          userId: member.id,
          dataSourceId: firstSource.id,
          scopeMode: "custom",
          createdByUserId: tenantAdmin?.id,
          orgScopes: [
            {
              orgId: "2001",
              orgNameSnapshot: "华北事业部",
            },
          ],
        });
        setTenantDataSourceBinding(db, {
          tenantId: tenant.id,
          dataSourceId: secondSource.id,
          boundByUserId: tenantAdmin?.id,
        });

        expect(getTenantDataSourceBinding(db, tenant.id)).toMatchObject({
          tenantId: tenant.id,
          dataSourceId: secondSource.id,
          dataSourceName: "组织账套 B",
        });
        expect(
          db
            .prepare(
              `SELECT scope_mode AS scopeMode
               FROM tenant_member_source_policies
               WHERE tenant_id = ? AND user_id = ? AND data_source_id = ?`,
            )
            .get(tenant.id, member.id, firstSource.id),
        ).toMatchObject({
          scopeMode: "none",
        });
        expect(
          db
            .prepare(
              `SELECT COUNT(*) AS count
               FROM tenant_member_org_scopes
               WHERE tenant_id = ?`,
            )
            .get(tenant.id)?.count,
        ).toBe(0);
        expect(
          getTenantMemberOrgScope(db, {
            tenantId: tenant.id,
            userId: member.id,
            dataSourceId: secondSource.id,
          }),
        ).toMatchObject({
          scopeMode: "none",
          orgScopeCount: 0,
        });
        expect(listTenantMembers(db, tenant.id)).toEqual([
          expect.objectContaining({
            id: member.id,
            orgScopeMode: "none",
            orgScopeCount: 0,
          }),
        ]);
        expect(() =>
          resolveMemberDataAccessContext(db, {
            tenantId: tenant.id,
            userId: member.id,
          }),
        ).toThrowError("member_org_scope_empty");
      } finally {
        closeTenantPlatformDb(db);
      }
    });

    it("rejects custom scope mode when the normalized org scope list is empty", async () => {
      const { setTenantDataSourceBinding, setTenantMemberOrgScope, upsertDataSource } =
        await loadTenantPlatformDbModule();
      const sandbox = createTempSandbox();
      const db = openTenantPlatformDb(sandbox.config);
      try {
        createBootstrapPlatformAdmin(db, {
          username: "platform-root",
          password: "secret",
        });
        const tenant = createTenantWithAdmin(db, {
          code: "scope-empty",
          name: "租户 Scope Empty",
          adminUsername: "scope-empty-admin",
          adminPassword: "secret",
          memberLimit: 3,
          deploymentMode: "cloud",
          licenseExpiresAt: null,
          renewalCode: null,
        });
        const tenantAdmin = getUserByUsername(db, "scope-empty-admin");
        const member = createTenantMember(db, {
          tenantId: tenant.id,
          username: "scope-empty-member",
          password: "secret",
        });
        const source = upsertDataSource(db, {
          code: "kd-scope-empty",
          name: "空范围账套",
          sourceType: "kingdee_analytics",
          connection: { host: "db-scope-empty.internal" },
        });

        setTenantDataSourceBinding(db, {
          tenantId: tenant.id,
          dataSourceId: source.id,
          boundByUserId: tenantAdmin?.id,
        });

        expect(() =>
          setTenantMemberOrgScope(db, {
            tenantId: tenant.id,
            userId: member.id,
            dataSourceId: source.id,
            scopeMode: "custom",
            createdByUserId: tenantAdmin?.id,
            orgScopes: [{ orgId: "   ", orgNameSnapshot: "ignored" }],
          }),
        ).toThrowError("member_org_scope_empty");
        expect(
          db
            .prepare(
              `SELECT COUNT(*) AS count
               FROM tenant_member_source_policies
               WHERE tenant_id = ? AND user_id = ? AND data_source_id = ?`,
            )
            .get(tenant.id, member.id, source.id)?.count,
        ).toBe(0);
      } finally {
        closeTenantPlatformDb(db);
      }
    });

    it("deleting a member removes persisted data source scope rows", async () => {
      const { setTenantDataSourceBinding, setTenantMemberOrgScope, upsertDataSource } =
        await loadTenantPlatformDbModule();
      const sandbox = createTempSandbox();
      const db = openTenantPlatformDb(sandbox.config);
      try {
        createBootstrapPlatformAdmin(db, {
          username: "platform-root",
          password: "secret",
        });
        const tenant = createTenantWithAdmin(db, {
          code: "scope-delete",
          name: "租户 Scope Delete",
          adminUsername: "scope-delete-admin",
          adminPassword: "secret",
          memberLimit: 3,
          deploymentMode: "cloud",
          licenseExpiresAt: null,
          renewalCode: null,
        });
        const tenantAdmin = getUserByUsername(db, "scope-delete-admin");
        const member = createTenantMember(db, {
          tenantId: tenant.id,
          username: "scope-delete-member",
          password: "secret",
        });
        const source = upsertDataSource(db, {
          code: "kd-scope-delete",
          name: "删除账套",
          sourceType: "kingdee_analytics",
          connection: { host: "db-scope-delete.internal" },
        });

        setTenantDataSourceBinding(db, {
          tenantId: tenant.id,
          dataSourceId: source.id,
          boundByUserId: tenantAdmin?.id,
        });
        setTenantMemberOrgScope(db, {
          tenantId: tenant.id,
          userId: member.id,
          dataSourceId: source.id,
          scopeMode: "custom",
          createdByUserId: tenantAdmin?.id,
          orgScopes: [
            {
              orgId: "3001",
              orgNameSnapshot: "西南事业部",
            },
          ],
        });
        expect(
          db
            .prepare(
              `SELECT COUNT(*) AS count
               FROM tenant_member_source_policies
               WHERE tenant_id = ? AND user_id = ?`,
            )
            .get(tenant.id, member.id)?.count,
        ).toBe(1);
        expect(
          db
            .prepare(
              `SELECT COUNT(*) AS count
               FROM tenant_member_org_scopes
               WHERE tenant_id = ? AND user_id = ?`,
            )
            .get(tenant.id, member.id)?.count,
        ).toBe(1);

        deleteTenantMember(db, {
          tenantId: tenant.id,
          userId: member.id,
          configDir: sandbox.config.configDir,
          configPath: sandbox.config.configPath,
        });

        expect(
          db
            .prepare(
              `SELECT COUNT(*) AS count
               FROM tenant_member_source_policies
               WHERE tenant_id = ? AND user_id = ?`,
            )
            .get(tenant.id, member.id)?.count,
        ).toBe(0);
        expect(
          db
            .prepare(
              `SELECT COUNT(*) AS count
               FROM tenant_member_org_scopes
               WHERE tenant_id = ? AND user_id = ?`,
            )
            .get(tenant.id, member.id)?.count,
        ).toBe(0);
      } finally {
        closeTenantPlatformDb(db);
      }
    });

    it("deleting a member cleans scope rows in upgraded pre-foreign-key databases", async () => {
      const { setTenantDataSourceBinding, setTenantMemberOrgScope, upsertDataSource } =
        await loadTenantPlatformDbModule();
      const sandbox = createTempSandbox();
      const db = openTenantPlatformDb(sandbox.config);
      try {
        createBootstrapPlatformAdmin(db, {
          username: "platform-root",
          password: "secret",
        });
        const tenant = createTenantWithAdmin(db, {
          code: "scope-delete-legacy",
          name: "租户 Scope Delete Legacy",
          adminUsername: "scope-delete-legacy-admin",
          adminPassword: "secret",
          memberLimit: 3,
          deploymentMode: "cloud",
          licenseExpiresAt: null,
          renewalCode: null,
        });
        const tenantAdmin = getUserByUsername(db, "scope-delete-legacy-admin");
        const member = createTenantMember(db, {
          tenantId: tenant.id,
          username: "scope-delete-legacy-member",
          password: "secret",
        });
        const source = upsertDataSource(db, {
          code: "kd-scope-delete-legacy",
          name: "删除账套 Legacy",
          sourceType: "kingdee_analytics",
          connection: { host: "db-scope-delete-legacy.internal" },
        });

        setTenantDataSourceBinding(db, {
          tenantId: tenant.id,
          dataSourceId: source.id,
          boundByUserId: tenantAdmin?.id,
        });
        setTenantMemberOrgScope(db, {
          tenantId: tenant.id,
          userId: member.id,
          dataSourceId: source.id,
          scopeMode: "custom",
          createdByUserId: tenantAdmin?.id,
          orgScopes: [
            {
              orgId: "3101",
              orgNameSnapshot: "海外事业部",
            },
          ],
        });

        db.exec("PRAGMA foreign_keys = OFF;");
        try {
          db.exec(
            `ALTER TABLE tenant_member_source_policies RENAME TO tenant_member_source_policies_with_fk;
             CREATE TABLE tenant_member_source_policies (
               id TEXT PRIMARY KEY,
               tenant_id TEXT NOT NULL,
               user_id TEXT NOT NULL,
               data_source_id TEXT NOT NULL,
               scope_mode TEXT NOT NULL,
               created_by_user_id TEXT,
               created_at TEXT NOT NULL,
               updated_at TEXT NOT NULL,
               UNIQUE (tenant_id, user_id, data_source_id)
             );
             INSERT INTO tenant_member_source_policies
             SELECT * FROM tenant_member_source_policies_with_fk;
             DROP TABLE tenant_member_source_policies_with_fk;
             ALTER TABLE tenant_member_org_scopes RENAME TO tenant_member_org_scopes_with_fk;
             CREATE TABLE tenant_member_org_scopes (
               id TEXT PRIMARY KEY,
               tenant_id TEXT NOT NULL,
               user_id TEXT NOT NULL,
               data_source_id TEXT NOT NULL,
               org_id TEXT NOT NULL,
               org_name_snapshot TEXT NOT NULL DEFAULT '',
               created_at TEXT NOT NULL,
               UNIQUE (tenant_id, user_id, data_source_id, org_id)
             );
             INSERT INTO tenant_member_org_scopes
             SELECT * FROM tenant_member_org_scopes_with_fk;
             DROP TABLE tenant_member_org_scopes_with_fk;`,
          );
        } finally {
          db.exec("PRAGMA foreign_keys = ON;");
        }

        deleteTenantMember(db, {
          tenantId: tenant.id,
          userId: member.id,
          configDir: sandbox.config.configDir,
          configPath: sandbox.config.configPath,
        });

        expect(
          db
            .prepare(
              `SELECT COUNT(*) AS count
               FROM tenant_member_source_policies
               WHERE tenant_id = ? AND user_id = ?`,
            )
            .get(tenant.id, member.id)?.count,
        ).toBe(0);
        expect(
          db
            .prepare(
              `SELECT COUNT(*) AS count
               FROM tenant_member_org_scopes
               WHERE tenant_id = ? AND user_id = ?`,
            )
            .get(tenant.id, member.id)?.count,
        ).toBe(0);
      } finally {
        closeTenantPlatformDb(db);
      }
    });
  });

  describe("org scope routes", () => {
    it("auto-registers a local analytics data source from a discovered env file", async () => {
      const sandbox = createTempSandbox();
      const analyticsEnvPath = path.join(sandbox.root, "analytics.env");
      fs.writeFileSync(
        analyticsEnvPath,
        [
          "ANALYTICS_PG_DSN=postgresql://kb_local:kb_local123!@127.0.0.1:65432/kingdee_analytics",
          "KINGDEE_DBID=6220b009309f24",
        ].join("\n"),
        "utf8",
      );
      sandbox.config.analyticsEnvFilePath = analyticsEnvPath;
      sandbox.config.disableAutoDiscoveredDataSources = false;
      const { baseUrl, config, db } = await startTenantPlatformServer(sandbox);
      const platformAdmin = createBootstrapPlatformAdmin(db, {
        username: "platform-route-auto-discovery",
        password: "secret",
      });
      const platformToken = issueTenantPlatformTestToken(config, {
        userId: platformAdmin.id,
        username: platformAdmin.username,
        role: "platform_admin",
        tenantId: null,
      });

      const listed = await requestTenantPlatformJson(baseUrl, "/platform/data-sources", {
        token: platformToken,
      });

      expect(listed.status).toBe(200);
      expect(listed.payload.data).toEqual([
        expect.objectContaining({
          code: "local-kingdee-analytics",
          name: "本机 kingdee-analytics",
          sourceType: "kingdee_analytics",
          sourceDbid: "6220b009309f24",
          connectionPasswordStored: true,
          connection: {
            host: "127.0.0.1",
            port: 65432,
            database: "kingdee_analytics",
            user: "kb_local",
          },
        }),
      ]);
      expect(listed.payload.data[0]?.connection?.password).toBeUndefined();
      expect(JSON.stringify(listed.payload.data[0])).not.toContain("kb_local123!");
      expect(
        JSON.parse(
          String(
            db
              .prepare("SELECT connection_json AS connectionJson FROM data_sources WHERE code = ?")
              .get("local-kingdee-analytics")?.connectionJson || "{}",
          ),
        ),
      ).toMatchObject({
        host: "127.0.0.1",
        port: 65432,
        database: "kingdee_analytics",
        user: "kb_local",
        password: "kb_local123!",
      });
    });

    it("lets platform admins manage data sources and tenant bindings", async () => {
      const sandbox = createTempSandbox();
      const { baseUrl, config, db } = await startTenantPlatformServer(sandbox);
      const platformAdmin = createBootstrapPlatformAdmin(db, {
        username: "platform-route-root",
        password: "secret",
      });
      const tenant = createTenantWithAdmin(db, {
        code: "route-platform-alpha",
        name: "租户 Route Platform Alpha",
        adminUsername: "route-platform-alpha-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });
      const platformToken = issueTenantPlatformTestToken(config, {
        userId: platformAdmin.id,
        username: platformAdmin.username,
        role: "platform_admin",
        tenantId: null,
      });

      const emptyList = await requestTenantPlatformJson(baseUrl, "/platform/data-sources", {
        token: platformToken,
      });
      expect(emptyList.status).toBe(200);
      expect(emptyList.payload.data).toEqual([]);

      const created = await requestTenantPlatformJson(baseUrl, "/platform/data-sources", {
        method: "POST",
        token: platformToken,
        body: {
          code: "kd-route-main",
          name: "路由账套主库",
          sourceType: "kingdee_analytics",
          status: "active",
          connection: {
            host: "db.route.internal",
            port: 5432,
            database: "kingdee_main",
            user: "route_user",
            password: "route-secret",
          },
          sourceDbid: "route-db-main",
          sourceTenantCode: "route-tenant-main",
        },
      });
      expect(created.status).toBe(200);
      expect(created.payload.data).toMatchObject({
        code: "kd-route-main",
        name: "路由账套主库",
        sourceType: "kingdee_analytics",
        sourceDbid: "route-db-main",
        sourceTenantCode: "route-tenant-main",
      });
      expect(created.payload.data.connection).toMatchObject({
        host: "db.route.internal",
        port: 5432,
        database: "kingdee_main",
        user: "route_user",
      });
      expect(created.payload.data.connection.password).toBeUndefined();
      expect(created.payload.data.connectionPasswordStored).toBe(true);
      expect(JSON.stringify(created.payload.data)).not.toContain("route-secret");

      const listed = await requestTenantPlatformJson(baseUrl, "/platform/data-sources", {
        token: platformToken,
      });
      expect(listed.status).toBe(200);
      expect(listed.payload.data).toEqual([
        expect.objectContaining({
          id: created.payload.data.id,
          code: "kd-route-main",
          name: "路由账套主库",
          connectionPasswordStored: true,
        }),
      ]);
      expect(listed.payload.data[0]?.connection?.password).toBeUndefined();
      expect(JSON.stringify(listed.payload.data[0])).not.toContain("route-secret");

      const updated = await requestTenantPlatformJson(baseUrl, "/platform/data-sources", {
        method: "PUT",
        token: platformToken,
        body: {
          id: created.payload.data.id,
          code: "kd-route-main",
          name: "路由账套主库（更新）",
          sourceType: "kingdee_analytics",
          status: "active",
          connection: {
            host: "db.route.internal",
            port: 5432,
            database: "kingdee_main",
            user: "route_user",
          },
          sourceDbid: "route-db-main",
          sourceTenantCode: "route-tenant-main",
        },
      });
      expect(updated.status).toBe(200);
      expect(updated.payload.data).toMatchObject({
        id: created.payload.data.id,
        name: "路由账套主库（更新）",
        connectionPasswordStored: true,
      });
      expect(updated.payload.data.connection?.password).toBeUndefined();
      expect(JSON.stringify(updated.payload.data)).not.toContain("route-secret");
      expect(
        JSON.parse(
          String(
            db
              .prepare("SELECT connection_json AS connectionJson FROM data_sources WHERE id = ?")
              .get(created.payload.data.id)?.connectionJson || "{}",
          ),
        ),
      ).toMatchObject({
        host: "db.route.internal",
        port: 5432,
        database: "kingdee_main",
        user: "route_user",
        password: "route-secret",
      });

      const bindingBefore = await requestTenantPlatformJson(
        baseUrl,
        `/platform/tenant-data-source-binding?tenantId=${encodeURIComponent(tenant.id)}`,
        {
          token: platformToken,
        },
      );
      expect(bindingBefore.status).toBe(200);
      expect(bindingBefore.payload.data).toBeNull();

      const rebound = await requestTenantPlatformJson(baseUrl, "/platform/tenant-data-source-binding", {
        method: "POST",
        token: platformToken,
        body: {
          tenantId: tenant.id,
          dataSourceId: created.payload.data.id,
        },
      });
      expect(rebound.status).toBe(200);
      expect(rebound.payload.data).toMatchObject({
        tenantId: tenant.id,
        dataSourceId: created.payload.data.id,
        dataSourceName: "路由账套主库（更新）",
        connectionPasswordStored: true,
      });
      expect(rebound.payload.data.connection?.password).toBeUndefined();

      const bindingAfter = await requestTenantPlatformJson(
        baseUrl,
        `/platform/tenant-data-source-binding?tenantId=${encodeURIComponent(tenant.id)}`,
        {
          token: platformToken,
        },
      );
      expect(bindingAfter.status).toBe(200);
      expect(bindingAfter.payload.data).toMatchObject({
        tenantId: tenant.id,
        dataSourceId: created.payload.data.id,
        connectionPasswordStored: true,
      });
      expect(bindingAfter.payload.data.connection?.password).toBeUndefined();
    });

    it("rejects reusing one data source across multiple platform tenants through the route", async () => {
      const sandbox = createTempSandbox();
      const { baseUrl, config, db } = await startTenantPlatformServer(sandbox);
      const platformAdmin = createBootstrapPlatformAdmin(db, {
        username: "platform-route-root",
        password: "secret",
      });
      const firstTenant = createTenantWithAdmin(db, {
        code: "route-owner-first",
        name: "租户 Route Owner First",
        adminUsername: "route-owner-first-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });
      const secondTenant = createTenantWithAdmin(db, {
        code: "route-owner-second",
        name: "租户 Route Owner Second",
        adminUsername: "route-owner-second-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });
      const platformToken = issueTenantPlatformTestToken(config, {
        userId: platformAdmin.id,
        username: platformAdmin.username,
        role: "platform_admin",
        tenantId: null,
      });

      const created = await requestTenantPlatformJson(baseUrl, "/platform/data-sources", {
        method: "POST",
        token: platformToken,
        body: {
          code: "kd-route-single-owner",
          name: "单归属账套",
          sourceType: "kingdee_analytics",
          connection: {
            host: "db.route.internal",
            database: "kingdee_main",
          },
        },
      });
      expect(created.status).toBe(200);

      const firstBinding = await requestTenantPlatformJson(baseUrl, "/platform/tenant-data-source-binding", {
        method: "POST",
        token: platformToken,
        body: {
          tenantId: firstTenant.id,
          dataSourceId: created.payload.data.id,
        },
      });
      expect(firstBinding.status).toBe(200);

      const rejectedBinding = await requestTenantPlatformJson(baseUrl, "/platform/tenant-data-source-binding", {
        method: "POST",
        token: platformToken,
        body: {
          tenantId: secondTenant.id,
          dataSourceId: created.payload.data.id,
        },
      });
      expect(rejectedBinding.status).toBe(409);
      expect(rejectedBinding.payload.error).toBe("data_source_already_bound");
    });

    it("rejects unsupported data source types on create and update", async () => {
      const sandbox = createTempSandbox();
      const { baseUrl, config, db } = await startTenantPlatformServer(sandbox);
      const platformAdmin = createBootstrapPlatformAdmin(db, {
        username: "platform-route-root",
        password: "secret",
      });
      const platformToken = issueTenantPlatformTestToken(config, {
        userId: platformAdmin.id,
        username: platformAdmin.username,
        role: "platform_admin",
        tenantId: null,
      });

      const rejectedCreate = await requestTenantPlatformJson(baseUrl, "/platform/data-sources", {
        method: "POST",
        token: platformToken,
        body: {
          code: "legacy-main",
          name: "Legacy Main",
          sourceType: "legacy_warehouse",
          connection: {
            host: "db.legacy.internal",
          },
        },
      });
      expect(rejectedCreate.status).toBe(400);
      expect(rejectedCreate.payload.error).toBe("data_source_type_unsupported");

      const created = await requestTenantPlatformJson(baseUrl, "/platform/data-sources", {
        method: "POST",
        token: platformToken,
        body: {
          code: "kd-route-supported",
          name: "受支持账套",
          sourceType: "kingdee_analytics",
          connection: {
            host: "db.route.internal",
            database: "kingdee_main",
          },
        },
      });
      expect(created.status).toBe(200);

      const rejectedUpdate = await requestTenantPlatformJson(baseUrl, "/platform/data-sources", {
        method: "PUT",
        token: platformToken,
        body: {
          id: created.payload.data.id,
          code: "kd-route-supported",
          name: "受支持账套",
          sourceType: "legacy_warehouse",
          connection: {
            host: "db.route.internal",
            database: "kingdee_main",
          },
        },
      });
      expect(rejectedUpdate.status).toBe(400);
      expect(rejectedUpdate.payload.error).toBe("data_source_type_unsupported");
    });

    it("keeps missing source type distinct from unsupported source type on create and update", async () => {
      const sandbox = createTempSandbox();
      const { baseUrl, config, db } = await startTenantPlatformServer(sandbox);
      const platformAdmin = createBootstrapPlatformAdmin(db, {
        username: "platform-route-root",
        password: "secret",
      });
      const platformToken = issueTenantPlatformTestToken(config, {
        userId: platformAdmin.id,
        username: platformAdmin.username,
        role: "platform_admin",
        tenantId: null,
      });

      const rejectedCreate = await requestTenantPlatformJson(baseUrl, "/platform/data-sources", {
        method: "POST",
        token: platformToken,
        body: {
          code: "missing-type-main",
          name: "Missing Type Main",
          connection: {
            host: "db.missing-type.internal",
          },
        },
      });
      expect(rejectedCreate.status).toBe(400);
      expect(rejectedCreate.payload.error).toBe("data_source_type_required");

      const created = await requestTenantPlatformJson(baseUrl, "/platform/data-sources", {
        method: "POST",
        token: platformToken,
        body: {
          code: "kd-route-missing-type",
          name: "缺失类型账套",
          sourceType: "kingdee_analytics",
          connection: {
            host: "db.route.internal",
            database: "kingdee_main",
          },
        },
      });
      expect(created.status).toBe(200);

      const rejectedUpdate = await requestTenantPlatformJson(baseUrl, "/platform/data-sources", {
        method: "PUT",
        token: platformToken,
        body: {
          id: created.payload.data.id,
          code: "kd-route-missing-type",
          name: "缺失类型账套",
          sourceType: "   ",
          connection: {
            host: "db.route.internal",
            database: "kingdee_main",
          },
        },
      });
      expect(rejectedUpdate.status).toBe(400);
      expect(rejectedUpdate.payload.error).toBe("data_source_type_required");
    });

    it("lets tenant admins read the current binding, load organizations, and save member org scope", async () => {
      const sandbox = createTempSandbox();
      const calls = {
        listBindings: [],
        validateBindings: [],
      };
      const orgRows = [
        {
          orgId: "1001",
          orgNumber: "ORG-1001",
          orgName: "华东事业部",
          parentOrgId: null,
          status: "active",
        },
        {
          orgId: "1002",
          orgNumber: "ORG-1002",
          orgName: "华南事业部",
          parentOrgId: "1001",
          status: "active",
        },
      ];
      const { baseUrl, config, db } = await startTenantPlatformServer(sandbox, {
        dataSourceClient: {
          async listOrganizationsForDataSource(binding) {
            calls.listBindings.push(binding);
            return orgRows;
          },
          async validateOrganizationIds(binding, orgIds) {
            calls.validateBindings.push({
              binding,
              orgIds,
            });
            return orgRows.filter((entry) => orgIds.includes(entry.orgId));
          },
        },
      });
      createBootstrapPlatformAdmin(db, {
        username: "platform-route-root",
        password: "secret",
      });
      const tenant = createTenantWithAdmin(db, {
        code: "route-org-alpha",
        name: "租户 Route Org Alpha",
        adminUsername: "route-org-alpha-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });
      const tenantAdmin = getUserByUsername(db, "route-org-alpha-admin");
      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "route-org-member",
        password: "secret",
      });
      const { setTenantDataSourceBinding, upsertDataSource } = await loadTenantPlatformDbModule();
      const source = upsertDataSource(db, {
        code: "kd-route-org",
        name: "组织账套路由",
        sourceType: "kingdee_analytics",
        connection: {
          host: "db.org.internal",
          database: "kingdee_org",
          user: "org_user",
          password: "org-secret",
        },
      });
      setTenantDataSourceBinding(db, {
        tenantId: tenant.id,
        dataSourceId: source.id,
        boundByUserId: tenantAdmin?.id,
      });
      const tenantAdminToken = issueTenantPlatformTestToken(config, {
        userId: tenantAdmin?.id,
        username: tenantAdmin?.username,
        role: "tenant_admin",
        tenantId: tenant.id,
      });

      const currentBinding = await requestTenantPlatformJson(
        baseUrl,
        "/tenant/admin/data-source-binding",
        {
          token: tenantAdminToken,
        },
      );
      expect(currentBinding.status).toBe(200);
      expect(currentBinding.payload.data).toMatchObject({
        tenantId: tenant.id,
        dataSourceId: source.id,
        dataSourceName: "组织账套路由",
        connectionPasswordStored: true,
      });
      expect(currentBinding.payload.data.connection?.password).toBeUndefined();
      expect(JSON.stringify(currentBinding.payload.data)).not.toContain("org-secret");

      const listedOrgs = await requestTenantPlatformJson(baseUrl, "/tenant/admin/orgs", {
        token: tenantAdminToken,
      });
      expect(listedOrgs.status).toBe(200);
      expect(listedOrgs.payload.data).toEqual(orgRows);
      expect(calls.listBindings).toHaveLength(1);
      expect(calls.listBindings[0]).toMatchObject({
        tenantId: tenant.id,
        dataSourceId: source.id,
        dataSourceName: "组织账套路由",
      });
      expect(calls.listBindings[0]?.connection?.password).toBe("org-secret");

      const initialScope = await requestTenantPlatformJson(
        baseUrl,
        `/tenant/admin/member-org-scope?userId=${encodeURIComponent(member.id)}`,
        {
          token: tenantAdminToken,
        },
      );
      expect(initialScope.status).toBe(200);
      expect(initialScope.payload.data).toMatchObject({
        userId: member.id,
        dataSourceId: source.id,
        scopeMode: "none",
        orgScopeCount: 0,
      });

      const savedScope = await requestTenantPlatformJson(baseUrl, "/tenant/admin/member-org-scope", {
        method: "POST",
        token: tenantAdminToken,
        body: {
          userId: member.id,
          scopeMode: "custom",
          orgIds: ["1001"],
        },
      });
      expect(savedScope.status).toBe(200);
      expect(savedScope.payload.data).toMatchObject({
        userId: member.id,
        dataSourceId: source.id,
        scopeMode: "custom",
        orgScopeCount: 1,
      });
      expect(savedScope.payload.data.orgScopes).toEqual([
        expect.objectContaining({
          orgId: "1001",
          orgNameSnapshot: "华东事业部",
        }),
      ]);
      expect(calls.validateBindings).toEqual([
        expect.objectContaining({
          binding: expect.objectContaining({
            tenantId: tenant.id,
            dataSourceId: source.id,
          }),
          orgIds: ["1001"],
        }),
      ]);

      const reloadedScope = await requestTenantPlatformJson(
        baseUrl,
        `/tenant/admin/member-org-scope?userId=${encodeURIComponent(member.id)}`,
        {
          token: tenantAdminToken,
        },
      );
      expect(reloadedScope.status).toBe(200);
      expect(reloadedScope.payload.data).toMatchObject({
        userId: member.id,
        scopeMode: "custom",
        orgScopeCount: 1,
      });
    });

    it("accepts orgScopes object-array payloads when saving custom org scope", async () => {
      const sandbox = createTempSandbox();
      const calls = {
        validateBindings: [],
      };
      const orgRows = [
        {
          orgId: "1001",
          orgNumber: "ORG-1001",
          orgName: "华东事业部",
          parentOrgId: null,
          status: "active",
        },
      ];
      const { baseUrl, config, db } = await startTenantPlatformServer(sandbox, {
        dataSourceClient: {
          async listOrganizationsForDataSource() {
            return orgRows;
          },
          async validateOrganizationIds(binding, orgIds) {
            calls.validateBindings.push({
              binding,
              orgIds,
            });
            return orgRows.filter((entry) => orgIds.includes(entry.orgId));
          },
        },
      });
      createBootstrapPlatformAdmin(db, {
        username: "platform-route-root",
        password: "secret",
      });
      const tenant = createTenantWithAdmin(db, {
        code: "route-org-object-array",
        name: "租户 Route Org Object Array",
        adminUsername: "route-org-object-array-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });
      const tenantAdmin = getUserByUsername(db, "route-org-object-array-admin");
      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "route-org-object-array-member",
        password: "secret",
      });
      const { setTenantDataSourceBinding, upsertDataSource } = await loadTenantPlatformDbModule();
      const source = upsertDataSource(db, {
        code: "kd-route-org-object-array",
        name: "对象数组账套",
        sourceType: "kingdee_analytics",
        connection: {
          host: "db.object-array.internal",
          database: "kingdee_object_array",
        },
      });
      setTenantDataSourceBinding(db, {
        tenantId: tenant.id,
        dataSourceId: source.id,
        boundByUserId: tenantAdmin?.id,
      });
      const tenantAdminToken = issueTenantPlatformTestToken(config, {
        userId: tenantAdmin?.id,
        username: tenantAdmin?.username,
        role: "tenant_admin",
        tenantId: tenant.id,
      });

      const savedScope = await requestTenantPlatformJson(baseUrl, "/tenant/admin/member-org-scope", {
        method: "POST",
        token: tenantAdminToken,
        body: {
          userId: member.id,
          scopeMode: "custom",
          orgScopes: [
            {
              orgId: "1001",
            },
          ],
        },
      });
      expect(savedScope.status).toBe(200);
      expect(savedScope.payload.data).toMatchObject({
        userId: member.id,
        scopeMode: "custom",
        orgScopeCount: 1,
      });
      expect(savedScope.payload.data.orgScopes).toEqual([
        expect.objectContaining({
          orgId: "1001",
          orgNameSnapshot: "华东事业部",
        }),
      ]);
      expect(calls.validateBindings).toEqual([
        expect.objectContaining({
          binding: expect.objectContaining({
            tenantId: tenant.id,
            dataSourceId: source.id,
          }),
          orgIds: ["1001"],
        }),
      ]);
    });

    it("rejects mixed valid and invalid org IDs instead of saving a partial scope", async () => {
      const sandbox = createTempSandbox();
      const orgRows = [
        {
          orgId: "1001",
          orgNumber: "ORG-1001",
          orgName: "华东事业部",
          parentOrgId: null,
          status: "active",
        },
      ];
      const { baseUrl, config, db } = await startTenantPlatformServer(sandbox, {
        dataSourceClient: {
          async listOrganizationsForDataSource() {
            return orgRows;
          },
          async validateOrganizationIds(_binding, orgIds) {
            return orgRows.filter((entry) => orgIds.includes(entry.orgId));
          },
        },
      });
      createBootstrapPlatformAdmin(db, {
        username: "platform-route-root",
        password: "secret",
      });
      const tenant = createTenantWithAdmin(db, {
        code: "route-org-partial",
        name: "租户 Route Org Partial",
        adminUsername: "route-org-partial-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });
      const tenantAdmin = getUserByUsername(db, "route-org-partial-admin");
      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "route-org-partial-member",
        password: "secret",
      });
      const { getTenantMemberOrgScope, setTenantDataSourceBinding, upsertDataSource } =
        await loadTenantPlatformDbModule();
      const source = upsertDataSource(db, {
        code: "kd-route-org-partial",
        name: "部分匹配账套",
        sourceType: "kingdee_analytics",
        connection: {
          host: "db.partial.internal",
          database: "kingdee_partial",
        },
      });
      setTenantDataSourceBinding(db, {
        tenantId: tenant.id,
        dataSourceId: source.id,
        boundByUserId: tenantAdmin?.id,
      });
      const tenantAdminToken = issueTenantPlatformTestToken(config, {
        userId: tenantAdmin?.id,
        username: tenantAdmin?.username,
        role: "tenant_admin",
        tenantId: tenant.id,
      });

      const rejected = await requestTenantPlatformJson(baseUrl, "/tenant/admin/member-org-scope", {
        method: "POST",
        token: tenantAdminToken,
        body: {
          userId: member.id,
          scopeMode: "custom",
          orgIds: ["1001", "9999"],
        },
      });
      expect(rejected.status).toBe(400);
      expect(rejected.payload.error).toBe("member_org_scope_invalid_org_ids");
      expect(
        getTenantMemberOrgScope(db, {
          tenantId: tenant.id,
          userId: member.id,
          dataSourceId: source.id,
        }),
      ).toMatchObject({
        scopeMode: "none",
        orgScopeCount: 0,
      });
    });

    it("returns tenant_data_source_unbound for org scope reads without a tenant binding", async () => {
      const sandbox = createTempSandbox();
      const { baseUrl, config, db } = await startTenantPlatformServer(sandbox, {
        dataSourceClient: {
          async listOrganizationsForDataSource() {
            throw new Error("should_not_be_called");
          },
          async validateOrganizationIds() {
            throw new Error("should_not_be_called");
          },
        },
      });
      createBootstrapPlatformAdmin(db, {
        username: "platform-route-root",
        password: "secret",
      });
      const tenant = createTenantWithAdmin(db, {
        code: "route-org-unbound",
        name: "租户 Route Org Unbound",
        adminUsername: "route-org-unbound-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });
      const tenantAdmin = getUserByUsername(db, "route-org-unbound-admin");
      const tenantAdminToken = issueTenantPlatformTestToken(config, {
        userId: tenantAdmin?.id,
        username: tenantAdmin?.username,
        role: "tenant_admin",
        tenantId: tenant.id,
      });

      const response = await requestTenantPlatformJson(baseUrl, "/tenant/admin/orgs", {
        token: tenantAdminToken,
      });

      expect(response.status).toBe(400);
      expect(response.payload.error).toBe("tenant_data_source_unbound");
    });

    it("returns member_not_found for unknown tenant member org scope requests", async () => {
      const sandbox = createTempSandbox();
      const { baseUrl, config, db } = await startTenantPlatformServer(sandbox, {
        dataSourceClient: {
          async listOrganizationsForDataSource() {
            return [];
          },
          async validateOrganizationIds() {
            return [];
          },
        },
      });
      createBootstrapPlatformAdmin(db, {
        username: "platform-route-root",
        password: "secret",
      });
      const tenant = createTenantWithAdmin(db, {
        code: "route-member-missing",
        name: "租户 Route Member Missing",
        adminUsername: "route-member-missing-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });
      const tenantAdmin = getUserByUsername(db, "route-member-missing-admin");
      const { setTenantDataSourceBinding, upsertDataSource } = await loadTenantPlatformDbModule();
      const source = upsertDataSource(db, {
        code: "kd-route-member-missing",
        name: "成员缺失账套",
        sourceType: "kingdee_analytics",
        connection: { host: "db.member.missing.internal" },
      });
      setTenantDataSourceBinding(db, {
        tenantId: tenant.id,
        dataSourceId: source.id,
        boundByUserId: tenantAdmin?.id,
      });
      const tenantAdminToken = issueTenantPlatformTestToken(config, {
        userId: tenantAdmin?.id,
        username: tenantAdmin?.username,
        role: "tenant_admin",
        tenantId: tenant.id,
      });

      const response = await requestTenantPlatformJson(
        baseUrl,
        "/tenant/admin/member-org-scope?userId=missing-member",
        {
          token: tenantAdminToken,
        },
      );

      expect(response.status).toBe(404);
      expect(response.payload.error).toBe("member_not_found");
    });

    it("returns user_id_required for blank tenant member org scope POST requests", async () => {
      const sandbox = createTempSandbox();
      const { baseUrl, config, db } = await startTenantPlatformServer(sandbox, {
        dataSourceClient: {
          async listOrganizationsForDataSource() {
            return [];
          },
          async validateOrganizationIds() {
            return [];
          },
        },
      });
      createBootstrapPlatformAdmin(db, {
        username: "platform-route-root",
        password: "secret",
      });
      const tenant = createTenantWithAdmin(db, {
        code: "route-member-blank-user",
        name: "租户 Route Member Blank User",
        adminUsername: "route-member-blank-user-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });
      const tenantAdmin = getUserByUsername(db, "route-member-blank-user-admin");
      const { setTenantDataSourceBinding, upsertDataSource } = await loadTenantPlatformDbModule();
      const source = upsertDataSource(db, {
        code: "kd-route-member-blank-user",
        name: "空成员账套",
        sourceType: "kingdee_analytics",
        connection: { host: "db.member.blank.internal" },
      });
      setTenantDataSourceBinding(db, {
        tenantId: tenant.id,
        dataSourceId: source.id,
        boundByUserId: tenantAdmin?.id,
      });
      const tenantAdminToken = issueTenantPlatformTestToken(config, {
        userId: tenantAdmin?.id,
        username: tenantAdmin?.username,
        role: "tenant_admin",
        tenantId: tenant.id,
      });

      const response = await requestTenantPlatformJson(baseUrl, "/tenant/admin/member-org-scope", {
        method: "POST",
        token: tenantAdminToken,
        body: {
          userId: "   ",
          scopeMode: "all",
        },
      });

      expect(response.status).toBe(400);
      expect(response.payload.error).toBe("user_id_required");
    });

    it("rejects empty custom org scope saves", async () => {
      const sandbox = createTempSandbox();
      const { baseUrl, config, db } = await startTenantPlatformServer(sandbox, {
        dataSourceClient: {
          async listOrganizationsForDataSource() {
            return [];
          },
          async validateOrganizationIds() {
            return [];
          },
        },
      });
      createBootstrapPlatformAdmin(db, {
        username: "platform-route-root",
        password: "secret",
      });
      const tenant = createTenantWithAdmin(db, {
        code: "route-empty-scope",
        name: "租户 Route Empty Scope",
        adminUsername: "route-empty-scope-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });
      const tenantAdmin = getUserByUsername(db, "route-empty-scope-admin");
      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "route-empty-scope-member",
        password: "secret",
      });
      const { setTenantDataSourceBinding, upsertDataSource } = await loadTenantPlatformDbModule();
      const source = upsertDataSource(db, {
        code: "kd-route-empty-scope",
        name: "空范围账套路由",
        sourceType: "kingdee_analytics",
        connection: { host: "db.empty.scope.internal" },
      });
      setTenantDataSourceBinding(db, {
        tenantId: tenant.id,
        dataSourceId: source.id,
        boundByUserId: tenantAdmin?.id,
      });
      const tenantAdminToken = issueTenantPlatformTestToken(config, {
        userId: tenantAdmin?.id,
        username: tenantAdmin?.username,
        role: "tenant_admin",
        tenantId: tenant.id,
      });

      const response = await requestTenantPlatformJson(baseUrl, "/tenant/admin/member-org-scope", {
        method: "POST",
        token: tenantAdminToken,
        body: {
          userId: member.id,
          scopeMode: "custom",
          orgIds: [],
        },
      });

      expect(response.status).toBe(400);
      expect(response.payload.error).toBe("member_org_scope_empty");
    });

    it("rejects org scope routes for the wrong role", async () => {
      const sandbox = createTempSandbox();
      const { baseUrl, config, db } = await startTenantPlatformServer(sandbox, {
        dataSourceClient: {
          async listOrganizationsForDataSource() {
            return [];
          },
          async validateOrganizationIds() {
            return [];
          },
        },
      });
      const platformAdmin = createBootstrapPlatformAdmin(db, {
        username: "platform-route-root",
        password: "secret",
      });
      const tenant = createTenantWithAdmin(db, {
        code: "route-role-denied",
        name: "租户 Route Role Denied",
        adminUsername: "route-role-denied-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });
      const tenantAdmin = getUserByUsername(db, "route-role-denied-admin");
      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "route-role-denied-member",
        password: "secret",
      });
      const tenantAdminToken = issueTenantPlatformTestToken(config, {
        userId: tenantAdmin?.id,
        username: tenantAdmin?.username,
        role: "tenant_admin",
        tenantId: tenant.id,
      });
      const memberToken = issueTenantPlatformTestToken(config, {
        userId: member.id,
        username: member.username,
        role: "member",
        tenantId: tenant.id,
      });

      const platformDenied = await requestTenantPlatformJson(baseUrl, "/platform/data-sources", {
        token: tenantAdminToken,
      });
      expect(platformDenied.status).toBe(403);
      expect(platformDenied.payload.error).toBe("forbidden");

      const tenantDenied = await requestTenantPlatformJson(baseUrl, "/tenant/admin/orgs", {
        token: memberToken,
      });
      expect(tenantDenied.status).toBe(403);
      expect(tenantDenied.payload.error).toBe("forbidden");

      expect(platformAdmin.role).toBe("platform_admin");
    });
  });

  it("creates a bootstrap platform admin and a tenant with an admin", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      const platformAdmin = createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });
      const tenant = createTenantWithAdmin(db, {
        code: "alpha",
        name: "租户 Alpha",
        adminUsername: "alpha-admin",
        adminPassword: "secret",
        memberLimit: 8,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      expect(platformAdmin?.role).toBe("platform_admin");
      expect(tenant?.code).toBe("alpha");
      expect(tenant?.memberLimit).toBe(8);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("creates, updates, lists, and deletes platform update logs", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      const platformAdmin = createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const created = createPlatformUpdateLog(db, {
        versionLabel: "v2026.4.23",
        title: "新增更新日志中心",
        content: "1. 平台管理员可以发布更新日志。\n2. 租户侧登录后会弹出最新更新。",
        createdByUserId: platformAdmin?.id,
        createdByUsername: platformAdmin?.username,
      });

      expect(created).toMatchObject({
        versionLabel: "v2026.4.23",
        title: "新增更新日志中心",
        createdByUsername: "platform-root",
      });

      const updated = updatePlatformUpdateLog(db, {
        id: created?.id,
        versionLabel: "v2026.4.23-hotfix1",
        title: "更新日志中心热修复",
        content: "1. 修复自动弹窗。\n2. 修复历史搜索。",
      });
      expect(updated).toMatchObject({
        id: created?.id,
        versionLabel: "v2026.4.23-hotfix1",
        title: "更新日志中心热修复",
      });

      const listed = listPlatformUpdateLogs(db);
      expect(listed).toHaveLength(1);
      expect(listed[0]).toMatchObject({
        id: created?.id,
        versionLabel: "v2026.4.23-hotfix1",
        title: "更新日志中心热修复",
      });
      expect(listed[0]?.excerpt).toContain("修复自动弹窗");

      const deleted = deletePlatformUpdateLog(db, { id: created?.id });
      expect(deleted).toMatchObject({
        id: created?.id,
        title: "更新日志中心热修复",
      });
      expect(listPlatformUpdateLogs(db)).toEqual([]);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("assigns a tenant agent to a member and returns card-ready identity fields", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      const baseWorkspace = path.join(
        sandbox.config.configDir,
        "workspace-agents",
        "finance",
      );
      fs.mkdirSync(path.join(baseWorkspace, "memory"), { recursive: true });
      fs.mkdirSync(path.join(baseWorkspace, "skills"), { recursive: true });
      fs.mkdirSync(path.join(baseWorkspace, "sessions"), { recursive: true });
      fs.writeFileSync(path.join(baseWorkspace, "MEMORY.md"), "# 母 Agent 记忆", "utf8");
      fs.writeFileSync(
        path.join(baseWorkspace, "memory", "tenant-policy.md"),
        "成员首次分配后应继承这段记忆。",
        "utf8",
      );
      fs.writeFileSync(
        path.join(baseWorkspace, "skills", "README.md"),
        "skills should be available in the derived workspace",
        "utf8",
      );
      fs.writeFileSync(
        path.join(baseWorkspace, "sessions", "old.jsonl"),
        "{\"type\":\"assistant\"}\n",
        "utf8",
      );

      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "beta",
        name: "租户 Beta",
        adminUsername: "beta-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-a",
        password: "secret",
      });
      expect(listTenantMembers(db, tenant.id)).toHaveLength(1);

      const catalog = readOpenClawAgentCatalog(sandbox.config.configPath);
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析与报表问答",
        rateMultiplier: 1.25,
        balancePoints: 42,
        status: "active",
      });

      const assignment = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      expect(String(assignment.derivedAgentId || "")).toMatch(/^tenant-/);
      expect(
        fs.existsSync(
          path.join(sandbox.config.configDir, "workspace-agents", String(assignment.derivedAgentId)),
        ),
      ).toBe(true);
      const derivedWorkspace = path.join(
        sandbox.config.configDir,
        "workspace-agents",
        String(assignment.derivedAgentId),
      );
      expect(fs.readFileSync(path.join(derivedWorkspace, "MEMORY.md"), "utf8")).toContain(
        "母 Agent 记忆",
      );
      expect(
        fs.readFileSync(path.join(derivedWorkspace, "memory", "tenant-policy.md"), "utf8"),
      ).toContain("成员首次分配后应继承");
      expect(fs.readFileSync(path.join(derivedWorkspace, "skills", "README.md"), "utf8")).toContain(
        "skills should be available",
      );
      expect(fs.existsSync(path.join(derivedWorkspace, "sessions", "old.jsonl"))).toBe(false);

      const agents = listAssignedAgentsForUser(
        db,
        { tenantId: tenant.id, userId: member.id },
        catalog,
      );
      expect(agents).toHaveLength(1);
      expect(agents[0]?.baseAgentId).toBe("finance");
      expect(agents[0]?.agentId).toBe(assignment.derivedAgentId);
      expect(agents[0]?.agentName).toBe("财务分析助手");
      expect(agents[0]?.emoji).toBe("💼");
      expect(agents[0]?.balancePoints).toBe(42);

      const visualizationDir = path.join(
        sandbox.config.configDir,
        "workspace-agents",
        String(assignment.derivedAgentId),
        "Echarts",
      );
      fs.mkdirSync(visualizationDir, { recursive: true });
      fs.writeFileSync(path.join(visualizationDir, "销售数据可视化_index.html"), "<html></html>");
      fs.writeFileSync(path.join(visualizationDir, "折线图_index.html"), "<html></html>");
      fs.writeFileSync(
        path.join(visualizationDir, "财务驾驶舱_index.dashboard.json"),
        JSON.stringify({
          version: 1,
          title: "财务驾驶舱",
        }),
        "utf8",
      );
      fs.writeFileSync(path.join(visualizationDir, "notes.txt"), "ignored");

      const visualizations = listAssignedAgentVisualizationsForUser(
        db,
        {
          tenantId: tenant.id,
          userId: member.id,
          configPath: sandbox.config.configPath,
          configDir: sandbox.config.configDir,
        },
        catalog,
      );
      expect(visualizations).toHaveLength(3);
      expect(visualizations.map((item) => item.visualizationName).toSorted()).toEqual([
        "折线图",
        "财务驾驶舱",
        "销售数据可视化",
      ]);
      expect(
        visualizations.every((item) => item.agentName === "财务分析助手"),
      ).toBe(true);
      expect(
        visualizations.find((item) => item.visualizationFileName === "财务驾驶舱_index.dashboard.json")
          ?.visualizationType,
      ).toBe("dashboard_manifest");
      expect(
        visualizations
          .filter((item) => item.visualizationType === "html")
          .every((item) => item.visualizationFileName.endsWith("_index.html")),
      ).toBe(true);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("falls back to OPENCLAW_WORKSPACE_DIR for split workspace deployments", () => {
    const sandbox = createTempSandbox();
    fs.writeFileSync(
      sandbox.config.configPath,
      JSON.stringify({
        agents: {
          list: [
            {
              id: "main",
              name: "默认助手",
            },
          ],
        },
        models: {
          mode: "merge",
          providers: {
            cleannetworkspace: {
              api: "openai-completions",
              models: [
                {
                  id: "gpt-5.4",
                  cost: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                  },
                },
                {
                  id: "gpt-5.4-mini",
                  cost: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                  },
                },
              ],
            },
          },
        },
      }),
      "utf8",
    );

    const splitWorkspace = path.join(sandbox.root, "shared-workspace");
    fs.mkdirSync(path.join(splitWorkspace, "memory"), { recursive: true });
    fs.mkdirSync(path.join(splitWorkspace, "skills"), { recursive: true });
    fs.writeFileSync(path.join(splitWorkspace, "MEMORY.md"), "# 主工作区记忆", "utf8");
    fs.writeFileSync(
      path.join(splitWorkspace, "memory", "split-layout.md"),
      "split workspace should still seed derived agents",
      "utf8",
    );
    fs.writeFileSync(
      path.join(splitWorkspace, "skills", "README.md"),
      "split workspace skills should be visible in derived agents",
      "utf8",
    );

    const previousWorkspaceDir = process.env.OPENCLAW_WORKSPACE_DIR;
    process.env.OPENCLAW_WORKSPACE_DIR = splitWorkspace;

    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "gamma",
        name: "租户 Gamma",
        adminUsername: "gamma-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-split",
        password: "secret",
      });

      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "main",
        description: "默认助手",
        rateMultiplier: 1,
        balancePoints: 10,
        status: "active",
      });

      const assignment = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      const derivedWorkspace = path.join(
        sandbox.config.configDir,
        "workspace-agents",
        String(assignment.derivedAgentId),
      );
      expect(fs.readFileSync(path.join(derivedWorkspace, "MEMORY.md"), "utf8")).toContain(
        "主工作区记忆",
      );
      expect(
        fs.readFileSync(path.join(derivedWorkspace, "memory", "split-layout.md"), "utf8"),
      ).toContain("split workspace should still seed derived agents");
      expect(fs.readFileSync(path.join(derivedWorkspace, "skills", "README.md"), "utf8")).toContain(
        "split workspace skills should be visible",
      );
    } finally {
      if (previousWorkspaceDir === undefined) {
        delete process.env.OPENCLAW_WORKSPACE_DIR;
      } else {
        process.env.OPENCLAW_WORKSPACE_DIR = previousWorkspaceDir;
      }
      closeTenantPlatformDb(db);
    }
  });

  it("copies base agent exec approvals into the derived agent bucket on assignment", () => {
    const sandbox = createTempSandbox();
    writeExecApprovals(sandbox, {
      version: 1,
      defaults: {
        security: "full",
        ask: "off",
        askFallback: "full",
      },
      agents: {
        finance: {
          security: "full",
          ask: "off",
          askFallback: "full",
          autoAllowSkills: true,
          allowlist: [
            {
              id: "allow-ls",
              pattern: "/usr/bin/ls",
            },
            {
              pattern: "=command:finance",
            },
          ],
        },
        "*": {
          allowlist: [
            {
              pattern: "/usr/bin/pwd",
            },
          ],
        },
      },
    });

    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "approval-sync",
        name: "租户 Approval Sync",
        adminUsername: "approval-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-approval",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 8,
        status: "active",
      });

      const assignment = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      const approvals = readExecApprovals(sandbox);
      const derivedBucket = approvals?.agents?.[String(assignment.derivedAgentId)];
      expect(derivedBucket).toMatchObject({
        security: "full",
        ask: "off",
        askFallback: "full",
        autoAllowSkills: true,
      });
      expect(derivedBucket.allowlist).toEqual([
        expect.objectContaining({ pattern: "/usr/bin/ls" }),
        expect.objectContaining({ pattern: "=command:finance" }),
      ]);
      expect(approvals?.agents?.["*"]?.allowlist).toEqual([
        expect.objectContaining({ pattern: "/usr/bin/pwd" }),
      ]);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("backfills derived agent approval buckets for legacy assignments while preserving derived entries", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "approval-heal",
        name: "租户 Approval Heal",
        adminUsername: "approval-heal-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-heal",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 8,
        status: "active",
      });

      const assignment = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      const derivedAgentId = String(assignment.derivedAgentId || "");

      writeExecApprovals(sandbox, {
        version: 1,
        defaults: {
          security: "full",
          ask: "off",
          askFallback: "full",
        },
        agents: {
          finance: {
            security: "full",
            ask: "off",
            askFallback: "full",
            allowlist: [
              {
                pattern: "/usr/bin/head",
              },
              {
                pattern: "=command:shared",
              },
            ],
          },
          [derivedAgentId]: {
            ask: "always",
            allowlist: [
              {
                pattern: "/usr/bin/cat",
              },
              {
                pattern: "=command:shared",
              },
            ],
          },
        },
      });

      const assignedAgents = listAssignedAgentsForUser(
        db,
        {
          tenantId: tenant.id,
          userId: member.id,
          configPath: sandbox.config.configPath,
          configDir: sandbox.config.configDir,
        },
        readOpenClawAgentCatalog(sandbox.config.configPath),
      );
      expect(assignedAgents).toHaveLength(1);

      const approvals = readExecApprovals(sandbox);
      const derivedBucket = approvals?.agents?.[derivedAgentId];
      expect(derivedBucket).toMatchObject({
        security: "full",
        ask: "off",
        askFallback: "full",
      });
      expect(
        derivedBucket.allowlist.map((entry) => entry.pattern).toSorted(),
      ).toEqual(["/usr/bin/cat", "/usr/bin/head", "=command:shared"].toSorted());
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("removes derived agent approval buckets when deleting a tenant member", () => {
    const sandbox = createTempSandbox();
    writeExecApprovals(sandbox, {
      version: 1,
      defaults: {
        security: "full",
        ask: "off",
        askFallback: "full",
      },
      agents: {
        finance: {
          security: "full",
          ask: "off",
          askFallback: "full",
          allowlist: [
            {
              pattern: "/usr/bin/ls",
            },
          ],
        },
      },
    });

    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "approval-delete",
        name: "租户 Approval Delete",
        adminUsername: "approval-delete-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-delete-approval",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 8,
        status: "active",
      });

      const assignment = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      const derivedAgentId = String(assignment.derivedAgentId || "");
      expect(readExecApprovals(sandbox)?.agents?.[derivedAgentId]).toBeTruthy();

      deleteTenantMember(db, {
        tenantId: tenant.id,
        userId: member.id,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      const approvals = readExecApprovals(sandbox);
      expect(approvals?.agents?.finance).toBeTruthy();
      expect(approvals?.agents?.[derivedAgentId]).toBeUndefined();
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("externalizes inline HTML handlers so echarts-view modal close buttons stay clickable", () => {
    const sandbox = createTempSandbox();
    const visualizationDir = path.join(
      sandbox.config.configDir,
      "workspace-agents",
      "finance",
      "Echarts",
    );
    fs.mkdirSync(visualizationDir, { recursive: true });

    const rewrittenHtml = rewriteVisualizationHtml(
      [
        "<!doctype html>",
        "<html>",
        "  <body>",
        '    <div id="modalMask" style="display:block">',
        '      <button class="modal-close" onclick="closeDrill()">关闭</button>',
        '      <button class="modal-next" onclick="window.location.href=\'next_index.html\'; return false;">下一页</button>',
        "    </div>",
        "    <script>",
        "      function closeDrill() {",
        "        document.getElementById('modalMask').style.display = 'none';",
        "      }",
        "    </script>",
        "  </body>",
        "</html>",
      ].join("\n"),
      "/workspace-agent-downloads/finance/Echarts/",
      visualizationDir,
      "集团经营分析总览大屏_index.html",
      new Map([["next_index.html", "/echarts-view/?token=next-token"]]),
    );

    expect(rewrittenHtml).not.toContain("onclick=");
    expect(rewrittenHtml).toContain("data-openclaw-inline-handler-1");
    expect(rewrittenHtml).toContain("data-openclaw-inline-handler-2");

    const assetPrefix = /^\/workspace-agent-downloads\/finance\/Echarts\//;
    const generatedInlineScriptMatch = rewrittenHtml.match(
      /<script\b[^>]*src="([^"]*inline-script-[^"]+\.js)"[^>]*><\/script>/i,
    );
    expect(generatedInlineScriptMatch).not.toBeNull();

    const generatedHandlerScriptMatch = rewrittenHtml.match(
      /<script\b[^>]*src="([^"]*inline-handler-[^"]+\.js)"[^>]*><\/script>/i,
    );
    expect(generatedHandlerScriptMatch).not.toBeNull();

    const generatedHandlerScriptPath = path.join(
      visualizationDir,
      String(generatedHandlerScriptMatch?.[1] || "").replace(assetPrefix, ""),
    );
    expect(fs.existsSync(generatedHandlerScriptPath)).toBe(true);

    const generatedHandlerScriptContent = fs.readFileSync(generatedHandlerScriptPath, "utf8");
    expect(generatedHandlerScriptContent).toContain('addEventListener("click"');
    expect(generatedHandlerScriptContent).toContain("closeDrill()");
    expect(generatedHandlerScriptContent).toContain("event.preventDefault()");
    expect(generatedHandlerScriptContent).toContain("event.stopPropagation()");
    expect(generatedHandlerScriptContent).toContain(
      "window.top.location.href = '/echarts-view/?token=next-token'",
    );
  });

  it("builds dashboard manifest wrappers that only depend on zero-intrusive runtime assets", () => {
    const html = buildDashboardManifestHtml(
      {
        version: 1,
        template: "financial-command-center-v1",
        title: "财务总览驾驶舱",
        dataSource: "data/dashboard.json",
        metrics: [{ label: "总资产", value: "128.6", unit: "亿元" }],
      },
      {
        visualizationName: "财务总览驾驶舱",
        visualizationFileName: "财务总览驾驶舱_index.dashboard.json",
        workspaceBaseHref: "/workspace-agent-downloads/tenant-agent-1/Echarts/",
        visualizationHref:
          "/workspace-agent-downloads/tenant-agent-1/Echarts/%E8%B4%A2%E5%8A%A1%E6%80%BB%E8%A7%88%E9%A9%BE%E9%A9%B6%E8%88%B1_index.dashboard.json",
        agentName: "财务分析助手",
        agentId: "tenant-agent-1",
        navigationHrefs: {
          "资金驾驶舱_index.dashboard.json": "/echarts-view/?token=next-token",
        },
      },
    );

    expect(html).toContain('/assets/runtime/dashboard-manifest/styles.css');
    expect(html).toContain('/assets/runtime/dashboard-manifest/bootstrap.js');
    expect(html).toContain('type="application/json"');
    expect(html).toContain('"visualizationType":"dashboard_manifest"');
    expect(html).toContain('"workspaceBaseHref":"/workspace-agent-downloads/tenant-agent-1/Echarts/"');
    expect(html).toContain('"dataSource":"data/dashboard.json"');
    expect(html).not.toContain("<script>");
  });

  it("updates tenant member limits without breaking current member counts", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "gamma",
        name: "租户 Gamma",
        adminUsername: "gamma-admin",
        adminPassword: "secret",
        memberLimit: 5,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-a",
        password: "secret",
      });

      const updated = updateTenantMemberLimit(db, {
        tenantId: tenant.id,
        memberLimit: 6,
      });

      expect(updated?.memberLimit).toBe(6);
      expect(() =>
        updateTenantMemberLimit(db, {
          tenantId: tenant.id,
          memberLimit: 0,
        }),
      ).toThrow("member_limit_invalid");
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("revokes tenant-distributed agents and invalidates related member assignments", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "lambda",
        name: "租户 Lambda",
        adminUsername: "lambda-admin",
        adminPassword: "secret",
        memberLimit: 5,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const memberA = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-a",
        password: "secret",
      });
      const memberB = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-b",
        password: "secret",
      });
      const catalog = readOpenClawAgentCatalog(sandbox.config.configPath);
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1.2,
        balancePoints: 18,
        status: "active",
      });

      assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: memberA.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: memberB.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      const result = revokePlatformTenantAgents(db, {
        tenantId: tenant.id,
        tenantAgentIds: [tenantAgentId],
      });
      expect(result).toMatchObject({
        revokedTenantAgentCount: 1,
        revokedAssignmentCount: 2,
        affectedMemberCount: 2,
      });
      expect(result.tenantAgentIds).toEqual([tenantAgentId]);
      expect(result.affectedUserIds.toSorted()).toEqual([memberA.id, memberB.id].toSorted());

      expect(listTenantAgents(db, tenant.id, catalog)).toHaveLength(0);
      expect(
        listAssignedAgentsForUser(
          db,
          {
            tenantId: tenant.id,
            userId: memberA.id,
            configPath: sandbox.config.configPath,
            configDir: sandbox.config.configDir,
          },
          catalog,
        ),
      ).toHaveLength(0);
      expect(
        listAssignedAgentsForUser(
          db,
          {
            tenantId: tenant.id,
            userId: memberB.id,
            configPath: sandbox.config.configPath,
            configDir: sandbox.config.configDir,
          },
          catalog,
        ),
      ).toHaveLength(0);

      expect(() =>
        assignTenantAgentToUser(db, {
          tenantId: tenant.id,
          userId: memberA.id,
          tenantAgentId,
          configPath: sandbox.config.configPath,
          configDir: sandbox.config.configDir,
        }),
      ).toThrow("tenant_agent_inactive");

      expect(() =>
        syncTenantUsageRecords(db, {
          tenantId: tenant.id,
          userId: memberA.id,
          tenantAgentId,
          openclawSessionKey: "agent:finance:tenant:lambda:user:member-a:chat:latest",
          records: [
            {
              sourceFingerprint: "assistant-1",
              messageTimestamp: "2026-04-13T09:30:00.000Z",
              usageDay: "2026-04-13",
              provider: "openai",
              model: "openai/gpt-5.4",
              inputTokens: 20,
              outputTokens: 8,
              totalTokens: 28,
              totalCost: 0.01,
            },
          ],
        }),
      ).toThrow("tenant_agent_not_found");
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("updates tenant member status and password in the database layer", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "theta",
        name: "租户 Theta",
        adminUsername: "theta-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-a",
        password: "secret",
      });

      const disabled = updateTenantMemberStatus(db, {
        tenantId: tenant.id,
        userId: member.id,
        status: "inactive",
      });
      expect(disabled?.status).toBe("inactive");
      expect(getUserByUsername(db, "member-a")?.status).toBe("inactive");

      const passwordChanged = updateTenantMemberPassword(db, {
        tenantId: tenant.id,
        userId: member.id,
        password: "new-secret",
      });
      expect(passwordChanged?.status).toBe("inactive");
      expect(
        verifyPassword("secret", String(getUserByUsername(db, "member-a")?.password_hash || "")),
      ).toBe(false);
      expect(
        verifyPassword("new-secret", String(getUserByUsername(db, "member-a")?.password_hash || "")),
      ).toBe(true);

      const enabled = updateTenantMemberStatus(db, {
        tenantId: tenant.id,
        userId: member.id,
        status: "active",
      });
      expect(enabled?.status).toBe("active");
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("logically deletes tenant members and revokes their active assignments", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "iota",
        name: "租户 Iota",
        adminUsername: "iota-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-delete",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 12,
        status: "active",
      });
      assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      const sessionKey = "agent:finance:tenant:iota:user:member-delete:chat:latest";
      syncTenantUsageRecords(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        records: [
          {
            sourceFingerprint: "assistant-delete",
            messageTimestamp: "2026-04-13T09:30:00.000Z",
            usageDay: "2026-04-13",
            provider: "openai",
            model: "openai/gpt-5.4",
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            totalCost: 0.15,
          },
        ],
      });
      const derivedAgentId = String(
        db
          .prepare(
            `SELECT derived_agent_id AS derivedAgentId
             FROM user_agent_assignments
             WHERE tenant_id = ? AND user_id = ? AND tenant_agent_id = ?`,
          )
          .get(tenant.id, member.id, tenantAgentId)?.derivedAgentId || "",
      );
      const canonicalWorkspace = path.join(
        sandbox.config.configDir,
        "workspace-agents",
        derivedAgentId,
      );
      const runtimeWorkspace = path.join(
        sandbox.config.configDir,
        `workspace-${derivedAgentId}`,
      );
      expect(fs.existsSync(canonicalWorkspace)).toBe(true);
      expect(fs.existsSync(runtimeWorkspace)).toBe(true);

      const deleted = deleteTenantMember(db, {
        tenantId: tenant.id,
        userId: member.id,
        configDir: sandbox.config.configDir,
        configPath: sandbox.config.configPath,
      });

      expect(deleted).toMatchObject({
        id: member.id,
        username: "member-delete",
        revokedAssignmentCount: 1,
        preservedUsageCount: 1,
        removedWorkspaceCount: 1,
      });
      expect(listTenantMembers(db, tenant.id)).toEqual([]);
      expect(getUserByUsername(db, "member-delete")).toBeNull();
      expect(
        db
          .prepare(
            `SELECT id
             FROM tenant_memberships
             WHERE tenant_id = ? AND user_id = ? AND role = 'member'`,
          )
          .get(tenant.id, member.id)?.id ?? null,
      ).toBeNull();
      expect(
        db
          .prepare(
            `SELECT id
             FROM user_agent_assignments
             WHERE tenant_id = ? AND user_id = ? AND tenant_agent_id = ?`,
          )
          .get(tenant.id, member.id, tenantAgentId)?.id ?? null,
      ).toBeNull();
      expect(
        listAssignedAgentsForUser(
          db,
          { tenantId: tenant.id, userId: member.id },
          readOpenClawAgentCatalog(sandbox.config.configPath),
        ),
      ).toEqual([]);
      expect(
        listTenantUsageRecords(db, {
          tenantId: tenant.id,
          page: 1,
          pageSize: 8,
          search: "",
        }).items[0],
      ).toMatchObject({
        memberId: member.id,
        memberUsername: "member-delete",
        agentId: "finance",
        totalTokens: 150,
        creditsUsed: 0.15,
      });
      expect(getTenantOverview(db, { tenantId: tenant.id }).topMembers[0]).toMatchObject({
        username: "member-delete",
        tokens: 150,
      });
      expect(fs.existsSync(canonicalWorkspace)).toBe(false);
      expect(fs.existsSync(runtimeWorkspace)).toBe(false);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("creates a new member record when the same username is recreated after deletion", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "kappa",
        name: "租户 Kappa",
        adminUsername: "kappa-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-recreate",
        password: "secret",
      });

      deleteTenantMember(db, {
        tenantId: tenant.id,
        userId: member.id,
        configDir: sandbox.config.configDir,
        configPath: sandbox.config.configPath,
      });

      const recreated = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-recreate",
        password: "renew-secret",
      });

      const userRecord = getUserByUsername(db, "member-recreate");
      const oldMembership = db
        .prepare(
          `SELECT id
           FROM tenant_memberships
           WHERE tenant_id = ? AND user_id = ? AND role = 'member'`,
        )
        .get(tenant.id, member.id);
      const newMembership = db
        .prepare(
          `SELECT status
           FROM tenant_memberships
           WHERE tenant_id = ? AND user_id = ? AND role = 'member'`,
        )
        .get(tenant.id, recreated.id);

      expect(recreated?.id).not.toBe(member.id);
      expect(userRecord?.status).toBe("active");
      expect(userRecord?.id).toBe(recreated?.id);
      expect(verifyPassword("secret", String(userRecord?.password_hash || ""))).toBe(false);
      expect(verifyPassword("renew-secret", String(userRecord?.password_hash || ""))).toBe(true);
      expect(oldMembership?.id ?? null).toBeNull();
      expect(newMembership?.status).toBe("active");
      expect(listTenantMembers(db, tenant.id)).toEqual([
        expect.objectContaining({
          id: recreated.id,
          username: "member-recreate",
          status: "active",
        }),
      ]);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("deducts agent points from synced usage records without double-charging repeats", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "delta",
        name: "租户 Delta",
        adminUsername: "delta-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-a",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 10,
        status: "active",
      });
      assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      const sessionKey = "agent:finance:tenant:delta:user:member-a:chat:latest";
      const firstSync = syncTenantUsageRecords(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        records: [
          {
            sourceFingerprint: "assistant-1",
            messageTimestamp: "2026-04-13T09:30:00.000Z",
            usageDay: "2026-04-13",
            provider: "openai",
            model: "openai/gpt-5.4",
            inputTokens: 120,
            outputTokens: 45,
            totalTokens: 165,
            totalCost: 0.12,
          },
        ],
      });
      expect(firstSync.inserted).toBe(1);
      expect(firstSync.billingEnabled).toBe(true);
      expect(firstSync.pointsDelta).toBeCloseTo(0.12, 8);
      expect(firstSync.agentBalancePoints).toBeCloseTo(9.88, 8);

      const repeatedSync = syncTenantUsageRecords(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        records: [
          {
            sourceFingerprint: "assistant-1",
            messageTimestamp: "2026-04-13T09:30:00.000Z",
            usageDay: "2026-04-13",
            provider: "openai",
            model: "openai/gpt-5.4",
            inputTokens: 120,
            outputTokens: 45,
            totalTokens: 165,
            totalCost: 0.12,
          },
        ],
      });
      expect(repeatedSync.updated).toBe(1);
      expect(repeatedSync.pointsDelta).toBe(0);
      expect(repeatedSync.agentBalancePoints).toBeCloseTo(9.88, 8);

      const adjustedSync = syncTenantUsageRecords(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        records: [
          {
            sourceFingerprint: "assistant-1",
            messageTimestamp: "2026-04-13T09:30:00.000Z",
            usageDay: "2026-04-13",
            provider: "openai",
            model: "openai/gpt-5.4",
            inputTokens: 120,
            outputTokens: 45,
            totalTokens: 165,
            totalCost: 0.2,
          },
        ],
      });
      expect(adjustedSync.updated).toBe(1);
      expect(adjustedSync.pointsDelta).toBeCloseTo(0.08, 8);
      expect(adjustedSync.agentBalancePoints).toBeCloseTo(9.8, 8);

      const assignedAgents = listAssignedAgentsForUser(
        db,
        { tenantId: tenant.id, userId: member.id },
        readOpenClawAgentCatalog(sandbox.config.configPath),
      );
      expect(assignedAgents[0]?.balancePoints).toBeCloseTo(9.8, 8);
      expect(
        listTenantUsageRecords(db, {
          tenantId: tenant.id,
          page: 1,
          pageSize: 8,
          search: "",
        }).items[0],
      ).toMatchObject({
        creditsUsed: 0.2,
        totalTokens: 165,
        total_tokens: 165,
        tokens: 165,
        inputTokens: 120,
        input_tokens: 120,
        outputTokens: 45,
        output_tokens: 45,
        memberUsername: member.username,
        agentId: "finance",
      });

      const ledgerRows = db
        .prepare(
          `SELECT category, amount_points AS amountPoints, balance_after AS balanceAfter, note
           FROM tenant_wallet_ledger
           WHERE tenant_id = ?
           ORDER BY created_at ASC`,
        )
        .all(tenant.id);
      expect(ledgerRows).toHaveLength(1);
      expect(ledgerRows[0]).toMatchObject({
        category: "usage_charge",
        amountPoints: 0.2,
        balanceAfter: 9.8,
      });
      expect(String(ledgerRows[0]?.note || "")).toContain(sessionKey);

      const overview = getTenantOverview(db, { tenantId: tenant.id });
      expect(overview?.summary.walletBalance).toBe(0);
      expect(overview?.summary.consumedCredits).toBeCloseTo(0.2, 8);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("falls back to session estimatedCostUsd when synced usage records omit per-record cost", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "zeta",
        name: "租户 Zeta",
        adminUsername: "zeta-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-a",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 10,
        status: "active",
      });
      const assignment = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      const sessionKey = "agent:finance:tenant:zeta:user:member-a:chat:latest";
      writeSessionStoreEntry(sandbox, String(assignment.derivedAgentId || "finance"), sessionKey, {
        sessionId: "sess-zeta",
        estimatedCostUsd: 0.2,
        updatedAt: "2026-04-13T10:00:00.000Z",
      });

      const syncResult = syncTenantUsageRecords(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
        records: [
          {
            sourceFingerprint: "assistant-1",
            messageTimestamp: "2026-04-13T09:30:00.000Z",
            usageDay: "2026-04-13",
            provider: "openai",
            model: "openai/gpt-5.4",
            inputTokens: 90,
            outputTokens: 60,
            totalTokens: 150,
          },
          {
            sourceFingerprint: "assistant-2",
            messageTimestamp: "2026-04-13T09:35:00.000Z",
            usageDay: "2026-04-13",
            provider: "openai",
            model: "openai/gpt-5.4",
            inputTokens: 30,
            outputTokens: 20,
            totalTokens: 50,
          },
        ],
      });
      expect(syncResult.inserted).toBe(2);
      expect(syncResult.pointsDelta).toBeCloseTo(0.2, 8);
      expect(syncResult.agentBalancePoints).toBeCloseTo(9.8, 8);

      const usageRows = db
        .prepare(
          `SELECT source_fingerprint AS sourceFingerprint, total_cost AS totalCost
           FROM tenant_usage_records
           WHERE tenant_id = ?
           ORDER BY message_timestamp ASC`,
        )
        .all(tenant.id);
      expect(usageRows).toEqual([
        expect.objectContaining({
          sourceFingerprint: "assistant-1",
          totalCost: 0.15,
        }),
        expect.objectContaining({
          sourceFingerprint: "assistant-2",
          totalCost: 0.05,
        }),
      ]);

      const ledgerRows = db
        .prepare(
          `SELECT amount_points AS amountPoints, balance_after AS balanceAfter, note
           FROM tenant_wallet_ledger
           WHERE tenant_id = ?
           ORDER BY created_at ASC`,
        )
        .all(tenant.id);
      expect(ledgerRows).toHaveLength(2);
      expect(ledgerRows[0]).toMatchObject({
        amountPoints: 0.15,
        balanceAfter: 9.85,
      });
      expect(ledgerRows[1]).toMatchObject({
        amountPoints: 0.05,
        balanceAfter: 9.8,
      });
      expect(String(ledgerRows[0]?.note || "")).toContain(sessionKey);
      expect(String(ledgerRows[1]?.note || "")).toContain(sessionKey);

      const overview = getTenantOverview(db, { tenantId: tenant.id });
      expect(overview?.summary.consumedCredits).toBeCloseTo(0.2, 8);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("estimates zero-priced ollama usage from tokens during sync", () => {
    const sandbox = createTempSandbox();
    fs.writeFileSync(
      sandbox.config.configPath,
      JSON.stringify({
        agents: {
          list: [
            {
              id: "finance",
              name: "财务分析助手",
            },
          ],
        },
        models: {
          mode: "merge",
          providers: {
            ollama: {
              api: "ollama",
              models: [
                {
                  id: "qwen3.6:latest",
                  cost: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                  },
                },
              ],
            },
          },
        },
      }),
      "utf8",
    );
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "theta",
        name: "租户 Theta",
        adminUsername: "theta-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-ollama",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 10,
        status: "active",
      });
      const assignment = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      const sessionKey = "agent:finance:tenant:theta:user:member-ollama:chat:latest";
      writeSessionStoreEntry(sandbox, String(assignment.derivedAgentId || "finance"), sessionKey, {
        sessionId: "sess-theta",
        estimatedCostUsd: 0,
        modelProvider: "ollama",
        model: "qwen3.6:latest",
        updatedAt: "2026-04-13T10:00:00.000Z",
      });

      const syncResult = syncTenantUsageRecords(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
        records: [
          {
            sourceFingerprint: "assistant-1",
            messageTimestamp: "2026-04-13T09:30:00.000Z",
            usageDay: "2026-04-13",
            provider: "ollama",
            model: "qwen3.6:latest",
            inputTokens: 80_000,
            outputTokens: 4_000,
            totalTokens: 84_000,
          },
          {
            sourceFingerprint: "assistant-2",
            messageTimestamp: "2026-04-13T09:35:00.000Z",
            usageDay: "2026-04-13",
            provider: "ollama",
            model: "qwen3.6:latest",
            inputTokens: 40_000,
            outputTokens: 2_000,
            totalTokens: 42_000,
          },
        ],
      });
      expect(syncResult.inserted).toBe(2);
      expect(syncResult.pointsDelta).toBeCloseTo(0.0432, 8);
      expect(syncResult.agentBalancePoints).toBeCloseTo(9.9568, 8);

      const usageRows = db
        .prepare(
          `SELECT source_fingerprint AS sourceFingerprint, total_cost AS totalCost
           FROM tenant_usage_records
           WHERE tenant_id = ?
           ORDER BY message_timestamp ASC`,
        )
        .all(tenant.id);
      expect(usageRows).toEqual([
        expect.objectContaining({
          sourceFingerprint: "assistant-1",
          totalCost: 0.0288,
        }),
        expect.objectContaining({
          sourceFingerprint: "assistant-2",
          totalCost: 0.0144,
        }),
      ]);

      const overview = getTenantOverview(db, { tenantId: tenant.id });
      expect(overview?.summary.consumedCredits).toBeCloseTo(0.0432, 8);
      const usageList = listTenantUsageRecords(db, { tenantId: tenant.id, page: 1, pageSize: 8 });
      expect(usageList.items[0]?.creditsUsed).toBeGreaterThan(0);
      expect(usageList.items[1]?.creditsUsed).toBeGreaterThan(0);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("repairs historical usage rows when session estimatedCostUsd becomes available later", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "eta",
        name: "租户 Eta",
        adminUsername: "eta-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-a",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 10,
        status: "active",
      });
      const assignment = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      const sessionKey = "agent:finance:tenant:eta:user:member-a:chat:latest";
      db.prepare(
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
         )`,
      ).run({
        id: "usage-eta-1",
        tenantId: tenant.id,
        userId: member.id,
        memberUserId: member.id,
        memberUsername: member.username,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        sourceFingerprint: "assistant-1",
        messageTimestamp: "2026-04-13T09:30:00.000Z",
        usageDay: "2026-04-13",
        provider: "cleannetworkspace",
        model: "gpt-5.4",
        inputTokens: 80,
        outputTokens: 40,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 120,
        totalCost: null,
        createdAt: "2026-04-13T09:30:00.000Z",
        updatedAt: "2026-04-13T09:30:00.000Z",
      });
      db.prepare(
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
         )`,
      ).run({
        id: "usage-eta-2",
        tenantId: tenant.id,
        userId: member.id,
        memberUserId: member.id,
        memberUsername: member.username,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        sourceFingerprint: "assistant-2",
        messageTimestamp: "2026-04-13T09:35:00.000Z",
        usageDay: "2026-04-13",
        provider: "cleannetworkspace",
        model: "gpt-5.4",
        inputTokens: 40,
        outputTokens: 20,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 60,
        totalCost: null,
        createdAt: "2026-04-13T09:35:00.000Z",
        updatedAt: "2026-04-13T09:35:00.000Z",
      });
      expect(
        db
          .prepare(
            `SELECT COUNT(*) AS count
             FROM tenant_wallet_ledger
             WHERE tenant_id = ? AND category = 'usage_charge'`,
          )
          .get(tenant.id)?.count,
      ).toBe(0);

      writeSessionStoreEntry(sandbox, String(assignment.derivedAgentId || "finance"), sessionKey, {
        sessionId: "sess-eta",
        estimatedCostUsd: 0,
        modelProvider: "cleannetworkspace",
        model: "gpt-5.4",
        inputTokens: 48000,
        outputTokens: 4000,
        cacheRead: 0,
        cacheWrite: 0,
        updatedAt: "2026-04-13T10:10:00.000Z",
      });

      const repairResult = repairTenantUsageCostGaps(db, {
        tenantId: tenant.id,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      expect(repairResult).toMatchObject({
        scannedSessions: 1,
        repairedSessions: 1,
        repairedRows: 2,
      });

      const repairedRows = db
        .prepare(
          `SELECT source_fingerprint AS sourceFingerprint, total_cost AS totalCost
           FROM tenant_usage_records
           WHERE tenant_id = ?
           ORDER BY message_timestamp ASC`,
        )
        .all(tenant.id);
      expect(repairedRows).toEqual([
        expect.objectContaining({
          sourceFingerprint: "assistant-1",
          totalCost: 0.0008,
        }),
        expect.objectContaining({
          sourceFingerprint: "assistant-2",
          totalCost: 0.0004,
        }),
      ]);

      const ledgerRows = db
        .prepare(
          `SELECT amount_points AS amountPoints, balance_after AS balanceAfter
           FROM tenant_wallet_ledger
           WHERE tenant_id = ?
           ORDER BY created_at ASC`,
        )
        .all(tenant.id);
      expect(ledgerRows).toHaveLength(2);
      expect(ledgerRows[0]).toMatchObject({
        amountPoints: 0.0008,
        balanceAfter: 9.9992,
      });
      expect(ledgerRows[1]).toMatchObject({
        amountPoints: 0.0004,
        balanceAfter: 9.9988,
      });

      const assignedAgents = listAssignedAgentsForUser(
        db,
        { tenantId: tenant.id, userId: member.id },
        readOpenClawAgentCatalog(sandbox.config.configPath),
      );
      expect(assignedAgents[0]?.balancePoints).toBeCloseTo(9.9988, 8);
      expect(getTenantOverview(db, { tenantId: tenant.id }).summary.consumedCredits).toBeCloseTo(
        0.0012,
        8,
      );
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("repairs legacy zero-token usage records in place when corrected usage arrives", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "epsilon",
        name: "租户 Epsilon",
        adminUsername: "epsilon-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-a",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 10,
        status: "active",
      });
      assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      const sessionKey = "agent:finance:tenant:epsilon:user:member-a:chat:latest";
      const baseRecord = {
        messageTimestamp: "2026-04-13T09:30:00.000Z",
        usageDay: "2026-04-13",
        provider: "openai",
        model: "openai/gpt-5.4",
        totalTokens: 165,
        totalCost: 0.12,
      };

      const firstSync = syncTenantUsageRecords(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        records: [
          {
            sourceFingerprint: "legacy-zero",
            inputTokens: 0,
            outputTokens: 0,
            ...baseRecord,
          },
        ],
      });
      expect(firstSync.inserted).toBe(1);
      expect(firstSync.updated).toBe(0);

      const repairedSync = syncTenantUsageRecords(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        records: [
          {
            sourceFingerprint: "legacy-correct",
            inputTokens: 120,
            outputTokens: 45,
            ...baseRecord,
          },
        ],
      });
      expect(repairedSync.inserted).toBe(0);
      expect(repairedSync.updated).toBe(1);
      expect(repairedSync.pointsDelta).toBe(0);
      expect(repairedSync.agentBalancePoints).toBeCloseTo(9.88, 8);

      expect(
        listTenantUsageRecords(db, {
          tenantId: tenant.id,
          page: 1,
          pageSize: 8,
          search: "",
        }).items,
      ).toHaveLength(1);
      expect(
        listTenantUsageRecords(db, {
          tenantId: tenant.id,
          page: 1,
          pageSize: 8,
          search: "",
        }).items[0],
      ).toMatchObject({
        creditsUsed: 0.12,
        totalTokens: 165,
        inputTokens: 120,
        outputTokens: 45,
        memberUsername: member.username,
        agentId: "finance",
      });

      const usageRows = db
        .prepare(
          `SELECT source_fingerprint AS sourceFingerprint,
                  input_tokens AS inputTokens,
                  output_tokens AS outputTokens
           FROM tenant_usage_records
           WHERE tenant_id = ?
           ORDER BY created_at DESC`,
        )
        .all(tenant.id);
      expect(usageRows).toHaveLength(1);
      expect(usageRows[0]).toMatchObject({
        sourceFingerprint: "legacy-correct",
        inputTokens: 120,
        outputTokens: 45,
      });

      const ledgerRows = db
        .prepare(
          `SELECT category, amount_points AS amountPoints, balance_after AS balanceAfter, note
           FROM tenant_wallet_ledger
           WHERE tenant_id = ?
           ORDER BY created_at ASC`,
        )
        .all(tenant.id);
      expect(ledgerRows).toHaveLength(1);
      expect(ledgerRows[0]).toMatchObject({
        category: "usage_charge",
        amountPoints: 0.12,
        balanceAfter: 9.88,
      });
      expect(String(ledgerRows[0]?.note || "")).toContain("legacy-correct");
    } finally {
      closeTenantPlatformDb(db);
    }
  });
});
