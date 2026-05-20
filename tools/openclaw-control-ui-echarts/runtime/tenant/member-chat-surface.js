import {
  applySessionSettings,
  bindMemberHistoryScroll,
  forceChatTab,
  patchClientRequest,
  replaceChatHydrationState,
  requestIdentityReload,
  resolveOpenClawApp,
  setPinnedSession,
} from "../framework/app-compat.js";
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
import {
  listSessions,
  loadChatHistory,
  loadSessionUsageTimeseries,
} from "../framework/rpc-compat.js";
import { createTenantApiClient } from "./api-client.js";
import { consumePendingPromptIntoMemberChat } from "./echarts-view-annotations.js";
import {
  MEMBER_CHAT_CANVAS_ANNOTATION_ROOT_ATTR,
  mountMemberChatCanvasAnnotations,
  unmountMemberChatCanvasAnnotations,
} from "./member-chat-canvas-annotations.js";
import {
  awaitWithTimeout,
  CHAT_FAILSAFE_MESSAGE,
  CHAT_FAILSAFE_TIMEOUT_MS,
  clearChatLoadingFailsafe,
  isTimeoutError,
  scheduleChatLoadingFailsafe,
} from "./member-chat-failsafe.js";
import {
  bindMemberHistoryPagination,
  ensureVisibleCurrentSession,
  findFirstUserMessageTitle,
  shouldSkipSessionHistoryHydration,
  unbindMemberHistoryPagination,
  updateMemberHistoryPaginationFromMessages,
} from "./member-chat-history.js";
import {
  findTargetSessionKey,
  isMemberDraftRouteLocked,
  resolveRouteSessionKey,
  syncRouteForSession,
} from "./member-chat-route-state.js";
import {
  isProvisionalSessionTitle,
  normalizeSessionTitleValue,
} from "./member-chat-session-title.js";
import {
  beginNewMemberDraftSession,
  closeAllDialogs,
  DELETE_DIALOG_ROOT_ATTR,
  renderSidebarSection,
  renderTopAction,
  SECTION_ATTR,
  TOP_ACTION_ATTR,
  TOAST_ROOT_ATTR,
} from "./member-chat-sidebar.js";
import {
  clearMemberDraftRouteLock,
  readMemberDraftRouteLock,
  writeMemberDraftRouteLock,
} from "./member-chat-storage.js";
import { scheduleMemberUsageSync, syncMemberUsageRecords } from "./member-chat-usage-sync.js";
import { bootTenantRouteSync, navigateTenantRoute, onTenantRouteChange } from "./route-sync.js";
import { resetTenantRouteSyncForTests } from "./route-sync.js";
import {
  TENANT_AGENT_SELECTOR_ROUTE,
  createTenantMemberSessionKey,
  hasResolvedSelectedTenantAgent,
  isTenantMemberSessionKey,
  releaseTenantBootLock,
  readSelectedTenantAgent,
  readTenantSession,
  writeSelectedTenantAgent,
} from "./tenant-context.js";

const DOC_ATTR = "data-oc-member-chat-route";
const STYLE_ATTR = "data-oc-member-chat-surface-style";
const TOAST_SELECTOR = "[data-oc-member-chat-toast]";
const SILENT_REPLY_PATTERN = /^\s*NO_REPLY\s*$/;
const MEMBER_SESSION_LIST_TIMEOUT_MS = 6_000;
const MEMBER_SESSION_TITLE_HISTORY_TIMEOUT_MS = 4_000;
const MEMBER_CHAT_HISTORY_TIMEOUT_MS = 6_000;
// Temporarily hide the /chat Canvas entry without deleting the underlying module.
const MEMBER_CHAT_CANVAS_ENTRY_ENABLED = false;
let memberChatSurfaceSyncing = false;
let memberChatSurfaceSyncQueued = false;
let memberChatSurfaceSuppressNextRouteSync = false;
let memberChatRouteCleanup = null;
let memberChatMutationObserver = null;
let memberChatClickHandler = null;
let memberChatKeydownHandler = null;

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

