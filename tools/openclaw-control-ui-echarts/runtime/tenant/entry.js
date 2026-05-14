import { ECHARTS_VIEW_ROUTE, isEchartsViewPublicPath } from "../echarts-view/context.js";
import { writeEchartsViewToken } from "../echarts-view/context.js";
import { isLufengPublicPath } from "../lufeng/context.js";
import {
  SANDBOX_VIEW_ROUTE,
  isSandboxViewPublicPath,
  writeSandboxViewToken,
} from "../sandbox-view/context.js";
import { createTenantApiClient } from "./api-client.js";
import { createTenantLifecycle } from "./lifecycle.js";
import {
  bootTenantRouteSync,
  createTenantRouteDrivenScanner,
  navigateTenantRoute,
  resetTenantRouteSyncForTests,
} from "./route-sync.js";
import { createTenantRuntimeStore } from "./runtime-store.js";
import {
  createTenantShellCoordinator,
  findTenantShellTopbar,
  listTenantShellSidebarRoots,
} from "./shell-coordinator.js";
import {
  LOGIN_ROUTE,
  PLATFORM_AGENT_ASSIGNMENT_ROUTE,
  PLATFORM_AGENT_ASSIGNMENT_VIEW,
  PLATFORM_DATA_SOURCES_ROUTE,
  PLATFORM_DATA_SOURCES_VIEW,
  PLATFORM_NODE_MANAGEMENT_ROUTE,
  PLATFORM_NODE_MANAGEMENT_VIEW,
  PLATFORM_SKILLS_ROUTE,
  PLATFORM_SKILLS_VIEW,
  PLATFORM_TENANT_MANAGEMENT_ROUTE,
  PLATFORM_TENANT_MANAGEMENT_VIEW,
  TENANT_AGENT_ASSIGNMENT_ROUTE,
  TENANT_AGENT_ASSIGNMENT_VIEW,
  TENANT_AGENT_SELECTOR_ROUTE,
  TENANT_AGENT_SELECTOR_VIEW,
  TENANT_MEMBER_MANAGEMENT_ROUTE,
  TENANT_MEMBERS_VIEW,
  TENANT_OWNED_AGENTS_ROUTE,
  TENANT_OWNED_AGENTS_VIEW,
  TENANT_USAGE_STATS_ROUTE,
  TENANT_USAGE_STATS_VIEW,
  TENANT_STATISTICS_OVERVIEW_ROUTE,
  TENANT_STATISTICS_OVERVIEW_VIEW,
  TENANT_SKILLS_MARKET_ROUTE,
  TENANT_SKILLS_MARKET_VIEW,
  TENANT_SKILLS_WORKBENCH_ROUTE,
  TENANT_SKILLS_WORKBENCH_VIEW,
  TENANT_SKILLS_ENTITLEMENTS_ROUTE,
  TENANT_SKILLS_ENTITLEMENTS_VIEW,
  TENANT_SKILLS_ASSIGNMENTS_ROUTE,
  TENANT_SKILLS_ASSIGNMENTS_VIEW,
  TENANT_WALLET_ROUTE,
  TENANT_WALLET_VIEW,
  TENANT_WALLET_ORDERS_ROUTE,
  TENANT_WALLET_ORDERS_VIEW,
  TENANT_WALLET_LEDGER_ROUTE,
  TENANT_WALLET_LEDGER_VIEW,
  TENANT_WALLET_FLOW_ROUTE,
  TENANT_WALLET_FLOW_VIEW,
  TENANT_WALLET_SUMMARY_EVENT,
  isTenantLoginView,
  clearPlatformSession,
  clearTenantSession,
  clearSelectedTenantAgent,
  clearTenantViewFromHref,
  isManagedNodeSession,
  isTenantPathActive,
  isTenantShellRole,
  normalizeTenantPathname,
  readSelectedTenantAgent,
  readSessionForCurrentView,
  readTenantShellContext,
  readTenantView,
} from "./tenant-context.js";
import { bootUpdateLogDialogs, resetUpdateLogDialogsForTests } from "./update-log-dialog.js";
import { createTenantViewRegistry } from "./view-registry.js";

const MANAGEMENT_SECTION_CLASS = "oc-platform-management-section";
const AGENT_SECTION_CLASS = "oc-tenant-agent-section";
const STATS_SECTION_CLASS = "oc-tenant-stats-section";
const TOOLS_SECTION_CLASS = "oc-tenant-tools-section";
const WALLET_SECTION_CLASS = "oc-tenant-wallet-section";
const MEMBER_VISUALIZATION_SECTION_CLASS = "oc-member-visualization-section";
const MEMBER_SANDBOX_SECTION_CLASS = "oc-member-sandbox-section";
const NAV_SECTION_CLASSES = [
  MANAGEMENT_SECTION_CLASS,
  AGENT_SECTION_CLASS,
  STATS_SECTION_CLASS,
  TOOLS_SECTION_CLASS,
  WALLET_SECTION_CLASS,
];
const NAV_SECTION_SELECTOR = NAV_SECTION_CLASSES.map((name) => `.${name}`).join(", ");
const TOPBAR_META_STYLE_ATTR = "data-oc-platform-topbar-style";
const TOPBAR_META_MODE_ATTR = "data-oc-platform-search-mode";
const TOPBAR_META_ROLE_ATTR = "data-oc-platform-role";
const TOPBAR_META_USER_ATTR = "data-oc-platform-user";
const TOPBAR_META_BALANCE_ATTR = "data-oc-platform-balance";
const TOPBAR_HIDDEN_ATTR = "data-oc-platform-search-hidden";
const TOPBAR_META_ROOT_SELECTOR = "[data-oc-platform-topbar-meta]";
const TOPBAR_PROFILE_SELECTOR = "[data-oc-platform-profile]";
const TOPBAR_LOGOUT_SELECTOR = "[data-oc-platform-logout]";
const TOPBAR_PROFILE_DIALOG_SELECTOR = "[data-oc-platform-profile-dialog]";
const TOPBAR_LOGOUT_DIALOG_SELECTOR = "[data-oc-platform-logout-dialog]";
const TOPBAR_DIALOG_CLOSE_SELECTOR = "[data-oc-platform-dialog-close]";
const TOPBAR_DIALOG_CONFIRM_LOGOUT_SELECTOR = "[data-oc-platform-confirm-logout]";
const TENANT_ROLE_CONTEXT_ATTR = "data-oc-tenant-role-context";
const MEMBER_VISUALIZATION_CACHE = new Map();
const MEMBER_VISUALIZATION_SIGNATURE_ATTR = "data-oc-member-visualization-signature";
const MEMBER_VISUALIZATION_SYNC_TOKEN_KEY = "__ocMemberVisualizationSyncToken";
const MEMBER_VISUALIZATION_IN_FLIGHT_KEY = "__ocMemberVisualizationInFlight";
const MEMBER_VISUALIZATION_PENDING_SYNC_KEY = "__ocMemberVisualizationPendingSync";
const MEMBER_VISUALIZATION_POLL_INTERVAL_MS = 5000;
const MEMBER_VISUALIZATION_POLL_TIMER_KEY = "__openclawMemberVisualizationPollTimer";
const MEMBER_SANDBOX_CACHE = new Map();
const MEMBER_SANDBOX_SIGNATURE_ATTR = "data-oc-member-sandbox-signature";
const MEMBER_SANDBOX_POLL_INTERVAL_MS = 5000;
const MEMBER_SANDBOX_POLL_TIMER_KEY = "__openclawMemberSandboxPollTimer";
const TENANT_WALLET_BALANCE_CACHE = {
  sessionToken: "",
  balanceText: "",
  loading: false,
  promise: null,
};
let tenantEntryRouteCleanup = null;
let tenantEntryTopbarLogoutHandler = null;
let tenantEntryWalletBalanceHandler = null;
let tenantEntryLifecycle = null;

