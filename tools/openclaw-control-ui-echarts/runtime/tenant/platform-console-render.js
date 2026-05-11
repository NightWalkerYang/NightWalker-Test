import {
  BODY_SECTION_ATTR,
  deploymentModeLabel,
  escapeHtml,
  formatDateTime,
  formatNumber,
  filterTenants,
  getPageValue,
  getSearchValue,
  isLocalEdition,
  paginate,
  setPageValue,
} from "./platform-console-controller.js";
import {
  filterDataSources,
  renderDataSourceCatalogDialog,
  renderDataSourceManagementTable,
  renderTenantDataSourceBindingDialog,
} from "./platform-console-data-sources.js";
import {
  clearAssignTenantAgentSelection,
  clearRevokeTenantAgentSelection,
  getAssignablePlatformCatalogAgents,
  getRevokeTenantAgentSelectableAgents,
  isTenantRevokeSelectionTarget,
  pruneAssignTenantAgentSelection,
  pruneRevokeTenantAgentSelection,
  renderAssignDialog,
  renderCreateDialog,
  renderLocalLicenseDialog,
  renderMemberLimitDialog,
  renderRateDialog,
  renderRevokeTenantAgentConfirmDialog,
  renderRevokeTenantAgentDialog,
} from "./platform-console-dialogs.js";
import {
  filterNodes,
  renderBindNodeDialog,
  renderNodeDialog,
  renderNodeManagementTable,
} from "./platform-console-nodes.js";

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

function renderToolbar(controller) {
  const isTenantSection = controller.section === "tenants";
  const isDataSourceSection = controller.section === "data-sources";
  const isNodeSection = controller.section === "nodes";
  const localEdition = isLocalEdition(controller);
  const placeholder = isDataSourceSection
    ? "搜索数据源名称、编码或归属租户"
    : isNodeSection
      ? "搜索节点名称或标识"
      : "搜索租户名称或编码";
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
      <table class="data-table oc-platform-tenant-table">
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
                      <tr>
                        <td>${escapeHtml(tenant.name)}</td>
                        <td>${escapeHtml(tenant.code)}</td>
                        <td><span class="data-table-badge data-table-badge--${tenant.status === "active" ? "direct" : "unknown"}">${escapeHtml(tenant.status)}</span></td>
                        <td>${formatNumber(tenant.memberCount)}</td>
                        <td>${formatNumber(tenant.memberLimit)}</td>
                        <td>${escapeHtml(String(tenant.dataSourceName || "未绑定").trim() || "未绑定")}</td>
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
                            <button class="btn" type="button" data-platform-open-data-source-binding="${escapeHtml(tenant.id)}">绑定数据源</button>
                            ${
                              localEdition
                                ? ""
                                : `<button class="btn" type="button" data-platform-open-bind-node="${escapeHtml(tenant.id)}">节点绑定</button>`
                            }
                          </div>
                        </td>
                      </tr>
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

export function renderPlatformConsole(root, controller, helpers) {
  const focusState = captureRenderFocusState(root);
  if (controller.section === "agent-allocation") {
    pruneAssignTenantAgentSelection(controller);
    pruneRevokeTenantAgentSelection(controller);
  }
  const filtered =
    controller.section === "data-sources"
      ? filterDataSources(controller)
      : controller.section === "nodes"
        ? filterNodes(controller)
        : filterTenants(controller);
  const pagination = paginate(filtered, getPageValue(controller));
  setPageValue(controller, pagination.page);

  root.setAttribute(BODY_SECTION_ATTR, controller.section);
  root.dataset.ocPlatformEmbedded = "true";
  root.innerHTML = `
    <section class="oc-platform-list-view">
      ${renderToolbar(controller)}
      <div class="data-table-wrapper">
        ${
          controller.section === "data-sources"
            ? renderDataSourceManagementTable(controller, pagination.items)
            : controller.section === "nodes"
              ? renderNodeManagementTable(pagination.items)
              : controller.section === "agent-allocation"
                ? renderAgentAssignmentTable(controller, pagination.items)
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
    ${renderNodeDialog(controller)}
    ${renderBindNodeDialog(controller)}
  `;

  if (controller.dialogs.createTenantOpen) {
    helpers.openDialog(root.querySelector("[data-platform-create-dialog]"));
  }
  if (controller.dialogs.memberLimitOpen) {
    helpers.openDialog(root.querySelector("[data-platform-member-limit-dialog]"));
  }
  if (controller.dialogs.assignOpen) {
    helpers.openDialog(root.querySelector("[data-platform-assign-dialog]"));
  }
  if (controller.dialogs.rateOpen) {
    helpers.openDialog(root.querySelector("[data-platform-rate-dialog]"));
  }
  if (controller.revokeTenantAgentDialog?.open) {
    helpers.openDialog(root.querySelector("[data-platform-revoke-tenant-agent-dialog]"));
  }
  if (controller.revokeTenantAgentDialog?.confirmOpen) {
    helpers.openDialog(root.querySelector("[data-platform-revoke-confirm-dialog]"));
  }
  if (controller.dialogs.localLicenseOpen) {
    helpers.openDialog(root.querySelector("[data-platform-local-license-dialog]"));
  }
  if (controller.dataSourceCatalogDialog?.open) {
    helpers.openDialog(root.querySelector("[data-platform-data-source-dialog]"));
  }
  if (controller.tenantDataSourceBindingDialog?.open) {
    helpers.openDialog(root.querySelector("[data-platform-binding-dialog]"));
  }
  if (controller.dialogs.nodeOpen) {
    helpers.openDialog(root.querySelector("[data-platform-node-dialog]"));
  }
  if (controller.dialogs.bindNodeOpen) {
    helpers.openDialog(root.querySelector("[data-platform-bind-node-dialog]"));
  }
  if (controller.section === "agent-allocation") {
    syncAssignTenantAgentSelectionState(root, controller);
    syncRevokeTenantAgentSelectionState(root, controller);
  }
  restoreRenderFocusState(root, focusState);
}

export function clearAllocationSelections(controller) {
  clearAssignTenantAgentSelection(controller);
  clearRevokeTenantAgentSelection(controller);
}