function isLoginViewRoute(href = window.location.href) {
  try {
    const url = new URL(href, document.baseURI);
    return (url.searchParams.get("ocTenantView") || "").trim() === "login";
  } catch {
    return false;
  }
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

function getActiveMemberChatController() {
  return window._ocMemberChatSurfaceController || null;
}

function createRouteSyncRef() {
  return {
    get value() {
      return memberChatSurfaceSuppressNextRouteSync;
    },
    set value(next) {
      memberChatSurfaceSuppressNextRouteSync = next;
    },
  };
}

async function deleteDraftSessionIfNeeded(controller) {
  if (!controller?.hasDraftSession) {
    return;
  }
  void createTenantApiClient()
    .deleteMemberSession({ openclawSessionKey: controller.currentSessionKey })
    .catch(() => {});
  controller.sessions = controller.sessions.filter(
    (row) =>
      String(row?.key || "")
        .trim()
        .toLowerCase() !== controller.currentSessionKey,
  );
  controller.hasDraftSession = false;
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

function createSidebarDeps() {
  return {
    escapeHtml,
    formatRelativeTime,
    pinMemberChatSession,
    routeSyncRef: createRouteSyncRef(),
    showTransientToast,
    actions: {
      beginDraftSession(controller) {
        if (!controller || !controller.selectedAgent?.id || !controller.session) {
          return false;
        }
        if (controller.hasDraftSession) {
          showTransientToast(controller, "已经是新的会话了");
          return true;
        }
        const nextSessionKey = createTenantMemberSessionKey(
          controller.session,
          controller.selectedAgent,
        );
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
          resolveRouteSessionKey(
            controller.sessions,
            nextSessionKey,
            shouldSkipSessionHistoryHydration,
          ),
          createRouteSyncRef(),
          { replace: false },
        );
        pinMemberChatSession(controller.app, nextSessionKey, {
          skipHydrateHistory: shouldSkipSessionHistoryHydration(
            controller.sessions,
            nextSessionKey,
          ),
          sameAgent: true,
        });
        renderSidebarSection(controller, createSidebarDeps());
        return true;
      },
      async selectSession(controller, nextSessionKey) {
        if (controller.hasDraftSession) {
          await deleteDraftSessionIfNeeded(controller);
          clearMemberDraftRouteLockForController(controller, controller.currentSessionKey);
        }

        controller.currentSessionKey = nextSessionKey;
        controller.hasDraftSession = isMemberDraftRouteLocked(
          controller.session,
          controller.selectedAgent,
          nextSessionKey,
        );
        syncRouteForSession(
          controller.selectedAgent,
          resolveRouteSessionKey(
            controller.sessions,
            nextSessionKey,
            shouldSkipSessionHistoryHydration,
          ),
          createRouteSyncRef(),
          { replace: false },
        );
        pinMemberChatSession(controller.app, nextSessionKey, {
          skipHydrateHistory: shouldSkipSessionHistoryHydration(
            controller.sessions,
            nextSessionKey,
          ),
          sameAgent: true,
        });
        renderSidebarSection(controller, createSidebarDeps());
      },
      async deleteSession(controller, nextHiddenKey) {
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
            createTenantMemberSessionKey(
              controller.session,
              controller.selectedAgent,
            ).toLowerCase();
          controller.currentSessionKey = fallbackSessionKey;
          controller.sessions = ensureVisibleCurrentSession(
            controller.sessions,
            fallbackSessionKey,
          );
          controller.hasDraftSession = isMemberDraftRouteLocked(
            controller.session,
            controller.selectedAgent,
            fallbackSessionKey,
          );
          syncRouteForSession(
            controller.selectedAgent,
            resolveRouteSessionKey(
              controller.sessions,
              fallbackSessionKey,
              shouldSkipSessionHistoryHydration,
            ),
            createRouteSyncRef(),
            { replace: true },
          );
          pinMemberChatSession(controller.app, fallbackSessionKey, {
            skipHydrateHistory: shouldSkipSessionHistoryHydration(
              controller.sessions,
              fallbackSessionKey,
            ),
            sameAgent: true,
          });
        }
        renderSidebarSection(controller, createSidebarDeps());
      },
      navigateBack(controller) {
        if (controller?.hasDraftSession) {
          void createTenantApiClient()
            .deleteMemberSession({
              openclawSessionKey: controller.currentSessionKey,
            })
            .catch(() => {});
          clearMemberDraftRouteLockForController(controller);
        }
        navigateTenantRoute(TENANT_AGENT_SELECTOR_ROUTE);
      },
    },
  };
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
          listSessions(app, {}, "member-chat"),
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
            loadChatHistory(
              app,
              {
                sessionKey: key,
                limit: 200,
              },
              "member-chat",
            ),
            MEMBER_SESSION_TITLE_HISTORY_TIMEOUT_MS,
            "gateway.chat.history.title",
          );
          const nextTitle = findFirstUserMessageTitle(
            historyResp?.messages,
            buildSessionTitleFromText,
          );
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
  controller.hasDraftSession = false;
  renderSidebarSection(controller, createSidebarDeps());
  const activeController = getActiveMemberChatController();
  if (activeController?.currentSessionKey === normalizedSessionKey) {
    syncRouteForSession(
      controller.selectedAgent,
      resolveRouteSessionKey(
        controller.sessions,
        normalizedSessionKey,
        shouldSkipSessionHistoryHydration,
      ),
      createRouteSyncRef(),
      { replace: true },
    );
  }
}

