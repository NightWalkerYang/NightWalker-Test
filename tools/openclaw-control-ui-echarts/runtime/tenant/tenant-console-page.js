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

function escapeAttribute(value) {
  return escapeHtml(value)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function normalizeMemberOrgScopeMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "all" || normalized === "custom" ? normalized : "none";
}

function normalizeSearchQuery(value) {
  return String(value || "").trim().toLowerCase();
}

function getCurrentTenantDataSourceBinding(controller) {
  if (!(controller?.currentDataSourceBinding && typeof controller.currentDataSourceBinding === "object")) {
    return null;
  }
  return controller.currentDataSourceBinding;
}

function hasCurrentTenantBoundDataSource(controller) {
  const binding = getCurrentTenantDataSourceBinding(controller);
  return Boolean(
    String(binding?.dataSourceId || binding?.dataSourceName || binding?.name || "").trim(),
  );
}

function getMemberOrgScopeSummary(member, controller) {
  if (!hasCurrentTenantBoundDataSource(controller)) {
    return "未绑定数据源";
  }
  const scopeMode = normalizeMemberOrgScopeMode(member?.orgScopeMode);
  if (scopeMode === "all") {
    return "全部组织";
  }
  if (scopeMode === "custom") {
    return `${formatNumber(member?.orgScopeCount)} 个组织`;
  }
  return "未分配";
}

function getMemberSandboxSummary(member) {
  return Number(member?.sandboxEnabled || 0) > 0 ? "已启用" : "未启用";
}

function getEffectiveMemberStatus(controller, member) {
  const userId = String(member?.id || "").trim();
  const pendingStatus =
    userId && controller?.pendingMemberStatuses instanceof Map
      ? String(controller.pendingMemberStatuses.get(userId) || "").trim()
      : "";
  if (pendingStatus === "active" || pendingStatus === "inactive") {
    return pendingStatus;
  }
  return String(member?.status || "").trim();
}

function isMemberStatusBusy(controller, userId) {
  const normalized = String(userId || "").trim();
  return Boolean(
    normalized &&
      controller?.busyMemberStatusIds instanceof Set &&
      controller.busyMemberStatusIds.has(normalized),
  );
}

function createDeleteMemberDialogState() {
  return {
    id: "",
    username: "",
    assignedAgentCount: 0,
  };
}

function getDeleteMemberTarget(controller) {
  if (!(controller?.deleteMemberTarget && typeof controller.deleteMemberTarget === "object")) {
    controller.deleteMemberTarget = createDeleteMemberDialogState();
  }
  return controller.deleteMemberTarget;
}

function createAgentDetailDialogState() {
  return {
    open: false,
    agentId: "",
  };
}

function getAgentDetailDialog(controller) {
  if (!(controller?.agentDetailDialog && typeof controller.agentDetailDialog === "object")) {
    controller.agentDetailDialog = createAgentDetailDialogState();
  }
  return controller.agentDetailDialog;
}

function getTenantAgentDisplayName(agent) {
  for (const candidate of [agent?.agentName, agent?.description, agent?.agentId, agent?.id]) {
    const value = String(candidate || "").trim();
    if (value) {
      return value;
    }
  }
  return "未知 Agent";
}

function getTenantAgentStatusVariant(status) {
  return String(status || "").trim() === "active" ? "direct" : "unknown";
}

function renderTenantAgentVisual(agent) {
  const avatar = String(agent?.avatar || "").trim();
  const emoji = String(agent?.emoji || "").trim();
  const label = getTenantAgentDisplayName(agent);
  if (avatar) {
    return `
      <span class="oc-tenant-agent-card__visual oc-tenant-agent-card__visual--image">
        <img src="${escapeAttribute(avatar)}" alt="${escapeAttribute(label)}" />
      </span>
    `;
  }
  if (emoji) {
    return `<span class="oc-tenant-agent-card__visual">${escapeHtml(emoji)}</span>`;
  }
  return `<span class="oc-tenant-agent-card__visual">${escapeHtml(label.slice(0, 1).toUpperCase() || "A")}</span>`;
}

function createRevokeAssignmentDialogState() {
  return {
    open: false,
    loading: false,
    busy: false,
    confirmOpen: false,
    confirmSelectedAssignmentIds: [],
    memberId: "",
    memberUsername: "",
    assignments: [],
    selectedAssignmentIds: new Set(),
    error: "",
    requestToken: 0,
  };
}

function getRevokeAssignmentDialog(controller) {
  if (
    !(controller?.revokeAssignmentDialog && typeof controller.revokeAssignmentDialog === "object")
  ) {
    controller.revokeAssignmentDialog = createRevokeAssignmentDialogState();
  }
  return controller.revokeAssignmentDialog;
}

function isRevokeAssignmentSelectionTarget(member) {
  return Number(member?.assignedAgentCount || 0) > 0;
}

function getRevokeAssignmentSelectableAssignments(dialog) {
  if (!Array.isArray(dialog?.assignments)) {
    return [];
  }
  return dialog.assignments.filter((assignment) =>
    Boolean(String(assignment?.assignmentId || "").trim()),
  );
}

function isRevokeAssignmentPlaceholderLabel(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return true;
  }
  const lowered = normalized.toLowerCase();
  return (
    lowered === "not_found" ||
    lowered === "not found" ||
    lowered === "unknown" ||
    normalized === "未知 Agent"
  );
}

function getRevokeAssignmentDisplayName(assignment) {
  for (const candidate of [
    assignment?.displayName,
    assignment?.agentName,
    assignment?.description,
    assignment?.baseAgentId,
    assignment?.derivedAgentId,
    assignment?.assignmentId,
  ]) {
    if (!isRevokeAssignmentPlaceholderLabel(candidate)) {
      return String(candidate || "").trim();
    }
  }
  return "未知 Agent";
}

function getRevokeAssignmentConfirmAssignments(dialog) {
  const selectedAssignmentIds = new Set(
    Array.isArray(dialog?.confirmSelectedAssignmentIds)
      ? dialog.confirmSelectedAssignmentIds
          .map((assignmentId) => String(assignmentId || "").trim())
          .filter(Boolean)
      : [],
  );
  if (!selectedAssignmentIds.size) {
    return [];
  }
  return getRevokeAssignmentSelectableAssignments(dialog).filter((assignment) =>
    selectedAssignmentIds.has(String(assignment.assignmentId || "").trim()),
  );
}

function isRevokeAssignmentSelected(controller, assignmentId) {
  return getRevokeAssignmentDialog(controller).selectedAssignmentIds.has(
    String(assignmentId || "").trim(),
  );
}

function setRevokeAssignmentSelected(controller, assignmentId, selected) {
  const normalized = String(assignmentId || "").trim();
  if (!normalized) {
    return;
  }
  const dialog = getRevokeAssignmentDialog(controller);
  if (selected) {
    dialog.selectedAssignmentIds.add(normalized);
    return;
  }
  dialog.selectedAssignmentIds.delete(normalized);
}

function clearRevokeAssignmentSelection(controller) {
  getRevokeAssignmentDialog(controller).selectedAssignmentIds.clear();
}

function pruneRevokeAssignmentSelection(controller) {
  const dialog = controller?.revokeAssignmentDialog;
  if (!dialog?.open) {
    return;
  }
  const assignmentIds = new Set(
    getRevokeAssignmentSelectableAssignments(dialog).map((assignment) =>
      String(assignment.assignmentId || "").trim(),
    ),
  );
  for (const assignmentId of Array.from(dialog.selectedAssignmentIds)) {
    if (!assignmentIds.has(assignmentId)) {
      dialog.selectedAssignmentIds.delete(assignmentId);
    }
  }
}

function createAssignAgentDialogState() {
  return {
    open: false,
    loading: false,
    busy: false,
    memberId: "",
    memberUsername: "",
    agents: [],
    assignedAgentIds: new Set(),
    selectedAgentIds: new Set(),
    error: "",
    requestToken: 0,
  };
}

function getAssignAgentDialog(controller) {
  if (!(controller?.assignAgentDialog && typeof controller.assignAgentDialog === "object")) {
    controller.assignAgentDialog = createAssignAgentDialogState();
  }
  return controller.assignAgentDialog;
}

function getAssignableTenantAgents(dialog) {
  if (!Array.isArray(dialog?.agents)) {
    return [];
  }
  const assignedAgentIds =
    dialog?.assignedAgentIds instanceof Set ? dialog.assignedAgentIds : new Set();
  return dialog.agents.filter((agent) => {
    const agentId = String(agent?.id || "").trim();
    return Boolean(agentId) && !assignedAgentIds.has(agentId);
  });
}

function getAssignAgentDisplayName(agent) {
  for (const candidate of [agent?.agentName, agent?.description, agent?.agentId, agent?.id]) {
    const value = String(candidate || "").trim();
    if (value) {
      return value;
    }
  }
  return "未知 Agent";
}

function isAssignAgentSelected(controller, agentId) {
  return getAssignAgentDialog(controller).selectedAgentIds.has(String(agentId || "").trim());
}

