import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  openTenantPlatformDb,
  closeTenantPlatformDb,
  createBootstrapPlatformAdmin,
  createTenantWithAdmin,
  createTenantMember,
  listTenantMembers,
  readOpenClawAgentCatalog,
  upsertTenantAgent,
  assignTenantAgentToUser,
  listAssignedAgentsForUser,
  listTenantUsageRecords,
  syncTenantUsageRecords,
  updateTenantMemberLimit,
} from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/db.mjs";

const cleanupRoots = new Set();

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
    },
  };
}

afterEach(() => {
  for (const root of cleanupRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  cleanupRoots.clear();
});

describe("tenant platform database foundation", () => {
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

  it("assigns a tenant agent to a member and returns card-ready identity fields", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
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
    } finally {
      closeTenantPlatformDb(db);
    }
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
    } finally {
      closeTenantPlatformDb(db);
    }
  });
});
