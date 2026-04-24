import crypto from "node:crypto";
import path from "node:path";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import { WebSocket } from "ws";

const PROTOCOL_VERSION = 3;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_CONNECT_CHALLENGE_TIMEOUT_MS = 5_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const DEVICE_AUTH_STORE_VERSION = 1;
const PAIRING_TOKEN_BYTES = 32;
const APPROVAL_ROLE = "operator";
const APPROVAL_SCOPES = ["operator.approvals"];
const GATEWAY_CLIENT_ID = "gateway-client";
const GATEWAY_CLIENT_DISPLAY_NAME = "Tenant Platform Auto Approver";
const GATEWAY_CLIENT_VERSION = "tenant-platform-auto-approve/1";
const GATEWAY_CLIENT_MODE = "backend";
const GATEWAY_DEVICE_FAMILY = "tenant-platform";

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

function normalizeNonEmptyString(value) {
  const normalized = String(value ?? "").trim();
  return normalized || "";
}

function normalizeScopeList(scopes) {
  if (!Array.isArray(scopes)) {
    return [];
  }
  return [...new Set(scopes.map((scope) => String(scope ?? "").trim()).filter(Boolean))].toSorted();
}

function sameStringArray(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function readJsonRecord(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporaryPath, filePath);
}

function generatePairingToken() {
  return crypto.randomBytes(PAIRING_TOKEN_BYTES).toString("base64url");
}

export function rawGatewayDataToString(data) {
  if (typeof data === "string") {
    return data;
  }
  if (Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }
  return Buffer.from(String(data)).toString("utf8");
}

