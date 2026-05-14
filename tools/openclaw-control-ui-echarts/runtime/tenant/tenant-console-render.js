import {
  filterTenantAgents,
  renderAgentDetailDialog,
  renderAgentTransferDialog,
  renderOwnedAgentsCards,
} from "./tenant-console-agents.js";
import {
  filterMembers,
  getPageValue,
  getSearchValue,
  isLocalEdition,
  paginate,
  setPageValue,
  escapeHtml,
  formatNumber,
} from "./tenant-console-controller.js";
import { openDialog } from "./tenant-console-dialogs.js";
import {
  clearAssignAgentSelection,
  clearRevokeAssignmentSelection,
  pruneAssignAgentSelection,
  pruneRevokeAssignmentSelection,
  renderAssignDialog,
  renderAssignmentTable,
  renderChangePasswordDialog,
  renderCreateMemberDialog,
  renderDeleteMemberDialog,
  renderMemberOrgScopeDialog,
  renderMembersTable,
  renderRevokeAssignmentConfirmDialog,
  renderRevokeAssignmentDialog,
  syncAssignAgentSelectionState,
  syncMemberOrgScopeSelectionState,
  syncRevokeAssignmentSelectionState,
} from "./tenant-console-members.js";
import { renderUsageList } from "./tenant-console-usage.js";
import {
  renderWalletFlowList,
  renderWalletLedgerList,
  renderWalletOrdersList,
} from "./tenant-console-wallet.js";
import {
  disposeTenantOverviewCharts,
  initTenantOverviewCharts,
  renderTenantOverview,
} from "./tenant-overview-page.js";
import { renderTenantWalletPage } from "./tenant-wallet-page.js";

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

