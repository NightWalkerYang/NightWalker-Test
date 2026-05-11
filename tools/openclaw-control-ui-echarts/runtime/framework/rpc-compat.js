export const RPC_COMPAT_CONTRACT_VERSION = "rpc-compat-v1";
const COMPAT_LOG_PREFIX = "[oc.rpc-compat]";

function safeWarn(sourceTag, message, details = null) {
  if (details) {
    console.warn(`${COMPAT_LOG_PREFIX} ${sourceTag}: ${message}`, details);
    return;
  }
  console.warn(`${COMPAT_LOG_PREFIX} ${sourceTag}: ${message}`);
}

async function requestApp(app, method, params, sourceTag) {
  if (!app?.client || typeof app.client.request !== "function") {
    safeWarn(sourceTag, `missing_client_for_${method}`);
    return null;
  }
  try {
    return await app.client.request(method, params);
  } catch (error) {
    safeWarn(sourceTag, `${method}_failed`, error);
    throw error;
  }
}

export async function withRequestDiagnostics(app, method, sourceTag, run) {
  if (typeof run !== "function") {
    safeWarn(sourceTag, `diagnostics_runner_missing_for_${method}`);
    return null;
  }
  const startedAt = Date.now();
  try {
    return await run();
  } catch (error) {
    safeWarn(sourceTag, `${method}_diagnostic_error_after_${Date.now() - startedAt}ms`, error);
    throw error;
  }
}

export async function listSessions(app, opts = {}, sourceTag = "rpc") {
  return withRequestDiagnostics(app, "sessions.list", sourceTag, async () =>
    requestApp(app, "sessions.list", opts && typeof opts === "object" ? opts : {}, sourceTag),
  );
}

export async function loadChatHistory(app, opts = {}, sourceTag = "rpc") {
  const params = opts && typeof opts === "object" ? { ...opts } : {};
  return withRequestDiagnostics(app, "chat.history", sourceTag, async () =>
    requestApp(app, "chat.history", params, sourceTag),
  );
}

export async function patchSession(app, opts = {}, sourceTag = "rpc") {
  const params = opts && typeof opts === "object" ? { ...opts } : {};
  return withRequestDiagnostics(app, "sessions.patch", sourceTag, async () =>
    requestApp(app, "sessions.patch", params, sourceTag),
  );
}

export async function loadSessionUsageTimeseries(app, opts = {}, sourceTag = "rpc") {
  const params = opts && typeof opts === "object" ? { ...opts } : {};
  const allowHistoryFallback = params.allowHistoryFallback !== false;
  delete params.allowHistoryFallback;
  return withRequestDiagnostics(app, "sessions.usage.timeseries", sourceTag, async () => {
    try {
      return await requestApp(app, "sessions.usage.timeseries", params, sourceTag);
    } catch (error) {
      if (!allowHistoryFallback || (!params?.key && !params?.sessionKey)) {
        return null;
      }
      const fallbackHistory = await requestApp(
        app,
        "chat.history",
        {
          sessionKey: String(params.key || params.sessionKey || "").trim(),
          limit: Number(params.limit || 200) || 200,
        },
        `${sourceTag}:timeseries-fallback`,
      );
      return {
        points: [],
        fallback: "chat.history",
        history: fallbackHistory,
        error,
      };
    }
  });
}