const ICONS = {
  tenants: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7.3 12 3l8 4.3v1.4H4ZM6.1 10h2v6.2h-2Zm4.9 0H13v6.2h-2Zm4.9 0h2v6.2h-2ZM4 19h16v2H4Z"></path>
    </svg>
  `,
  agentAllocation: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.8 5.2a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Zm8.4 0a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2ZM7.8 13.6a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Zm8.4 1h-4.4v-1.8h4.4Zm-6.2-5.2h4.4v1.8H10Zm2 7.8h4.2v1.8H12Z"></path>
    </svg>
  `,
  dataSources: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6.5C4 4.6 7.6 3 12 3s8 1.6 8 3.5S16.4 10 12 10 4 8.4 4 6.5Zm0 5.5v5c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5v-5c-1.8 1.6-4.9 2.5-8 2.5S5.8 13.6 4 12Zm0-2.6v1.1c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5V9.4c-1.8 1.6-4.9 2.6-8 2.6S5.8 11 4 9.4Z"></path>
    </svg>
  `,
  tenant: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 4 7.4v1.4h16V7.4Zm-5.8 7.4h1.9v6.1H6.2Zm4.9 0H13v6.1h-1.9Zm4.8 0h1.9v6.1H16Zm-11.8 8H20V21H4Z"></path>
    </svg>
  `,
  chevronDown: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 9 6 6 6-6"></path>
    </svg>
  `,
  members: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.1a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4Zm8 0a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6ZM4.5 17.9c0-2.4 2-4.1 4.9-4.1s4.9 1.7 4.9 4.1V19H4.5Zm10.6 1.1v-1.1c0-1.1-.3-2.1-.9-2.9 2.1.1 4 .9 4 2.9V19Z"></path>
    </svg>
  `,
  stats: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20V4h2v16Zm4-3V9h2v8Zm4 3V12h2v8Zm4-3V6h2v11Zm4 3v-7h2v7Z"></path>
    </svg>
  `,
  wallet: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h10A2.5 2.5 0 0 1 19 7.5V9h1a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5Zm2.5-.5a.5.5 0 0 0-.5.5v1h11V7.5a.5.5 0 0 0-.5-.5Zm11.5 4H6v5.5a.5.5 0 0 0 .5.5H19Zm-2 3.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"></path>
    </svg>
  `,
  dashboard: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z"></path>
    </svg>
  `,
  chart: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19h16v2H4Zm2-4 4-4 3 3 5-7 1.6 1.2-6.2 8.8-3-3-4.1 4.1Z"></path>
    </svg>
  `,
};

function createSectionLabel(text = "管理") {
  const label = document.createElement("button");
  label.type = "button";
  label.className = "nav-section__label";
  label.innerHTML = `
    <span class="nav-section__label-text">${text}</span>
    <span class="nav-section__chevron" aria-hidden="true">${ICONS.chevronDown}</span>
  `;
  return label;
}

function createNavItem({ className, href, title, text, icon }) {
  const link = document.createElement("a");
  link.className = `nav-item ${className}`;
  link.href = href;
  link.title = title;
  link.innerHTML = `
    <span class="nav-item__icon" aria-hidden="true">${icon}</span>
    <span class="nav-item__text">${text}</span>
  `;
  return link;
}

