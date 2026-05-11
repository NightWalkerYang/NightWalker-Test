import { findClosestOpenClawApp, findOpenClawApp } from "./dom-compat.js";

export const APP_COMPAT_CONTRACT_VERSION = "app-compat-v1";
const COMPAT_LOG_PREFIX = "[oc.app-compat]";

const PATCH_KEYS = {
  forceChatTab: "__ocAppCompatForceChatTab",
  applySessionSettings: "__ocAppCompatApplySessionSettings",
  memberHistoryScroll: "__ocAppCompatMemberHistoryScroll",
  requestPatch: "__ocAppCompatRequestPatch",
};

function safeWarn(sourceTag, message, details = null) {
  if (details) {
    console.warn(`${COMPAT_LOG_PREFIX} ${sourceTag}: ${message}`, details);
    return;
  }
  console.warn(`${COMPAT_LOG_PREFIX} ${sourceTag}: ${message}`);
}

function ensurePatchBucket(app) {
  if (!(app instanceof HTMLElement)) {
    return null;
  }
  if (!app.__ocAppCompatPatches || typeof app.__ocAppCompatPatches !== "object") {
    app.__ocAppCompatPatches = {};
  }
  return app.__ocAppCompatPatches;
}

function rememberOriginal(app, key, fieldName, original) {
  const bucket = ensurePatchBucket(app);
  if (!bucket) {
    return;
  }
  if (!bucket[key]) {
    bucket[key] = { [fieldName]: original };
    return;
  }
  if (!(fieldName in bucket[key])) {
    bucket[key][fieldName] = original;
  }
}

function readOriginal(app, key, fieldName) {
  return app?.__ocAppCompatPatches?.[key]?.[fieldName];
}

function clearPatchBucket(app, key) {
  if (app?.__ocAppCompatPatches && typeof app.__ocAppCompatPatches === "object") {
    delete app.__ocAppCompatPatches[key];
  }
}

export function resolveOpenClawApp(root = document, sourceTag = "app") {
  try {
    if (root instanceof HTMLElement && root.tagName.toLowerCase() === "openclaw-app") {
      return root;
    }
    const closest = findClosestOpenClawApp(root);
    if (closest instanceof HTMLElement) {
      return closest;
    }
    return findOpenClawApp(root);
  } catch (error) {
    safeWarn(sourceTag, "resolveOpenClawApp_failed", error);
    return null;
  }
}

export function getChatState(app, sourceTag = "app") {
  if (!(app instanceof HTMLElement)) {
    safeWarn(sourceTag, "getChatState_missing_app");
    return null;
  }
  return {
    sessionKey: String(app.sessionKey || "").trim(),
    pinnedSessionKey: String(app.__ocPinnedSessionKey || "").trim(),
    chatMessages: Array.isArray(app.chatMessages) ? app.chatMessages : [],
    chatQueue: Array.isArray(app.chatQueue) ? app.chatQueue : [],
    chatLoading: app.chatLoading === true,
    chatSending: app.chatSending === true,
    chatRunId: app.chatRunId ?? null,
    chatStream: app.chatStream ?? null,
    chatStreamStartedAt: app.chatStreamStartedAt ?? null,
    lastError: app.lastError ?? null,
    thinkingLevel: app.chatThinkingLevel ?? null,
    toolMessages: Array.isArray(app.chatToolMessages) ? app.chatToolMessages : [],
    streamSegments: Array.isArray(app.chatStreamSegments) ? app.chatStreamSegments : [],
    settings: app.settings && typeof app.settings === "object" ? app.settings : {},
    tab: String(app.tab || ""),
  };
}

export function setPinnedSession(app, sessionKey, sourceTag = "app") {
  if (!(app instanceof HTMLElement)) {
    safeWarn(sourceTag, "setPinnedSession_missing_app");
    return false;
  }
  const normalized = String(sessionKey || "").trim();
  if (!normalized) {
    safeWarn(sourceTag, "setPinnedSession_missing_sessionKey");
    return false;
  }
  app.__ocPinnedSessionKey = normalized;
  return true;
}

