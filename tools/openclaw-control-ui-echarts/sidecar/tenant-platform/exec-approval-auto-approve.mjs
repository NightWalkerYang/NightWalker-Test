import crypto from "node:crypto";
import path from "node:path";
import { WebSocket } from "ws";

const PROTOCOL_VERSION = 3;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_CONNECT_CHALLENGE_TIMEOUT_MS = 5_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

function createDefaultLogger() {
  return {
    debug() {},
    info(message) {
      process.stdout.write(`${String(message)}\n`);
    },
    warn(message) {
      process.stderr.write(`${String(message)}\n`);
    },
    error(message) {
      process.stderr.write(`${String(message)}\n`);
    },
  };
}

function createRequestError(error) {
  const message =
    error && typeof error === "object" && typeof error.message === "string"
      ? error.message
      : "gateway request failed";
  const next = new Error(message);
  if (error && typeof error === "object") {
    next.code = typeof error.code === "string" ? error.code : undefined;
    next.details = error.details;
  }
  return next;
}

function normalizePathForMatch(value) {
  return String(value ?? "")
    .trim()
    .replace(/\\/g, "/")
    .toLowerCase();
}

function isTenantDerivedAgentId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .startsWith("tenant-");
}

function readApprovalEnvelope(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const approvalId = typeof payload.id === "string" ? payload.id.trim() : "";
  const request =
    payload.request && typeof payload.request === "object" && !Array.isArray(payload.request)
      ? payload.request
      : null;
  if (!approvalId || !request) {
    return null;
  }
  return {
    id: approvalId,
    request,
  };
}

function matchesTenantWorkspaceMarker(value, configDir) {
  const normalized = normalizePathForMatch(value);
  if (!normalized) {
    return false;
  }
  if (
    normalized.includes("/workspace-agents/tenant-") ||
    normalized.includes("/workspace-tenant-")
  ) {
    return true;
  }
  const workspaceAgentsRoot = normalizePathForMatch(
    path.join(String(configDir || ""), "workspace-agents"),
  );
  return Boolean(workspaceAgentsRoot) && normalized.includes(`${workspaceAgentsRoot}/tenant-`);
}

export function shouldAutoApproveTenantExecRequest(payload, options = {}) {
  const approval = readApprovalEnvelope(payload);
  if (!approval) {
    return false;
  }
  const agentId = String(approval.request.agentId || "").trim();
  if (isTenantDerivedAgentId(agentId)) {
    return true;
  }
  return [
    approval.request.cwd,
    approval.request.resolvedPath,
    approval.request.command,
    approval.request.commandPreview,
  ].some((entry) => matchesTenantWorkspaceMarker(entry, options.configDir));
}

