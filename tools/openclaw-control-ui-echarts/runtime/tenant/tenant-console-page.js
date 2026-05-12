import { createTenantApiClient } from "./api-client.js";
import { TENANT_LOGIN_ROUTE, requireTenantSession } from "./tenant-context.js";
import {
  PAGE_SIZE,
  REMOTE_SEARCH_DEBOUNCE_MS,
  dispatchWalletSummary,
  ensureTenantConsoleController,
  formatNumber,
  getPageValue,
  isRemoteSearchSection,
  refreshTenantConsole,
  resetTenantSectionState,
  setPageValue,
  tenantConsoleStateFactories,
} from "./tenant-console-controller.js";
import {
  closeDialog,
  createAgentTransferDialogState,
  dismissTenantDialog,
  handleTenantDialogClosed,
  setFeedback,
} from "./tenant-console-dialogs.js";
import { renderTenantConsole } from "./tenant-console-render.js";
import {
  clearAssignAgentSelection,
  clearRevokeAssignmentSelection,
  createAssignAgentDialogState,
  createMemberOrgScopeDialogState,
  createRevokeAssignmentDialogState,
  getAssignAgentDialog,
  getMemberOrgScopeDialog,
  getRevokeAssignmentDialog,
  getRevokeAssignmentSelectableAssignments,
  getVisibleMemberOrgScopeOrgs,
  normalizeMemberOrgScopeMode,
  openAssignAgentDialog,
  openDeleteMemberDialog,
  openMemberOrgScopeDialog,
  openRevokeAssignmentConfirmDialog,
  openRevokeAssignmentDialog,
  revokeSelectedAssignments,
  setAssignAgentSelected,
  setMemberOrgScopeMode,
  setMemberOrgScopeSelected,
  setRevokeAssignmentSelected,
  totalUsagePages,
  updateMemberStatus,
} from "./tenant-console-members.js";
import {
  findWalletOrderById,
  openAgentTransferDialog,
  queryWalletOrderStatus,
  totalWalletFlowPages,
  totalWalletLedgerPages,
  totalWalletOrdersPages,
} from "./tenant-console-wallet.js";

function render(root, controller) {
  renderTenantConsole(root, controller);
}

const runtimeHelpers = {
  render,
  dispatchWalletSummary: null,
  totalWalletOrdersPages: null,
  totalWalletLedgerPages: null,
  totalWalletFlowPages: null,
  totalUsagePages: null,
  findWalletOrderById,
};

const memberHelpers = {
  render,
  refresh,
  createAssignAgentDialogState,
  createMemberOrgScopeDialogState,
  createRevokeAssignmentDialogState,
};

const dialogHelpers = {
  render,
  createAssignAgentDialogState,
  createMemberOrgScopeDialogState,
  createRevokeAssignmentDialogState,
};

const walletHelpers = {
  render,
  refresh,
  dispatchWalletSummary: (summary) => runtimeHelpers.dispatchWalletSummary(summary),
};

function ensureController(root, session, apiClient) {
  const controller = ensureTenantConsoleController(
    root,
    session,
    apiClient,
    tenantConsoleStateFactories,
  );
  if (controller.__ocTenantConsolePageHandlersBound) {
    return controller;
  }

  controller.__ocTenantConsolePageHandlersBound = true;
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
    handleTenantDialogClosed(controller, event.target, tenantConsoleStateFactories);
  });

  return controller;
}

async function refresh(root, controller) {
  await refreshTenantConsole(root, controller, runtimeHelpers);
}

function clearSelectionForToggle(controller, target, entries, clearSelection, setSelected) {
  const selected = target.checked;
  clearSelection(controller);
  if (selected) {
    for (const entry of entries) {
      setSelected(controller, entry, true);
    }
  }
}

