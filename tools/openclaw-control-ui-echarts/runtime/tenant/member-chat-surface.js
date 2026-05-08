import {
  findBreadcrumb,
  findClosestComposerTextarea,
  findClosestNewSessionButton,
  findClosestSendButton,
  findOpenClawApp,
  findSidebar,
  isSendButtonElement,
  isStopButtonElement,
} from "../framework/dom-compat.js";
import { createTenantApiClient } from "./api-client.js";
import { bootTenantRouteSync, navigateTenantRoute, onTenantRouteChange } from "./route-sync.js";
import { resetTenantRouteSyncForTests } from "./route-sync.js";
import {
  TENANT_AGENT_SELECTOR_ROUTE,
  buildTenantMemberChatRoute,
  buildTenantMemberLegacySessionKey,
  createTenantMemberSessionKey,
  hasResolvedSelectedTenantAgent,
  isTenantMemberSessionKey,
  readSelectedTenantAgent,
  readTenantSession,
  writeSelectedTenantAgent,
} from "./tenant-context.js";

const DOC_ATTR = "data-oc-member-chat-route";
const STYLE_ATTR = "data-oc-member-chat-surface-style";
const SECTION_ATTR = "data-oc-member-chat-section";
const TOP_ACTION_ATTR = "data-oc-member-chat-top-action";
const SESSION_LIST_ATTR = "data-oc-member-chat-session-list";
const ACTIVE_SESSION_ATTR = "data-oc-member-chat-active-session";
const LABEL_ATTR = "data-oc-member-chat-label";
const DELETE_ATTR = "data-member-chat-delete";
const DELETE_DIALOG_ROOT_ATTR = "data-oc-member-chat-delete-dialog-root";
const DELETE_DIALOG_SELECTOR = "[data-oc-member-chat-delete-dialog]";
const DELETE_DIALOG_CLOSE_SELECTOR = "[data-oc-member-chat-delete-close]";
const DELETE_DIALOG_CONFIRM_SELECTOR = "[data-oc-member-chat-confirm-delete]";
const TOAST_ROOT_ATTR = "data-oc-member-chat-toast-root";
const TOAST_SELECTOR = "[data-oc-member-chat-toast]";
const SECTION_CLASS = "nav-section oc-member-chat-section";
const SILENT_REPLY_PATTERN = /^\s*NO_REPLY\s*$/;
const CHAT_FAILSAFE_TIMEOUT_MS = 300_000;
const CHAT_FAILSAFE_MESSAGE = "本次请求超时，模型连接异常，请重新发送。";
const CHAT_FAILSAFE_TIMER_KEY = "__ocMemberChatFailsafeTimer";
const CHAT_FAILSAFE_SESSION_KEY = "__ocMemberChatFailsafeSessionKey";
const CHAT_FAILSAFE_PROGRESS_KEY = "__ocMemberChatFailsafeProgressKey";
const MEMBER_SESSION_LIST_TIMEOUT_MS = 6_000;
const MEMBER_SESSION_TITLE_HISTORY_TIMEOUT_MS = 4_000;
const MEMBER_CHAT_HISTORY_TIMEOUT_MS = 6_000;
const MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY =
  "openclaw:tenant-platform:member-chat:draft-route-lock:v1";
let memberChatSurfaceSyncing = false;
let memberChatSurfaceSyncQueued = false;
let memberChatSurfaceSuppressNextRouteSync = false;
let memberChatRouteCleanup = null;
let memberChatMutationObserver = null;
let memberChatClickHandler = null;
let memberChatKeydownHandler = null;

function safeSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readSessionJson(key) {
  try {
    const raw = safeSessionStorage()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSessionJson(key, value) {
  try {
    safeSessionStorage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort only.
  }
}

function removeSessionStorageKey(key) {
  try {
    safeSessionStorage()?.removeItem(key);
  } catch {
    // Best-effort only.
  }
}

function buildMemberDraftRouteLockId(session, selectedAgent) {
  const tenantId = String(session?.session?.tenantId || "")
    .trim()
    .toLowerCase();
  const userId = String(session?.session?.userId || "")
    .trim()
    .toLowerCase();
  const tenantAgentId = String(selectedAgent?.id || "")
    .trim()
    .toLowerCase();
  if (!tenantId || !userId || !tenantAgentId) {
    return "";
  }
  return `${tenantId}:${userId}:${tenantAgentId}`;
}

function readMemberDraftRouteLock(session, selectedAgent) {
  const lockId = buildMemberDraftRouteLockId(session, selectedAgent);
  if (!lockId) {
    return "";
  }
  const locks = readSessionJson(MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY);
  const candidate = locks && typeof locks === "object" ? locks[lockId] : "";
  if (!isTenantMemberSessionKey(candidate, session, selectedAgent)) {
    return "";
  }
  return String(candidate).trim().toLowerCase();
}

function writeMemberDraftRouteLock(session, selectedAgent, sessionKey) {
  if (!isTenantMemberSessionKey(sessionKey, session, selectedAgent)) {
    return;
  }
  const lockId = buildMemberDraftRouteLockId(session, selectedAgent);
  if (!lockId) {
    return;
  }
  const locks = readSessionJson(MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY);
  const next = locks && typeof locks === "object" ? { ...locks } : {};
  next[lockId] = String(sessionKey).trim().toLowerCase();
  writeSessionJson(MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY, next);
}

function clearMemberDraftRouteLock(session, selectedAgent) {
  const lockId = buildMemberDraftRouteLockId(session, selectedAgent);
  if (!lockId) {
    return;
  }
  const locks = readSessionJson(MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY);
  if (!locks || typeof locks !== "object" || !(lockId in locks)) {
    return;
  }
  const next = { ...locks };
  delete next[lockId];
  if (Object.keys(next).length === 0) {
    removeSessionStorageKey(MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY);
    return;
  }
  writeSessionJson(MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY, next);
}

function isMemberChatRoute(pathname = window.location.pathname, href = window.location.href) {
  const normalizedPath = String(pathname || "/").trim() || "/";
  if (normalizedPath !== "/chat") {
    return false;
  }
  const session = readTenantSession();
  if (!session?.session?.role || session.session.role === "platform_admin") {
    return false;
  }
  const selectedAgent = readSelectedTenantAgent(href);
  return Boolean(selectedAgent?.id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ensureStyle() {
  let link = document.head.querySelector(`[${STYLE_ATTR}]`);
  if (link instanceof HTMLLinkElement) {
    return link;
  }
  link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./member-chat-surface.css", import.meta.url).href;
  link.setAttribute(STYLE_ATTR, "true");
  document.head.append(link);
  return link;
}

function showTransientToast(controller, message, type = "info") {
  let root = document.body.querySelector(`[${TOAST_ROOT_ATTR}]`);
  if (!(root instanceof HTMLElement)) {
    root = document.createElement("div");
    root.className = "oc-member-chat-toast-root";
    root.setAttribute(TOAST_ROOT_ATTR, "true");
    document.body.append(root);
  }
  const kind = type === "danger" ? "danger" : "info";
  root.innerHTML = `<div class="callout ${kind} oc-member-chat-toast" data-oc-member-chat-toast>${escapeHtml(message)}</div>`;
  const timerOwner = controller || window;
  if (timerOwner.ocToastTimer) {
    window.clearTimeout(timerOwner.ocToastTimer);
  }
  timerOwner.ocToastTimer = window.setTimeout(() => {
    root.querySelector(TOAST_SELECTOR)?.remove();
    timerOwner.ocToastTimer = 0;
  }, 2500);
}

function createTimeoutError(label, timeoutMs) {
  const error = new Error(`${label}_timeout_after_${timeoutMs}ms`);
  error.name = "TimeoutError";
  return error;
}

function isTimeoutError(error) {
  return error instanceof Error && error.name === "TimeoutError";
}

async function awaitWithTimeout(promise, timeoutMs, label) {
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

function clearChatLoadingFailsafe(app) {
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

function scheduleChatLoadingFailsafe(app, sessionKey) {
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
      scheduleChatLoadingFailsafe(app, normalizedSessionKey);
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
    showTransientToast(window._ocMemberChatSurfaceController, CHAT_FAILSAFE_MESSAGE, "danger");
  }, CHAT_FAILSAFE_TIMEOUT_MS);
}

function normalizeSessionRows(result) {
  return Array.isArray(result?.sessions) ? result.sessions : [];
}

function formatRelativeTime(value) {
  const timestamp = Number(value || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "";
  }
  const deltaMs = Date.now() - timestamp;
  const minutes = Math.max(0, Math.round(deltaMs / 60000));
  if (minutes < 1) {
    return "刚刚";
  }
  if (minutes < 60) {
    return `${minutes} 分钟前`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} 小时前`;
  }
  const days = Math.round(hours / 24);
  return `${days} 天前`;
}

function normalizeSessionTitleValue(value) {
  return String(value ?? "").trim();
}

function isGeneratedTimestampTitle(value) {
  const normalized = normalizeSessionTitleValue(value);
  if (!normalized) {
    return false;
  }
  return (
    /^\[[A-Za-z]{3}\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(normalized) ||
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(normalized)
  );
}

function isProvisionalSessionTitle(value) {
  const normalized = normalizeSessionTitleValue(value);
  if (!normalized) {
    return true;
  }
  return normalized === "新会话" || isGeneratedTimestampTitle(normalized);
}

function extractTextFragments(value) {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractTextFragments(item));
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  const fragments = [];
  if (typeof value.text === "string") {
    fragments.push(value.text);
  }
  if (typeof value.message === "string") {
    fragments.push(value.message);
  }
  if (Array.isArray(value.content)) {
    fragments.push(...value.content.flatMap((item) => extractTextFragments(item)));
  }
  return fragments;
}

function extractNormalizedMessageText(value) {
  return extractTextFragments(value)
    .map((fragment) => String(fragment || "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSilentReplyText(value) {
  return SILENT_REPLY_PATTERN.test(String(value ?? ""));
}

function isAssistantSilentReply(message) {
  if (!message || typeof message !== "object") {
    return false;
  }
  const role = typeof message.role === "string" ? message.role.toLowerCase() : "";
  if (role !== "assistant") {
    return false;
  }
  if (typeof message.text === "string") {
    return isSilentReplyText(message.text);
  }
  const text = extractNormalizedMessageText(message);
  return Boolean(text) && isSilentReplyText(text);
}

function buildSessionTitleFromText(value) {
  const text = extractNormalizedMessageText(value);
  if (!text) {
    return "";
  }
  return text.length > 20 ? `${text.slice(0, 20)}...` : text;
}

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
  // Prefer transcript-derived usage so we keep the source-side input/output split.
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

async function syncMemberUsageRecords(controller, sessionKey, messages) {
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

function scheduleMemberUsageSync(controller, sessionKey, attempt = 0) {
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

function resolveSessionLabel(row, index) {
  const label = String(row?.label || "").trim();
  if (label) {
    return label;
  }
  const displayName = String(row?.displayName || "").trim();
  if (displayName) {
    return displayName;
  }
  return index === 0 ? "当前会话" : `会话 ${index + 1}`;
}

function findFirstUserMessageTitle(messages) {
  if (!Array.isArray(messages)) {
    return "";
  }
  const firstUser = messages.find((message) => String(message?.role || "").trim() === "user");
  if (!firstUser) {
    return "";
  }
  return buildSessionTitleFromText(firstUser);
}

function buildSidebarMarkup(sessions, currentSessionKey) {
  const items = sessions.length
    ? sessions
        .map((row, index) => {
          const active = row.key === currentSessionKey;
          const sessionKey = escapeHtml(row.key);
          const sessionLabel = escapeHtml(resolveSessionLabel(row, index));
          const updated = formatRelativeTime(row.updatedAt);
          return `
            <div class="oc-member-chat-session-row ${active ? "oc-member-chat-session-row--active" : ""}">
              <button
                class="oc-member-chat-session-item nav-item ${active ? "nav-item--active" : ""}"
                type="button"
                data-member-chat-session="${sessionKey}"
                title="${sessionLabel}"
              >
                <span class="nav-item__icon" aria-hidden="true">💬</span>
                <span class="nav-item__text">
                  <span class="oc-member-chat-session-item__label">${sessionLabel}</span>
                  <span class="oc-member-chat-session-item__meta">${escapeHtml(updated || "未开始")}</span>
                </span>
              </button>
              <button
                class="oc-member-chat-session-delete"
                type="button"
                ${DELETE_ATTR}="${sessionKey}"
                title="删除会话"
                aria-label="删除会话"
              >
                删除
              </button>
            </div>
          `;
        })
        .join("")
    : `<div class="oc-member-chat-empty">还没有会话，点击“新建会话”开始。</div>`;

  return `
    <button class="nav-section__label" type="button" data-member-chat-collapse>
      <span class="nav-section__label-text">会话</span>
      <span class="nav-section__chevron" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"></path></svg>
      </span>
    </button>
    <div class="nav-section__items">
      <button class="btn primary oc-member-chat-action" type="button" data-member-chat-new>新建会话</button>
      <div class="oc-member-chat-session-list" ${SESSION_LIST_ATTR}="true">
        ${items}
      </div>
    </div>
  `;
}

function syncSectionCollapsedState(section) {
  if (!(section instanceof HTMLElement)) {
    return;
  }
  const collapsed = section.classList.contains("nav-section--collapsed");
  const label = section.querySelector("[data-member-chat-collapse]");
  if (label instanceof HTMLElement) {
    label.setAttribute("aria-expanded", String(!collapsed));
  }
  const items = section.querySelector(":scope > .nav-section__items");
  if (items instanceof HTMLElement) {
    items.hidden = collapsed;
  }
}

function buildTopActionMarkup(selectedAgent) {
  const agentName = escapeHtml(selectedAgent?.agentName || "当前 Agent");
  return `
    <button class="btn btn--ghost oc-member-chat-top-action__button" type="button" data-member-chat-back title="返回 Agent 选择">
      Agent选择
    </button>
    <span class="oc-member-chat-top-action__label" title="${agentName}">${agentName}</span>
  `;
}

function ensureVisibleCurrentSession(sessions, currentSessionKey) {
  const normalizedCurrent = String(currentSessionKey || "")
    .trim()
    .toLowerCase();
  if (!normalizedCurrent) {
    return sessions;
  }
  if (
    sessions.some(
      (row) =>
        String(row?.key || "")
          .trim()
          .toLowerCase() === normalizedCurrent,
    )
  ) {
    return sessions;
  }
  return [
    { key: normalizedCurrent, label: "新会话", updatedAt: Date.now(), hasGatewaySession: false },
    ...sessions,
  ];
}

function findSessionRowByKey(sessions, sessionKey) {
  const normalizedSessionKey = String(sessionKey || "")
    .trim()
    .toLowerCase();
  if (!normalizedSessionKey) {
    return null;
  }
  return (
    sessions.find(
      (row) =>
        String(row?.key || "")
          .trim()
          .toLowerCase() === normalizedSessionKey,
    ) || null
  );
}

function shouldSkipSessionHistoryHydration(sessions, sessionKey) {
  const row = findSessionRowByKey(sessions, sessionKey);
  if (!row || row.hasGatewaySession !== false) {
    return false;
  }
  const title = normalizeSessionTitleValue(row?.title || row?.label);
  return isProvisionalSessionTitle(title);
}

function isDraftOnlySessionRow(row) {
  if (!row || row.hasGatewaySession !== false) {
    return false;
  }
  const title = normalizeSessionTitleValue(row?.title || row?.label);
  return isProvisionalSessionTitle(title);
}

function isMemberDraftRouteLocked(session, selectedAgent, sessionKey) {
  const normalizedSessionKey = String(sessionKey || "")
    .trim()
    .toLowerCase();
  if (!normalizedSessionKey) {
    return false;
  }
  return readMemberDraftRouteLock(session, selectedAgent) === normalizedSessionKey;
}

function isPinnedDraftSessionStillActive(app, sessionKey) {
  const normalizedSessionKey = String(sessionKey || "")
    .trim()
    .toLowerCase();
  if (!normalizedSessionKey || !(app instanceof HTMLElement)) {
    return false;
  }
  const pinnedSessionKey = String(app.__ocPinnedSessionKey || app.sessionKey || "")
    .trim()
    .toLowerCase();
  if (pinnedSessionKey !== normalizedSessionKey) {
    return false;
  }
  const controller = window._ocMemberChatSurfaceController;
  const controllerSessionKey = String(controller?.currentSessionKey || "")
    .trim()
    .toLowerCase();
  if (controllerSessionKey === normalizedSessionKey && controller?.hasDraftSession) {
    return true;
  }
  if (app.chatSending || app.chatLoading || app.chatRunId) {
    return true;
  }
  if (typeof app.chatStream === "string" && app.chatStream.trim()) {
    return true;
  }
  if (Array.isArray(app.chatMessages) && app.chatMessages.length > 0) {
    return true;
  }
  if (Array.isArray(app.chatQueue) && app.chatQueue.length > 0) {
    return true;
  }
  return false;
}

function resolveRouteSessionKey(sessions, sessionKey) {
  return shouldSkipSessionHistoryHydration(sessions, sessionKey) ? "" : sessionKey;
}

function findTargetSessionKey(app, selectedAgent, session, href, sessions) {
  const url = new URL(href, document.baseURI);
  const resolveCandidate = (value) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    if (!normalized || !isTenantMemberSessionKey(normalized, session, selectedAgent)) {
      return "";
    }
    const existingRow = sessions.find(
      (row) =>
        String(row?.key || "")
          .trim()
          .toLowerCase() === normalized,
    );
    if (
      isDraftOnlySessionRow(existingRow) &&
      !isPinnedDraftSessionStillActive(app, normalized) &&
      !isMemberDraftRouteLocked(session, selectedAgent, normalized)
    ) {
      return "";
    }
    return existingRow?.key ? String(existingRow.key).trim().toLowerCase() : normalized;
  };
  const fromQuery = resolveCandidate(url.searchParams.get("session"));
  if (fromQuery) {
    return fromQuery;
  }
  const draftRouteLock = readMemberDraftRouteLock(session, selectedAgent);
  if (draftRouteLock) {
    const locked = resolveCandidate(draftRouteLock);
    if (locked) {
      return locked;
    }
    clearMemberDraftRouteLock(session, selectedAgent);
  }
  for (const candidate of [
    app?.sessionKey,
    app?.settings?.lastActiveSessionKey,
    app?.settings?.sessionKey,
  ]) {
    const persisted = resolveCandidate(candidate);
    if (persisted) {
      return persisted;
    }
  }
  const latestGatewayRow = sessions.find((row) => row?.hasGatewaySession !== false);
  const latestGateway = resolveCandidate(latestGatewayRow?.key);
  if (latestGateway) {
    return latestGateway;
  }
  const legacy = buildTenantMemberLegacySessionKey(selectedAgent);
  if (legacy) {
    const legacyRow = sessions.find(
      (row) =>
        String(row.key || "")
          .trim()
          .toLowerCase() === legacy,
    );
    if (legacyRow?.key) {
      return legacyRow.key.trim().toLowerCase();
    }
  }
  return createTenantMemberSessionKey(session, selectedAgent).toLowerCase();
}

async function loadMemberSessions(app, selectedAgent, session) {
  const apiClient = createTenantApiClient();
  let registeredSessions = [];
  try {
    registeredSessions = await awaitWithTimeout(
      apiClient.listMemberSessions(selectedAgent.id),
      MEMBER_SESSION_LIST_TIMEOUT_MS,
      "member_sessions.list",
    );
  } catch {
    // Ignore platform session list failures and fall back to gateway data.
  }
  const registeredMap = new Map(
    registeredSessions.map((r) => [String(r.openclawSessionKey).trim().toLowerCase(), r]),
  );

  let rows =
    app?.sessionsResult && Array.isArray(app.sessionsResult.sessions)
      ? normalizeSessionRows(app.sessionsResult)
      : null;
  if (!rows) {
    try {
      rows = normalizeSessionRows(
        await awaitWithTimeout(
          app.client.request("sessions.list", {}),
          MEMBER_SESSION_LIST_TIMEOUT_MS,
          "gateway.sessions.list",
        ),
      );
    } catch {
      rows = [];
    }
  }
  const filteredFromGateway = rows.filter((row) =>
    isTenantMemberSessionKey(row.key, session, selectedAgent),
  );
  const result = [];

  const keysToHydrateFromHistory = [];
  for (const gatewayRow of filteredFromGateway) {
    const key = String(gatewayRow.key).trim().toLowerCase();
    const dbRow = registeredMap.get(key);
    const dbTitle = normalizeSessionTitleValue(dbRow?.title);
    const gatewayTitle = normalizeSessionTitleValue(gatewayRow.title || gatewayRow.label);
    const shouldHydrateTitleFromHistory =
      (!dbRow || isProvisionalSessionTitle(dbTitle)) && isProvisionalSessionTitle(gatewayTitle);
    if (shouldHydrateTitleFromHistory) {
      keysToHydrateFromHistory.push(key);
    }
  }

  const hydratedTitleMap = new Map();
  if (keysToHydrateFromHistory.length > 0) {
    await Promise.all(
      keysToHydrateFromHistory.map(async (key) => {
        try {
          const historyResp = await awaitWithTimeout(
            app.client.request("chat.history", {
              sessionKey: key,
              limit: 200,
            }),
            MEMBER_SESSION_TITLE_HISTORY_TIMEOUT_MS,
            "gateway.chat.history.title",
          );
          const nextTitle = findFirstUserMessageTitle(historyResp?.messages);
          if (nextTitle) {
            hydratedTitleMap.set(key, nextTitle);
          }
        } catch {
          // Ignore title hydration failures and keep the provisional title.
        }
      }),
    );
  }

  for (const gatewayRow of filteredFromGateway) {
    const key = String(gatewayRow.key).trim().toLowerCase();
    const dbRow = registeredMap.get(key);

    if (dbRow && dbRow.hiddenAt) {
      continue;
    }

    const dbTitle = normalizeSessionTitleValue(dbRow?.title);
    const gatewayTitle = normalizeSessionTitleValue(gatewayRow.title || gatewayRow.label);

    let nextTitle = "新会话";
    if (hydratedTitleMap.has(key)) {
      nextTitle = hydratedTitleMap.get(key);
    } else if (!isProvisionalSessionTitle(dbTitle)) {
      nextTitle = dbTitle;
    } else if (!isProvisionalSessionTitle(gatewayTitle)) {
      nextTitle = gatewayTitle;
    }

    if (!dbRow || (isProvisionalSessionTitle(dbTitle) && nextTitle !== dbTitle)) {
      try {
        await apiClient.registerMemberSession({
          tenantAgentId: selectedAgent.id,
          openclawSessionKey: key,
          title: nextTitle,
        });
        if (dbRow) {
          dbRow.title = nextTitle;
        }
      } catch {}
    }

    result.push({
      ...gatewayRow,
      title: nextTitle,
      label: nextTitle !== "新会话" ? nextTitle : gatewayRow.label,
      hasGatewaySession: true,
    });
  }

  for (const dbRow of registeredSessions) {
    const key = String(dbRow.openclawSessionKey).trim().toLowerCase();
    if (dbRow.hiddenAt) {
      continue;
    }
    if (!result.some((r) => String(r.key).toLowerCase() === key)) {
      result.push({
        key: dbRow.openclawSessionKey,
        label: dbRow.title || "新会话",
        updatedAt: new Date(dbRow.updatedAt).getTime(),
        hasGatewaySession: false,
      });
    }
  }

  const lockedDraftSessionKey = readMemberDraftRouteLock(session, selectedAgent);
  if (lockedDraftSessionKey) {
    const lockedDraftRow = result.find(
      (row) =>
        String(row?.key || "")
          .trim()
          .toLowerCase() === lockedDraftSessionKey,
    );
    if (lockedDraftRow?.hasGatewaySession === true) {
      clearMemberDraftRouteLock(session, selectedAgent);
    }
  }

  return result.toSorted(
    (left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0),
  );
}

async function ensureMemberSessionTitle(controller, sessionKey, messagePayload) {
  const normalizedSessionKey = String(sessionKey || "")
    .trim()
    .toLowerCase();
  if (!normalizedSessionKey) {
    return;
  }
  const nextTitle = buildSessionTitleFromText(messagePayload);
  if (!nextTitle) {
    return;
  }
  const currentRow = controller.sessions.find(
    (row) =>
      String(row?.key || "")
        .trim()
        .toLowerCase() === normalizedSessionKey,
  );
  const currentTitle = normalizeSessionTitleValue(currentRow?.title || currentRow?.label);
  if (!isProvisionalSessionTitle(currentTitle)) {
    return;
  }
  try {
    await createTenantApiClient().registerMemberSession({
      tenantAgentId: controller.selectedAgent.id,
      openclawSessionKey: normalizedSessionKey,
      title: nextTitle,
    });
  } catch {
    return;
  }

  for (const row of controller.sessions) {
    if (
      String(row?.key || "")
        .trim()
        .toLowerCase() === normalizedSessionKey
    ) {
      row.title = nextTitle;
      row.label = nextTitle;
    }
  }
  for (const row of controller.sessionsFromGateway) {
    if (
      String(row?.key || "")
        .trim()
        .toLowerCase() === normalizedSessionKey
    ) {
      row.title = nextTitle;
      row.label = nextTitle;
    }
  }
  clearMemberDraftRouteLock(controller.session, controller.selectedAgent);
  renderSidebarSection(controller);
  if (window._ocMemberChatSurfaceController?.currentSessionKey === normalizedSessionKey) {
    syncRouteForSession(
      controller.selectedAgent,
      resolveRouteSessionKey(controller.sessions, normalizedSessionKey),
      { replace: true },
    );
  }
}

function ensureSection(sidebar) {
  let section = sidebar.querySelector(`[${SECTION_ATTR}]`);
  if (section instanceof HTMLElement) {
    return section;
  }
  section = document.createElement("section");
  section.className = SECTION_CLASS;
  section.setAttribute(SECTION_ATTR, "true");
  section.setAttribute("data-oc-role-nav", "true");
  const firstNativeSection = sidebar.querySelector(
    ":scope > .nav-section:not(.oc-platform-management-section)",
  );
  sidebar.insertBefore(section, firstNativeSection);
  return section;
}

function ensureTopActionRow(breadcrumb) {
  let root = breadcrumb.querySelector(`[${TOP_ACTION_ATTR}]`);
  if (root instanceof HTMLElement) {
    return root;
  }
  root = document.createElement("span");
  root.className = "oc-member-chat-top-action";
  root.setAttribute(TOP_ACTION_ATTR, "true");
  breadcrumb.append(root);
  return root;
}

function showDialog(dialog) {
  if (!(dialog instanceof HTMLDialogElement)) {
    return;
  }
  if (typeof dialog.showModal === "function") {
    if (!dialog.open) {
      dialog.showModal();
    }
    return;
  }
  dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (!(dialog instanceof HTMLDialogElement)) {
    return;
  }
  if (typeof dialog.close === "function") {
    if (dialog.open) {
      dialog.close();
      return;
    }
  }
  dialog.removeAttribute("open");
}

async function applyHiddenDelete(controller, nextHiddenKey) {
  try {
    await createTenantApiClient().hideMemberSession({ openclawSessionKey: nextHiddenKey });
  } catch {
    showTransientToast(controller, "删除会话失败");
    return;
  }
  controller.sessions = controller.sessions.filter(
    (row) =>
      String(row?.key || "")
        .trim()
        .toLowerCase() !== nextHiddenKey,
  );
  if (controller.currentSessionKey === nextHiddenKey) {
    clearMemberDraftRouteLockForController(controller, nextHiddenKey);
    const fallbackSessionKey =
      controller.sessions[0]?.key?.trim().toLowerCase() ||
      createTenantMemberSessionKey(controller.session, controller.selectedAgent).toLowerCase();
    controller.currentSessionKey = fallbackSessionKey;
    controller.sessions = ensureVisibleCurrentSession(controller.sessions, fallbackSessionKey);
    controller.hasDraftSession = isMemberDraftRouteLocked(
      controller.session,
      controller.selectedAgent,
      fallbackSessionKey,
    );
    syncRouteForSession(
      controller.selectedAgent,
      resolveRouteSessionKey(controller.sessions, fallbackSessionKey),
      { replace: true },
    );
    pinMemberChatSession(controller.app, fallbackSessionKey, {
      skipHydrateHistory: shouldSkipSessionHistoryHydration(
        controller.sessions,
        fallbackSessionKey,
      ),
    });
  }
  renderSidebarSection(controller);
}

function ensureDeleteDialog(controller) {
  let root = document.body.querySelector(`[${DELETE_DIALOG_ROOT_ATTR}]`);
  if (!(root instanceof HTMLElement)) {
    root = document.createElement("div");
    root.setAttribute(DELETE_DIALOG_ROOT_ATTR, "true");
    root.innerHTML = `
      <dialog class="oc-platform-topbar-dialog" data-oc-member-chat-delete-dialog>
        <div class="oc-platform-topbar-dialog__panel">
          <header class="oc-platform-topbar-dialog__header">
            <h3 class="oc-platform-topbar-dialog__title">确认删除</h3>
            <button class="btn" type="button" data-oc-member-chat-delete-close>关闭</button>
          </header>
          <div class="oc-platform-topbar-dialog__body">
            <p class="oc-platform-topbar-dialog__text">删除后不可恢复，确认删除?</p>
          </div>
          <footer class="oc-platform-topbar-dialog__actions">
            <button class="btn" type="button" data-oc-member-chat-delete-close>取消</button>
            <button class="btn primary" type="button" data-oc-member-chat-confirm-delete>确认删除</button>
          </footer>
        </div>
      </dialog>
    `;
    document.body.append(root);
  }
  root._ocController = controller;
  if (root.dataset.ocMemberChatHandlers !== "true") {
    root.dataset.ocMemberChatHandlers = "true";
    root.addEventListener("click", (event) => {
      const activeController = root._ocController;
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (target.closest(DELETE_DIALOG_CLOSE_SELECTOR)) {
        event.preventDefault();
        if (activeController) {
          activeController.pendingDeleteSessionKey = "";
        }
        closeDialog(root.querySelector(DELETE_DIALOG_SELECTOR));
        return;
      }
      if (!target.closest(DELETE_DIALOG_CONFIRM_SELECTOR)) {
        return;
      }
      event.preventDefault();
      const nextHiddenKey = String(activeController?.pendingDeleteSessionKey || "")
        .trim()
        .toLowerCase();
      if (activeController) {
        activeController.pendingDeleteSessionKey = "";
      }
      closeDialog(root.querySelector(DELETE_DIALOG_SELECTOR));
      if (!nextHiddenKey) {
        return;
      }
      if (activeController) {
        applyHiddenDelete(activeController, nextHiddenKey);
      }
    });
  }
  return root.querySelector(DELETE_DIALOG_SELECTOR);
}

function closeAllDialogs() {
  for (const dialog of document.querySelectorAll("dialog[open]")) {
    if (dialog instanceof HTMLDialogElement) {
      closeDialog(dialog);
    }
  }
}

function clearMemberDraftRouteLockForController(controller, sessionKey = "") {
  if (!controller?.session || !controller?.selectedAgent) {
    return;
  }
  const activeDraftLock = readMemberDraftRouteLock(controller.session, controller.selectedAgent);
  const normalizedSessionKey = String(sessionKey || controller.currentSessionKey || "")
    .trim()
    .toLowerCase();
  if (!normalizedSessionKey || activeDraftLock === normalizedSessionKey) {
    clearMemberDraftRouteLock(controller.session, controller.selectedAgent);
  }
}

function beginNewMemberDraftSession(controller) {
  if (!controller || !controller.selectedAgent?.id || !controller.session) {
    return false;
  }
  if (controller.hasDraftSession) {
    showTransientToast(controller, "已经是新的会话了");
    return true;
  }
  const nextSessionKey = createTenantMemberSessionKey(controller.session, controller.selectedAgent);
  if (!nextSessionKey) {
    return false;
  }

  createTenantApiClient()
    .registerMemberSession({
      tenantAgentId: controller.selectedAgent.id,
      openclawSessionKey: nextSessionKey,
      title: "新会话",
    })
    .catch(() => {});

  controller.currentSessionKey = nextSessionKey;
  controller.sessions = ensureVisibleCurrentSession(controller.sessions, nextSessionKey);
  controller.hasDraftSession = true;
  writeMemberDraftRouteLock(controller.session, controller.selectedAgent, nextSessionKey);
  syncRouteForSession(
    controller.selectedAgent,
    resolveRouteSessionKey(controller.sessions, nextSessionKey),
    { replace: false },
  );
  pinMemberChatSession(controller.app, nextSessionKey, {
    skipHydrateHistory: shouldSkipSessionHistoryHydration(controller.sessions, nextSessionKey),
  });
  renderSidebarSection(controller);
  return true;
}

function isMemberChatSelfMutation(node) {
  return Boolean(
    node.closest?.(
      `[${SECTION_ATTR}], [${TOP_ACTION_ATTR}], [${DELETE_DIALOG_ROOT_ATTR}], [${TOAST_ROOT_ATTR}]`,
    ),
  );
}

function pinMemberChatSession(app, sessionKey, options = {}) {
  if (!(app instanceof HTMLElement) || !sessionKey) {
    return;
  }
  const skipHydrateHistory = options.skipHydrateHistory === true;

  const previousSessionKey = String(app.__ocPinnedSessionKey || "")
    .trim()
    .toLowerCase();
  const normalizedSessionKey = String(sessionKey || "")
    .trim()
    .toLowerCase();
  if (previousSessionKey && previousSessionKey !== normalizedSessionKey) {
    clearChatLoadingFailsafe(app);
  }

  // Always update the mutable pinned key reference FIRST
  app.__ocPinnedSessionKey = sessionKey;

  if (!app.__openclawTenantMemberPatched) {
    if (typeof app.setTab === "function") {
      const originalSetTab = app.setTab.bind(app);
      app.__openclawTenantMemberOriginalSetTab = originalSetTab;
      app.setTab = () => originalSetTab("chat");
    }
    if (typeof app.applySettings === "function") {
      const originalApplySettings = app.applySettings.bind(app);
      app.__openclawTenantMemberOriginalApplySettings = originalApplySettings;
      // Use app.__ocPinnedSessionKey (mutable) so switching sessions works correctly.
      // Do NOT capture `sessionKey` from the closure here - it would be stale on re-calls.
      app.applySettings = (next) =>
        originalApplySettings({
          ...next,
          sessionKey: app.__ocPinnedSessionKey,
          lastActiveSessionKey: app.__ocPinnedSessionKey,
        });
    }
    app.__openclawTenantMemberPatched = true;
  }

  if (typeof app.setTab === "function" && app.tab !== "chat") {
    app.setTab("chat");
  }

  if (!app.__openclawClientPatched && app.client && typeof app.client.request === "function") {
    const originalRequest = app.client.request;
    const boundOriginalRequest = originalRequest.bind(app.client);
    const wrappedRequest = async (method, params) => {
      const activeSessionKey =
        method === "chat.send"
          ? String(
              window._ocMemberChatSurfaceController?.currentSessionKey ||
                app.__ocPinnedSessionKey ||
                app.sessionKey ||
                "",
            )
              .trim()
              .toLowerCase()
          : "";
      if (method === "chat.send") {
        const session = readTenantSession();
        const agent = readSelectedTenantAgent();
        const isLocal = session?.session?.edition === "local";
        const balance = Number(agent?.balancePoints ?? 0);
        if (
          session?.session?.role !== "platform_admin" &&
          !isLocal &&
          hasResolvedSelectedTenantAgent(agent) &&
          balance <= 0
        ) {
          // Note: In most cases, the early interceptor in bootMemberChatSurface
          // will catch this before it reaches here.
          showTransientToast(
            window._ocMemberChatSurfaceController,
            "积分不足请联系管理员。",
            "danger",
          );
          return { ok: false, error: "insufficient_balance" };
        }
      }
      const result = await boundOriginalRequest(method, params);
      if (method === "chat.send") {
        scheduleChatLoadingFailsafe(app, activeSessionKey);
        if (window._ocMemberChatSurfaceController?.currentSessionKey) {
          void ensureMemberSessionTitle(
            window._ocMemberChatSurfaceController,
            window._ocMemberChatSurfaceController.currentSessionKey,
            params?.message,
          );
          scheduleMemberUsageSync(
            window._ocMemberChatSurfaceController,
            window._ocMemberChatSurfaceController.currentSessionKey,
          );
        }
        setTimeout(() => {
          void syncMemberChatSurface();
        }, 1200);
      }
      return result;
    };
    if (originalRequest && typeof originalRequest === "function" && "mock" in originalRequest) {
      wrappedRequest.mock = originalRequest.mock;
    }
    app.client.request = wrappedRequest;
    app.__openclawClientPatched = true;
  }

  const shouldHydrateHistory =
    app.sessionKey !== sessionKey ||
    (app.__ocPinnedSessionHydratedKey !== sessionKey &&
      app.__ocPinnedSessionHydratingKey !== sessionKey);

  if (shouldHydrateHistory) {
    // Reset session-scoped view state before rehydrating persisted history.
    app.chatMessages = [];
    if (Array.isArray(app.chatQueue)) {
      app.chatQueue = [];
    }
    app.chatThinkingLevel = null;
    app.chatRunId = null;
    app.chatStreamStartedAt = null;
    app.chatStream = null;
    app.lastError = null;
    if (typeof app.resetToolStream === "function") {
      app.resetToolStream();
    }

    if (app.sessionKey !== sessionKey) {
      app.sessionKey = sessionKey;
      if (typeof app.applySettings === "function" && app.settings) {
        app.applySettings({
          ...app.settings,
          sessionKey,
          lastActiveSessionKey: sessionKey,
        });
      }
    }

    if (typeof app.loadAssistantIdentity === "function") {
      void app.loadAssistantIdentity();
    }

    if (skipHydrateHistory) {
      app.__ocPinnedSessionHydratingKey = "";
      app.__ocPinnedSessionHydratedKey = sessionKey;
      app.chatLoading = false;
      clearChatLoadingFailsafe(app);
      app.requestUpdate?.();
      return;
    }

    app.chatLoading = true;
    app.requestUpdate?.();
    app.__ocPinnedSessionHydratingKey = sessionKey;

    // Load chat history for the pinned session directly via the client.
    const targetKey = sessionKey;
    awaitWithTimeout(
      app.client.request("chat.history", { sessionKey: targetKey, limit: 200 }),
      MEMBER_CHAT_HISTORY_TIMEOUT_MS,
      "gateway.chat.history.bootstrap",
    )
      .then((res) => {
        if (app.__ocPinnedSessionHydratingKey === targetKey) {
          app.__ocPinnedSessionHydratingKey = "";
        }
        if (app.__ocPinnedSessionKey === targetKey) {
          const msgs = Array.isArray(res?.messages) ? res.messages : [];
          app.chatMessages = msgs.filter((message) => !isAssistantSilentReply(message));
          app.chatThinkingLevel = res?.thinkingLevel ?? null;
          app.chatRunId = null;
          app.chatStream = null;
          app.chatStreamStartedAt = null;
          if (typeof app.resetToolStream === "function") {
            app.resetToolStream();
          }
          if (typeof app.resetChatScroll === "function") {
            app.resetChatScroll();
          }
          app.chatLoading = false;
          clearChatLoadingFailsafe(app);
          app.__ocPinnedSessionHydratedKey = targetKey;
          app.requestUpdate?.();
          if (window._ocMemberChatSurfaceController?.currentSessionKey === targetKey) {
            void syncMemberUsageRecords(window._ocMemberChatSurfaceController, targetKey, msgs);
          }
        }
      })
      .catch(() => {
        if (app.__ocPinnedSessionHydratingKey === targetKey) {
          app.__ocPinnedSessionHydratingKey = "";
        }
        if (app.__ocPinnedSessionKey === targetKey) {
          app.chatMessages = [];
          app.chatThinkingLevel = null;
          app.__ocPinnedSessionHydratedKey = "";
          app.chatLoading = false;
          clearChatLoadingFailsafe(app);
          app.requestUpdate?.();
        }
      });
  }
}

function syncRouteForSession(selectedAgent, sessionKey, { replace = true } = {}) {
  const current = new URL(window.location.href);
  const target = buildTenantMemberChatRoute(selectedAgent.id, sessionKey);
  const targetUrl = new URL(target, document.baseURI);
  if (current.href !== targetUrl.href) {
    memberChatSurfaceSuppressNextRouteSync = true;
    navigateTenantRoute(targetUrl.href, { replace });
  }
}

function attachSectionHandlers(section, controller) {
  section._ocController = controller;
  if (section.dataset.ocMemberChatHandlers === "true") {
    return;
  }
  section.dataset.ocMemberChatHandlers = "true";
  section.addEventListener("click", (event) => {
    const ctrl = section._ocController;
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest("[data-member-chat-new]")) {
      event.preventDefault();
      beginNewMemberDraftSession(ctrl);
      return;
    }
    const sessionButton = target.closest("[data-member-chat-session]");
    if (sessionButton instanceof HTMLElement) {
      event.preventDefault();
      const nextSessionKey = String(sessionButton.dataset.memberChatSession || "")
        .trim()
        .toLowerCase();
      if (!nextSessionKey || nextSessionKey === ctrl.currentSessionKey) {
        return;
      }

      if (ctrl.hasDraftSession) {
        void createTenantApiClient()
          .deleteMemberSession({ openclawSessionKey: ctrl.currentSessionKey })
          .catch(() => {});
        ctrl.sessions = ctrl.sessions.filter(
          (row) =>
            String(row?.key || "")
              .trim()
              .toLowerCase() !== ctrl.currentSessionKey,
        );
        ctrl.hasDraftSession = false;
        clearMemberDraftRouteLockForController(ctrl, ctrl.currentSessionKey);
      }

      ctrl.currentSessionKey = nextSessionKey;
      ctrl.hasDraftSession = isMemberDraftRouteLocked(
        ctrl.session,
        ctrl.selectedAgent,
        nextSessionKey,
      );
      syncRouteForSession(
        ctrl.selectedAgent,
        resolveRouteSessionKey(ctrl.sessions, nextSessionKey),
        { replace: false },
      );
      pinMemberChatSession(ctrl.app, nextSessionKey, {
        skipHydrateHistory: shouldSkipSessionHistoryHydration(ctrl.sessions, nextSessionKey),
      });
      renderSidebarSection(ctrl);
      return;
    }
    const deleteButton = target.closest(`[${DELETE_ATTR}]`);
    if (deleteButton instanceof HTMLElement) {
      event.preventDefault();
      event.stopPropagation();
      const nextHiddenKey = String(deleteButton.getAttribute(DELETE_ATTR) || "")
        .trim()
        .toLowerCase();
      if (!nextHiddenKey) {
        return;
      }
      ctrl.pendingDeleteSessionKey = nextHiddenKey;
      showDialog(ensureDeleteDialog(ctrl));
      return;
    }
    if (target.closest("[data-member-chat-collapse]")) {
      event.preventDefault();
      section.classList.toggle("nav-section--collapsed");
      syncSectionCollapsedState(section);
    }
  });
}

function attachTopActionHandlers(root) {
  if (!(root instanceof HTMLElement) || root.dataset.ocMemberChatHandlers === "true") {
    return;
  }
  root.dataset.ocMemberChatHandlers = "true";
  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (!target.closest("[data-member-chat-back]")) {
      return;
    }
    event.preventDefault();
    if (window._ocMemberChatSurfaceController?.hasDraftSession) {
      void createTenantApiClient()
        .deleteMemberSession({
          openclawSessionKey: window._ocMemberChatSurfaceController.currentSessionKey,
        })
        .catch(() => {});
      clearMemberDraftRouteLockForController(window._ocMemberChatSurfaceController);
    }
    navigateTenantRoute(TENANT_AGENT_SELECTOR_ROUTE);
  });
}

function renderSidebarSection(controller) {
  const section = ensureSection(controller.sidebar);
  section.innerHTML = buildSidebarMarkup(controller.sessions, controller.currentSessionKey);
  section.setAttribute(ACTIVE_SESSION_ATTR, controller.currentSessionKey);
  section.setAttribute(LABEL_ATTR, controller.selectedAgent?.agentName || "");
  syncSectionCollapsedState(section);
  attachSectionHandlers(section, controller);
}

function renderTopAction(controller) {
  if (!(controller.breadcrumb instanceof HTMLElement)) {
    return;
  }
  const root = ensureTopActionRow(controller.breadcrumb);
  root.innerHTML = buildTopActionMarkup(controller.selectedAgent);
  attachTopActionHandlers(root);
}

function resolveMemberChatShell() {
  const app = findOpenClawApp(document);
  const sidebar = findSidebar(document);
  const breadcrumb = findBreadcrumb(document);
  return {
    app: app instanceof HTMLElement ? app : null,
    sidebar: sidebar instanceof HTMLElement ? sidebar : null,
    breadcrumb: breadcrumb instanceof HTMLElement ? breadcrumb : null,
  };
}

async function resolveSelectedAgentForMemberChat(session, href = window.location.href) {
  const selectedAgent = readSelectedTenantAgent(href);
  if (hasResolvedSelectedTenantAgent(selectedAgent)) {
    return selectedAgent;
  }
  const tenantAgentId = String(selectedAgent?.id || "").trim();
  if (!tenantAgentId || session?.session?.role !== "member") {
    return selectedAgent;
  }
  try {
    const agents = await createTenantApiClient().listMemberAgents();
    const resolved = Array.isArray(agents)
      ? agents.find((item) => String(item?.id || "").trim() === tenantAgentId)
      : null;
    if (resolved && hasResolvedSelectedTenantAgent(resolved)) {
      writeSelectedTenantAgent(resolved);
      return resolved;
    }
  } catch {
    // Ignore agent refresh failures and continue with cached selection.
  }
  return selectedAgent;
}

async function syncMemberChatSurface() {
  if (memberChatSurfaceSyncing) {
    memberChatSurfaceSyncQueued = true;
    return;
  }
  memberChatSurfaceSyncing = true;
  try {
    if (!isMemberChatRoute()) {
      const app = findOpenClawApp(document);
      if (app instanceof HTMLElement) {
        clearChatLoadingFailsafe(app);
        delete app.__ocPinnedSessionHydratedKey;
        delete app.__ocPinnedSessionHydratingKey;
      }
      delete window._ocMemberChatSurfaceController;
      document.documentElement.removeAttribute(DOC_ATTR);
      document.body?.removeAttribute(DOC_ATTR);
      document.querySelector(`[${SECTION_ATTR}]`)?.remove();
      document.querySelector(`[${TOP_ACTION_ATTR}]`)?.remove();
      document.querySelector(`[${DELETE_DIALOG_ROOT_ATTR}]`)?.remove();
      document.querySelector(`[${TOAST_ROOT_ATTR}]`)?.remove();
      return;
    }

    document.documentElement.setAttribute(DOC_ATTR, "true");
    document.body?.setAttribute(DOC_ATTR, "true");
    ensureStyle();
    closeAllDialogs();

    const { app, sidebar, breadcrumb } = resolveMemberChatShell();
    const session = readTenantSession();
    const selectedAgent = await resolveSelectedAgentForMemberChat(session);
    if (
      !(app instanceof HTMLElement) ||
      !(sidebar instanceof HTMLElement) ||
      !session ||
      !selectedAgent?.id
    ) {
      if (app instanceof HTMLElement) {
        clearChatLoadingFailsafe(app);
      }
      return;
    }
    if (!hasResolvedSelectedTenantAgent(selectedAgent)) {
      navigateTenantRoute(TENANT_AGENT_SELECTOR_ROUTE, { replace: true });
      return;
    }
    if (!app.client || !app.connected) {
      return;
    }

    const sessionsFromGateway = await loadMemberSessions(app, selectedAgent, session);
    const currentSessionKey = findTargetSessionKey(
      app,
      selectedAgent,
      session,
      window.location.href,
      sessionsFromGateway,
    );

    const controller = {
      app,
      sidebar,
      breadcrumb,
      session,
      selectedAgent,
      sessionsFromGateway,
      sessions: ensureVisibleCurrentSession(sessionsFromGateway, currentSessionKey),
      currentSessionKey,
      hasDraftSession: isMemberDraftRouteLocked(session, selectedAgent, currentSessionKey),
      pendingDeleteSessionKey: "",
      toastTimer: 0,
    };

    renderSidebarSection(controller);
    renderTopAction(controller);
    ensureDeleteDialog(controller);
    syncRouteForSession(
      selectedAgent,
      resolveRouteSessionKey(controller.sessions, currentSessionKey),
      { replace: true },
    );
    pinMemberChatSession(app, currentSessionKey, {
      skipHydrateHistory: shouldSkipSessionHistoryHydration(controller.sessions, currentSessionKey),
    });
    window._ocMemberChatSurfaceController = controller;
    void syncMemberUsageRecords(
      controller,
      currentSessionKey,
      Array.isArray(app.chatMessages) ? app.chatMessages : [],
    );
  } finally {
    memberChatSurfaceSyncing = false;
    if (memberChatSurfaceSyncQueued) {
      memberChatSurfaceSyncQueued = false;
      window.setTimeout(() => {
        void syncMemberChatSurface();
      }, 0);
    }
  }
}
export { syncMemberChatSurface };

export function bootMemberChatSurface() {
  bootTenantRouteSync();
  void syncMemberChatSurface();

  if (window.__openclawMemberChatSurfaceBooted) {
    return;
  }
  window.__openclawMemberChatSurfaceBooted = true;

  // Intercept user actions (Click/Enter) to block send BEFORE UI state changes
  const checkCreditBeforeAction = () => {
    if (!isMemberChatRoute()) return true;
    const session = readTenantSession();
    const agent = readSelectedTenantAgent();
    if (session?.session?.role === "platform_admin" || session?.session?.edition === "local") {
      return true;
    }
    if (!hasResolvedSelectedTenantAgent(agent)) {
      return true;
    }
    const balance = Number(agent?.balancePoints ?? 0);
    if (balance <= 0) {
      showTransientToast(window._ocMemberChatSurfaceController, "积分不足请联系管理员。", "danger");
      return false;
    }
    return true;
  };

  memberChatClickHandler ||= (e) => {
    const event = e;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    if (isMemberChatRoute()) {
      const ctrl = window._ocMemberChatSurfaceController;
      const newSessionBtn = findClosestNewSessionButton(target);
      if (newSessionBtn && beginNewMemberDraftSession(ctrl)) {
        event.stopImmediatePropagation();
        event.preventDefault();
        return;
      }
    }
    const btn = findClosestSendButton(target);
    if (isSendButtonElement(btn) && !isStopButtonElement(btn)) {
      if (!checkCreditBeforeAction()) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    }
  };
  document.addEventListener("click", memberChatClickHandler, true);

  memberChatKeydownHandler ||= (e) => {
    const event = e;
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      const textarea =
        event.target instanceof Element ? findClosestComposerTextarea(event.target) : null;
      if (textarea instanceof HTMLTextAreaElement) {
        if (!checkCreditBeforeAction()) {
          event.stopImmediatePropagation();
          event.preventDefault();
        }
      }
    }
  };
  document.addEventListener("keydown", memberChatKeydownHandler, true);

  memberChatRouteCleanup = onTenantRouteChange(() => {
    if (memberChatSurfaceSuppressNextRouteSync) {
      memberChatSurfaceSuppressNextRouteSync = false;
      return;
    }
    void syncMemberChatSurface();
  });

  memberChatMutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) {
          continue;
        }
        if (isMemberChatSelfMutation(node)) {
          continue;
        }
        if (
          findOpenClawApp(node) === node ||
          findSidebar(node) === node ||
          findBreadcrumb(node) === node
        ) {
          void syncMemberChatSurface();
          return;
        }
        if (findOpenClawApp(node) || findSidebar(node) || findBreadcrumb(node)) {
          void syncMemberChatSurface();
          return;
        }
      }
    }
  });

  memberChatMutationObserver.observe(document.documentElement, {
    subtree: true,
    childList: true,
  });
}

export function resetMemberChatSurfaceForTests() {
  memberChatSurfaceSyncing = false;
  memberChatSurfaceSyncQueued = false;
  memberChatSurfaceSuppressNextRouteSync = false;
  if (typeof memberChatRouteCleanup === "function") {
    memberChatRouteCleanup();
  }
  memberChatRouteCleanup = null;
  memberChatMutationObserver?.disconnect();
  memberChatMutationObserver = null;
  if (memberChatClickHandler) {
    document.removeEventListener("click", memberChatClickHandler, true);
  }
  if (memberChatKeydownHandler) {
    document.removeEventListener("keydown", memberChatKeydownHandler, true);
  }
  document.documentElement.removeAttribute(DOC_ATTR);
  document.body?.removeAttribute(DOC_ATTR);
  document.querySelector(`[${SECTION_ATTR}]`)?.remove();
  document.querySelector(`[${TOP_ACTION_ATTR}]`)?.remove();
  document.querySelector(`[${DELETE_DIALOG_ROOT_ATTR}]`)?.remove();
  document.querySelector(`[${TOAST_ROOT_ATTR}]`)?.remove();
  delete window._ocMemberChatSurfaceController;
  delete window.__openclawMemberChatSurfaceBooted;
  resetTenantRouteSyncForTests();
}
