import { createTenantApiClient } from "./api-client.js";
import { showTransientFeedbackToast } from "./feedback-toast.js";
import { onTenantRouteChange } from "./route-sync.js";
import { isTenantLoginView, readSessionForCurrentView, readTenantView } from "./tenant-context.js";

const ROOT_ATTR = "data-oc-update-log-root";
const STYLE_ATTR = "data-oc-update-log-style";
const HISTORY_DIALOG_SELECTOR = "[data-oc-update-log-history-dialog]";
const MANAGE_DIALOG_SELECTOR = "[data-oc-update-log-manage-dialog]";
const EDITOR_DIALOG_SELECTOR = "[data-oc-update-log-editor-dialog]";
const DELETE_DIALOG_SELECTOR = "[data-oc-update-log-delete-dialog]";
const HISTORY_SEARCH_SELECTOR = "[data-oc-update-log-history-search]";
const MANAGE_SEARCH_SELECTOR = "[data-oc-update-log-manage-search]";
const SEEN_STORAGE_KEY = "openclaw:tenant-platform:update-log-seen:v1";

function createInitialState() {
  return {
    sessionSignature: "",
    history: [],
    historyLoading: false,
    historyError: "",
    historySearch: "",
    manageSearch: "",
    selectedEntryId: "",
    footerVersionLabel: "",
    historyPromise: null,
    historyAutoSeenSignature: "",
    autoPromptKey: "",
    editorMode: "create",
    editorBusy: false,
    deleteBusy: false,
    deleteEntryId: "",
    syncScheduled: false,
  };
}