function isMemberChatSelfMutation(node) {
  const canvasRootSelector = `[${MEMBER_CHAT_CANVAS_ANNOTATION_ROOT_ATTR}]`;
  return Boolean(
    node.closest?.(
      `[${SECTION_ATTR}], [${TOP_ACTION_ATTR}], [${DELETE_DIALOG_ROOT_ATTR}], [${TOAST_ROOT_ATTR}]`,
    ) ||
    node.closest?.(canvasRootSelector) ||
    node.querySelector?.(canvasRootSelector),
  );
}

function isMemberChatShellAnchor(node) {
  return Boolean(
    (node instanceof Element && findOpenClawApp(node) === node) ||
    findSidebar(node) === node ||
    findBreadcrumb(node) === node,
  );
}

function subtreeContainsMemberChatShellAnchor(node) {
  if (!(node instanceof Element) || isMemberChatSelfMutation(node)) {
    return false;
  }
  return Boolean(findOpenClawApp(node) || findSidebar(node) || findBreadcrumb(node));
}

function pinMemberChatSession(app, sessionKey, options = {}) {
  if (!(app instanceof HTMLElement) || !sessionKey) {
    return;
  }
  const skipHydrateHistory = options.skipHydrateHistory === true;
  const previousResolvedSessionKey = String(app.sessionKey || "")
    .trim()
    .toLowerCase();

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
  setPinnedSession(app, sessionKey, "member-chat");
  forceChatTab(app, "member-chat");

  patchClientRequest(
    app,
    "member-chat",
    async (originalRequest, method, params) => {
      const activeSessionKey =
        method === "chat.send"
          ? String(
              getActiveMemberChatController()?.currentSessionKey ||
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
          showTransientToast(getActiveMemberChatController(), "积分不足请联系管理员。", "danger");
          return { ok: false, error: "insufficient_balance" };
        }
      }
      const result = await originalRequest(method, params);
      if (method === "chat.send") {
        scheduleChatLoadingFailsafe(app, activeSessionKey, {
          showTimeoutToast(message) {
            showTransientToast(getActiveMemberChatController(), message, "danger");
          },
        });
        const activeController = getActiveMemberChatController();
        if (activeController?.currentSessionKey) {
          void ensureMemberSessionTitle(
            activeController,
            activeController.currentSessionKey,
            params?.message,
          );
          scheduleMemberUsageSync(activeController, activeController.currentSessionKey);
        }
        setTimeout(() => {
          void syncMemberChatSurface();
        }, 1200);
      }
      return result;
    },
    "member-chat",
  );

  const shouldHydrateHistory =
    app.sessionKey !== sessionKey ||
    (app.__ocPinnedSessionHydratedKey !== sessionKey &&
      app.__ocPinnedSessionHydratingKey !== sessionKey);

  if (shouldHydrateHistory) {
    // Reset session-scoped view state before rehydrating persisted history.
    replaceChatHydrationState(
      app,
      {
        chatMessages: [],
        chatQueue: [],
        chatThinkingLevel: null,
        chatRunId: null,
        chatStreamStartedAt: null,
        chatStream: null,
        lastError: null,
        requestUpdate: false,
      },
      "member-chat",
    );

    if (app.sessionKey !== sessionKey) {
      applySessionSettings(app, sessionKey, "member-chat");
    }

    if (previousResolvedSessionKey !== normalizedSessionKey && !options.sameAgent) {
      requestIdentityReload(app, "member-chat");
    }

    if (skipHydrateHistory) {
      updateMemberHistoryPaginationFromMessages(app, sessionKey, [], {
        hasMore: false,
        nextCursor: "",
        checkedOlder: true,
        loadingOlder: false,
      });
      app.__ocPinnedSessionHydratingKey = "";
      app.__ocPinnedSessionHydratedKey = sessionKey;
      replaceChatHydrationState(app, { chatLoading: false }, "member-chat");
      clearChatLoadingFailsafe(app);
      return;
    }

    replaceChatHydrationState(app, { chatLoading: true }, "member-chat");
    app.__ocPinnedSessionHydratingKey = sessionKey;

    // Load chat history for the pinned session directly via the client.
    const targetKey = sessionKey;
    awaitWithTimeout(
      loadChatHistory(app, { sessionKey: targetKey, limit: 200 }, "member-chat"),
      MEMBER_CHAT_HISTORY_TIMEOUT_MS,
      "gateway.chat.history.bootstrap",
    )
      .then((res) => {
        if (app.__ocPinnedSessionHydratingKey === targetKey) {
          app.__ocPinnedSessionHydratingKey = "";
        }
        if (app.__ocPinnedSessionKey === targetKey) {
          const msgs = Array.isArray(res?.messages) ? res.messages : [];
          const nextMessages = msgs.filter((message) => !isAssistantSilentReply(message));
          replaceChatHydrationState(
            app,
            {
              chatMessages: nextMessages,
              chatThinkingLevel: res?.thinkingLevel ?? null,
              chatRunId: null,
              chatStream: null,
              chatStreamStartedAt: null,
              chatLoading: false,
              resetChatScroll: typeof app.resetChatScroll === "function",
            },
            "member-chat",
          );
          updateMemberHistoryPaginationFromMessages(app, targetKey, app.chatMessages, {
            hasMore: true,
            nextCursor: "",
            checkedOlder: false,
            loadingOlder: false,
          });
          clearChatLoadingFailsafe(app);
          app.__ocPinnedSessionHydratedKey = targetKey;
          app.requestUpdate?.();
          const activeController = getActiveMemberChatController();
          if (activeController?.currentSessionKey === targetKey) {
            void syncMemberUsageRecords(activeController, targetKey, msgs);
          }
        }
      })
      .catch(() => {
        if (app.__ocPinnedSessionHydratingKey === targetKey) {
          app.__ocPinnedSessionHydratingKey = "";
        }
        if (app.__ocPinnedSessionKey === targetKey) {
          replaceChatHydrationState(
            app,
            {
              chatMessages: [],
              chatThinkingLevel: null,
              chatLoading: false,
            },
            "member-chat",
          );
          updateMemberHistoryPaginationFromMessages(app, targetKey, [], {
            hasMore: false,
            nextCursor: "",
            checkedOlder: false,
            loadingOlder: false,
          });
          app.__ocPinnedSessionHydratedKey = "";
          clearChatLoadingFailsafe(app);
        }
      });
  }
}