function getSectionConfigForSession(session) {
  const role = session?.session?.role || "";
  if (role === "platform_admin") {
    return {
      sections: [
        {
          className: MANAGEMENT_SECTION_CLASS,
          label: "管理",
          links: [
            {
              className: "oc-tenant-management-link",
              href: PLATFORM_TENANT_MANAGEMENT_ROUTE,
              title: "租户管理",
              text: "租户管理",
              icon: ICONS.tenants,
              activeView: PLATFORM_TENANT_MANAGEMENT_VIEW,
            },
            {
              className: "oc-platform-agent-link",
              href: PLATFORM_AGENT_ASSIGNMENT_ROUTE,
              title: "Agent 分配",
              text: "Agent 分配",
              icon: ICONS.agentAllocation,
              activeView: PLATFORM_AGENT_ASSIGNMENT_VIEW,
            },
            {
              className: "oc-platform-node-link",
              href: PLATFORM_NODE_MANAGEMENT_ROUTE,
              title: "节点管理",
              text: "节点管理",
              icon: ICONS.tenants,
              activeView: PLATFORM_NODE_MANAGEMENT_VIEW,
            },
            {
              className: "oc-platform-data-source-link",
              href: PLATFORM_DATA_SOURCES_ROUTE,
              title: "创建数据源",
              text: "创建数据源",
              icon: ICONS.dataSources,
              activeView: PLATFORM_DATA_SOURCES_VIEW,
            },
            {
              className: "oc-platform-skills-link",
              href: PLATFORM_SKILLS_ROUTE,
              title: "Skills",
              text: "Skills",
              icon: ICONS.agentAllocation,
              activeView: PLATFORM_SKILLS_VIEW,
            },
          ],
        },
      ],
    };
  }
  if (role === "tenant_admin") {
    const isLocalEdition = session?.session?.edition === "local";
    const isManagedNode = isManagedNodeSession(session);
    return {
      sections: [
        ...(isManagedNode
          ? []
          : [
              {
                className: MANAGEMENT_SECTION_CLASS,
                label: "管理",
                links: [
                  {
                    className: "oc-tenant-members-link",
                    href: TENANT_MEMBER_MANAGEMENT_ROUTE,
                    title: "成员管理",
                    text: "成员管理",
                    icon: ICONS.members,
                    activeView: TENANT_MEMBERS_VIEW,
                  },
                  {
                    className: "oc-tenant-agent-link",
                    href: TENANT_AGENT_ASSIGNMENT_ROUTE,
                    title: "Agent 分配",
                    text: "Agent 分配",
                    icon: ICONS.agentAllocation,
                    activeView: TENANT_AGENT_ASSIGNMENT_VIEW,
                  },
                ],
              },
            ]),
        {
          className: AGENT_SECTION_CLASS,
          label: "Agent",
          links: [
            {
              className: "oc-tenant-owned-agents-link",
              href: TENANT_OWNED_AGENTS_ROUTE,
              title: "已有Agent",
              text: "已有Agent",
              icon: ICONS.agentAllocation,
              activeView: TENANT_OWNED_AGENTS_VIEW,
            },
          ],
        },
        {
          className: STATS_SECTION_CLASS,
          label: "统计",
          links: [
            {
              className: "oc-tenant-statistics-overview-link",
              href: TENANT_STATISTICS_OVERVIEW_ROUTE,
              title: "统计总览",
              text: "统计总览",
              icon: ICONS.dashboard,
              activeView: TENANT_STATISTICS_OVERVIEW_VIEW,
            },
            {
              className: "oc-tenant-usage-stats-link",
              href: TENANT_USAGE_STATS_ROUTE,
              title: "耗量统计",
              text: "耗量统计",
              icon: ICONS.stats,
              activeView: TENANT_USAGE_STATS_VIEW,
            },
          ],
        },
        {
          className: TOOLS_SECTION_CLASS,
          label: "工具",
          links: [
            {
              className: "oc-tenant-skills-market-link",
              href: TENANT_SKILLS_MARKET_ROUTE,
              title: "市场",
              text: "市场",
              icon: ICONS.agentAllocation,
              activeView: TENANT_SKILLS_MARKET_VIEW,
            },
            {
              className: "oc-tenant-skills-workbench-link",
              href: TENANT_SKILLS_WORKBENCH_ROUTE,
              title: "技能分配",
              text: "技能分配",
              icon: ICONS.agentAllocation,
              activeView: TENANT_SKILLS_WORKBENCH_VIEW,
            },
          ],
        },
        ...(isLocalEdition || isManagedNode
          ? []
          : [
              {
                className: WALLET_SECTION_CLASS,
                label: "钱包",
                links: [
                  {
                    className: "oc-tenant-wallet-link",
                    href: TENANT_WALLET_ROUTE,
                    title: "钱包充值",
                    text: "钱包充值",
                    icon: ICONS.wallet,
                    activeView: TENANT_WALLET_VIEW,
                  },
                  {
                    className: "oc-tenant-wallet-orders-link",
                    href: TENANT_WALLET_ORDERS_ROUTE,
                    title: "充值订单",
                    text: "充值订单",
                    icon: ICONS.wallet,
                    activeView: TENANT_WALLET_ORDERS_VIEW,
                  },
                  {
                    className: "oc-tenant-wallet-ledger-link",
                    href: TENANT_WALLET_LEDGER_ROUTE,
                    title: "模型耗用",
                    text: "模型耗用",
                    icon: ICONS.wallet,
                    activeView: TENANT_WALLET_LEDGER_VIEW,
                  },
                  {
                    className: "oc-tenant-wallet-flow-link",
                    href: TENANT_WALLET_FLOW_ROUTE,
                    title: "钱包流水",
                    text: "钱包流水",
                    icon: ICONS.wallet,
                    activeView: TENANT_WALLET_FLOW_VIEW,
                  },
                ],
              },
            ]),
      ],
    };
  }
  if (role === "member") {
    const currentPath = new URL(window.location.href, document.baseURI).pathname;
    const selectedAgent = readSelectedTenantAgent();
    const onMemberChatPage =
      isTenantPathActive("/chat", currentPath) && selectedAgent?.id && selectedAgent?.agentId;
    const links = onMemberChatPage
      ? []
      : [
          {
            className: "oc-member-agent-selector-link",
            href: TENANT_AGENT_SELECTOR_ROUTE,
            title: "Agent 选择",
            text: "Agent选择",
            icon: ICONS.agentAllocation,
            activeView: TENANT_AGENT_SELECTOR_VIEW,
          },
        ];
    return {
      sections: [
        {
          className: MANAGEMENT_SECTION_CLASS,
          label: onMemberChatPage ? "更多" : "Agent",
          links,
        },
      ],
    };
  }
  return {
    sections: [{ className: MANAGEMENT_SECTION_CLASS, label: "管理", links: [] }],
  };
}

function buildMemberVisualizationLinks(visualizations) {
  return visualizations.map((item) => ({
    className: "oc-member-visualization-link",
    href: item.href,
    title: item.title || item.visualizationName || "",
    text: item.visualizationName || item.title || item.visualizationFileName || "",
    icon: ICONS.chart,
    activePath: ECHARTS_VIEW_ROUTE,
  }));
}

function buildMemberSandboxLinks(sandboxes) {
  return sandboxes.map((item) => ({
    className: "oc-member-sandbox-link",
    href: item.href,
    title: item.title || item.sandboxName || "",
    text: item.sandboxName || item.title || item.sandboxFileName || "",
    icon: ICONS.dashboard,
    activePath: SANDBOX_VIEW_ROUTE,
  }));
}

function openPublicRoute(destination) {
  if (!(destination instanceof URL)) {
    return false;
  }
  if (isEchartsViewPublicPath(destination.pathname)) {
    const token = destination.searchParams.get("token")?.trim() || "";
    if (token) {
      writeEchartsViewToken(token);
    }
    window.location.assign(destination.href);
    return true;
  }
  if (isLufengPublicPath(destination.pathname)) {
    window.location.assign(destination.href);
    return true;
  }
  if (isSandboxViewPublicPath(destination.pathname)) {
    const token = destination.searchParams.get("token")?.trim() || "";
    if (token) {
      writeSandboxViewToken(token);
    }
    window.location.assign(destination.href);
    return true;
  }
  return false;
}

function getMemberVisualizationSignature(visualizations) {
  return visualizations
    .map((item) => [item.id, item.href, item.visualizationName, item.agentName].join("|"))
    .join(";;");
}

function readMemberVisualizationSessionKey(session) {
  return String(session?.token || "").trim();
}

function loadMemberVisualizations(session) {
  const sessionKey = readMemberVisualizationSessionKey(session);
  if (!sessionKey) {
    return Promise.resolve([]);
  }
  if (!MEMBER_VISUALIZATION_CACHE.has(sessionKey)) {
    let promise;
    promise = createTenantApiClient()
      .listMemberVisualizations()
      .then((items) => (Array.isArray(items) ? items : []))
      .catch((error) => {
        MEMBER_VISUALIZATION_CACHE.delete(sessionKey);
        throw error;
      })
      .finally(() => {
        if (MEMBER_VISUALIZATION_CACHE.get(sessionKey) === promise) {
          MEMBER_VISUALIZATION_CACHE.delete(sessionKey);
        }
      });
    MEMBER_VISUALIZATION_CACHE.set(sessionKey, promise);
  }
  return MEMBER_VISUALIZATION_CACHE.get(sessionKey);
}

function insertVisualizationSection(container, section) {
  const managementSection = container.querySelector(`:scope > .${MANAGEMENT_SECTION_CLASS}`);
  if (managementSection instanceof HTMLElement) {
    managementSection.insertAdjacentElement("afterend", section);
    return;
  }
  const firstSection = container.querySelector(":scope > .nav-section");
  container.insertBefore(section, firstSection ?? null);
}

function listDirectMemberVisualizationSections(container) {
  if (!(container instanceof HTMLElement)) {
    return [];
  }
  return [...container.querySelectorAll(`:scope > .${MEMBER_VISUALIZATION_SECTION_CLASS}`)].filter(
    (section) => section instanceof HTMLElement,
  );
}