function getState() {
  if (!window.__openclawUpdateLogState || typeof window.__openclawUpdateLogState !== "object") {
    window.__openclawUpdateLogState = createInitialState();
  }
  return window.__openclawUpdateLogState;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeSearch(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  return {
    id: String(entry.id || "").trim(),
    versionLabel: String(entry.versionLabel || "").trim(),
    title: String(entry.title || "").trim(),
    content: String(entry.content || ""),
    excerpt: String(entry.excerpt || "").trim(),
    createdByUsername: String(entry.createdByUsername || "").trim() || "平台管理员",
    publishedAt: String(entry.publishedAt || "").trim(),
    createdAt: String(entry.createdAt || "").trim(),
    updatedAt: String(entry.updatedAt || "").trim(),
  };
}

function getEntrySignature(entry) {
  if (!entry?.id) {
    return "";
  }
  return `${entry.id}:${entry.updatedAt || entry.publishedAt || entry.createdAt || ""}`;
}

function getSessionSignature(session) {
  const token = String(session?.token || "").trim();
  const role = String(session?.session?.role || "").trim();
  const userId = String(session?.session?.userId || "").trim();
  const tenantId = String(session?.session?.tenantId || "").trim();
  if (!token || !role || !userId) {
    return "";
  }
  return `${role}:${userId}:${tenantId}:${token}`;
}

function canViewUpdateLogs(session) {
  const role = String(session?.session?.role || "").trim();
  return role === "platform_admin" || role === "tenant_admin" || role === "member";
}

function canManageUpdateLogs(session) {
  return String(session?.session?.role || "").trim() === "platform_admin";
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const parsed = Date.parse(String(value));
  if (Number.isNaN(parsed)) {
    return String(value);
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(parsed));
}

function summarizeContent(content) {
  const normalized = String(content || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > 96 ? `${normalized.slice(0, 95).trimEnd()}…` : normalized;
}

function ensureStyle() {
  let link = document.head.querySelector(`[${STYLE_ATTR}]`);
  if (link instanceof HTMLLinkElement) {
    return link;
  }
  link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./update-log-dialog.css", import.meta.url).href;
  link.setAttribute(STYLE_ATTR, "true");
  document.head.append(link);
  return link;
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

function ensureRoot() {
  let root = document.body.querySelector(`[${ROOT_ATTR}]`);
  if (root instanceof HTMLElement) {
    return root;
  }
  root = document.createElement("div");
  root.setAttribute(ROOT_ATTR, "true");
  root.innerHTML = `
    <dialog class="oc-update-log-dialog" data-oc-update-log-history-dialog>
      <div class="oc-update-log-dialog__panel oc-update-log-dialog__panel--wide">
        <header class="oc-update-log-dialog__header">
          <div class="oc-update-log-dialog__title-group">
            <p class="oc-update-log-dialog__eyebrow">版本</p>
            <h3 class="oc-update-log-dialog__title">更新日志</h3>
            <p class="oc-update-log-dialog__subtitle" data-oc-update-log-history-subtitle></p>
          </div>
          <div class="oc-update-log-dialog__actions">
            <button class="btn" type="button" data-oc-update-log-open-manage hidden>修改</button>
            <button class="btn primary" type="button" data-oc-update-log-open-create hidden>新建更新</button>
            <button class="btn" type="button" data-oc-update-log-close="history">关闭</button>
          </div>
        </header>
        <div class="oc-update-log-dialog__body oc-update-log-dialog__body--split">
          <aside class="oc-update-log-dialog__sidebar">
            <label class="oc-update-log-dialog__search">
              <span>搜索历史</span>
              <input type="search" placeholder="搜索版本、标题或内容" data-oc-update-log-history-search />
            </label>
            <div class="oc-update-log-dialog__list" data-oc-update-log-history-list></div>
          </aside>
          <section class="oc-update-log-dialog__detail" data-oc-update-log-history-detail></section>
        </div>
      </div>
    </dialog>
    <dialog class="oc-update-log-dialog" data-oc-update-log-manage-dialog>
      <div class="oc-update-log-dialog__panel">
        <header class="oc-update-log-dialog__header">
          <div class="oc-update-log-dialog__title-group">
            <p class="oc-update-log-dialog__eyebrow">管理</p>
            <h3 class="oc-update-log-dialog__title">修改历史更新</h3>
            <p class="oc-update-log-dialog__subtitle">搜索并选择某条更新日志进行修改或删除。</p>
          </div>
          <div class="oc-update-log-dialog__actions">
            <button class="btn" type="button" data-oc-update-log-close="manage">关闭</button>
          </div>
        </header>
        <div class="oc-update-log-dialog__body">
          <label class="oc-update-log-dialog__search">
            <span>搜索历史</span>
            <input type="search" placeholder="搜索版本、标题或内容" data-oc-update-log-manage-search />
          </label>
          <div class="oc-update-log-manage-list" data-oc-update-log-manage-list></div>
        </div>
      </div>
    </dialog>
    <dialog class="oc-update-log-dialog" data-oc-update-log-editor-dialog>
      <div class="oc-update-log-dialog__panel">
        <header class="oc-update-log-dialog__header">
          <div class="oc-update-log-dialog__title-group">
            <p class="oc-update-log-dialog__eyebrow" data-oc-update-log-editor-eyebrow></p>
            <h3 class="oc-update-log-dialog__title" data-oc-update-log-editor-title></h3>
            <p class="oc-update-log-dialog__subtitle">保存后，租户管理员和租户成员可在版本入口查看最新更新。</p>
          </div>
          <div class="oc-update-log-dialog__actions">
            <button class="btn" type="button" data-oc-update-log-close="editor">关闭</button>
          </div>
        </header>
        <div class="oc-update-log-dialog__body">
          <form class="oc-update-log-form" data-oc-update-log-editor-form>
            <input type="hidden" name="id" />
            <label class="oc-update-log-form__field">
              <span>版本号</span>
              <input name="versionLabel" maxlength="64" placeholder="例如：v2026.4.23" required />
            </label>
            <label class="oc-update-log-form__field">
              <span>标题</span>
              <input name="title" maxlength="120" placeholder="例如：更新日志展示与发布中心" required />
            </label>
            <label class="oc-update-log-form__field">
              <span>更新内容</span>
              <textarea
                name="content"
                rows="10"
                maxlength="8000"
                placeholder="请填写本次更新做了什么。支持多行，建议一行一个要点。"
                required
              ></textarea>
            </label>
            <div class="oc-update-log-form__actions">
              <button class="btn" type="button" data-oc-update-log-close="editor">取消</button>
              <button class="btn primary" type="submit" data-oc-update-log-save>保存</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
    <dialog class="oc-update-log-dialog" data-oc-update-log-delete-dialog>
      <div class="oc-update-log-dialog__panel oc-update-log-dialog__panel--compact">
        <header class="oc-update-log-dialog__header">
          <div class="oc-update-log-dialog__title-group">
            <p class="oc-update-log-dialog__eyebrow">删除</p>
            <h3 class="oc-update-log-dialog__title">确认删除更新日志</h3>
          </div>
          <div class="oc-update-log-dialog__actions">
            <button class="btn" type="button" data-oc-update-log-close="delete">关闭</button>
          </div>
        </header>
        <div class="oc-update-log-dialog__body">
          <p class="oc-update-log-dialog__confirm-text" data-oc-update-log-delete-text></p>
          <div class="oc-update-log-form__actions">
            <button class="btn" type="button" data-oc-update-log-close="delete">取消</button>
            <button class="btn danger" type="button" data-oc-update-log-confirm-delete>确认删除</button>
          </div>
        </div>
      </div>
    </dialog>
  `;
  document.body.append(root);
  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const closeButton = target.closest("[data-oc-update-log-close]");
    if (closeButton instanceof HTMLButtonElement) {
      event.preventDefault();
      closeNamedDialog(String(closeButton.dataset.ocUpdateLogClose || ""));
      return;
    }
    const createButton = target.closest("[data-oc-update-log-open-create]");
    if (createButton instanceof HTMLButtonElement) {
      event.preventDefault();
      openEditorDialog("create");
      return;
    }
    const manageButton = target.closest("[data-oc-update-log-open-manage]");
    if (manageButton instanceof HTMLButtonElement) {
      event.preventDefault();
      openManageDialog();
      return;
    }
    const selectButton = target.closest("[data-oc-update-log-select]");
    if (selectButton instanceof HTMLButtonElement) {
      event.preventDefault();
      const state = getState();
      state.selectedEntryId = String(selectButton.dataset.ocUpdateLogSelect || "").trim();
      renderHistoryDialog();
      return;
    }
    const editButton = target.closest("[data-oc-update-log-edit]");
    if (editButton instanceof HTMLButtonElement) {
      event.preventDefault();
      openEditorDialog("edit", String(editButton.dataset.ocUpdateLogEdit || "").trim());
      return;
    }
    const deleteButton = target.closest("[data-oc-update-log-delete]");
    if (deleteButton instanceof HTMLButtonElement) {
      event.preventDefault();
      openDeleteDialog(String(deleteButton.dataset.ocUpdateLogDelete || "").trim());
      return;
    }
    const confirmDeleteButton = target.closest("[data-oc-update-log-confirm-delete]");
    if (confirmDeleteButton instanceof HTMLButtonElement) {
      event.preventDefault();
      void submitDelete();
    }
  });
  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      return;
    }
    const state = getState();
    if (target.matches(HISTORY_SEARCH_SELECTOR)) {
      state.historySearch = target.value;
      renderHistoryDialog();
      return;
    }
    if (target.matches(MANAGE_SEARCH_SELECTOR)) {
      state.manageSearch = target.value;
      renderManageDialog();
    }
  });
  root.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.matches("[data-oc-update-log-editor-form]")) {
      return;
    }
    event.preventDefault();
    void submitEditor(form);
  });
  root.addEventListener("close", (event) => {
    if (!(event.target instanceof HTMLDialogElement)) {
      return;
    }
    if (event.target.matches(HISTORY_DIALOG_SELECTOR)) {
      handleHistoryDialogClosed();
      return;
    }
    if (event.target.matches(MANAGE_DIALOG_SELECTOR)) {
      handleManageDialogClosed();
      return;
    }
    if (event.target.matches(EDITOR_DIALOG_SELECTOR)) {
      handleEditorDialogClosed();
      return;
    }
    if (event.target.matches(DELETE_DIALOG_SELECTOR)) {
      handleDeleteDialogClosed();
    }
  });
  return root;
}

