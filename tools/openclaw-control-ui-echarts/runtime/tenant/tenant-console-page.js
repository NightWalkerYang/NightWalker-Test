import { createTenantApiClient } from "./api-client.js";
import { showTransientFeedbackToast } from "./feedback-toast.js";
import {
  TENANT_LOGIN_ROUTE,
  TENANT_STATISTICS_OVERVIEW_VIEW,
  requireTenantSession,
} from "./tenant-context.js";
import {
  initTenantOverviewCharts,
  refreshTenantOverview,
  renderTenantOverview,
} from "./tenant-overview-page.js";

const PAGE_SIZE = 8;
const USAGE_SEARCH_DEBOUNCE_MS = 250;

function isLocalEdition(controller) {
  return controller?.session?.session?.edition === "local";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const timestamp = Date.parse(String(value));
  if (Number.isNaN(timestamp)) {
    return String(value);
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatNumber(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? new Intl.NumberFormat("zh-CN").format(numeric) : "0";
}

function formatCredits(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "0";
  }
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2,
  }).format(numeric);
}

function setFeedback(root, text, isError = false) {
  showTransientFeedbackToast(root, text, isError);
}

function openDialog(dialog) {
  if (!(dialog instanceof HTMLDialogElement)) {
    return;
  }
  if (!dialog.open) {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
      return;
    }
    dialog.setAttribute("open", "");
  }
}

function closeDialog(dialog) {
  if (dialog instanceof HTMLDialogElement && dialog.open) {
    if (typeof dialog.close === "function") {
      dialog.close();
      return;
    }
    dialog.removeAttribute("open");
  }
}

function memberStatusLabel(status) {
  return String(status || "").trim() === "active" ? "已启用" : "已禁用";
}

function memberStatusToggleLabel(status) {
  return String(status || "").trim() === "active" ? "禁用成员" : "启用成员";
}

function getAssignmentSelection(controller) {
  if (!(controller?.selectedAssignmentMemberIds instanceof Set)) {
    controller.selectedAssignmentMemberIds = new Set();
  }
  return controller.selectedAssignmentMemberIds;
}

function isAssignmentSelectionTarget(member) {
  return Number(member?.assignedAgentCount || 0) > 0;
}

function isAssignmentMemberSelected(controller, memberId) {
  return getAssignmentSelection(controller).has(String(memberId || "").trim());
}

function setAssignmentMemberSelected(controller, memberId, selected) {
  const normalized = String(memberId || "").trim();
  if (!normalized) {
    return;
  }
  const selection = getAssignmentSelection(controller);
  if (selected) {
    selection.add(normalized);
    return;
  }
  selection.delete(normalized);
}

function clearAssignmentSelection(controller) {
  getAssignmentSelection(controller).clear();
}

function pruneAssignmentSelection(controller) {
  if (controller.section !== "agent-assignment") {
    return;
  }
  const membersById = new Map(controller.members.map((member) => [member.id, member]));
  const selection = getAssignmentSelection(controller);
  for (const memberId of Array.from(selection)) {
    const member = membersById.get(memberId);
    if (!member || !isAssignmentSelectionTarget(member)) {
      selection.delete(memberId);
    }
  }
}

