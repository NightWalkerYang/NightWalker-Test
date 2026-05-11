import { findChatSurface } from "../framework/dom-compat.js";
import { createTenantApiClient } from "./api-client.js";

export function findFirstUserMessageTitle(messages, buildSessionTitleFromText) {
  if (!Array.isArray(messages)) {
    return "";
  }
  const firstUser = messages.find((message) => String(message?.role || "").trim() === "user");
  if (!firstUser) {
    return "";
  }
  return buildSessionTitleFromText(firstUser);
}

export function ensureVisibleCurrentSession(sessions, currentSessionKey) {
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

export function shouldSkipSessionHistoryHydration(sessions, sessionKey) {
  const row = findSessionRowByKey(sessions, sessionKey);
  if (!row || row.hasGatewaySession !== false) {
    return false;
  }
  const title = normalizeSessionTitleValue(row?.title || row?.label);
  return isProvisionalSessionTitle(title);
}

function normalizeMessageSeq(message) {
  const raw =
    message?.__openclaw?.seq ??
    message?.seq ??
    message?.sequence ??
    message?.messageSequence ??
    null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readFirstLoadedMessageSeq(messages) {
  if (!Array.isArray(messages)) {
    return null;
  }
  for (const message of messages) {
    const seq = normalizeMessageSeq(message);
    if (Number.isFinite(seq)) {
      return seq;
    }
  }
  return null;
}

function readFirstLoadedMessageId(messages) {
  if (!Array.isArray(messages)) {
    return "";
  }
  for (const message of messages) {
    const messageId = String(
      message?.__openclaw?.id ?? message?.id ?? message?.messageId ?? message?.message_id ?? "",
    ).trim();
    if (messageId) {
      return messageId;
    }
  }
  return "";
}

function mergeOlderMemberHistory(existingMessages, olderMessages, isAssistantSilentReply) {
  const existing = Array.isArray(existingMessages) ? existingMessages : [];
  const incoming = Array.isArray(olderMessages) ? olderMessages : [];
  if (incoming.length === 0) {
    return existing.slice();
  }
  const dedupedExisting = existing.filter((message) => !isAssistantSilentReply(message));
  const seenSeq = new Set();
  const seenFallback = new Set();
  const merged = [];
  const collectKey = (message) => {
    const messageId = String(
      message?.__openclaw?.id ?? message?.id ?? message?.messageId ?? message?.message_id ?? "",
    ).trim();
    if (messageId) {
      return `id:${messageId}`;
    }
    const seq = normalizeMessageSeq(message);
    if (Number.isFinite(seq)) {
      return `seq:${seq}`;
    }
    try {
      return `json:${JSON.stringify(message)}`;
    } catch {
      return "";
    }
  };
  for (const message of [...incoming, ...dedupedExisting]) {
    if (isAssistantSilentReply(message)) {
      continue;
    }
    const fallbackKey = collectKey(message);
    if (fallbackKey && seenFallback.has(fallbackKey)) {
      continue;
    }
    if (fallbackKey) {
      seenFallback.add(fallbackKey);
    }
    const seq = normalizeMessageSeq(message);
    if (fallbackKey.startsWith("id:")) {
      if (Number.isFinite(seq)) {
        seenSeq.add(seq);
      }
      merged.push(message);
      continue;
    }
    if (Number.isFinite(seq)) {
      if (seenSeq.has(seq)) {
        continue;
      }
      seenSeq.add(seq);
    }
    merged.push(message);
  }
  return merged;
}

function buildHistoryPaginationState(sessionKey) {
  return {
    sessionKey,
    hasMore: true,
    nextCursor: "",
    checkedOlder: false,
    loadingOlder: false,
    oldestSeq: null,
    oldestMessageId: "",
    loadedCursors: new Set(),
  };
}

function ensureMemberHistoryPaginationState(app, sessionKey) {
  if (!(app instanceof HTMLElement)) {
    return buildHistoryPaginationState(sessionKey);
  }
  const normalizedSessionKey = String(sessionKey || "")
    .trim()
    .toLowerCase();
  if (!normalizedSessionKey) {
    app.__ocMemberHistoryPagination = buildHistoryPaginationState("");
    return app.__ocMemberHistoryPagination;
  }
  const existing = app.__ocMemberHistoryPagination;
  if (
    existing &&
    typeof existing === "object" &&
    String(existing.sessionKey || "")
      .trim()
      .toLowerCase() === normalizedSessionKey
  ) {
    return existing;
  }
  const nextState = buildHistoryPaginationState(normalizedSessionKey);
  app.__ocMemberHistoryPagination = nextState;
  return nextState;
}

export function updateMemberHistoryPaginationFromMessages(app, sessionKey, messages, patch = {}) {
  const state = ensureMemberHistoryPaginationState(app, sessionKey);
  state.oldestSeq = readFirstLoadedMessageSeq(messages);
  state.oldestMessageId = readFirstLoadedMessageId(messages);
  if (Object.prototype.hasOwnProperty.call(patch, "hasMore")) {
    state.hasMore = patch.hasMore === true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "nextCursor")) {
    state.nextCursor = String(patch.nextCursor || "").trim();
  }
  if (Object.prototype.hasOwnProperty.call(patch, "checkedOlder")) {
    state.checkedOlder = patch.checkedOlder === true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "loadingOlder")) {
    state.loadingOlder = patch.loadingOlder === true;
  }
  return state;
}

