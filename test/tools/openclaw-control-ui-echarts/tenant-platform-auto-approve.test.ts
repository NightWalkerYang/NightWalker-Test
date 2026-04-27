import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { resolveTenantPlatformConfig } from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/config.mjs";
import {
  createTenantExecApprovalAutoApprover,
  ensureTenantExecApprovalGatewayAccess,
  rawGatewayDataToString,
  shouldAutoApproveTenantExecRequest,
} from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/exec-approval-auto-approve.mjs";

describe("tenant platform exec auto-approve config", () => {
  it("normalizes gateway env overrides and parses the auto-approve flag", () => {
    const config = resolveTenantPlatformConfig({
      HOME: "/tmp/openclaw-home",
      OPENCLAW_CONFIG_DIR: "/tmp/openclaw-home/.openclaw",
      OPENCLAW_GATEWAY_TOKEN: "shared-token",
      OPENCLAW_TENANT_PLATFORM_GATEWAY_URL: "http://openclaw-gateway:18789",
      OPENCLAW_TENANT_PLATFORM_EXEC_AUTO_APPROVE: "0",
    });

    expect(config.gatewayUrl).toBe("ws://openclaw-gateway:18789");
    expect(config.gatewayToken).toBe("shared-token");
    expect(config.execAutoApproveEnabled).toBe(false);
  });
});

describe("tenant platform exec auto-approve matching", () => {
  it("normalizes raw ws payload variants into strings", () => {
    const text = '{"ok":true}';
    const bytes = Buffer.from(text, "utf8");

    expect(rawGatewayDataToString(bytes)).toBe(text);
    expect(rawGatewayDataToString([bytes])).toBe(text);
    expect(rawGatewayDataToString(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))).toBe(text);
  });

  it("matches derived tenant agents directly", () => {
    expect(
      shouldAutoApproveTenantExecRequest({
        id: "approval-1",
        request: {
          agentId: "tenant-tenant-87da5-subotech-finance-0706d688feec",
        },
      }),
    ).toBe(true);
  });

  it("matches tenant workspace markers when agent id is missing", () => {
    expect(
      shouldAutoApproveTenantExecRequest(
        {
          id: "approval-2",
          request: {
            resolvedPath:
              "/home/root-ai/.openclaw/workspace-agents/tenant-tenant-87da5-subotech-finance-0706d688feec/Echarts/dashboard_index.html",
          },
        },
        {
          configDir: "/home/root-ai/.openclaw",
        },
      ),
    ).toBe(true);
  });

  it("matches tenant session keys when the approval request omits agent id", () => {
    expect(
      shouldAutoApproveTenantExecRequest({
        id: "approval-session",
        request: {
          sessionKey:
            "agent:subotech-finance:tenant:tenant-87da5:tenant-agent:tenant-agent-1:user:user-1:chat:run-1",
        },
      }),
    ).toBe(true);
  });

  it("matches tenant system.run plan agent/session context", () => {
    expect(
      shouldAutoApproveTenantExecRequest({
        id: "approval-plan",
        request: {
          systemRunPlan: {
            agentId: "tenant-tenant-87da5-subotech-finance-0706d688feec",
            sessionKey:
              "agent:tenant-tenant-87da5-subotech-finance-0706d688feec:tenant:tenant-87da5:tenant-agent:tenant-agent-1:user:user-1:chat:run-2",
          },
        },
      }),
    ).toBe(true);
  });

  it("does not match non-tenant agents", () => {
    expect(
      shouldAutoApproveTenantExecRequest({
        id: "approval-3",
        request: {
          agentId: "main",
          resolvedPath: "/home/root-ai/.openclaw/workspace-agents/main/README.md",
        },
      }),
    ).toBe(false);
  });
});

