import {
  applyManagedNodeDesiredState,
  getManagedNodeSyncCheckpoint,
  readOpenClawAgentCatalog,
  recordManagedNodeSyncError,
} from "./db.mjs";

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function buildControlPlaneApiBase(config) {
  const controlPlaneUrl = normalizeBaseUrl(config?.controlPlaneUrl);
  if (!controlPlaneUrl) {
    throw new Error("managed_node_control_plane_url_required");
  }
  return `${controlPlaneUrl}${config.apiBasePath}`;
}

function buildManagedNodeHeaders(config) {
  const nodeId = String(config?.nodeId || "").trim().toLowerCase();
  const nodeSecret = String(config?.nodeSecret || "").trim();
  if (!nodeId) {
    throw new Error("managed_node_id_required");
  }
  if (!nodeSecret) {
    throw new Error("managed_node_secret_required");
  }
  return {
    "content-type": "application/json",
    "x-openclaw-managed-node-id": nodeId,
    "x-openclaw-managed-node-secret": nodeSecret,
  };
}

async function requestJson(fetchImpl, baseUrl, path, options = {}) {
  const response = await fetchImpl(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: options.headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload.data;
}

function emitLog(logger, level, message) {
  if (logger && typeof logger[level] === "function") {
    logger[level](message);
    return;
  }
  if (level === "error") {
    process.stderr.write(`${message}\n`);
    return;
  }
  process.stdout.write(`${message}\n`);
}

export async function runManagedNodeSyncOnce({
  config,
  db,
  fetchImpl = fetch,
  registration = false,
  logger = null,
} = {}) {
  if (config?.nodeRole !== "managed-node") {
    return null;
  }
  const baseUrl = buildControlPlaneApiBase(config);
  const headers = buildManagedNodeHeaders(config);
  const checkpoint = getManagedNodeSyncCheckpoint(db, config.nodeId);
  const agentCatalog = readOpenClawAgentCatalog(config.configPath);
  const heartbeatBody = {
    nodeName: config.nodeName,
    agentCatalog,
    lastAppliedRevision: checkpoint.lastAppliedRevision,
    lastError: checkpoint.lastError,
  };
  await requestJson(
    fetchImpl,
    baseUrl,
    registration ? "/node/register" : "/node/heartbeat",
    {
      method: "POST",
      headers,
      body: heartbeatBody,
    },
  );
  const desiredState = await requestJson(fetchImpl, baseUrl, "/node/sync", {
    headers,
  });
  const applyResult = applyManagedNodeDesiredState(db, {
    ...desiredState,
    nodeId: config.nodeId,
    configPath: config.configPath,
    configDir: config.configDir,
  });
  const postApplyCheckpoint = getManagedNodeSyncCheckpoint(db, config.nodeId);
  await requestJson(fetchImpl, baseUrl, "/node/heartbeat", {
    method: "POST",
    headers,
    body: {
      nodeName: config.nodeName,
      lastAppliedRevision: postApplyCheckpoint.lastAppliedRevision,
      lastError: postApplyCheckpoint.lastError,
    },
  });
  if (logger) {
    emitLog(
      logger,
      "info",
      `[tenant-platform managed-node-sync] applied revision ${applyResult?.desiredRevision || 0} for ${config.nodeId}`,
    );
  }
  return applyResult;
}

export function createManagedNodeSyncWorker({
  config,
  db,
  fetchImpl = fetch,
  logger = null,
} = {}) {
  let stopped = false;
  let timerId = null;
  let running = null;
  let registered = false;

  async function tick() {
    if (stopped || running) {
      return running;
    }
    running = (async () => {
      try {
        const result = await runManagedNodeSyncOnce({
          config,
          db,
          fetchImpl,
          registration: !registered,
          logger,
        });
        registered = true;
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        recordManagedNodeSyncError(db, {
          nodeId: config.nodeId,
          lastError: message,
        });
        emitLog(logger, "error", `[tenant-platform managed-node-sync] ${message}`);
        throw error;
      } finally {
        running = null;
      }
    })();
    return running;
  }

  return {
    async start() {
      if (config?.nodeRole !== "managed-node") {
        return;
      }
      stopped = false;
      try {
        await tick();
      } catch {
        // Leave retry to the interval loop.
      }
      if (typeof timerId === "number") {
        return;
      }
      timerId = setInterval(() => {
        void tick().catch(() => {});
      }, Math.max(1000, Number(config?.managedNodeSyncIntervalMs || 15_000)));
    },
    stop() {
      stopped = true;
      if (typeof timerId === "number") {
        clearInterval(timerId);
      }
      timerId = null;
    },
  };
}