function ensureController(root, session, apiClient) {
  if (root.__ocTenantConsoleController) {
    root.__ocTenantConsoleController.session = session;
    return root.__ocTenantConsoleController;
  }

  const controller = {
    apiClient,
    session,
    section: "members",
    searchBySection: {
      members: "",
      "agent-assignment": "",
      "usage-stats": "",
    },
    pageBySection: {
      members: 1,
      "agent-assignment": 1,
      "usage-stats": 1,
    },
    members: [],
    tenantAgents: [],
    activeMember: null,
    passwordMember: null,
    selectedAssignmentMemberIds: new Set(),
    usageItems: [],
    usageTotal: 0,
    usagePageSize: PAGE_SIZE,
    usageSearchTimer: null,
    assignmentRevokeBusy: false,
    dialogs: {
      createMemberOpen: false,
      assignOpen: false,
      changePasswordOpen: false,
    },
  };

  root.__ocTenantConsoleController = controller;
  root.addEventListener("click", (event) => {
    void handleClick(root, controller, event);
  });
  root.addEventListener("input", (event) => {
    handleInput(root, controller, event);
  });
  root.addEventListener("submit", (event) => {
    void handleSubmit(root, controller, event);
  });
  root.addEventListener("close", (event) => {
    if (!(event.target instanceof HTMLDialogElement)) {
      return;
    }
    if (event.target.matches("[data-tenant-create-dialog]")) {
      controller.dialogs.createMemberOpen = false;
    }
    if (event.target.matches("[data-tenant-assign-dialog]")) {
      controller.dialogs.assignOpen = false;
    }
    if (event.target.matches("[data-tenant-member-password-dialog]")) {
      controller.dialogs.changePasswordOpen = false;
      controller.passwordMember = null;
    }
    render(root, controller);
  });
  return controller;
}

function getSearchValue(controller) {
  return controller.searchBySection[controller.section] || "";
}

function getPageValue(controller) {
  return controller.pageBySection[controller.section] || 1;
}

function setPageValue(controller, page) {
  controller.pageBySection[controller.section] = Math.max(1, page);
}