export function replaceChatHydrationState(app, payload = {}, sourceTag = "app") {
  if (!(app instanceof HTMLElement)) {
    safeWarn(sourceTag, "replaceChatHydrationState_missing_app");
    return false;
  }
  if ("sessionKey" in payload && String(payload.sessionKey || "").trim()) {
    app.sessionKey = String(payload.sessionKey).trim();
  }
  if ("chatMessages" in payload) {
    app.chatMessages = Array.isArray(payload.chatMessages) ? payload.chatMessages : [];
  }
  if ("chatQueue" in payload) {
    app.chatQueue = Array.isArray(payload.chatQueue) ? payload.chatQueue : [];
  }
  if ("chatLoading" in payload) {
    app.chatLoading = payload.chatLoading === true;
  }
  if ("chatRunId" in payload) {
    app.chatRunId = payload.chatRunId ?? null;
  }
  if ("chatStream" in payload) {
    app.chatStream = payload.chatStream ?? null;
  }
  if ("chatStreamStartedAt" in payload) {
    app.chatStreamStartedAt = payload.chatStreamStartedAt ?? null;
  }
  if ("chatThinkingLevel" in payload) {
    app.chatThinkingLevel = payload.chatThinkingLevel ?? null;
  }
  if ("lastError" in payload) {
    app.lastError = payload.lastError ?? null;
  }
  if ("chatToolMessages" in payload) {
    app.chatToolMessages = Array.isArray(payload.chatToolMessages) ? payload.chatToolMessages : [];
  }
  if ("chatStreamSegments" in payload) {
    app.chatStreamSegments = Array.isArray(payload.chatStreamSegments)
      ? payload.chatStreamSegments
      : [];
  }
  if (typeof payload.resetToolStream === "function") {
    payload.resetToolStream();
  } else if (payload.resetToolStream !== false && typeof app.resetToolStream === "function") {
    app.resetToolStream();
  }
  if (payload.resetChatScroll === true && typeof app.resetChatScroll === "function") {
    app.resetChatScroll();
  }
  if (payload.requestUpdate !== false && typeof app.requestUpdate === "function") {
    app.requestUpdate();
  }
  return true;
}

export function bindMemberHistoryScroll(app, handler, sourceTag = "app") {
  if (!(app instanceof HTMLElement) || typeof handler !== "function") {
    safeWarn(sourceTag, "bindMemberHistoryScroll_invalid_args");
    return false;
  }
  if (typeof app.handleChatScroll !== "function") {
    safeWarn(sourceTag, "bindMemberHistoryScroll_missing_handleChatScroll");
    return false;
  }
  if (app.__ocAppCompatMemberHistoryScrollBound) {
    return true;
  }
  rememberOriginal(app, PATCH_KEYS.memberHistoryScroll, "handleChatScroll", app.handleChatScroll);
  const original = app.handleChatScroll.bind(app);
  app.handleChatScroll = (event) => {
    original(event);
    handler(event);
  };
  app.__ocAppCompatMemberHistoryScrollBound = true;
  return true;
}

export function forceChatTab(app, sourceTag = "app") {
  if (!(app instanceof HTMLElement)) {
    safeWarn(sourceTag, "forceChatTab_missing_app");
    return false;
  }
  if (typeof app.setTab === "function") {
    if (!app.__ocAppCompatForceChatTabBound) {
      rememberOriginal(app, PATCH_KEYS.forceChatTab, "setTab", app.setTab.bind(app));
      const original = app.setTab.bind(app);
      app.setTab = () => original("chat");
      app.__ocAppCompatForceChatTabBound = true;
    }
    if (app.tab !== "chat") {
      app.setTab("chat");
    }
  }
  return true;
}

export function applySessionSettings(app, sessionKey, sourceTag = "app") {
  if (!(app instanceof HTMLElement)) {
    safeWarn(sourceTag, "applySessionSettings_missing_app");
    return false;
  }
  const normalized = String(sessionKey || app.__ocPinnedSessionKey || "").trim();
  if (!normalized) {
    safeWarn(sourceTag, "applySessionSettings_missing_sessionKey");
    return false;
  }
  setPinnedSession(app, normalized, sourceTag);
  if (typeof app.applySettings === "function") {
    if (!app.__ocAppCompatApplySessionSettingsBound) {
      rememberOriginal(
        app,
        PATCH_KEYS.applySessionSettings,
        "applySettings",
        app.applySettings.bind(app),
      );
      const original = app.applySettings.bind(app);
      app.applySettings = (next) =>
        original({
          ...next,
          sessionKey: app.__ocPinnedSessionKey,
          lastActiveSessionKey: app.__ocPinnedSessionKey,
        });
      app.__ocAppCompatApplySessionSettingsBound = true;
    }
    if (app.settings && typeof app.settings === "object") {
      app.applySettings({
        ...app.settings,
        sessionKey: normalized,
        lastActiveSessionKey: normalized,
      });
    }
  }
  app.sessionKey = normalized;
  return true;
}

