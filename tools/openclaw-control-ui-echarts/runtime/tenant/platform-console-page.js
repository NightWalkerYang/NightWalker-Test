import { createTenantApiClient } from "./api-client.js";
import {
  PLATFORM_AGENT_ASSIGNMENT_VIEW,
  PLATFORM_LOGIN_ROUTE,
  PLATFORM_TENANT_MANAGEMENT_VIEW,
  requireTenantSession,
} from "./tenant-context.js";

const PAGE_SELECTOR = "[data-oc-platform-tenant-console-page]";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isEmbedded(root) {
  return root?.dataset?.ocPlatformEmbedded === "true";
}

function currentSectionHref(section) {
  return section === "agent-allocation"
    ? `./?ocTenantView=${PLATFORM_AGENT_ASSIGNMENT_VIEW}`
    : `./?ocTenantView=${PLATFORM_TENANT_MANAGEMENT_VIEW}`;
}

function setFeedback(root, text, isError = false) {
  const feedback = root.querySelector("[data-tenant-feedback]");
  if (!(feedback instanceof HTMLElement)) {
    return;
  }
  feedback.hidden = !text;
  feedback.textContent = text;
  if (isEmbedded(root)) {
    feedback.className = `callout ${isError ? "danger" : "info"} oc-platform-surface-feedback`;
  } else {
    feedback.classList.toggle("tenant-feedback--danger", isError);
  }
}

function formatNumber(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? new Intl.NumberFormat("zh-CN").format(numeric) : "0";
}

function renderMetrics(root, tenants) {
  const container = root.querySelector("[data-platform-metrics]");
  if (!(container instanceof HTMLElement)) {
    return;
  }
  const totalTenants = tenants.length;
  const cloudTenants = tenants.filter((tenant) => tenant.deploymentMode === "cloud").length;
  const localTenants = totalTenants - cloudTenants;
  const totalMembers = tenants.reduce((sum, tenant) => sum + Number(tenant.memberCount || 0), 0);
  const totalWallet = tenants.reduce((sum, tenant) => sum + Number(tenant.walletBalance || 0), 0);
  const totalAgents = tenants.reduce((sum, tenant) => sum + Number(tenant.agentCount || 0), 0);
  const metricItems = [
    { label: "租户总数", value: formatNumber(totalTenants) },
    { label: "公有云租户", value: formatNumber(cloudTenants) },
    { label: "本地部署", value: formatNumber(localTenants) },
    { label: "成员总数", value: formatNumber(totalMembers) },
    { label: "钱包总积分", value: formatNumber(totalWallet) },
    { label: "已分配 Agent", value: formatNumber(totalAgents) },
  ];
  container.innerHTML = metricItems
    .map(
      (metric) => `
        <article class="stat stat-card">
          <span class="stat-label">${escapeHtml(metric.label)}</span>
          <strong class="stat-value">${escapeHtml(metric.value)}</strong>
        </article>
      `,
    )
    .join("");
}

