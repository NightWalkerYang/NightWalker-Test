import { createTenantApiClient } from "./api-client.js";
import { showTransientFeedbackToast } from "./feedback-toast.js";
import {
  PLATFORM_AGENT_ASSIGNMENT_VIEW,
  PLATFORM_LOGIN_ROUTE,
  PLATFORM_NODE_MANAGEMENT_VIEW,
  PLATFORM_TENANT_MANAGEMENT_VIEW,
  requireTenantSession,
} from "./tenant-context.js";

const PAGE_SELECTOR = "[data-oc-platform-tenant-console-page]";
const BODY_SECTION_ATTR = "data-oc-platform-body-section";
const PAGE_SIZE = 8;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function currentSectionHref(section) {
  if (section === "agent-allocation") {
    return `./?ocTenantView=${PLATFORM_AGENT_ASSIGNMENT_VIEW}`;
  }
  if (section === "nodes") {
    return `./?ocTenantView=${PLATFORM_NODE_MANAGEMENT_VIEW}`;
  }
  return `./?ocTenantView=${PLATFORM_TENANT_MANAGEMENT_VIEW}`;
}

function isLocalEdition(controller) {
  return controller?.session?.session?.edition === "local";
}

function formatNumber(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat("zh-CN").format(numeric)
    : "0";
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

function formatDateTimeInputValue(value) {
  if (!value) {
    return "";
  }
  const timestamp = Date.parse(String(value));
  if (Number.isNaN(timestamp)) {
    return String(value);
  }
  const date = new Date(timestamp);
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ];
  const time = [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ];
  return `${parts[0]}-${parts[1]}-${parts[2]}T${time[0]}:${time[1]}`;
}

function deploymentModeLabel(mode) {
  return mode === "local" ? "本地部署" : "公有云";
}

