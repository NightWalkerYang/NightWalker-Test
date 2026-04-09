import {
  TENANT_AGENT_SELECTOR_ROUTE,
  buildTenantMemberChatRoute,
  buildTenantMemberLegacySessionKey,
  createTenantMemberSessionKey,
  isTenantMemberSessionKey,
  readSelectedTenantAgent,
  readTenantSession,
} from "./tenant-context.js";
import { createTenantApiClient } from "./api-client.js";
import {
  bootTenantRouteSync,
  navigateTenantRoute,
  onTenantRouteChange,
} from "./route-sync.js";

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
const APP_SELECTOR = "openclaw-app";
const SIDEBAR_SELECTOR = ".sidebar-nav";
const BREADCRUMB_SELECTOR = ".dashboard-header__breadcrumb";
const SECTION_CLASS = "nav-section oc-member-chat-section";

function isMemberChatRoute(pathname = window.location.pathname, href = window.location.href) {
  const normalizedPath = String(pathname || "/").trim() || "/";
  if (normalizedPath !== "/chat") {
    return false;
  }
  const session = readTenantSession();
  if (session?.session?.role !== "member") {
    return false;
  }
  const selectedAgent = readSelectedTenantAgent(href);
  return Boolean(selectedAgent?.id && selectedAgent?.agentId);
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

function showTransientToast(controller, message) {
  let root = document.body.querySelector(`[${TOAST_ROOT_ATTR}]`);
  if (!(root instanceof HTMLElement)) {
    root = document.createElement("div");
    root.className = "oc-member-chat-toast-root";
    root.setAttribute(TOAST_ROOT_ATTR, "true");
    document.body.append(root);
  }
  root.innerHTML = `<div class="callout info oc-member-chat-toast" data-oc-member-chat-toast>${escapeHtml(message)}</div>`;
  if (controller.toastTimer) {
    window.clearTimeout(controller.toastTimer);
  }
  controller.toastTimer = window.setTimeout(() => {
    root.querySelector(TOAST_SELECTOR)?.remove();
    controller.toastTimer = 0;
  }, 1000);
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
  const normalizedCurrent = String(currentSessionKey || "").trim().toLowerCase();
  if (!normalizedCurrent) {
    return sessions;
  }
  if (sessions.some((row) => String(row?.key || "").trim().toLowerCase() === normalizedCurrent)) {
    return sessions;
  }
  return [{ key: normalizedCurrent, label: "新会话", updatedAt: Date.now() }, ...sessions];
}

function findTargetSessionKey(selectedAgent, session, href, sessions) {
  const url = new URL(href, document.baseURI);
  const fromQuery = url.searchParams.get("session")?.trim() || "";
  if (fromQuery && isTenantMemberSessionKey(fromQuery, session, selectedAgent)) {
    return fromQuery.toLowerCase();
  }
  const latest = sessions[0]?.key?.trim();
  if (latest && isTenantMemberSessionKey(latest, session, selectedAgent)) {
    return latest.toLowerCase();
  }
  const legacy = buildTenantMemberLegacySessionKey(selectedAgent);
  if (legacy) {
    const legacyRow = sessions.find((row) => String(row.key || "").trim().toLowerCase() === legacy);
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
    registeredSessions = await apiClient.listMemberSessions(selectedAgent.id);
  } catch (error) {
    console.error("Failed to list member sessions from platform", error);
  }
  const registeredMap = new Map(
    registeredSessions.map((r) => [String(r.openclawSessionKey).trim().toLowerCase(), r])
  );

  const rows = normalizeSessionRows(await app.client.request("sessions.list", {}));
  const filteredFromGateway = rows.filter((row) => isTenantMemberSessionKey(row.key, session, selectedAgent));
  const result = [];

  const keysToPreview = [];
  for (const gatewayRow of filteredFromGateway) {
    const key = String(gatewayRow.key).trim().toLowerCase();
    const dbRow = registeredMap.get(key);
    if (!dbRow || dbRow.title === "新会话") {
      keysToPreview.push(key);
    }
  }

  const previewMap = new Map();
  if (keysToPreview.length > 0) {
    try {
      const previewResp = await app.client.request("sessions.preview", { keys: keysToPreview, limit: 20 });
      if (previewResp?.previews) {
        for (const preview of previewResp.previews) {
          if (preview.items && preview.items.length > 0) {
            const userMsg = preview.items.find((item) => item.role === "user");
            if (userMsg && userMsg.content) {
              let text = String(userMsg.content).trim();
              if (text.length > 20) text = text.slice(0, 20) + "...";
              previewMap.set(String(preview.key).trim().toLowerCase(), text);
            }
          }
        }
      }
    } catch(err) {
      console.warn("Failed to fetch session previews", err);
    }
  }

  for (const gatewayRow of filteredFromGateway) {
    const key = String(gatewayRow.key).trim().toLowerCase();
    const dbRow = registeredMap.get(key);

    if (dbRow && dbRow.hiddenAt) {
      continue;
    }

    let nextTitle = gatewayRow.title || "新会话";
    if (previewMap.has(key)) {
       nextTitle = previewMap.get(key);
    } else if (dbRow && dbRow.title !== "新会话") {
       nextTitle = dbRow.title;
    }

    if (!dbRow || (dbRow.title === "新会话" && nextTitle !== "新会话")) {
      try {
        await apiClient.registerMemberSession({
          tenantAgentId: selectedAgent.id,
          openclawSessionKey: key,
          title: nextTitle,
        });
        if (dbRow) dbRow.title = nextTitle;
      } catch (err) {}
    }

    result.push({
       ...gatewayRow,
       title: nextTitle,
       label: nextTitle !== "新会话" ? nextTitle : gatewayRow.label
    });
  }

  for (const dbRow of registeredSessions) {
    const key = String(dbRow.openclawSessionKey).trim().toLowerCase();
    if (dbRow.hiddenAt) continue;
    if (!result.some((r) => String(r.key).toLowerCase() === key)) {
      result.push({
        key: dbRow.openclawSessionKey,
        label: dbRow.title || "新会话",
        updatedAt: new Date(dbRow.updatedAt).getTime(),
      });
    }
  }

  return result.toSorted((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
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
  const firstNativeSection = sidebar.querySelector(":scope > .nav-section:not(.oc-platform-management-section)");
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
  } catch (error) {
    showTransientToast(controller, "删除会话失败");
    return;
  }
  controller.sessions = controller.sessions.filter(
    (row) => String(row?.key || "").trim().toLowerCase() !== nextHiddenKey,
  );
  if (controller.currentSessionKey === nextHiddenKey) {
    const fallbackSessionKey =
      controller.sessions[0]?.key?.trim().toLowerCase() ||
      createTenantMemberSessionKey(controller.session, controller.selectedAgent).toLowerCase();
    controller.currentSessionKey = fallbackSessionKey;
    controller.sessions = ensureVisibleCurrentSession(controller.sessions, fallbackSessionKey);
    controller.hasDraftSession = !controller.sessionsFromGateway.some(
      (row) => String(row?.key || "").trim().toLowerCase() === fallbackSessionKey,
    );
    syncRouteForSession(controller.selectedAgent, fallbackSessionKey, { replace: true });
    pinMemberChatSession(controller.app, fallbackSessionKey);
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
  if (root.dataset.ocMemberChatHandlers !== "true") {
    root.dataset.ocMemberChatHandlers = "true";
    root.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (target.closest(DELETE_DIALOG_CLOSE_SELECTOR)) {
        event.preventDefault();
        controller.pendingDeleteSessionKey = "";
        closeDialog(root.querySelector(DELETE_DIALOG_SELECTOR));
        return;
      }
      if (!target.closest(DELETE_DIALOG_CONFIRM_SELECTOR)) {
        return;
      }
      event.preventDefault();
      const nextHiddenKey = String(controller.pendingDeleteSessionKey || "").trim().toLowerCase();
      controller.pendingDeleteSessionKey = "";
      closeDialog(root.querySelector(DELETE_DIALOG_SELECTOR));
      if (!nextHiddenKey) {
        return;
      }
      applyHiddenDelete(controller, nextHiddenKey);
    });
  }
  return root.querySelector(DELETE_DIALOG_SELECTOR);
}

function closeAllDialogs() {
  for (const dialog of document.querySelectorAll("dialog[open]")) {
    if (dialog instanceof HTMLDialogElement) {
      dialog.close();
    }
  }
}

function pinMemberChatSession(app, sessionKey) {
  if (!(app instanceof HTMLElement) || !sessionKey) {
    return;
  }
  if (!app.__openclawTenantMemberPatched) {
    if (typeof app.setTab === "function") {
      const originalSetTab = app.setTab.bind(app);
      app.setTab = () => originalSetTab("chat");
    }
    if (typeof app.applySettings === "function") {
      const originalApplySettings = app.applySettings.bind(app);
      app.applySettings = (next) =>
        originalApplySettings({
          ...next,
          sessionKey,
          lastActiveSessionKey: sessionKey,
        });
    }
    app.__openclawTenantMemberPatched = true;
  }
  if (typeof app.setTab === "function" && app.tab !== "chat") {
    app.setTab("chat");
  }
  if (app.sessionKey !== sessionKey) {
    app.chatMessages = [];
    app.chatThinkingLevel = null;
    app.sessionKey = sessionKey;
    if (typeof app.applySettings === "function" && app.settings) {
      app.applySettings({
        ...app.settings,
        sessionKey,
        lastActiveSessionKey: sessionKey,
      });
    }
    if (typeof app.loadAssistantIdentity === "function") {
      void app.loadAssistantIdentity();
    }
  }

  if (!app.__openclawClientPatched && app.client && typeof app.client.request === "function") {
    const originalRequest = app.client.request.bind(app.client);
    app.client.request = async (method, params) => {
      const result = await originalRequest(method, params);
      if (method === "chat.send") {
        setTimeout(() => {
          if (typeof window.syncMemberChatSurface === "function") {
             window.syncMemberChatSurface();
          } else {
             void syncMemberChatSurface();
          }
        }, 1000);
      }
      return result;
    };
    app.__openclawClientPatched = true;
  }
}

function syncRouteForSession(selectedAgent, sessionKey, { replace = true } = {}) {
  const current = new URL(window.location.href);
  const target = buildTenantMemberChatRoute(selectedAgent.id, sessionKey);
  const targetUrl = new URL(target, document.baseURI);
  if (current.href !== targetUrl.href) {
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
      if (ctrl.hasDraftSession) {
        showTransientToast(ctrl, "已经是新的会话了");
        return;
      }
      const nextSessionKey = createTenantMemberSessionKey(ctrl.session, ctrl.selectedAgent);
      
      createTenantApiClient().registerMemberSession({
        tenantAgentId: ctrl.selectedAgent.id,
        openclawSessionKey: nextSessionKey,
        title: "新会话"
      }).catch(() => {});

      ctrl.currentSessionKey = nextSessionKey;
      ctrl.sessions = ensureVisibleCurrentSession(ctrl.sessions, nextSessionKey);
      ctrl.hasDraftSession = true;
      syncRouteForSession(ctrl.selectedAgent, nextSessionKey, { replace: false });
      pinMemberChatSession(ctrl.app, nextSessionKey);
      renderSidebarSection(ctrl);
      return;
    }
    const sessionButton = target.closest("[data-member-chat-session]");
    if (sessionButton instanceof HTMLElement) {
      event.preventDefault();
      const nextSessionKey = String(sessionButton.dataset.memberChatSession || "").trim().toLowerCase();
      if (!nextSessionKey || nextSessionKey === ctrl.currentSessionKey) {
        return;
      }
      
      if (ctrl.hasDraftSession) {
        try {
          createTenantApiClient().deleteMemberSession({ openclawSessionKey: ctrl.currentSessionKey });
        } catch (e) {}
        ctrl.sessions = ctrl.sessions.filter(
          (row) => String(row?.key || "").trim().toLowerCase() !== ctrl.currentSessionKey
        );
        ctrl.hasDraftSession = false;
      }
      
      ctrl.currentSessionKey = nextSessionKey;
      ctrl.hasDraftSession = !ctrl.sessionsFromGateway.some(
        (row) => String(row?.key || "").trim().toLowerCase() === nextSessionKey,
      );
      syncRouteForSession(ctrl.selectedAgent, nextSessionKey, { replace: false });
      pinMemberChatSession(ctrl.app, nextSessionKey);
      renderSidebarSection(ctrl);
      return;
    }
    const deleteButton = target.closest(`[${DELETE_ATTR}]`);
    if (deleteButton instanceof HTMLElement) {
      event.preventDefault();
      event.stopPropagation();
      const nextHiddenKey = String(deleteButton.getAttribute(DELETE_ATTR) || "").trim().toLowerCase();
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
      try {
        createTenantApiClient().deleteMemberSession({ openclawSessionKey: window._ocMemberChatSurfaceController.currentSessionKey });
      } catch (e) {}
    }
    navigateTenantRoute(TENANT_AGENT_SELECTOR_ROUTE);
  });
}

