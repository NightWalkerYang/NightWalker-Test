import { createTenantApiClient } from "./api-client.js";
import { writeSelectedTenantAgent } from "./tenant-context.js";

function normalizeUsageMetric(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function pickUsageMetric(...candidates) {
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function extractUsageSnapshot(message) {
  const usage = message?.usage;
  if (!usage || typeof usage !== "object") {
    return null;
  }
  const inputTokens = normalizeUsageMetric(
    pickUsageMetric(
      usage.input,
      usage.inputTokens,
      usage.input_tokens,
      usage.promptTokens,
      usage.prompt_tokens,
    ),
  );
  const outputTokens = normalizeUsageMetric(
    pickUsageMetric(
      usage.output,
      usage.outputTokens,
      usage.output_tokens,
      usage.completionTokens,
      usage.completion_tokens,
    ),
  );
  const cacheReadTokens = normalizeUsageMetric(
    pickUsageMetric(
      usage.cacheRead,
      usage.cache_read,
      usage.cache_read_input_tokens,
      usage.cached_tokens,
      usage.prompt_tokens_details?.cached_tokens,
    ),
  );
  const cacheWriteTokens = normalizeUsageMetric(
    pickUsageMetric(usage.cacheWrite, usage.cache_write, usage.cache_creation_input_tokens),
  );
  const totalTokensRaw = normalizeUsageMetric(
    pickUsageMetric(usage.total, usage.totalTokens, usage.total_tokens),
  );
  const totalTokens =
    totalTokensRaw || inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
  const totalCost = normalizeUsageMetric(message?.cost?.total ?? usage?.cost?.total);
  if (!totalTokens && !totalCost) {
    return null;
  }
  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalTokens,
    totalCost,
  };
}

function extractMessageTimestampIso(message) {
  const raw = message?.timestamp;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return new Date(raw).toISOString();
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return "";
}

function formatUsageDay(timestampIso) {
  const parsed = Date.parse(String(timestampIso || "").trim());
  const date = Number.isNaN(parsed) ? new Date() : new Date(parsed);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function extractUsagePointSnapshot(point) {
  const inputTokens = normalizeUsageMetric(point?.input);
  const outputTokens = normalizeUsageMetric(point?.output);
  const cacheReadTokens = normalizeUsageMetric(point?.cacheRead);
  const cacheWriteTokens = normalizeUsageMetric(point?.cacheWrite);
  const totalTokensRaw = normalizeUsageMetric(point?.totalTokens);
  const totalTokens =
    totalTokensRaw || inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
  const totalCost = normalizeUsageMetric(point?.cost);
  if (!totalTokens && !totalCost) {
    return null;
  }
  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalTokens,
    totalCost,
  };
}

function buildUsageFingerprint(message, index, usageSnapshot, messageTimestamp) {
  const messageId = String(message?.id || message?.messageId || message?.message_id || "").trim();
  if (messageId) {
    return `message:${messageId}`;
  }
  return [
    "idx",
    String(index),
    "ts",
    String(messageTimestamp || ""),
    "model",
    String(message?.model || ""),
    "provider",
    String(message?.provider || ""),
    "in",
    String(usageSnapshot.inputTokens),
    "out",
    String(usageSnapshot.outputTokens),
    "cr",
    String(usageSnapshot.cacheReadTokens),
    "cw",
    String(usageSnapshot.cacheWriteTokens),
    "total",
    String(usageSnapshot.totalTokens),
  ].join("|");
}

function buildUsageRecords(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }
  return messages.flatMap((message, index) => {
    if (String(message?.role || "").trim() !== "assistant") {
      return [];
    }
    const usageSnapshot = extractUsageSnapshot(message);
    if (!usageSnapshot) {
      return [];
    }
    const messageTimestamp = extractMessageTimestampIso(message) || new Date().toISOString();
    return [
      {
        sourceFingerprint: buildUsageFingerprint(message, index, usageSnapshot, messageTimestamp),
        messageTimestamp,
        usageDay: formatUsageDay(messageTimestamp),
        provider: String(message?.provider || "").trim(),
        model: String(message?.model || "").trim(),
        inputTokens: usageSnapshot.inputTokens,
        outputTokens: usageSnapshot.outputTokens,
        cacheReadTokens: usageSnapshot.cacheReadTokens,
        cacheWriteTokens: usageSnapshot.cacheWriteTokens,
        totalTokens: usageSnapshot.totalTokens,
        totalCost: usageSnapshot.totalCost,
      },
    ];
  });
}

function resolveSessionUsageMetadata(controller, sessionKey) {
  const normalizedKey = String(sessionKey || "")
    .trim()
    .toLowerCase();
  if (!normalizedKey) {
    return { provider: "", model: "" };
  }
  const candidates = [
    ...(Array.isArray(controller?.sessionsFromGateway) ? controller.sessionsFromGateway : []),
    ...(Array.isArray(controller?.sessions) ? controller.sessions : []),
  ];
  const sessionRow = candidates.find(
    (row) =>
      String(row?.key || "")
        .trim()
        .toLowerCase() === normalizedKey,
  );
  return {
    provider: String(sessionRow?.modelProvider || sessionRow?.provider || "").trim(),
    model: String(sessionRow?.model || sessionRow?.modelName || "").trim(),
  };
}

