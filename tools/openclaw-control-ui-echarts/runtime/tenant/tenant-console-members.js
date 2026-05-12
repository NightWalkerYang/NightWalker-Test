import {
  escapeHtml,
  formatDateTime,
  formatNumber,
} from "./tenant-console-controller.js";
import {
  getDeleteMemberTarget,
  setFeedback,
} from "./tenant-console-dialogs.js";

export function memberStatusLabel(status) {
  return String(status || "").trim() === "active" ? "已启用" : "已禁用";
}

export function memberStatusToggleLabel(status) {
  return String(status || "").trim() === "active" ? "禁用成员" : "启用成员";
}

export function normalizeMemberOrgScopeMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "all" || normalized === "custom" ? normalized : "none";
}

function normalizeSearchQuery(value) {
  return String(value || "").trim().toLowerCase();
}

export function getCurrentTenantDataSourceBinding(controller) {
  if (
    !(controller?.currentDataSourceBinding && typeof controller.currentDataSourceBinding === "object")
  ) {
    return null;
  }
  return controller.currentDataSourceBinding;
}

export function hasCurrentTenantBoundDataSource(controller) {
  const binding = getCurrentTenantDataSourceBinding(controller);
  return Boolean(
    String(binding?.dataSourceId || binding?.dataSourceName || binding?.name || "").trim(),
  );
}

