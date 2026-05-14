import {
  PLATFORM_AGENT_ASSIGNMENT_VIEW,
  PLATFORM_DATA_SOURCES_VIEW,
  PLATFORM_NODE_MANAGEMENT_VIEW,
  PLATFORM_SKILLS_VIEW,
  PLATFORM_TENANT_MANAGEMENT_VIEW,
} from "./tenant-context.js";

export const BODY_SECTION_ATTR = "data-oc-platform-body-section";
const PAGE_SIZE = 8;

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function currentSectionHref(section) {
  if (section === "agent-allocation") {
    return `./?ocTenantView=${PLATFORM_AGENT_ASSIGNMENT_VIEW}`;
  }
  if (section === "data-sources") {
    return `./?ocTenantView=${PLATFORM_DATA_SOURCES_VIEW}`;
  }
  if (section === "nodes") {
    return `./?ocTenantView=${PLATFORM_NODE_MANAGEMENT_VIEW}`;
  }
  if (section === "skills") {
    return `./?ocTenantView=${PLATFORM_SKILLS_VIEW}`;
  }
  return `./?ocTenantView=${PLATFORM_TENANT_MANAGEMENT_VIEW}`;
}

export function isLocalEdition(controller) {
  return controller?.session?.session?.edition === "local";
}

export function formatNumber(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? new Intl.NumberFormat("zh-CN").format(numeric) : "0";
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

export function formatDateTimeInputValue(value) {
  if (!value) {
    return "";
  }
  const timestamp = Date.parse(String(value));
  if (Number.isNaN(timestamp)) {
    return String(value);
  }
  const date = new Date(timestamp);
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ];
  const time = [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ];
  return `${parts[0]}-${parts[1]}-${parts[2]}T${time[0]}:${time[1]}`;
}

export function deploymentModeLabel(mode) {
  return mode === "local" ? "本地部署" : "公有云";
}

export function localLicenseStatusLabel(localLicense) {
  if (!localLicense || localLicense.edition !== "local") {
    return "-";
  }
  if (localLicense.status === "active") {
    return "授权有效";
  }
  if (localLicense.status === "expired") {
    return "已到期只读";
  }
  if (localLicense.status === "missing") {
    return "未导入授权";
  }
  return "授权无效";
}