function getRoot() {
  return ensureRoot();
}

function getDialog(selector) {
  return getRoot().querySelector(selector);
}

function closeNamedDialog(name) {
  if (name === "history") {
    closeDialog(getDialog(HISTORY_DIALOG_SELECTOR));
    handleHistoryDialogClosed();
    return;
  }
  if (name === "manage") {
    closeDialog(getDialog(MANAGE_DIALOG_SELECTOR));
    handleManageDialogClosed();
    return;
  }
  if (name === "editor") {
    closeDialog(getDialog(EDITOR_DIALOG_SELECTOR));
    handleEditorDialogClosed();
    return;
  }
  if (name === "delete") {
    closeDialog(getDialog(DELETE_DIALOG_SELECTOR));
    handleDeleteDialogClosed();
  }
}

function readSeenMap() {
  try {
    const raw = window.localStorage.getItem(SEEN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSeenMap(value) {
  try {
    window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore storage write failures and keep the dialog functional.
  }
}

function buildSeenStorageKey(session) {
  const role = String(session?.session?.role || "").trim();
  const userId = String(session?.session?.userId || "").trim();
  const tenantId = String(session?.session?.tenantId || "").trim();
  if (!role || !userId) {
    return "";
  }
  return `${role}:${userId}:${tenantId}`;
}

function readSeenSignature(session) {
  const key = buildSeenStorageKey(session);
  if (!key) {
    return "";
  }
  return String(readSeenMap()[key] || "").trim();
}

function markSeenSignature(session, signature) {
  const key = buildSeenStorageKey(session);
  const normalizedSignature = String(signature || "").trim();
  if (!key || !normalizedSignature) {
    return;
  }
  const next = readSeenMap();
  next[key] = normalizedSignature;
  writeSeenMap(next);
}

function translateUpdateLogError(error) {
  const message = String(error?.message || error || "").trim();
  if (!message) {
    return "操作失败，请稍后重试。";
  }
  if (message === "update_log_version_required") {
    return "版本号不能为空。";
  }
  if (message === "update_log_title_required") {
    return "标题不能为空。";
  }
  if (message === "update_log_content_required") {
    return "更新内容不能为空。";
  }
  if (message === "update_log_id_required") {
    return "未找到对应的更新日志。";
  }
  if (message === "update_log_not_found") {
    return "更新日志不存在，列表已刷新。";
  }
  return message;
}

function showFeedback(message, isError = false) {
  const root = getRoot();
  showTransientFeedbackToast(root, translateUpdateLogError(message), isError);
}

function resolveFooterVersionLabel() {
  const activeVersionItem = document.querySelector("[data-oc-utility-version]");
  return String(activeVersionItem?.textContent || "").trim();
}

function filterEntries(entries, search) {
  const normalizedSearch = normalizeSearch(search);
  if (!normalizedSearch) {
    return entries;
  }
  return entries.filter((entry) =>
    [
      entry.versionLabel,
      entry.title,
      entry.content,
      entry.excerpt,
      entry.createdByUsername,
    ].some((field) => normalizeSearch(field).includes(normalizedSearch)),
  );
}

function getSelectedEntry(entries) {
  const state = getState();
  const filtered = filterEntries(entries, state.historySearch);
  const selectedFromFiltered = filtered.find((entry) => entry.id === state.selectedEntryId);
  if (selectedFromFiltered) {
    return selectedFromFiltered;
  }
  const selectedFromAll = entries.find((entry) => entry.id === state.selectedEntryId);
  if (selectedFromAll) {
    return selectedFromAll;
  }
  return filtered[0] ?? entries[0] ?? null;
}

function resetHistoryCache(state) {
  state.history = [];
  state.historyLoading = false;
  state.historyError = "";
  state.historyPromise = null;
  state.selectedEntryId = "";
  state.historyAutoSeenSignature = "";
}

async function loadHistory({ force = false } = {}) {
  const state = getState();
  const session = readSessionForCurrentView();
  const sessionSignature = getSessionSignature(session);
  if (!sessionSignature || !canViewUpdateLogs(session)) {
    resetHistoryCache(state);
    return [];
  }
  if (!force && state.history.length > 0 && state.sessionSignature === sessionSignature) {
    return state.history;
  }
  if (!force && state.historyPromise) {
    return state.historyPromise;
  }
  const apiClient = createTenantApiClient();
  state.historyLoading = true;
  state.historyError = "";
  renderHistoryDialog();
  renderManageDialog();
  state.historyPromise = apiClient
    .listUpdateLogs()
    .then((items) => {
      state.history = (Array.isArray(items) ? items : [])
        .map(normalizeEntry)
        .filter((entry) => entry?.id);
      if (!state.selectedEntryId && state.history[0]?.id) {
        state.selectedEntryId = state.history[0].id;
      }
      return state.history;
    })
    .catch((error) => {
      state.history = [];
      state.historyError = translateUpdateLogError(error);
      return [];
    })
    .finally(() => {
      state.historyLoading = false;
      state.historyPromise = null;
      renderHistoryDialog();
      renderManageDialog();
    });
  return state.historyPromise;
}

function renderHistoryDialog() {
  const state = getState();
  const session = readSessionForCurrentView();
  const canManage = canManageUpdateLogs(session);
  const entries = Array.isArray(state.history) ? state.history : [];
  const filteredEntries = filterEntries(entries, state.historySearch);
  const selectedEntry = getSelectedEntry(entries);
  if (selectedEntry?.id) {
    state.selectedEntryId = selectedEntry.id;
  }

  const subtitle = getRoot().querySelector("[data-oc-update-log-history-subtitle]");
  if (subtitle instanceof HTMLElement) {
    const versionLabel = state.footerVersionLabel || resolveFooterVersionLabel();
    subtitle.textContent = versionLabel
      ? `当前入口：${versionLabel}。点击列表可查看历次更新。`
      : "点击列表可查看历次更新。";
  }

  const createButton = getRoot().querySelector("[data-oc-update-log-open-create]");
  const manageButton = getRoot().querySelector("[data-oc-update-log-open-manage]");
  if (createButton instanceof HTMLButtonElement) {
    createButton.hidden = !canManage;
  }
  if (manageButton instanceof HTMLButtonElement) {
    manageButton.hidden = !canManage;
  }

  const searchInput = getRoot().querySelector(HISTORY_SEARCH_SELECTOR);
  if (searchInput instanceof HTMLInputElement && searchInput.value !== state.historySearch) {
    searchInput.value = state.historySearch;
  }

  const list = getRoot().querySelector("[data-oc-update-log-history-list]");
  if (list instanceof HTMLElement) {
    if (state.historyLoading) {
      list.innerHTML = `<div class="oc-update-log-empty">正在加载更新日志...</div>`;
    } else if (state.historyError) {
      list.innerHTML = `<div class="oc-update-log-empty oc-update-log-empty--danger">${escapeHtml(state.historyError)}</div>`;
    } else if (filteredEntries.length === 0) {
      list.innerHTML = `<div class="oc-update-log-empty">${entries.length ? "没有匹配的更新日志。" : "暂时还没有更新日志。"}</div>`;
    } else {
      list.innerHTML = filteredEntries
        .map((entry) => {
          const isActive = entry.id === state.selectedEntryId;
          return `
            <button
              class="oc-update-log-list-item${isActive ? " is-active" : ""}"
              type="button"
              data-oc-update-log-select="${escapeAttribute(entry.id)}"
            >
              <span class="oc-update-log-list-item__version">${escapeHtml(entry.versionLabel || "未标记版本")}</span>
              <strong class="oc-update-log-list-item__title">${escapeHtml(entry.title || "未命名更新")}</strong>
              <span class="oc-update-log-list-item__excerpt">${escapeHtml(entry.excerpt || summarizeContent(entry.content))}</span>
              <span class="oc-update-log-list-item__meta">${escapeHtml(formatDateTime(entry.publishedAt || entry.createdAt))}</span>
            </button>
          `;
        })
        .join("");
    }
  }

  const detail = getRoot().querySelector("[data-oc-update-log-history-detail]");
  if (!(detail instanceof HTMLElement)) {
    return;
  }
  if (state.historyLoading && !selectedEntry) {
    detail.innerHTML = `<div class="oc-update-log-empty">正在读取最新更新...</div>`;
    return;
  }
  if (!selectedEntry) {
    detail.innerHTML = `<div class="oc-update-log-empty">${entries.length ? "请选择一条更新日志查看详情。" : "暂时还没有更新日志。"}</div>`;
    return;
  }
  detail.innerHTML = `
    <div class="oc-update-log-detail">
      <div class="oc-update-log-detail__meta">
        <span class="oc-update-log-detail__chip">${escapeHtml(selectedEntry.versionLabel || "未标记版本")}</span>
        <span>发布时间 ${escapeHtml(formatDateTime(selectedEntry.publishedAt || selectedEntry.createdAt))}</span>
        <span>更新时间 ${escapeHtml(formatDateTime(selectedEntry.updatedAt || selectedEntry.createdAt))}</span>
        <span>发布人 ${escapeHtml(selectedEntry.createdByUsername)}</span>
      </div>
      <h4 class="oc-update-log-detail__title">${escapeHtml(selectedEntry.title || "未命名更新")}</h4>
      <div class="oc-update-log-detail__content">${escapeHtml(selectedEntry.content || "暂无内容")}</div>
    </div>
  `;
}

function renderManageDialog() {
  const state = getState();
  const list = getRoot().querySelector("[data-oc-update-log-manage-list]");
  const searchInput = getRoot().querySelector(MANAGE_SEARCH_SELECTOR);
  if (searchInput instanceof HTMLInputElement && searchInput.value !== state.manageSearch) {
    searchInput.value = state.manageSearch;
  }
  if (!(list instanceof HTMLElement)) {
    return;
  }
  const filteredEntries = filterEntries(state.history, state.manageSearch);
  if (state.historyLoading) {
    list.innerHTML = `<div class="oc-update-log-empty">正在加载更新日志...</div>`;
    return;
  }
  if (state.historyError) {
    list.innerHTML = `<div class="oc-update-log-empty oc-update-log-empty--danger">${escapeHtml(state.historyError)}</div>`;
    return;
  }
  if (filteredEntries.length === 0) {
    list.innerHTML = `<div class="oc-update-log-empty">${state.history.length ? "没有匹配的更新日志。" : "暂时还没有可管理的更新日志。"}</div>`;
    return;
  }
  list.innerHTML = filteredEntries
    .map(
      (entry) => `
        <div class="oc-update-log-manage-item">
          <button
            class="oc-update-log-manage-item__main"
            type="button"
            data-oc-update-log-edit="${escapeAttribute(entry.id)}"
          >
            <span class="oc-update-log-manage-item__version">${escapeHtml(entry.versionLabel || "未标记版本")}</span>
            <strong class="oc-update-log-manage-item__title">${escapeHtml(entry.title || "未命名更新")}</strong>
            <span class="oc-update-log-manage-item__excerpt">${escapeHtml(entry.excerpt || summarizeContent(entry.content))}</span>
          </button>
          <button
            class="btn danger"
            type="button"
            data-oc-update-log-delete="${escapeAttribute(entry.id)}"
          >删除</button>
        </div>
      `,
    )
    .join("");
}

function renderEditorDialog() {
  const state = getState();
  const title = getRoot().querySelector("[data-oc-update-log-editor-title]");
  const eyebrow = getRoot().querySelector("[data-oc-update-log-editor-eyebrow]");
  const form = getRoot().querySelector("[data-oc-update-log-editor-form]");
  if (!(form instanceof HTMLFormElement)) {
    return;
  }
  const entry =
    state.editorMode === "edit"
      ? state.history.find((item) => item.id === String(form.elements.namedItem("id")?.value || "").trim()) ||
        null
      : null;
  const inputId = form.elements.namedItem("id");
  const versionLabelInput = form.elements.namedItem("versionLabel");
  const titleInput = form.elements.namedItem("title");
  const contentInput = form.elements.namedItem("content");
  if (title instanceof HTMLElement) {
    title.textContent = state.editorMode === "edit" ? "修改更新日志" : "新建更新日志";
  }
  if (eyebrow instanceof HTMLElement) {
    eyebrow.textContent = state.editorMode === "edit" ? "修改" : "新建";
  }
  if (inputId instanceof HTMLInputElement) {
    inputId.value = entry?.id || "";
  }
  if (versionLabelInput instanceof HTMLInputElement) {
    versionLabelInput.value = entry?.versionLabel || "";
  }
  if (titleInput instanceof HTMLInputElement) {
    titleInput.value = entry?.title || "";
  }
  if (contentInput instanceof HTMLTextAreaElement) {
    contentInput.value = entry?.content || "";
  }
}

function renderDeleteDialog() {
  const state = getState();
  const text = getRoot().querySelector("[data-oc-update-log-delete-text]");
  if (!(text instanceof HTMLElement)) {
    return;
  }
  const entry = state.history.find((item) => item.id === state.deleteEntryId) ?? null;
  text.textContent = entry
    ? `确认删除“${entry.versionLabel || "未标记版本"} · ${entry.title || "未命名更新"}”吗？删除后租户侧历史记录也会同步消失。`
    : "确认删除这条更新日志吗？";
}

function openHistoryDialog(mode = "manual") {
  const state = getState();
  state.footerVersionLabel = resolveFooterVersionLabel();
  ensureStyle();
  getRoot();
  renderHistoryDialog();
  showDialog(getDialog(HISTORY_DIALOG_SELECTOR));
  if (mode !== "auto") {
    state.historyAutoSeenSignature = "";
  }
}

function handleHistoryDialogClosed() {
  const state = getState();
  const session = readSessionForCurrentView();
  const latestEntry = state.history[0] ?? null;
  const latestSignature = state.historyAutoSeenSignature || getEntrySignature(latestEntry);
  if (latestSignature) {
    markSeenSignature(session, latestSignature);
  }
  state.historyAutoSeenSignature = "";
  state.historySearch = "";
  renderHistoryDialog();
}

function openManageDialog() {
  const session = readSessionForCurrentView();
  if (!canManageUpdateLogs(session)) {
    return;
  }
  ensureStyle();
  getRoot();
  renderManageDialog();
  showDialog(getDialog(MANAGE_DIALOG_SELECTOR));
}

function handleManageDialogClosed() {
  const state = getState();
  state.manageSearch = "";
  renderManageDialog();
}

function openEditorDialog(mode = "create", entryId = "") {
  const session = readSessionForCurrentView();
  if (!canManageUpdateLogs(session)) {
    return;
  }
  const state = getState();
  state.editorMode = mode === "edit" ? "edit" : "create";
  ensureStyle();
  const root = getRoot();
  const form = root.querySelector("[data-oc-update-log-editor-form]");
  if (form instanceof HTMLFormElement) {
    const idInput = form.elements.namedItem("id");
    if (idInput instanceof HTMLInputElement) {
      idInput.value = state.editorMode === "edit" ? entryId : "";
    }
  }
  renderEditorDialog();
  showDialog(getDialog(EDITOR_DIALOG_SELECTOR));
}

function handleEditorDialogClosed() {
  const state = getState();
  state.editorBusy = false;
}

function openDeleteDialog(entryId) {
  const session = readSessionForCurrentView();
  if (!canManageUpdateLogs(session)) {
    return;
  }
  const state = getState();
  state.deleteEntryId = entryId;
  ensureStyle();
  renderDeleteDialog();
  showDialog(getDialog(DELETE_DIALOG_SELECTOR));
}

function handleDeleteDialogClosed() {
  const state = getState();
  state.deleteBusy = false;
  state.deleteEntryId = "";
}

async function submitEditor(form) {
  const session = readSessionForCurrentView();
  if (!canManageUpdateLogs(session)) {
    return;
  }
  const state = getState();
  if (state.editorBusy) {
    return;
  }
  state.editorBusy = true;
  const formData = new FormData(form);
  const payload = {
    id: String(formData.get("id") || "").trim(),
    versionLabel: String(formData.get("versionLabel") || "").trim(),
    title: String(formData.get("title") || "").trim(),
    content: String(formData.get("content") || ""),
  };
  const apiClient = createTenantApiClient();
  try {
    const saved =
      state.editorMode === "edit"
        ? await apiClient.updateUpdateLog(payload)
        : await apiClient.createUpdateLog(payload);
    await loadHistory({ force: true });
    state.selectedEntryId = String(saved?.id || payload.id || "").trim();
    closeNamedDialog("editor");
    closeDialog(getDialog(MANAGE_DIALOG_SELECTOR));
    renderHistoryDialog();
    showDialog(getDialog(HISTORY_DIALOG_SELECTOR));
    const latestEntry = getState().history[0] ?? null;
    if (latestEntry) {
      markSeenSignature(session, getEntrySignature(latestEntry));
    }
    showFeedback(state.editorMode === "edit" ? "更新日志已保存。" : "更新日志已创建。");
  } catch (error) {
    showFeedback(error, true);
  } finally {
    state.editorBusy = false;
  }
}

async function submitDelete() {
  const session = readSessionForCurrentView();
  if (!canManageUpdateLogs(session)) {
    return;
  }
  const state = getState();
  if (state.deleteBusy || !state.deleteEntryId) {
    return;
  }
  state.deleteBusy = true;
  const apiClient = createTenantApiClient();
  try {
    await apiClient.deleteUpdateLog(state.deleteEntryId);
    await loadHistory({ force: true });
    if (state.selectedEntryId === state.deleteEntryId) {
      state.selectedEntryId = state.history[0]?.id || "";
    }
    closeNamedDialog("delete");
    renderManageDialog();
    renderHistoryDialog();
    showFeedback("更新日志已删除。");
  } catch (error) {
    showFeedback(error, true);
  } finally {
    state.deleteBusy = false;
  }
}

async function maybeAutoOpenLatest() {
  const state = getState();
  const session = readSessionForCurrentView();
  if (!canViewUpdateLogs(session) || isTenantLoginView(readTenantView())) {
    return;
  }
  await loadHistory();
  const latestEntry = state.history[0] ?? null;
  const latestSignature = getEntrySignature(latestEntry);
  if (!latestSignature) {
    return;
  }
  const sessionSignature = getSessionSignature(session);
  const autoPromptKey = `${sessionSignature}:${latestSignature}`;
  if (state.autoPromptKey === autoPromptKey) {
    return;
  }
  if (readSeenSignature(session) === latestSignature) {
    state.autoPromptKey = autoPromptKey;
    return;
  }
  state.autoPromptKey = autoPromptKey;
  state.selectedEntryId = latestEntry.id;
  state.historyAutoSeenSignature = latestSignature;
  openHistoryDialog("auto");
}

function scheduleRouteSync() {
  const state = getState();
  if (state.syncScheduled) {
    return;
  }
  state.syncScheduled = true;
  queueMicrotask(() => {
    const nextState = getState();
    nextState.syncScheduled = false;
    void syncRouteState();
  });
}

async function syncRouteState() {
  const state = getState();
  const session = readSessionForCurrentView();
  const sessionSignature = getSessionSignature(session);
  if (state.sessionSignature !== sessionSignature) {
    state.sessionSignature = sessionSignature;
    state.autoPromptKey = "";
    state.footerVersionLabel = resolveFooterVersionLabel();
    resetHistoryCache(state);
  }
  if (!sessionSignature || !canViewUpdateLogs(session) || isTenantLoginView(readTenantView())) {
    closeNamedDialog("history");
    closeNamedDialog("manage");
    closeNamedDialog("editor");
    closeNamedDialog("delete");
    return;
  }
  await maybeAutoOpenLatest();
}

function handleDocumentClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const versionItem = target.closest("[data-oc-utility-version]");
  if (!(versionItem instanceof HTMLElement)) {
    return;
  }
  const session = readSessionForCurrentView();
  if (!canViewUpdateLogs(session) || isTenantLoginView(readTenantView())) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const state = getState();
  state.footerVersionLabel = String(versionItem.textContent || "").trim();
  openHistoryDialog("manual");
  void loadHistory();
}

export function bootUpdateLogDialogs() {
  if (window.__openclawUpdateLogDialogsBooted) {
    scheduleRouteSync();
    return;
  }
  window.__openclawUpdateLogDialogsBooted = true;
  document.addEventListener("click", handleDocumentClick, true);
  onTenantRouteChange(() => {
    scheduleRouteSync();
  });
  scheduleRouteSync();
}