function renderToolbar(controller) {
  if (
    controller.section === "skills-market" ||
    controller.section === "skills-entitlements" ||
    controller.section === "skills-assignments"
  ) {
    return `
      <div class="data-table-toolbar oc-tenant-table-toolbar">
        <div class="oc-tenant-wallet-toolbar__summary">
          Skills 管理
        </div>
      </div>
    `;
  }
  if (controller.section === "wallet") {
    const pendingCount = Number(controller.walletData?.summary?.pendingOrderCount || 0);
    return `
      <div class="data-table-toolbar oc-tenant-table-toolbar">
        <div class="oc-tenant-wallet-toolbar__summary">
          待处理订单: ${formatNumber(pendingCount)}
        </div>
        <div class="oc-tenant-table-toolbar__actions">
          <button class="btn" type="button" data-tenant-wallet-refresh>刷新钱包</button>
        </div>
      </div>
    `;
  }

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

  if (controller.section === "wallet-orders") {
    return `
      <div class="data-table-toolbar oc-tenant-table-toolbar">
        <label class="data-table-search">
          <input
            type="search"
            placeholder="搜索订单号、状态或供应商单号"
            value="${escapeHtml(getSearchValue(controller))}"
            data-tenant-search
          />
        </label>
      </div>
    `;
  }

  if (controller.section === "wallet-ledger") {
    return `
      <div class="data-table-toolbar oc-tenant-table-toolbar">
        <label class="data-table-search">
          <input
            type="search"
            placeholder="搜索模型扣费、Agent 或备注"
            value="${escapeHtml(getSearchValue(controller))}"
            data-tenant-search
          />
        </label>
      </div>
    `;
  }

  if (controller.section === "wallet-flow") {
    return `
      <div class="data-table-toolbar oc-tenant-table-toolbar">
        <label class="data-table-search">
          <input
            type="search"
            placeholder="搜索流水类型、订单号、Agent 或备注"
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
          placeholder="搜索成员账号或状态"
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

function renderSkillsMarketTable(controller) {
  const rows = Array.isArray(controller.skillsMarketItems) ? controller.skillsMarketItems : [];
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Skill</th>
            <th>类型</th>
            <th>状态</th>
            <th>价格</th>
            <th>版本</th>
            <th>影响模板</th>
            <th>影响成员</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (entry) => `
                      <tr>
                        <td>${escapeHtml(entry.name || entry.skillKey)}</td>
                        <td>${escapeHtml(entry.classification)}</td>
                        <td>${escapeHtml(entry.marketStatus || "-")}</td>
                        <td>${formatNumber(entry.pricePoints || 0)}</td>
                        <td>${escapeHtml(entry.latestVersionLabel || entry.latestVersionId || "-")}</td>
                        <td>${formatNumber(entry.affectedTenantAgentCount || 0)}</td>
                        <td>${formatNumber(entry.affectedAssignmentCount || 0)}</td>
                        <td>
                          ${
                            entry.classification === "paid" && !entry.entitlementId
                              ? `<button class="btn" type="button" data-tenant-skill-order="${escapeAttribute(entry.id)}">下单</button>`
                              : entry.classification === "paid" && entry.pendingOrderId
                                ? `<button class="btn primary" type="button" data-tenant-skill-confirm-order="${escapeAttribute(entry.pendingOrderId)}">确认购买</button>`
                                : entry.classification === "free" &&
                                    entry.entitlementId &&
                                    !entry.enabledByTenant
                                  ? `<button class="btn" type="button" data-tenant-skill-enable="${escapeAttribute(entry.entitlementId)}">启用</button>`
                                  : entry.classification === "free" && !entry.entitlementId
                                    ? `<button class="btn" type="button" data-tenant-skill-free-enable="${escapeAttribute(entry.id)}">启用</button>`
                                    : `<span class="oc-platform-table-empty">-</span>`
                          }
                        </td>
                      </tr>
                    `,
                  )
                  .join("")
              : `<tr><td colspan="8" class="oc-platform-table-empty">暂无 Skills 市场数据</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderSkillsEntitlementsTable(controller) {
  const rows = Array.isArray(controller.skillsEntitlementItems)
    ? controller.skillsEntitlementItems
    : [];
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Skill</th>
            <th>类型</th>
            <th>授权状态</th>
            <th>启用</th>
            <th>版本策略</th>
            <th>当前版本</th>
            <th>阻断原因</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (entry) => `
                      <tr>
                        <td>${escapeHtml(entry.name || entry.skillKey)}</td>
                        <td>${escapeHtml(entry.classification)}</td>
                        <td>${escapeHtml(entry.status)}</td>
                        <td>${entry.enabledByTenant ? "是" : "否"}</td>
                        <td>${escapeHtml(entry.versionPolicy || "-")}</td>
                        <td>${escapeHtml(entry.currentVersionId || entry.latestVersionId || "-")}</td>
                        <td>${escapeHtml(entry.blockedReason || "-")}</td>
                        <td>
                          ${
                            entry.enabledByTenant
                              ? `<button class="btn" type="button" data-tenant-skill-disable="${escapeAttribute(entry.id)}">停用</button>`
                              : `<button class="btn primary" type="button" data-tenant-skill-enable="${escapeAttribute(entry.id)}">启用</button>`
                          }
                        </td>
                      </tr>
                    `,
                  )
                  .join("")
              : `<tr><td colspan="8" class="oc-platform-table-empty">暂无租户授权数据</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderSkillsAssignmentsTable(controller) {
  const rows = Array.isArray(controller.skillsAssignmentItems)
    ? controller.skillsAssignmentItems
    : [];
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Tenant Agent</th>
            <th>模板 Skills</th>
            <th>阻断 Skills</th>
            <th>成员数</th>
            <th>成员覆盖摘要</th>
            <th>模板编辑</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map((entry) => {
                    const draft = controller.skillsTemplateDrafts.get(
                      String(entry.tenantAgentId || "").trim(),
                    );
                    const selectedSkillKeys = new Set(
                      Array.isArray(draft)
                        ? draft
                        : Array.isArray(entry.templateRows)
                          ? entry.templateRows
                              .filter((item) => item.templateState === "enabled")
                              .map((item) => String(item.skillKey || "").trim())
                          : [],
                    );
                    const assignmentSummary = Array.isArray(entry.assignments)
                      ? entry.assignments
                          .map((assignment) => {
                            const overrideSummary = Array.isArray(assignment.overrideSummary)
                              ? assignment.overrideSummary
                                  .map((override) => `${override.action}:${override.skillKey}`)
                                  .join(", ")
                              : "";
                            return `${assignment.username || assignment.userId}: ${overrideSummary || assignment.resolvedSkillKeys?.join(", ") || "-"}`;
                          })
                          .join(" | ")
                      : "-";
                    return `
                      <tr>
                        <td>${escapeHtml(entry.baseAgentId)}</td>
                        <td>${escapeHtml((entry.templateSkillKeys || []).join(", ") || "-")}</td>
                        <td>${escapeHtml((entry.blockedSkillKeys || []).join(", ") || "-")}</td>
                        <td>${formatNumber(entry.assignmentCount || 0)}</td>
                        <td>${escapeHtml(assignmentSummary || "-")}</td>
                        <td>
                          <div class="oc-tenant-skill-template-editor">
                            ${
                              Array.isArray(entry.templateRows) && entry.templateRows.length
                                ? entry.templateRows
                                    .map(
                                      (template) => `
                                        <label class="oc-tenant-member-org-scope-mode">
                                          <input
                                            type="checkbox"
                                            data-tenant-skill-template-toggle="${escapeAttribute(entry.tenantAgentId)}"
                                            data-tenant-skill-key="${escapeAttribute(template.skillKey)}"
                                            ${selectedSkillKeys.has(String(template.skillKey || "").trim()) ? "checked" : ""}
                                          />
                                          <span>${escapeHtml(template.skillKey)}</span>
                                        </label>
                                      `,
                                    )
                                    .join("")
                                : `<span class="oc-platform-table-empty">-</span>`
                            }
                            <div class="oc-tenant-table-actions">
                              <button class="btn primary" type="button" data-tenant-skill-template-save="${escapeAttribute(entry.tenantAgentId)}">保存模板</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                      ${
                        Array.isArray(entry.assignments) && entry.assignments.length
                          ? entry.assignments
                              .map((assignment) => {
                                const assignmentId = String(assignment.assignmentId || "").trim();
                                const overrideDraft =
                                  controller.skillsOverrideDrafts.get(assignmentId) ||
                                  (Array.isArray(assignment.overrideRows)
                                    ? assignment.overrideRows.map((item) => ({
                                        skillKey: String(item.skillKey || "").trim(),
                                        action: String(item.action || "").trim(),
                                      }))
                                    : []);
                                return `
                                  <tr class="oc-tenant-skill-assignment-row">
                                    <td colspan="6">
                                      <div class="oc-tenant-skill-template-editor">
                                        <strong>${escapeHtml(assignment.username || assignment.userId || assignmentId)}</strong>
                                        <div>${escapeHtml((assignment.resolvedSkillKeys || []).join(", ") || "-")}</div>
                                        <textarea
                                          class="field__control"
                                          rows="3"
                                          data-tenant-skill-override-editor="${escapeAttribute(assignmentId)}"
                                          placeholder="每行一个覆盖，如 force_add:C 或 force_remove:B"
                                        >${escapeHtml(
                                          overrideDraft
                                            .map((item) => `${item.action}:${item.skillKey}`)
                                            .join("\n"),
                                        )}</textarea>
                                        <div class="oc-tenant-table-actions">
                                          <button class="btn" type="button" data-tenant-skill-override-save="${escapeAttribute(assignmentId)}">保存成员覆盖</button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                `;
                              })
                              .join("")
                          : ""
                      }
                    `;
                  })
                  .join("")
              : `<tr><td colspan="6" class="oc-platform-table-empty">暂无 Skill 分配数据</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

export function renderTenantConsole(root, controller) {
  const focusState = captureRenderFocusState(root);
  const isUsageStats = controller.section === "usage-stats";
  const isOverview = controller.section === "statistics-overview";
  const isWallet = controller.section === "wallet";
  const isWalletOrders = controller.section === "wallet-orders";
  const isWalletLedger = controller.section === "wallet-ledger";
  const isWalletFlow = controller.section === "wallet-flow";
  const isOwnedAgents = controller.section === "owned-agents";
  const isSkillsMarket = controller.section === "skills-market";
  const isSkillsEntitlements = controller.section === "skills-entitlements";
  const isSkillsAssignments = controller.section === "skills-assignments";

  if (controller.section === "agent-assignment") {
    pruneRevokeAssignmentSelection(controller);
    pruneAssignAgentSelection(controller);
  }

  if (!isOverview) {
    disposeTenantOverviewCharts(root);
  }

  const pagination =
    isUsageStats ||
    isOverview ||
    isWallet ||
    isWalletOrders ||
    isWalletLedger ||
    isWalletFlow ||
    isSkillsMarket ||
    isSkillsEntitlements ||
    isSkillsAssignments
      ? null
      : paginate(
          isOwnedAgents ? filterTenantAgents(controller) : filterMembers(controller),
          getPageValue(controller),
        );
  if (pagination) {
    setPageValue(controller, pagination.page);
  }

  const contentMarkup = isUsageStats
    ? renderUsageList(controller, renderPagination)
    : isOverview
      ? renderTenantOverview(controller)
      : isSkillsMarket
        ? renderSkillsMarketTable(controller)
        : isSkillsEntitlements
          ? renderSkillsEntitlementsTable(controller)
          : isSkillsAssignments
            ? renderSkillsAssignmentsTable(controller)
            : isWallet
              ? renderTenantWalletPage(controller)
              : isWalletOrders
                ? renderWalletOrdersList(controller, renderPagination)
                : isWalletLedger
                  ? renderWalletLedgerList(controller, renderPagination)
                  : isWalletFlow
                    ? renderWalletFlowList(controller, renderPagination)
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
  root.dataset.ocTenantSection = controller.section;
  root.innerHTML = `
    <section class="oc-tenant-list-view ${isUsageStats || isOverview || isWallet || isWalletOrders || isWalletLedger || isWalletFlow || isSkillsMarket || isSkillsEntitlements || isSkillsAssignments ? "oc-tenant-list-view--scrollable" : ""}">
      ${renderToolbar(controller)}
      ${contentMarkup}
    </section>
    ${
      isUsageStats ||
      isOverview ||
      isWallet ||
      isWalletOrders ||
      isWalletLedger ||
      isWalletFlow ||
      isSkillsMarket ||
      isSkillsEntitlements ||
      isSkillsAssignments
        ? ""
        : isOwnedAgents
          ? `${renderAgentDetailDialog(controller)}${renderAgentTransferDialog(controller)}`
          : `${renderCreateMemberDialog()}${renderChangePasswordDialog(controller)}${renderDeleteMemberDialog(controller)}${renderMemberOrgScopeDialog(controller)}${renderAssignDialog(controller, isLocalEdition)}${renderRevokeAssignmentDialog(controller)}${renderRevokeAssignmentConfirmDialog(controller)}`
    }
  `;

  if (isOverview) {
    void initTenantOverviewCharts(root, controller);
  }

  if (
    !isUsageStats &&
    !isOverview &&
    !isWallet &&
    !isWalletOrders &&
    !isWalletLedger &&
    !isWalletFlow &&
    !isSkillsMarket &&
    !isSkillsEntitlements &&
    !isSkillsAssignments
  ) {
    if (isOwnedAgents && controller.agentDetailDialog?.open) {
      openDialog(root.querySelector("[data-tenant-agent-detail-dialog]"));
    }
    if (isOwnedAgents && controller.agentTransferDialog?.open) {
      openDialog(root.querySelector("[data-tenant-agent-transfer-dialog]"));
    }
    if (controller.dialogs.createMemberOpen) {
      openDialog(root.querySelector("[data-tenant-create-dialog]"));
    }
    if (controller.dialogs.changePasswordOpen) {
      openDialog(root.querySelector("[data-tenant-member-password-dialog]"));
    }
    if (controller.dialogs.deleteMemberOpen) {
      openDialog(root.querySelector("[data-tenant-member-delete-dialog]"));
    }
    if (controller.memberOrgScopeDialog?.open) {
      openDialog(root.querySelector("[data-tenant-member-org-scope-dialog]"));
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

export function clearTenantConsoleSelections(controller) {
  clearAssignAgentSelection(controller);
  clearRevokeAssignmentSelection(controller);
}