function renderSidebarSection(controller) {
  const section = ensureSection(controller.sidebar);
  section.innerHTML = buildSidebarMarkup(controller.sessions, controller.currentSessionKey);
  section.setAttribute(ACTIVE_SESSION_ATTR, controller.currentSessionKey);
  section.setAttribute(LABEL_ATTR, controller.selectedAgent?.agentName || "");
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

async function syncMemberChatSurface() {
  if (!isMemberChatRoute()) {
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

  const app = document.querySelector(APP_SELECTOR);
  const sidebar = document.querySelector(SIDEBAR_SELECTOR);
  const breadcrumb = document.querySelector(BREADCRUMB_SELECTOR);
  const session = readTenantSession();
  const selectedAgent = readSelectedTenantAgent();
  if (
    !(app instanceof HTMLElement) ||
    !(sidebar instanceof HTMLElement) ||
    !session ||
    !selectedAgent?.id
  ) {
    return;
  }
  if (!app.client || !app.connected) {
    return;
  }

  const sessionsFromGateway = await loadMemberSessions(app, selectedAgent, session);
  const currentSessionKey = findTargetSessionKey(
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
    hasDraftSession: !sessionsFromGateway.some(
      (row) => String(row?.key || "").trim().toLowerCase() === currentSessionKey,
    ),
    pendingDeleteSessionKey: "",
    toastTimer: 0,
  };

  renderSidebarSection(controller);
  renderTopAction(controller);
  ensureDeleteDialog(controller);
  syncRouteForSession(selectedAgent, currentSessionKey, { replace: true });
  pinMemberChatSession(app, currentSessionKey);
  window._ocMemberChatSurfaceController = controller;
}
window.syncMemberChatSurface = syncMemberChatSurface;

export function bootMemberChatSurface() {
  bootTenantRouteSync();
  void syncMemberChatSurface();

  if (window.__openclawMemberChatSurfaceBooted) {
    return;
  }
  window.__openclawMemberChatSurfaceBooted = true;

  onTenantRouteChange(() => {
    void syncMemberChatSurface();
  });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) {
          continue;
        }
        if (node.closest?.(`[${SECTION_ATTR}]`)) {
          continue;
        }
        if (
          node.matches(APP_SELECTOR) ||
          node.matches(SIDEBAR_SELECTOR) ||
          node.matches(BREADCRUMB_SELECTOR)
        ) {
          void syncMemberChatSurface();
          return;
        }
        if (
          node.querySelector?.(APP_SELECTOR) ||
          node.querySelector?.(SIDEBAR_SELECTOR) ||
          node.querySelector?.(BREADCRUMB_SELECTOR)
        ) {
          void syncMemberChatSurface();
          return;
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
  });

  window.addEventListener("popstate", () => {
    void syncMemberChatSurface();
  });
}
