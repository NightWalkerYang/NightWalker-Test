import { createTenantApiClient } from "./api-client.js";
import { showTransientFeedbackToast } from "./feedback-toast.js";
import {
  PLATFORM_AGENT_ASSIGNMENT_VIEW,
  PLATFORM_DATA_SOURCES_VIEW,
  PLATFORM_LOGIN_ROUTE,
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
  if (section === "data-sources") {
    return `./?ocTenantView=${PLATFORM_DATA_SOURCES_VIEW}`;
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

function readDataSourceConnection(source) {
  const raw = source?.connection ?? source?.connectionJson ?? source?.connection_json ?? null;
  if (!raw) {
    return {};
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? raw : {};
}

function createDataSourceDraft(source = null, boundTenantId = "") {
  const connection = readDataSourceConnection(source);
  return {
    id: String(source?.id || "").trim(),
    code: String(source?.code || "").trim(),
    name: String(source?.name || "").trim(),
    sourceType: "kingdee_analytics",
    status: String(source?.status || "").trim() || "active",
    sourceDbid: String(source?.sourceDbid ?? source?.source_dbid ?? "").trim(),
    sourceTenantCode: String(
      source?.sourceTenantCode ?? source?.source_tenant_code ?? "",
    ).trim(),
    connectionHost: String(connection?.host || "").trim(),
    connectionPort:
      connection?.port === null || connection?.port === undefined
        ? "5432"
        : String(connection.port).trim(),
    connectionDatabase: String(connection?.database || "").trim(),
    connectionUser: String(connection?.user || "").trim(),
    connectionPassword:
      typeof connection?.password === "string"
        ? connection.password
        : connection?.password === null || connection?.password === undefined
          ? ""
          : String(connection.password),
    connectionPasswordStored: Boolean(source?.connectionPasswordStored),
    boundTenantId: String(boundTenantId || "").trim(),
  };
}

function createDataSourceCatalogDialogState() {
  return {
    open: false,
    loading: false,
    busy: false,
    error: "",
    requestToken: 0,
    dataSources: [],
    draft: createDataSourceDraft(),
  };
}

function createTenantDataSourceBindingDialogState() {
  return {
    open: false,
    loading: false,
    busy: false,
    error: "",
    requestToken: 0,
    tenantId: "",
    tenantName: "",
    currentBinding: null,
    dataSources: [],
    selectedDataSourceId: "",
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

function getDataSourceCatalogDialog(controller) {
  if (
    !(
      controller?.dataSourceCatalogDialog &&
      typeof controller.dataSourceCatalogDialog === "object"
    )
  ) {
    controller.dataSourceCatalogDialog = createDataSourceCatalogDialogState();
  }
  return controller.dataSourceCatalogDialog;
}

function getTenantDataSourceBindingDialog(controller) {
  if (
    !(
      controller?.tenantDataSourceBindingDialog &&
      typeof controller.tenantDataSourceBindingDialog === "object"
    )
  ) {
    controller.tenantDataSourceBindingDialog = createTenantDataSourceBindingDialogState();
  }
  return controller.tenantDataSourceBindingDialog;
}

function getActiveDataSources(dataSources) {
  if (!Array.isArray(dataSources)) {
    return [];
  }
  return dataSources.filter((source) => {
    const sourceId = String(source?.id || "").trim();
    return Boolean(sourceId) && String(source?.status || "active").trim() === "active";
  });
}

function getDataSourceDisplayName(source) {
  for (const candidate of [source?.name, source?.code, source?.id]) {
    const value = String(candidate || "").trim();
    if (value) {
      return value;
    }
  }
  return "未命名数据源";
}

function getTenantDisplayName(tenant) {
  for (const candidate of [tenant?.name, tenant?.code, tenant?.id]) {
    const value = String(candidate || "").trim();
    if (value) {
      return value;
    }
  }
  return "未绑定";
}

function tenantByDataSourceId(controller, dataSourceId) {
  const normalizedDataSourceId = String(dataSourceId || "").trim();
  if (!normalizedDataSourceId || !Array.isArray(controller?.tenants)) {
    return null;
  }
  return (
    controller.tenants.find(
      (tenant) => String(tenant?.dataSourceId || "").trim() === normalizedDataSourceId,
    ) ?? null
  );
}

function listUnboundTenants(controller) {
  if (!Array.isArray(controller?.tenants)) {
    return [];
  }
  return controller.tenants.filter((tenant) => !String(tenant?.dataSourceId || "").trim());
}

function resolveDefaultBoundTenantId(controller, dataSourceId = "") {
  const boundTenant = tenantByDataSourceId(controller, dataSourceId);
  if (boundTenant?.id) {
    return String(boundTenant.id || "").trim();
  }
  return String(listUnboundTenants(controller)[0]?.id || "").trim();
}

function syncDataSourceDraftTenant(controller) {
  const dialog = getDataSourceCatalogDialog(controller);
  const currentDraft = dialog.draft || createDataSourceDraft();
  const boundTenantId = resolveDefaultBoundTenantId(controller, currentDraft.id);
  const selectedTenantId = String(currentDraft.boundTenantId || "").trim();
  if (boundTenantId) {
    dialog.draft = {
      ...currentDraft,
      boundTenantId,
    };
    return;
  }
  if (
    selectedTenantId &&
    controller.tenants.some(
      (tenant) =>
        String(tenant?.id || "").trim() === selectedTenantId &&
        !String(tenant?.dataSourceId || "").trim(),
    )
  ) {
    return;
  }
  dialog.draft = {
    ...currentDraft,
    boundTenantId: "",
  };
}

function listSelectableTenantsForDraft(controller, draft) {
  const boundTenant = draft?.id ? tenantByDataSourceId(controller, draft.id) : null;
  if (boundTenant) {
    return [boundTenant];
  }
  return listUnboundTenants(controller);
}

function describePlatformDataSourceError(errorMessage) {
  switch (String(errorMessage || "").trim()) {
    case "data_source_already_bound":
      return "该数据源已经绑定到其他平台租户。";
    case "tenant_data_source_rebind_locked":
      return "已绑定的数据源归属不能在这里改动，请继续使用租户管理里的“绑定数据源”。";
    default:
      return String(errorMessage || "").trim();
  }
}

function getBindingSourceSummary(binding) {
  if (!binding || typeof binding !== "object") {
    return "未绑定";
  }
  const parts = [];
  if (binding.sourceDbid) {
    parts.push(`账套 ID：${String(binding.sourceDbid)}`);
  }
  if (binding.sourceTenantCode) {
    parts.push(`租户编码：${String(binding.sourceTenantCode)}`);
  }
  if (binding.dataSourceType) {
    parts.push(`类型：${String(binding.dataSourceType)}`);
  }
  return parts.length ? parts.join(" · ") : "已绑定，但暂无补充信息";
}

function buildDataSourcePayloadFromDraft(draft) {
  const port = Number.parseInt(String(draft.connectionPort || "").trim(), 10);
  const connection = {
    host: String(draft.connectionHost || "").trim(),
    database: String(draft.connectionDatabase || "").trim(),
  };
  const user = String(draft.connectionUser || "").trim();
  if (Number.isFinite(port) && port > 0) {
    connection.port = port;
  }
  if (user) {
    connection.user = user;
  }
  if (typeof draft.connectionPassword === "string" && draft.connectionPassword !== "") {
    connection.password = draft.connectionPassword;
  }
  return {
    id: String(draft.id || "").trim() || undefined,
    code: String(draft.code || "").trim(),
    name: String(draft.name || "").trim(),
    sourceType: "kingdee_analytics",
    status: String(draft.status || "").trim() || "active",
    sourceDbid: String(draft.sourceDbid || "").trim() || null,
    sourceTenantCode: String(draft.sourceTenantCode || "").trim() || null,
    connection,
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
      "data-sources": "",
    },
    pageBySection: {
      tenants: 1,
      "agent-allocation": 1,
      "data-sources": 1,
    },
    tenants: [],
    catalogAgents: [],
    rateDialogAgents: [],
    dialogs: {
      createTenantOpen: false,
      memberLimitOpen: false,
      assignOpen: false,
      rateOpen: false,
      localLicenseOpen: false,
    },
    activeTenant: null,
    dataSourceCatalogDialog: createDataSourceCatalogDialogState(),
    assignTenantAgentDialog: createAssignTenantAgentDialogState(),
    loadingRateAgents: false,
    localLicense: null,
    revokeTenantAgentDialog: createRevokeTenantAgentDialogState(),
    tenantDataSourceBindingDialog: createTenantDataSourceBindingDialogState(),
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
    if (event.target.matches("[data-platform-data-source-dialog]")) {
      controller.dataSourceCatalogDialog = createDataSourceCatalogDialogState();
    }
    if (event.target.matches("[data-platform-binding-dialog]")) {
      controller.tenantDataSourceBindingDialog = createTenantDataSourceBindingDialogState();
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
    [tenant.name, tenant.code, deploymentModeLabel(tenant.deploymentMode), tenant.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
}

function filterDataSources(controller) {
  const query = getSearchValue(controller).trim().toLowerCase();
  const dialog = getDataSourceCatalogDialog(controller);
  if (!query) {
    return dialog.dataSources;
  }
  return dialog.dataSources.filter((source) => {
    const boundTenant = tenantByDataSourceId(controller, source?.id);
    return [
      source?.name,
      source?.code,
      source?.status,
      source?.sourceType,
      source?.sourceDbid,
      source?.sourceTenantCode,
      boundTenant?.name,
      boundTenant?.code,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
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
  const isDataSourceSection = controller.section === "data-sources";
  const localEdition = isLocalEdition(controller);
  const placeholder = isDataSourceSection ? "搜索数据源名称、编码或归属租户" : "搜索租户名称或编码";
  return `
    <div class="data-table-toolbar oc-platform-table-toolbar">
      <label class="data-table-search">
        <input
          type="search"
          placeholder="${placeholder}"
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
        isDataSourceSection
          ? `<button class="btn primary" type="button" data-platform-open-data-source-create>创建数据源</button>`
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
      <table class="data-table oc-platform-tenant-table">
        <thead>
          <tr>
            <th>租户名称</th>
            <th>租户编码</th>
            <th>状态</th>
            <th>成员数</th>
            <th>人数上限</th>
            <th>数据源</th>
            ${localEdition ? "" : "<th>部署模式</th><th>钱包积分</th><th>到期日期</th>"}
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
                        <td><span class="data-table-badge data-table-badge--${tenant.status === "active" ? "direct" : "unknown"}">${escapeHtml(tenant.status)}</span></td>
                        <td>${formatNumber(tenant.memberCount)}</td>
                        <td>${formatNumber(tenant.memberLimit)}</td>
                        <td>${escapeHtml(tenant.dataSourceName || "未绑定")}</td>
                        ${
                          localEdition
                            ? ""
                            : `
                              <td>${escapeHtml(deploymentModeLabel(tenant.deploymentMode))}</td>
                              <td>${formatNumber(tenant.walletBalance)}</td>
                              <td>${escapeHtml(formatDateTime(tenant.licenseExpiresAt))}</td>
                            `
                        }
                        <td>
                          <div class="oc-platform-table-actions">
                            <button class="btn" type="button" data-platform-open-member-limit="${escapeHtml(tenant.id)}">人数调整</button>
                            <button class="btn" type="button" data-platform-open-data-source-binding="${escapeHtml(tenant.id)}">绑定数据源</button>
                          </div>
                        </td>
                      </tr>
                    `,
                  )
                  .join("")
              : `<tr><td colspan="${localEdition ? 7 : 10}" class="oc-platform-table-empty">暂无租户数据</td></tr>`
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
      <table class="data-table oc-platform-agent-table">
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

function renderDataSourceManagementTable(controller, rows) {
  const dialog = getDataSourceCatalogDialog(controller);
  const activeCount = getActiveDataSources(dialog.dataSources).length;
  const emptyState =
    dialog.dataSources.length && getSearchValue(controller).trim()
      ? "当前筛选条件下没有数据源"
      : "暂无数据源";
  return `
    <section class="oc-platform-data-source-page">
      <div class="oc-platform-data-source-page__summary">
        共 ${formatNumber(dialog.dataSources.length)} 个数据源，启用 ${formatNumber(activeCount)} 个
      </div>
      <div class="data-table-container">
        <table class="data-table oc-platform-data-source-table">
          <thead>
            <tr>
              <th>数据源名称</th>
              <th>数据源编码</th>
              <th>归属租户</th>
              <th>状态</th>
              <th>连接摘要</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map((source) => {
                      const connection = readDataSourceConnection(source);
                      const connectionParts = [];
                      const ownerTenant = tenantByDataSourceId(controller, source?.id);
                      if (source.sourceDbid) {
                        connectionParts.push(`账套 ID：${source.sourceDbid}`);
                      }
                      if (source.sourceTenantCode) {
                        connectionParts.push(`上游租户编码：${source.sourceTenantCode}`);
                      }
                      if (connection.host) {
                        connectionParts.push(`主机：${connection.host}`);
                      }
                      if (connection.database) {
                        connectionParts.push(`库：${connection.database}`);
                      }
                      return `
                        <tr>
                          <td>
                            <div class="oc-platform-revoke-agent__name">${escapeHtml(
                              getDataSourceDisplayName(source),
                            )}</div>
                            <div class="oc-platform-revoke-agent__meta">${escapeHtml(
                              source.sourceType || "kingdee_analytics",
                            )}</div>
                          </td>
                          <td>${escapeHtml(source.code || "-")}</td>
                          <td>${escapeHtml(getTenantDisplayName(ownerTenant))}</td>
                          <td>
                            <span class="data-table-badge data-table-badge--${source.status === "active" ? "direct" : "unknown"}">${escapeHtml(source.status || "unknown")}</span>
                          </td>
                          <td>${escapeHtml(connectionParts.join(" · ") || "未配置连接摘要")}</td>
                          <td>
                            <button class="btn" type="button" data-platform-edit-data-source="${escapeHtml(source.id)}" ${dialog.busy ? "disabled" : ""}>编辑</button>
                          </td>
                        </tr>
                      `;
                    })
                    .join("")
                : `<tr><td colspan="6" class="oc-platform-table-empty">${escapeHtml(emptyState)}</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderDataSourceCatalogDialog(controller) {
  const dialog = getDataSourceCatalogDialog(controller);
  if (!dialog.open) {
    return "";
  }
  const draft = dialog.draft || createDataSourceDraft();
  const boundTenant = tenantByDataSourceId(controller, draft.id);
  const selectableTenants = listSelectableTenantsForDraft(controller, draft);
  const selectedTenantId =
    String(boundTenant?.id || "").trim() ||
    String(draft.boundTenantId || "").trim() ||
    resolveDefaultBoundTenantId(controller, draft.id);
  return `
    <dialog class="oc-platform-modal oc-platform-modal--wide" data-platform-data-source-dialog>
      <div class="oc-platform-modal__panel oc-platform-modal__panel--wide">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">${draft.id ? "编辑数据源" : "创建数据源"}</h3>
          <button class="btn" type="button" data-platform-close-dialog="data-source">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          <div class="callout info">
            一套数据源只归属一个平台租户。创建后会立即绑定到所选租户，租户下的成员共享这套数据源，成员级别只再控制组织范围。
          </div>
          ${
            boundTenant
              ? `<div class="oc-platform-revoke-agent__meta">当前已归属平台租户：${escapeHtml(
                  getTenantDisplayName(boundTenant),
                )}。若要切换归属，请继续使用租户管理里的“绑定数据源”。</div>`
              : ""
          }
          ${
            !boundTenant && !selectableTenants.length
              ? `<div class="callout danger">当前没有可绑定的空闲平台租户，请先在租户管理里确认租户与数据源占用情况。</div>`
              : ""
          }
          ${dialog.error ? `<div class="callout info">${escapeHtml(dialog.error)}</div>` : ""}
          <form class="oc-platform-modal__form" data-platform-data-source-form>
            <input type="hidden" name="id" value="${escapeHtml(draft.id)}" />
            <label class="field">
              <span>平台租户</span>
              <select
                name="tenantId"
                data-platform-data-source-tenant
                ${dialog.loading || dialog.busy || !selectableTenants.length ? "disabled" : ""}
                required
              >
                <option value="">请选择平台租户</option>
                ${selectableTenants
                  .map(
                    (tenant) => `
                      <option
                        value="${escapeHtml(tenant.id)}"
                        ${selectedTenantId === String(tenant.id || "") ? "selected" : ""}
                      >
                        ${escapeHtml(getTenantDisplayName(tenant))}
                      </option>
                    `,
                  )
                  .join("")}
              </select>
            </label>
            <label class="field">
              <span>数据源编码</span>
              <input
                name="code"
                type="text"
                value="${escapeHtml(draft.code)}"
                data-platform-data-source-code
                ${dialog.busy ? "disabled" : ""}
                required
              />
            </label>
            <label class="field">
              <span>数据源名称</span>
              <input
                name="name"
                type="text"
                value="${escapeHtml(draft.name)}"
                data-platform-data-source-name
                ${dialog.busy ? "disabled" : ""}
                required
              />
            </label>
            <label class="field">
              <span>状态</span>
              <select
                name="status"
                data-platform-data-source-status
                ${dialog.busy ? "disabled" : ""}
              >
                <option value="active" ${draft.status === "active" ? "selected" : ""}>active</option>
                <option value="inactive" ${draft.status === "inactive" ? "selected" : ""}>inactive</option>
              </select>
            </label>
            <label class="field">
              <span>账套 ID</span>
              <input
                name="sourceDbid"
                type="text"
                value="${escapeHtml(draft.sourceDbid)}"
                data-platform-data-source-dbid
                ${dialog.busy ? "disabled" : ""}
              />
            </label>
            <label class="field">
              <span>上游租户编码（可选）</span>
              <input
                name="sourceTenantCode"
                type="text"
                value="${escapeHtml(draft.sourceTenantCode)}"
                data-platform-data-source-tenant-code
                ${dialog.busy ? "disabled" : ""}
              />
            </label>
            <label class="field">
              <span>连接主机</span>
              <input
                name="connectionHost"
                type="text"
                value="${escapeHtml(draft.connectionHost)}"
                data-platform-data-source-host
                ${dialog.busy ? "disabled" : ""}
                required
              />
            </label>
            <label class="field">
              <span>连接端口</span>
              <input
                name="connectionPort"
                type="number"
                min="1"
                value="${escapeHtml(draft.connectionPort)}"
                data-platform-data-source-port
                ${dialog.busy ? "disabled" : ""}
              />
            </label>
            <label class="field">
              <span>数据库名称</span>
              <input
                name="connectionDatabase"
                type="text"
                value="${escapeHtml(draft.connectionDatabase)}"
                data-platform-data-source-database
                ${dialog.busy ? "disabled" : ""}
                required
              />
            </label>
            <label class="field">
              <span>连接用户名</span>
              <input
                name="connectionUser"
                type="text"
                value="${escapeHtml(draft.connectionUser)}"
                data-platform-data-source-user
                ${dialog.busy ? "disabled" : ""}
              />
            </label>
            <label class="field">
              <span>连接密码</span>
              <input
                name="connectionPassword"
                type="password"
                value=""
                placeholder="${escapeHtml(
                  draft.id && draft.connectionPasswordStored ? "留空则保留当前密码" : "",
                )}"
                autocomplete="new-password"
                data-platform-data-source-password
                ${dialog.busy ? "disabled" : ""}
              />
            </label>
            <div class="oc-platform-modal__actions">
              <button class="btn" type="button" data-platform-close-dialog="data-source">取消</button>
              <button
                class="btn primary"
                type="submit"
                ${dialog.loading || dialog.busy || !selectableTenants.length ? "disabled" : ""}
              >
                ${draft.id ? "保存数据源" : "创建数据源"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

function renderTenantDataSourceBindingDialog(controller) {
  const dialog = getTenantDataSourceBindingDialog(controller);
  const activeDataSources = getActiveDataSources(dialog.dataSources);
  const statusMarkup = dialog.loading
    ? `<div class="callout info">正在加载当前绑定和可用数据源...</div>`
    : dialog.error
      ? `<div class="callout info">${escapeHtml(dialog.error)}</div>`
      : "";
  const selectedDataSourceId =
    dialog.selectedDataSourceId ||
    (activeDataSources.length === 1 ? String(activeDataSources[0].id || "") : "");
  return `
    <dialog class="oc-platform-modal" data-platform-binding-dialog>
      <div class="oc-platform-modal__panel">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">绑定数据源</h3>
          <button class="btn" type="button" data-platform-close-dialog="binding">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          <form class="oc-platform-modal__form" data-platform-binding-form>
            <input type="hidden" name="tenantId" value="${escapeHtml(dialog.tenantId)}" />
            <label class="field">
              <span>目标租户</span>
              <input type="text" value="${escapeHtml(dialog.tenantName || dialog.tenantId)}" disabled />
            </label>
            <label class="field">
              <span>当前绑定</span>
              <input
                type="text"
                value="${escapeHtml(dialog.currentBinding?.dataSourceName || "未绑定")}"
                disabled
              />
            </label>
            <div class="oc-platform-revoke-agent__meta">${escapeHtml(
              getBindingSourceSummary(dialog.currentBinding),
            )}</div>
            <label class="field">
              <span>可用数据源</span>
              <select
                name="dataSourceId"
                data-platform-binding-select
                ${dialog.loading || dialog.busy || !activeDataSources.length ? "disabled" : ""}
                required
              >
                <option value="">请选择数据源</option>
                ${activeDataSources
                  .map(
                    (source) => `
                      <option
                        value="${escapeHtml(source.id)}"
                        ${selectedDataSourceId === String(source.id || "") ? "selected" : ""}
                      >
                        ${escapeHtml(getDataSourceDisplayName(source))}
                      </option>
                    `,
                  )
                  .join("")}
              </select>
            </label>
            <div class="callout danger">
              更换绑定后会清空该租户成员已配置的组织权限范围，并将成员权限重置为无权限，请确认后再保存。
            </div>
            ${statusMarkup}
            ${
              !dialog.loading && !activeDataSources.length
                ? `<div class="callout info">当前没有可绑定的启用数据源，请先到“创建数据源”页面中创建或启用数据源。</div>`
                : ""
            }
            <div class="oc-platform-modal__actions">
              <button class="btn" type="button" data-platform-close-dialog="binding">取消</button>
              <button class="btn primary" type="submit" ${dialog.loading || dialog.busy || !selectedDataSourceId ? "disabled" : ""}>保存绑定</button>
            </div>
          </form>
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
  if (controller.section === "agent-allocation") {
    pruneAssignTenantAgentSelection(controller);
    pruneRevokeTenantAgentSelection(controller);
  }
  const filtered =
    controller.section === "data-sources" ? filterDataSources(controller) : filterTenants(controller);
  const pagination = paginate(filtered, getPageValue(controller));
  setPageValue(controller, pagination.page);

  root.setAttribute(BODY_SECTION_ATTR, controller.section);
  root.dataset.ocPlatformEmbedded = "true";
  root.innerHTML = `
    <section class="oc-platform-list-view">
      ${renderToolbar(controller)}
      <div class="data-table-wrapper">
        ${
          controller.section === "agent-allocation"
            ? renderAgentAssignmentTable(controller, pagination.items)
            : controller.section === "data-sources"
              ? renderDataSourceManagementTable(controller, pagination.items)
              : renderTenantManagementTable(controller, pagination.items)
        }
        ${renderPagination(controller, pagination)}
      </div>
    </section>
    ${renderDataSourceCatalogDialog(controller)}
    ${renderTenantDataSourceBindingDialog(controller)}
    ${renderCreateDialog(controller)}
    ${renderMemberLimitDialog(controller)}
    ${renderAssignDialog(controller)}
    ${renderRateDialog(controller)}
    ${renderRevokeTenantAgentDialog(controller)}
    ${renderRevokeTenantAgentConfirmDialog(controller)}
    ${renderLocalLicenseDialog(controller)}
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
  if (controller.dataSourceCatalogDialog?.open) {
    openDialog(root.querySelector("[data-platform-data-source-dialog]"));
  }
  if (controller.tenantDataSourceBindingDialog?.open) {
    openDialog(root.querySelector("[data-platform-binding-dialog]"));
  }
  if (controller.section === "agent-allocation") {
    syncAssignTenantAgentSelectionState(root, controller);
    syncRevokeTenantAgentSelectionState(root, controller);
  }
  restoreRenderFocusState(root, focusState);
}

async function refresh(root, controller) {
  const tasks = [
    controller.apiClient.listPlatformTenants(),
    controller.apiClient.listPlatformCatalogAgents(),
    isLocalEdition(controller) ? controller.apiClient.getLocalLicense() : Promise.resolve(null),
    controller.section === "data-sources"
      ? controller.apiClient.listDataSources()
      : Promise.resolve(null),
  ];
  const [tenants, catalogAgents, localLicense = null, dataSources = null] = await Promise.all(tasks);
  controller.tenants = tenants;
  controller.catalogAgents = catalogAgents;
  controller.localLicense = localLicense;
  if (controller.section === "data-sources") {
    const dialog = getDataSourceCatalogDialog(controller);
    dialog.dataSources = Array.isArray(dataSources) ? dataSources : [];
    dialog.loading = false;
    syncDataSourceDraftTenant(controller);
  }
  if (controller.assignTenantAgentDialog?.open) {
    controller.assignTenantAgentDialog.agents = Array.isArray(catalogAgents)
      ? catalogAgents.slice()
      : [];
  }
  if (
    controller.activeTenant &&
    !tenants.some((tenant) => tenant.id === controller.activeTenant.id)
  ) {
    controller.activeTenant = null;
  }
  render(root, controller);
}

function tenantById(controller, tenantId) {
  return controller.tenants.find((tenant) => tenant.id === tenantId) ?? null;
}

function dataSourceById(dataSources, dataSourceId) {
  if (!Array.isArray(dataSources)) {
    return null;
  }
  return (
    dataSources.find((source) => String(source?.id || "").trim() === String(dataSourceId || "").trim()) ??
    null
  );
}

async function openTenantDataSourceBindingDialog(root, controller, tenantId) {
  const tenant = tenantById(controller, tenantId);
  if (!tenant) {
    return;
  }

  controller.activeTenant = tenant;
  const previousToken = Number(controller.tenantDataSourceBindingDialog?.requestToken || 0);
  controller.tenantDataSourceBindingDialog = {
    ...createTenantDataSourceBindingDialogState(),
    open: true,
    loading: true,
    tenantId: tenant.id,
    tenantName: tenant.name,
    requestToken: previousToken + 1,
  };
  render(root, controller);

  const requestToken = controller.tenantDataSourceBindingDialog.requestToken;
  try {
    const [dataSources, currentBinding] = await Promise.all([
      controller.apiClient.listDataSources(),
      controller.apiClient.getTenantDataSourceBinding(tenant.id),
    ]);
    const currentDialog = controller.tenantDataSourceBindingDialog;
    if (
      !currentDialog?.open ||
      currentDialog.requestToken !== requestToken ||
      currentDialog.tenantId !== tenant.id
    ) {
      return;
    }
    currentDialog.dataSources = Array.isArray(dataSources) ? dataSources : [];
    currentDialog.currentBinding = currentBinding ?? null;
    const activeDataSources = getActiveDataSources(currentDialog.dataSources);
    const activeIds = new Set(activeDataSources.map((source) => String(source.id || "").trim()));
    const currentBindingId = String(currentBinding?.dataSourceId || "").trim();
    currentDialog.selectedDataSourceId = activeIds.has(currentBindingId)
      ? currentBindingId
      : String(activeDataSources[0]?.id || "");
    currentDialog.loading = false;
    currentDialog.error = "";
    render(root, controller);
  } catch (error) {
    const currentDialog = controller.tenantDataSourceBindingDialog;
    if (
      !currentDialog?.open ||
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

  if (target.closest("[data-platform-open-data-source-create]")) {
    const dialog = getDataSourceCatalogDialog(controller);
    dialog.open = true;
    dialog.busy = false;
    dialog.error = "";
    dialog.draft = createDataSourceDraft(null, resolveDefaultBoundTenantId(controller));
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
    if (dialogKind === "binding") {
      controller.tenantDataSourceBindingDialog = createTenantDataSourceBindingDialogState();
      closeDialog(root.querySelector("[data-platform-binding-dialog]"));
    }
    if (dialogKind === "data-source") {
      controller.dataSourceCatalogDialog = createDataSourceCatalogDialogState();
      closeDialog(root.querySelector("[data-platform-data-source-dialog]"));
    }
    render(root, controller);
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

  const bindingTrigger = target.closest("[data-platform-open-data-source-binding]");
  if (bindingTrigger instanceof HTMLElement) {
    await openTenantDataSourceBindingDialog(
      root,
      controller,
      bindingTrigger.dataset.platformOpenDataSourceBinding || "",
    );
    return;
  }

  const editDataSourceTrigger = target.closest("[data-platform-edit-data-source]");
  if (editDataSourceTrigger instanceof HTMLElement) {
    const dialog = getDataSourceCatalogDialog(controller);
    const source = dataSourceById(
      dialog.dataSources,
      editDataSourceTrigger.dataset.platformEditDataSource || "",
    );
    if (!source) {
      return;
    }
    dialog.open = true;
    dialog.busy = false;
    dialog.draft = createDataSourceDraft(
      source,
      resolveDefaultBoundTenantId(controller, editDataSourceTrigger.dataset.platformEditDataSource),
    );
    dialog.error = "";
    render(root, controller);
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

  if (target.matches("[data-platform-data-source-form]")) {
    event.preventDefault();
    const dialog = getDataSourceCatalogDialog(controller);
    if (dialog.loading || dialog.busy) {
      return;
    }
    const formData = new FormData(target);
    const tenantId = String(formData.get("tenantId") || "").trim();
    const submittedPasswordValue = formData.get("connectionPassword");
    const submittedPassword =
      typeof submittedPasswordValue === "string"
        ? submittedPasswordValue
        : submittedPasswordValue === null
          ? ""
          : String(submittedPasswordValue);
    dialog.draft = createDataSourceDraft({
      id: String(formData.get("id") || "").trim(),
      code: String(formData.get("code") || "").trim(),
      name: String(formData.get("name") || "").trim(),
      status: String(formData.get("status") || "").trim() || "active",
      sourceDbid: String(formData.get("sourceDbid") || "").trim(),
      sourceTenantCode: String(formData.get("sourceTenantCode") || "").trim(),
      connection: {
        host: String(formData.get("connectionHost") || "").trim(),
        port: String(formData.get("connectionPort") || "").trim(),
        database: String(formData.get("connectionDatabase") || "").trim(),
        user: String(formData.get("connectionUser") || "").trim(),
        password: submittedPassword,
      },
    }, tenantId);
    const isUpdate = Boolean(dialog.draft.id);
    const currentBoundTenant = tenantByDataSourceId(controller, dialog.draft.id);
    if (!tenantId) {
      dialog.error = "请选择平台租户。";
      render(root, controller);
      setFeedback(root, dialog.error, true);
      return;
    }
    if (
      isUpdate &&
      currentBoundTenant?.id &&
      String(currentBoundTenant.id || "").trim() !== tenantId
    ) {
      dialog.error = describePlatformDataSourceError("tenant_data_source_rebind_locked");
      render(root, controller);
      setFeedback(root, dialog.error, true);
      return;
    }
    dialog.busy = true;
    dialog.error = "";
    render(root, controller);
    try {
      const payload = buildDataSourcePayloadFromDraft(dialog.draft);
      const saved = isUpdate
        ? await controller.apiClient.updateDataSource(payload)
        : await controller.apiClient.createDataSource(payload);
      const savedDataSourceId = String(saved?.id || dialog.draft.id || "").trim();
      if (!savedDataSourceId) {
        throw new Error("data_source_not_found");
      }
      if (!isUpdate || !currentBoundTenant?.id) {
        await controller.apiClient.setTenantDataSourceBinding({
          tenantId,
          dataSourceId: savedDataSourceId,
        });
      }
      await refresh(root, controller);
      const currentDialog = getDataSourceCatalogDialog(controller);
      currentDialog.open = false;
      currentDialog.busy = false;
      currentDialog.loading = false;
      currentDialog.error = "";
      currentDialog.draft = createDataSourceDraft(
        null,
        resolveDefaultBoundTenantId(controller),
      );
      render(root, controller);
      if (!isUpdate) {
        setFeedback(
          root,
          `已创建数据源并绑定到租户“${getTenantDisplayName(tenantById(controller, tenantId))}”。`,
        );
        return;
      }
      if (!currentBoundTenant?.id) {
        setFeedback(
          root,
          `数据源已更新，并已绑定到租户“${getTenantDisplayName(tenantById(controller, tenantId))}”。`,
        );
        return;
      } else {
        setFeedback(root, "数据源已更新。");
        return;
      }
    } catch (error) {
      const errorMessage = describePlatformDataSourceError(
        error instanceof Error ? error.message : String(error),
      );
      dialog.busy = false;
      dialog.loading = false;
      dialog.error = errorMessage;
      render(root, controller);
      setFeedback(root, errorMessage, true);
    }
    return;
  }

  if (target.matches("[data-platform-binding-form]")) {
    event.preventDefault();
    const dialog = getTenantDataSourceBindingDialog(controller);
    if (!dialog.open || dialog.loading || dialog.busy) {
      return;
    }
    const formData = new FormData(target);
    const dataSourceId = String(
      formData.get("dataSourceId") || dialog.selectedDataSourceId || "",
    ).trim();
    if (!dataSourceId) {
      dialog.error = "请选择数据源。";
      render(root, controller);
      setFeedback(root, dialog.error, true);
      return;
    }
    dialog.selectedDataSourceId = dataSourceId;
    const selectedSource = dataSourceById(dialog.dataSources, dataSourceId);
    const tenantLabel = dialog.tenantName || dialog.tenantId || "该租户";
    const sourceLabel = getDataSourceDisplayName(selectedSource);
    const requestToken = Number(dialog.requestToken || 0);
    dialog.busy = true;
    dialog.error = "";
    render(root, controller);
    try {
      await controller.apiClient.setTenantDataSourceBinding({
        tenantId: dialog.tenantId,
        dataSourceId,
      });
      controller.tenantDataSourceBindingDialog = createTenantDataSourceBindingDialogState();
      try {
        await refresh(root, controller);
      } catch (refreshError) {
        render(root, controller);
        setFeedback(
          root,
          refreshError instanceof Error
            ? `已为租户“${tenantLabel}”绑定数据源“${sourceLabel}”，但列表刷新失败：${refreshError.message}`
            : `已为租户“${tenantLabel}”绑定数据源“${sourceLabel}”，但列表刷新失败。`,
          true,
        );
        return;
      }
      setFeedback(root, `已为租户“${tenantLabel}”绑定数据源“${sourceLabel}”。`);
    } catch (error) {
      const errorMessage = describePlatformDataSourceError(
        error instanceof Error ? error.message : String(error),
      );
      const currentDialog = controller.tenantDataSourceBindingDialog;
      if (
        currentDialog?.open &&
        currentDialog.requestToken === requestToken &&
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
  if (controller.section !== "data-sources") {
    controller.dataSourceCatalogDialog = createDataSourceCatalogDialogState();
  }
  if (controller.section !== "tenants") {
    controller.tenantDataSourceBindingDialog = createTenantDataSourceBindingDialogState();
  }
  const sectionLinks = root.querySelectorAll("[href]");
  for (const link of sectionLinks) {
    if (!(link instanceof HTMLAnchorElement)) {
      continue;
    }
    const href = link.getAttribute("href") || "";
    if (href === currentSectionHref("tenants")) {
      link.classList.toggle("active", controller.section === "tenants");
    }
    if (href === currentSectionHref("agent-allocation")) {
      link.classList.toggle("active", controller.section === "agent-allocation");
    }
    if (href === currentSectionHref("data-sources")) {
      link.classList.toggle("active", controller.section === "data-sources");
    }
  }

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