function resolveMemberChatShell() {
  const app = resolveOpenClawApp(document, "member-chat");
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
  const tenantAgentId = String(selectedAgent?.id || "").trim();
  if (!tenantAgentId || session?.session?.role !== "member") {
    return selectedAgent;
  }
  const routeSessionKey = new URL(href, document.baseURI).searchParams.get("session")?.trim() || "";
  const shouldRefreshSelectedAgent =
    !hasResolvedSelectedTenantAgent(selectedAgent) ||
    (routeSessionKey && !isTenantMemberSessionKey(routeSessionKey, session, selectedAgent));
  if (!shouldRefreshSelectedAgent) {
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
    const loginViewRoute = isLoginViewRoute();
    if (!isMemberChatRoute() || loginViewRoute) {
      unbindMemberHistoryPagination(window._ocMemberChatSurfaceController);
      const app = resolveOpenClawApp(document, "member-chat");
      if (app instanceof HTMLElement) {
        clearChatLoadingFailsafe(app);
        if (loginViewRoute) {
          replaceChatHydrationState(
            app,
            {
              chatMessages: [],
              chatQueue: [],
              chatLoading: false,
              chatRunId: null,
              chatStream: null,
              chatStreamStartedAt: null,
              lastError: null,
              chatToolMessages: [],
              chatStreamSegments: [],
              resetChatScroll: true,
            },
            "member-chat",
          );
          app.sessionKey = "";
          app.chatSending = false;
          app.__ocPinnedSessionKey = "";
        }
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
      unmountMemberChatCanvasAnnotations();
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

    const existingCtrl = getActiveMemberChatController();
    if (
      existingCtrl &&
      existingCtrl.selectedAgent?.id === selectedAgent?.id &&
      existingCtrl.currentSessionKey &&
      !existingCtrl.hasDraftSession &&
      existingCtrl.currentSessionKey === String(app.__ocPinnedSessionKey || "").trim().toLowerCase() &&
      (app.__ocPinnedSessionHydratedKey === existingCtrl.currentSessionKey ||
        app.__ocPinnedSessionHydratingKey === existingCtrl.currentSessionKey)
    ) {
      existingCtrl.app = app;
      existingCtrl.sidebar = sidebar;
      existingCtrl.breadcrumb = breadcrumb;
      releaseTenantBootLock("member-chat-surface-ready");
      return;
    }

    const sessionsFromGateway = await loadMemberSessions(app, selectedAgent, session);
    const currentSessionKey = findTargetSessionKey(
      app,
      selectedAgent,
      session,
      window.location.href,
      sessionsFromGateway,
      {
        controller: getActiveMemberChatController(),
      },
    );

    unbindMemberHistoryPagination(getActiveMemberChatController());
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

    const sidebarDeps = createSidebarDeps();

    renderSidebarSection(controller, sidebarDeps);
    renderTopAction(controller, sidebarDeps);
    syncRouteForSession(
      selectedAgent,
      resolveRouteSessionKey(
        controller.sessions,
        currentSessionKey,
        shouldSkipSessionHistoryHydration,
      ),
      createRouteSyncRef(),
      { replace: true },
    );
    const prevController = getActiveMemberChatController();
    const isSameAgent = prevController?.selectedAgent?.id === selectedAgent?.id;
    pinMemberChatSession(app, currentSessionKey, {
      skipHydrateHistory: shouldSkipSessionHistoryHydration(controller.sessions, currentSessionKey),
      sameAgent: isSameAgent,
    });
    releaseTenantBootLock("member-chat-surface-ready");
    window._ocMemberChatSurfaceController = controller;
    bindMemberHistoryPagination(controller, {
      getActiveController: getActiveMemberChatController,
      isAssistantSilentReply,
    });
    if (MEMBER_CHAT_CANVAS_ENTRY_ENABLED) {
      mountMemberChatCanvasAnnotations(controller, createTenantApiClient());
    } else {
      unmountMemberChatCanvasAnnotations();
    }
    consumePendingPromptIntoMemberChat(document);
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
      showTransientToast(getActiveMemberChatController(), "积分不足请联系管理员。", "danger");
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
      const ctrl = getActiveMemberChatController();
      const newSessionBtn = findClosestNewSessionButton(target);
      if (newSessionBtn && beginNewMemberDraftSession(ctrl, createSidebarDeps())) {
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
        if (isMemberChatShellAnchor(node)) {
          void syncMemberChatSurface();
          return;
        }
        if (subtreeContainsMemberChatShellAnchor(node)) {
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
  unbindMemberHistoryPagination(getActiveMemberChatController());
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
  unmountMemberChatCanvasAnnotations();
  delete window._ocMemberChatSurfaceController;
  delete window.__openclawMemberChatSurfaceBooted;
  resetTenantRouteSyncForTests();
}
