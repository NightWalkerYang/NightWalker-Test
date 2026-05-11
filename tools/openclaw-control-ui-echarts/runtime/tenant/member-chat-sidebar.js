export const SECTION_ATTR = "data-oc-member-chat-section";
export const TOP_ACTION_ATTR = "data-oc-member-chat-top-action";
export const ACTIVE_SESSION_ATTR = "data-oc-member-chat-active-session";
export const LABEL_ATTR = "data-oc-member-chat-label";
export const DELETE_ATTR = "data-member-chat-delete";
export const DELETE_DIALOG_ROOT_ATTR = "data-oc-member-chat-delete-dialog-root";
export const TOAST_ROOT_ATTR = "data-oc-member-chat-toast-root";

const SESSION_LIST_ATTR = "data-oc-member-chat-session-list";
const DELETE_DIALOG_SELECTOR = "[data-oc-member-chat-delete-dialog]";
const DELETE_DIALOG_CLOSE_SELECTOR = "[data-oc-member-chat-delete-close]";
const DELETE_DIALOG_CONFIRM_SELECTOR = "[data-oc-member-chat-confirm-delete]";
const SECTION_CLASS = "nav-section oc-member-chat-section";

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

function buildSidebarMarkup(controller, deps) {
  const items = controller.sessions.length
    ? controller.sessions
        .map((row, index) => {
          const active = row.key === controller.currentSessionKey;
          const sessionKey = deps.escapeHtml(row.key);
          const sessionLabel = deps.escapeHtml(resolveSessionLabel(row, index));
          const updated = deps.formatRelativeTime(row.updatedAt);
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
                  <span class="oc-member-chat-session-item__meta">${deps.escapeHtml(updated || "未开始")}</span>
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

function buildTopActionMarkup(selectedAgent, deps) {
  const agentName = deps.escapeHtml(selectedAgent?.agentName || "当前 Agent");
  return `
    <button class="btn btn--ghost oc-member-chat-top-action__button" type="button" data-member-chat-back title="返回 Agent 选择">
      Agent选择
    </button>
    <span class="oc-member-chat-top-action__label" title="${agentName}">${agentName}</span>
  `;
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

export function ensureDeleteDialog(controller, deps) {
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
  root._ocDeps = deps;
  if (root.dataset.ocMemberChatHandlers !== "true") {
    root.dataset.ocMemberChatHandlers = "true";
    root.addEventListener("click", (event) => {
      const activeController = root._ocController;
      const activeDeps = root._ocDeps;
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
      if (!nextHiddenKey || !activeController) {
        return;
      }
      void activeDeps.actions.deleteSession(activeController, nextHiddenKey);
    });
  }
  return root.querySelector(DELETE_DIALOG_SELECTOR);
}

export function closeAllDialogs() {
  for (const dialog of document.querySelectorAll("dialog[open]")) {
    if (dialog instanceof HTMLDialogElement) {
      closeDialog(dialog);
    }
  }
}

export function beginNewMemberDraftSession(controller, deps) {
  return deps.actions.beginDraftSession(controller);
}

function attachSectionHandlers(section, controller, deps) {
  section._ocController = controller;
  section._ocDeps = deps;
  if (section.dataset.ocMemberChatHandlers === "true") {
    return;
  }
  section.dataset.ocMemberChatHandlers = "true";
  section.addEventListener("click", (event) => {
    const ctrl = section._ocController;
    const activeDeps = section._ocDeps;
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest("[data-member-chat-new]")) {
      event.preventDefault();
      beginNewMemberDraftSession(ctrl, activeDeps);
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
      void activeDeps.actions.selectSession(ctrl, nextSessionKey);
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
      showDialog(ensureDeleteDialog(ctrl, activeDeps));
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
    root._ocDeps.actions.navigateBack(root._ocController);
  });
}

export function renderSidebarSection(controller, deps) {
  const section = ensureSection(controller.sidebar);
  section.innerHTML = buildSidebarMarkup(controller, deps);
  section.setAttribute(ACTIVE_SESSION_ATTR, controller.currentSessionKey);
  section.setAttribute(LABEL_ATTR, controller.selectedAgent?.agentName || "");
  syncSectionCollapsedState(section);
  attachSectionHandlers(section, controller, deps);
}

export function renderTopAction(controller, deps) {
  if (!(controller.breadcrumb instanceof HTMLElement)) {
    return;
  }
  const root = ensureTopActionRow(controller.breadcrumb);
  root._ocController = controller;
  root._ocDeps = deps;
  root.innerHTML = buildTopActionMarkup(controller.selectedAgent, deps);
  attachTopActionHandlers(root);
}