async function syncMemberVisualizationSection(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (container[MEMBER_VISUALIZATION_IN_FLIGHT_KEY]) {
    container[MEMBER_VISUALIZATION_PENDING_SYNC_KEY] = true;
    return;
  }
  const syncToken = Number(container[MEMBER_VISUALIZATION_SYNC_TOKEN_KEY] || 0) + 1;
  container[MEMBER_VISUALIZATION_SYNC_TOKEN_KEY] = syncToken;
  container[MEMBER_VISUALIZATION_IN_FLIGHT_KEY] = true;
  container[MEMBER_VISUALIZATION_PENDING_SYNC_KEY] = false;
  const session = readSessionForCurrentView();
  const role = String(session?.session?.role || "");
  const existingSections = listDirectMemberVisualizationSections(container);
  try {
    if (role !== "member") {
      for (const section of existingSections) {
        section.remove();
      }
      return;
    }

    const sessionKey = readMemberVisualizationSessionKey(session);
    if (!sessionKey) {
      for (const section of existingSections) {
        section.remove();
      }
      return;
    }

    let visualizations = [];
    try {
      visualizations = await loadMemberVisualizations(session);
    } catch {
      visualizations = [];
    }

    const latestSession = readSessionForCurrentView();
    if (
      container[MEMBER_VISUALIZATION_SYNC_TOKEN_KEY] !== syncToken ||
      readMemberVisualizationSessionKey(latestSession) !== sessionKey ||
      String(latestSession?.session?.role || "") !== "member"
    ) {
      return;
    }

    if (!Array.isArray(visualizations) || visualizations.length === 0) {
      if (container[MEMBER_VISUALIZATION_SYNC_TOKEN_KEY] !== syncToken) {
        return;
      }
      for (const section of listDirectMemberVisualizationSections(container)) {
        section.remove();
      }
      return;
    }

    const links = buildMemberVisualizationLinks(visualizations);
    const signature = getMemberVisualizationSignature(visualizations);
    if (container[MEMBER_VISUALIZATION_SYNC_TOKEN_KEY] !== syncToken) {
      return;
    }
    const latestExistingSections = listDirectMemberVisualizationSections(container);
    const latestExisting = latestExistingSections[0] ?? null;
    for (const duplicateSection of latestExistingSections.slice(1)) {
      duplicateSection.remove();
    }
    if (
      latestExisting instanceof HTMLElement &&
      latestExisting.getAttribute("data-oc-management-role") === role &&
      latestExisting.getAttribute(MEMBER_VISUALIZATION_SIGNATURE_ATTR) === signature
    ) {
      updateManagementSectionState(latestExisting);
      return;
    }

    latestExisting?.remove();
    const section = createNavSection(session, {
      className: MEMBER_VISUALIZATION_SECTION_CLASS,
      label: "可视化展示",
      links,
    });
    section.setAttribute(MEMBER_VISUALIZATION_SIGNATURE_ATTR, signature);
    insertVisualizationSection(container, section);
  } finally {
    const needsResync = Boolean(container[MEMBER_VISUALIZATION_PENDING_SYNC_KEY]);
    container[MEMBER_VISUALIZATION_IN_FLIGHT_KEY] = false;
    container[MEMBER_VISUALIZATION_PENDING_SYNC_KEY] = false;
    if (needsResync && container.isConnected) {
      queueMicrotask(() => {
        void syncMemberVisualizationSection(container);
      });
    }
  }
}

function syncAllMemberVisualizationSections(root = document) {
  const scope = root instanceof Element || root instanceof Document ? root : document;
  for (const container of listTenantShellSidebarRoots(scope)) {
    void syncMemberVisualizationSection(container);
  }
}

function getMemberSandboxSignature(sandboxes) {
  return sandboxes
    .map((item) => [item.id, item.href, item.sandboxName, item.agentName].join("|"))
    .join(";;");
}

function readMemberSandboxSessionKey(session) {
  return String(session?.token || "").trim();
}

function loadMemberSandboxes(session) {
  const sessionKey = readMemberSandboxSessionKey(session);
  if (!sessionKey) {
    return Promise.resolve([]);
  }
  if (!MEMBER_SANDBOX_CACHE.has(sessionKey)) {
    let promise;
    promise = createTenantApiClient()
      .listMemberSandboxes()
      .then((items) => (Array.isArray(items) ? items : []))
      .catch((error) => {
        MEMBER_SANDBOX_CACHE.delete(sessionKey);
        throw error;
      })
      .finally(() => {
        if (MEMBER_SANDBOX_CACHE.get(sessionKey) === promise) {
          MEMBER_SANDBOX_CACHE.delete(sessionKey);
        }
      });
    MEMBER_SANDBOX_CACHE.set(sessionKey, promise);
  }
  return MEMBER_SANDBOX_CACHE.get(sessionKey);
}

function insertSandboxSection(container, section) {
  const visualizationSection = container.querySelector(
    `:scope > .${MEMBER_VISUALIZATION_SECTION_CLASS}`,
  );
  if (visualizationSection instanceof HTMLElement) {
    visualizationSection.insertAdjacentElement("afterend", section);
    return;
  }
  insertVisualizationSection(container, section);
}

function listDirectMemberSandboxSections(container) {
  if (!(container instanceof HTMLElement)) {
    return [];
  }
  return [...container.querySelectorAll(`:scope > .${MEMBER_SANDBOX_SECTION_CLASS}`)].filter(
    (section) => section instanceof HTMLElement,
  );
}

async function syncMemberSandboxSection(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  const session = readSessionForCurrentView();
  const role = String(session?.session?.role || "");
  const existingSections = listDirectMemberSandboxSections(container);
  if (role !== "member") {
    for (const section of existingSections) {
      section.remove();
    }
    return;
  }

  const sessionKey = readMemberSandboxSessionKey(session);
  if (!sessionKey) {
    for (const section of existingSections) {
      section.remove();
    }
    return;
  }

  let sandboxes = [];
  try {
    sandboxes = await loadMemberSandboxes(session);
  } catch {
    sandboxes = [];
  }

  const latestSession = readSessionForCurrentView();
  if (
    readMemberSandboxSessionKey(latestSession) !== sessionKey ||
    String(latestSession?.session?.role || "") !== "member"
  ) {
    return;
  }

  if (!Array.isArray(sandboxes) || sandboxes.length === 0) {
    for (const section of listDirectMemberSandboxSections(container)) {
      section.remove();
    }
    return;
  }

  const links = buildMemberSandboxLinks(sandboxes);
  const signature = getMemberSandboxSignature(sandboxes);
  const latestExistingSections = listDirectMemberSandboxSections(container);
  const latestExisting = latestExistingSections[0] ?? null;
  for (const duplicateSection of latestExistingSections.slice(1)) {
    duplicateSection.remove();
  }
  if (
    latestExisting instanceof HTMLElement &&
    latestExisting.getAttribute("data-oc-management-role") === role &&
    latestExisting.getAttribute(MEMBER_SANDBOX_SIGNATURE_ATTR) === signature
  ) {
    updateManagementSectionState(latestExisting);
    return;
  }

  latestExisting?.remove();
  const section = createNavSection(session, {
    className: MEMBER_SANDBOX_SECTION_CLASS,
    label: "沙盒模拟",
    links,
  });
  section.setAttribute(MEMBER_SANDBOX_SIGNATURE_ATTR, signature);
  insertSandboxSection(container, section);
}