function renderTenantRows(root, tenants, selectedTenantId) {
  const container = root.querySelector("[data-platform-tenant-list]");
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (!tenants.length) {
    container.innerHTML = `<div class="callout info">当前还没有租户，请先创建第一家租户。</div>`;
    return;
  }
  container.innerHTML = `
    <div class="list">
      ${tenants
        .map(
          (tenant) => `
            <button
              class="list-item list-item-clickable${tenant.id === selectedTenantId ? " list-item-selected" : ""}"
              type="button"
              data-platform-tenant-id="${escapeHtml(tenant.id)}"
            >
              <div class="list-main">
                <div class="list-title">${escapeHtml(tenant.name)}</div>
                <div class="list-sub">${escapeHtml(tenant.code)} · ${escapeHtml(tenant.deploymentMode === "local" ? "本地部署" : "公有云")}</div>
                <div class="list-sub">到期：${escapeHtml(tenant.licenseExpiresAt || "-")}</div>
              </div>
              <div class="list-meta">
                <div>成员 ${formatNumber(tenant.memberCount)}</div>
                <div>钱包 ${formatNumber(tenant.walletBalance)} 积分</div>
                <div>Agent ${formatNumber(tenant.agentCount)}</div>
              </div>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderTenantSummary(root, tenant) {
  const container = root.querySelector("[data-platform-selected-tenant]");
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (!tenant) {
    container.innerHTML = `<div class="callout info">请选择左侧租户，查看详情并分配 Agent。</div>`;
    return;
  }
  container.innerHTML = `
    <div class="list">
      <article class="list-item">
        <div class="list-main">
          <div class="list-title">${escapeHtml(tenant.name)}</div>
          <div class="list-sub">${escapeHtml(tenant.code)} · ${escapeHtml(tenant.status)} · ${escapeHtml(tenant.deploymentMode === "local" ? "本地部署" : "公有云")}</div>
        </div>
        <div class="list-meta">
          <div>人数上限 ${formatNumber(tenant.memberLimit)}</div>
          <div>当前成员 ${formatNumber(tenant.memberCount)}</div>
          <div>钱包余额 ${formatNumber(tenant.walletBalance)} 积分</div>
          <div>已分配 Agent ${formatNumber(tenant.agentCount)}</div>
        </div>
      </article>
    </div>
  `;
}

function renderTenantMembers(root, members) {
  const container = root.querySelector("[data-platform-tenant-members]");
  if (!(container instanceof HTMLElement)) {
    return;
  }
  container.innerHTML = members.length
    ? `
      <div class="list">
        ${members
          .map(
            (member) => `
              <article class="list-item">
                <div class="list-main">
                  <div class="list-title">${escapeHtml(member.username)}</div>
                  <div class="list-sub">成员状态：${escapeHtml(member.status)}</div>
                </div>
                <div class="list-meta">
                  <div>已分配 ${formatNumber(member.assignedAgentCount)} 个 Agent</div>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    `
    : `<div class="callout info">当前租户还没有成员。</div>`;
}

function renderTenantAgents(root, agents) {
  const container = root.querySelector("[data-platform-tenant-agents]");
  if (!(container instanceof HTMLElement)) {
    return;
  }
  container.innerHTML = agents.length
    ? `
      <div class="list">
        ${agents
          .map(
            (agent) => `
              <article class="list-item">
                <div class="list-main">
                  <div class="list-title">${escapeHtml(agent.agentName)}</div>
                  <div class="list-sub">${escapeHtml(agent.description || "暂未填写租户侧描述。")}</div>
                </div>
                <div class="list-meta">
                  <div>状态 ${escapeHtml(agent.status)}</div>
                  <div>${formatNumber(agent.balancePoints)} 积分</div>
                  <div>倍率 ${escapeHtml(agent.rateMultiplier ?? 1)}</div>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    `
    : `<div class="callout info">当前租户还没有被平台分配 Agent。</div>`;
}

function fillTenantSelect(root, tenants, selectedTenantId) {
  const select = root.querySelector('[name="tenantId"]');
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  select.innerHTML =
    `<option value="">请选择租户</option>` +
    tenants
      .map(
        (tenant) =>
          `<option value="${escapeHtml(tenant.id)}"${tenant.id === selectedTenantId ? " selected" : ""}>${escapeHtml(tenant.name)} · ${escapeHtml(tenant.code)}</option>`,
      )
      .join("");
}

function fillCatalogSelect(root, agents) {
  const select = root.querySelector('[name="agentId"]');
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  select.innerHTML =
    `<option value="">请选择 OpenClaw Agent</option>` +
    agents
      .map(
        (agent) =>
          `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.name)}</option>`,
      )
      .join("");
}

export async function mountPlatformConsolePage(root, options = {}) {
  if (!(root instanceof HTMLElement)) {
    return null;
  }

  const session = requireTenantSession(["platform_admin"], { loginHref: PLATFORM_LOGIN_ROUTE });
  if (!session) {
    return null;
  }

  const section = options.section || "tenants";
  const apiClient = createTenantApiClient();
  const state = {
    tenants: [],
    selectedTenantId: "",
  };

  root.querySelector("[data-platform-username]")?.replaceChildren(
    document.createTextNode(session.session.username),
  );

  const sectionLinks = root.querySelectorAll("[href]");
  for (const link of sectionLinks) {
    if (!(link instanceof HTMLAnchorElement)) {
      continue;
    }
    const href = link.getAttribute("href") || "";
    if (href === currentSectionHref("tenants")) {
      link.classList.toggle("active", section === "tenants");
    }
    if (href === currentSectionHref("agent-allocation")) {
      link.classList.toggle("active", section === "agent-allocation");
    }
  }

  async function refreshSelectedTenant() {
    const tenant = state.tenants.find((item) => item.id === state.selectedTenantId) ?? null;
    renderTenantSummary(root, tenant);
    if (!tenant) {
      renderTenantMembers(root, []);
      renderTenantAgents(root, []);
      return;
    }
    const [members, agents] = await Promise.all([
      apiClient.listPlatformTenantMembers(tenant.id),
      apiClient.listPlatformTenantAgents(tenant.id),
    ]);
    renderTenantMembers(root, members);
    renderTenantAgents(root, agents);
  }

  async function refresh() {
    const [tenants, catalogAgents] = await Promise.all([
      apiClient.listPlatformTenants(),
      apiClient.listPlatformCatalogAgents(),
    ]);
    state.tenants = tenants;
    if (!state.selectedTenantId || !tenants.some((tenant) => tenant.id === state.selectedTenantId)) {
      state.selectedTenantId = tenants[0]?.id || "";
    }
    renderMetrics(root, tenants);
    renderTenantRows(root, tenants, state.selectedTenantId);
    fillTenantSelect(root, tenants, state.selectedTenantId);
    fillCatalogSelect(root, catalogAgents);
    await refreshSelectedTenant();
  }

  root.querySelector("[data-platform-tenant-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const created = await apiClient.createTenant(payload);
      state.selectedTenantId = created?.id || state.selectedTenantId;
      form.reset();
      await refresh();
      setFeedback(root, "租户已创建，已自动切换到新租户。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
  });

  root.querySelector("[data-platform-agent-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      if (payload.tenantId) {
        state.selectedTenantId = String(payload.tenantId);
      }
      await apiClient.upsertPlatformTenantAgent(payload);
      form.reset();
      await refresh();
      setFeedback(root, "平台已将 Agent 下发到目标租户。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
  });

  root.querySelector("[data-platform-tenant-list]")?.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const row = target.closest("[data-platform-tenant-id]");
    if (!(row instanceof HTMLElement)) {
      return;
    }
    state.selectedTenantId = row.dataset.platformTenantId || "";
    renderTenantRows(root, state.tenants, state.selectedTenantId);
    fillTenantSelect(root, state.tenants, state.selectedTenantId);
    await refreshSelectedTenant();
  });

  root.querySelector("[data-platform-logout]")?.addEventListener("click", async () => {
    await apiClient.logout();
    window.location.href = PLATFORM_LOGIN_ROUTE;
  });

  try {
    await refresh();
    setFeedback(root, "平台租户数据已加载。");
  } catch (error) {
    setFeedback(root, error instanceof Error ? error.message : String(error), true);
  }

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
