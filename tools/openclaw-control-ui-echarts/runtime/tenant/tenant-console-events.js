import { openAgentTransferDialog } from "./tenant-console-agents.js";
import {
  REMOTE_SEARCH_DEBOUNCE_MS,
  dispatchWalletSummary,
  formatNumber,
  getPageValue,
  isRemoteSearchSection,
  setPageValue,
  tenantConsoleStateFactories,
} from "./tenant-console-controller.js";
import {
  closeDialog,
  createAgentTransferDialogState,
  dismissTenantDialog,
  setFeedback,
} from "./tenant-console-dialogs.js";
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
  updateMemberStatus,
} from "./tenant-console-members.js";
import { findWalletOrderById, queryWalletOrderStatus } from "./tenant-console-wallet.js";

function clearSelectionForToggle(controller, target, entries, clearSelection, setSelected) {
  const selected = target.checked;
  clearSelection(controller);
  if (!selected) {
    return;
  }
  for (const entry of entries) {
    setSelected(controller, entry, true);
  }
}

function openPasswordDialog(root, controller, memberId, render) {
  controller.passwordMember =
    controller.members.find(
      (member) => String(member?.id || "").trim() === String(memberId || "").trim(),
    ) || null;
  if (!controller.passwordMember) {
    return;
  }
  controller.dialogs.changePasswordOpen = true;
  render(root, controller);
}

function openAgentDetailDialog(root, controller, agentId, render) {
  controller.agentDetailDialog = {
    open: true,
    agentId: String(agentId || "").trim(),
  };
  render(root, controller);
}

async function submitWalletRecharge(root, controller, target, refresh) {
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
}

async function submitAgentTransfer(root, controller, target, refresh) {
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
}

async function submitCreateMember(root, controller, target, refresh) {
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
}

async function submitChangePassword(root, controller, target, refresh) {
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
}