function syncAllMemberSandboxSections(root = document) {
  const scope = root instanceof Element || root instanceof Document ? root : document;
  for (const container of listTenantShellSidebarRoots(scope)) {
    void syncMemberSandboxSection(container);
  }
}

function clearMemberVisualizationPolling() {
  const timerId = window[MEMBER_VISUALIZATION_POLL_TIMER_KEY];
  if (typeof timerId === "number" && Number.isFinite(timerId)) {
    window.clearInterval(timerId);
  }
  delete window[MEMBER_VISUALIZATION_POLL_TIMER_KEY];
}

function pollMemberVisualizationSections() {
  if (document.visibilityState === "hidden") {
    return;
  }
  const session = readSessionForCurrentView();
  const role = String(session?.session?.role || "");
  if (role !== "member" || isTenantAuthViewActive()) {
    clearMemberVisualizationPolling();
    return;
  }
  syncAllMemberVisualizationSections(document);
}

function ensureMemberVisualizationPolling() {
  const session = readSessionForCurrentView();
  const role = String(session?.session?.role || "");
  if (role !== "member" || isTenantAuthViewActive()) {
    clearMemberVisualizationPolling();
    return;
  }
  if (typeof window[MEMBER_VISUALIZATION_POLL_TIMER_KEY] === "number") {
    return;
  }
  window[MEMBER_VISUALIZATION_POLL_TIMER_KEY] = window.setInterval(
    pollMemberVisualizationSections,
    MEMBER_VISUALIZATION_POLL_INTERVAL_MS,
  );
}

function clearMemberSandboxPolling() {
  const timerId = window[MEMBER_SANDBOX_POLL_TIMER_KEY];
  if (typeof timerId === "number" && Number.isFinite(timerId)) {
    window.clearInterval(timerId);
  }
  delete window[MEMBER_SANDBOX_POLL_TIMER_KEY];
}

function pollMemberSandboxSections() {
  if (document.visibilityState === "hidden") {
    return;
  }
  const session = readSessionForCurrentView();
  const role = String(session?.session?.role || "");
  if (role !== "member" || isTenantAuthViewActive()) {
    clearMemberSandboxPolling();
    return;
  }
  syncAllMemberSandboxSections(document);
}

function ensureMemberSandboxPolling() {
  const session = readSessionForCurrentView();
  const role = String(session?.session?.role || "");
  if (role !== "member" || isTenantAuthViewActive()) {
    clearMemberSandboxPolling();
    return;
  }
  if (typeof window[MEMBER_SANDBOX_POLL_TIMER_KEY] === "number") {
    return;
  }
  window[MEMBER_SANDBOX_POLL_TIMER_KEY] = window.setInterval(
    pollMemberSandboxSections,
    MEMBER_SANDBOX_POLL_INTERVAL_MS,
  );
}

function updateManagementSectionState(section) {
  if (!(section instanceof HTMLElement)) {
    return;
  }
  const activeView = readTenantView();
  const currentPathname = window.location.pathname;
  for (const item of section.querySelectorAll(".nav-item")) {
    const expectedView = item.getAttribute("data-oc-platform-view")?.trim() || "";
    const expectedPath = item.getAttribute("data-oc-platform-path")?.trim() || "";
    const isActive =
      (expectedView && expectedView === activeView) ||
      (expectedPath && isTenantPathActive(expectedPath, currentPathname));
    item.classList.toggle("nav-item--active", isActive);
  }
}

function isTenantAuthViewActive() {
  return readTenantShellContext().isAuthView;
}

function ensureManagementSectionHandlers(section) {
  if (!(section instanceof HTMLElement) || section.dataset.ocPlatformHandlers === "true") {
    return;
  }
  section.dataset.ocPlatformHandlers = "true";
  section.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const link = target.closest(".nav-item[href]");
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }
    if (!link.closest(NAV_SECTION_SELECTOR)) {
      return;
    }
    const destination = new URL(link.href, document.baseURI);
    if (openPublicRoute(destination)) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    navigateTenantRoute(link.href);
  });
}

function isManagementViewActive() {
  const activeView = readTenantView();
  return (
    activeView === PLATFORM_TENANT_MANAGEMENT_VIEW ||
    activeView === PLATFORM_AGENT_ASSIGNMENT_VIEW ||
    activeView === PLATFORM_NODE_MANAGEMENT_VIEW ||
    activeView === PLATFORM_DATA_SOURCES_VIEW ||
    activeView === TENANT_MEMBERS_VIEW ||
    activeView === TENANT_AGENT_ASSIGNMENT_VIEW ||
    activeView === TENANT_OWNED_AGENTS_VIEW ||
    activeView === TENANT_USAGE_STATS_VIEW ||
    activeView === TENANT_STATISTICS_OVERVIEW_VIEW ||
    activeView === TENANT_SKILLS_WORKBENCH_VIEW ||
    activeView === TENANT_WALLET_VIEW ||
    activeView === TENANT_WALLET_ORDERS_VIEW ||
    activeView === TENANT_WALLET_LEDGER_VIEW ||
    activeView === TENANT_WALLET_FLOW_VIEW ||
    activeView === TENANT_AGENT_SELECTOR_VIEW
  );
}

function ensureSidebarRouteHandlers(container) {
  if (!(container instanceof HTMLElement) || container.dataset.ocTenantSidebarHandlers === "true") {
    return;
  }
  container.dataset.ocTenantSidebarHandlers = "true";
  container.addEventListener(
    "click",
    (event) => {
      if (!isManagementViewActive()) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const link = target.closest(".nav-item[href]");
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }
      if (link.closest(NAV_SECTION_SELECTOR)) {
        return;
      }
      const destination = new URL(link.href, document.baseURI);
      if (destination.origin !== window.location.origin || !destination.pathname.startsWith("/")) {
        return;
      }
      if (openPublicRoute(destination)) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      navigateTenantRoute(clearTenantViewFromHref(destination.href));
    },
    true,
  );
}

function createNavSection(session, spec) {
  const section = document.createElement("section");
  section.className = `nav-section ${spec.className}`;
  section.setAttribute("data-oc-management-role", String(session?.session?.role || ""));
  section.setAttribute("data-oc-role-nav", "true");

  const label = createSectionLabel(spec.label);
  const items = document.createElement("div");
  items.className = "nav-section__items";
  const activeView = readTenantView();
  for (const link of spec.links) {
    const item = createNavItem({
      className: link.className,
      href: new URL(link.href, document.baseURI).href,
      title: link.title,
      text: link.text,
      icon: link.icon,
    });
    if (link.activeView) {
      item.setAttribute("data-oc-platform-view", link.activeView);
    }
    if (link.activePath) {
      item.setAttribute("data-oc-platform-path", link.activePath);
    }
    item.classList.toggle(
      "nav-item--active",
      (link.activeView && activeView === link.activeView) ||
        (link.activePath && isTenantPathActive(link.activePath)),
    );
    items.append(item);
  }

  label.addEventListener("click", () => {
    section.classList.toggle("nav-section--collapsed");
    label.setAttribute(
      "aria-expanded",
      String(!section.classList.contains("nav-section--collapsed")),
    );
  });
  label.setAttribute("aria-expanded", "true");

  section.append(label, items);
  ensureManagementSectionHandlers(section);
  return section;
}