export function getMemberOrgScopeSummary(member, controller) {
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

export function getMemberSandboxSummary(member) {
  return Number(member?.sandboxEnabled || 0) > 0 ? "已启用" : "未启用";
}

export function getEffectiveMemberStatus(controller, member) {
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

export function isMemberStatusBusy(controller, userId) {
  const normalized = String(userId || "").trim();
  return Boolean(
    normalized &&
      controller?.busyMemberStatusIds instanceof Set &&
      controller.busyMemberStatusIds.has(normalized),
  );
}

export function createRevokeAssignmentDialogState() {
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

export function getRevokeAssignmentDialog(controller) {
  if (
    !(controller?.revokeAssignmentDialog && typeof controller.revokeAssignmentDialog === "object")
  ) {
    controller.revokeAssignmentDialog = createRevokeAssignmentDialogState();
  }
  return controller.revokeAssignmentDialog;
}

export function isRevokeAssignmentSelectionTarget(member) {
  return Number(member?.assignedAgentCount || 0) > 0;
}

export function getRevokeAssignmentSelectableAssignments(dialog) {
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

export function getRevokeAssignmentDisplayName(assignment) {
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

export function getRevokeAssignmentConfirmAssignments(dialog) {
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

export function isRevokeAssignmentSelected(controller, assignmentId) {
  return getRevokeAssignmentDialog(controller).selectedAssignmentIds.has(
    String(assignmentId || "").trim(),
  );
}

export function setRevokeAssignmentSelected(controller, assignmentId, selected) {
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

export function clearRevokeAssignmentSelection(controller) {
  getRevokeAssignmentDialog(controller).selectedAssignmentIds.clear();
}

export function pruneRevokeAssignmentSelection(controller) {
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

export function createAssignAgentDialogState() {
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

export function getAssignAgentDialog(controller) {
  if (!(controller?.assignAgentDialog && typeof controller.assignAgentDialog === "object")) {
    controller.assignAgentDialog = createAssignAgentDialogState();
  }
  return controller.assignAgentDialog;
}

export function getAssignableTenantAgents(dialog) {
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

export function getAssignAgentDisplayName(agent) {
  for (const candidate of [agent?.agentName, agent?.description, agent?.agentId, agent?.id]) {
    const value = String(candidate || "").trim();
    if (value) {
      return value;
    }
  }
  return "未知 Agent";
}

export function isAssignAgentSelected(controller, agentId) {
  return getAssignAgentDialog(controller).selectedAgentIds.has(String(agentId || "").trim());
}

export function setAssignAgentSelected(controller, agentId, selected) {
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

export function clearAssignAgentSelection(controller) {
  getAssignAgentDialog(controller).selectedAgentIds.clear();
}

export function pruneAssignAgentSelection(controller) {
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

export function createMemberOrgScopeDialogState() {
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

export function getMemberOrgScopeDialog(controller) {
  if (
    !(controller?.memberOrgScopeDialog && typeof controller.memberOrgScopeDialog === "object")
  ) {
    controller.memberOrgScopeDialog = createMemberOrgScopeDialogState();
  }
  return controller.memberOrgScopeDialog;
}

export function getMemberOrgScopeSelectableOrgs(dialog) {
  if (!Array.isArray(dialog?.orgs)) {
    return [];
  }
  return dialog.orgs.filter((org) => Boolean(String(org?.orgId || "").trim()));
}

export function getVisibleMemberOrgScopeOrgs(dialog) {
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

export function setMemberOrgScopeSelected(controller, orgId, selected) {
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

export function setMemberOrgScopeMode(controller, mode) {
  getMemberOrgScopeDialog(controller).scopeMode = normalizeMemberOrgScopeMode(mode);
}

export function memberById(controller, userId) {
  return controller.members.find((member) => member.id === userId) ?? null;
}

export function renderMembersTable(rows, controller) {
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

export function renderAssignmentTable(rows, controller) {
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

export function renderCreateMemberDialog() {
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

export function renderChangePasswordDialog(controller) {
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

export function renderDeleteMemberDialog(controller) {
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

export function renderMemberOrgScopeDialog(controller) {
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

export function renderAssignDialog(controller, isLocalEdition) {
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

export function renderRevokeAssignmentDialog(controller) {
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

export function renderRevokeAssignmentConfirmDialog(controller) {
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

export function syncAssignAgentSelectionState(root, controller) {
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

export function syncMemberOrgScopeSelectionState(root, controller) {
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

export function syncRevokeAssignmentSelectionState(root, controller) {
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

export function openDeleteMemberDialog(root, controller, memberId, helpers) {
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
  helpers.render(root, controller);
}

export async function updateMemberStatus(root, controller, input, helpers) {
  const userId = String(input.dataset.tenantMemberStatusToggle || "").trim();
  const member = memberById(controller, userId);
  if (!userId || !member || isMemberStatusBusy(controller, userId)) {
    return;
  }
  const nextStatus = input.checked ? "active" : "inactive";
  controller.busyMemberStatusIds.add(userId);
  controller.pendingMemberStatuses.set(userId, nextStatus);
  helpers.render(root, controller);
  try {
    await controller.apiClient.updateTenantMemberStatus({
      userId,
      status: nextStatus,
    });
    await helpers.refresh(root, controller);
    controller.busyMemberStatusIds.delete(userId);
    controller.pendingMemberStatuses.delete(userId);
    helpers.render(root, controller);
    setFeedback(root, nextStatus === "active" ? "成员已启用。" : "成员已禁用。");
  } catch (error) {
    controller.busyMemberStatusIds.delete(userId);
    controller.pendingMemberStatuses.delete(userId);
    helpers.render(root, controller);
    setFeedback(root, error instanceof Error ? error.message : String(error), true);
  }
}

export async function openMemberOrgScopeDialog(root, controller, memberId, helpers) {
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
  helpers.render(root, controller);
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
    helpers.render(root, controller);
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
    helpers.render(root, controller);
    setFeedback(root, currentDialog.error, true);
  }
}

export async function openRevokeAssignmentDialog(root, controller, memberId, helpers) {
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
  helpers.render(root, controller);
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
    helpers.render(root, controller);
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
    helpers.render(root, controller);
    setFeedback(root, currentDialog.error, true);
  }
}

export async function openAssignAgentDialog(root, controller, memberId, helpers) {
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
  helpers.render(root, controller);
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
    helpers.render(root, controller);
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
    helpers.render(root, controller);
    setFeedback(root, currentDialog.error, true);
  }
}

export async function openRevokeAssignmentConfirmDialog(root, controller, helpers) {
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
  helpers.render(root, controller);
}

export async function revokeSelectedAssignments(root, controller, helpers) {
  const dialog = controller.revokeAssignmentDialog;
  if (!dialog?.open || dialog.loading || dialog.busy || !dialog.confirmOpen) {
    return;
  }
  const dialogToken = Number(dialog.requestToken || 0);
  const selectedAssignmentIds = Array.from(dialog.confirmSelectedAssignmentIds || []);
  if (!selectedAssignmentIds.length) {
    dialog.confirmOpen = false;
    dialog.confirmSelectedAssignmentIds = [];
    helpers.render(root, controller);
    setFeedback(root, "请选择要撤回的 Agent。", true);
    return;
  }
  const memberLabel = dialog.memberUsername || dialog.memberId || "该成员";
  dialog.busy = true;
  helpers.render(root, controller);
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
        await helpers.refresh(root, controller);
      } catch (refreshError) {
        helpers.render(root, controller);
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
      helpers.render(root, controller);
      setFeedback(root, currentDialog.error, true);
      return;
    }
    helpers.render(root, controller);
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
    helpers.render(root, controller);
    setFeedback(root, errorMessage, true);
  }
}