function setAssignAgentSelected(controller, agentId, selected) {
  const normalized = String(agentId || "").trim();
  if (!normalized) {
    return;
  }
  const dialog = getAssignAgentDialog(controller);
  if (selected) {
    dialog.selectedAgentIds.add(normalized);
    return;
  }
  dialog.selectedAgentIds.delete(normalized);
}

function clearAssignAgentSelection(controller) {
  getAssignAgentDialog(controller).selectedAgentIds.clear();
}

function pruneAssignAgentSelection(controller) {
  const dialog = controller?.assignAgentDialog;
  if (!dialog?.open) {
    return;
  }
  const agentIds = new Set(
    getAssignableTenantAgents(dialog).map((agent) => String(agent.id || "").trim()),
  );
  for (const agentId of Array.from(dialog.selectedAgentIds)) {
    if (!agentIds.has(agentId)) {
      dialog.selectedAgentIds.delete(agentId);
    }
  }
}

function syncAssignAgentSelectionState(root, controller) {
  const dialog = controller.assignAgentDialog;
  if (controller.section !== "agent-assignment" || !dialog?.open) {
    return;
  }
  const selectAll = root.querySelector("[data-tenant-assign-agent-select-all]");
  if (!(selectAll instanceof HTMLInputElement)) {
    return;
  }
  const selectableAgents = getAssignableTenantAgents(dialog);
  const selectedAgents = selectableAgents.filter((agent) =>
    dialog.selectedAgentIds.has(String(agent.id || "").trim()),
  );
  selectAll.checked =
    selectableAgents.length > 0 &&
    selectedAgents.length === selectableAgents.length &&
    !dialog.loading &&
    !dialog.busy;
  selectAll.indeterminate =
    selectedAgents.length > 0 && selectedAgents.length < selectableAgents.length;
  selectAll.disabled = selectableAgents.length === 0 || dialog.loading || dialog.busy;
}

function createMemberOrgScopeDialogState() {
  return {
    open: false,
    loading: false,
    busy: false,
    memberId: "",
    memberUsername: "",
    dataSourceName: "",
    dataSourceId: "",
    scopeMode: "none",
    sandboxEnabled: false,
    orgs: [],
    selectedOrgIds: new Set(),
    searchQuery: "",
    error: "",
    requestToken: 0,
  };
}

function getMemberOrgScopeDialog(controller) {
  if (
    !(controller?.memberOrgScopeDialog && typeof controller.memberOrgScopeDialog === "object")
  ) {
    controller.memberOrgScopeDialog = createMemberOrgScopeDialogState();
  }
  return controller.memberOrgScopeDialog;
}

function getMemberOrgScopeSelectableOrgs(dialog) {
  if (!Array.isArray(dialog?.orgs)) {
    return [];
  }
  return dialog.orgs.filter((org) => Boolean(String(org?.orgId || "").trim()));
}

