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
    section === "skills-workbench" ||
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
      "skills-workbench": "",
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
      "skills-workbench": 1,
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
    skillsWorkbenchState: null,
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

function getWorkbenchCardTitle(card) {
  return (
    String(card?.tenantAgent?.agentName || "").trim() ||
    String(card?.tenantAgent?.description || "").trim() ||
    String(card?.baseAgentId || "").trim() ||
    String(card?.tenantAgentId || "").trim() ||
    "未命名 Agent"
  );
}

function cardMatchesWorkbenchSearch(card, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  const skillValues = Array.isArray(card?.cardSkills)
    ? card.cardSkills.flatMap((skill) => [skill?.name, skill?.skillKey, skill?.description])
    : [];
  return [
    getWorkbenchCardTitle(card),
    card?.tenantAgent?.description,
    card?.baseAgentId,
    card?.tenantAgentId,
    ...(Array.isArray(card?.resolvedSkillKeys) ? card.resolvedSkillKeys : []),
    ...skillValues,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function memberMatchesWorkbenchSearch(member, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  return [member?.username, member?.status, member?.userId]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function getFallbackWorkbenchMarketStatus(classification, entitlement) {
  const normalizedClassification = String(classification || "").trim();
  const entitlementStatus = String(entitlement?.status || "").trim();
  if (normalizedClassification === "bundled") {
    return "无需购买";
  }
  if (normalizedClassification === "free") {
    return entitlement?.enabledByTenant ? "已启用" : "免费可启用";
  }
  if (!entitlement) {
    return "待下单";
  }
  if (entitlementStatus === "pending") {
    return "待确认";
  }
  if (entitlementStatus === "active" && entitlement?.enabledByTenant) {
    return "已启用";
  }
  if (entitlementStatus === "active") {
    return "已购买未启用";
  }
  if (entitlementStatus === "disabled") {
    return "已购买未启用";
  }
  return "未授权";
}

function buildWorkbenchDisplaySkill(params = {}) {
  const skillKey = String(params.skillKey || "").trim();
  const marketItem = params.marketItem && typeof params.marketItem === "object" ? params.marketItem : null;
  const templateRow =
    params.templateRow && typeof params.templateRow === "object" ? params.templateRow : null;
  const overrideRow =
    params.overrideRow && typeof params.overrideRow === "object" ? params.overrideRow : null;
  const entitlement =
    params.entitlement && typeof params.entitlement === "object" ? params.entitlement : null;
  const resolvedSkillKeys = params.resolvedSkillKeys instanceof Set ? params.resolvedSkillKeys : new Set();
  const templateEnabledSkillKeys =
    params.templateEnabledSkillKeys instanceof Set ? params.templateEnabledSkillKeys : new Set();
  const templateBlockedSkillKeys =
    params.templateBlockedSkillKeys instanceof Set ? params.templateBlockedSkillKeys : new Set();
  const classification =
    String(
      marketItem?.classification ||
        templateRow?.classification ||
        overrideRow?.classification ||
        entitlement?.classification ||
        "",
    ).trim() || "bundled";
  return {
    ...(marketItem || {}),
    skillId:
      String(
        marketItem?.skillId ||
          marketItem?.id ||
          templateRow?.skillId ||
          overrideRow?.skillId ||
          entitlement?.skillId ||
          "",
      ).trim() || null,
    skillKey,
    name:
      String(
        marketItem?.name ||
          templateRow?.name ||
          overrideRow?.name ||
          entitlement?.name ||
          skillKey ||
          "",
      ).trim() || skillKey,
    description:
      String(
        marketItem?.description ||
          templateRow?.description ||
          overrideRow?.description ||
          entitlement?.description ||
          "",
      ).trim(),
    classification,
    marketStatus:
      String(marketItem?.marketStatus || "").trim() ||
      getFallbackWorkbenchMarketStatus(classification, entitlement),
    latestVersionId:
      String(
        marketItem?.latestVersionId ||
          templateRow?.latestVersionId ||
          overrideRow?.latestVersionId ||
          entitlement?.latestVersionId ||
          "",
      ).trim() || null,
    currentVersionId:
      String(entitlement?.currentVersionId || marketItem?.currentVersionId || "").trim() || null,
    entitlement,
    templateRow,
    overrideRow,
    inResolvedSet: resolvedSkillKeys.has(skillKey),
    templateEnabled: templateEnabledSkillKeys.has(skillKey),
    templateBlocked: templateBlockedSkillKeys.has(skillKey),
    currentOverrideAction: String(overrideRow?.action || "").trim() || "",
    currentOverrideEnabled: String(overrideRow?.action || "").trim() === "force_add",
    currentOverrideRemoved: String(overrideRow?.action || "").trim() === "force_remove",
  };
}

function buildTenantSkillWorkbenchState(controller) {
  const members = Array.isArray(controller.members) ? controller.members : [];
  const tenantAgents = Array.isArray(controller.tenantAgents) ? controller.tenantAgents : [];
  const entitlements = Array.isArray(controller.skillsEntitlementItems)
    ? controller.skillsEntitlementItems
    : [];
  const assignments = Array.isArray(controller.skillsAssignmentItems)
    ? controller.skillsAssignmentItems
    : [];
  const marketItems = Array.isArray(controller.skillsMarketItems) ? controller.skillsMarketItems : [];
  const tenantAgentById = new Map(
    tenantAgents
      .map((agent) => [String(agent?.id || "").trim(), agent])
      .filter(([tenantAgentId]) => Boolean(tenantAgentId)),
  );
  const entitlementBySkillId = new Map(
    entitlements
      .map((entry) => [String(entry?.skillId || "").trim(), entry])
      .filter(([skillId]) => Boolean(skillId)),
  );
  const entitlementBySkillKey = new Map(
    entitlements
      .map((entry) => [String(entry?.skillKey || "").trim(), entry])
      .filter(([skillKey]) => Boolean(skillKey)),
  );
  const marketItemsByBaseAgentId = new Map();
  const marketItemsBySkillKey = new Map();
  for (const entry of marketItems) {
    const skillKey = String(entry?.skillKey || "").trim();
    if (skillKey && !marketItemsBySkillKey.has(skillKey)) {
      marketItemsBySkillKey.set(skillKey, entry);
    }
    const baseAgentIds = Array.isArray(entry?.compatibleBaseAgents)
      ? entry.compatibleBaseAgents
      : ["*"];
    for (const baseAgentId of baseAgentIds.length ? baseAgentIds : ["*"]) {
      const normalizedBaseAgentId = String(baseAgentId || "").trim() || "*";
      const group = marketItemsByBaseAgentId.get(normalizedBaseAgentId) || [];
      group.push(entry);
      marketItemsByBaseAgentId.set(normalizedBaseAgentId, group);
    }
  }

  const assignmentsByUserId = new Map();
  for (const row of assignments) {
    const tenantAgentId = String(row?.tenantAgentId || "").trim();
    const baseAgentId = String(row?.baseAgentId || "").trim();
    const tenantAgent = tenantAgentById.get(tenantAgentId) || null;
    const templateRows = Array.isArray(row?.templateRows) ? row.templateRows : [];
    const templateEnabledSkillKeys = new Set(
      templateRows
        .filter((item) => String(item?.templateState || "").trim() === "enabled")
        .map((item) => String(item?.skillKey || "").trim())
        .filter(Boolean),
    );
    const templateBlockedSkillKeys = new Set(
      templateRows
        .filter((item) => String(item?.templateState || "").trim() === "blocked_missing_entitlement")
        .map((item) => String(item?.skillKey || "").trim())
        .filter(Boolean),
    );
    const compatibleMarketItems = [
      ...(marketItemsByBaseAgentId.get(baseAgentId) || []),
      ...(marketItemsByBaseAgentId.get("*") || []),
    ].filter(
      (item, index, items) =>
        items.findIndex((candidate) => String(candidate?.id || "").trim() === String(item?.id || "").trim()) ===
        index,
    );
    const compatibleMarketItemsBySkillKey = new Map(
      compatibleMarketItems
        .map((entry) => [String(entry?.skillKey || "").trim(), entry])
        .filter(([skillKey]) => Boolean(skillKey)),
    );
    const assignmentRows = Array.isArray(row?.assignments) ? row.assignments : [];
    for (const assignment of assignmentRows) {
      const userId = String(assignment?.userId || "").trim();
      if (!userId) {
        continue;
      }
      const resolvedSkillKeys = new Set(
        Array.isArray(assignment?.resolvedSkillKeys) ? assignment.resolvedSkillKeys : [],
      );
      const overrideRows = Array.isArray(assignment?.overrideRows) ? assignment.overrideRows : [];
      const overrideBySkillKey = new Map(
        overrideRows
          .map((item) => [String(item?.skillKey || "").trim(), item])
          .filter(([skillKey]) => Boolean(skillKey)),
      );
      const templateBySkillKey = new Map(
        templateRows
          .map((item) => [String(item?.skillKey || "").trim(), item])
          .filter(([skillKey]) => Boolean(skillKey)),
      );
      const displaySkills = [...resolvedSkillKeys]
        .map((skillKey) =>
          buildWorkbenchDisplaySkill({
            skillKey,
            marketItem:
              compatibleMarketItemsBySkillKey.get(skillKey) ||
              marketItemsBySkillKey.get(skillKey) ||
              null,
            templateRow: templateBySkillKey.get(skillKey) || null,
            overrideRow: overrideBySkillKey.get(skillKey) || null,
            entitlement:
              entitlementBySkillKey.get(skillKey) ||
              entitlementBySkillId.get(
                String(
                  compatibleMarketItemsBySkillKey.get(skillKey)?.skillId ||
                    compatibleMarketItemsBySkillKey.get(skillKey)?.id ||
                    marketItemsBySkillKey.get(skillKey)?.skillId ||
                    marketItemsBySkillKey.get(skillKey)?.id ||
                    "",
                ).trim(),
              ) ||
              null,
            resolvedSkillKeys,
            templateEnabledSkillKeys,
            templateBlockedSkillKeys,
          }),
        )
        .filter(Boolean);
      const nextCards = assignmentsByUserId.get(userId) || [];
      nextCards.push({
        assignmentId: String(assignment?.assignmentId || "").trim(),
        userId,
        username: String(assignment?.username || "").trim(),
        tenantAgentId,
        baseAgentId,
        tenantAgent,
        assignmentStatus: String(assignment?.status || "").trim() || "active",
        blockedReasons: Array.isArray(assignment?.blockedReasons) ? assignment.blockedReasons : [],
        resolvedSkillKeys: Array.isArray(assignment?.resolvedSkillKeys)
          ? assignment.resolvedSkillKeys
          : [],
        cardSkills: displaySkills,
        templateRows,
        displaySkills,
      });
      assignmentsByUserId.set(userId, nextCards);
    }
  }

  const memberItems = members.map((member) => {
    const userId = String(member?.id || "").trim();
    const cards = assignmentsByUserId.get(userId) || [];
    return {
      ...member,
      userId,
      cards: cards.sort((left, right) =>
        String(
          left?.tenantAgent?.agentName ||
            left?.tenantAgent?.description ||
            left?.baseAgentId ||
            left?.tenantAgentId ||
            "",
        ).localeCompare(
          String(
            right?.tenantAgent?.agentName ||
              right?.tenantAgent?.description ||
              right?.baseAgentId ||
              right?.tenantAgentId ||
              "",
          ),
          "zh-CN",
        ),
      ),
    };
  });

  const activeSearch = getSearchValue(controller).trim().toLowerCase();
  const filteredMembers = memberItems
    .map((member) => {
      const memberMatch = memberMatchesWorkbenchSearch(member, activeSearch);
      const matchedCards = activeSearch
        ? member.cards.filter((card) => cardMatchesWorkbenchSearch(card, activeSearch))
        : member.cards;
      if (!memberMatch && !matchedCards.length) {
        return null;
      }
      return {
        ...member,
        treeCards: activeSearch && !memberMatch ? matchedCards : member.cards,
      };
    })
    .filter(Boolean);

  const previousState =
    controller.skillsWorkbenchState && typeof controller.skillsWorkbenchState === "object"
      ? controller.skillsWorkbenchState
      : {};
  const hasExplicitExpandedMemberIds = Array.isArray(previousState.expandedMemberIds);
  const previousExpandedMemberIds = new Set(
    hasExplicitExpandedMemberIds
      ? previousState.expandedMemberIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [],
  );
  const availableMemberIds = new Set(filteredMembers.map((member) => member.userId));
  const expandedMemberIds = new Set(
    [...previousExpandedMemberIds].filter((memberId) => availableMemberIds.has(memberId)),
  );
  let selectedMemberId = String(previousState.selectedMemberId || "").trim();
  if (!filteredMembers.some((member) => member.userId === selectedMemberId)) {
    selectedMemberId = filteredMembers[0]?.userId || memberItems[0]?.userId || "";
  }
  if (!expandedMemberIds.size && selectedMemberId && !hasExplicitExpandedMemberIds) {
    expandedMemberIds.add(selectedMemberId);
  }
  if (!selectedMemberId && filteredMembers[0]?.userId && !hasExplicitExpandedMemberIds) {
    selectedMemberId = filteredMembers[0].userId;
  }

  const selectedMember =
    filteredMembers.find((member) => member.userId === selectedMemberId) ||
    memberItems.find((member) => member.userId === selectedMemberId) ||
    null;
  const selectedMemberCards = Array.isArray(selectedMember?.treeCards)
    ? selectedMember.treeCards
    : Array.isArray(selectedMember?.cards)
      ? selectedMember.cards
      : [];
  let selectedAssignmentId = String(previousState.selectedAssignmentId || "").trim();
  if (
    !expandedMemberIds.has(selectedMemberId) ||
    !selectedMemberCards.some((card) => card.assignmentId === selectedAssignmentId)
  ) {
    selectedAssignmentId = "";
  }
  const selectedCard =
    selectedMemberCards.find((card) => card.assignmentId === selectedAssignmentId) || null;

  return {
    members: memberItems,
    filteredMembers,
    expandedMemberIds: [...expandedMemberIds],
    selectedMemberId,
    selectedAssignmentId,
    selectedMember,
    selectedCard,
  };
}

export function rebuildSkillsWorkbenchState(controller, partialState = null) {
  if (partialState && typeof partialState === "object") {
    controller.skillsWorkbenchState = {
      ...(controller.skillsWorkbenchState || {}),
      ...partialState,
    };
  }
  controller.skillsWorkbenchState = buildTenantSkillWorkbenchState(controller);
  return controller.skillsWorkbenchState;
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

  if (
    controller.section === "skills-workbench" ||
    controller.section === "skills-entitlements" ||
    controller.section === "skills-assignments"
  ) {
    const [members, tenantAgents, entitlements, assignments] = await Promise.all([
      controller.apiClient.listTenantMembers(),
      controller.apiClient.listTenantAgents(),
      controller.apiClient.listTenantSkillEntitlements(),
      controller.apiClient.listTenantSkillAssignments(),
    ]);
    const marketGroups = await Promise.all(
      (Array.isArray(tenantAgents) ? tenantAgents : []).map(async (agent) => {
        const baseAgentId = String(agent?.agentId || agent?.baseAgentId || "").trim();
        return {
          tenantAgentId: String(agent?.id || "").trim(),
          baseAgentId,
          items: await controller.apiClient.listTenantSkillsMarket({ baseAgentId }),
        };
      }),
    );
    controller.members = Array.isArray(members) ? members : [];
    controller.tenantAgents = Array.isArray(tenantAgents) ? tenantAgents : [];
    controller.skillsEntitlementItems = Array.isArray(entitlements) ? entitlements : [];
    controller.skillsAssignmentItems = Array.isArray(assignments) ? assignments : [];
    controller.skillsMarketItems = Array.isArray(marketGroups)
      ? marketGroups.flatMap((entry) => Array.isArray(entry?.items) ? entry.items : [])
      : [];
    rebuildSkillsWorkbenchState(controller);
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
