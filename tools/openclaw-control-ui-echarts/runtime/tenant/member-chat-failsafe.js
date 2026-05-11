export const CHAT_FAILSAFE_TIMEOUT_MS = 300_000;
export const CHAT_FAILSAFE_MESSAGE = "本次请求超时，模型连接异常，请重新发送。";
const CHAT_FAILSAFE_TIMER_KEY = "__ocMemberChatFailsafeTimer";
const CHAT_FAILSAFE_SESSION_KEY = "__ocMemberChatFailsafeSessionKey";
const CHAT_FAILSAFE_PROGRESS_KEY = "__ocMemberChatFailsafeProgressKey";

function createTimeoutError(label, timeoutMs) {
  const error = new Error(`${label}_timeout_after_${timeoutMs}ms`);
  error.name = "TimeoutError";
  return error;
}

export function isTimeoutError(error) {
  return error instanceof Error && error.name === "TimeoutError";
}

export async function awaitWithTimeout(promise, timeoutMs, label) {
  let timerId = 0;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timerId = window.setTimeout(() => {
          reject(createTimeoutError(label, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timerId > 0) {
      window.clearTimeout(timerId);
    }
  }
}

export function clearChatLoadingFailsafe(app) {
  if (!(app instanceof HTMLElement)) {
    return;
  }
  const timerId = Number(app[CHAT_FAILSAFE_TIMER_KEY] || 0);
  if (timerId > 0) {
    window.clearTimeout(timerId);
  }
  app[CHAT_FAILSAFE_TIMER_KEY] = 0;
  app[CHAT_FAILSAFE_SESSION_KEY] = "";
  app[CHAT_FAILSAFE_PROGRESS_KEY] = "";
}

function buildChatLoadingProgressSignature(app) {
  if (!(app instanceof HTMLElement)) {
    return "";
  }
  const toolStreamOrder =
    Array.isArray(app.toolStreamOrder) && app.toolStreamOrder.length > 0 ? app.toolStreamOrder : [];
  const lastToolStreamId =
    toolStreamOrder.length > 0 ? String(toolStreamOrder[toolStreamOrder.length - 1] || "") : "";
  const toolMessages =
    Array.isArray(app.chatToolMessages) && app.chatToolMessages.length > 0
      ? app.chatToolMessages
      : [];
  const lastToolMessage =
    toolMessages.length > 0 ? toolMessages[toolMessages.length - 1] || null : null;
  const lastToolOutput = readToolMessageProgressValue(lastToolMessage);
  const lastToolTitle =
    lastToolMessage && typeof lastToolMessage.title === "string" ? lastToolMessage.title : "";
  return JSON.stringify({
    chatMessagesLength: Array.isArray(app.chatMessages) ? app.chatMessages.length : 0,
    chatStream: typeof app.chatStream === "string" ? app.chatStream : "",
    chatRunId: typeof app.chatRunId === "string" ? app.chatRunId : "",
    chatToolMessagesLength: toolMessages.length,
    chatStreamSegmentsLength: Array.isArray(app.chatStreamSegments)
      ? app.chatStreamSegments.length
      : 0,
    toolStreamLength: toolStreamOrder.length,
    lastToolStreamId,
    lastToolTitle,
    lastToolOutput,
  });
}

function readToolMessageProgressValue(message) {
  if (!message || typeof message !== "object") {
    return "";
  }
  const output = readToolMessageField(message, ["output", "result", "partialResult", "text"]);
  if (output) {
    return output;
  }
  const content = readToolMessageField(message, ["content"]);
  if (content) {
    return content;
  }
  return stableStringifyProgressValue(message);
}

function readToolMessageField(message, fieldNames) {
  if (!message || typeof message !== "object" || !Array.isArray(fieldNames)) {
    return "";
  }
  for (const fieldName of fieldNames) {
    const value = stableStringifyProgressValue(message[fieldName]);
    if (value) {
      return value;
    }
  }
  return "";
}

function stableStringifyProgressValue(value) {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (!value || typeof value !== "object") {
    return "";
  }
  try {
    return JSON.stringify(sortProgressValue(value));
  } catch {
    return "";
  }
}

function sortProgressValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sortProgressValue(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortProgressValue(value[key]);
  }
  return sorted;
}

export function scheduleChatLoadingFailsafe(app, sessionKey, { showTimeoutToast } = {}) {
  if (!(app instanceof HTMLElement)) {
    return;
  }
  const normalizedSessionKey = String(sessionKey || "")
    .trim()
    .toLowerCase();
  if (!normalizedSessionKey) {
    clearChatLoadingFailsafe(app);
    return;
  }
  clearChatLoadingFailsafe(app);
  app[CHAT_FAILSAFE_SESSION_KEY] = normalizedSessionKey;
  app[CHAT_FAILSAFE_PROGRESS_KEY] = buildChatLoadingProgressSignature(app);
  app[CHAT_FAILSAFE_TIMER_KEY] = window.setTimeout(() => {
    const trackedSessionKey = String(app[CHAT_FAILSAFE_SESSION_KEY] || "")
      .trim()
      .toLowerCase();
    const activeSessionKey = String(app.__ocPinnedSessionKey || app.sessionKey || "")
      .trim()
      .toLowerCase();
    app[CHAT_FAILSAFE_TIMER_KEY] = 0;
    app[CHAT_FAILSAFE_SESSION_KEY] = "";
    if (!trackedSessionKey || trackedSessionKey !== normalizedSessionKey) {
      return;
    }
    if (!activeSessionKey || activeSessionKey !== normalizedSessionKey) {
      return;
    }
    if (!app.chatLoading) {
      return;
    }
    const previousProgressKey = String(app[CHAT_FAILSAFE_PROGRESS_KEY] || "");
    const currentProgressKey = buildChatLoadingProgressSignature(app);
    if (currentProgressKey && currentProgressKey !== previousProgressKey) {
      scheduleChatLoadingFailsafe(app, normalizedSessionKey, { showTimeoutToast });
      return;
    }
    if (typeof app.resetToolStream === "function") {
      app.resetToolStream();
    }
    app.chatLoading = false;
    app.chatRunId = null;
    app.chatStream = null;
    app.chatStreamStartedAt = null;
    if (!String(app.lastError || "").trim()) {
      app.lastError = CHAT_FAILSAFE_MESSAGE;
    }
    app.requestUpdate?.();
    showTimeoutToast?.(CHAT_FAILSAFE_MESSAGE);
  }, CHAT_FAILSAFE_TIMEOUT_MS);
}