function getVisibleMemberOrgScopeOrgs(dialog) {
  const selectableOrgs = getMemberOrgScopeSelectableOrgs(dialog);
  const query = normalizeSearchQuery(dialog?.searchQuery);
  if (!query) {
    return selectableOrgs;
  }
  return selectableOrgs.filter((org) =>
    [org?.orgNumber, org?.orgId, org?.orgName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
}

function setMemberOrgScopeSelected(controller, orgId, selected) {
  const normalized = String(orgId || "").trim();
  if (!normalized) {
    return;
  }
  const dialog = getMemberOrgScopeDialog(controller);
  if (selected) {
    dialog.selectedOrgIds.add(normalized);
    return;
  }
  dialog.selectedOrgIds.delete(normalized);
}

function setMemberOrgScopeMode(controller, mode) {
  getMemberOrgScopeDialog(controller).scopeMode = normalizeMemberOrgScopeMode(mode);
}

function syncMemberOrgScopeSelectionState(root, controller) {
  const dialog = controller.memberOrgScopeDialog;
  if (controller.section !== "members" || !dialog?.open || dialog.scopeMode !== "custom") {
    return;
  }
  const selectAll = root.querySelector("[data-tenant-member-org-scope-select-all]");
  if (!(selectAll instanceof HTMLInputElement)) {
    return;
  }
  const selectableOrgs = getVisibleMemberOrgScopeOrgs(dialog);
  const selectedOrgs = selectableOrgs.filter((org) =>
    dialog.selectedOrgIds.has(String(org.orgId || "").trim()),
  );
  selectAll.checked =
    selectableOrgs.length > 0 &&
    selectedOrgs.length === selectableOrgs.length &&
    !dialog.loading &&
    !dialog.busy;
  selectAll.indeterminate = selectedOrgs.length > 0 && selectedOrgs.length < selectableOrgs.length;
  selectAll.disabled = selectableOrgs.length === 0 || dialog.loading || dialog.busy;
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
      "owned-agents": "",
      "usage-stats": "",
    },
    pageBySection: {
      members: 1,
      "agent-assignment": 1,
      "owned-agents": 1,
      "usage-stats": 1,
    },
    members: [],
    currentDataSourceBinding: null,
    tenantAgents: [],
    busyMemberStatusIds: new Set(),
    pendingMemberStatuses: new Map(),
    agentDetailDialog: createAgentDetailDialogState(),
    activeMember: null,
    assignAgentDialog: createAssignAgentDialogState(),
    memberOrgScopeDialog: createMemberOrgScopeDialogState(),
    passwordMember: null,
    deleteMemberTarget: createDeleteMemberDialogState(),
    revokeAssignmentDialog: createRevokeAssignmentDialogState(),
    usageItems: [],
    usageTotal: 0,
    usagePageSize: PAGE_SIZE,
    usageSearchTimer: null,
    dialogs: {
      createMemberOpen: false,
      assignOpen: false,
      changePasswordOpen: false,
      deleteMemberOpen: false,
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
    if (event.target.matches("[data-tenant-member-org-scope-dialog]")) {
      controller.memberOrgScopeDialog = createMemberOrgScopeDialogState();
    }
    if (event.target.matches("[data-tenant-member-password-dialog]")) {
      controller.dialogs.changePasswordOpen = false;
      controller.passwordMember = null;
    }
    if (event.target.matches("[data-tenant-member-delete-dialog]")) {
      controller.dialogs.deleteMemberOpen = false;
      controller.deleteMemberTarget = createDeleteMemberDialogState();
    }
    if (event.target.matches("[data-tenant-agent-detail-dialog]")) {
      controller.agentDetailDialog = createAgentDetailDialogState();
    }
    if (event.target.matches("[data-tenant-revoke-assignment-dialog]")) {
      controller.revokeAssignmentDialog = createRevokeAssignmentDialogState();
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

  if (controller.section === "owned-agents") {
    return `
      <div class="data-table-toolbar oc-tenant-table-toolbar">
        <label class="data-table-search">
          <input
            type="search"
            placeholder="搜索 Agent 名称、标识或说明"
            value="${escapeHtml(getSearchValue(controller))}"
            data-tenant-search
          />
        </label>
      </div>
    `;
  }

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
          controller.section === "members"
            ? `<button class="btn primary" type="button" data-tenant-open-create>创建成员</button>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderMembersTable(rows, controller) {
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>成员账号</th>
            <th>状态</th>
            <th>组织范围</th>
            <th>沙盒模拟</th>
            <th>已分配 Agent</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map((member) => {
                    const effectiveStatus = getEffectiveMemberStatus(controller, member);
                    const statusBusy = isMemberStatusBusy(controller, member.id);
                    return `
                      <tr>
                        <td>${escapeHtml(member.username)}</td>
                        <td><span class="data-table-badge data-table-badge--${effectiveStatus === "active" ? "direct" : "unknown"}">${escapeHtml(effectiveStatus)}</span></td>
                        <td>
                          <div class="oc-tenant-member-org-scope-summary">
                            ${escapeHtml(getMemberOrgScopeSummary(member, controller))}
                          </div>
                        </td>
                        <td>${escapeHtml(getMemberSandboxSummary(member))}</td>
                        <td>${formatNumber(member.assignedAgentCount)}</td>
                        <td>${escapeHtml(formatDateTime(member.createdAt))}</td>
                        <td>
                          <div class="oc-tenant-table-actions oc-tenant-member-actions">
                            <button
                              class="btn"
                              type="button"
                              data-tenant-open-member-org-scope="${escapeHtml(member.id)}"
                              ${hasCurrentTenantBoundDataSource(controller) ? "" : "disabled"}
                            >
                              选择组织范围
                            </button>
                            <button class="btn" type="button" data-tenant-open-member-password="${escapeHtml(member.id)}">更改密码</button>
                            <button
                              class="btn oc-tenant-destructive-action"
                              type="button"
                              data-tenant-open-member-delete="${escapeHtml(member.id)}"
                            >
                              删除成员
                            </button>
                            <label class="oc-tenant-member-switch">
                              <input
                                type="checkbox"
                                role="switch"
                                data-tenant-member-status-toggle="${escapeHtml(member.id)}"
                                ${effectiveStatus === "active" ? "checked" : ""}
                                ${statusBusy ? "disabled" : ""}
                                aria-label="${escapeHtml(memberStatusToggleLabel(effectiveStatus))}"
                              />
                              <span class="oc-tenant-member-switch__track" aria-hidden="true">
                                <span class="oc-tenant-member-switch__thumb"></span>
                              </span>
                              <span class="oc-tenant-member-switch__label">${escapeHtml(memberStatusLabel(effectiveStatus))}</span>
                            </label>
                          </div>
                        </td>
                      </tr>
                    `;
                  })
                  .join("")
              : `<tr><td colspan="7" class="oc-tenant-table-empty">暂无成员数据</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderAssignmentTable(rows, controller) {
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
                          <div class="oc-tenant-table-actions">
                            <button class="btn" type="button" data-tenant-open-assign="${escapeHtml(member.id)}">分配Agent</button>
                            <button
                              class="btn oc-tenant-destructive-action"
                              type="button"
                              data-tenant-revoke-assignment="${escapeHtml(member.id)}"
                              ${isRevokeAssignmentSelectionTarget(member) ? "" : "disabled"}
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

function filterTenantAgents(controller) {
  const query = getSearchValue(controller).trim().toLowerCase();
  if (!query) {
    return Array.isArray(controller.tenantAgents) ? controller.tenantAgents : [];
  }
  return (Array.isArray(controller.tenantAgents) ? controller.tenantAgents : []).filter((agent) =>
    [agent?.agentName, agent?.agentId, agent?.description, agent?.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
}

function renderOwnedAgentsCards(rows, controller) {
  const localEdition = isLocalEdition(controller);
  if (!rows.length) {
    return `<div class="callout info oc-tenant-agent-empty">当前租户还没有可查看的 Agent。</div>`;
  }
  return `
    <div class="oc-tenant-agent-grid">
      ${rows
        .map(
          (agent) => `
            <article class="oc-tenant-agent-card" data-tenant-agent-card="${escapeAttribute(agent.id)}">
              <div class="oc-tenant-agent-card__header">
                <div class="oc-tenant-agent-card__identity">
                  ${renderTenantAgentVisual(agent)}
                  <div class="oc-tenant-agent-card__copy">
                    <h3 class="oc-tenant-agent-card__title">${escapeHtml(getTenantAgentDisplayName(agent))}</h3>
                    <div class="oc-tenant-agent-card__subtitle">${escapeHtml(agent.agentId || agent.id || "-")}</div>
                  </div>
                </div>
                <span class="data-table-badge data-table-badge--${getTenantAgentStatusVariant(agent.status)}">${escapeHtml(agent.status || "unknown")}</span>
              </div>
              <p class="oc-tenant-agent-card__description">${escapeHtml(agent.description || "暂无说明")}</p>
              <dl class="oc-tenant-agent-card__meta">
                ${
                  localEdition
                    ? `<div><dt>部署模式</dt><dd>本地版</dd></div>`
                    : `<div><dt>余额积分</dt><dd>${formatCredits(agent.balancePoints)}</dd></div>`
                }
                <div><dt>计费倍率</dt><dd>${formatCredits(agent.rateMultiplier || 1)}</dd></div>
                <div><dt>更新时间</dt><dd>${escapeHtml(formatDateTime(agent.updatedAt || agent.createdAt))}</dd></div>
              </dl>
              <div class="oc-tenant-agent-card__actions">
                <button
                  class="btn"
                  type="button"
                  data-tenant-open-agent-detail="${escapeAttribute(agent.id)}"
                >
                  详情
                </button>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function getAgentDetailTarget(controller) {
  const dialog = getAgentDetailDialog(controller);
  const agentId = String(dialog.agentId || "").trim();
  if (!agentId) {
    return null;
  }
  return (
    (Array.isArray(controller.tenantAgents) ? controller.tenantAgents : []).find(
      (agent) => String(agent?.id || "").trim() === agentId,
    ) || null
  );
}

function renderAgentDetailDialog(controller) {
  const agent = getAgentDetailTarget(controller);
  const localEdition = isLocalEdition(controller);
  return `
    <dialog class="oc-tenant-modal" data-tenant-agent-detail-dialog>
      <div class="oc-tenant-modal__panel">
        <header class="oc-tenant-modal__header">
          <h3 class="oc-tenant-modal__title">Agent 详情</h3>
          <button class="btn" type="button" data-tenant-close-dialog="agent-detail">关闭</button>
        </header>
        <div class="oc-tenant-modal__body">
          ${
            agent
              ? `
                <div class="oc-tenant-agent-detail">
                  <div class="oc-tenant-agent-detail__hero">
                    ${renderTenantAgentVisual(agent)}
                    <div class="oc-tenant-agent-detail__hero-copy">
                      <div class="oc-tenant-agent-detail__name">${escapeHtml(getTenantAgentDisplayName(agent))}</div>
                      <div class="oc-tenant-agent-detail__subtitle">${escapeHtml(agent.agentId || agent.id || "-")}</div>
                    </div>
                  </div>
                  <dl class="oc-tenant-agent-detail__grid">
                    <div>
                      <dt>租户 Agent ID</dt>
                      <dd>${escapeHtml(agent.id || "-")}</dd>
                    </div>
                    <div>
                      <dt>状态</dt>
                      <dd>${escapeHtml(agent.status || "-")}</dd>
                    </div>
                    <div>
                      <dt>计费倍率</dt>
                      <dd>${formatCredits(agent.rateMultiplier || 1)}</dd>
                    </div>
                    <div>
                      <dt>${localEdition ? "部署模式" : "余额积分"}</dt>
                      <dd>${localEdition ? "本地版" : formatCredits(agent.balancePoints)}</dd>
                    </div>
                    <div>
                      <dt>创建时间</dt>
                      <dd>${escapeHtml(formatDateTime(agent.createdAt))}</dd>
                    </div>
                    <div>
                      <dt>更新时间</dt>
                      <dd>${escapeHtml(formatDateTime(agent.updatedAt))}</dd>
                    </div>
                    <div class="oc-tenant-agent-detail__description">
                      <dt>说明</dt>
                      <dd>${escapeHtml(agent.description || "暂无说明")}</dd>
                    </div>
                  </dl>
                </div>
              `
              : `<div class="callout info">未找到对应的 Agent 详情。</div>`
          }
        </div>
      </div>
    </dialog>
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

function renderDeleteMemberDialog(controller) {
  const member = getDeleteMemberTarget(controller);
  const assignedAgentCount = Number(member?.assignedAgentCount || 0);
  const revokeHint = assignedAgentCount
    ? `删除后会同步失效该成员当前的 ${formatNumber(assignedAgentCount)} 条 Agent 分配。`
    : "删除后该成员将无法继续登录。";
  return `
    <dialog class="oc-tenant-modal" data-tenant-member-delete-dialog>
      <div class="oc-tenant-modal__panel">
        <header class="oc-tenant-modal__header">
          <h3 class="oc-tenant-modal__title">删除成员</h3>
          <button class="btn" type="button" data-tenant-close-dialog="delete-member">关闭</button>
        </header>
        <div class="oc-tenant-modal__body">
          ${
            member?.id
              ? `
                <form class="oc-tenant-modal__form" data-tenant-member-delete-form>
                  <input type="hidden" name="userId" value="${escapeHtml(member.id)}" />
                  <label class="field"><span>成员账号</span><input type="text" value="${escapeHtml(member.username || member.id)}" disabled /></label>
                  <div class="callout warning">
                    即将删除成员“${escapeHtml(member.username || member.id)}”。<br />
                    <strong>删除后不可在成员列表中恢复。</strong><br />
                    ${escapeHtml(revokeHint)}
                  </div>
                  <div class="oc-tenant-modal__actions">
                    <button class="btn" type="button" data-tenant-close-dialog="delete-member">取消</button>
                    <button class="btn oc-tenant-destructive-action" type="submit">确认删除</button>
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

function renderMemberOrgScopeDialog(controller) {
  const dialog = getMemberOrgScopeDialog(controller);
  const selectableOrgs = getMemberOrgScopeSelectableOrgs(dialog);
  const visibleOrgs = getVisibleMemberOrgScopeOrgs(dialog);
  const selectedCount = dialog.selectedOrgIds.size;
  const visibleSelectedCount = visibleOrgs.filter((org) =>
    dialog.selectedOrgIds.has(String(org.orgId || "").trim()),
  ).length;
  const allSelected = visibleOrgs.length > 0 && visibleSelectedCount === visibleOrgs.length;
  const hasBinding = Boolean(String(dialog.dataSourceId || "").trim());
  const showCustomOrgs = !dialog.loading && hasBinding && dialog.scopeMode === "custom";
  const statusMarkup = dialog.loading
    ? `<div class="callout info">正在加载成员组织范围...</div>`
    : dialog.error
      ? `<div class="callout info">${escapeHtml(dialog.error)}</div>`
      : !hasBinding
        ? `<div class="callout info">当前租户未绑定数据源，无法配置组织范围。</div>`
        : "";
  const customListMarkup = showCustomOrgs
    ? selectableOrgs.length
      ? `
        <div class="field">
          <span>可访问组织</span>
          <div class="oc-tenant-revoke-assignment-toolbar">
            <label class="oc-tenant-revoke-assignment-toolbar__select-all">
              <input
                type="checkbox"
                data-tenant-member-org-scope-select-all
                aria-label="全选可访问组织"
                ${dialog.busy ? "disabled" : ""}
                ${allSelected ? "checked" : ""}
              />
              <span>全选</span>
            </label>
            <label class="data-table-search oc-tenant-inline-search">
              <input
                type="search"
                placeholder="搜索组织编码或名称"
                value="${escapeHtml(dialog.searchQuery || "")}"
                data-tenant-member-org-scope-search
                ${dialog.busy ? "disabled" : ""}
              />
            </label>
            <span class="oc-tenant-revoke-assignment-toolbar__summary">
              已选择 ${formatNumber(selectedCount)} 个组织
            </span>
          </div>
          ${
            visibleOrgs.length
              ? `
                <div class="data-table-container oc-tenant-revoke-assignment-list">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th class="oc-tenant-assignment-select-col"></th>
                        <th>组织编码</th>
                        <th>组织名称</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${visibleOrgs
                        .map(
                          (org) => `
                            <tr>
                              <td class="oc-tenant-assignment-select-cell">
                                <input
                                  type="checkbox"
                                  data-tenant-member-org-scope-org="${escapeHtml(org.orgId)}"
                                  aria-label="选择 ${escapeHtml(org.orgName || org.orgId || "-")}"
                                  ${dialog.busy ? "disabled" : ""}
                                  ${dialog.selectedOrgIds.has(String(org.orgId || "").trim()) ? "checked" : ""}
                                />
                              </td>
                              <td>${escapeHtml(org.orgNumber || org.orgId || "-")}</td>
                              <td>${escapeHtml(org.orgName || "-")}</td>
                            </tr>
                          `,
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              `
              : `<div class="callout info">没有匹配的组织，请调整搜索条件。</div>`
          }
        </div>
      `
      : `<div class="callout info">当前数据源没有可选择的组织。</div>`
    : "";
  return `
    <dialog class="oc-tenant-modal oc-tenant-modal--wide" data-tenant-member-org-scope-dialog>
      <div class="oc-tenant-modal__panel">
        <header class="oc-tenant-modal__header">
          <h3 class="oc-tenant-modal__title">成员组织范围</h3>
          <button class="btn" type="button" data-tenant-close-dialog="org-scope">关闭</button>
        </header>
        <div class="oc-tenant-modal__body">
          ${
            dialog.memberId
              ? `
                <form class="oc-tenant-modal__form" data-tenant-member-org-scope-form>
                  <input type="hidden" name="userId" value="${escapeHtml(dialog.memberId)}" />
                  <label class="field">
                    <span>目标成员</span>
                    <input type="text" value="${escapeHtml(dialog.memberUsername || dialog.memberId)}" disabled />
                  </label>
                  <label class="field">
                    <span>已绑定数据源</span>
                    <input type="text" value="${escapeHtml(dialog.dataSourceName || "未绑定数据源")}" disabled />
                  </label>
                  <div class="field">
                    <span>沙盒模拟</span>
                    <label class="oc-tenant-member-sandbox-field">
                      <input
                        type="checkbox"
                        data-tenant-member-sandbox-enabled
                        ${dialog.busy || !hasBinding ? "disabled" : ""}
                        ${dialog.sandboxEnabled ? "checked" : ""}
                      />
                      <span>允许该成员使用当前数据源的沙盒模拟</span>
                    </label>
                  </div>
                  <div class="field">
                    <span>组织访问范围</span>
                    <div class="oc-tenant-member-org-scope-modes">
                      ${["none", "custom", "all"]
                        .map((mode) => {
                          const label =
                            mode === "none" ? "未分配" : mode === "custom" ? "指定组织" : "全部组织";
                          return `
                            <label class="oc-tenant-member-org-scope-mode">
                              <input
                                type="radio"
                                name="scopeMode"
                                value="${mode}"
                                data-tenant-member-org-scope-mode="${mode}"
                                ${dialog.busy || !hasBinding ? "disabled" : ""}
                                ${dialog.scopeMode === mode ? "checked" : ""}
                              />
                              <span>${label}</span>
                            </label>
                          `;
                        })
                        .join("")}
                    </div>
                  </div>
                  ${statusMarkup}
                  ${customListMarkup}
                  <div class="oc-tenant-modal__actions">
                    <button class="btn" type="button" data-tenant-close-dialog="org-scope">取消</button>
                    <button
                      class="btn primary"
                      type="submit"
                      ${dialog.loading || dialog.busy || !hasBinding ? "disabled" : ""}
                    >
                      保存设置
                    </button>
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
  const dialog = getAssignAgentDialog(controller);
  const selectedCount = dialog.selectedAgentIds.size;
  const selectableAgents = getAssignableTenantAgents(dialog);
  const allAgentsSelected =
    selectableAgents.length > 0 && selectedCount === selectableAgents.length;
  const localEdition = isLocalEdition(controller);
  const statusMarkup = dialog.loading
    ? `<div class="callout info">正在加载该成员可分配的 Agent...</div>`
    : dialog.error
      ? `<div class="callout info">${escapeHtml(dialog.error)}</div>`
      : "";
  const listMarkup =
    !dialog.loading && selectableAgents.length
      ? `
        <div class="data-table-container oc-tenant-revoke-assignment-list">
          <table class="data-table">
            <thead>
              <tr>
                <th class="oc-tenant-assignment-select-col"></th>
                <th>Agent</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              ${selectableAgents
                .map(
                  (agent) => `
                    <tr>
                      <td class="oc-tenant-assignment-select-cell">
                        <input
                          type="checkbox"
                          data-tenant-assign-agent-select="${escapeHtml(agent.id)}"
                          aria-label="选择 ${escapeHtml(getAssignAgentDisplayName(agent))}"
                          ${dialog.busy ? "disabled" : ""}
                          ${isAssignAgentSelected(controller, agent.id) ? "checked" : ""}
                        />
                      </td>
                      <td>
                        <div class="oc-tenant-revoke-assignment__agent-name">${escapeHtml(getAssignAgentDisplayName(agent))}</div>
                        <div class="oc-tenant-revoke-assignment__agent-meta">${escapeHtml(agent.agentId || agent.id || "-")}${localEdition ? "" : ` · ${formatNumber(agent.balancePoints)} 积分`}</div>
                      </td>
                      <td>${escapeHtml(agent.description || "-")}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `
      : !dialog.loading && !dialog.error
        ? `<div class="callout info">该成员当前没有可分配的 Agent。</div>`
        : "";
  return `
    <dialog class="oc-tenant-modal oc-tenant-modal--wide" data-tenant-assign-dialog>
      <div class="oc-tenant-modal__panel">
        <header class="oc-tenant-modal__header">
          <h3 class="oc-tenant-modal__title">分配Agent</h3>
          <button class="btn" type="button" data-tenant-close-dialog="assign">关闭</button>
        </header>
        <div class="oc-tenant-modal__body">
          ${
            dialog.memberId
              ? `
                <form class="oc-tenant-modal__form" data-tenant-assignment-form>
                  <input type="hidden" name="userId" value="${escapeHtml(dialog.memberId)}" />
                  <label class="field"><span>目标成员</span><input type="text" value="${escapeHtml(dialog.memberUsername || dialog.memberId)}" disabled /></label>
                  <div class="field">
                    <span>租户已下发 Agent</span>
                    <div class="oc-tenant-revoke-assignment-toolbar">
                      <label class="oc-tenant-revoke-assignment-toolbar__select-all">
                        <input
                          type="checkbox"
                          data-tenant-assign-agent-select-all
                          aria-label="全选可分配的 Agent"
                          ${dialog.loading || dialog.busy || !selectableAgents.length ? "disabled" : ""}
                          ${allAgentsSelected ? "checked" : ""}
                        />
                        <span>全选</span>
                      </label>
                      <span class="oc-tenant-revoke-assignment-toolbar__summary">
                        已选择 ${formatNumber(selectedCount)} 个 Agent
                      </span>
                    </div>
                  </div>
                  ${statusMarkup}
                  ${listMarkup}
                  <div class="oc-tenant-modal__actions">
                    <button class="btn" type="button" data-tenant-close-dialog="assign">取消</button>
                    <button class="btn primary" type="submit" ${dialog.loading || dialog.busy || selectedCount === 0 ? "disabled" : ""}>保存分配</button>
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

function renderRevokeAssignmentDialog(controller) {
  const dialog = getRevokeAssignmentDialog(controller);
  const selectedCount = dialog.selectedAssignmentIds.size;
  const selectableAssignments = getRevokeAssignmentSelectableAssignments(dialog);
  const allAssignmentsSelected =
    selectableAssignments.length > 0 && selectedCount === selectableAssignments.length;
  const statusMarkup = dialog.loading
    ? `<div class="callout info">正在加载该成员已分配的 Agent...</div>`
    : dialog.error
      ? `<div class="callout info">${escapeHtml(dialog.error)}</div>`
      : "";
  const listMarkup =
    !dialog.loading && dialog.assignments.length
      ? `
        <div class="data-table-container oc-tenant-revoke-assignment-list">
          <table class="data-table">
            <thead>
              <tr>
                <th class="oc-tenant-assignment-select-col"></th>
                <th>Agent</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              ${dialog.assignments
                .map(
                  (assignment) => `
                    <tr>
                      <td class="oc-tenant-assignment-select-cell">
                        <input
                          type="checkbox"
                          data-tenant-revoke-assignment-select="${escapeHtml(assignment.assignmentId)}"
                          aria-label="选择 ${escapeHtml(getRevokeAssignmentDisplayName(assignment))}"
                          ${dialog.busy ? "disabled" : ""}
                          ${isRevokeAssignmentSelected(controller, assignment.assignmentId) ? "checked" : ""}
                        />
                      </td>
                      <td>
                        <div class="oc-tenant-revoke-assignment__agent-name">${escapeHtml(getRevokeAssignmentDisplayName(assignment))}</div>
                        <div class="oc-tenant-revoke-assignment__agent-meta">${escapeHtml(assignment.derivedAgentId || assignment.baseAgentId || "-")}</div>
                      </td>
                      <td>${escapeHtml(assignment.description || "-")}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `
      : !dialog.loading && !dialog.error
        ? `<div class="callout info">该成员当前没有可撤回的 Agent 分配。</div>`
        : "";
  return `
    <dialog class="oc-tenant-modal oc-tenant-modal--wide" data-tenant-revoke-assignment-dialog>
      <div class="oc-tenant-modal__panel">
        <header class="oc-tenant-modal__header">
          <h3 class="oc-tenant-modal__title">撤回分配</h3>
          <button class="btn" type="button" data-tenant-close-dialog="revoke">关闭</button>
        </header>
        <div class="oc-tenant-modal__body">
          <form class="oc-tenant-modal__form" data-tenant-revoke-assignment-form>
            <input type="hidden" name="userId" value="${escapeHtml(dialog.memberId)}" />
            <label class="field">
              <span>目标成员</span>
              <input type="text" value="${escapeHtml(dialog.memberUsername || dialog.memberId)}" disabled />
            </label>
            <div class="oc-tenant-revoke-assignment-toolbar">
              <label class="oc-tenant-revoke-assignment-toolbar__select-all">
                <input
                  type="checkbox"
                  data-tenant-revoke-assignment-select-all
                  aria-label="全选该成员已分配的 Agent"
                  ${dialog.loading || dialog.busy || !selectableAssignments.length ? "disabled" : ""}
                  ${allAssignmentsSelected ? "checked" : ""}
                />
                <span>全选</span>
              </label>
              <span class="oc-tenant-revoke-assignment-toolbar__summary">
                已选择 ${formatNumber(selectedCount)} 个 Agent
              </span>
            </div>
            ${statusMarkup}
            ${listMarkup}
            <div class="oc-tenant-modal__actions">
              <button class="btn" type="button" data-tenant-close-dialog="revoke">取消</button>
              <button class="btn primary" type="submit" ${dialog.loading || dialog.busy || selectedCount === 0 ? "disabled" : ""}>下一步</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

function renderRevokeAssignmentConfirmDialog(controller) {
  const dialog = getRevokeAssignmentDialog(controller);
  if (!dialog.confirmOpen) {
    return "";
  }
  const selectedAssignments = getRevokeAssignmentConfirmAssignments(dialog);
  const memberLabel = dialog.memberUsername || dialog.memberId || "该成员";
  const selectedCount = selectedAssignments.length || dialog.confirmSelectedAssignmentIds.length;
  return `
    <dialog class="oc-tenant-modal" data-tenant-revoke-confirm-dialog>
      <div class="oc-tenant-modal__panel">
        <header class="oc-tenant-modal__header">
          <h3 class="oc-tenant-modal__title">确认撤回</h3>
          <button class="btn" type="button" data-tenant-close-dialog="revoke-confirm">关闭</button>
        </header>
        <div class="oc-tenant-modal__body">
          <div class="callout info">
            确认后将立即撤回成员“${escapeHtml(memberLabel)}”已选中的 ${formatNumber(selectedCount)} 个 Agent。
          </div>
          ${
            selectedAssignments.length
              ? `
                <section class="oc-tenant-revoke-confirm">
                  <div class="oc-tenant-revoke-confirm__title">将撤回的 Agent</div>
                  <ul class="oc-tenant-revoke-confirm__list">
                    ${selectedAssignments
                      .map(
                        (assignment) => `
                          <li>
                            <div class="oc-tenant-revoke-confirm__name">${escapeHtml(getRevokeAssignmentDisplayName(assignment))}</div>
                            <div class="oc-tenant-revoke-confirm__meta">${escapeHtml(assignment.derivedAgentId || assignment.baseAgentId || "-")}</div>
                          </li>
                        `,
                      )
                      .join("")}
                  </ul>
                </section>
              `
              : ""
          }
          <form class="oc-tenant-modal__form" data-tenant-revoke-confirm-form>
            <div class="oc-tenant-modal__actions">
              <button class="btn" type="button" data-tenant-close-dialog="revoke-confirm">返回</button>
              <button class="btn primary" type="submit" ${dialog.busy ? "disabled" : ""}>确认撤回</button>
            </div>
          </form>
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
  if (active.hasAttribute("data-tenant-member-org-scope-search")) {
    return {
      kind: "member-org-scope-search",
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
  if (state.kind === "member-org-scope-search") {
    const input = root.querySelector("[data-tenant-member-org-scope-search]");
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

function syncRevokeAssignmentSelectionState(root, controller) {
  const dialog = controller.revokeAssignmentDialog;
  if (controller.section !== "agent-assignment" || !dialog?.open) {
    return;
  }
  const selectAll = root.querySelector("[data-tenant-revoke-assignment-select-all]");
  if (!(selectAll instanceof HTMLInputElement)) {
    return;
  }
  const selectableAssignments = getRevokeAssignmentSelectableAssignments(dialog);
  const selectedAssignments = selectableAssignments.filter((assignment) =>
    dialog.selectedAssignmentIds.has(String(assignment.assignmentId || "").trim()),
  );
  selectAll.checked =
    selectableAssignments.length > 0 &&
    selectedAssignments.length === selectableAssignments.length &&
    !dialog.loading &&
    !dialog.busy;
  selectAll.indeterminate =
    selectedAssignments.length > 0 && selectedAssignments.length < selectableAssignments.length;
  selectAll.disabled = selectableAssignments.length === 0 || dialog.loading || dialog.busy;
}

function render(root, controller) {
  const focusState = captureRenderFocusState(root);
  const isUsageStats = controller.section === "usage-stats";
  const isOverview = controller.section === "statistics-overview";
  const isOwnedAgents = controller.section === "owned-agents";
  if (controller.section === "agent-assignment") {
    pruneRevokeAssignmentSelection(controller);
    pruneAssignAgentSelection(controller);
  }
  const pagination =
    isUsageStats || isOverview
      ? null
      : paginate(
          isOwnedAgents ? filterTenantAgents(controller) : filterMembers(controller),
          getPageValue(controller),
        );
  if (pagination) {
    setPageValue(controller, pagination.page);
  }

  const contentMarkup = isUsageStats
    ? renderUsageList(controller)
    : isOverview
      ? renderTenantOverview(controller)
      : isOwnedAgents
        ? `
          <div class="data-table-wrapper">
            ${renderOwnedAgentsCards(pagination.items, controller)}
            ${renderPagination(pagination)}
          </div>
        `
      : `
        <div class="data-table-wrapper">
          ${
            controller.section === "agent-assignment"
              ? renderAssignmentTable(pagination.items, controller)
              : renderMembersTable(pagination.items, controller)
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
        : isOwnedAgents
          ? `${renderAgentDetailDialog(controller)}`
          : `${renderCreateMemberDialog()}${renderMemberOrgScopeDialog(controller)}${renderChangePasswordDialog(controller)}${renderDeleteMemberDialog(controller)}${renderAssignDialog(controller)}${renderRevokeAssignmentDialog(controller)}${renderRevokeAssignmentConfirmDialog(controller)}`
    }
  `;

  if (isOverview) {
    void initTenantOverviewCharts(root, controller);
  }

  if (!isUsageStats && !isOverview) {
    if (isOwnedAgents && controller.agentDetailDialog?.open) {
      openDialog(root.querySelector("[data-tenant-agent-detail-dialog]"));
    }
    if (controller.dialogs.createMemberOpen) {
      openDialog(root.querySelector("[data-tenant-create-dialog]"));
    }
    if (controller.memberOrgScopeDialog?.open) {
      openDialog(root.querySelector("[data-tenant-member-org-scope-dialog]"));
    }
    if (controller.dialogs.changePasswordOpen) {
      openDialog(root.querySelector("[data-tenant-member-password-dialog]"));
    }
    if (controller.dialogs.deleteMemberOpen) {
      openDialog(root.querySelector("[data-tenant-member-delete-dialog]"));
    }
    if (controller.dialogs.assignOpen || controller.assignAgentDialog?.open) {
      openDialog(root.querySelector("[data-tenant-assign-dialog]"));
    }
    if (controller.revokeAssignmentDialog?.open) {
      openDialog(root.querySelector("[data-tenant-revoke-assignment-dialog]"));
    }
    if (controller.revokeAssignmentDialog?.confirmOpen) {
      openDialog(root.querySelector("[data-tenant-revoke-confirm-dialog]"));
    }
  }
  if (controller.section === "agent-assignment") {
    syncRevokeAssignmentSelectionState(root, controller);
    syncAssignAgentSelectionState(root, controller);
  }
  if (controller.section === "members") {
    syncMemberOrgScopeSelectionState(root, controller);
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

  if (controller.section === "owned-agents") {
    controller.tenantAgents = await controller.apiClient.listTenantAgents();
    render(root, controller);
    return;
  }

  const [members, tenantAgents, binding] = await Promise.all([
    controller.apiClient.listTenantMembers(),
    controller.apiClient.listTenantAgents(),
    controller.section === "members"
      ? controller.apiClient.getCurrentTenantDataSourceBinding()
      : Promise.resolve(controller.currentDataSourceBinding),
  ]);
  controller.members = members;
  controller.tenantAgents = tenantAgents;
  controller.currentDataSourceBinding = binding && typeof binding === "object" ? binding : null;
  if (
    controller.activeMember &&
    !members.some((member) => member.id === controller.activeMember.id)
  ) {
    controller.activeMember = null;
  }
  if (
    controller.deleteMemberTarget?.id &&
    !members.some((member) => member.id === controller.deleteMemberTarget.id)
  ) {
    controller.dialogs.deleteMemberOpen = false;
    controller.deleteMemberTarget = createDeleteMemberDialogState();
  }
  if (
    controller.memberOrgScopeDialog?.memberId &&
    !members.some((member) => member.id === controller.memberOrgScopeDialog.memberId)
  ) {
    controller.memberOrgScopeDialog = createMemberOrgScopeDialogState();
  }
  render(root, controller);
}

function memberById(controller, userId) {
  return controller.members.find((member) => member.id === userId) ?? null;
}

function openDeleteMemberDialog(root, controller, memberId) {
  const member = memberById(controller, memberId);
  if (!member) {
    return;
  }
  controller.deleteMemberTarget = {
    id: String(member.id || "").trim(),
    username: String(member.username || "").trim(),
    assignedAgentCount: Number(member.assignedAgentCount || 0),
  };
  controller.dialogs.deleteMemberOpen = true;
  render(root, controller);
}

async function updateMemberStatus(root, controller, input) {
  const userId = String(input.dataset.tenantMemberStatusToggle || "").trim();
  const member = memberById(controller, userId);
  if (!userId || !member || isMemberStatusBusy(controller, userId)) {
    return;
  }
  const nextStatus = input.checked ? "active" : "inactive";
  controller.busyMemberStatusIds.add(userId);
  controller.pendingMemberStatuses.set(userId, nextStatus);
  render(root, controller);
  try {
    await controller.apiClient.updateTenantMemberStatus({
      userId,
      status: nextStatus,
    });
    await refresh(root, controller);
    controller.busyMemberStatusIds.delete(userId);
    controller.pendingMemberStatuses.delete(userId);
    render(root, controller);
    setFeedback(root, nextStatus === "active" ? "成员已启用。" : "成员已禁用。");
  } catch (error) {
    controller.busyMemberStatusIds.delete(userId);
    controller.pendingMemberStatuses.delete(userId);
    render(root, controller);
    setFeedback(root, error instanceof Error ? error.message : String(error), true);
  }
}

async function openMemberOrgScopeDialog(root, controller, memberId) {
  const member = memberById(controller, memberId);
  if (!member) {
    return;
  }

  const previousToken = Number(controller.memberOrgScopeDialog?.requestToken || 0);
  controller.memberOrgScopeDialog = {
    ...createMemberOrgScopeDialogState(),
    open: true,
    loading: true,
    memberId: member.id,
    memberUsername: member.username,
    dataSourceName: String(
      getCurrentTenantDataSourceBinding(controller)?.dataSourceName ||
        getCurrentTenantDataSourceBinding(controller)?.name ||
        "",
    ).trim(),
    requestToken: previousToken + 1,
  };
  render(root, controller);

  const requestToken = controller.memberOrgScopeDialog.requestToken;
  try {
    const [binding, orgs, scope] = await Promise.all([
      controller.apiClient.getCurrentTenantDataSourceBinding(),
      controller.apiClient.listTenantOrganizations(),
      controller.apiClient.getTenantMemberOrgScope(member.id),
    ]);
    const currentDialog = controller.memberOrgScopeDialog;
    if (
      !currentDialog ||
      !currentDialog.open ||
      currentDialog.requestToken !== requestToken ||
      currentDialog.memberId !== member.id
    ) {
      return;
    }
    currentDialog.dataSourceId = String(binding?.dataSourceId || "").trim();
    currentDialog.dataSourceName = String(
      binding?.dataSourceName || binding?.name || currentDialog.dataSourceName || "",
    ).trim();
    currentDialog.orgs = Array.isArray(orgs) ? orgs : [];
    const availableOrgIds = new Set(
      currentDialog.orgs
        .map((org) => String(org?.orgId || "").trim())
        .filter(Boolean),
    );
    currentDialog.scopeMode = normalizeMemberOrgScopeMode(scope?.scopeMode);
    currentDialog.sandboxEnabled =
      scope?.sandboxEnabled === true || Number(scope?.sandboxEnabled || 0) > 0;
    currentDialog.selectedOrgIds = new Set(
      (Array.isArray(scope?.orgScopes) ? scope.orgScopes : [])
        .map((org) => String(org?.orgId || "").trim())
        .filter((orgId) => availableOrgIds.has(orgId)),
    );
    currentDialog.loading = false;
    currentDialog.error = "";
    render(root, controller);
  } catch (error) {
    const currentDialog = controller.memberOrgScopeDialog;
    if (
      !currentDialog ||
      !currentDialog.open ||
      currentDialog.requestToken !== requestToken ||
      currentDialog.memberId !== member.id
    ) {
      return;
    }
    currentDialog.loading = false;
    currentDialog.error = error instanceof Error ? error.message : String(error);
    render(root, controller);
    setFeedback(root, currentDialog.error, true);
  }
}

async function openRevokeAssignmentDialog(root, controller, memberId) {
  const member = memberById(controller, memberId);
  if (!member || !isRevokeAssignmentSelectionTarget(member)) {
    return;
  }

  const previousToken = Number(controller.revokeAssignmentDialog?.requestToken || 0);
  controller.revokeAssignmentDialog = {
    ...createRevokeAssignmentDialogState(),
    open: true,
    loading: true,
    memberId: member.id,
    memberUsername: member.username,
    requestToken: previousToken + 1,
  };
  render(root, controller);

  const requestToken = controller.revokeAssignmentDialog.requestToken;
  try {
    const assignments = await controller.apiClient.listTenantMemberAssignedAgents(member.id);
    const currentDialog = controller.revokeAssignmentDialog;
    if (
      !currentDialog ||
      !currentDialog.open ||
      currentDialog.requestToken !== requestToken ||
      currentDialog.memberId !== member.id
    ) {
      return;
    }
    currentDialog.assignments = Array.isArray(assignments) ? assignments : [];
    currentDialog.loading = false;
    currentDialog.error = "";
    pruneRevokeAssignmentSelection(controller);
    render(root, controller);
  } catch (error) {
    const currentDialog = controller.revokeAssignmentDialog;
    if (
      !currentDialog ||
      !currentDialog.open ||
      currentDialog.requestToken !== requestToken ||
      currentDialog.memberId !== member.id
    ) {
      return;
    }
    currentDialog.loading = false;
    currentDialog.error = error instanceof Error ? error.message : String(error);
    render(root, controller);
    setFeedback(root, currentDialog.error, true);
  }
}

async function openAssignAgentDialog(root, controller, memberId) {
  const member = memberById(controller, memberId);
  if (!member) {
    return;
  }

  controller.activeMember = member;
  const previousToken = Number(controller.assignAgentDialog?.requestToken || 0);
  controller.assignAgentDialog = {
    ...createAssignAgentDialogState(),
    open: true,
    loading: true,
    memberId: member.id,
    memberUsername: member.username,
    requestToken: previousToken + 1,
  };
  controller.dialogs.assignOpen = true;
  render(root, controller);

  const requestToken = controller.assignAgentDialog.requestToken;
  try {
    const assignments = await controller.apiClient.listTenantMemberAssignedAgents(member.id);
    const currentDialog = controller.assignAgentDialog;
    if (
      !currentDialog ||
      !currentDialog.open ||
      currentDialog.requestToken !== requestToken ||
      currentDialog.memberId !== member.id
    ) {
      return;
    }
    const assignedAgentIds = new Set(
      (Array.isArray(assignments) ? assignments : [])
        .map((assignment) =>
          String(assignment?.tenantAgentId || assignment?.tenant_agent_id || "").trim(),
        )
        .filter(Boolean),
    );
    currentDialog.assignedAgentIds = assignedAgentIds;
    currentDialog.agents = Array.isArray(controller.tenantAgents)
      ? controller.tenantAgents.slice()
      : [];
    currentDialog.loading = false;
    currentDialog.error = "";
    pruneAssignAgentSelection(controller);
    render(root, controller);
  } catch (error) {
    const currentDialog = controller.assignAgentDialog;
    if (
      !currentDialog ||
      !currentDialog.open ||
      currentDialog.requestToken !== requestToken ||
      currentDialog.memberId !== member.id
    ) {
      return;
    }
    currentDialog.loading = false;
    currentDialog.error = error instanceof Error ? error.message : String(error);
    render(root, controller);
    setFeedback(root, currentDialog.error, true);
  }
}

async function openRevokeAssignmentConfirmDialog(root, controller) {
  const dialog = controller.revokeAssignmentDialog;
  if (!dialog?.open || dialog.loading || dialog.busy) {
    return;
  }

  pruneRevokeAssignmentSelection(controller);
  const selectedAssignmentIds = Array.from(dialog.selectedAssignmentIds);
  if (!selectedAssignmentIds.length) {
    setFeedback(root, "请选择要撤回的 Agent。", true);
    return;
  }

  dialog.confirmOpen = true;
  dialog.confirmSelectedAssignmentIds = selectedAssignmentIds;
  dialog.error = "";
  render(root, controller);
}

async function revokeSelectedAssignments(root, controller) {
  const dialog = controller.revokeAssignmentDialog;
  if (!dialog?.open || dialog.loading || dialog.busy || !dialog.confirmOpen) {
    return;
  }

  const dialogToken = Number(dialog.requestToken || 0);
  const selectedAssignmentIds = Array.from(dialog.confirmSelectedAssignmentIds || []);
  if (!selectedAssignmentIds.length) {
    dialog.confirmOpen = false;
    dialog.confirmSelectedAssignmentIds = [];
    render(root, controller);
    setFeedback(root, "请选择要撤回的 Agent。", true);
    return;
  }

  const memberLabel = dialog.memberUsername || dialog.memberId || "该成员";
  dialog.busy = true;
  render(root, controller);
  try {
    const result = await controller.apiClient.revokeTenantAgentAssignments({
      userId: dialog.memberId,
      assignmentIds: selectedAssignmentIds,
    });
    const revokedAssignmentCount = Number(result?.revokedAssignmentCount || 0);
    if (revokedAssignmentCount > 0) {
      const currentDialog = controller.revokeAssignmentDialog;
      if (
        currentDialog &&
        currentDialog.open &&
        currentDialog.requestToken === dialogToken &&
        currentDialog.memberId === dialog.memberId
      ) {
        controller.revokeAssignmentDialog = null;
      }
      try {
        await refresh(root, controller);
      } catch (refreshError) {
        render(root, controller);
        setFeedback(
          root,
          refreshError instanceof Error
            ? `已撤回 ${memberLabel} 的 ${revokedAssignmentCount} 个 Agent 分配，但列表刷新失败：${refreshError.message}`
            : `已撤回 ${memberLabel} 的 ${revokedAssignmentCount} 个 Agent 分配，但列表刷新失败。`,
          true,
        );
        return;
      }
      setFeedback(root, `已撤回成员“${memberLabel}”的 ${revokedAssignmentCount} 个 Agent 分配。`);
      return;
    }
    const currentDialog = controller.revokeAssignmentDialog;
    if (
      currentDialog &&
      currentDialog.open &&
      currentDialog.requestToken === dialogToken &&
      currentDialog.memberId === dialog.memberId
    ) {
      currentDialog.busy = false;
      currentDialog.confirmOpen = false;
      currentDialog.confirmSelectedAssignmentIds = [];
      currentDialog.loading = false;
      currentDialog.error = "未找到可撤回的 Agent 分配。";
      render(root, controller);
      setFeedback(root, currentDialog.error, true);
      return;
    }
    render(root, controller);
    setFeedback(root, "未找到可撤回的 Agent 分配。", true);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const currentDialog = controller.revokeAssignmentDialog;
    if (
      currentDialog &&
      currentDialog.open &&
      currentDialog.requestToken === dialogToken &&
      currentDialog.memberId === dialog.memberId
    ) {
      currentDialog.busy = false;
      currentDialog.confirmOpen = false;
      currentDialog.confirmSelectedAssignmentIds = [];
      currentDialog.loading = false;
      currentDialog.error = errorMessage;
    }
    render(root, controller);
    setFeedback(root, errorMessage, true);
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

  const memberOrgScopeTrigger = target.closest("[data-tenant-open-member-org-scope]");
  if (memberOrgScopeTrigger instanceof HTMLElement) {
    await openMemberOrgScopeDialog(
      root,
      controller,
      memberOrgScopeTrigger.dataset.tenantOpenMemberOrgScope,
    );
    return;
  }

  const agentDetailTrigger = target.closest("[data-tenant-open-agent-detail]");
  if (agentDetailTrigger instanceof HTMLElement) {
    controller.agentDetailDialog = {
      open: true,
      agentId: String(agentDetailTrigger.dataset.tenantOpenAgentDetail || "").trim(),
    };
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

  const deleteTrigger = target.closest("[data-tenant-open-member-delete]");
  if (deleteTrigger instanceof HTMLElement) {
    openDeleteMemberDialog(root, controller, deleteTrigger.dataset.tenantOpenMemberDelete);
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
      controller.activeMember = null;
      controller.assignAgentDialog = createAssignAgentDialogState();
      closeDialog(root.querySelector("[data-tenant-assign-dialog]"));
    }
    if (dialogKind === "org-scope") {
      controller.memberOrgScopeDialog = createMemberOrgScopeDialogState();
      closeDialog(root.querySelector("[data-tenant-member-org-scope-dialog]"));
    }
    if (dialogKind === "password") {
      controller.dialogs.changePasswordOpen = false;
      controller.passwordMember = null;
      closeDialog(root.querySelector("[data-tenant-member-password-dialog]"));
    }
    if (dialogKind === "delete-member") {
      controller.dialogs.deleteMemberOpen = false;
      controller.deleteMemberTarget = createDeleteMemberDialogState();
      closeDialog(root.querySelector("[data-tenant-member-delete-dialog]"));
    }
    if (dialogKind === "agent-detail") {
      controller.agentDetailDialog = createAgentDetailDialogState();
      closeDialog(root.querySelector("[data-tenant-agent-detail-dialog]"));
    }
    if (dialogKind === "revoke") {
      controller.revokeAssignmentDialog = createRevokeAssignmentDialogState();
      closeDialog(root.querySelector("[data-tenant-revoke-assignment-dialog]"));
    }
    if (dialogKind === "revoke-confirm") {
      const dialog = getRevokeAssignmentDialog(controller);
      dialog.confirmOpen = false;
      dialog.confirmSelectedAssignmentIds = [];
      closeDialog(root.querySelector("[data-tenant-revoke-confirm-dialog]"));
    }
    render(root, controller);
    return;
  }

  const assignTrigger = target.closest("[data-tenant-open-assign]");
  if (assignTrigger instanceof HTMLElement) {
    await openAssignAgentDialog(root, controller, assignTrigger.dataset.tenantOpenAssign);
    return;
  }

  const revokeTrigger = target.closest("[data-tenant-revoke-assignment]");
  if (revokeTrigger instanceof HTMLElement) {
    await openRevokeAssignmentDialog(
      root,
      controller,
      revokeTrigger.dataset.tenantRevokeAssignment,
    );
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
  if (target.hasAttribute("data-tenant-member-org-scope-mode")) {
    setMemberOrgScopeMode(controller, target.dataset.tenantMemberOrgScopeMode);
    render(root, controller);
    return;
  }
  if (target.hasAttribute("data-tenant-member-org-scope-search")) {
    getMemberOrgScopeDialog(controller).searchQuery = target.value;
    render(root, controller);
    return;
  }
  if (target.hasAttribute("data-tenant-member-sandbox-enabled")) {
    getMemberOrgScopeDialog(controller).sandboxEnabled = target.checked;
    render(root, controller);
    return;
  }
  if (target.hasAttribute("data-tenant-member-org-scope-select-all")) {
    const dialog = getMemberOrgScopeDialog(controller);
    const selected = target.checked;
    for (const org of getVisibleMemberOrgScopeOrgs(dialog)) {
      setMemberOrgScopeSelected(controller, org.orgId, selected);
    }
    render(root, controller);
    return;
  }
  if (target.hasAttribute("data-tenant-member-org-scope-org")) {
    setMemberOrgScopeSelected(
      controller,
      target.dataset.tenantMemberOrgScopeOrg,
      target.checked,
    );
    render(root, controller);
    return;
  }
  if (target.hasAttribute("data-tenant-revoke-assignment-select-all")) {
    const dialog = getRevokeAssignmentDialog(controller);
    const selected = target.checked;
    clearRevokeAssignmentSelection(controller);
    if (selected) {
      for (const assignment of getRevokeAssignmentSelectableAssignments(dialog)) {
        setRevokeAssignmentSelected(controller, assignment.assignmentId, true);
      }
    }
    render(root, controller);
    return;
  }
  if (target.hasAttribute("data-tenant-revoke-assignment-select")) {
    setRevokeAssignmentSelected(
      controller,
      target.dataset.tenantRevokeAssignmentSelect,
      target.checked,
    );
    render(root, controller);
    return;
  }
  if (target.hasAttribute("data-tenant-assign-agent-select-all")) {
    const dialog = getAssignAgentDialog(controller);
    const selected = target.checked;
    clearAssignAgentSelection(controller);
    if (selected) {
      for (const agent of getAssignableTenantAgents(dialog)) {
        setAssignAgentSelected(controller, agent.id, true);
      }
    }
    render(root, controller);
    return;
  }
  if (target.hasAttribute("data-tenant-assign-agent-select")) {
    setAssignAgentSelected(
      controller,
      target.dataset.tenantAssignAgentSelect,
      target.checked,
    );
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

  if (target.matches("[data-tenant-member-org-scope-form]")) {
    event.preventDefault();
    const dialog = getMemberOrgScopeDialog(controller);
    if (!dialog.open || dialog.loading || dialog.busy) {
      return;
    }
    const scopeMode = normalizeMemberOrgScopeMode(dialog.scopeMode);
    const selectableOrgIds = new Set(
      getMemberOrgScopeSelectableOrgs(dialog)
        .map((org) => String(org?.orgId || "").trim())
        .filter(Boolean),
    );
    const orgIds = Array.from(dialog.selectedOrgIds).filter((orgId) => selectableOrgIds.has(orgId));
    if (scopeMode === "custom" && orgIds.length === 0) {
      dialog.error = "请至少选择 1 个组织。";
      render(root, controller);
      setFeedback(root, dialog.error, true);
      return;
    }
    const memberLabel = dialog.memberUsername || dialog.memberId || "该成员";
    dialog.busy = true;
    render(root, controller);
    try {
      await controller.apiClient.setTenantMemberOrgScope({
        userId: dialog.memberId,
        scopeMode,
        sandboxEnabled: dialog.sandboxEnabled,
        ...(scopeMode === "custom" ? { orgIds } : {}),
      });
      controller.memberOrgScopeDialog = createMemberOrgScopeDialogState();
      await refresh(root, controller);
      closeDialog(root.querySelector("[data-tenant-member-org-scope-dialog]"));
      setFeedback(root, `成员“${memberLabel}”组织范围已更新。`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const currentDialog = controller.memberOrgScopeDialog;
      if (currentDialog?.open && currentDialog.memberId === dialog.memberId) {
        currentDialog.busy = false;
        currentDialog.error = errorMessage;
      }
      render(root, controller);
      setFeedback(root, errorMessage, true);
    }
    return;
  }

  if (target.matches("[data-tenant-member-delete-form]")) {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(target).entries());
      const result = await controller.apiClient.deleteTenantMember(payload);
      const memberLabel =
        String(result?.username || controller.deleteMemberTarget?.username || payload.userId || "").trim() ||
        "该成员";
      const revokedAssignmentCount = Number(result?.revokedAssignmentCount || 0);
      controller.dialogs.deleteMemberOpen = false;
      controller.deleteMemberTarget = createDeleteMemberDialogState();
      await refresh(root, controller);
      closeDialog(root.querySelector("[data-tenant-member-delete-dialog]"));
      setFeedback(
        root,
        revokedAssignmentCount > 0
          ? `成员“${memberLabel}”已删除，并同步失效 ${formatNumber(revokedAssignmentCount)} 条 Agent 分配。`
          : `成员“${memberLabel}”已删除。`,
      );
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
    return;
  }

  if (target.matches("[data-tenant-assignment-form]")) {
    event.preventDefault();
    const dialog = getAssignAgentDialog(controller);
    if (!dialog.open || dialog.loading || dialog.busy) {
      return;
    }
    pruneAssignAgentSelection(controller);
    const selectedAgentIds = Array.from(dialog.selectedAgentIds);
    if (!selectedAgentIds.length) {
      dialog.error = "请选择要分配的 Agent。";
      render(root, controller);
      setFeedback(root, dialog.error, true);
      return;
    }
    const dialogToken = Number(dialog.requestToken || 0);
    const memberLabel = dialog.memberUsername || dialog.memberId || "该成员";
    dialog.busy = true;
    render(root, controller);
    try {
      const result = await controller.apiClient.assignTenantAgents({
        userId: dialog.memberId,
        tenantAgentIds: selectedAgentIds,
      });
      const assignedAgentCountValue = Number(
        result?.assignedAssignmentCount ?? result?.assignmentCount ?? selectedAgentIds.length,
      );
      const assignedAgentCount = Number.isFinite(assignedAgentCountValue)
        ? assignedAgentCountValue
        : selectedAgentIds.length;
      if (assignedAgentCount > 0) {
        const currentDialog = controller.assignAgentDialog;
        if (
          currentDialog &&
          currentDialog.open &&
          currentDialog.requestToken === dialogToken &&
          currentDialog.memberId === dialog.memberId
        ) {
          controller.assignAgentDialog = null;
          controller.dialogs.assignOpen = false;
          controller.activeMember = null;
        }
        try {
          await refresh(root, controller);
        } catch (refreshError) {
          render(root, controller);
          setFeedback(
            root,
            refreshError instanceof Error
              ? `已为成员“${memberLabel}”分配 ${formatNumber(assignedAgentCount)} 个 Agent，但列表刷新失败：${refreshError.message}`
              : `已为成员“${memberLabel}”分配 ${formatNumber(assignedAgentCount)} 个 Agent，但列表刷新失败。`,
            true,
          );
          return;
        }
        setFeedback(root, `已为成员“${memberLabel}”分配 ${formatNumber(assignedAgentCount)} 个 Agent。`);
        return;
      }
      const currentDialog = controller.assignAgentDialog;
      if (
        currentDialog &&
        currentDialog.open &&
        currentDialog.requestToken === dialogToken &&
        currentDialog.memberId === dialog.memberId
      ) {
        currentDialog.busy = false;
        currentDialog.loading = false;
        currentDialog.error = "未找到可分配的 Agent。";
        render(root, controller);
        setFeedback(root, currentDialog.error, true);
        return;
      }
      render(root, controller);
      setFeedback(root, "未找到可分配的 Agent。", true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const currentDialog = controller.assignAgentDialog;
      if (
        currentDialog &&
        currentDialog.open &&
        currentDialog.requestToken === dialogToken &&
        currentDialog.memberId === dialog.memberId
      ) {
        currentDialog.busy = false;
        currentDialog.loading = false;
        currentDialog.error = errorMessage;
      }
      render(root, controller);
      setFeedback(root, errorMessage, true);
    }
    return;
  }

  if (target.matches("[data-tenant-revoke-assignment-form]")) {
    event.preventDefault();
    await openRevokeAssignmentConfirmDialog(root, controller);
    return;
  }

  if (target.matches("[data-tenant-revoke-confirm-form]")) {
    event.preventDefault();
    await revokeSelectedAssignments(root, controller);
    return;
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
    clearRevokeAssignmentSelection(controller);
  }
  if (previousSection === "usage-stats" && controller.usageSearchTimer) {
    window.clearTimeout(controller.usageSearchTimer);
    controller.usageSearchTimer = null;
  }
  if (controller.section !== "members") {
    controller.dialogs.createMemberOpen = false;
    controller.memberOrgScopeDialog = createMemberOrgScopeDialogState();
    controller.dialogs.changePasswordOpen = false;
    controller.dialogs.deleteMemberOpen = false;
    controller.passwordMember = null;
    controller.deleteMemberTarget = createDeleteMemberDialogState();
  }
  if (controller.section !== "owned-agents") {
    controller.agentDetailDialog = createAgentDetailDialogState();
  }
  if (controller.section !== "agent-assignment") {
    controller.dialogs.assignOpen = false;
    controller.activeMember = null;
    controller.assignAgentDialog = createAssignAgentDialogState();
    controller.revokeAssignmentDialog = createRevokeAssignmentDialogState();
  }
  if (controller.section === "usage-stats") {
    controller.dialogs.createMemberOpen = false;
    controller.dialogs.assignOpen = false;
    controller.dialogs.changePasswordOpen = false;
    controller.dialogs.deleteMemberOpen = false;
    controller.passwordMember = null;
    controller.deleteMemberTarget = createDeleteMemberDialogState();
    controller.agentDetailDialog = createAgentDetailDialogState();
    controller.activeMember = null;
    controller.assignAgentDialog = createAssignAgentDialogState();
    controller.revokeAssignmentDialog = createRevokeAssignmentDialogState();
  }
  await refresh(root, controller);
  return { root };
}