async function submitMemberOrgScope(root, controller, refresh, render) {
  const dialog = getMemberOrgScopeDialog(controller);
  if (!dialog.open || dialog.loading || dialog.busy) {
    return;
  }
  const scopeMode = normalizeMemberOrgScopeMode(dialog.scopeMode);
  const selectableOrgIds = new Set(
    dialog.orgs.map((org) => String(org?.orgId || "").trim()).filter(Boolean),
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
}

async function submitDeleteMember(root, controller, target, refresh) {
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
}

async function submitAssignAgents(root, controller, refresh, render) {
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
      setFeedback(
        root,
        `已为成员“${memberLabel}”分配 ${formatNumber(assignedAgentCount)} 个 Agent。`,
      );
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
}

function parseSkillOverrideEditorValue(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .map((line) => {
      const [action, skillKey] = line.split(":");
      return {
        action: String(action || "").trim(),
        skillKey: String(skillKey || "").trim(),
      };
    })
    .filter((entry) => entry.action && entry.skillKey);
}

export function createTenantConsoleEventHandlers({ render, refresh }) {
  const memberDialogFactories = {
    createAssignAgentDialogState,
    createMemberOrgScopeDialogState,
    createRevokeAssignmentDialogState,
  };

  return {
    async handleClick(root, controller, event) {
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
          {
            refresh,
            dispatchWalletSummary,
          },
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
          { render },
        );
        return;
      }

      const agentDetailTrigger = target.closest("[data-tenant-open-agent-detail]");
      if (agentDetailTrigger instanceof HTMLElement) {
        openAgentDetailDialog(
          root,
          controller,
          agentDetailTrigger.dataset.tenantOpenAgentDetail,
          render,
        );
        return;
      }

      const agentTransferTrigger = target.closest("[data-tenant-open-agent-transfer]");
      if (agentTransferTrigger instanceof HTMLElement) {
        openAgentTransferDialog(
          root,
          controller,
          agentTransferTrigger.dataset.tenantOpenAgentTransfer,
          render,
        );
        return;
      }

      const passwordTrigger = target.closest("[data-tenant-open-member-password]");
      if (passwordTrigger instanceof HTMLElement) {
        openPasswordDialog(
          root,
          controller,
          passwordTrigger.dataset.tenantOpenMemberPassword,
          render,
        );
        return;
      }

      const deleteTrigger = target.closest("[data-tenant-open-member-delete]");
      if (deleteTrigger instanceof HTMLElement) {
        openDeleteMemberDialog(root, controller, deleteTrigger.dataset.tenantOpenMemberDelete, {
          render,
        });
        return;
      }

      const closeDialogTrigger = target.closest("[data-tenant-close-dialog]");
      if (closeDialogTrigger instanceof HTMLElement) {
        dismissTenantDialog(root, controller, closeDialogTrigger.dataset.tenantCloseDialog || "", {
          render,
          ...memberDialogFactories,
        });
        return;
      }

      const assignTrigger = target.closest("[data-tenant-open-assign]");
      if (assignTrigger instanceof HTMLElement) {
        await openAssignAgentDialog(root, controller, assignTrigger.dataset.tenantOpenAssign, {
          render,
        });
        return;
      }

      const revokeTrigger = target.closest("[data-tenant-revoke-assignment]");
      if (revokeTrigger instanceof HTMLElement) {
        await openRevokeAssignmentDialog(
          root,
          controller,
          revokeTrigger.dataset.tenantRevokeAssignment,
          { render },
        );
        return;
      }

      const orderTrigger = target.closest("[data-tenant-skill-order]");
      if (orderTrigger instanceof HTMLElement) {
        try {
          await controller.apiClient.createTenantSkillOrder({
            skillId: orderTrigger.dataset.tenantSkillOrder,
          });
          await refresh(root, controller);
          setFeedback(root, "Skill 订单已创建。");
        } catch (error) {
          setFeedback(root, error instanceof Error ? error.message : String(error), true);
        }
        return;
      }

      const confirmOrderTrigger = target.closest("[data-tenant-skill-confirm-order]");
      if (confirmOrderTrigger instanceof HTMLElement) {
        try {
          await controller.apiClient.confirmTenantSkillOrder(
            confirmOrderTrigger.dataset.tenantSkillConfirmOrder,
          );
          await refresh(root, controller);
          setFeedback(root, "Skill 订单已确认，钱包余额已更新。");
        } catch (error) {
          setFeedback(root, error instanceof Error ? error.message : String(error), true);
        }
        return;
      }

      const freeEnableTrigger = target.closest("[data-tenant-skill-free-enable]");
      if (freeEnableTrigger instanceof HTMLElement) {
        try {
          await controller.apiClient.createTenantSkillOrder({
            skillId: freeEnableTrigger.dataset.tenantSkillFreeEnable,
          });
          await refresh(root, controller);
          setFeedback(root, "免费 Skill 已启用。");
        } catch (error) {
          setFeedback(root, error instanceof Error ? error.message : String(error), true);
        }
        return;
      }

      const enableTrigger = target.closest("[data-tenant-skill-enable]");
      if (enableTrigger instanceof HTMLElement) {
        try {
          await controller.apiClient.enableTenantSkillEntitlement(
            enableTrigger.dataset.tenantSkillEnable,
          );
          await refresh(root, controller);
          setFeedback(root, "Skill 授权已启用。");
        } catch (error) {
          setFeedback(root, error instanceof Error ? error.message : String(error), true);
        }
        return;
      }

      const disableTrigger = target.closest("[data-tenant-skill-disable]");
      if (disableTrigger instanceof HTMLElement) {
        try {
          await controller.apiClient.disableTenantSkillEntitlement(
            disableTrigger.dataset.tenantSkillDisable,
          );
          await refresh(root, controller);
          setFeedback(root, "Skill 授权已停用。");
        } catch (error) {
          setFeedback(root, error instanceof Error ? error.message : String(error), true);
        }
        return;
      }

      const templateSaveTrigger = target.closest("[data-tenant-skill-template-save]");
      if (templateSaveTrigger instanceof HTMLElement) {
        const tenantAgentId = String(
          templateSaveTrigger.dataset.tenantSkillTemplateSave || "",
        ).trim();
        try {
          const skillKeys = Array.from(controller.skillsTemplateDrafts.get(tenantAgentId) || []);
          await controller.apiClient.saveTenantSkillTemplate({
            tenantAgentId,
            skillKeys,
          });
          await refresh(root, controller);
          setFeedback(root, "Tenant Agent 技能模板已保存。");
        } catch (error) {
          setFeedback(root, error instanceof Error ? error.message : String(error), true);
        }
        return;
      }

      const overrideSaveTrigger = target.closest("[data-tenant-skill-override-save]");
      if (overrideSaveTrigger instanceof HTMLElement) {
        const assignmentId = String(
          overrideSaveTrigger.dataset.tenantSkillOverrideSave || "",
        ).trim();
        const editor = root.querySelector(
          `[data-tenant-skill-override-editor="${CSS.escape(assignmentId)}"]`,
        );
        const overrides = parseSkillOverrideEditorValue(
          editor instanceof HTMLTextAreaElement ? editor.value : "",
        );
        try {
          await controller.apiClient.saveTenantSkillOverrides({
            assignmentId,
            overrides,
          });
          await refresh(root, controller);
          setFeedback(root, "成员技能覆盖已保存。");
        } catch (error) {
          setFeedback(root, error instanceof Error ? error.message : String(error), true);
        }
      }
    },

    handleInput(root, controller, event) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      if (target.hasAttribute("data-tenant-member-status-toggle")) {
        void updateMemberStatus(root, controller, target, { render, refresh });
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
          getRevokeAssignmentSelectableAssignments(dialog).map(
            (assignment) => assignment.assignmentId,
          ),
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
        setAssignAgentSelected(controller, target.dataset.tenantAssignAgentSelect, target.checked);
        render(root, controller);
        return;
      }
      if (target.hasAttribute("data-tenant-skill-template-toggle")) {
        const tenantAgentId = String(target.dataset.tenantSkillTemplateToggle || "").trim();
        const skillKey = String(target.dataset.tenantSkillKey || "").trim();
        const current = new Set(controller.skillsTemplateDrafts.get(tenantAgentId) || []);
        if (target.checked) {
          current.add(skillKey);
        } else {
          current.delete(skillKey);
        }
        controller.skillsTemplateDrafts.set(tenantAgentId, [...current]);
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
    },

    async handleSubmit(root, controller, event) {
      const target = event.target;
      if (!(target instanceof HTMLFormElement)) {
        return;
      }

      if (target.matches("[data-tenant-wallet-recharge-form]")) {
        event.preventDefault();
        await submitWalletRecharge(root, controller, target, refresh);
        return;
      }

      if (target.matches("[data-tenant-agent-transfer-form]")) {
        event.preventDefault();
        await submitAgentTransfer(root, controller, target, refresh);
        return;
      }

      if (target.matches("[data-tenant-member-form]")) {
        event.preventDefault();
        await submitCreateMember(root, controller, target, refresh);
        return;
      }

      if (target.matches("[data-tenant-member-password-form]")) {
        event.preventDefault();
        await submitChangePassword(root, controller, target, refresh);
        return;
      }

      if (target.matches("[data-tenant-member-org-scope-form]")) {
        event.preventDefault();
        await submitMemberOrgScope(root, controller, refresh, render);
        return;
      }

      if (target.matches("[data-tenant-member-delete-form]")) {
        event.preventDefault();
        await submitDeleteMember(root, controller, target, refresh);
        return;
      }

      if (target.matches("[data-tenant-assignment-form]")) {
        event.preventDefault();
        await submitAssignAgents(root, controller, refresh, render);
        return;
      }

      if (target.matches("[data-tenant-revoke-assignment-form]")) {
        event.preventDefault();
        await openRevokeAssignmentConfirmDialog(root, controller, { render });
        return;
      }

      if (target.matches("[data-tenant-revoke-confirm-form]")) {
        event.preventDefault();
        await revokeSelectedAssignments(root, controller, { render, refresh });
      }
    },
  };
}