function filterMembers(controller) {
  const query = getSearchValue(controller).trim().toLowerCase();
  if (!query) {
    return controller.members;
  }
  return controller.members.filter((member) =>
    [member.username, member.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
}

function paginate(items, page) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  return {
    items: items.slice(start, start + PAGE_SIZE),
    page: safePage,
    totalPages,
    totalItems: items.length,
  };
}

function renderToolbar(controller) {
  if (controller.section === "usage-stats") {
    return `
      <div class="data-table-toolbar oc-tenant-table-toolbar">
        <label class="data-table-search">
          <input
            type="search"
            placeholder="搜索成员、Agent 或模型"
            value="${escapeHtml(getSearchValue(controller))}"
            data-tenant-search
          />
        </label>
      </div>
    `;
  }

  const selectedCount =
    controller.section === "agent-assignment" ? getAssignmentSelection(controller).size : 0;
  return `
    <div class="data-table-toolbar oc-tenant-table-toolbar">
      <label class="data-table-search">
        <input
          type="search"
          placeholder="${controller.section === "members" ? "搜索成员账号或状态" : "搜索成员账号或状态"}"
          value="${escapeHtml(getSearchValue(controller))}"
          data-tenant-search
        />
      </label>
      <div class="oc-tenant-table-toolbar__actions">
        ${
          controller.section === "agent-assignment" && selectedCount > 0
            ? `
              <span class="oc-tenant-selection-summary">已选择 ${formatNumber(selectedCount)} 个成员</span>
              <button class="btn" type="button" data-tenant-clear-assignment-selection>清空选择</button>
              <button class="btn oc-tenant-destructive-action" type="button" data-tenant-bulk-revoke>撤回分配</button>
            `
            : ""
        }
        ${
          controller.section === "members"
            ? `<button class="btn primary" type="button" data-tenant-open-create>创建成员</button>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderMembersTable(rows) {
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>成员账号</th>
            <th>状态</th>
            <th>已分配 Agent</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (member) => `
                      <tr>
                        <td>${escapeHtml(member.username)}</td>
                        <td><span class="data-table-badge data-table-badge--${member.status === "active" ? "direct" : "unknown"}">${escapeHtml(member.status)}</span></td>
                        <td>${formatNumber(member.assignedAgentCount)}</td>
                        <td>${escapeHtml(formatDateTime(member.createdAt))}</td>
                        <td>
                          <div class="oc-tenant-table-actions oc-tenant-member-actions">
                            <button class="btn" type="button" data-tenant-open-member-password="${escapeHtml(member.id)}">更改密码</button>
                            <label class="oc-tenant-member-switch">
                              <input
                                type="checkbox"
                                role="switch"
                                data-tenant-member-status-toggle="${escapeHtml(member.id)}"
                                ${member.status === "active" ? "checked" : ""}
                                aria-label="${escapeHtml(memberStatusToggleLabel(member.status))}"
                              />
                              <span class="oc-tenant-member-switch__track" aria-hidden="true">
                                <span class="oc-tenant-member-switch__thumb"></span>
                              </span>
                              <span class="oc-tenant-member-switch__label">${escapeHtml(memberStatusLabel(member.status))}</span>
                            </label>
                          </div>
                        </td>
                      </tr>
                    `,
                  )
                  .join("")
              : `<tr><td colspan="5" class="oc-tenant-table-empty">暂无成员数据</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderAssignmentTable(rows, controller) {
  const selectableRows = rows.filter(isAssignmentSelectionTarget);
  const selectedRowsOnPage = selectableRows.filter((member) =>
    isAssignmentMemberSelected(controller, member.id),
  );
  const allSelectableRowsSelected =
    selectableRows.length > 0 && selectedRowsOnPage.length === selectableRows.length;
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th class="oc-tenant-assignment-select-col">
              <input
                type="checkbox"
                data-tenant-assignment-select-all
                aria-label="全选当前页可撤回成员"
                ${selectableRows.length ? "" : "disabled"}
                ${allSelectableRowsSelected ? "checked" : ""}
              />
            </th>
            <th>成员账号</th>
            <th>状态</th>
            <th>已分配 Agent</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (member) => `
                      <tr>
                        <td class="oc-tenant-assignment-select-cell">
                          <input
                            type="checkbox"
                            data-tenant-assignment-select="${escapeHtml(member.id)}"
                            aria-label="选择 ${escapeHtml(member.username)}"
                            ${isAssignmentSelectionTarget(member) ? "" : "disabled"}
                            ${isAssignmentMemberSelected(controller, member.id) ? "checked" : ""}
                          />
                        </td>
                        <td>${escapeHtml(member.username)}</td>
                        <td><span class="data-table-badge data-table-badge--${member.status === "active" ? "direct" : "unknown"}">${escapeHtml(member.status)}</span></td>
                        <td>${formatNumber(member.assignedAgentCount)}</td>
                        <td>${escapeHtml(formatDateTime(member.createdAt))}</td>
                        <td>
                          <div class="oc-tenant-table-actions">
                            <button class="btn" type="button" data-tenant-open-assign="${escapeHtml(member.id)}">分配Agent</button>
                            <button
                              class="btn oc-tenant-destructive-action"
                              type="button"
                              data-tenant-revoke-assignment="${escapeHtml(member.id)}"
                              ${isAssignmentSelectionTarget(member) ? "" : "disabled"}
                            >
                              撤回分配
                            </button>
                          </div>
                        </td>
                      </tr>
                    `,
                  )
                  .join("")
              : `<tr><td colspan="6" class="oc-tenant-table-empty">暂无成员数据</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderPagination(pagination) {
  return `
    <div class="data-table-pagination">
      <div class="data-table-pagination__info">
        共 ${formatNumber(pagination.totalItems)} 条，第 ${formatNumber(pagination.page)} / ${formatNumber(pagination.totalPages)} 页
      </div>
      <div class="data-table-pagination__controls">
        <button type="button" data-tenant-page="prev" ${pagination.page <= 1 ? "disabled" : ""}>上一页</button>
        <button type="button" data-tenant-page="next" ${pagination.page >= pagination.totalPages ? "disabled" : ""}>下一页</button>
      </div>
    </div>
  `;
}

function renderCreateMemberDialog() {
  return `
    <dialog class="oc-tenant-modal" data-tenant-create-dialog>
      <div class="oc-tenant-modal__panel">
        <header class="oc-tenant-modal__header">
          <h3 class="oc-tenant-modal__title">创建成员</h3>
          <button class="btn" type="button" data-tenant-close-dialog="create">关闭</button>
        </header>
        <div class="oc-tenant-modal__body">
          <form class="oc-tenant-modal__form" data-tenant-member-form>
            <label class="field"><span>成员账号</span><input name="username" type="text" required /></label>
            <label class="field"><span>成员密码</span><input name="password" type="password" required /></label>
            <div class="oc-tenant-modal__actions">
              <button class="btn primary" type="submit">创建成员</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

function renderChangePasswordDialog(controller) {
  const member = controller.passwordMember;
  return `
    <dialog class="oc-tenant-modal" data-tenant-member-password-dialog>
      <div class="oc-tenant-modal__panel">
        <header class="oc-tenant-modal__header">
          <h3 class="oc-tenant-modal__title">更改密码</h3>
          <button class="btn" type="button" data-tenant-close-dialog="password">关闭</button>
        </header>
        <div class="oc-tenant-modal__body">
          ${
            member
              ? `
                <form class="oc-tenant-modal__form" data-tenant-member-password-form>
                  <input type="hidden" name="userId" value="${escapeHtml(member.id)}" />
                  <label class="field"><span>成员账号</span><input type="text" value="${escapeHtml(member.username)}" disabled /></label>
                  <label class="field"><span>新密码</span><input name="password" type="password" autocomplete="new-password" required /></label>
                  <div class="oc-tenant-modal__actions">
                    <button class="btn primary" type="submit">保存密码</button>
                  </div>
                </form>
              `
              : `<div class="callout info">请选择成员后再操作。</div>`
          }
        </div>
      </div>
    </dialog>
  `;
}

function renderAssignDialog(controller) {
  const member = controller.activeMember;
  const localEdition = isLocalEdition(controller);
  return `
    <dialog class="oc-tenant-modal" data-tenant-assign-dialog>
      <div class="oc-tenant-modal__panel">
        <header class="oc-tenant-modal__header">
          <h3 class="oc-tenant-modal__title">分配Agent</h3>
          <button class="btn" type="button" data-tenant-close-dialog="assign">关闭</button>
        </header>
        <div class="oc-tenant-modal__body">
          ${
            member
              ? `
                <form class="oc-tenant-modal__form" data-tenant-assignment-form>
                  <input type="hidden" name="userId" value="${escapeHtml(member.id)}" />
                  <label class="field"><span>目标成员</span><input type="text" value="${escapeHtml(member.username)}" disabled /></label>
                  <label class="field">
                    <span>租户已下发 Agent</span>
                    <select name="tenantAgentId" required>
                      <option value="">请选择租户可用 Agent</option>
                      ${controller.tenantAgents
                        .map(
                          (agent) =>
                            `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.agentName)}${localEdition ? "" : ` · ${formatNumber(agent.balancePoints)} 积分`}</option>`,
                        )
                        .join("")}
                    </select>
                  </label>
                  <div class="oc-tenant-modal__actions">
                    <button class="btn primary" type="submit">保存分配</button>
                  </div>
                </form>
              `
              : `<div class="callout info">请选择成员后再操作。</div>`
          }
        </div>
      </div>
    </dialog>
  `;
}

function totalUsagePages(controller) {
  return Math.max(
    1,
    Math.ceil((Number(controller.usageTotal || 0) || 0) / (controller.usagePageSize || PAGE_SIZE)),
  );
}

function renderUsageTable(rows) {
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>成员</th>
            <th>Agent</th>
            <th>耗用总token</th>
            <th>输入</th>
            <th>输出</th>
            <th>缓存读取</th>
            <th>缓存写入</th>
            <th>耗用积分</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (row) => `
                      <tr>
                        <td>${escapeHtml(row.memberUsername ?? row.member_username ?? "-")}</td>
                        <td>${escapeHtml(row.agentName ?? row.agent_name ?? row.agentId ?? row.agent_id ?? "-")}</td>
                        <td>${formatNumber(row.totalTokens ?? row.total_tokens ?? row.tokens)}</td>
                        <td>${formatNumber(row.inputTokens ?? row.input_tokens)}</td>
                        <td>${formatNumber(row.outputTokens ?? row.output_tokens)}</td>
                        <td>${formatNumber(row.cacheReadTokens ?? row.cache_read_tokens)}</td>
                        <td>${formatNumber(row.cacheWriteTokens ?? row.cache_write_tokens)}</td>
                        <td>${escapeHtml(formatCredits(row.creditsUsed ?? row.credits_used))}</td>
                        <td>${escapeHtml(formatDateTime(row.createdAt))}</td>
                      </tr>
                    `,
                  )
                  .join("")
              : `<tr><td colspan="9" class="oc-tenant-table-empty">暂无耗量记录</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderUsagePagination(controller) {
  return renderPagination({
    totalItems: controller.usageTotal,
    page: getPageValue(controller),
    totalPages: totalUsagePages(controller),
  });
}

function renderUsageList(controller) {
  return `
    <div class="data-table-wrapper">
      ${renderUsageTable(controller.usageItems)}
      ${renderUsagePagination(controller)}
    </div>
  `;
}

function captureRenderFocusState(root) {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement) || !root.contains(active)) {
    return null;
  }
  if (active.hasAttribute("data-tenant-search")) {
    return {
      kind: "search",
      selectionStart: active.selectionStart,
      selectionEnd: active.selectionEnd,
    };
  }
  return null;
}