function base64UrlEncode(buffer) {
  return buffer.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function derivePublicKeyRaw(publicKeyPem) {
  const key = crypto.createPublicKey(publicKeyPem);
  const spki = key.export({ type: "spki", format: "der" });
  if (
    spki.length === ED25519_SPKI_PREFIX.length + 32 &&
    spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  return spki;
}

function fingerprintPublicKey(publicKeyPem) {
  return crypto.createHash("sha256").update(derivePublicKeyRaw(publicKeyPem)).digest("hex");
}

function publicKeyRawBase64UrlFromPem(publicKeyPem) {
  return base64UrlEncode(derivePublicKeyRaw(publicKeyPem));
}

function signDevicePayload(privateKeyPem, payload) {
  return base64UrlEncode(
    crypto.sign(null, Buffer.from(payload, "utf8"), crypto.createPrivateKey(privateKeyPem)),
  );
}

function loadOrCreateDeviceIdentity(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (
        parsed &&
        typeof parsed.deviceId === "string" &&
        typeof parsed.publicKeyPem === "string" &&
        typeof parsed.privateKeyPem === "string"
      ) {
        return parsed;
      }
    }
  } catch {
    // Fall through and regenerate a fresh identity.
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const identity = {
    version: 1,
    deviceId: fingerprintPublicKey(publicKeyPem),
    publicKeyPem,
    privateKeyPem,
    createdAtMs: Date.now(),
  };
  if (filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(identity, null, 2)}\n`, { mode: 0o600 });
  }
  return identity;
}

function resolveTenantExecApprovalGatewayPaths(config = {}) {
  const configDir = String(config.configDir || "");
  const stateDir = String(config.stateDir || config.configDir || ".");
  const identityDir = path.join(stateDir, "identity");
  return {
    configDir,
    stateDir,
    deviceIdentityPath: path.join(identityDir, "tenant-platform-gateway-client.json"),
    deviceAuthStorePath: path.join(identityDir, "tenant-platform-device-auth.json"),
    pairedDevicesPath: path.join(configDir, "devices", "paired.json"),
    pendingDevicesPath: path.join(configDir, "devices", "pending.json"),
  };
}

function readLocalDeviceAuthEntry(params) {
  const store = readJsonRecord(params.deviceAuthStorePath);
  if (
    !store ||
    store.version !== DEVICE_AUTH_STORE_VERSION ||
    store.deviceId !== params.deviceId ||
    !store.tokens ||
    typeof store.tokens !== "object" ||
    Array.isArray(store.tokens)
  ) {
    return null;
  }
  const entry = store.tokens[params.role];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  if (typeof entry.token !== "string") {
    return null;
  }
  return {
    token: entry.token,
    role: normalizeNonEmptyString(entry.role || params.role) || params.role,
    scopes: normalizeScopeList(entry.scopes),
    updatedAtMs:
      typeof entry.updatedAtMs === "number" && Number.isFinite(entry.updatedAtMs)
        ? entry.updatedAtMs
        : undefined,
  };
}

function writeLocalDeviceAuthEntry(params) {
  const existing = readJsonRecord(params.deviceAuthStorePath);
  const next = {
    version: DEVICE_AUTH_STORE_VERSION,
    deviceId: params.deviceId,
    tokens:
      existing &&
      existing.version === DEVICE_AUTH_STORE_VERSION &&
      existing.deviceId === params.deviceId &&
      existing.tokens &&
      typeof existing.tokens === "object" &&
      !Array.isArray(existing.tokens)
        ? { ...existing.tokens }
        : {},
  };
  next.tokens[params.role] = {
    token: params.token,
    role: params.role,
    scopes: normalizeScopeList(params.scopes),
    updatedAtMs: Date.now(),
  };
  writeJsonAtomic(params.deviceAuthStorePath, next);
}

export function ensureTenantExecApprovalGatewayAccess(config = {}, options = {}) {
  const logger = options.logger || createDefaultLogger();
  const paths = resolveTenantExecApprovalGatewayPaths(config);
  const identity = loadOrCreateDeviceIdentity(paths.deviceIdentityPath);
  const publicKey = publicKeyRawBase64UrlFromPem(identity.publicKeyPem);
  const desiredScopes = normalizeScopeList(APPROVAL_SCOPES);
  const pairedByDeviceId = readJsonRecord(paths.pairedDevicesPath) || {};
  const pendingById = readJsonRecord(paths.pendingDevicesPath) || {};
  const existingPaired = pairedByDeviceId[identity.deviceId];
  const existingToken =
    existingPaired &&
    existingPaired.tokens &&
    typeof existingPaired.tokens === "object" &&
    !Array.isArray(existingPaired.tokens) &&
    existingPaired.tokens[APPROVAL_ROLE] &&
    typeof existingPaired.tokens[APPROVAL_ROLE].token === "string" &&
    existingPaired.tokens[APPROVAL_ROLE].revokedAtMs === undefined &&
    sameStringArray(
      normalizeScopeList(existingPaired.tokens[APPROVAL_ROLE].scopes),
      desiredScopes,
    )
      ? existingPaired.tokens[APPROVAL_ROLE]
      : null;
  const deviceToken = existingToken?.token || generatePairingToken();
  const now = Date.now();
  const pairedEntry = {
    deviceId: identity.deviceId,
    publicKey,
    displayName: GATEWAY_CLIENT_DISPLAY_NAME,
    platform: process.platform,
    deviceFamily: GATEWAY_DEVICE_FAMILY,
    clientId: GATEWAY_CLIENT_ID,
    clientMode: GATEWAY_CLIENT_MODE,
    role: APPROVAL_ROLE,
    roles: [APPROVAL_ROLE],
    scopes: desiredScopes,
    approvedScopes: desiredScopes,
    tokens: {
      [APPROVAL_ROLE]: {
        token: deviceToken,
        role: APPROVAL_ROLE,
        scopes: desiredScopes,
        createdAtMs:
          typeof existingToken?.createdAtMs === "number" && Number.isFinite(existingToken.createdAtMs)
            ? existingToken.createdAtMs
            : now,
        rotatedAtMs:
          existingToken && existingToken.token !== deviceToken
            ? now
            : typeof existingToken?.rotatedAtMs === "number" &&
                Number.isFinite(existingToken.rotatedAtMs)
              ? existingToken.rotatedAtMs
              : undefined,
        revokedAtMs: undefined,
        lastUsedAtMs:
          typeof existingToken?.lastUsedAtMs === "number" && Number.isFinite(existingToken.lastUsedAtMs)
            ? existingToken.lastUsedAtMs
            : undefined,
      },
    },
    createdAtMs:
      typeof existingPaired?.createdAtMs === "number" && Number.isFinite(existingPaired.createdAtMs)
        ? existingPaired.createdAtMs
        : now,
    approvedAtMs:
      typeof existingPaired?.approvedAtMs === "number" && Number.isFinite(existingPaired.approvedAtMs)
        ? existingPaired.approvedAtMs
        : now,
  };
  pairedByDeviceId[identity.deviceId] = pairedEntry;
  let removedPendingCount = 0;
  for (const [requestId, pending] of Object.entries(pendingById)) {
    if (!pending || typeof pending !== "object" || Array.isArray(pending)) {
      continue;
    }
    if (
      normalizeNonEmptyString(pending.deviceId) !== identity.deviceId &&
      normalizeNonEmptyString(pending.publicKey) !== publicKey
    ) {
      continue;
    }
    delete pendingById[requestId];
    removedPendingCount += 1;
  }
  writeJsonAtomic(paths.pairedDevicesPath, pairedByDeviceId);
  writeJsonAtomic(paths.pendingDevicesPath, pendingById);
  writeLocalDeviceAuthEntry({
    deviceAuthStorePath: paths.deviceAuthStorePath,
    deviceId: identity.deviceId,
    role: APPROVAL_ROLE,
    token: deviceToken,
    scopes: desiredScopes,
  });
  logger.info(
    `[tenant-platform exec-auto-approve] ensured paired operator device ${identity.deviceId}${removedPendingCount > 0 ? ` clearedPending=${removedPendingCount}` : ""}`,
  );
  return {
    ...paths,
    deviceId: identity.deviceId,
    deviceToken,
    scopes: desiredScopes,
  };
}

function normalizeDeviceMetadataForAuth(value) {
  return String(value ?? "")
    .trim()
    .replace(/[A-Z]/g, (character) => String.fromCharCode(character.charCodeAt(0) + 32));
}

function buildDeviceAuthPayloadV3(params) {
  return [
    "v3",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(","),
    String(params.signedAtMs),
    params.token ?? "",
    params.nonce,
    normalizeDeviceMetadataForAuth(params.platform),
    normalizeDeviceMetadataForAuth(params.deviceFamily),
  ].join("|");
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
    const signedAtMs = Date.now();
    const scopes = normalizeScopeList(params.scopes?.length ? params.scopes : APPROVAL_SCOPES);
    const identity = params.deviceIdentityPath
      ? loadOrCreateDeviceIdentity(params.deviceIdentityPath)
      : null;
    const storedDeviceAuth =
      identity && params.deviceAuthStorePath
        ? readLocalDeviceAuthEntry({
            deviceAuthStorePath: params.deviceAuthStorePath,
            deviceId: identity.deviceId,
            role: APPROVAL_ROLE,
          })
        : null;
    const sharedToken = normalizeNonEmptyString(params.token);
    const sharedPassword = normalizeNonEmptyString(params.password);
    const deviceToken = normalizeNonEmptyString(
      params.deviceToken || storedDeviceAuth?.token || "",
    );
    const signatureToken = sharedToken || deviceToken || null;
    const device =
      identity && signatureToken
        ? {
            id: identity.deviceId,
            publicKey: publicKeyRawBase64UrlFromPem(identity.publicKeyPem),
            signature: signDevicePayload(
              identity.privateKeyPem,
              buildDeviceAuthPayloadV3({
                deviceId: identity.deviceId,
                clientId: GATEWAY_CLIENT_ID,
                clientMode: GATEWAY_CLIENT_MODE,
                role: APPROVAL_ROLE,
                scopes,
                signedAtMs,
                token: signatureToken,
                nonce: params.connectNonce,
                platform: process.platform,
                deviceFamily: GATEWAY_DEVICE_FAMILY,
              }),
            ),
            signedAt: signedAtMs,
            nonce: params.connectNonce,
          }
        : undefined;
    const authToken = sharedToken || deviceToken || undefined;
    void sendFrameRequest(
      "connect",
      {
        minProtocol: PROTOCOL_VERSION,
        maxProtocol: PROTOCOL_VERSION,
        client: {
          id: GATEWAY_CLIENT_ID,
          displayName: GATEWAY_CLIENT_DISPLAY_NAME,
          version: GATEWAY_CLIENT_VERSION,
          platform: process.platform,
          deviceFamily: GATEWAY_DEVICE_FAMILY,
          mode: GATEWAY_CLIENT_MODE,
        },
        caps: [],
        role: APPROVAL_ROLE,
        scopes,
        auth:
          authToken || sharedPassword || deviceToken
            ? {
                token: authToken,
                deviceToken: deviceToken || undefined,
                password: sharedPassword || undefined,
              }
            : undefined,
        device,
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
      parsed = JSON.parse(rawGatewayDataToString(raw));
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
        params.connectNonce = nonce;
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
  let gatewayAccess = null;

  const isEnabled = () =>
    config.execAutoApproveEnabled !== false &&
    Boolean(String(config.gatewayUrl || "").trim());

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
          "[tenant-platform exec-auto-approve] disabled because gateway url is missing",
        );
        return false;
      }
      if (client) {
        return true;
      }
      gatewayAccess = ensureTenantExecApprovalGatewayAccess(config, { logger });
      client = createGatewayClient({
        url: config.gatewayUrl,
        token: config.gatewayToken,
        password: config.gatewayPassword,
        deviceToken: gatewayAccess?.deviceToken,
        deviceIdentityPath: gatewayAccess?.deviceIdentityPath,
        deviceAuthStorePath: gatewayAccess?.deviceAuthStorePath,
        scopes: gatewayAccess?.scopes,
        logger,
        onEvent: (event) => {
          void handleEvent(event).catch((error) => {
            logger.error(
              `[tenant-platform exec-auto-approve] event handling failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          });
        },
        onConnect: (payload) => {
          const grantedScopes = Array.isArray(payload?.auth?.scopes)
            ? payload.auth.scopes.join(",")
            : "";
          logger.info(
            `[tenant-platform exec-auto-approve] connected ${String(config.gatewayUrl || "")}${grantedScopes ? ` scopes=${grantedScopes}` : ""}`,
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
      gatewayAccess = null;
      currentClient.stop();
    },
    handleEvent,
  };
}