function resolveMemberHistoryCursor(state) {
  const normalizedCursor = String(state?.nextCursor || "").trim();
  if (normalizedCursor) {
    return normalizedCursor;
  }
  const oldestMessageId = String(state?.oldestMessageId || "").trim();
  if (oldestMessageId) {
    return `id:${oldestMessageId}`;
  }
  const oldestSeq = Number(state?.oldestSeq);
  if (Number.isFinite(oldestSeq) && oldestSeq > 0) {
    return `seq:${oldestSeq}`;
  }
  return "";
}

function resolveMemberHistoryScrollTarget(app, event = null) {
  const currentTarget = event?.currentTarget;
  if (currentTarget instanceof HTMLElement) {
    return currentTarget;
  }
  if (!(app instanceof HTMLElement)) {
    return null;
  }
  const chatSurface = findChatSurface(app) || findChatSurface(document);
  const threadCandidate =
    chatSurface instanceof HTMLElement ? chatSurface.querySelector(".chat-thread") : null;
  if (threadCandidate instanceof HTMLElement) {
    return threadCandidate;
  }
  return null;
}

async function maybeLoadOlderMemberHistory(controller, event = null, deps = {}) {
  if (!controller?.app || !controller.currentSessionKey) {
    return;
  }
  const scrollTarget = resolveMemberHistoryScrollTarget(controller.app, event);
  if (!(scrollTarget instanceof HTMLElement)) {
    return;
  }
  if (scrollTarget.scrollTop > 24) {
    return;
  }
  const app = controller.app;
  const sessionKey = String(controller.currentSessionKey || "")
    .trim()
    .toLowerCase();
  const state = updateMemberHistoryPaginationFromMessages(
    app,
    sessionKey,
    Array.isArray(app.chatMessages) ? app.chatMessages : [],
  );
  if (state.loadingOlder) {
    return;
  }
  const cursor = resolveMemberHistoryCursor(state);
  if (state.checkedOlder && !state.hasMore) {
    return;
  }
  if (!cursor) {
    state.checkedOlder = true;
    state.hasMore = false;
    return;
  }
  if (state.loadedCursors instanceof Set && state.loadedCursors.has(cursor)) {
    return;
  }
  state.loadingOlder = true;
  const previousHeight = scrollTarget.scrollHeight;
  const previousTop = scrollTarget.scrollTop;
  try {
    const page = await createTenantApiClient().getMemberSessionHistoryPage(sessionKey, {
      limit: 200,
      cursor,
    });
    const activeController = window._ocMemberChatSurfaceController;
    if (!activeController || activeController !== controller) {
      return;
    }
    const activeSessionKey = String(activeController.currentSessionKey || "")
      .trim()
      .toLowerCase();
    if (
      activeSessionKey !== sessionKey ||
      String(app.__ocPinnedSessionKey || "")
        .trim()
        .toLowerCase() !== sessionKey
    ) {
      return;
    }
    const olderMessages = Array.isArray(page?.messages)
      ? page.messages
      : Array.isArray(page?.items)
        ? page.items
        : [];
    const mergedMessages = mergeOlderMemberHistory(
      app.chatMessages,
      olderMessages,
      deps.isAssistantSilentReply,
    );
    app.chatMessages = mergedMessages;
    updateMemberHistoryPaginationFromMessages(app, sessionKey, mergedMessages, {
      hasMore: page?.hasMore === true,
      nextCursor: page?.nextCursor,
      checkedOlder: true,
    });
    const nextState = ensureMemberHistoryPaginationState(app, sessionKey);
    if (nextState.loadedCursors instanceof Set) {
      nextState.loadedCursors.add(cursor);
    }
    app.requestUpdate?.();
    await Promise.resolve();
    const latestScrollTarget = resolveMemberHistoryScrollTarget(app, event);
    if (latestScrollTarget instanceof HTMLElement) {
      const delta = latestScrollTarget.scrollHeight - previousHeight;
      latestScrollTarget.scrollTop = Math.max(0, previousTop + delta);
    }
  } catch {
    // Ignore older-page failures and allow a future retry.
  } finally {
    const activeState = ensureMemberHistoryPaginationState(app, sessionKey);
    activeState.loadingOlder = false;
  }
}

export function bindMemberHistoryPagination(controller, deps = {}) {
  const app = controller?.app;
  if (!(app instanceof HTMLElement) || typeof app.handleChatScroll !== "function") {
    return;
  }
  if (!app.__ocOriginalHandleChatScroll) {
    app.__ocOriginalHandleChatScroll = app.handleChatScroll.bind(app);
  }
  if (app.__ocMemberHistoryHandleChatScrollPatched) {
    return;
  }
  app.handleChatScroll = (event) => {
    app.__ocOriginalHandleChatScroll(event);
    void maybeLoadOlderMemberHistory(window._ocMemberChatSurfaceController, event, deps);
  };
  app.__ocMemberHistoryHandleChatScrollPatched = true;
}

export function unbindMemberHistoryPagination(controller) {
  const app = controller?.app;
  if (!(app instanceof HTMLElement)) {
    return;
  }
  if (
    app.__ocMemberHistoryHandleChatScrollPatched &&
    typeof app.__ocOriginalHandleChatScroll === "function"
  ) {
    app.handleChatScroll = app.__ocOriginalHandleChatScroll;
  }
  delete app.__ocMemberHistoryHandleChatScrollPatched;
}