function restoreRenderFocusState(root, state) {
  if (!state) {
    return;
  }
  if (state.kind === "search") {
    const input = root.querySelector("[data-tenant-search]");
    if (input instanceof HTMLInputElement) {
      input.focus();
      if (typeof state.selectionStart === "number" && typeof state.selectionEnd === "number") {
        try {
          input.setSelectionRange(state.selectionStart, state.selectionEnd);
        } catch {
          // Ignore unsupported selection restoration.
        }
      }
    }
  }
}

function syncAssignmentSelectionState(root, controller, rows) {
  if (controller.section !== "agent-assignment") {
    return;
  }
  const selectAll = root.querySelector("[data-tenant-assignment-select-all]");
  if (!(selectAll instanceof HTMLInputElement)) {
    return;
  }
  const selectableRows = rows.filter(isAssignmentSelectionTarget);
  const selectedRows = selectableRows.filter((member) =>
    isAssignmentMemberSelected(controller, member.id),
  );
  selectAll.checked = selectableRows.length > 0 && selectedRows.length === selectableRows.length;
  selectAll.indeterminate = selectedRows.length > 0 && selectedRows.length < selectableRows.length;
  selectAll.disabled = selectableRows.length === 0;
}

function render(root, controller) {
  const focusState = captureRenderFocusState(root);
  const isUsageStats = controller.section === "usage-stats";
  const isOverview = controller.section === "statistics-overview";
  if (controller.section === "agent-assignment") {
    pruneAssignmentSelection(controller);
  }
  const pagination =
    isUsageStats || isOverview
      ? null
      : paginate(filterMembers(controller), getPageValue(controller));
  if (pagination) {
    setPageValue(controller, pagination.page);
  }

  const contentMarkup = isUsageStats
    ? renderUsageList(controller)
    : isOverview
      ? renderTenantOverview(controller)
      : `
        <div class="data-table-wrapper">
          ${
            controller.section === "agent-assignment"
              ? renderAssignmentTable(pagination.items, controller)
              : renderMembersTable(pagination.items)
          }
          ${renderPagination(pagination)}
        </div>
      `;

  root.dataset.ocTenantEmbedded = "true";
  root.innerHTML = `
    <section class="oc-tenant-list-view ${isUsageStats || isOverview ? "oc-tenant-list-view--scrollable" : ""}">
      ${renderToolbar(controller)}
      ${contentMarkup}
    </section>
    ${
      isUsageStats || isOverview
        ? ""
        : `${renderCreateMemberDialog()}${renderChangePasswordDialog(controller)}${renderAssignDialog(controller)}`
    }
  `;

  if (isOverview) {
    void initTenantOverviewCharts(root, controller);
  }

  if (!isUsageStats && !isOverview) {
    if (controller.dialogs.createMemberOpen) {
      openDialog(root.querySelector("[data-tenant-create-dialog]"));
    }
    if (controller.dialogs.changePasswordOpen) {
      openDialog(root.querySelector("[data-tenant-member-password-dialog]"));
    }
    if (controller.dialogs.assignOpen) {
      openDialog(root.querySelector("[data-tenant-assign-dialog]"));
    }
  }
  if (controller.section === "agent-assignment") {
    syncAssignmentSelectionState(root, controller, pagination?.items || []);
  }
  restoreRenderFocusState(root, focusState);
}