describe("tenant platform exec auto-approver", () => {
  it("seeds a persistent paired operator device for exec approvals", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-tenant-auto-approve-"));
    try {
      const configDir = path.join(root, ".openclaw");
      const stateDir = path.join(configDir, "tenant-platform");
      const seeded = ensureTenantExecApprovalGatewayAccess({
        configDir,
        stateDir,
      });

      const paired = JSON.parse(fs.readFileSync(seeded.pairedDevicesPath, "utf8"));
      const pending = JSON.parse(fs.readFileSync(seeded.pendingDevicesPath, "utf8"));
      const deviceAuth = JSON.parse(fs.readFileSync(seeded.deviceAuthStorePath, "utf8"));
      const pairedEntry = paired[seeded.deviceId];

      expect(pairedEntry.publicKey).toBeTruthy();
      expect(pairedEntry.role).toBe("operator");
      expect(pairedEntry.roles).toEqual(["operator"]);
      expect(pairedEntry.scopes).toEqual(["operator.approvals"]);
      expect(pairedEntry.approvedScopes).toEqual(["operator.approvals"]);
      expect(pairedEntry.tokens.operator.token).toBe(seeded.deviceToken);
      expect(pairedEntry.tokens.operator.scopes).toEqual(["operator.approvals"]);
      expect(pending).toEqual({});
      expect(deviceAuth).toMatchObject({
        version: 1,
        deviceId: seeded.deviceId,
        tokens: {
          operator: {
            token: seeded.deviceToken,
            role: "operator",
            scopes: ["operator.approvals"],
          },
        },
      });

      const reseeded = ensureTenantExecApprovalGatewayAccess({
        configDir,
        stateDir,
      });
      expect(reseeded.deviceId).toBe(seeded.deviceId);
      expect(reseeded.deviceToken).toBe(seeded.deviceToken);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("auto-resolves matching requests and ignores others", async () => {
    const request = vi.fn(async () => ({ ok: true }));
    const start = vi.fn();
    const stop = vi.fn();

    const approver = createTenantExecApprovalAutoApprover({
      config: {
        configDir: "/home/root-ai/.openclaw",
        gatewayUrl: "ws://openclaw-gateway:18789",
        gatewayToken: "shared-token",
        execAutoApproveEnabled: true,
      },
      logger: {
        debug() {},
        info() {},
        warn() {},
        error() {},
      },
      createGatewayClient: () => ({
        start,
        stop,
        request,
      }),
    });

    expect(approver.isEnabled()).toBe(true);
    await approver.start();
    expect(start).toHaveBeenCalledTimes(1);

    await approver.handleEvent({
      event: "exec.approval.requested",
      payload: {
        id: "approval-allow",
        request: {
          agentId: "tenant-tenant-87da5-subotech-finance-0706d688feec",
        },
      },
    });
    expect(request).toHaveBeenCalledWith("exec.approval.resolve", {
      id: "approval-allow",
      decision: "allow-once",
    });

    request.mockClear();
    await approver.handleEvent({
      event: "exec.approval.requested",
      payload: {
        id: "approval-ignore",
        request: {
          agentId: "main",
        },
      },
    });
    expect(request).not.toHaveBeenCalled();

    await approver.stop();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("can start with a seeded device token even when the shared gateway token is absent", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-tenant-auto-approve-"));
    try {
      const configDir = path.join(root, ".openclaw");
      const stateDir = path.join(configDir, "tenant-platform");
      const createGatewayClient = vi.fn(() => ({
        start() {},
        stop() {},
        request: vi.fn(async () => ({ ok: true })),
      }));

      const approver = createTenantExecApprovalAutoApprover({
        config: {
          configDir,
          stateDir,
          gatewayUrl: "ws://openclaw-gateway:18789",
          execAutoApproveEnabled: true,
        },
        logger: {
          debug() {},
          info() {},
          warn() {},
          error() {},
        },
        createGatewayClient,
      });

      expect(approver.isEnabled()).toBe(true);
      await approver.start();
      expect(createGatewayClient).toHaveBeenCalledTimes(1);
      const gatewayClientParams = createGatewayClient.mock.calls[0]?.[0];
      expect(gatewayClientParams.deviceIdentityPath).toContain("tenant-platform-gateway-client.json");
      expect(gatewayClientParams.deviceAuthStorePath).toContain("tenant-platform-device-auth.json");
      expect(gatewayClientParams.deviceToken).toBeTruthy();
      expect(gatewayClientParams.scopes).toEqual(["operator.approvals"]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
