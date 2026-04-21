import { createTenantApiClient } from "./api-client.js";
import { showTransientFeedbackToast } from "./feedback-toast.js";
import {
  PLATFORM_AGENT_ASSIGNMENT_VIEW,
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
  return section === "agent-allocation"
    ? `./?ocTenantView=${PLATFORM_AGENT_ASSIGNMENT_VIEW}`
    : `./?ocTenantView=${PLATFORM_TENANT_MANAGEMENT_VIEW}`;
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
    },
    pageBySection: {
      tenants: 1,
      "agent-allocation": 1,
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
    }
    if (event.target.matches("[data-platform-rate-dialog]")) {
      controller.dialogs.rateOpen = false;
      controller.rateDialogAgents = [];
    }
    if (event.target.matches("[data-platform-local-license-dialog]")) {
      controller.dialogs.localLicenseOpen = false;
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
  const localEdition = isLocalEdition(controller);
  return `
    <div class="data-table-toolbar oc-platform-table-toolbar">
      <label class="data-table-search">
        <input
          type="search"
          placeholder="${isTenantSection ? "搜索租户名称或编码" : "搜索租户名称或编码"}"
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
                          </div>
                        </td>
                      </tr>
                    `,
                  )
                  .join("")
              : `<tr><td colspan="${localEdition ? 6 : 9}" class="oc-platform-table-empty">暂无租户数据</td></tr>`
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
  const tenant = controller.activeTenant;
  const localEdition = isLocalEdition(controller);
  return `
    <dialog class="oc-platform-modal" data-platform-assign-dialog>
      <div class="oc-platform-modal__panel">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">分配Agent</h3>
          <button class="btn" type="button" data-platform-close-dialog="assign">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          ${
            tenant
              ? `
                <form class="oc-platform-modal__form" data-platform-agent-form>
                  <input type="hidden" name="tenantId" value="${escapeHtml(tenant.id)}" />
                  <label class="field"><span>目标租户</span><input type="text" value="${escapeHtml(tenant.name)}" disabled /></label>
                  <label class="field">
                    <span>OpenClaw Agent</span>
                    <select name="agentId" required>
                      <option value="">请选择 OpenClaw Agent</option>
                      ${controller.catalogAgents
                        .map(
                          (agent) =>
                            `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.name)}</option>`,
                        )
                        .join("")}
                    </select>
                  </label>
                  <label class="field"><span>简短描述</span><input name="description" type="text" placeholder="显示在成员 Agent 卡片上的描述" /></label>
                  ${
                    localEdition
                      ? `
                        <input type="hidden" name="rateMultiplier" value="1" />
                        <input type="hidden" name="balancePoints" value="0" />
                      `
                      : `
                        <label class="field"><span>计费倍率</span><input name="rateMultiplier" type="number" step="0.01" value="1" required /></label>
                        <label class="field"><span>初始积分</span><input name="balancePoints" type="number" step="0.01" value="0" required /></label>
                      `
                  }
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
    pruneRevokeTenantAgentSelection(controller);
  }
  const filtered = filterTenants(controller);
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
            : renderTenantManagementTable(controller, pagination.items)
        }
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
  if (controller.section === "agent-allocation") {
    syncRevokeTenantAgentSelectionState(root, controller);
  }
  restoreRenderFocusState(root, focusState);
}

async function refresh(root, controller) {
  const tasks = [
    controller.apiClient.listPlatformTenants(),
    controller.apiClient.listPlatformCatalogAgents(),
  ];
  if (isLocalEdition(controller)) {
    tasks.push(controller.apiClient.getLocalLicense());
  }
  const [tenants, catalogAgents, localLicense = null] = await Promise.all(tasks);
  controller.tenants = tenants;
  controller.catalogAgents = catalogAgents;
  controller.localLicense = localLicense;
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

  const assignTrigger = target.closest("[data-platform-open-assign]");
  if (assignTrigger instanceof HTMLElement) {
    controller.activeTenant = tenantById(controller, assignTrigger.dataset.platformOpenAssign);
    controller.dialogs.assignOpen = true;
    render(root, controller);
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
    try {
      const payload = Object.fromEntries(new FormData(target).entries());
      await controller.apiClient.upsertPlatformTenantAgent(payload);
      controller.dialogs.assignOpen = false;
      await refresh(root, controller);
      closeDialog(root.querySelector("[data-platform-assign-dialog]"));
      setFeedback(root, "Agent 已下发到目标租户。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
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
    clearRevokeTenantAgentSelection(controller);
  }
  if (controller.section !== "agent-allocation") {
    controller.dialogs.assignOpen = false;
    controller.dialogs.rateOpen = false;
    controller.rateDialogAgents = [];
    controller.loadingRateAgents = false;
    controller.revokeTenantAgentDialog = createRevokeTenantAgentDialogState();
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