async function refresh(root, controller) {
  if (controller.section === "usage-stats") {
    const search = getSearchValue(controller).trim();
    const page = getPageValue(controller);
    const data = await controller.apiClient.listTenantUsageStats({
      page,
      pageSize: controller.usagePageSize || PAGE_SIZE,
      search,
    });
    controller.usageItems = Array.isArray(data?.items) ? data.items : [];
    controller.usageTotal = Number(data?.total || 0);
    controller.usagePageSize =
      Number(data?.pageSize || controller.usagePageSize || PAGE_SIZE) || PAGE_SIZE;
    const currentPage = Number(data?.page || page) || 1;
    const totalPages = totalUsagePages(controller);
    controller.pageBySection["usage-stats"] = Math.min(Math.max(1, currentPage), totalPages);
    if (controller.pageBySection["usage-stats"] !== currentPage) {
      return refresh(root, controller);
    }
    render(root, controller);
    return;
  }

  if (controller.section === "statistics-overview") {
    await refreshTenantOverview(root, controller);
    render(root, controller);
    return;
  }

  const [members, tenantAgents] = await Promise.all([
    controller.apiClient.listTenantMembers(),
    controller.apiClient.listTenantAgents(),
  ]);
  controller.members = members;
  controller.tenantAgents = tenantAgents;
  if (
    controller.activeMember &&
    !members.some((member) => member.id === controller.activeMember.id)
  ) {
    controller.activeMember = null;
  }
  render(root, controller);
}