function ensureManagementSection(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  const session = readSessionForCurrentView();
  const role = String(session?.session?.role || "");
  const config = getSectionConfigForSession(session);
  const specs = Array.isArray(config.sections) ? config.sections : [];
  const specClassSet = new Set(specs.map((spec) => spec.className));

  for (const className of NAV_SECTION_CLASSES) {
    if (specClassSet.has(className)) {
      continue;
    }
    const stale = container.querySelector(`:scope > .${className}`);
    stale?.remove();
  }

  let anchor = null;
  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    const existing = container.querySelector(`:scope > .${spec.className}`);
    if (!spec.links.length) {
      existing?.remove();
      continue;
    }
    if (existing instanceof HTMLElement) {
      const labelText =
        existing.querySelector(".nav-section__label-text")?.textContent?.trim() || "";
      if (existing.getAttribute("data-oc-management-role") !== role || labelText !== spec.label) {
        existing.remove();
      } else {
        updateManagementSectionState(existing);
        anchor = existing;
        continue;
      }
    }

    const section = createNavSection(session, spec);
    if (anchor && anchor.nextSibling) {
      container.insertBefore(section, anchor.nextSibling);
    } else if (anchor) {
      container.append(section);
    } else {
      const siblings = [...container.querySelectorAll(":scope > .nav-section")];
      const insertBefore = siblings[0] ?? null;
      container.insertBefore(section, insertBefore);
    }
    anchor = section;
  }
}

function ensureTenantUtilityLink(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (container.querySelector(".oc-tenant-user-link")) {
    return;
  }
  container.append(
    createNavItem({
      className: "sidebar-utility-link oc-tenant-user-link",
      href: new URL(LOGIN_ROUTE, document.baseURI).href,
      title: "租户登录入口",
      text: "租户登录",
      icon: ICONS.tenant,
    }),
  );
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .trim();
}

function formatWalletBalance(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "--";
  }
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function resetTenantWalletBalanceCache() {
  TENANT_WALLET_BALANCE_CACHE.sessionToken = "";
  TENANT_WALLET_BALANCE_CACHE.balanceText = "";
  TENANT_WALLET_BALANCE_CACHE.loading = false;
  TENANT_WALLET_BALANCE_CACHE.promise = null;
}

function getCachedTenantWalletBalanceText(session) {
  const sessionToken = String(session?.token || "").trim();
  if (!sessionToken || TENANT_WALLET_BALANCE_CACHE.sessionToken !== sessionToken) {
    return "";
  }
  return TENANT_WALLET_BALANCE_CACHE.balanceText || "";
}

function updateTenantWalletBalanceCache(session, summary) {
  const sessionToken = String(session?.token || "").trim();
  if (!sessionToken) {
    return "";
  }
  const balanceText = formatWalletBalance(summary?.walletBalance);
  TENANT_WALLET_BALANCE_CACHE.sessionToken = sessionToken;
  TENANT_WALLET_BALANCE_CACHE.balanceText = balanceText;
  return balanceText;
}

async function ensureTenantWalletBalance(session) {
  if (String(session?.session?.role || "").trim() !== "tenant_admin") {
    return;
  }
  const sessionToken = String(session?.token || "").trim();
  if (!sessionToken) {
    return;
  }
  if (TENANT_WALLET_BALANCE_CACHE.sessionToken !== sessionToken) {
    resetTenantWalletBalanceCache();
    TENANT_WALLET_BALANCE_CACHE.sessionToken = sessionToken;
  }
  if (TENANT_WALLET_BALANCE_CACHE.balanceText || TENANT_WALLET_BALANCE_CACHE.loading) {
    return;
  }
  TENANT_WALLET_BALANCE_CACHE.loading = true;
  TENANT_WALLET_BALANCE_CACHE.promise = createTenantApiClient()
    .getTenantWallet()
    .then((wallet) => {
      updateTenantWalletBalanceCache(session, wallet?.summary);
      syncPlatformTopbarMeta(readSessionForCurrentView());
    })
    .catch(() => {})
    .finally(() => {
      TENANT_WALLET_BALANCE_CACHE.loading = false;
      TENANT_WALLET_BALANCE_CACHE.promise = null;
    });
  await TENANT_WALLET_BALANCE_CACHE.promise;
}

function syncSidebarNavForRole(container, role) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  const shouldTenantHideNativeSections = role === "tenant_admin" || role === "member";
  for (const section of container.querySelectorAll(":scope > .nav-section")) {
    if (!(section instanceof HTMLElement)) {
      continue;
    }
    if (NAV_SECTION_CLASSES.some((name) => section.classList.contains(name))) {
      section.hidden = false;
      continue;
    }
    const isRoleNav = section.getAttribute("data-oc-role-nav") === "true";
    section.hidden = shouldTenantHideNativeSections && !isRoleNav;
  }
}

function shouldHideUtilityItem(item, role) {
  if (!(item instanceof HTMLElement)) {
    return false;
  }
  if (!role) {
    return false;
  }
  const text = normalizeText(item.textContent);
  const isTenantLogin =
    item.querySelector(".oc-tenant-user-link") instanceof Element || text.includes("租户登录");
  const isKnowledgeGraph =
    item.querySelector(".oc-knowledge-graph-link") instanceof Element || text.includes("知识图谱");
  const isDocs = text.includes("文档");
  const isVersion = text.includes("版本");

  if (role === "tenant_admin" || role === "member") {
    return !isVersion;
  }

  if (isTenantLogin || isKnowledgeGraph) {
    return role === "platform_admin" || role === "tenant_admin";
  }
  if (isDocs) {
    return role === "tenant_admin";
  }
  return false;
}

function syncUtilityItemAttributes(item) {
  if (!(item instanceof HTMLElement)) {
    return;
  }
  const text = normalizeText(item.textContent);
  const isVersion = text.includes("版本");
  item.toggleAttribute("data-oc-utility-version", isVersion);
  item.toggleAttribute("data-oc-utility-hidden", !isVersion);
}

function syncSidebarUtilityForRole(container, role) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  for (const child of container.children) {
    if (!(child instanceof HTMLElement)) {
      continue;
    }
    syncUtilityItemAttributes(child);
    child.hidden = shouldHideUtilityItem(child, role);
  }
}

function ensureTopbarMetaStyle() {
  let link = document.head.querySelector(`[${TOPBAR_META_STYLE_ATTR}]`);
  if (link instanceof HTMLLinkElement) {
    return link;
  }
  link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./topbar-meta.css", import.meta.url).href;
  link.setAttribute(TOPBAR_META_STYLE_ATTR, "true");
  document.head.append(link);
  return link;
}

function showDialog(dialog) {
  if (!(dialog instanceof HTMLDialogElement)) {
    return;
  }
  if (typeof dialog.showModal === "function") {
    if (!dialog.open) {
      dialog.showModal();
    }
    return;
  }
  dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (!(dialog instanceof HTMLDialogElement)) {
    return;
  }
  if (typeof dialog.close === "function") {
    if (dialog.open) {
      dialog.close();
      return;
    }
  }
  dialog.removeAttribute("open");
}

