import { createTenantApiClient } from "./api-client.js";
import {
  createPlatformConsoleControllerState,
  isLocalEdition,
  refreshPlatformConsole,
  resetPlatformSectionState,
  tenantById,
  nodeById,
  updateSectionLinkState,
} from "./platform-console-controller.js";
import {
  bindingByTenantId,
  buildDataSourcePayloadFromDraft,
  createDataSourceCatalogDialogState,
  createDataSourceDialogState,
  createDataSourceDraft,
  createTenantDataSourceBindingDialogState,
  dataSourceById,
  describePlatformDataSourceError,
  getActiveDataSources,
  getDataSourceCatalogDialog,
  getDataSourceDisplayName,
  getTenantDataSourceBindingDialog,
  getTenantDisplayName,
  resolveDefaultBoundTenantId,
  syncDataSourceDraftTenant,
  tenantByDataSourceId,
} from "./platform-console-data-sources.js";
import {
  clearAssignTenantAgentSelection,
  clearRevokeTenantAgentSelection,
  closeDialog,
  createAssignTenantAgentDialogState,
  createRevokeTenantAgentDialogState,
  getAssignTenantAgentDialog,
  getAssignablePlatformCatalogAgents,
  getRevokeTenantAgentDialog,
  getRevokeTenantAgentSelectableAgents,
  openDialog,
  pruneAssignTenantAgentSelection,
  pruneRevokeTenantAgentSelection,
  setAssignTenantAgentSelected,
  setFeedback,
  setRevokeTenantAgentSelected,
} from "./platform-console-dialogs.js";
import {
  createBindNodeDialogState,
  createNodeDialogState,
  openBindNodeDialog,
  openCreateNodeDialog,
  openEditNodeDialog,
} from "./platform-console-nodes.js";
import {
  clearAllocationSelections,
  renderPlatformConsole,
} from "./platform-console-render.js";
import {
  PLATFORM_LOGIN_ROUTE,
  requireTenantSession,
} from "./tenant-context.js";

const PAGE_SELECTOR = "[data-oc-platform-tenant-console-page]";

function render(root, controller) {
  renderPlatformConsole(root, controller, {
    bindingByTenantId,
    openDialog,
  });
}

async function refresh(root, controller) {
  await refreshPlatformConsole(root, controller, {
    getDataSourceCatalogDialog,
    syncDataSourceDraftTenant,
    render,
  });
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
  if (!tenant || Number(tenant?.agentCount || 0) <= 0) {
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
            ? `已撤回租户“${tenantLabel}”的 ${revokedTenantAgentCount} 个 Agent，但列表刷新失败：${refreshError.message}`
            : `已撤回租户“${tenantLabel}”的 ${revokedTenantAgentCount} 个 Agent，但列表刷新失败。`,
          true,
        );
        return;
      }
      const successMessage =
        revokedAssignmentCount > 0
          ? `已撤回租户“${tenantLabel}”的 ${revokedTenantAgentCount} 个 Agent，并同步失效 ${revokedAssignmentCount} 条成员分配。`
          : `已撤回租户“${tenantLabel}”的 ${revokedTenantAgentCount} 个 Agent。`;
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
      controller.apiClient.listPlatformDataSources(),
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

function ensureController(root, session, apiClient) {
  if (root.__ocPlatformConsoleController) {
    root.__ocPlatformConsoleController.session = session;
    return root.__ocPlatformConsoleController;
  }

  const stateFactories = {
    createAssignTenantAgentDialogState,
    createRevokeTenantAgentDialogState,
    createDataSourceCatalogDialogState,
    createTenantDataSourceBindingDialogState,
    createDataSourceDialogState,
    createNodeDialogState,
    createBindNodeDialogState,
  };
  const controller = createPlatformConsoleControllerState(session, apiClient, stateFactories);
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

async function handleClick(root, controller, event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const paginationButton = target.closest("[data-platform-page]");
  if (paginationButton instanceof HTMLElement) {
    const action = paginationButton.dataset.platformPage;
    const page = controller.pageBySection[controller.section] || 1;
    controller.pageBySection[controller.section] = Math.max(1, action === "next" ? page + 1 : page - 1);
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

  const editDataSourceTrigger = target.closest("[data-platform-edit-data-source]");
  if (editDataSourceTrigger instanceof HTMLElement) {
    const dataSourceId = editDataSourceTrigger.dataset.platformEditDataSource || "";
    const current = dataSourceById(controller.dataSources, dataSourceId);
    if (!current) {
      setFeedback(root, "未找到数据源。", true);
      return;
    }
    const dialog = getDataSourceCatalogDialog(controller);
    dialog.open = true;
    dialog.busy = false;
    dialog.error = "";
    dialog.draft = createDataSourceDraft(
      current,
      resolveDefaultBoundTenantId(controller, editDataSourceTrigger.dataset.platformEditDataSource),
    );
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
    openCreateNodeDialog(root, controller, render);
    return;
  }

  const editNodeTrigger = target.closest("[data-platform-open-edit-node]");
  if (editNodeTrigger instanceof HTMLElement) {
    openEditNodeDialog(root, controller, nodeById(controller, editNodeTrigger.dataset.platformOpenEditNode || ""), {
      render,
      setFeedback,
    });
    return;
  }

  const bindNodeTrigger = target.closest("[data-platform-open-bind-node]");
  if (bindNodeTrigger instanceof HTMLElement) {
    openBindNodeDialog(root, controller, tenantById(controller, bindNodeTrigger.dataset.platformOpenBindNode || ""), {
      render,
      setFeedback,
    });
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
    controller.pageBySection[controller.section] = 1;
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
    dialog.draft = createDataSourceDraft(
      {
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
      },
      tenantId,
    );
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
      controller.dataSourceCatalogDialog = createDataSourceCatalogDialogState();
      await refresh(root, controller);
      if (!isUpdate) {
        setFeedback(
          root,
          `已创建数据源并绑定到租户“${getTenantDisplayName(tenantById(controller, tenantId))}”。`,
        );
      } else if (!currentBoundTenant?.id) {
        setFeedback(
          root,
          `数据源已更新，并已绑定到租户“${getTenantDisplayName(tenantById(controller, tenantId))}”。`,
        );
      } else {
        setFeedback(root, "数据源已更新。");
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
      await refresh(root, controller);
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
              ? `已向租户“${tenantLabel}”下发 ${assignedAgentCount} 个 Agent，但列表刷新失败：${refreshError.message}`
              : `已向租户“${tenantLabel}”下发 ${assignedAgentCount} 个 Agent，但列表刷新失败。`,
            true,
          );
          return;
        }
        setFeedback(root, `已向租户“${tenantLabel}”下发 ${assignedAgentCount} 个 Agent。`);
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
    clearAllocationSelections(controller);
  }
  resetPlatformSectionState(controller, {
    createAssignTenantAgentDialogState,
    createRevokeTenantAgentDialogState,
    createNodeDialogState,
    createBindNodeDialogState,
  });
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
