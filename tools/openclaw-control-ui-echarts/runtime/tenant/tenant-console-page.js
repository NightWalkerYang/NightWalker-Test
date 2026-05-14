import { createTenantApiClient } from "./api-client.js";
import { TENANT_LOGIN_ROUTE, requireTenantSession } from "./tenant-context.js";
import {
  PAGE_SIZE,
  dispatchWalletSummary,
  ensureTenantConsoleController,
  refreshTenantConsole,
  resetTenantSectionState,
  tenantConsoleStateFactories,
} from "./tenant-console-controller.js";
import {
  handleTenantDialogClosed,
} from "./tenant-console-dialogs.js";
import { renderTenantConsole } from "./tenant-console-render.js";
import {
  clearRevokeAssignmentSelection,
} from "./tenant-console-members.js";
import {
  findWalletOrderById,
  totalWalletFlowPages,
  totalWalletLedgerPages,
  totalWalletOrdersPages,
} from "./tenant-console-wallet.js";
import {
  totalUsagePages,
} from "./tenant-console-usage.js";
import {
  createTenantConsoleEventHandlers,
} from "./tenant-console-events.js";

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

const tenantConsoleEventHandlers = createTenantConsoleEventHandlers({ render, refresh });

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
    void tenantConsoleEventHandlers.handleClick(root, controller, event);
  });
  root.addEventListener("input", (event) => {
    tenantConsoleEventHandlers.handleInput(root, controller, event);
  });
  root.addEventListener("change", (event) => {
    tenantConsoleEventHandlers.handleChange(root, controller, event);
  });
  root.addEventListener("submit", (event) => {
    void tenantConsoleEventHandlers.handleSubmit(root, controller, event);
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