function memberById(controller, userId) {
  return controller.members.find((member) => member.id === userId) ?? null;
}

async function updateMemberStatus(root, controller, input) {
  const userId = String(input.dataset.tenantMemberStatusToggle || "").trim();
  const member = memberById(controller, userId);
  if (!userId || !member) {
    return;
  }
  const nextStatus = input.checked ? "active" : "inactive";
  input.disabled = true;
  try {
    await controller.apiClient.updateTenantMemberStatus({
      userId,
      status: nextStatus,
    });
    await refresh(root, controller);
    setFeedback(root, nextStatus === "active" ? "成员已启用。" : "成员已禁用。");
  } catch (error) {
    render(root, controller);
    setFeedback(root, error instanceof Error ? error.message : String(error), true);
  }
}

async function revokeAssignmentMembers(root, controller, userIds) {
  const normalizedUserIds = [
    ...new Set(userIds.map((userId) => String(userId || "").trim()).filter(Boolean)),
  ];
  if (!normalizedUserIds.length || controller.assignmentRevokeBusy) {
    return;
  }

  const selectedMembers = normalizedUserIds
    .map((userId) => memberById(controller, userId))
    .filter(Boolean);
  const promptLabel =
    normalizedUserIds.length === 1
      ? `成员“${selectedMembers[0]?.username || normalizedUserIds[0]}”`
      : `选中的 ${formatNumber(normalizedUserIds.length)} 个成员`;
  let confirmed = true;
  if (typeof window.confirm === "function") {
    try {
      confirmed = window.confirm(`确认撤回${promptLabel}的 Agent 分配吗？`);
    } catch {
      confirmed = false;
    }
  }
  if (!confirmed) {
    return;
  }

  controller.assignmentRevokeBusy = true;
  try {
    const result = await controller.apiClient.revokeTenantAgentAssignments({
      userIds: normalizedUserIds,
    });
    const selection = getAssignmentSelection(controller);
    for (const userId of normalizedUserIds) {
      selection.delete(userId);
    }
    await refresh(root, controller);
    const revokedAssignmentCount = Number(result?.revokedAssignmentCount || 0);
    const affectedMemberCount = Number(
      result?.affectedMemberCount || normalizedUserIds.length || 0,
    );
    if (revokedAssignmentCount > 0) {
      setFeedback(
        root,
        affectedMemberCount > 1
          ? `已撤回 ${affectedMemberCount} 个成员的 ${revokedAssignmentCount} 条 Agent 分配。`
          : `成员 Agent 分配已撤回，共 ${revokedAssignmentCount} 条记录。`,
      );
      return;
    }
    setFeedback(root, "未找到可撤回的 Agent 分配。");
  } catch (error) {
    render(root, controller);
    setFeedback(root, error instanceof Error ? error.message : String(error), true);
  } finally {
    controller.assignmentRevokeBusy = false;
  }
}

