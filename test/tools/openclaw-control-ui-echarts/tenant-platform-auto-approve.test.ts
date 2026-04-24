import { describe, expect, it, vi } from "vitest";

import { resolveTenantPlatformConfig } from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/config.mjs";
import {
  createTenantExecApprovalAutoApprover,
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
});