export function patchClientRequest(app, patchKind, patcher, sourceTag = "app") {
  if (!(app instanceof HTMLElement) || typeof patcher !== "function") {
    safeWarn(sourceTag, "patchClientRequest_invalid_args");
    return false;
  }
  if (!app.client || typeof app.client.request !== "function") {
    safeWarn(sourceTag, "patchClientRequest_missing_client");
    return false;
  }
  const key = `${PATCH_KEYS.requestPatch}:${String(patchKind || "default")}`;
  const currentClient = app.client;
  if (app.__ocAppCompatPatchedClientMap?.[key] === currentClient) {
    return true;
  }
  if (!app.__ocAppCompatPatchedClientMap || typeof app.__ocAppCompatPatchedClientMap !== "object") {
    app.__ocAppCompatPatchedClientMap = {};
  }
  rememberOriginal(app, key, "client", currentClient);
  rememberOriginal(app, key, "request", currentClient.request.bind(currentClient));
  const originalRequest = currentClient.request.bind(currentClient);
  const wrappedRequest = async (method, params) => patcher(originalRequest, method, params);
  if (
    currentClient.request &&
    typeof currentClient.request === "function" &&
    "mock" in currentClient.request
  ) {
    wrappedRequest.mock = currentClient.request.mock;
  }
  currentClient.request = wrappedRequest;
  app.__ocAppCompatPatchedClientMap[key] = currentClient;
  return true;
}

export function restorePatchedApp(app, patchKind, sourceTag = "app") {
  if (!(app instanceof HTMLElement)) {
    safeWarn(sourceTag, "restorePatchedApp_missing_app");
    return false;
  }
  const normalized = String(patchKind || "").trim();
  if (!normalized) {
    const setTabOriginal = readOriginal(app, PATCH_KEYS.forceChatTab, "setTab");
    if (typeof setTabOriginal === "function") {
      app.setTab = setTabOriginal;
      delete app.__ocAppCompatForceChatTabBound;
      clearPatchBucket(app, PATCH_KEYS.forceChatTab);
    }
    const applySettingsOriginal = readOriginal(
      app,
      PATCH_KEYS.applySessionSettings,
      "applySettings",
    );
    if (typeof applySettingsOriginal === "function") {
      app.applySettings = applySettingsOriginal;
      delete app.__ocAppCompatApplySessionSettingsBound;
      clearPatchBucket(app, PATCH_KEYS.applySessionSettings);
    }
    const scrollOriginal = readOriginal(app, PATCH_KEYS.memberHistoryScroll, "handleChatScroll");
    if (typeof scrollOriginal === "function") {
      app.handleChatScroll = scrollOriginal;
      delete app.__ocAppCompatMemberHistoryScrollBound;
      clearPatchBucket(app, PATCH_KEYS.memberHistoryScroll);
    }
    return true;
  }
  const key = `${PATCH_KEYS.requestPatch}:${normalized}`;
  const client = readOriginal(app, key, "client");
  const request = readOriginal(app, key, "request");
  if (client && typeof request === "function") {
    client.request = request;
  }
  if (app.__ocAppCompatPatchedClientMap && typeof app.__ocAppCompatPatchedClientMap === "object") {
    delete app.__ocAppCompatPatchedClientMap[key];
  }
  clearPatchBucket(app, key);
  return true;
}

export function requestIdentityReload(app, sourceTag = "app") {
  if (!(app instanceof HTMLElement)) {
    safeWarn(sourceTag, "requestIdentityReload_missing_app");
    return false;
  }
  if (typeof app.loadAssistantIdentity === "function") {
    void app.loadAssistantIdentity();
  }
  return true;
}

export function requestRender(app, sourceTag = "app") {
  if (!(app instanceof HTMLElement)) {
    safeWarn(sourceTag, "requestRender_missing_app");
    return false;
  }
  if (typeof app.requestUpdate === "function") {
    app.requestUpdate();
  }
  return true;
}
