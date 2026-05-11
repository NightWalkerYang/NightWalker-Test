import {
  BODY_SECTION_ATTR,
  filterTenants,
  getPageValue,
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
  pruneAssignTenantAgentSelection,
  pruneRevokeTenantAgentSelection,
  renderAgentAssignmentTable,
  renderAssignDialog,
  renderCreateDialog,
  renderLocalLicenseDialog,
  renderMemberLimitDialog,
  renderPagination,
  renderRateDialog,
  renderRevokeTenantAgentConfirmDialog,
  renderRevokeTenantAgentDialog,
  renderTenantManagementTable,
  renderToolbar,
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
                : renderTenantManagementTable(controller, pagination.items, helpers.bindingByTenantId)
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