export function createPlatformConsoleControllerState(session, apiClient, stateFactories) {
  return {
    apiClient,
    session,
    section: "tenants",
    searchBySection: {
      tenants: "",
      "agent-allocation": "",
      "data-sources": "",
      nodes: "",
      skills: "",
    },
    pageBySection: {
      tenants: 1,
      "agent-allocation": 1,
      "data-sources": 1,
      nodes: 1,
      skills: 1,
    },
    tenants: [],
    nodes: [],
    catalogAgents: [],
    skills: [],
    skillVersionsBySkillId: new Map(),
    rateDialogAgents: [],
    dialogs: {
      createTenantOpen: false,
      memberLimitOpen: false,
      assignOpen: false,
      rateOpen: false,
      localLicenseOpen: false,
      dataSourceOpen: false,
      nodeOpen: false,
      bindNodeOpen: false,
    },
    activeTenant: null,
    activeNode: null,
    dataSources: [],
    syncSchedules: [],
    dataSourceCatalogDialog: stateFactories.createDataSourceCatalogDialogState(),
    tenantDataSourceBindingDialog: stateFactories.createTenantDataSourceBindingDialogState(),
    assignTenantAgentDialog: stateFactories.createAssignTenantAgentDialogState(),
    nodeDialog: stateFactories.createNodeDialogState(),
    bindNodeDialog: stateFactories.createBindNodeDialogState(),
    loadingRateAgents: false,
    localLicense: null,
    revokeTenantAgentDialog: stateFactories.createRevokeTenantAgentDialogState(),
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

export function filterTenants(controller) {
  const query = getSearchValue(controller).trim().toLowerCase();
  if (!query) {
    return controller.tenants;
  }
  return controller.tenants.filter((tenant) =>
    [
      tenant.name,
      tenant.code,
      deploymentModeLabel(tenant.deploymentMode),
      tenant.status,
      tenant.boundNodeName,
      tenant.boundNodeId,
    ]
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

export function tenantById(controller, tenantId) {
  return controller.tenants.find((tenant) => tenant.id === tenantId) ?? null;
}

export function nodeById(controller, nodeId) {
  return controller.nodes.find((node) => node.id === nodeId) ?? null;
}

export function updateSectionLinkState(section) {
  const sectionByHref = new Map([
    [currentSectionHref("tenants"), "tenants"],
    [currentSectionHref("agent-allocation"), "agent-allocation"],
    [currentSectionHref("data-sources"), "data-sources"],
    [currentSectionHref("nodes"), "nodes"],
    [currentSectionHref("skills"), "skills"],
  ]);
  for (const [href, targetSection] of sectionByHref.entries()) {
    const links = document.querySelectorAll(`a[href="${href}"]`);
    for (const link of links) {
      link.classList.toggle("active", targetSection === section);
    }
  }
}

export async function refreshPlatformConsole(root, controller, helpers) {
  const includeNodes = controller.section === "nodes" && !isLocalEdition(controller);
  const includeDataSources = controller.section === "data-sources";
  const includeSkills = controller.section === "skills";
  const [tenants, catalogAgents, nodes, localLicense, dataSources, skills] = await Promise.all([
    controller.apiClient.listPlatformTenants(),
    controller.apiClient.listPlatformCatalogAgents(),
    includeNodes ? controller.apiClient.listPlatformNodes() : Promise.resolve([]),
    isLocalEdition(controller) ? controller.apiClient.getLocalLicense() : Promise.resolve(null),
    includeDataSources ? controller.apiClient.listPlatformDataSources() : Promise.resolve(null),
    includeSkills ? controller.apiClient.listPlatformSkills() : Promise.resolve([]),
  ]);
  controller.tenants = tenants;
  controller.catalogAgents = catalogAgents;
  if (includeNodes || controller.section === "nodes") {
    controller.nodes = Array.isArray(nodes) ? nodes : [];
  }
  controller.localLicense = localLicense;
  if (includeDataSources) {
    controller.dataSources = Array.isArray(dataSources) ? dataSources : [];
    const dialog = helpers.getDataSourceCatalogDialog(controller);
    dialog.dataSources = controller.dataSources.slice();
    dialog.loading = false;
    helpers.syncDataSourceDraftTenant(controller);
  }
  if (includeSkills) {
    controller.skills = Array.isArray(skills) ? skills : [];
  }
  if (controller.assignTenantAgentDialog?.open) {
    controller.assignTenantAgentDialog.agents = Array.isArray(catalogAgents)
      ? catalogAgents.slice()
      : [];
  }
  if (controller.bindNodeDialog?.tenantId) {
    const nextTenant = tenantById(controller, controller.bindNodeDialog.tenantId);
    if (nextTenant) {
      controller.bindNodeDialog.tenantName = nextTenant.name;
      controller.bindNodeDialog.nodeId = String(nextTenant.boundNodeId || "").trim();
    }
  }
  if (
    controller.activeTenant &&
    !tenants.some((tenant) => tenant.id === controller.activeTenant.id)
  ) {
    controller.activeTenant = null;
  }
  if (
    controller.activeNode &&
    !controller.nodes.some((node) => node.id === controller.activeNode.id)
  ) {
    controller.activeNode = null;
  }
  helpers.render(root, controller);
}

export function resetPlatformSectionState(controller, stateFactories) {
  if (controller.section !== "agent-allocation") {
    controller.dialogs.assignOpen = false;
    controller.dialogs.rateOpen = false;
    controller.rateDialogAgents = [];
    controller.loadingRateAgents = false;
    controller.assignTenantAgentDialog = stateFactories.createAssignTenantAgentDialogState();
    controller.revokeTenantAgentDialog = stateFactories.createRevokeTenantAgentDialogState();
  }
  if (controller.section !== "nodes") {
    controller.dialogs.nodeOpen = false;
    controller.activeNode = null;
    controller.nodeDialog = stateFactories.createNodeDialogState();
  }
  if (controller.section !== "tenants") {
    controller.dialogs.bindNodeOpen = false;
    controller.bindNodeDialog = stateFactories.createBindNodeDialogState();
  }
}