async function handleClick(root, controller, event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const walletRefreshTrigger = target.closest("[data-tenant-wallet-refresh]");
  if (walletRefreshTrigger instanceof HTMLElement) {
    await refresh(root, controller);
    setFeedback(root, "钱包数据已刷新。");
    return;
  }

  const showQrTrigger = target.closest("[data-tenant-wallet-show-qr]");
  if (showQrTrigger instanceof HTMLElement) {
    const orderId = String(showQrTrigger.dataset.tenantWalletShowQr || "").trim();
    const matchedOrder = findWalletOrderById(controller, orderId);
    if (matchedOrder) {
      controller.walletActiveOrder = matchedOrder;
      controller.walletActiveOrderId = orderId;
      render(root, controller);
    }
    return;
  }

  const queryOrderTrigger = target.closest("[data-tenant-wallet-query-order]");
  if (queryOrderTrigger instanceof HTMLElement) {
    void queryWalletOrderStatus(
      root,
      controller,
      queryOrderTrigger.dataset.tenantWalletQueryOrder,
      walletHelpers,
    );
    return;
  }

  const paginationButton = target.closest("[data-tenant-page]");
  if (paginationButton instanceof HTMLElement) {
    const action = paginationButton.dataset.tenantPage;
    const currentPage = getPageValue(controller);
    setPageValue(controller, action === "next" ? currentPage + 1 : currentPage - 1);
    if (isRemoteSearchSection(controller.section)) {
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
      memberHelpers,
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

  const agentTransferTrigger = target.closest("[data-tenant-open-agent-transfer]");
  if (agentTransferTrigger instanceof HTMLElement) {
    openAgentTransferDialog(
      root,
      controller,
      agentTransferTrigger.dataset.tenantOpenAgentTransfer,
      walletHelpers,
    );
    return;
  }

  const passwordTrigger = target.closest("[data-tenant-open-member-password]");
  if (passwordTrigger instanceof HTMLElement) {
    controller.passwordMember =
      controller.members.find(
        (member) =>
          String(member?.id || "").trim() ===
          String(passwordTrigger.dataset.tenantOpenMemberPassword || "").trim(),
      ) || null;
    if (!controller.passwordMember) {
      return;
    }
    controller.dialogs.changePasswordOpen = true;
    render(root, controller);
    return;
  }

  const deleteTrigger = target.closest("[data-tenant-open-member-delete]");
  if (deleteTrigger instanceof HTMLElement) {
    openDeleteMemberDialog(
      root,
      controller,
      deleteTrigger.dataset.tenantOpenMemberDelete,
      memberHelpers,
    );
    return;
  }

  const closeDialogTrigger = target.closest("[data-tenant-close-dialog]");
  if (closeDialogTrigger instanceof HTMLElement) {
    dismissTenantDialog(
      root,
      controller,
      closeDialogTrigger.dataset.tenantCloseDialog || "",
      dialogHelpers,
    );
    return;
  }

  const assignTrigger = target.closest("[data-tenant-open-assign]");
  if (assignTrigger instanceof HTMLElement) {
    await openAssignAgentDialog(
      root,
      controller,
      assignTrigger.dataset.tenantOpenAssign,
      memberHelpers,
    );
    return;
  }

  const revokeTrigger = target.closest("[data-tenant-revoke-assignment]");
  if (revokeTrigger instanceof HTMLElement) {
    await openRevokeAssignmentDialog(
      root,
      controller,
      revokeTrigger.dataset.tenantRevokeAssignment,
      memberHelpers,
    );
  }
}

function handleInput(root, controller, event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.hasAttribute("data-tenant-member-status-toggle")) {
    void updateMemberStatus(root, controller, target, memberHelpers);
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
    for (const org of getVisibleMemberOrgScopeOrgs(dialog)) {
      setMemberOrgScopeSelected(controller, org.orgId, target.checked);
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
    clearSelectionForToggle(
      controller,
      target,
      getRevokeAssignmentSelectableAssignments(dialog).map((assignment) => assignment.assignmentId),
      clearRevokeAssignmentSelection,
      setRevokeAssignmentSelected,
    );
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
    clearSelectionForToggle(
      controller,
      target,
      dialog.agents
        .filter((agent) => {
          const agentId = String(agent?.id || "").trim();
          return Boolean(agentId) && !dialog.assignedAgentIds.has(agentId);
        })
        .map((agent) => agent.id),
      clearAssignAgentSelection,
      setAssignAgentSelected,
    );
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
    if (isRemoteSearchSection(controller.section)) {
      if (controller.remoteSearchTimer) {
        window.clearTimeout(controller.remoteSearchTimer);
      }
      controller.remoteSearchTimer = window.setTimeout(() => {
        controller.remoteSearchTimer = null;
        void refresh(root, controller);
      }, REMOTE_SEARCH_DEBOUNCE_MS);
      return;
    }
    render(root, controller);
  }
}

async function handleSubmit(root, controller, event) {
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) {
    return;
  }

  if (target.matches("[data-tenant-wallet-recharge-form]")) {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(target).entries());
      const result = await controller.apiClient.createTenantPaymentOrder(payload);
      controller.walletActiveOrder = result || null;
      controller.walletActiveOrderId = String(result?.id || "").trim();
      await refresh(root, controller);
      setFeedback(root, `充值订单 ${String(result?.id || "").trim()} 已创建，请直接扫码支付。`);
      target.reset();
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
    return;
  }

  if (target.matches("[data-tenant-agent-transfer-form]")) {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(target).entries());
      const result = await controller.apiClient.transferTenantWalletToAgent(payload);
      controller.agentTransferDialog = createAgentTransferDialogState();
      await refresh(root, controller);
      setFeedback(
        root,
        `已划转 ${formatNumber(result?.amountPoints)} 积分，钱包余额 ${formatNumber(result?.walletBalance)}。`,
      );
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
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
      dialog.orgs
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
        String(
          result?.username || controller.deleteMemberTarget?.username || payload.userId || "",
        ).trim() || "该成员";
      const revokedAssignmentCount = Number(result?.revokedAssignmentCount || 0);
      controller.dialogs.deleteMemberOpen = false;
      controller.deleteMemberTarget = tenantConsoleStateFactories.createDeleteMemberDialogState();
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
    const selectedAgentIds = Array.from(dialog.selectedAgentIds).filter(Boolean);
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
    await openRevokeAssignmentConfirmDialog(root, controller, memberHelpers);
    return;
  }

  if (target.matches("[data-tenant-revoke-confirm-form]")) {
    event.preventDefault();
    await revokeSelectedAssignments(root, controller, memberHelpers);
  }
}

runtimeHelpers.dispatchWalletSummary = tenantConsoleStateFactories
  ? dispatchWalletSummary
  : null;
runtimeHelpers.totalWalletOrdersPages = totalWalletOrdersPages;
runtimeHelpers.totalWalletLedgerPages = totalWalletLedgerPages;
runtimeHelpers.totalWalletFlowPages = totalWalletFlowPages;
runtimeHelpers.totalUsagePages = totalUsagePages;

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
  resetTenantSectionState(controller, previousSection, tenantConsoleStateFactories);
  await refresh(root, controller);
  return { root, controller, pageSize: PAGE_SIZE };
}