function ensureTopbarMetaRoot(search) {
  const parent = search.parentElement;
  if (!(parent instanceof HTMLElement)) {
    return null;
  }
  let root = parent.querySelector(TOPBAR_META_ROOT_SELECTOR);
  if (root instanceof HTMLElement) {
    return root;
  }
  root = document.createElement("div");
  root.className = "oc-platform-topbar-meta";
  root.setAttribute("data-oc-platform-topbar-meta", "true");
  search.insertAdjacentElement("afterend", root);
  return root;
}

function ensureTopbarDialogs() {
  let root = document.body.querySelector("[data-oc-platform-dialog-root]");
  if (root instanceof HTMLElement) {
    return root;
  }
  root = document.createElement("div");
  root.setAttribute("data-oc-platform-dialog-root", "true");
  root.innerHTML = `
    <dialog class="oc-platform-topbar-dialog" data-oc-platform-profile-dialog>
      <div class="oc-platform-topbar-dialog__panel">
        <header class="oc-platform-topbar-dialog__header">
          <h3 class="oc-platform-topbar-dialog__title">当前登录</h3>
          <button class="btn" type="button" data-oc-platform-dialog-close="profile">关闭</button>
        </header>
        <div class="oc-platform-topbar-dialog__body" data-oc-platform-profile-content></div>
      </div>
    </dialog>
    <dialog class="oc-platform-topbar-dialog" data-oc-platform-logout-dialog>
      <div class="oc-platform-topbar-dialog__panel">
        <header class="oc-platform-topbar-dialog__header">
          <h3 class="oc-platform-topbar-dialog__title">确认退出</h3>
          <button class="btn" type="button" data-oc-platform-dialog-close="logout">关闭</button>
        </header>
        <div class="oc-platform-topbar-dialog__body">
          <p class="oc-platform-topbar-dialog__text">确认退出当前登录状态吗？</p>
        </div>
        <footer class="oc-platform-topbar-dialog__actions">
          <button class="btn" type="button" data-oc-platform-dialog-close="logout">取消</button>
          <button class="btn primary" type="button" data-oc-platform-confirm-logout>确认退出</button>
        </footer>
      </div>
    </dialog>
  `;
  document.body.append(root);
  return root;
}

function renderProfileDialog(session) {
  const content = document.body.querySelector("[data-oc-platform-profile-content]");
  if (!(content instanceof HTMLElement)) {
    return;
  }
  const role = String(session?.session?.role || "").trim();
  const username = String(session?.session?.username || "").trim();
  const balanceText =
    role === "tenant_admin" ? getCachedTenantWalletBalanceText(session) || "--" : "";
  content.innerHTML = `
    <dl class="oc-platform-topbar-dialog__meta">
      ${
        role === "tenant_admin"
          ? `
            <div>
              <dt>积分余额</dt>
              <dd>${balanceText}</dd>
            </div>
          `
          : ""
      }
      <div>
        <dt>当前角色</dt>
        <dd>${role}</dd>
      </div>
      <div>
        <dt>当前登录</dt>
        <dd>${username}</dd>
      </div>
    </dl>
  `;
}

function syncPlatformTopbarMeta(session) {
  const search = findTenantShellTopbar(document);
  if (!(search instanceof HTMLElement)) {
    return;
  }
  ensureTopbarMetaStyle();
  ensureTopbarDialogs();
  const root = ensureTopbarMetaRoot(search);
  if (!(root instanceof HTMLElement)) {
    return;
  }
  const role = String(session?.session?.role || "").trim();
  const username = String(session?.session?.username || "").trim();
  const balanceText =
    role === "tenant_admin" ? getCachedTenantWalletBalanceText(session) || "--" : "";
  if (
    root.getAttribute(TOPBAR_META_MODE_ATTR) === "meta" &&
    root.getAttribute(TOPBAR_META_ROLE_ATTR) === role &&
    root.getAttribute(TOPBAR_META_USER_ATTR) === username &&
    root.getAttribute(TOPBAR_META_BALANCE_ATTR) === balanceText
  ) {
    return;
  }
  search.setAttribute(TOPBAR_HIDDEN_ATTR, "true");
  root.setAttribute(TOPBAR_META_MODE_ATTR, "meta");
  root.setAttribute(TOPBAR_META_ROLE_ATTR, role);
  root.setAttribute(TOPBAR_META_USER_ATTR, username);
  root.setAttribute(TOPBAR_META_BALANCE_ATTR, balanceText);
  root.innerHTML = `
    ${
      role === "tenant_admin"
        ? `<span class="pill"><span>积分余额</span><span class="mono">${balanceText}</span></span>`
        : ""
    }
    <span class="pill"><span>当前角色</span><span class="mono">${role}</span></span>
    <button class="btn btn--ghost" type="button" data-oc-platform-profile>当前登录<span class="mono">${username}</span></button>
    <button class="btn btn--ghost" type="button" data-oc-platform-logout>退出登录</button>
  `;
  renderProfileDialog(session);
  if (role === "tenant_admin") {
    void ensureTenantWalletBalance(session);
  }
}

function clearPlatformTopbarMeta() {
  const search = findTenantShellTopbar(document);
  if (!(search instanceof HTMLElement)) {
    return;
  }
  search.removeAttribute(TOPBAR_HIDDEN_ATTR);
  const root = document.querySelector(TOPBAR_META_ROOT_SELECTOR);
  if (root instanceof HTMLElement) {
    root.remove();
  }
  for (const dialog of document.querySelectorAll(
    `${TOPBAR_PROFILE_DIALOG_SELECTOR}, ${TOPBAR_LOGOUT_DIALOG_SELECTOR}`,
  )) {
    closeDialog(dialog);
  }
}

export function resolveCanonicalTenantLoopbackHref(locationHref = window.location.href) {
  const currentHref = String(locationHref || "").trim();
  if (!currentHref) {
    return "";
  }
  const url = new URL(currentHref, document.baseURI);
  if (url.hostname !== "localhost") {
    return "";
  }
  if (!readTenantView(currentHref)) {
    return "";
  }
  const normalizedPath = normalizeTenantPathname(url.pathname);
  const sessionKey = url.searchParams.get("session")?.trim() || "";
  if (!sessionKey || (normalizedPath !== "/chat" && normalizedPath !== "/login")) {
    return "";
  }
  url.hostname = "127.0.0.1";
  return url.href;
}

function syncTenantRoleContext(role) {
  if (isTenantShellRole(role)) {
    document.documentElement.setAttribute(TENANT_ROLE_CONTEXT_ATTR, role);
    return;
  }
  document.documentElement.removeAttribute(TENANT_ROLE_CONTEXT_ATTR);
}

