import { showTransientFeedbackToast } from "./feedback-toast.js";

export function setFeedback(root, text, isError = false) {
  showTransientFeedbackToast(root, text, isError);
}

export function openDialog(dialog) {
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

export function closeDialog(dialog) {
  if (dialog instanceof HTMLDialogElement && dialog.open) {
    if (typeof dialog.close === "function") {
      dialog.close();
      return;
    }
    dialog.removeAttribute("open");
  }
}

export function createDeleteMemberDialogState() {
  return {
    id: "",
    username: "",
    assignedAgentCount: 0,
  };
}

export function getDeleteMemberTarget(controller) {
  if (!(controller?.deleteMemberTarget && typeof controller.deleteMemberTarget === "object")) {
    controller.deleteMemberTarget = createDeleteMemberDialogState();
  }
  return controller.deleteMemberTarget;
}

export function createAgentDetailDialogState() {
  return {
    open: false,
    agentId: "",
  };
}

export function createAgentTransferDialogState() {
  return {
    open: false,
    agentId: "",
  };
}

export function createSkillMarketDetailDialogState() {
  return {
    open: false,
    skillId: "",
  };
}

export function getAgentDetailDialog(controller) {
  if (!(controller?.agentDetailDialog && typeof controller.agentDetailDialog === "object")) {
    controller.agentDetailDialog = createAgentDetailDialogState();
  }
  return controller.agentDetailDialog;
}

export function getAgentTransferDialog(controller) {
  if (!(controller?.agentTransferDialog && typeof controller.agentTransferDialog === "object")) {
    controller.agentTransferDialog = createAgentTransferDialogState();
  }
  return controller.agentTransferDialog;
}

export function handleTenantDialogClosed(controller, dialogElement, stateFactories) {
  if (dialogElement.matches("[data-tenant-create-dialog]")) {
    controller.dialogs.createMemberOpen = false;
  }
  if (dialogElement.matches("[data-tenant-assign-dialog]")) {
    controller.dialogs.assignOpen = false;
    controller.assignAgentDialog = stateFactories.createAssignAgentDialogState();
  }
  if (dialogElement.matches("[data-tenant-member-org-scope-dialog]")) {
    controller.memberOrgScopeDialog = stateFactories.createMemberOrgScopeDialogState();
  }
  if (dialogElement.matches("[data-tenant-member-password-dialog]")) {
    controller.dialogs.changePasswordOpen = false;
    controller.passwordMember = null;
  }
  if (dialogElement.matches("[data-tenant-member-delete-dialog]")) {
    controller.dialogs.deleteMemberOpen = false;
    controller.deleteMemberTarget = createDeleteMemberDialogState();
  }
  if (dialogElement.matches("[data-tenant-agent-detail-dialog]")) {
    controller.agentDetailDialog = createAgentDetailDialogState();
  }
  if (dialogElement.matches("[data-tenant-agent-transfer-dialog]")) {
    controller.agentTransferDialog = createAgentTransferDialogState();
  }
  if (dialogElement.matches("[data-tenant-skill-market-detail-dialog]")) {
    controller.skillsMarketDetailDialog = createSkillMarketDetailDialogState();
  }
  if (dialogElement.matches("[data-tenant-revoke-assignment-dialog]")) {
    controller.revokeAssignmentDialog = stateFactories.createRevokeAssignmentDialogState();
  }
  if (dialogElement.matches("[data-tenant-revoke-confirm-dialog]")) {
    const dialog = controller.revokeAssignmentDialog;
    if (dialog && typeof dialog === "object") {
      dialog.confirmOpen = false;
      dialog.confirmSelectedAssignmentIds = [];
    }
  }
}

export function dismissTenantDialog(root, controller, dialogKind, helpers) {
  if (dialogKind === "create") {
    controller.dialogs.createMemberOpen = false;
    closeDialog(root.querySelector("[data-tenant-create-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "assign") {
    controller.dialogs.assignOpen = false;
    controller.activeMember = null;
    controller.assignAgentDialog = helpers.createAssignAgentDialogState();
    closeDialog(root.querySelector("[data-tenant-assign-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "org-scope") {
    controller.memberOrgScopeDialog = helpers.createMemberOrgScopeDialogState();
    closeDialog(root.querySelector("[data-tenant-member-org-scope-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "password") {
    controller.dialogs.changePasswordOpen = false;
    controller.passwordMember = null;
    closeDialog(root.querySelector("[data-tenant-member-password-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "delete-member") {
    controller.dialogs.deleteMemberOpen = false;
    controller.deleteMemberTarget = createDeleteMemberDialogState();
    closeDialog(root.querySelector("[data-tenant-member-delete-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "agent-detail") {
    controller.agentDetailDialog = createAgentDetailDialogState();
    closeDialog(root.querySelector("[data-tenant-agent-detail-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "transfer") {
    controller.agentTransferDialog = createAgentTransferDialogState();
    closeDialog(root.querySelector("[data-tenant-agent-transfer-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "skill-market-detail") {
    controller.skillsMarketDetailDialog = createSkillMarketDetailDialogState();
    closeDialog(root.querySelector("[data-tenant-skill-market-detail-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "revoke") {
    controller.revokeAssignmentDialog = helpers.createRevokeAssignmentDialogState();
    closeDialog(root.querySelector("[data-tenant-revoke-assignment-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "revoke-confirm") {
    const dialog = controller.revokeAssignmentDialog;
    if (dialog && typeof dialog === "object") {
      dialog.confirmOpen = false;
      dialog.confirmSelectedAssignmentIds = [];
    }
    closeDialog(root.querySelector("[data-tenant-revoke-confirm-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  return false;
}