function extractUsagePointTimestampIso(point) {
  const raw = point?.timestamp;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return new Date(raw).toISOString();
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return "";
}

function buildUsagePointFingerprint(
  sessionKey,
  index,
  usageSnapshot,
  messageTimestamp,
  provider,
  model,
) {
  return [
    "timeseries",
    String(sessionKey || "").trim(),
    "idx",
    String(index),
    "ts",
    String(messageTimestamp || ""),
    "model",
    String(model || ""),
    "provider",
    String(provider || ""),
    "in",
    String(usageSnapshot.inputTokens),
    "out",
    String(usageSnapshot.outputTokens),
    "cr",
    String(usageSnapshot.cacheReadTokens),
    "cw",
    String(usageSnapshot.cacheWriteTokens),
    "total",
    String(usageSnapshot.totalTokens),
  ].join("|");
}

function buildUsageRecordsFromTimeseries(controller, sessionKey, points) {
  if (!Array.isArray(points)) {
    return [];
  }
  const sessionUsageMetadata = resolveSessionUsageMetadata(controller, sessionKey);
  return points.flatMap((point, index) => {
    const usageSnapshot = extractUsagePointSnapshot(point);
    if (!usageSnapshot) {
      return [];
    }
    const messageTimestamp = extractUsagePointTimestampIso(point) || new Date().toISOString();
    const provider = String(point?.provider || sessionUsageMetadata.provider || "").trim();
    const model = String(point?.model || sessionUsageMetadata.model || "").trim();
    return [
      {
        sourceFingerprint: buildUsagePointFingerprint(
          sessionKey,
          index,
          usageSnapshot,
          messageTimestamp,
          provider,
          model,
        ),
        messageTimestamp,
        usageDay: formatUsageDay(messageTimestamp),
        provider,
        model,
        inputTokens: usageSnapshot.inputTokens,
        outputTokens: usageSnapshot.outputTokens,
        cacheReadTokens: usageSnapshot.cacheReadTokens,
        cacheWriteTokens: usageSnapshot.cacheWriteTokens,
        totalTokens: usageSnapshot.totalTokens,
        totalCost: usageSnapshot.totalCost,
      },
    ];
  });
}

async function loadUsageRecordsFromTimeseries(controller, sessionKey) {
  try {
    const response = await controller?.app?.client?.request?.("sessions.usage.timeseries", {
      key: sessionKey,
    });
    const points = Array.isArray(response?.points) ? response.points : [];
    return buildUsageRecordsFromTimeseries(controller, sessionKey, points);
  } catch {
    return [];
  }
}

async function buildUsageRecordsForSession(controller, sessionKey, messages) {
  const timeseriesRecords = await loadUsageRecordsFromTimeseries(controller, sessionKey);
  if (timeseriesRecords.length > 0) {
    return timeseriesRecords;
  }
  return buildUsageRecords(messages);
}

export async function syncMemberUsageRecords(controller, sessionKey, messages) {
  if (!controller?.selectedAgent?.id || !sessionKey) {
    return;
  }
  const records = await buildUsageRecordsForSession(controller, sessionKey, messages);
  if (records.length === 0) {
    return;
  }
  try {
    const result = await createTenantApiClient().syncMemberUsageRecords({
      tenantAgentId: controller.selectedAgent.id,
      openclawSessionKey: sessionKey,
      records,
    });
    const nextBalance = Number(result?.agentBalancePoints);
    if (Number.isFinite(nextBalance)) {
      controller.selectedAgent.balancePoints = nextBalance;
      writeSelectedTenantAgent(controller.selectedAgent);
    }
  } catch {
    // Ignore usage sync failures and keep the current UI state.
  }
}

export function scheduleMemberUsageSync(controller, sessionKey, attempt = 0) {
  if (!controller?.app?.client || !sessionKey) {
    return;
  }
  const maxAttempts = 12;
  const delayMs = attempt === 0 ? 1200 : 1800;
  window.setTimeout(async () => {
    const activeController = window._ocMemberChatSurfaceController;
    if (!activeController || activeController.currentSessionKey !== sessionKey) {
      return;
    }
    if (activeController.app?.chatSending || activeController.app?.chatRunId) {
      if (attempt < maxAttempts) {
        scheduleMemberUsageSync(activeController, sessionKey, attempt + 1);
      }
      return;
    }
    try {
      const historyResp = await activeController.app.client.request("chat.history", {
        sessionKey,
        limit: 200,
      });
      await syncMemberUsageRecords(activeController, sessionKey, historyResp?.messages);
    } catch {
      // Ignore refresh failures and retry on a later surface sync.
    }
  }, delayMs);
}