async function handleClick(root, controller, event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const paginationButton = target.closest("[data-tenant-page]");
  if (paginationButton instanceof HTMLElement) {
    const action = paginationButton.dataset.tenantPage;
    const currentPage = getPageValue(controller);
    setPageValue(controller, action === "next" ? currentPage + 1 : currentPage - 1);
    if (controller.section === "usage-stats") {
      void refresh(root, controller);
      return;
    }
    render(root, controller);
    return;
  }

  if (target.closest("[data-tenant-open-create]")) {
    controller.dialogs.createMemberOpen = true;
    render(root, controller);
    return;
  }

  const passwordTrigger = target.closest("[data-tenant-open-member-password]");
  if (passwordTrigger instanceof HTMLElement) {
    controller.passwordMember = memberById(
      controller,
      passwordTrigger.dataset.tenantOpenMemberPassword,
    );
    if (!controller.passwordMember) {
      return;
    }
    controller.dialogs.changePasswordOpen = true;
    render(root, controller);
    return;
  }

  const closeDialogTrigger = target.closest("[data-tenant-close-dialog]");
  if (closeDialogTrigger instanceof HTMLElement) {
    const dialogKind = closeDialogTrigger.dataset.tenantCloseDialog || "";
    if (dialogKind === "create") {
      controller.dialogs.createMemberOpen = false;
      closeDialog(root.querySelector("[data-tenant-create-dialog]"));
    }
    if (dialogKind === "assign") {
      controller.dialogs.assignOpen = false;
      closeDialog(root.querySelector("[data-tenant-assign-dialog]"));
    }
    if (dialogKind === "password") {
      controller.dialogs.changePasswordOpen = false;
      controller.passwordMember = null;
      closeDialog(root.querySelector("[data-tenant-member-password-dialog]"));
    }
    render(root, controller);
    return;
  }

  const assignTrigger = target.closest("[data-tenant-open-assign]");
  if (assignTrigger instanceof HTMLElement) {
    controller.activeMember = memberById(controller, assignTrigger.dataset.tenantOpenAssign);
    controller.dialogs.assignOpen = true;
    render(root, controller);
    return;
  }

  const revokeTrigger = target.closest("[data-tenant-revoke-assignment]");
  if (revokeTrigger instanceof HTMLElement) {
    await revokeAssignmentMembers(root, controller, [revokeTrigger.dataset.tenantRevokeAssignment]);
    return;
  }

  const clearSelectionTrigger = target.closest("[data-tenant-clear-assignment-selection]");
  if (clearSelectionTrigger instanceof HTMLElement) {
    clearAssignmentSelection(controller);
    render(root, controller);
    return;
  }

  const batchRevokeTrigger = target.closest("[data-tenant-bulk-revoke]");
  if (batchRevokeTrigger instanceof HTMLElement) {
    await revokeAssignmentMembers(root, controller, Array.from(getAssignmentSelection(controller)));
    return;
  }
}

