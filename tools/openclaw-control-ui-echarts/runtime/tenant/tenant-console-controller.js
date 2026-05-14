import {
  createAgentDetailDialogState,
  createAgentTransferDialogState,
  createDeleteMemberDialogState,
} from "./tenant-console-dialogs.js";
import {
  createAssignAgentDialogState,
  createMemberOrgScopeDialogState,
  createRevokeAssignmentDialogState,
} from "./tenant-console-members.js";
import { TENANT_WALLET_SUMMARY_EVENT } from "./tenant-context.js";
import { refreshTenantOverview } from "./tenant-overview-page.js";

export const PAGE_SIZE = 8;
export const REMOTE_SEARCH_DEBOUNCE_MS = 250;

export function isLocalEdition(controller) {
  return controller?.session?.session?.edition === "local";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function formatDateTime(value) {
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

export function formatNumber(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? new Intl.NumberFormat("zh-CN").format(numeric) : "0";
}

export function formatCredits(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "0";
  }
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function isRemoteSearchSection(section) {
  return (
    section === "usage-stats" ||
    section === "skills-market" ||
    section === "skills-entitlements" ||
    section === "skills-assignments" ||
    section === "wallet-orders" ||
    section === "wallet-ledger" ||
    section === "wallet-flow"
  );
}

export function dispatchWalletSummary(summary) {
  window.dispatchEvent(
    new CustomEvent(TENANT_WALLET_SUMMARY_EVENT, {
      detail: {
        summary: summary && typeof summary === "object" ? summary : null,
      },
    }),
  );
}

export function createTenantConsoleControllerState(session, apiClient, stateFactories) {
  return {
    apiClient,
    session,
    section: "members",
    searchBySection: {
      members: "",
      "agent-assignment": "",
      "owned-agents": "",
      "usage-stats": "",
      "skills-market": "",
      "skills-entitlements": "",
      "skills-assignments": "",
      wallet: "",
      "wallet-orders": "",
      "wallet-ledger": "",
      "wallet-flow": "",
    },
    pageBySection: {
      members: 1,
      "agent-assignment": 1,
      "owned-agents": 1,
      "usage-stats": 1,
      "skills-market": 1,
      "skills-entitlements": 1,
      "skills-assignments": 1,
      wallet: 1,
      "wallet-orders": 1,
      "wallet-ledger": 1,
      "wallet-flow": 1,
    },
    members: [],
    currentDataSourceBinding: null,
    tenantAgents: [],
    skillsMarketItems: [],
    skillsEntitlementItems: [],
    skillsAssignmentItems: [],
    skillsTemplateDrafts: new Map(),
    skillsOverrideDrafts: new Map(),
    skillsBusyKeys: new Set(),
    busyMemberStatusIds: new Set(),
    pendingMemberStatuses: new Map(),
    walletData: null,
    walletSummary: null,
    walletActiveOrder: null,
    walletActiveOrderId: "",
    walletOrdersItems: [],
    walletOrdersTotal: 0,
    walletOrdersPageSize: PAGE_SIZE,
    walletLedgerItems: [],
    walletLedgerTotal: 0,
    walletLedgerPageSize: PAGE_SIZE,
    walletFlowItems: [],
    walletFlowTotal: 0,
    walletFlowPageSize: PAGE_SIZE,
    agentDetailDialog: stateFactories.createAgentDetailDialogState(),
    agentTransferDialog: stateFactories.createAgentTransferDialogState(),
    activeMember: null,
    assignAgentDialog: stateFactories.createAssignAgentDialogState(),
    memberOrgScopeDialog: stateFactories.createMemberOrgScopeDialogState(),
    passwordMember: null,
    deleteMemberTarget: stateFactories.createDeleteMemberDialogState(),
    revokeAssignmentDialog: stateFactories.createRevokeAssignmentDialogState(),
    usageItems: [],
    usageTotal: 0,
    usagePageSize: PAGE_SIZE,
    remoteSearchTimer: null,
    dialogs: {
      createMemberOpen: false,
      assignOpen: false,
      changePasswordOpen: false,
      deleteMemberOpen: false,
    },
  };
}

export function getSearchValue(controller) {
  return controller.searchBySection[controller.section] || "";
}

export function getPageValue(controller) {
  return controller.pageBySection[controller.section] || 1;
}

export function setPageValue(controller, page) {
  controller.pageBySection[controller.section] = Math.max(1, page);
}

export function filterMembers(controller) {
  const query = getSearchValue(controller).trim().toLowerCase();
  if (!query) {
    return controller.members;
  }
  return controller.members.filter((member) =>
    [member.username, member.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
}

export function paginate(items, page) {
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

export function totalUsagePages(controller) {
  return Math.max(
    1,
    Math.ceil((Number(controller.usageTotal || 0) || 0) / (controller.usagePageSize || PAGE_SIZE)),
  );
}

export function ensureTenantConsoleController(root, session, apiClient, stateFactories) {
  if (root.__ocTenantConsoleController) {
    root.__ocTenantConsoleController.session = session;
    return root.__ocTenantConsoleController;
  }
  const controller = createTenantConsoleControllerState(session, apiClient, stateFactories);
  root.__ocTenantConsoleController = controller;
  return controller;
}

export async function refreshTenantConsole(root, controller, helpers) {
  if (controller.section === "wallet") {
    controller.walletData = await controller.apiClient.getTenantWallet();
    controller.walletSummary = controller.walletData?.summary || null;
    dispatchWalletSummary(controller.walletSummary);
    if (controller.walletActiveOrderId) {
      const matchedOrder = (
        Array.isArray(controller.walletData?.orders) ? controller.walletData.orders : []
      ).find((order) => String(order?.id || "").trim() === controller.walletActiveOrderId);
      if (matchedOrder) {
        controller.walletActiveOrder = matchedOrder;
      } else {
        controller.walletActiveOrder = null;
        controller.walletActiveOrderId = "";
      }
    }
    helpers.render(root, controller);
    return;
  }

  if (controller.section === "wallet-orders") {
    const search = getSearchValue(controller).trim();
    const page = getPageValue(controller);
    const data = await controller.apiClient.listTenantPaymentOrders({
      page,
      pageSize: controller.walletOrdersPageSize || PAGE_SIZE,
      search,
    });
    controller.walletOrdersItems = Array.isArray(data?.items) ? data.items : [];
    controller.walletOrdersTotal = Number(data?.total || 0);
    controller.walletOrdersPageSize =
      Number(data?.pageSize || controller.walletOrdersPageSize || PAGE_SIZE) || PAGE_SIZE;
    const currentPage = Number(data?.page || page) || 1;
    const totalPages = helpers.totalWalletOrdersPages(controller);
    if (controller.walletActiveOrderId) {
      const matchedOrder = helpers.findWalletOrderById(controller, controller.walletActiveOrderId);
      if (matchedOrder) {
        controller.walletActiveOrder = matchedOrder;
      }
    }
    controller.pageBySection["wallet-orders"] = Math.min(Math.max(1, currentPage), totalPages);
    if (controller.pageBySection["wallet-orders"] !== currentPage) {
      return refreshTenantConsole(root, controller, helpers);
    }
    helpers.render(root, controller);
    return;
  }

  if (controller.section === "wallet-ledger") {
    const search = getSearchValue(controller).trim();
    const page = getPageValue(controller);
    const data = await controller.apiClient.listTenantWalletLedger({
      page,
      pageSize: controller.walletLedgerPageSize || PAGE_SIZE,
      search,
    });
    controller.walletLedgerItems = Array.isArray(data?.items) ? data.items : [];
    controller.walletLedgerTotal = Number(data?.total || 0);
    controller.walletLedgerPageSize =
      Number(data?.pageSize || controller.walletLedgerPageSize || PAGE_SIZE) || PAGE_SIZE;
    const currentPage = Number(data?.page || page) || 1;
    const totalPages = helpers.totalWalletLedgerPages(controller);
    controller.pageBySection["wallet-ledger"] = Math.min(Math.max(1, currentPage), totalPages);
    if (controller.pageBySection["wallet-ledger"] !== currentPage) {
      return refreshTenantConsole(root, controller, helpers);
    }
    helpers.render(root, controller);
    return;
  }

  if (controller.section === "wallet-flow") {
    const search = getSearchValue(controller).trim();
    const page = getPageValue(controller);
    const data = await controller.apiClient.listTenantWalletFlow({
      page,
      pageSize: controller.walletFlowPageSize || PAGE_SIZE,
      search,
    });
    controller.walletFlowItems = Array.isArray(data?.items) ? data.items : [];
    controller.walletFlowTotal = Number(data?.total || 0);
    controller.walletFlowPageSize =
      Number(data?.pageSize || controller.walletFlowPageSize || PAGE_SIZE) || PAGE_SIZE;
    const currentPage = Number(data?.page || page) || 1;
    const totalPages = helpers.totalWalletFlowPages(controller);
    controller.pageBySection["wallet-flow"] = Math.min(Math.max(1, currentPage), totalPages);
    if (controller.pageBySection["wallet-flow"] !== currentPage) {
      return refreshTenantConsole(root, controller, helpers);
    }
    helpers.render(root, controller);
    return;
  }

  if (controller.section === "usage-stats") {
    const search = getSearchValue(controller).trim();
    const page = getPageValue(controller);
    const data = await controller.apiClient.listTenantUsageStats({
      page,
      pageSize: controller.usagePageSize || PAGE_SIZE,
      search,
    });
    controller.usageItems = Array.isArray(data?.items) ? data.items : [];
    controller.usageTotal = Number(data?.total || 0);
    controller.usagePageSize =
      Number(data?.pageSize || controller.usagePageSize || PAGE_SIZE) || PAGE_SIZE;
    const currentPage = Number(data?.page || page) || 1;
    const totalPages = helpers.totalUsagePages(controller);
    controller.pageBySection["usage-stats"] = Math.min(Math.max(1, currentPage), totalPages);
    if (controller.pageBySection["usage-stats"] !== currentPage) {
      return refreshTenantConsole(root, controller, helpers);
    }
    helpers.render(root, controller);
    return;
  }

  if (controller.section === "statistics-overview") {
    await refreshTenantOverview(root, controller);
    helpers.render(root, controller);
    return;
  }

  if (controller.section === "owned-agents") {
    const [tenantAgents, walletData] = await Promise.all([
      controller.apiClient.listTenantAgents(),
      isLocalEdition(controller) ? Promise.resolve(null) : controller.apiClient.getTenantWallet(),
    ]);
    controller.tenantAgents = tenantAgents;
    controller.walletSummary = walletData?.summary || null;
    if (controller.walletSummary) {
      dispatchWalletSummary(controller.walletSummary);
    }
    helpers.render(root, controller);
    return;
  }

  if (controller.section === "skills-market") {
    controller.skillsMarketItems = await controller.apiClient.listTenantSkillsMarket();
    helpers.render(root, controller);
    return;
  }

  if (controller.section === "skills-entitlements") {
    controller.skillsEntitlementItems = await controller.apiClient.listTenantSkillEntitlements();
    helpers.render(root, controller);
    return;
  }

  if (controller.section === "skills-assignments") {
    controller.skillsAssignmentItems = await controller.apiClient.listTenantSkillAssignments();
    helpers.render(root, controller);
    return;
  }

  const [members, tenantAgents, binding] = await Promise.all([
    controller.apiClient.listTenantMembers(),
    controller.apiClient.listTenantAgents(),
    controller.section === "members"
      ? controller.apiClient.getCurrentTenantDataSourceBinding()
      : Promise.resolve(controller.currentDataSourceBinding),
  ]);
  controller.members = members;
  controller.tenantAgents = tenantAgents;
  controller.currentDataSourceBinding = binding && typeof binding === "object" ? binding : null;
  if (
    controller.activeMember &&
    !members.some((member) => member.id === controller.activeMember.id)
  ) {
    controller.activeMember = null;
  }
  if (
    controller.deleteMemberTarget?.id &&
    !members.some((member) => member.id === controller.deleteMemberTarget.id)
  ) {
    controller.dialogs.deleteMemberOpen = false;
    controller.deleteMemberTarget = createDeleteMemberDialogState();
  }
  if (
    controller.memberOrgScopeDialog?.memberId &&
    !members.some((member) => member.id === controller.memberOrgScopeDialog.memberId)
  ) {
    controller.memberOrgScopeDialog = createMemberOrgScopeDialogState();
  }
  helpers.render(root, controller);
}

export function resetTenantSectionState(controller, previousSection, stateFactories) {
  if (previousSection !== controller.section || controller.section !== "agent-assignment") {
    controller.revokeAssignmentDialog = stateFactories.createRevokeAssignmentDialogState();
  }
  if (previousSection !== controller.section && controller.remoteSearchTimer) {
    window.clearTimeout(controller.remoteSearchTimer);
    controller.remoteSearchTimer = null;
  }
  if (controller.section !== "members") {
    controller.dialogs.createMemberOpen = false;
    controller.dialogs.changePasswordOpen = false;
    controller.dialogs.deleteMemberOpen = false;
    controller.passwordMember = null;
    controller.deleteMemberTarget = stateFactories.createDeleteMemberDialogState();
  }
  if (controller.section !== "owned-agents") {
    controller.agentDetailDialog = stateFactories.createAgentDetailDialogState();
    controller.agentTransferDialog = stateFactories.createAgentTransferDialogState();
  }
  if (controller.section !== "agent-assignment") {
    controller.dialogs.assignOpen = false;
    controller.activeMember = null;
    controller.assignAgentDialog = stateFactories.createAssignAgentDialogState();
    controller.revokeAssignmentDialog = stateFactories.createRevokeAssignmentDialogState();
  }
  if (
    controller.section === "usage-stats" ||
    controller.section === "wallet" ||
    controller.section === "wallet-orders" ||
    controller.section === "wallet-ledger" ||
    controller.section === "wallet-flow"
  ) {
    controller.dialogs.createMemberOpen = false;
    controller.dialogs.assignOpen = false;
    controller.dialogs.changePasswordOpen = false;
    controller.dialogs.deleteMemberOpen = false;
    controller.passwordMember = null;
    controller.deleteMemberTarget = stateFactories.createDeleteMemberDialogState();
    controller.agentDetailDialog = stateFactories.createAgentDetailDialogState();
    controller.agentTransferDialog = stateFactories.createAgentTransferDialogState();
    controller.activeMember = null;
    controller.assignAgentDialog = stateFactories.createAssignAgentDialogState();
    controller.revokeAssignmentDialog = stateFactories.createRevokeAssignmentDialogState();
  }
}

export const tenantConsoleStateFactories = {
  createAgentDetailDialogState,
  createAgentTransferDialogState,
  createDeleteMemberDialogState,
  createAssignAgentDialogState,
  createMemberOrgScopeDialogState,
  createRevokeAssignmentDialogState,
};