function createGatewayApprovalsClient(params) {
  let ws = null;
  let shouldRun = false;
  let connected = false;
  let connectTimer = null;
  let reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  const pending = new Map();

  const clearConnectTimer = () => {
    if (!connectTimer) {
      return;
    }
    clearTimeout(connectTimer);
    connectTimer = null;
  };

  const flushPending = (error) => {
    for (const entry of pending.values()) {
      if (entry.timeout) {
        clearTimeout(entry.timeout);
      }
      entry.reject(error);
    }
    pending.clear();
  };

  const scheduleReconnect = () => {
    if (!shouldRun) {
      return;
    }
    const delayMs = reconnectDelayMs;
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
    setTimeout(() => {
      if (shouldRun) {
        connect();
      }
    }, delayMs).unref?.();
  };

  const sendFrameRequest = (method, requestParams, options = {}) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("gateway approvals socket is not open"));
    }
    if (options.requireConnected !== false && !connected) {
      return Promise.reject(new Error("gateway approvals socket is not connected"));
    }
    const id = crypto.randomUUID();
    const frame = JSON.stringify({
      type: "req",
      id,
      method,
      params: requestParams,
    });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out waiting for gateway response`));
      }, options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
      timeout.unref?.();
      pending.set(id, { method, resolve, reject, timeout });
      try {
        ws.send(frame);
      } catch (error) {
        clearTimeout(timeout);
        pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  };

  const sendConnect = () => {
    clearConnectTimer();
    void sendFrameRequest(
      "connect",
      {
        minProtocol: PROTOCOL_VERSION,
        maxProtocol: PROTOCOL_VERSION,
        client: {
          id: "gateway-client",
          displayName: "Tenant Platform Auto Approver",
          version: "tenant-platform-auto-approve/1",
          platform: process.platform,
          mode: "backend",
        },
        caps: [],
        role: "operator",
        scopes: ["operator.approvals"],
        auth:
          params.token || params.password
            ? {
                token: params.token || undefined,
                password: params.password || undefined,
              }
            : undefined,
      },
      { requireConnected: false },
    )
      .then((payload) => {
        connected = true;
        reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
        params.onConnect?.(payload);
      })
      .catch((error) => {
        params.onError?.(error instanceof Error ? error : new Error(String(error)));
        try {
          ws?.close(1008, "connect failed");
        } catch {
          // Ignore close failures after a rejected connect handshake.
        }
      });
  };

  const handleMessage = (raw) => {
    let parsed;
    try {
      parsed = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8"));
    } catch {
      return;
    }

    if (parsed?.type === "event") {
      if (parsed.event === "connect.challenge") {
        const nonce = typeof parsed.payload?.nonce === "string" ? parsed.payload.nonce.trim() : "";
        if (!nonce) {
          params.onError?.(new Error("gateway connect challenge missing nonce"));
          try {
            ws?.close(1008, "connect challenge missing nonce");
          } catch {}
          return;
        }
        sendConnect();
        return;
      }
      params.onEvent?.(parsed);
      return;
    }

    if (parsed?.type !== "res" || typeof parsed.id !== "string") {
      return;
    }

    const entry = pending.get(parsed.id);
    if (!entry) {
      return;
    }
    pending.delete(parsed.id);
    if (entry.timeout) {
      clearTimeout(entry.timeout);
    }
    if (parsed.ok) {
      entry.resolve(parsed.payload);
      return;
    }
    entry.reject(createRequestError(parsed.error));
  };

  const connect = () => {
    if (!shouldRun) {
      return;
    }
    connected = false;
    clearConnectTimer();
    ws = new WebSocket(params.url, {
      maxPayload: 25 * 1024 * 1024,
    });
    ws.on("open", () => {
      clearConnectTimer();
      connectTimer = setTimeout(() => {
        params.onError?.(new Error("gateway connect challenge timeout"));
        try {
          ws?.close(1008, "connect challenge timeout");
        } catch {}
      }, DEFAULT_CONNECT_CHALLENGE_TIMEOUT_MS);
      connectTimer.unref?.();
    });
    ws.on("message", (data) => {
      handleMessage(data);
    });
    ws.on("error", (error) => {
      if (!connected) {
        params.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    });
    ws.on("close", (code, reason) => {
      clearConnectTimer();
      connected = false;
      flushPending(new Error(`gateway approvals socket closed (${code}): ${String(reason || "")}`));
      params.onClose?.(code, String(reason || ""));
      ws = null;
      scheduleReconnect();
    });
  };

  return {
    start() {
      if (shouldRun) {
        return;
      }
      shouldRun = true;
      connect();
    },
    stop() {
      shouldRun = false;
      clearConnectTimer();
      connected = false;
      if (ws) {
        try {
          ws.close();
        } catch {
          // Ignore close failures during shutdown.
        }
      }
      flushPending(new Error("gateway approvals client stopped"));
      ws = null;
    },
    request(method, requestParams) {
      return sendFrameRequest(method, requestParams);
    },
  };
}

export function createTenantExecApprovalAutoApprover(params = {}) {
  const config = params.config || {};
  const logger = params.logger || createDefaultLogger();
  const createGatewayClient = params.createGatewayClient || createGatewayApprovalsClient;
  const inFlightApprovalIds = new Set();
  let client = null;

  const isEnabled = () =>
    config.execAutoApproveEnabled !== false &&
    Boolean(String(config.gatewayUrl || "").trim()) &&
    Boolean(String(config.gatewayToken || config.gatewayPassword || "").trim());

  const resolveApproval = async (payload) => {
    const approval = readApprovalEnvelope(payload);
    if (!approval || !client || inFlightApprovalIds.has(approval.id)) {
      return false;
    }
    inFlightApprovalIds.add(approval.id);
    try {
      await client.request("exec.approval.resolve", {
        id: approval.id,
        decision: "allow-once",
      });
      const agentId = String(approval.request.agentId || "").trim() || "-";
      logger.info(
        `[tenant-platform exec-auto-approve] allow-once ${approval.id} agent=${agentId}`,
      );
      return true;
    } catch (error) {
      logger.error(
        `[tenant-platform exec-auto-approve] resolve failed ${approval.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    } finally {
      inFlightApprovalIds.delete(approval.id);
    }
  };

  const handleEvent = async (event) => {
    if (!event || event.event !== "exec.approval.requested") {
      return false;
    }
    if (!shouldAutoApproveTenantExecRequest(event.payload, { configDir: config.configDir })) {
      return false;
    }
    return await resolveApproval(event.payload);
  };

  return {
    isEnabled,
    async start() {
      if (!isEnabled()) {
        logger.debug?.(
          "[tenant-platform exec-auto-approve] disabled because token/password or gateway url is missing",
        );
        return false;
      }
      if (client) {
        return true;
      }
      client = createGatewayClient({
        url: config.gatewayUrl,
        token: config.gatewayToken,
        password: config.gatewayPassword,
        logger,
        onEvent: (event) => {
          void handleEvent(event).catch((error) => {
            logger.error(
              `[tenant-platform exec-auto-approve] event handling failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          });
        },
        onConnect: () => {
          logger.info(
            `[tenant-platform exec-auto-approve] connected ${String(config.gatewayUrl || "")}`,
          );
        },
        onError: (error) => {
          logger.error(
            `[tenant-platform exec-auto-approve] gateway error: ${error instanceof Error ? error.message : String(error)}`,
          );
        },
        onClose: (code, reason) => {
          logger.warn(
            `[tenant-platform exec-auto-approve] gateway closed code=${code} reason=${reason || "n/a"}`,
          );
        },
      });
      client.start();
      return true;
    },
    async stop() {
      if (!client) {
        return;
      }
      const currentClient = client;
      client = null;
      currentClient.stop();
    },
    handleEvent,
  };
}
