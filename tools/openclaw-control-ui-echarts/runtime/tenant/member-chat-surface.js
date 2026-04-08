import {
  TENANT_AGENT_SELECTOR_ROUTE,
  buildTenantMemberChatRoute,
  buildTenantMemberLegacySessionKey,
  createTenantMemberSessionKey,
  isTenantMemberSessionKey,
  readSelectedTenantAgent,
  readTenantSession,
} from "./tenant-context.js";
import {
  bootTenantRouteSync,
  navigateTenantRoute,
  onTenantRouteChange,
} from "./route-sync.js";

const DOC_ATTR = "data-oc-member-chat-route";
const STYLE_ATTR = "data-oc-member-chat-surface-style";
const SECTION_ATTR = "data-oc-member-chat-section";
const SESSION_LIST_ATTR = "data-oc-member-chat-session-list";
const ACTIVE_SESSION_ATTR = "data-oc-member-chat-active-session";
const LABEL_ATTR = "data-oc-member-chat-label";
const APP_SELECTOR = "openclaw-app";
const SIDEBAR_SELECTOR = ".sidebar-nav";
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

function buildSidebarMarkup(selectedAgent, sessions, currentSessionKey) {
  const agentName = escapeHtml(selectedAgent?.agentName || "当前 Agent");
  const agentBadge = escapeHtml(selectedAgent?.emoji || "AI");
  const description = escapeHtml(selectedAgent?.description || "已分配 Agent");
  const items = sessions.length
    ? sessions
        .map((row, index) => {
          const active = row.key === currentSessionKey;
          const updated = formatRelativeTime(row.updatedAt);
          return `
            <button
              class="oc-member-chat-session-item nav-item ${active ? "nav-item--active" : ""}"
              type="button"
              data-member-chat-session="${escapeHtml(row.key)}"
              title="${escapeHtml(resolveSessionLabel(row, index))}"
            >
              <span class="nav-item__icon" aria-hidden="true">💬</span>
              <span class="nav-item__text">
                <span class="oc-member-chat-session-item__label">${escapeHtml(resolveSessionLabel(row, index))}</span>
                <span class="oc-member-chat-session-item__meta">${escapeHtml(updated || "未开始")}</span>
              </span>
            </button>
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
      <div class="oc-member-chat-agent-card">
        <div class="oc-member-chat-agent-card__avatar">${agentBadge}</div>
        <div class="oc-member-chat-agent-card__meta">
          <div class="oc-member-chat-agent-card__name">${agentName}</div>
          <div class="oc-member-chat-agent-card__desc">${description}</div>
        </div>
      </div>
      <button class="btn oc-member-chat-action" type="button" data-member-chat-back>Agent选择</button>
      <button class="btn primary oc-member-chat-action" type="button" data-member-chat-new>新建会话</button>
      <div class="oc-member-chat-session-list" ${SESSION_LIST_ATTR}="true">
        ${items}
      </div>
    </div>
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
  const rows = normalizeSessionRows(await app.client.request("sessions.list", {}));
  const filtered = rows.filter((row) => isTenantMemberSessionKey(row.key, session, selectedAgent));
  return filtered.toSorted((left, right) => (Number(right.updatedAt || 0) - Number(left.updatedAt || 0)));
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
  if (section.dataset.ocMemberChatHandlers === "true") {
    return;
  }
  section.dataset.ocMemberChatHandlers = "true";
  section.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest("[data-member-chat-back]")) {
      event.preventDefault();
      navigateTenantRoute(TENANT_AGENT_SELECTOR_ROUTE);
      return;
    }
    if (target.closest("[data-member-chat-new]")) {
      event.preventDefault();
      const nextSessionKey = createTenantMemberSessionKey(controller.session, controller.selectedAgent);
      controller.currentSessionKey = nextSessionKey;
      controller.sessions = ensureVisibleCurrentSession(controller.sessions, nextSessionKey);
      syncRouteForSession(controller.selectedAgent, nextSessionKey, { replace: false });
      pinMemberChatSession(controller.app, nextSessionKey);
      renderSidebarSection(controller);
      return;
    }
    const sessionButton = target.closest("[data-member-chat-session]");
    if (sessionButton instanceof HTMLElement) {
      event.preventDefault();
      const nextSessionKey = String(sessionButton.dataset.memberChatSession || "").trim().toLowerCase();
      if (!nextSessionKey || nextSessionKey === controller.currentSessionKey) {
        return;
      }
      controller.currentSessionKey = nextSessionKey;
      syncRouteForSession(controller.selectedAgent, nextSessionKey, { replace: false });
      pinMemberChatSession(controller.app, nextSessionKey);
      renderSidebarSection(controller);
      return;
    }
    if (target.closest("[data-member-chat-collapse]")) {
      event.preventDefault();
      section.classList.toggle("nav-section--collapsed");
    }
  });
}

function renderSidebarSection(controller) {
  const section = ensureSection(controller.sidebar);
  section.innerHTML = buildSidebarMarkup(
    controller.selectedAgent,
    controller.sessions,
    controller.currentSessionKey,
  );
  section.setAttribute(ACTIVE_SESSION_ATTR, controller.currentSessionKey);
  section.setAttribute(LABEL_ATTR, controller.selectedAgent?.agentName || "");
  attachSectionHandlers(section, controller);
}

async function syncMemberChatSurface() {
  if (!isMemberChatRoute()) {
    document.documentElement.removeAttribute(DOC_ATTR);
    document.body?.removeAttribute(DOC_ATTR);
    document.querySelector(`[${SECTION_ATTR}]`)?.remove();
    return;
  }

  document.documentElement.setAttribute(DOC_ATTR, "true");
  document.body?.setAttribute(DOC_ATTR, "true");
  ensureStyle();
  closeAllDialogs();

  const app = document.querySelector(APP_SELECTOR);
  const sidebar = document.querySelector(SIDEBAR_SELECTOR);
  const session = readTenantSession();
  const selectedAgent = readSelectedTenantAgent();
  if (!(app instanceof HTMLElement) || !(sidebar instanceof HTMLElement) || !session || !selectedAgent?.id) {
    return;
  }
  if (!app.client || !app.connected) {
    return;
  }

  const sessions = await loadMemberSessions(app, selectedAgent, session);
  const currentSessionKey = findTargetSessionKey(selectedAgent, session, window.location.href, sessions);

  const controller = {
    app,
    sidebar,
    session,
    selectedAgent,
    sessions: ensureVisibleCurrentSession(sessions, currentSessionKey),
    currentSessionKey,
  };

  renderSidebarSection(controller);
  syncRouteForSession(selectedAgent, currentSessionKey, { replace: true });
  pinMemberChatSession(app, currentSessionKey);
}

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
        if (node.matches(APP_SELECTOR) || node.matches(SIDEBAR_SELECTOR)) {
          void syncMemberChatSurface();
          return;
        }
        if (node.querySelector?.(APP_SELECTOR) || node.querySelector?.(SIDEBAR_SELECTOR)) {
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