function localLicenseStatusLabel(localLicense) {
  if (!localLicense || localLicense.edition !== "local") {
    return "-";
  }
  if (localLicense.status === "active") {
    return "授权有效";
  }
  if (localLicense.status === "expired") {
    return "已到期只读";
  }
  if (localLicense.status === "missing") {
    return "未导入授权";
  }
  return "授权无效";
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

function createRevokeTenantAgentDialogState() {
  return {
    open: false,
    loading: false,
    busy: false,
    confirmOpen: false,
    confirmSelectedTenantAgentIds: [],
    tenantId: "",
    tenantName: "",
    agents: [],
    selectedTenantAgentIds: new Set(),
    error: "",
    requestToken: 0,
  };
}

function createAssignTenantAgentDialogState() {
  return {
    open: false,
    loading: false,
    busy: false,
    tenantId: "",
    tenantName: "",
    agents: [],
    assignedAgentIds: new Set(),
    selectedAgentIds: new Set(),
    description: "",
    rateMultiplier: "1",
    balancePoints: "0",
    error: "",
    requestToken: 0,
  };
}

function getAssignTenantAgentDialog(controller) {
  if (
    !(controller?.assignTenantAgentDialog && typeof controller.assignTenantAgentDialog === "object")
  ) {
    controller.assignTenantAgentDialog = createAssignTenantAgentDialogState();
  }
  return controller.assignTenantAgentDialog;
}

function getRevokeTenantAgentDialog(controller) {
  if (
    !(
      controller?.revokeTenantAgentDialog &&
      typeof controller.revokeTenantAgentDialog === "object"
    )
  ) {
    controller.revokeTenantAgentDialog = createRevokeTenantAgentDialogState();
  }
  return controller.revokeTenantAgentDialog;
}

function createNodeDialogState() {
  return {
    id: "",
    name: "",
    sharedSecret: "",
    status: "active",
    leaseStatus: "active",
    leaseExpiresAt: "",
    error: "",
    editing: false,
  };
}

function createBindNodeDialogState() {
  return {
    tenantId: "",
    tenantName: "",
    nodeId: "",
    error: "",
  };
}

function createDataSourceDialogState() {
  return {
    id: "",
    name: "",
    status: "active",
    connectionJson: "",
    k3cloudProfileJson: "",
    editing: false,
    error: "",
  };
}

function isTenantRevokeSelectionTarget(tenant) {
  return Number(tenant?.agentCount || 0) > 0;
}

function getRevokeTenantAgentSelectableAgents(dialog) {
  if (!Array.isArray(dialog?.agents)) {
    return [];
  }
  return dialog.agents.filter((agent) => Boolean(String(agent?.id || "").trim()));
}

function getRevokeTenantAgentDisplayName(agent) {
  for (const candidate of [agent?.agentName, agent?.description, agent?.agentId, agent?.id]) {
    const value = String(candidate || "").trim();
    if (value) {
      return value;
    }
  }
  return "未知 Agent";
}

function getRevokeTenantAgentConfirmAgents(dialog) {
  const selectedTenantAgentIds = new Set(
    Array.isArray(dialog?.confirmSelectedTenantAgentIds)
      ? dialog.confirmSelectedTenantAgentIds
          .map((tenantAgentId) => String(tenantAgentId || "").trim())
          .filter(Boolean)
      : [],
  );
  if (!selectedTenantAgentIds.size) {
    return [];
  }
  return getRevokeTenantAgentSelectableAgents(dialog).filter((agent) =>
    selectedTenantAgentIds.has(String(agent.id || "").trim()),
  );
}

function isRevokeTenantAgentSelected(controller, tenantAgentId) {
  return getRevokeTenantAgentDialog(controller).selectedTenantAgentIds.has(
    String(tenantAgentId || "").trim(),
  );
}

function setRevokeTenantAgentSelected(controller, tenantAgentId, selected) {
  const normalized = String(tenantAgentId || "").trim();
  if (!normalized) {
    return;
  }
  const dialog = getRevokeTenantAgentDialog(controller);
  if (selected) {
    dialog.selectedTenantAgentIds.add(normalized);
    return;
  }
  dialog.selectedTenantAgentIds.delete(normalized);
}

function clearRevokeTenantAgentSelection(controller) {
  getRevokeTenantAgentDialog(controller).selectedTenantAgentIds.clear();
}

function pruneRevokeTenantAgentSelection(controller) {
  const dialog = controller?.revokeTenantAgentDialog;
  if (!dialog?.open) {
    return;
  }
  const tenantAgentIds = new Set(
    getRevokeTenantAgentSelectableAgents(dialog).map((agent) => String(agent.id || "").trim()),
  );
  for (const tenantAgentId of Array.from(dialog.selectedTenantAgentIds)) {
    if (!tenantAgentIds.has(tenantAgentId)) {
      dialog.selectedTenantAgentIds.delete(tenantAgentId);
    }
  }
}

function getAssignablePlatformCatalogAgents(dialog) {
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

function getAssignTenantAgentDisplayName(agent) {
  for (const candidate of [
    agent?.name,
    agent?.agentName,
    agent?.label,
    agent?.description,
    agent?.agentId,
    agent?.id,
  ]) {
    const value = String(candidate || "").trim();
    if (value) {
      return value;
    }
  }
  return "未知 Agent";
}

function isAssignTenantAgentSelected(controller, agentId) {
  return getAssignTenantAgentDialog(controller).selectedAgentIds.has(String(agentId || "").trim());
}

function setAssignTenantAgentSelected(controller, agentId, selected) {
  const normalized = String(agentId || "").trim();
  if (!normalized) {
    return;
  }
  const dialog = getAssignTenantAgentDialog(controller);
  if (selected) {
    dialog.selectedAgentIds.add(normalized);
    return;
  }
  dialog.selectedAgentIds.delete(normalized);
}

function clearAssignTenantAgentSelection(controller) {
  getAssignTenantAgentDialog(controller).selectedAgentIds.clear();
}

function pruneAssignTenantAgentSelection(controller) {
  const dialog = controller?.assignTenantAgentDialog;
  if (!dialog?.open) {
    return;
  }
  const agentIds = new Set(
    getAssignablePlatformCatalogAgents(dialog).map((agent) => String(agent.id || "").trim()),
  );
  for (const agentId of Array.from(dialog.selectedAgentIds)) {
    if (!agentIds.has(agentId)) {
      dialog.selectedAgentIds.delete(agentId);
    }
  }
}

function ensureController(root, session, apiClient) {
  if (root.__ocPlatformConsoleController) {
    root.__ocPlatformConsoleController.session = session;
    return root.__ocPlatformConsoleController;
  }

  const controller = {
    apiClient,
    session,
    section: "tenants",
    searchBySection: {
      tenants: "",
      "agent-allocation": "",
      nodes: "",
    },
    pageBySection: {
      tenants: 1,
      "agent-allocation": 1,
      nodes: 1,
    },
    tenants: [],
    nodes: [],
    catalogAgents: [],
    rateDialogAgents: [],
    dialogs: {
      createTenantOpen: false,
      memberLimitOpen: false,
      assignOpen: false,
      rateOpen: false,
      localLicenseOpen: false,
      dataSourceOpen: false,
      nodeOpen: false,
      bindNodeOpen: false,
    },
    activeTenant: null,
    activeNode: null,
    dataSources: [],
    tenantDataSourceBindings: [],
    syncSchedules: [],
    assignTenantAgentDialog: createAssignTenantAgentDialogState(),
    dataSourceDialog: createDataSourceDialogState(),
    nodeDialog: createNodeDialogState(),
    bindNodeDialog: createBindNodeDialogState(),
    loadingRateAgents: false,
    localLicense: null,
    revokeTenantAgentDialog: createRevokeTenantAgentDialogState(),
  };

  root.__ocPlatformConsoleController = controller;
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
    if (event.target.matches("[data-platform-create-dialog]")) {
      controller.dialogs.createTenantOpen = false;
    }
    if (event.target.matches("[data-platform-member-limit-dialog]")) {
      controller.dialogs.memberLimitOpen = false;
    }
    if (event.target.matches("[data-platform-assign-dialog]")) {
      controller.dialogs.assignOpen = false;
      controller.assignTenantAgentDialog = createAssignTenantAgentDialogState();
    }
    if (event.target.matches("[data-platform-rate-dialog]")) {
      controller.dialogs.rateOpen = false;
      controller.rateDialogAgents = [];
    }
    if (event.target.matches("[data-platform-local-license-dialog]")) {
      controller.dialogs.localLicenseOpen = false;
    }
    if (event.target.matches("[data-platform-node-dialog]")) {
      controller.dialogs.nodeOpen = false;
      controller.nodeDialog = createNodeDialogState();
    }
    if (event.target.matches("[data-platform-bind-node-dialog]")) {
      controller.dialogs.bindNodeOpen = false;
      controller.bindNodeDialog = createBindNodeDialogState();
    }
    if (event.target.matches("[data-platform-revoke-tenant-agent-dialog]")) {
      controller.revokeTenantAgentDialog = createRevokeTenantAgentDialogState();
    }
    if (event.target.matches("[data-platform-revoke-confirm-dialog]")) {
      const dialog = getRevokeTenantAgentDialog(controller);
      dialog.confirmOpen = false;
      dialog.confirmSelectedTenantAgentIds = [];
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

function filterTenants(controller) {
  const query = getSearchValue(controller).trim().toLowerCase();
  if (!query) {
    return controller.tenants;
  }
  return controller.tenants.filter((tenant) =>
    [
      tenant.name,
      tenant.code,
      deploymentModeLabel(tenant.deploymentMode),
      tenant.status,
      tenant.boundNodeName,
      tenant.boundNodeId,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
}

function filterNodes(controller) {
  const query = getSearchValue(controller).trim().toLowerCase();
  if (!query) {
    return controller.nodes;
  }
  return controller.nodes.filter((node) =>
    [node.id, node.name, node.status, node.leaseStatus]
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
  const isTenantSection = controller.section === "tenants";
  const isNodeSection = controller.section === "nodes";
  const localEdition = isLocalEdition(controller);
  return `
    <div class="data-table-toolbar oc-platform-table-toolbar">
      <label class="data-table-search">
        <input
          type="search"
          placeholder="${
            isNodeSection ? "搜索节点名称或标识" : isTenantSection ? "搜索租户名称或编码" : "搜索租户名称或编码"
          }"
          value="${escapeHtml(getSearchValue(controller))}"
          data-platform-search
        />
      </label>
      ${
        isTenantSection
          ? `<button class="btn primary" type="button" data-platform-open-create>创建租户</button>`
          : ""
      }
      ${
        isNodeSection
          ? `<button class="btn primary" type="button" data-platform-open-node>创建节点</button>`
          : ""
      }
      ${
        isTenantSection && localEdition
          ? `<button class="btn" type="button" data-platform-open-local-license>授权管理</button>`
          : ""
      }
    </div>
  `;
}

function renderTenantManagementTable(controller, rows) {
  const localEdition = isLocalEdition(controller);
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>租户名称</th>
            <th>租户编码</th>
            <th>状态</th>
            <th>成员数</th>
            <th>人数上限</th>
            <th>数据源</th>
            ${localEdition ? "" : "<th>部署模式</th><th>受管节点</th><th>钱包积分</th><th>到期日期</th>"}
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (tenant) => `
                      ${(() => {
                        const binding = bindingByTenantId(controller, tenant.id);
                        return `
                      <tr>
                        <td>${escapeHtml(tenant.name)}</td>
                        <td>${escapeHtml(tenant.code)}</td>
                        <td><span class="data-table-badge data-table-badge--${tenant.status === "active" ? "direct" : "unknown"}">${escapeHtml(tenant.status)}</span></td>
                        <td>${formatNumber(tenant.memberCount)}</td>
                        <td>${formatNumber(tenant.memberLimit)}</td>
                        <td>${escapeHtml(String(binding?.dataSourceName || "未绑定").trim() || "未绑定")}</td>
                        ${
                          localEdition
                            ? ""
                            : `
                              <td>${escapeHtml(deploymentModeLabel(tenant.deploymentMode))}</td>
                              <td>${escapeHtml(String(tenant.boundNodeName || tenant.boundNodeId || "未绑定").trim() || "未绑定")}</td>
                              <td>${formatNumber(tenant.walletBalance)}</td>
                              <td>${escapeHtml(formatDateTime(tenant.licenseExpiresAt))}</td>
                            `
                        }
                        <td>
                          <div class="oc-platform-table-actions">
                            <button class="btn" type="button" data-platform-open-member-limit="${escapeHtml(tenant.id)}">人数调整</button>
                            <button class="btn" type="button" data-platform-bind-data-source="${escapeHtml(tenant.id)}">数据源绑定</button>
                            ${
                              localEdition
                                ? ""
                                : `<button class="btn" type="button" data-platform-open-bind-node="${escapeHtml(tenant.id)}">节点绑定</button>`
                            }
                          </div>
                        </td>
                      </tr>
                    `})()}
                    `,
                  )
                  .join("")
              : `<tr><td colspan="${localEdition ? 7 : 11}" class="oc-platform-table-empty">暂无租户数据</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderNodeManagementTable(rows) {
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>节点标识</th>
            <th>节点名称</th>
            <th>状态</th>
            <th>授权状态</th>
            <th>授权到期</th>
            <th>已绑定租户</th>
            <th>本机 Agent</th>
            <th>最后心跳</th>
            <th>同步版本</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (node) => `
                      <tr>
                        <td>${escapeHtml(node.id)}</td>
                        <td>${escapeHtml(node.name)}</td>
                        <td><span class="data-table-badge data-table-badge--${node.status === "active" ? "direct" : "unknown"}">${escapeHtml(node.status)}</span></td>
                        <td>${escapeHtml(node.leaseStatus || "-")}</td>
                        <td>${escapeHtml(formatDateTime(node.leaseExpiresAt))}</td>
                        <td>${formatNumber(node.boundTenantCount)}</td>
                        <td>${formatNumber(node.agentCount)}</td>
                        <td>${escapeHtml(formatDateTime(node.lastHeartbeatAt))}</td>
                        <td>${escapeHtml(`${formatNumber(node.lastAppliedRevision)} / ${formatNumber(node.desiredRevision)}`)}</td>
                        <td>
                          <div class="oc-platform-table-actions">
                            <button class="btn" type="button" data-platform-open-edit-node="${escapeHtml(node.id)}">编辑</button>
                          </div>
                        </td>
                      </tr>
                    `,
                  )
                  .join("")
              : `<tr><td colspan="10" class="oc-platform-table-empty">暂无节点数据</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderAgentAssignmentTable(controller, rows) {
  const localEdition = isLocalEdition(controller);
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>租户名称</th>
            <th>租户编码</th>
            <th>成员数</th>
            <th>已分配 Agent</th>
            ${localEdition ? "" : "<th>部署模式</th><th>钱包积分</th>"}
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (tenant) => `
                      <tr>
                        <td>${escapeHtml(tenant.name)}</td>
                        <td>${escapeHtml(tenant.code)}</td>
                        <td>${formatNumber(tenant.memberCount)}</td>
                        <td>${formatNumber(tenant.agentCount)}</td>
                        ${
                          localEdition
                            ? ""
                            : `
                              <td>${escapeHtml(deploymentModeLabel(tenant.deploymentMode))}</td>
                              <td>${formatNumber(tenant.walletBalance)}</td>
                            `
                        }
                        <td><span class="data-table-badge data-table-badge--${tenant.status === "active" ? "direct" : "unknown"}">${escapeHtml(tenant.status)}</span></td>
                        <td>
                          <div class="oc-platform-table-actions">
                            <button class="btn" type="button" data-platform-open-assign="${escapeHtml(tenant.id)}">分配Agent</button>
                            <button
                              class="btn oc-platform-destructive-action"
                              type="button"
                              data-platform-open-revoke="${escapeHtml(tenant.id)}"
                              ${isTenantRevokeSelectionTarget(tenant) ? "" : "disabled"}
                            >
                              撤回分配
                            </button>
                            ${localEdition ? "" : `<button class="btn" type="button" data-platform-open-rate="${escapeHtml(tenant.id)}">倍率调整</button>`}
                          </div>
                        </td>
                      </tr>
                    `,
                  )
                  .join("")
              : `<tr><td colspan="${localEdition ? 6 : 8}" class="oc-platform-table-empty">暂无租户数据</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderPagination(controller, pagination) {
  return `
    <div class="data-table-pagination">
      <div class="data-table-pagination__info">
        共 ${formatNumber(pagination.totalItems)} 条，第 ${formatNumber(pagination.page)} / ${formatNumber(pagination.totalPages)} 页
      </div>
      <div class="data-table-pagination__controls">
        <button type="button" data-platform-page="prev" ${pagination.page <= 1 ? "disabled" : ""}>上一页</button>
        <button type="button" data-platform-page="next" ${pagination.page >= pagination.totalPages ? "disabled" : ""}>下一页</button>
      </div>
    </div>
  `;
}

function renderCreateDialog(controller) {
  const localEdition = isLocalEdition(controller);
  return `
    <dialog class="oc-platform-modal" data-platform-create-dialog>
      <div class="oc-platform-modal__panel">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">创建租户</h3>
          <button class="btn" type="button" data-platform-close-dialog="create">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          <form class="oc-platform-modal__form" data-platform-tenant-form>
            <label class="field"><span>租户编码</span><input name="code" type="text" required /></label>
            <label class="field"><span>租户名称</span><input name="name" type="text" required /></label>
            <label class="field"><span>管理员账号</span><input name="adminUsername" type="text" required /></label>
            <label class="field"><span>管理员密码</span><input name="adminPassword" type="password" required /></label>
            <label class="field"><span>人数上限</span><input name="memberLimit" type="number" min="1" value="5" required /></label>
            ${
              localEdition
                ? `<input type="hidden" name="deploymentMode" value="local" />`
                : `
                  <label class="field">
                    <span>部署模式</span>
                    <select name="deploymentMode">
                      <option value="cloud">公有云</option>
                      <option value="local">本地部署</option>
                    </select>
                  </label>
                  <label class="field"><span>到期日期（可选）</span><input name="licenseExpiresAt" type="datetime-local" /></label>
                  <label class="field"><span>续期码（可选）</span><input name="renewalCode" type="text" /></label>
                `
            }
            <div class="oc-platform-modal__actions">
              <button class="btn primary" type="submit">创建租户</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

function bindingByTenantId(controller, tenantId) {
  return (
    (Array.isArray(controller.tenantDataSourceBindings)
      ? controller.tenantDataSourceBindings
      : []
    ).find((item) => item.tenantId === tenantId) ?? null
  );
}

function renderDataSourceOverview(controller) {
  const dataSources = Array.isArray(controller.dataSources) ? controller.dataSources : [];
  const syncSchedules = Array.isArray(controller.syncSchedules) ? controller.syncSchedules : [];
  return `
    <section class="oc-platform-summary-cards" style="margin-bottom:16px;display:grid;gap:16px;">
      <div class="data-table-container" style="padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
          <div>
            <h3 style="margin:0 0 6px 0;">数据源管理</h3>
            <p style="margin:0;color:var(--oc-text-subtle, #666);">维护租户级 PostgreSQL 连接与 K3Cloud 登录档案。</p>
          </div>
          <button class="btn primary" type="button" data-platform-open-data-source>新增数据源</button>
        </div>
        <div style="margin-top:16px;overflow:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>状态</th>
                <th>已绑定租户</th>
                <th>K3Cloud</th>
                <th>增量计划</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${
                dataSources.length
                  ? dataSources
                      .map((item) => {
                        const boundCount = controller.tenantDataSourceBindings.filter(
                          (binding) => binding.dataSourceId === item.id,
                        ).length;
                        const scheduleCount = syncSchedules.filter(
                          (schedule) => schedule.dataSourceId === item.id,
                        ).length;
                        return `
                          <tr>
                            <td>${escapeHtml(item.name)}</td>
                            <td>${escapeHtml(item.status || "active")}</td>
                            <td>${formatNumber(boundCount)}</td>
                            <td>${item.k3cloudProfileJson ? "已配置" : "未配置"}</td>
                            <td>${formatNumber(scheduleCount)}</td>
                            <td><button class="btn" type="button" data-platform-edit-data-source="${escapeHtml(item.id)}">编辑</button></td>
                          </tr>
                        `;
                      })
                      .join("")
                  : `<tr><td colspan="6" class="oc-platform-table-empty">暂无数据源</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function renderDataSourceDialog(controller) {
  const dialog = controller.dataSourceDialog || createDataSourceDialogState();
  return `
    <dialog class="oc-platform-modal" data-platform-data-source-dialog>
      <div class="oc-platform-modal__panel">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">${dialog.editing ? "编辑数据源" : "新增数据源"}</h3>
          <button class="btn" type="button" data-platform-close-dialog="data-source">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          <form class="oc-platform-modal__form" data-platform-data-source-form>
            <input type="hidden" name="id" value="${escapeHtml(dialog.id)}" />
            <label class="field"><span>名称</span><input name="name" type="text" value="${escapeHtml(dialog.name)}" required /></label>
            <label class="field">
              <span>状态</span>
              <select name="status">
                <option value="active" ${dialog.status === "active" ? "selected" : ""}>active</option>
                <option value="inactive" ${dialog.status === "inactive" ? "selected" : ""}>inactive</option>
              </select>
            </label>
            <label class="field">
              <span>PostgreSQL 连接 JSON</span>
              <textarea name="connectionJson" rows="8" placeholder='{"analyticsPgDsn":"postgresql:///db?host=/var/run/postgresql"}'>${escapeHtml(dialog.connectionJson)}</textarea>
            </label>
            <label class="field">
              <span>K3Cloud 档案 JSON</span>
              <textarea name="k3cloudProfileJson" rows="12" placeholder='{"base_url":"http://.../k3cloud/","login_path":"Kingdee.BOS.WebApi.ServicesStub.AuthService.LoginByAppSecret.common.kdsvc"}'>${escapeHtml(dialog.k3cloudProfileJson)}</textarea>
            </label>
            <div class="oc-platform-modal__actions">
              <button class="btn primary" type="submit">${dialog.editing ? "保存" : "创建"}</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

function renderMemberLimitDialog(controller) {
  const tenant = controller.activeTenant;
  return `
    <dialog class="oc-platform-modal" data-platform-member-limit-dialog>
      <div class="oc-platform-modal__panel">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">人数调整</h3>
          <button class="btn" type="button" data-platform-close-dialog="member-limit">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          ${
            tenant
              ? `
                <form class="oc-platform-modal__form" data-platform-member-limit-form>
                  <input type="hidden" name="tenantId" value="${escapeHtml(tenant.id)}" />
                  <label class="field"><span>目标租户</span><input type="text" value="${escapeHtml(tenant.name)}" disabled /></label>
                  <label class="field"><span>当前成员数</span><input type="text" value="${formatNumber(tenant.memberCount)}" disabled /></label>
                  <label class="field"><span>人数上限</span><input name="memberLimit" type="number" min="${Math.max(1, Number(tenant.memberCount || 0))}" value="${escapeHtml(tenant.memberLimit)}" required /></label>
                  <div class="oc-platform-modal__actions">
                    <button class="btn primary" type="submit">保存</button>
                  </div>
                </form>
              `
              : `<div class="callout info">请选择租户后再操作。</div>`
          }
        </div>
      </div>
    </dialog>
  `;
}

function renderAssignDialog(controller) {
  const dialog = getAssignTenantAgentDialog(controller);
  const selectedCount = dialog.selectedAgentIds.size;
  const selectableAgents = getAssignablePlatformCatalogAgents(dialog);
  const allAgentsSelected =
    selectableAgents.length > 0 && selectedCount === selectableAgents.length;
  const localEdition = isLocalEdition(controller);
  const statusMarkup = dialog.loading
    ? `<div class="callout info">正在加载该租户可分配的 Agent...</div>`
    : dialog.error
      ? `<div class="callout info">${escapeHtml(dialog.error)}</div>`
      : "";
  const listMarkup =
    !dialog.loading && selectableAgents.length
      ? `
        <div class="data-table-container oc-platform-revoke-agent-list">
          <table class="data-table">
            <thead>
              <tr>
                <th class="oc-platform-agent-select-col"></th>
                <th>Agent</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              ${selectableAgents
                .map(
                  (agent) => `
                    <tr>
                      <td class="oc-platform-agent-select-cell">
                        <input
                          type="checkbox"
                          data-platform-assign-agent-select="${escapeHtml(agent.id)}"
                          aria-label="选择 ${escapeHtml(getAssignTenantAgentDisplayName(agent))}"
                          ${dialog.busy ? "disabled" : ""}
                          ${isAssignTenantAgentSelected(controller, agent.id) ? "checked" : ""}
                        />
                      </td>
                      <td>
                        <div class="oc-platform-revoke-agent__name">${escapeHtml(getAssignTenantAgentDisplayName(agent))}</div>
                        <div class="oc-platform-revoke-agent__meta">${escapeHtml(agent.id || "-")}</div>
                      </td>
                      <td>${escapeHtml(agent.description || agent.summary || "-")}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `
      : !dialog.loading && !dialog.error
        ? `<div class="callout info">该租户当前没有可分配的 Agent。</div>`
        : "";
  return `
    <dialog class="oc-platform-modal oc-platform-modal--wide" data-platform-assign-dialog>
      <div class="oc-platform-modal__panel oc-platform-modal__panel--wide">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">分配Agent</h3>
          <button class="btn" type="button" data-platform-close-dialog="assign">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          ${
            dialog.tenantId
              ? `
                <form class="oc-platform-modal__form" data-platform-agent-form>
                  <input type="hidden" name="tenantId" value="${escapeHtml(dialog.tenantId)}" />
                  <label class="field"><span>目标租户</span><input type="text" value="${escapeHtml(dialog.tenantName || dialog.tenantId)}" disabled /></label>
                  <div class="field">
                    <span>平台已有 Agent</span>
                    <div class="oc-platform-revoke-agent-toolbar">
                      <label class="oc-platform-revoke-agent-toolbar__select-all">
                        <input
                          type="checkbox"
                          data-platform-assign-agent-select-all
                          aria-label="全选可分配的 Agent"
                          ${dialog.loading || dialog.busy || !selectableAgents.length ? "disabled" : ""}
                          ${allAgentsSelected ? "checked" : ""}
                        />
                        <span>全选</span>
                      </label>
                      <span class="oc-platform-revoke-agent-toolbar__summary">
                        已选择 ${formatNumber(selectedCount)} 个 Agent
                      </span>
                    </div>
                  </div>
                  ${statusMarkup}
                  ${listMarkup}
                  <label class="field">
                    <span>简短描述</span>
                    <input
                      name="description"
                      type="text"
                      data-platform-assign-description
                      value="${escapeHtml(dialog.description)}"
                      placeholder="显示在租户 Agent 列表和成员分配里的描述"
                      ${dialog.busy ? "disabled" : ""}
                    />
                  </label>
                  ${
                    localEdition
                      ? `
                        <input type="hidden" name="rateMultiplier" value="1" />
                        <input type="hidden" name="balancePoints" value="0" />
                      `
                      : `
                        <label class="field">
                          <span>计费倍率</span>
                          <input
                            name="rateMultiplier"
                            type="number"
                            step="0.01"
                            min="0"
                            data-platform-assign-rate-multiplier
                            value="${escapeHtml(dialog.rateMultiplier)}"
                            ${dialog.busy ? "disabled" : ""}
                            required
                          />
                        </label>
                        <label class="field">
                          <span>初始积分</span>
                          <input
                            name="balancePoints"
                            type="number"
                            step="0.01"
                            min="0"
                            data-platform-assign-balance-points
                            value="${escapeHtml(dialog.balancePoints)}"
                            ${dialog.busy ? "disabled" : ""}
                            required
                          />
                        </label>
                      `
                  }
                  <div class="oc-platform-modal__actions">
                    <button class="btn" type="button" data-platform-close-dialog="assign">取消</button>
                    <button class="btn primary" type="submit" ${dialog.loading || dialog.busy || selectedCount === 0 ? "disabled" : ""}>保存分配</button>
                  </div>
                </form>
              `
              : `<div class="callout info">请选择租户后再操作。</div>`
          }
        </div>
      </div>
    </dialog>
  `;
}

function renderRateDialog(controller) {
  const tenant = controller.activeTenant;
  const agents = controller.rateDialogAgents;
  return `
    <dialog class="oc-platform-modal oc-platform-modal--wide" data-platform-rate-dialog>
      <div class="oc-platform-modal__panel oc-platform-modal__panel--wide">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">倍率调整</h3>
          <button class="btn" type="button" data-platform-close-dialog="rate">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          ${
            !tenant
              ? `<div class="callout info">请选择租户后再操作。</div>`
              : controller.loadingRateAgents
                ? `<div class="callout info">正在加载当前租户的 Agent...</div>`
                : agents.length
                  ? `
                    <form class="oc-platform-modal__form" data-platform-rate-form>
                      <input type="hidden" name="tenantId" value="${escapeHtml(tenant.id)}" />
                      <div class="data-table-container">
                        <table class="data-table">
                          <thead>
                            <tr>
                              <th>Agent</th>
                              <th>描述</th>
                              <th>当前积分</th>
                              <th>倍率</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${agents
                              .map(
                                (agent) => `
                                  <tr>
                                    <td>${escapeHtml(agent.agentName)}</td>
                                    <td>${escapeHtml(agent.description || "-")}</td>
                                    <td>${formatNumber(agent.balancePoints)}</td>
                                    <td>
                                      <input
                                        class="oc-platform-rate-input"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        name="rateMultiplier:${escapeHtml(agent.id)}"
                                        value="${escapeHtml(agent.rateMultiplier ?? 1)}"
                                      />
                                    </td>
                                  </tr>
                                `,
                              )
                              .join("")}
                          </tbody>
                        </table>
                      </div>
                      <div class="oc-platform-modal__actions">
                        <button class="btn primary" type="submit">保存倍率</button>
                      </div>
                    </form>
                  `
                  : `<div class="callout info">该租户当前还没有已分配的 Agent。</div>`
          }
        </div>
      </div>
    </dialog>
  `;
}

function renderRevokeTenantAgentDialog(controller) {
  const dialog = getRevokeTenantAgentDialog(controller);
  const selectedCount = dialog.selectedTenantAgentIds.size;
  const selectableAgents = getRevokeTenantAgentSelectableAgents(dialog);
  const allAgentsSelected =
    selectableAgents.length > 0 && selectedCount === selectableAgents.length;
  const statusMarkup = dialog.loading
    ? `<div class="callout info">正在加载该租户已下发的 Agent...</div>`
    : dialog.error
      ? `<div class="callout info">${escapeHtml(dialog.error)}</div>`
      : "";
  const listMarkup =
    !dialog.loading && dialog.agents.length
      ? `
        <div class="data-table-container oc-platform-revoke-agent-list">
          <table class="data-table">
            <thead>
              <tr>
                <th class="oc-platform-agent-select-col"></th>
                <th>Agent</th>
                <th>说明</th>
                <th>当前积分</th>
              </tr>
            </thead>
            <tbody>
              ${dialog.agents
                .map(
                  (agent) => `
                    <tr>
                      <td class="oc-platform-agent-select-cell">
                        <input
                          type="checkbox"
                          data-platform-revoke-agent-select="${escapeHtml(agent.id)}"
                          aria-label="选择 ${escapeHtml(getRevokeTenantAgentDisplayName(agent))}"
                          ${dialog.busy ? "disabled" : ""}
                          ${isRevokeTenantAgentSelected(controller, agent.id) ? "checked" : ""}
                        />
                      </td>
                      <td>
                        <div class="oc-platform-revoke-agent__name">${escapeHtml(getRevokeTenantAgentDisplayName(agent))}</div>
                        <div class="oc-platform-revoke-agent__meta">${escapeHtml(agent.agentId || agent.id || "-")}</div>
                      </td>
                      <td>${escapeHtml(agent.description || "-")}</td>
                      <td>${formatNumber(agent.balancePoints)}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `
      : !dialog.loading && !dialog.error
        ? `<div class="callout info">该租户当前没有可撤回的 Agent。</div>`
        : "";
  return `
    <dialog class="oc-platform-modal oc-platform-modal--wide" data-platform-revoke-tenant-agent-dialog>
      <div class="oc-platform-modal__panel oc-platform-modal__panel--wide">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">撤回分配</h3>
          <button class="btn" type="button" data-platform-close-dialog="revoke">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          <form class="oc-platform-modal__form" data-platform-revoke-tenant-agent-form>
            <input type="hidden" name="tenantId" value="${escapeHtml(dialog.tenantId)}" />
            <label class="field">
              <span>目标租户</span>
              <input type="text" value="${escapeHtml(dialog.tenantName || dialog.tenantId)}" disabled />
            </label>
            <div class="oc-platform-revoke-agent-toolbar">
              <label class="oc-platform-revoke-agent-toolbar__select-all">
                <input
                  type="checkbox"
                  data-platform-revoke-agent-select-all
                  aria-label="全选该租户已下发的 Agent"
                  ${dialog.loading || dialog.busy || !selectableAgents.length ? "disabled" : ""}
                  ${allAgentsSelected ? "checked" : ""}
                />
                <span>全选</span>
              </label>
              <span class="oc-platform-revoke-agent-toolbar__summary">
                已选择 ${formatNumber(selectedCount)} 个 Agent
              </span>
            </div>
            ${statusMarkup}
            ${listMarkup}
            <div class="oc-platform-modal__actions">
              <button class="btn" type="button" data-platform-close-dialog="revoke">取消</button>
              <button class="btn primary" type="submit" ${dialog.loading || dialog.busy || selectedCount === 0 ? "disabled" : ""}>下一步</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

function renderRevokeTenantAgentConfirmDialog(controller) {
  const dialog = getRevokeTenantAgentDialog(controller);
  if (!dialog.confirmOpen) {
    return "";
  }
  const selectedAgents = getRevokeTenantAgentConfirmAgents(dialog);
  const tenantLabel = dialog.tenantName || dialog.tenantId || "该租户";
  const selectedCount = selectedAgents.length || dialog.confirmSelectedTenantAgentIds.length;
  return `
    <dialog class="oc-platform-modal" data-platform-revoke-confirm-dialog>
      <div class="oc-platform-modal__panel">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">确认撤回</h3>
          <button class="btn" type="button" data-platform-close-dialog="revoke-confirm">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          <div class="callout info">
            确认后将立即撤回租户“${escapeHtml(tenantLabel)}”已选中的 ${formatNumber(selectedCount)} 个 Agent，并同步失效该租户成员上的相关分配。
          </div>
          ${
            selectedAgents.length
              ? `
                <section class="oc-platform-revoke-confirm">
                  <div class="oc-platform-revoke-confirm__title">将撤回的 Agent</div>
                  <ul class="oc-platform-revoke-confirm__list">
                    ${selectedAgents
                      .map(
                        (agent) => `
                          <li>
                            <div class="oc-platform-revoke-confirm__name">${escapeHtml(getRevokeTenantAgentDisplayName(agent))}</div>
                            <div class="oc-platform-revoke-confirm__meta">${escapeHtml(agent.agentId || agent.id || "-")}</div>
                          </li>
                        `,
                      )
                      .join("")}
                  </ul>
                </section>
              `
              : ""
          }
          <form class="oc-platform-modal__form" data-platform-revoke-confirm-form>
            <div class="oc-platform-modal__actions">
              <button class="btn" type="button" data-platform-close-dialog="revoke-confirm">返回</button>
              <button class="btn primary" type="submit" ${dialog.busy ? "disabled" : ""}>确认撤回</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

function renderLocalLicenseDialog(controller) {
  if (!isLocalEdition(controller)) {
    return "";
  }
  const localLicense = controller.localLicense;
  return `
    <dialog class="oc-platform-modal oc-platform-modal--wide" data-platform-local-license-dialog>
      <div class="oc-platform-modal__panel oc-platform-modal__panel--wide">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">本地授权管理</h3>
          <button class="btn" type="button" data-platform-close-dialog="local-license">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          <div class="callout ${localLicense?.status === "active" ? "info" : "danger"}">
            <strong>${escapeHtml(localLicenseStatusLabel(localLicense))}</strong><br/>
            客户名称：${escapeHtml(localLicense?.customerName || "-")}<br/>
            到期时间：${escapeHtml(formatDateTime(localLicense?.expiresAt))}<br/>
            剩余天数：${escapeHtml(localLicense?.remainingDays ?? "-")}<br/>
            当前说明：${escapeHtml(localLicense?.reason || "-")}
          </div>
          <form class="oc-platform-modal__form" data-platform-license-import-form>
            <label class="field">
              <span>导入授权文件内容</span>
              <textarea name="licenseText" rows="8" placeholder="粘贴签名后的授权 JSON"></textarea>
            </label>
            <div class="oc-platform-modal__actions">
              <button class="btn primary" type="submit">导入授权</button>
            </div>
          </form>
          <form class="oc-platform-modal__form" data-platform-license-renew-form>
            <label class="field">
              <span>续期码</span>
              <input name="renewalCode" type="text" placeholder="输入续期码" />
            </label>
            <div class="oc-platform-modal__actions">
              <button class="btn primary" type="submit">应用续期码</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

function renderNodeDialog(controller) {
  if (!controller.dialogs.nodeOpen) {
    return "";
  }
  const dialog = controller.nodeDialog || createNodeDialogState();
  return `
    <dialog class="oc-platform-modal oc-platform-modal--wide" data-platform-node-dialog>
      <div class="oc-platform-modal__panel oc-platform-modal__panel--wide">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">${dialog.editing ? "编辑节点" : "创建节点"}</h3>
          <button class="btn" type="button" data-platform-close-dialog="node">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          <form class="oc-platform-modal__form" data-platform-node-form>
            <label class="field">
              <span>节点标识</span>
              <input name="id" type="text" value="${escapeHtml(dialog.id)}" ${dialog.editing ? "disabled" : ""} required />
            </label>
            <label class="field">
              <span>节点名称</span>
              <input name="name" type="text" value="${escapeHtml(dialog.name)}" required />
            </label>
            <label class="field">
              <span>共享密钥${dialog.editing ? "（留空则保持不变）" : ""}</span>
              <input name="sharedSecret" type="text" value="" ${dialog.editing ? "" : "required"} />
            </label>
            <label class="field">
              <span>节点状态</span>
              <select name="status">
                <option value="active" ${dialog.status === "active" ? "selected" : ""}>active</option>
                <option value="disabled" ${dialog.status === "disabled" ? "selected" : ""}>disabled</option>
              </select>
            </label>
            <label class="field">
              <span>授权状态</span>
              <select name="leaseStatus">
                <option value="active" ${dialog.leaseStatus === "active" ? "selected" : ""}>active</option>
                <option value="disabled" ${dialog.leaseStatus === "disabled" ? "selected" : ""}>disabled</option>
              </select>
            </label>
            <label class="field">
              <span>授权到期时间（可选）</span>
              <input name="leaseExpiresAt" type="datetime-local" value="${escapeHtml(dialog.leaseExpiresAt)}" />
            </label>
            <div class="oc-platform-modal__actions">
              <button class="btn" type="button" data-platform-close-dialog="node">取消</button>
              <button class="btn primary" type="submit">${dialog.editing ? "保存节点" : "创建节点"}</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

function renderBindNodeDialog(controller) {
  if (!controller.dialogs.bindNodeOpen) {
    return "";
  }
  const dialog = controller.bindNodeDialog || createBindNodeDialogState();
  const nodeOptions = Array.isArray(controller.nodes) ? controller.nodes : [];
  return `
    <dialog class="oc-platform-modal" data-platform-bind-node-dialog>
      <div class="oc-platform-modal__panel">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">节点绑定</h3>
          <button class="btn" type="button" data-platform-close-dialog="bind-node">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          <form class="oc-platform-modal__form" data-platform-bind-node-form>
            <input type="hidden" name="tenantId" value="${escapeHtml(dialog.tenantId)}" />
            <label class="field">
              <span>目标租户</span>
              <input type="text" value="${escapeHtml(dialog.tenantName || dialog.tenantId)}" disabled />
            </label>
            <label class="field">
              <span>受管节点</span>
              <select name="nodeId">
                <option value="">未绑定</option>
                ${nodeOptions
                  .map(
                    (node) => `
                      <option value="${escapeHtml(node.id)}" ${dialog.nodeId === node.id ? "selected" : ""}>
                        ${escapeHtml(node.name)} (${escapeHtml(node.id)})
                      </option>
                    `,
                  )
                  .join("")}
              </select>
            </label>
            <div class="oc-platform-modal__actions">
              <button class="btn" type="button" data-platform-close-dialog="bind-node">取消</button>
              <button class="btn primary" type="submit">保存绑定</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

function captureRenderFocusState(root) {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement) || !root.contains(active)) {
    return null;
  }
  if (active.hasAttribute("data-platform-search")) {
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
    const input = root.querySelector("[data-platform-search]");
    if (input instanceof HTMLInputElement) {
      input.focus();
      if (
        typeof state.selectionStart === "number" &&
        typeof state.selectionEnd === "number"
      ) {
        try {
          input.setSelectionRange(state.selectionStart, state.selectionEnd);
        } catch {
          // Ignore unsupported selection restoration.
        }
      }
    }
  }
}

function syncAssignTenantAgentSelectionState(root, controller) {
  const dialog = controller.assignTenantAgentDialog;
  if (controller.section !== "agent-allocation" || !dialog?.open) {
    return;
  }
  const selectAll = root.querySelector("[data-platform-assign-agent-select-all]");
  if (!(selectAll instanceof HTMLInputElement)) {
    return;
  }
  const selectableAgents = getAssignablePlatformCatalogAgents(dialog);
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

function syncRevokeTenantAgentSelectionState(root, controller) {
  const dialog = controller.revokeTenantAgentDialog;
  if (controller.section !== "agent-allocation" || !dialog?.open) {
    return;
  }
  const selectAll = root.querySelector("[data-platform-revoke-agent-select-all]");
  if (!(selectAll instanceof HTMLInputElement)) {
    return;
  }
  const selectableAgents = getRevokeTenantAgentSelectableAgents(dialog);
  const selectedAgents = selectableAgents.filter((agent) =>
    dialog.selectedTenantAgentIds.has(String(agent.id || "").trim()),
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

function render(root, controller) {
  const focusState = captureRenderFocusState(root);
  const isNodeSection = controller.section === "nodes";
  if (controller.section === "agent-allocation") {
    pruneAssignTenantAgentSelection(controller);
    pruneRevokeTenantAgentSelection(controller);
  }
  const filtered = isNodeSection ? filterNodes(controller) : filterTenants(controller);
  const pagination = paginate(filtered, getPageValue(controller));
  setPageValue(controller, pagination.page);
  const contentMarkup = isNodeSection
    ? renderNodeManagementTable(pagination.items)
    : controller.section === "agent-allocation"
      ? renderAgentAssignmentTable(controller, pagination.items)
      : renderTenantManagementTable(controller, pagination.items);

  root.setAttribute(BODY_SECTION_ATTR, controller.section);
  root.dataset.ocPlatformEmbedded = "true";
  root.innerHTML = `
    <section class="oc-platform-list-view">
      ${renderToolbar(controller)}
      <div class="data-table-wrapper">
        ${controller.section === "tenants" ? renderDataSourceOverview(controller) : ""}
        ${contentMarkup}
        ${renderPagination(controller, pagination)}
      </div>
    </section>
    ${renderCreateDialog(controller)}
    ${renderMemberLimitDialog(controller)}
    ${renderAssignDialog(controller)}
    ${renderRateDialog(controller)}
    ${renderRevokeTenantAgentDialog(controller)}
    ${renderRevokeTenantAgentConfirmDialog(controller)}
    ${renderLocalLicenseDialog(controller)}
    ${renderDataSourceDialog(controller)}
    ${renderNodeDialog(controller)}
    ${renderBindNodeDialog(controller)}
  `;

  if (controller.dialogs.createTenantOpen) {
    openDialog(root.querySelector("[data-platform-create-dialog]"));
  }
  if (controller.dialogs.memberLimitOpen) {
    openDialog(root.querySelector("[data-platform-member-limit-dialog]"));
  }
  if (controller.dialogs.assignOpen) {
    openDialog(root.querySelector("[data-platform-assign-dialog]"));
  }
  if (controller.dialogs.rateOpen) {
    openDialog(root.querySelector("[data-platform-rate-dialog]"));
  }
  if (controller.revokeTenantAgentDialog?.open) {
    openDialog(root.querySelector("[data-platform-revoke-tenant-agent-dialog]"));
  }
  if (controller.revokeTenantAgentDialog?.confirmOpen) {
    openDialog(root.querySelector("[data-platform-revoke-confirm-dialog]"));
  }
  if (controller.dialogs.localLicenseOpen) {
    openDialog(root.querySelector("[data-platform-local-license-dialog]"));
  }
  if (controller.dialogs.dataSourceOpen) {
    openDialog(root.querySelector("[data-platform-data-source-dialog]"));
  }
  if (controller.dialogs.nodeOpen) {
    openDialog(root.querySelector("[data-platform-node-dialog]"));
  }
  if (controller.dialogs.bindNodeOpen) {
    openDialog(root.querySelector("[data-platform-bind-node-dialog]"));
  }
  if (controller.section === "agent-allocation") {
    syncAssignTenantAgentSelectionState(root, controller);
    syncRevokeTenantAgentSelectionState(root, controller);
  }
  restoreRenderFocusState(root, focusState);
}

async function refresh(root, controller) {
  const includeNodes = !isLocalEdition(controller);
  const [tenants, catalogAgents, nodes, localLicense, dataSources, tenantDataSourceBindings, syncSchedules] = await Promise.all([
    controller.apiClient.listPlatformTenants(),
    controller.apiClient.listPlatformCatalogAgents(),
    includeNodes ? controller.apiClient.listPlatformNodes() : Promise.resolve([]),
    isLocalEdition(controller) ? controller.apiClient.getLocalLicense() : Promise.resolve(null),
    controller.apiClient.listPlatformDataSources(),
    controller.apiClient.listPlatformTenantDataSourceBindings(),
    controller.apiClient.listPlatformSyncSchedules(),
  ]);
  controller.tenants = tenants;
  controller.catalogAgents = catalogAgents;
  controller.nodes = Array.isArray(nodes) ? nodes : [];
  controller.localLicense = localLicense;
  controller.dataSources = Array.isArray(dataSources) ? dataSources : [];
  controller.tenantDataSourceBindings = Array.isArray(tenantDataSourceBindings)
    ? tenantDataSourceBindings
    : [];
  controller.syncSchedules = Array.isArray(syncSchedules) ? syncSchedules : [];
  if (controller.assignTenantAgentDialog?.open) {
    controller.assignTenantAgentDialog.agents = Array.isArray(catalogAgents)
      ? catalogAgents.slice()
      : [];
  }
  if (controller.bindNodeDialog?.tenantId) {
    const nextTenant = tenantById(controller, controller.bindNodeDialog.tenantId);
    if (nextTenant) {
      controller.bindNodeDialog.tenantName = nextTenant.name;
      controller.bindNodeDialog.nodeId = String(nextTenant.boundNodeId || "").trim();
    }
  }
  if (
    controller.activeTenant &&
    !tenants.some((tenant) => tenant.id === controller.activeTenant.id)
  ) {
    controller.activeTenant = null;
  }
  if (controller.activeNode && !controller.nodes.some((node) => node.id === controller.activeNode.id)) {
    controller.activeNode = null;
  }
  render(root, controller);
}

function tenantById(controller, tenantId) {
  return controller.tenants.find((tenant) => tenant.id === tenantId) ?? null;
}

function nodeById(controller, nodeId) {
  return controller.nodes.find((node) => node.id === nodeId) ?? null;
}

async function openAssignTenantAgentDialog(root, controller, tenantId) {
  const tenant = tenantById(controller, tenantId);
  if (!tenant) {
    return;
  }

  controller.activeTenant = tenant;
  const previousToken = Number(controller.assignTenantAgentDialog?.requestToken || 0);
  controller.assignTenantAgentDialog = {
    ...createAssignTenantAgentDialogState(),
    open: true,
    loading: true,
    tenantId: tenant.id,
    tenantName: tenant.name,
    agents: Array.isArray(controller.catalogAgents) ? controller.catalogAgents.slice() : [],
    requestToken: previousToken + 1,
  };
  controller.dialogs.assignOpen = true;
  render(root, controller);

  const requestToken = controller.assignTenantAgentDialog.requestToken;
  try {
    const assignments = await controller.apiClient.listPlatformTenantAgents(tenant.id);
    const currentDialog = controller.assignTenantAgentDialog;
    if (
      !currentDialog ||
      !currentDialog.open ||
      currentDialog.requestToken !== requestToken ||
      currentDialog.tenantId !== tenant.id
    ) {
      return;
    }
    const assignedAgentIds = new Set(
      (Array.isArray(assignments) ? assignments : [])
        .map((assignment) => String(assignment?.agentId || assignment?.baseAgentId || "").trim())
        .filter(Boolean),
    );
    currentDialog.assignedAgentIds = assignedAgentIds;
    currentDialog.agents = Array.isArray(controller.catalogAgents)
      ? controller.catalogAgents.slice()
      : [];
    currentDialog.loading = false;
    currentDialog.error = "";
    pruneAssignTenantAgentSelection(controller);
    render(root, controller);
  } catch (error) {
    const currentDialog = controller.assignTenantAgentDialog;
    if (
      !currentDialog ||
      !currentDialog.open ||
      currentDialog.requestToken !== requestToken ||
      currentDialog.tenantId !== tenant.id
    ) {
      return;
    }
    currentDialog.loading = false;
    currentDialog.error = error instanceof Error ? error.message : String(error);
    render(root, controller);
    setFeedback(root, currentDialog.error, true);
  }
}

async function openRateDialog(root, controller, tenantId) {
  controller.activeTenant = tenantById(controller, tenantId);
  controller.dialogs.rateOpen = true;
  controller.loadingRateAgents = true;
  controller.rateDialogAgents = [];
  render(root, controller);
  try {
    controller.rateDialogAgents = await controller.apiClient.listPlatformTenantAgents(tenantId);
    controller.loadingRateAgents = false;
    render(root, controller);
  } catch (error) {
    controller.loadingRateAgents = false;
    controller.dialogs.rateOpen = false;
    render(root, controller);
    setFeedback(root, error instanceof Error ? error.message : String(error), true);
  }
}

async function openRevokeTenantAgentDialog(root, controller, tenantId) {
  const tenant = tenantById(controller, tenantId);
  if (!tenant || !isTenantRevokeSelectionTarget(tenant)) {
    return;
  }

  controller.activeTenant = tenant;
  const previousToken = Number(controller.revokeTenantAgentDialog?.requestToken || 0);
  controller.revokeTenantAgentDialog = {
    ...createRevokeTenantAgentDialogState(),
    open: true,
    loading: true,
    tenantId: tenant.id,
    tenantName: tenant.name,
    requestToken: previousToken + 1,
  };
  render(root, controller);

  const requestToken = controller.revokeTenantAgentDialog.requestToken;
  try {
    const agents = await controller.apiClient.listPlatformTenantAgents(tenant.id);
    const currentDialog = controller.revokeTenantAgentDialog;
    if (
      !currentDialog ||
      !currentDialog.open ||
      currentDialog.requestToken !== requestToken ||
      currentDialog.tenantId !== tenant.id
    ) {
      return;
    }
    currentDialog.agents = Array.isArray(agents) ? agents : [];
    currentDialog.loading = false;
    currentDialog.error = "";
    pruneRevokeTenantAgentSelection(controller);
    render(root, controller);
  } catch (error) {
    const currentDialog = controller.revokeTenantAgentDialog;
    if (
      !currentDialog ||
      !currentDialog.open ||
      currentDialog.requestToken !== requestToken ||
      currentDialog.tenantId !== tenant.id
    ) {
      return;
    }
    currentDialog.loading = false;
    currentDialog.error = error instanceof Error ? error.message : String(error);
    render(root, controller);
    setFeedback(root, currentDialog.error, true);
  }
}

async function openRevokeTenantAgentConfirmDialog(root, controller) {
  const dialog = controller.revokeTenantAgentDialog;
  if (!dialog?.open || dialog.loading || dialog.busy) {
    return;
  }

  pruneRevokeTenantAgentSelection(controller);
  const selectedTenantAgentIds = Array.from(dialog.selectedTenantAgentIds);
  if (!selectedTenantAgentIds.length) {
    setFeedback(root, "请选择要撤回的 Agent。", true);
    return;
  }

  dialog.confirmOpen = true;
  dialog.confirmSelectedTenantAgentIds = selectedTenantAgentIds;
  dialog.error = "";
  render(root, controller);
}

async function revokeSelectedTenantAgents(root, controller) {
  const dialog = controller.revokeTenantAgentDialog;
  if (!dialog?.open || dialog.loading || dialog.busy || !dialog.confirmOpen) {
    return;
  }

  const dialogToken = Number(dialog.requestToken || 0);
  const selectedTenantAgentIds = Array.from(dialog.confirmSelectedTenantAgentIds || []);
  if (!selectedTenantAgentIds.length) {
    dialog.confirmOpen = false;
    dialog.confirmSelectedTenantAgentIds = [];
    render(root, controller);
    setFeedback(root, "请选择要撤回的 Agent。", true);
    return;
  }

  const tenantLabel = dialog.tenantName || dialog.tenantId || "该租户";
  dialog.busy = true;
  render(root, controller);
  try {
    const result = await controller.apiClient.revokePlatformTenantAgents({
      tenantId: dialog.tenantId,
      tenantAgentIds: selectedTenantAgentIds,
    });
    const revokedTenantAgentCount = Number(result?.revokedTenantAgentCount || 0);
    const revokedAssignmentCount = Number(result?.revokedAssignmentCount || 0);
    if (revokedTenantAgentCount > 0) {
      const currentDialog = controller.revokeTenantAgentDialog;
      if (
        currentDialog &&
        currentDialog.open &&
        currentDialog.requestToken === dialogToken &&
        currentDialog.tenantId === dialog.tenantId
      ) {
        controller.revokeTenantAgentDialog = null;
      }
      try {
        await refresh(root, controller);
      } catch (refreshError) {
        render(root, controller);
        setFeedback(
          root,
          refreshError instanceof Error
            ? `已撤回租户“${tenantLabel}”的 ${formatNumber(revokedTenantAgentCount)} 个 Agent，但列表刷新失败：${refreshError.message}`
            : `已撤回租户“${tenantLabel}”的 ${formatNumber(revokedTenantAgentCount)} 个 Agent，但列表刷新失败。`,
          true,
        );
        return;
      }
      const successMessage =
        revokedAssignmentCount > 0
          ? `已撤回租户“${tenantLabel}”的 ${formatNumber(revokedTenantAgentCount)} 个 Agent，并同步失效 ${formatNumber(revokedAssignmentCount)} 条成员分配。`
          : `已撤回租户“${tenantLabel}”的 ${formatNumber(revokedTenantAgentCount)} 个 Agent。`;
      setFeedback(root, successMessage);
      return;
    }
    const currentDialog = controller.revokeTenantAgentDialog;
    if (
      currentDialog &&
      currentDialog.open &&
      currentDialog.requestToken === dialogToken &&
      currentDialog.tenantId === dialog.tenantId
    ) {
      currentDialog.busy = false;
      currentDialog.confirmOpen = false;
      currentDialog.confirmSelectedTenantAgentIds = [];
      currentDialog.loading = false;
      currentDialog.error = "未找到可撤回的 Agent。";
      render(root, controller);
      setFeedback(root, currentDialog.error, true);
      return;
    }
    render(root, controller);
    setFeedback(root, "未找到可撤回的 Agent。", true);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const currentDialog = controller.revokeTenantAgentDialog;
    if (
      currentDialog &&
      currentDialog.open &&
      currentDialog.requestToken === dialogToken &&
      currentDialog.tenantId === dialog.tenantId
    ) {
      currentDialog.busy = false;
      currentDialog.confirmOpen = false;
      currentDialog.confirmSelectedTenantAgentIds = [];
      currentDialog.loading = false;
      currentDialog.error = errorMessage;
    }
    render(root, controller);
    setFeedback(root, errorMessage, true);
  }
}

function openCreateNodeDialog(root, controller) {
  controller.activeNode = null;
  controller.dialogs.nodeOpen = true;
  controller.nodeDialog = createNodeDialogState();
  render(root, controller);
}

function openEditNodeDialog(root, controller, nodeId) {
  const node = nodeById(controller, nodeId);
  if (!node) {
    setFeedback(root, "未找到节点信息。", true);
    return;
  }
  controller.activeNode = node;
  controller.dialogs.nodeOpen = true;
  controller.nodeDialog = {
    id: node.id,
    name: node.name,
    sharedSecret: "",
    status: node.status || "active",
    leaseStatus: node.leaseStatus || "active",
    leaseExpiresAt: formatDateTimeInputValue(node.leaseExpiresAt),
    error: "",
    editing: true,
  };
  render(root, controller);
}

function openBindNodeDialog(root, controller, tenantId) {
  const tenant = tenantById(controller, tenantId);
  if (!tenant) {
    setFeedback(root, "未找到租户信息。", true);
    return;
  }
  controller.activeTenant = tenant;
  controller.dialogs.bindNodeOpen = true;
  controller.bindNodeDialog = {
    tenantId: tenant.id,
    tenantName: tenant.name,
    nodeId: String(tenant.boundNodeId || "").trim(),
    error: "",
  };
  render(root, controller);
}

function updateSectionLinkState(section) {
  const sectionByHref = new Map([
    [currentSectionHref("tenants"), "tenants"],
    [currentSectionHref("agent-allocation"), "agent-allocation"],
    [currentSectionHref("nodes"), "nodes"],
  ]);
  for (const [href, targetSection] of sectionByHref.entries()) {
    const links = document.querySelectorAll(`a[href="${href}"]`);
    for (const link of links) {
      link.classList.toggle("active", targetSection === section);
    }
  }
}

async function handleClick(root, controller, event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const paginationButton = target.closest("[data-platform-page]");
  if (paginationButton instanceof HTMLElement) {
    const action = paginationButton.dataset.platformPage;
    const currentPage = getPageValue(controller);
    setPageValue(controller, action === "next" ? currentPage + 1 : currentPage - 1);
    render(root, controller);
    return;
  }

  if (target.closest("[data-platform-open-create]")) {
    controller.dialogs.createTenantOpen = true;
    render(root, controller);
    return;
  }

  if (target.closest("[data-platform-open-data-source]")) {
    controller.dialogs.dataSourceOpen = true;
    controller.dataSourceDialog = createDataSourceDialogState();
    render(root, controller);
    return;
  }

  const editDataSourceTrigger = target.closest("[data-platform-edit-data-source]");
  if (editDataSourceTrigger instanceof HTMLElement) {
    const dataSourceId = editDataSourceTrigger.dataset.platformEditDataSource || "";
    const current = (Array.isArray(controller.dataSources) ? controller.dataSources : []).find(
      (item) => item.id === dataSourceId,
    );
    if (!current) {
      setFeedback(root, "未找到数据源。", true);
      return;
    }
    controller.dialogs.dataSourceOpen = true;
    controller.dataSourceDialog = {
      id: current.id,
      name: current.name || "",
      status: current.status || "active",
      connectionJson: current.connectionJson ? JSON.stringify(current.connectionJson, null, 2) : "",
      k3cloudProfileJson: current.k3cloudProfileJson
        ? JSON.stringify(current.k3cloudProfileJson, null, 2)
        : "",
      editing: true,
      error: "",
    };
    render(root, controller);
    return;
  }

  const closeDialogTrigger = target.closest("[data-platform-close-dialog]");
  if (closeDialogTrigger instanceof HTMLElement) {
    const dialogKind = closeDialogTrigger.dataset.platformCloseDialog || "";
    if (dialogKind === "create") {
      controller.dialogs.createTenantOpen = false;
      closeDialog(root.querySelector("[data-platform-create-dialog]"));
    }
    if (dialogKind === "member-limit") {
      controller.dialogs.memberLimitOpen = false;
      closeDialog(root.querySelector("[data-platform-member-limit-dialog]"));
    }
    if (dialogKind === "assign") {
      controller.dialogs.assignOpen = false;
      controller.assignTenantAgentDialog = createAssignTenantAgentDialogState();
      closeDialog(root.querySelector("[data-platform-assign-dialog]"));
    }
    if (dialogKind === "rate") {
      controller.dialogs.rateOpen = false;
      controller.rateDialogAgents = [];
      closeDialog(root.querySelector("[data-platform-rate-dialog]"));
    }
    if (dialogKind === "revoke") {
      controller.revokeTenantAgentDialog = createRevokeTenantAgentDialogState();
      closeDialog(root.querySelector("[data-platform-revoke-tenant-agent-dialog]"));
    }
    if (dialogKind === "revoke-confirm") {
      const dialog = getRevokeTenantAgentDialog(controller);
      dialog.confirmOpen = false;
      dialog.confirmSelectedTenantAgentIds = [];
      closeDialog(root.querySelector("[data-platform-revoke-confirm-dialog]"));
    }
    if (dialogKind === "local-license") {
      controller.dialogs.localLicenseOpen = false;
      closeDialog(root.querySelector("[data-platform-local-license-dialog]"));
    }
    if (dialogKind === "data-source") {
      controller.dialogs.dataSourceOpen = false;
      controller.dataSourceDialog = createDataSourceDialogState();
      closeDialog(root.querySelector("[data-platform-data-source-dialog]"));
    }
    if (dialogKind === "node") {
      controller.dialogs.nodeOpen = false;
      controller.activeNode = null;
      controller.nodeDialog = createNodeDialogState();
      closeDialog(root.querySelector("[data-platform-node-dialog]"));
    }
    if (dialogKind === "bind-node") {
      controller.dialogs.bindNodeOpen = false;
      controller.bindNodeDialog = createBindNodeDialogState();
      closeDialog(root.querySelector("[data-platform-bind-node-dialog]"));
    }
    render(root, controller);
    return;
  }

  if (target.closest("[data-platform-open-node]")) {
    openCreateNodeDialog(root, controller);
    return;
  }

  const editNodeTrigger = target.closest("[data-platform-open-edit-node]");
  if (editNodeTrigger instanceof HTMLElement) {
    openEditNodeDialog(root, controller, editNodeTrigger.dataset.platformOpenEditNode || "");
    return;
  }

  const bindNodeTrigger = target.closest("[data-platform-open-bind-node]");
  if (bindNodeTrigger instanceof HTMLElement) {
    openBindNodeDialog(root, controller, bindNodeTrigger.dataset.platformOpenBindNode || "");
    return;
  }

  if (target.closest("[data-platform-open-local-license]")) {
    controller.dialogs.localLicenseOpen = true;
    render(root, controller);
    return;
  }

  const memberLimitTrigger = target.closest("[data-platform-open-member-limit]");
  if (memberLimitTrigger instanceof HTMLElement) {
    controller.activeTenant = tenantById(
      controller,
      memberLimitTrigger.dataset.platformOpenMemberLimit,
    );
    controller.dialogs.memberLimitOpen = true;
    render(root, controller);
    return;
  }

  const bindDataSourceTrigger = target.closest("[data-platform-bind-data-source]");
  if (bindDataSourceTrigger instanceof HTMLElement) {
    const tenantId = bindDataSourceTrigger.dataset.platformBindDataSource || "";
    const tenant = tenantById(controller, tenantId);
    if (!tenant) {
      setFeedback(root, "未找到租户信息。", true);
      return;
    }
    const dataSources = Array.isArray(controller.dataSources) ? controller.dataSources : [];
    if (!dataSources.length) {
      setFeedback(root, "请先创建数据源。", true);
      return;
    }
    const binding = bindingByTenantId(controller, tenantId);
    const options = dataSources.map((item) => `${item.id}:${item.name}`).join("\n");
    const nextValue = window.prompt(
      `为租户“${tenant.name}”绑定数据源。\n输入数据源ID，留空不变。\n可选项：\n${options}`,
      binding?.dataSourceId || "",
    );
    if (nextValue === null) {
      return;
    }
    const dataSourceId = String(nextValue || "").trim();
    if (!dataSourceId) {
      setFeedback(root, "已取消。", true);
      return;
    }
    try {
      await controller.apiClient.bindPlatformTenantDataSource({ tenantId, dataSourceId });
      await refresh(root, controller);
      setFeedback(root, `租户“${tenant.name}”的数据源绑定已更新。`);
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
    return;
  }

  const assignTrigger = target.closest("[data-platform-open-assign]");
  if (assignTrigger instanceof HTMLElement) {
    await openAssignTenantAgentDialog(
      root,
      controller,
      assignTrigger.dataset.platformOpenAssign || "",
    );
    return;
  }

  const revokeTrigger = target.closest("[data-platform-open-revoke]");
  if (revokeTrigger instanceof HTMLElement) {
    await openRevokeTenantAgentDialog(
      root,
      controller,
      revokeTrigger.dataset.platformOpenRevoke || "",
    );
    return;
  }

  const rateTrigger = target.closest("[data-platform-open-rate]");
  if (rateTrigger instanceof HTMLElement) {
    await openRateDialog(root, controller, rateTrigger.dataset.platformOpenRate || "");
  }
}

function handleInput(root, controller, event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.hasAttribute("data-platform-assign-agent-select-all")) {
    const dialog = getAssignTenantAgentDialog(controller);
    const selected = target.checked;
    clearAssignTenantAgentSelection(controller);
    if (selected) {
      for (const agent of getAssignablePlatformCatalogAgents(dialog)) {
        setAssignTenantAgentSelected(controller, agent.id, true);
      }
    }
    render(root, controller);
    return;
  }
  if (target.hasAttribute("data-platform-assign-agent-select")) {
    setAssignTenantAgentSelected(
      controller,
      target.dataset.platformAssignAgentSelect,
      target.checked,
    );
    render(root, controller);
    return;
  }
  if (target.hasAttribute("data-platform-assign-description")) {
    getAssignTenantAgentDialog(controller).description = target.value;
    return;
  }
  if (target.hasAttribute("data-platform-assign-rate-multiplier")) {
    getAssignTenantAgentDialog(controller).rateMultiplier = target.value;
    return;
  }
  if (target.hasAttribute("data-platform-assign-balance-points")) {
    getAssignTenantAgentDialog(controller).balancePoints = target.value;
    return;
  }
  if (target.hasAttribute("data-platform-revoke-agent-select-all")) {
    const dialog = getRevokeTenantAgentDialog(controller);
    const selected = target.checked;
    clearRevokeTenantAgentSelection(controller);
    if (selected) {
      for (const agent of getRevokeTenantAgentSelectableAgents(dialog)) {
        setRevokeTenantAgentSelected(controller, agent.id, true);
      }
    }
    render(root, controller);
    return;
  }
  if (target.hasAttribute("data-platform-revoke-agent-select")) {
    setRevokeTenantAgentSelected(
      controller,
      target.dataset.platformRevokeAgentSelect,
      target.checked,
    );
    render(root, controller);
    return;
  }
  if (target.hasAttribute("data-platform-search")) {
    controller.searchBySection[controller.section] = target.value;
    setPageValue(controller, 1);
    render(root, controller);
  }
}

async function handleSubmit(root, controller, event) {
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) {
    return;
  }

  if (target.matches("[data-platform-tenant-form]")) {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(target).entries());
      await controller.apiClient.createTenant(payload);
      controller.dialogs.createTenantOpen = false;
      await refresh(root, controller);
      closeDialog(root.querySelector("[data-platform-create-dialog]"));
      setFeedback(root, "租户已创建。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
    return;
  }

  if (target.matches("[data-platform-data-source-form]")) {
    event.preventDefault();
    try {
      const formData = new FormData(target);
      const payload = {
        id: String(formData.get("id") || "").trim() || undefined,
        name: String(formData.get("name") || "").trim(),
        status: String(formData.get("status") || "active").trim(),
        connectionJson: String(formData.get("connectionJson") || "").trim()
          ? JSON.parse(String(formData.get("connectionJson") || "").trim())
          : null,
        k3cloudProfileJson: String(formData.get("k3cloudProfileJson") || "").trim()
          ? JSON.parse(String(formData.get("k3cloudProfileJson") || "").trim())
          : null,
      };
      await controller.apiClient.savePlatformDataSource(payload);
      controller.dialogs.dataSourceOpen = false;
      controller.dataSourceDialog = createDataSourceDialogState();
      await refresh(root, controller);
      closeDialog(root.querySelector("[data-platform-data-source-dialog]"));
      setFeedback(root, payload.id ? "数据源已更新。" : "数据源已创建。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
    return;
  }

  if (target.matches("[data-platform-member-limit-form]")) {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(target).entries());
      controller.activeTenant = await controller.apiClient.updateTenantMemberLimit(payload);
      controller.dialogs.memberLimitOpen = false;
      await refresh(root, controller);
      closeDialog(root.querySelector("[data-platform-member-limit-dialog]"));
      setFeedback(root, "人数上限已更新。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
    return;
  }

  if (target.matches("[data-platform-agent-form]")) {
    event.preventDefault();
    const dialog = getAssignTenantAgentDialog(controller);
    if (!dialog.open || dialog.loading || dialog.busy) {
      return;
    }
    pruneAssignTenantAgentSelection(controller);
    const selectedAgentIds = Array.from(dialog.selectedAgentIds);
    if (!selectedAgentIds.length) {
      dialog.error = "请选择要分配的 Agent。";
      render(root, controller);
      setFeedback(root, dialog.error, true);
      return;
    }
    const formData = new FormData(target);
    const tenantId = String(formData.get("tenantId") || dialog.tenantId || "").trim();
    if (!tenantId) {
      dialog.error = "tenant_id_required";
      render(root, controller);
      setFeedback(root, dialog.error, true);
      return;
    }
    dialog.description = String(formData.get("description") || "");
    if (!isLocalEdition(controller)) {
      dialog.rateMultiplier = String(formData.get("rateMultiplier") || dialog.rateMultiplier || "1");
      dialog.balancePoints = String(formData.get("balancePoints") || dialog.balancePoints || "0");
    }
    const tenantLabel = dialog.tenantName || dialog.tenantId || "该租户";
    const dialogToken = Number(dialog.requestToken || 0);
    dialog.busy = true;
    dialog.error = "";
    render(root, controller);
    try {
      const sharedPayload = {
        tenantId,
        description: dialog.description,
        rateMultiplier: isLocalEdition(controller) ? 1 : dialog.rateMultiplier,
        balancePoints: isLocalEdition(controller) ? 0 : dialog.balancePoints,
      };
      let assignedAgentCount = 0;
      for (const agentId of selectedAgentIds) {
        await controller.apiClient.upsertPlatformTenantAgent({
          ...sharedPayload,
          agentId,
        });
        assignedAgentCount += 1;
      }
      if (assignedAgentCount > 0) {
        const currentDialog = controller.assignTenantAgentDialog;
        if (
          currentDialog &&
          currentDialog.open &&
          currentDialog.requestToken === dialogToken &&
          currentDialog.tenantId === dialog.tenantId
        ) {
          controller.assignTenantAgentDialog = null;
          controller.dialogs.assignOpen = false;
        }
        try {
          await refresh(root, controller);
        } catch (refreshError) {
          render(root, controller);
          setFeedback(
            root,
            refreshError instanceof Error
              ? `已向租户“${tenantLabel}”下发 ${formatNumber(assignedAgentCount)} 个 Agent，但列表刷新失败：${refreshError.message}`
              : `已向租户“${tenantLabel}”下发 ${formatNumber(assignedAgentCount)} 个 Agent，但列表刷新失败。`,
            true,
          );
          return;
        }
        setFeedback(root, `已向租户“${tenantLabel}”下发 ${formatNumber(assignedAgentCount)} 个 Agent。`);
        return;
      }
      const currentDialog = controller.assignTenantAgentDialog;
      if (
        currentDialog &&
        currentDialog.open &&
        currentDialog.requestToken === dialogToken &&
        currentDialog.tenantId === dialog.tenantId
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
      const currentDialog = controller.assignTenantAgentDialog;
      if (
        currentDialog &&
        currentDialog.open &&
        currentDialog.requestToken === dialogToken &&
        currentDialog.tenantId === dialog.tenantId
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

  if (target.matches("[data-platform-rate-form]")) {
    event.preventDefault();
    try {
      const formData = new FormData(target);
      const tenantId = String(formData.get("tenantId") || "").trim();
      const tenant = controller.activeTenant;
      if (!tenantId || !tenant) {
        throw new Error("tenant_id_required");
      }

      for (const agent of controller.rateDialogAgents) {
        const rateMultiplier = formData.get(`rateMultiplier:${agent.id}`);
        await controller.apiClient.upsertPlatformTenantAgent({
          tenantId,
          agentId: agent.agentId,
          description: agent.description || "",
          rateMultiplier,
          balancePoints: agent.balancePoints ?? 0,
        });
      }

      controller.dialogs.rateOpen = false;
      controller.rateDialogAgents = [];
      await refresh(root, controller);
      closeDialog(root.querySelector("[data-platform-rate-dialog]"));
      setFeedback(root, "Agent 倍率已更新。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
    return;
  }

  if (target.matches("[data-platform-revoke-tenant-agent-form]")) {
    event.preventDefault();
    await openRevokeTenantAgentConfirmDialog(root, controller);
    return;
  }

  if (target.matches("[data-platform-revoke-confirm-form]")) {
    event.preventDefault();
    await revokeSelectedTenantAgents(root, controller);
    return;
  }

  if (target.matches("[data-platform-license-import-form]")) {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(target).entries());
      controller.localLicense = await controller.apiClient.importLocalLicense(payload);
      controller.dialogs.localLicenseOpen = false;
      await refresh(root, controller);
      closeDialog(root.querySelector("[data-platform-local-license-dialog]"));
      setFeedback(root, "本地授权已更新。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
    return;
  }

  if (target.matches("[data-platform-license-renew-form]")) {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(target).entries());
      controller.localLicense = await controller.apiClient.renewLocalLicense(payload);
      controller.dialogs.localLicenseOpen = false;
      await refresh(root, controller);
      closeDialog(root.querySelector("[data-platform-local-license-dialog]"));
      setFeedback(root, "续期码已生效。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
    return;
  }

  if (target.matches("[data-platform-node-form]")) {
    event.preventDefault();
    try {
      const formData = new FormData(target);
      const dialog = controller.nodeDialog || createNodeDialogState();
      const payload = {
        id: dialog.editing ? dialog.id : String(formData.get("id") || "").trim(),
        name: String(formData.get("name") || "").trim(),
        sharedSecret: String(formData.get("sharedSecret") || "").trim(),
        status: String(formData.get("status") || "active").trim(),
        leaseStatus: String(formData.get("leaseStatus") || "active").trim(),
        leaseExpiresAt: String(formData.get("leaseExpiresAt") || "").trim(),
        readonlyAfterExpiry: 1,
      };
      controller.activeNode = await controller.apiClient.savePlatformNode(payload);
      controller.dialogs.nodeOpen = false;
      controller.nodeDialog = createNodeDialogState();
      await refresh(root, controller);
      closeDialog(root.querySelector("[data-platform-node-dialog]"));
      setFeedback(root, dialog.editing ? "节点已更新。" : "节点已创建。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
    return;
  }

  if (target.matches("[data-platform-bind-node-form]")) {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(target).entries());
      controller.activeTenant = await controller.apiClient.bindPlatformTenantNode(payload);
      controller.dialogs.bindNodeOpen = false;
      controller.bindNodeDialog = createBindNodeDialogState();
      await refresh(root, controller);
      closeDialog(root.querySelector("[data-platform-bind-node-dialog]"));
      setFeedback(root, "节点绑定已更新。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
  }
}

export async function mountPlatformConsolePage(root, options = {}) {
  if (!(root instanceof HTMLElement)) {
    return null;
  }

  const session = requireTenantSession(["platform_admin"], { loginHref: PLATFORM_LOGIN_ROUTE });
  if (!session) {
    return null;
  }

  const apiClient = createTenantApiClient();
  const controller = ensureController(root, session, apiClient);
  const previousSection = controller.section;
  controller.section = options.section || "tenants";
  if (previousSection !== controller.section || controller.section !== "agent-allocation") {
    clearAssignTenantAgentSelection(controller);
    clearRevokeTenantAgentSelection(controller);
  }
  if (controller.section !== "agent-allocation") {
    controller.dialogs.assignOpen = false;
    controller.dialogs.rateOpen = false;
    controller.rateDialogAgents = [];
    controller.loadingRateAgents = false;
    controller.assignTenantAgentDialog = createAssignTenantAgentDialogState();
    controller.revokeTenantAgentDialog = createRevokeTenantAgentDialogState();
  }
  if (controller.section !== "nodes") {
    controller.dialogs.nodeOpen = false;
    controller.activeNode = null;
    controller.nodeDialog = createNodeDialogState();
  }
  if (controller.section !== "tenants") {
    controller.dialogs.bindNodeOpen = false;
    controller.bindNodeDialog = createBindNodeDialogState();
  }
  updateSectionLinkState(controller.section);

  await refresh(root, controller);
  return { root };
}

export async function bootPlatformTenantConsolePage() {
  const root = document.querySelector(PAGE_SELECTOR);
  if (!(root instanceof HTMLElement)) {
    return null;
  }
  return mountPlatformConsolePage(root, { embedded: false, section: "tenants" });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootPlatformTenantConsolePage();
  });
} else {
  void bootPlatformTenantConsolePage();
}
