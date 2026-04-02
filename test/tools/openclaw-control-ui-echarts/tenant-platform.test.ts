import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openTenantPlatformDb, closeTenantPlatformDb, createBootstrapPlatformAdmin, createTenantWithAdmin, createTenantMember, listTenantMembers, readOpenClawAgentCatalog, upsertTenantAgent, assignTenantAgentToUser, listAssignedAgentsForUser } from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/db.mjs";

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

      assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
      });

      const agents = listAssignedAgentsForUser(
        db,
        { tenantId: tenant.id, userId: member.id },
        catalog,
      );
      expect(agents).toHaveLength(1);
      expect(agents[0]?.agentName).toBe("财务分析助手");
      expect(agents[0]?.emoji).toBe("💼");
      expect(agents[0]?.balancePoints).toBe(42);
    } finally {
      closeTenantPlatformDb(db);
    }
  });
});