function handleInput(root, controller, event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.hasAttribute("data-tenant-member-status-toggle")) {
    void updateMemberStatus(root, controller, target);
    return;
  }
  if (target.hasAttribute("data-tenant-assignment-select-all")) {
    const visibleMembers = paginate(filterMembers(controller), getPageValue(controller)).items;
    const selected = target.checked;
    for (const member of visibleMembers) {
      if (!isAssignmentSelectionTarget(member)) {
        continue;
      }
      setAssignmentMemberSelected(controller, member.id, selected);
    }
    render(root, controller);
    return;
  }
  if (target.hasAttribute("data-tenant-assignment-select")) {
    setAssignmentMemberSelected(controller, target.dataset.tenantAssignmentSelect, target.checked);
    render(root, controller);
    return;
  }
  if (target.hasAttribute("data-tenant-search")) {
    controller.searchBySection[controller.section] = target.value;
    setPageValue(controller, 1);
    if (controller.section === "usage-stats") {
      if (controller.usageSearchTimer) {
        window.clearTimeout(controller.usageSearchTimer);
      }
      controller.usageSearchTimer = window.setTimeout(() => {
        controller.usageSearchTimer = null;
        void refresh(root, controller);
      }, USAGE_SEARCH_DEBOUNCE_MS);
      return;
    }
    render(root, controller);
    return;
  }
}

async function handleSubmit(root, controller, event) {
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) {
    return;
  }

  if (target.matches("[data-tenant-member-form]")) {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(target).entries());
      await controller.apiClient.createTenantMember(payload);
      controller.dialogs.createMemberOpen = false;
      await refresh(root, controller);
      closeDialog(root.querySelector("[data-tenant-create-dialog]"));
      setFeedback(root, "成员已创建。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
    return;
  }

  if (target.matches("[data-tenant-member-password-form]")) {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(target).entries());
      await controller.apiClient.updateTenantMemberPassword(payload);
      controller.dialogs.changePasswordOpen = false;
      controller.passwordMember = null;
      await refresh(root, controller);
      closeDialog(root.querySelector("[data-tenant-member-password-dialog]"));
      setFeedback(root, "成员密码已更新。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
    return;
  }

  if (target.matches("[data-tenant-assignment-form]")) {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(target).entries());
      await controller.apiClient.assignTenantAgent(payload);
      controller.dialogs.assignOpen = false;
      await refresh(root, controller);
      closeDialog(root.querySelector("[data-tenant-assign-dialog]"));
      setFeedback(root, "成员 Agent 分配已生效。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
  }
}

export async function mountTenantConsolePage(root, options = {}) {
  if (!(root instanceof HTMLElement)) {
    return null;
  }

  const session = requireTenantSession(["tenant_admin"], { loginHref: TENANT_LOGIN_ROUTE });
  if (!session) {
    return null;
  }

  const apiClient = createTenantApiClient();
  const controller = ensureController(root, session, apiClient);
  const previousSection = controller.section;
  controller.section = options.section || "members";
  if (previousSection !== controller.section || controller.section !== "agent-assignment") {
    clearAssignmentSelection(controller);
  }
  if (previousSection === "usage-stats" && controller.usageSearchTimer) {
    window.clearTimeout(controller.usageSearchTimer);
    controller.usageSearchTimer = null;
  }
  if (controller.section !== "members") {
    controller.dialogs.createMemberOpen = false;
    controller.dialogs.changePasswordOpen = false;
    controller.passwordMember = null;
  }
  if (controller.section !== "agent-assignment") {
    controller.dialogs.assignOpen = false;
  }
  if (controller.section === "usage-stats") {
    controller.dialogs.createMemberOpen = false;
    controller.dialogs.assignOpen = false;
    controller.dialogs.changePasswordOpen = false;
    controller.passwordMember = null;
  }
  await refresh(root, controller);
  return { root };
}