function ensureTopbarLogoutHandler() {
  if (document.documentElement.dataset.ocPlatformLogoutHandler === "true") {
    return;
  }
  document.documentElement.dataset.ocPlatformLogoutHandler = "true";
  tenantEntryTopbarLogoutHandler ||= async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const closeButton = target.closest(TOPBAR_DIALOG_CLOSE_SELECTOR);
    if (closeButton instanceof HTMLButtonElement) {
      event.preventDefault();
      event.stopPropagation();
      const dialogType = closeButton.dataset.ocPlatformDialogClose || "";
      if (dialogType === "profile") {
        closeDialog(document.querySelector(TOPBAR_PROFILE_DIALOG_SELECTOR));
      }
      if (dialogType === "logout") {
        closeDialog(document.querySelector(TOPBAR_LOGOUT_DIALOG_SELECTOR));
      }
      return;
    }

    const profileButton = target.closest(TOPBAR_PROFILE_SELECTOR);
    if (profileButton instanceof HTMLButtonElement) {
      event.preventDefault();
      event.stopPropagation();
      const session = readSessionForCurrentView();
      renderProfileDialog(session);
      showDialog(document.querySelector(TOPBAR_PROFILE_DIALOG_SELECTOR));
      return;
    }

    const logoutButton = target.closest(TOPBAR_LOGOUT_SELECTOR);
    if (logoutButton instanceof HTMLButtonElement) {
      event.preventDefault();
      event.stopPropagation();
      showDialog(document.querySelector(TOPBAR_LOGOUT_DIALOG_SELECTOR));
      return;
    }

    const confirmButton = target.closest(TOPBAR_DIALOG_CONFIRM_LOGOUT_SELECTOR);
    if (!(confirmButton instanceof HTMLButtonElement)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const session = readSessionForCurrentView();
    const isPlatformAdmin = session?.session?.role === "platform_admin";
    const apiClient = createTenantApiClient();
    try {
      await apiClient.logout(isPlatformAdmin ? "platform" : "tenant");
    } catch {
      // Local session is cleared in the API client before the request, so redirect anyway.
    }
    clearPlatformSession();
    clearTenantSession();
    clearSelectedTenantAgent();
    resetTenantWalletBalanceCache();
    closeDialog(document.querySelector(TOPBAR_LOGOUT_DIALOG_SELECTOR));
    clearPlatformTopbarMeta();
    navigateTenantRoute(LOGIN_ROUTE, { replace: true });
  };
  document.addEventListener("click", tenantEntryTopbarLogoutHandler);
}

function ensureTenantWalletBalanceSyncHandler() {
  if (document.documentElement.dataset.ocTenantWalletBalanceHandler === "true") {
    return;
  }
  document.documentElement.dataset.ocTenantWalletBalanceHandler = "true";
  tenantEntryWalletBalanceHandler ||= (event) => {
    const session = readSessionForCurrentView();
    if (String(session?.session?.role || "").trim() !== "tenant_admin") {
      return;
    }
    const detail = event instanceof CustomEvent ? event.detail : null;
    if (!(detail?.summary && typeof detail.summary === "object")) {
      return;
    }
    updateTenantWalletBalanceCache(session, detail?.summary);
    syncPlatformTopbarMeta(session);
  };
  window.addEventListener(TENANT_WALLET_SUMMARY_EVENT, tenantEntryWalletBalanceHandler);
}

export function bootTenantEntry() {
  if (window.__openclawTenantEntryBooted) {
    return;
  }
  if (isLufengPublicPath() || isEchartsViewPublicPath()) {
    return;
  }
  const canonicalTenantHref = resolveCanonicalTenantLoopbackHref();
  if (canonicalTenantHref) {
    window.location.replace(canonicalTenantHref);
    return;
  }
  window.__openclawTenantEntryBooted = true;
  bootTenantRouteSync();
  tenantEntryLifecycle = createTenantLifecycle();
  const shellStore = createTenantRuntimeStore();
  const shellCoordinator = createTenantShellCoordinator({
    lifecycle: tenantEntryLifecycle,
    store: shellStore,
  });
  ensureTopbarLogoutHandler();
  ensureTenantWalletBalanceSyncHandler();
  bootUpdateLogDialogs();
  const topbarRegistry = createTenantViewRegistry([
    {
      id: "auth",
      match: (context) => context.isAuthView,
      render() {
        clearPlatformTopbarMeta();
      },
    },
    {
      id: "shell",
      match: (context) => context.isShellRole,
      render(context) {
        syncPlatformTopbarMeta(context.session);
      },
    },
    {
      id: "default",
      match: () => true,
      render() {
        clearPlatformTopbarMeta();
      },
    },
  ]);

  const scan = (root = document) => {
    const context = readTenantShellContext();
    const { session, role, isAuthView, isShellRole } = context;
    const scope = root instanceof Element || root instanceof Document ? root : document;
    syncTenantRoleContext(role);
    if (role === "member" && !isAuthView) {
      ensureMemberVisualizationPolling();
      ensureMemberSandboxPolling();
    } else {
      clearMemberVisualizationPolling();
      clearMemberSandboxPolling();
    }
    topbarRegistry.findMatchingView(context)?.render?.(context);
    if (!isAuthView && isShellRole) {
      shellCoordinator.forEachShellSection(scope, {
        onSidebar(container) {
          ensureSidebarRouteHandlers(container);
          ensureManagementSection(container);
          syncSidebarNavForRole(container, role);
          if (role === "member") {
            void syncMemberVisualizationSection(container);
            void syncMemberSandboxSection(container);
          }
        },
        onUtility(container) {
          if (!role) {
            ensureTenantUtilityLink(container);
          }
          syncSidebarUtilityForRole(container, role);
        },
      });
    } else {
      shellCoordinator.forEachShellSection(scope, {
        onUtility(container) {
          if (!role) {
            ensureTenantUtilityLink(container);
          }
          syncSidebarUtilityForRole(container, role);
        },
      });
    }
  };
  tenantEntryRouteCleanup = createTenantRouteDrivenScanner(scan, {
    root: document,
    observeTarget: document.documentElement,
    isRelevantNode: shellCoordinator.isRelevantNode,
  });
  tenantEntryLifecycle.addCleanup(tenantEntryRouteCleanup);
  tenantEntryLifecycle.addCleanup(clearMemberVisualizationPolling);
  tenantEntryLifecycle.addCleanup(clearMemberSandboxPolling);
}

export function resetTenantEntryForTests() {
  tenantEntryLifecycle?.cleanup?.();
  if (typeof tenantEntryRouteCleanup === "function") {
    tenantEntryRouteCleanup();
  }
  tenantEntryRouteCleanup = null;
  tenantEntryLifecycle = null;
  clearMemberVisualizationPolling();
  MEMBER_VISUALIZATION_CACHE.clear();
  clearMemberSandboxPolling();
  MEMBER_SANDBOX_CACHE.clear();
  resetTenantWalletBalanceCache();
  if (tenantEntryTopbarLogoutHandler) {
    document.removeEventListener("click", tenantEntryTopbarLogoutHandler);
  }
  if (tenantEntryWalletBalanceHandler) {
    window.removeEventListener(TENANT_WALLET_SUMMARY_EVENT, tenantEntryWalletBalanceHandler);
  }
  document.documentElement.removeAttribute(TENANT_ROLE_CONTEXT_ATTR);
  delete document.documentElement.dataset.ocPlatformLogoutHandler;
  delete document.documentElement.dataset.ocTenantWalletBalanceHandler;
  clearPlatformTopbarMeta();
  document.querySelector("[data-oc-platform-dialog-root]")?.remove();
  document.head.querySelector(`[${TOPBAR_META_STYLE_ATTR}]`)?.remove();
  resetUpdateLogDialogsForTests();
  resetTenantRouteSyncForTests();
  delete window.__openclawTenantEntryBooted;
}
