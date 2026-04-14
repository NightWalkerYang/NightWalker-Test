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
    dialog.showModal();
  }
}

function closeDialog(dialog) {
  if (dialog instanceof HTMLDialogElement && dialog.open) {
    dialog.close();
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
    <dialog class="oc-platform-modal" data-platform-rate-dialog>
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

function renderLocalLicenseDialog(controller) {
  if (!isLocalEdition(controller)) {
    return "";
  }
  const localLicense = controller.localLicense;
  return `
    <dialog class="oc-platform-modal" data-platform-local-license-dialog>
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

function render(root, controller) {
  const focusState = captureRenderFocusState(root);
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
  if (controller.dialogs.localLicenseOpen) {
    openDialog(root.querySelector("[data-platform-local-license-dialog]"));
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
  controller.section = options.section || "tenants";
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
