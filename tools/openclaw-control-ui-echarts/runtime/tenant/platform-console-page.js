import { createTenantApiClient } from "./api-client.js";
import { PLATFORM_LOGIN_ROUTE, requireTenantSession } from "./tenant-context.js";

const PAGE_SELECTOR = "[data-oc-platform-tenant-console-page]";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setFeedback(root, text, isError = false) {
  const feedback = root.querySelector("[data-tenant-feedback]");
  if (!(feedback instanceof HTMLElement)) {
    return;
  }
  feedback.textContent = text;
  feedback.classList.toggle("tenant-feedback--danger", isError);
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
    { label: "租户总数", value: formatNumber(totalTenants), hint: "平台正在托管的租户数量" },
    { label: "公有云租户", value: formatNumber(cloudTenants), hint: "走在线充值和积分扣费" },
    { label: "本地部署", value: formatNumber(localTenants), hint: "走 License 与只读到期控制" },
    { label: "成员总数", value: formatNumber(totalMembers), hint: "当前启用成员账号数" },
    { label: "钱包总积分", value: formatNumber(totalWallet), hint: "所有租户钱包余额汇总" },
    { label: "已分配 Agent", value: formatNumber(totalAgents), hint: "平台下发到租户侧的 Agent 数" },
  ];
  container.innerHTML = metricItems
    .map(
      (metric) => `
        <article class="tenant-metric-card">
          <span class="tenant-metric-card__label">${escapeHtml(metric.label)}</span>
          <strong class="tenant-metric-card__value">${escapeHtml(metric.value)}</strong>
          <span class="tenant-metric-card__hint">${escapeHtml(metric.hint)}</span>
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
    container.innerHTML = `<div class="tenant-empty">当前还没有租户，请先创建第一家租户。</div>`;
    return;
  }
  container.innerHTML = `
    <div class="tenant-table">
      <div class="tenant-table__head">
        <span>租户</span>
        <span>部署</span>
        <span>成员</span>
        <span>钱包</span>
        <span>Agent</span>
        <span>到期</span>
      </div>
      ${tenants
        .map(
          (tenant) => `
            <button
              class="tenant-table__row${tenant.id === selectedTenantId ? " tenant-table__row--selected" : ""}"
              type="button"
              data-platform-tenant-id="${escapeHtml(tenant.id)}"
            >
              <span>
                <strong>${escapeHtml(tenant.name)}</strong>
                <small>${escapeHtml(tenant.code)}</small>
              </span>
              <span>${escapeHtml(tenant.deploymentMode === "local" ? "本地部署" : "公有云")}</span>
              <span>${formatNumber(tenant.memberCount)}</span>
              <span>${formatNumber(tenant.walletBalance)} 积分</span>
              <span>${formatNumber(tenant.agentCount)}</span>
              <span>${escapeHtml(tenant.licenseExpiresAt || "-")}</span>
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
    container.innerHTML = `<div class="tenant-empty">请选择左侧租户，查看详情并分配 Agent。</div>`;
    return;
  }
  container.innerHTML = `
    <div class="tenant-item">
      <div class="tenant-item__row">
        <div class="tenant-item__title">${escapeHtml(tenant.name)}</div>
        <span class="tenant-chip">${escapeHtml(tenant.code)}</span>
        <span class="tenant-chip">${escapeHtml(tenant.status)}</span>
        <span class="tenant-chip">${escapeHtml(tenant.deploymentMode === "local" ? "本地部署" : "公有云")}</span>
      </div>
      <div class="tenant-kv" style="margin-top: 16px;">
        <div><span>人数上限</span><strong>${formatNumber(tenant.memberLimit)}</strong></div>
        <div><span>当前成员</span><strong>${formatNumber(tenant.memberCount)}</strong></div>
        <div><span>钱包余额</span><strong>${formatNumber(tenant.walletBalance)} 积分</strong></div>
        <div><span>已分配 Agent</span><strong>${formatNumber(tenant.agentCount)}</strong></div>
      </div>
    </div>
  `;
}

function renderTenantMembers(root, members) {
  const container = root.querySelector("[data-platform-tenant-members]");
  if (!(container instanceof HTMLElement)) {
    return;
  }
  container.innerHTML = members.length
    ? members
        .map(
          (member) => `
            <article class="tenant-item tenant-item--compact">
              <div class="tenant-item__row">
                <div class="tenant-item__title">${escapeHtml(member.username)}</div>
                <span class="tenant-chip">${escapeHtml(member.status)}</span>
                <span>已分配 ${formatNumber(member.assignedAgentCount)} 个 Agent</span>
              </div>
            </article>
          `,
        )
        .join("")
    : `<div class="tenant-empty">当前租户还没有成员。</div>`;
}

function renderTenantAgents(root, agents) {
  const container = root.querySelector("[data-platform-tenant-agents]");
  if (!(container instanceof HTMLElement)) {
    return;
  }
  container.innerHTML = agents.length
    ? agents
        .map(
          (agent) => `
            <article class="tenant-item tenant-item--compact">
              <div class="tenant-item__row">
                <div class="tenant-item__title">${escapeHtml(agent.agentName)}</div>
                <span class="tenant-chip">${escapeHtml(agent.status)}</span>
                <span>${formatNumber(agent.balancePoints)} 积分</span>
                <span>倍率 ${escapeHtml(agent.rateMultiplier ?? 1)}</span>
              </div>
              <div class="tenant-subtitle">${escapeHtml(agent.description || "暂未填写租户侧描述。")}</div>
            </article>
          `,
        )
        .join("")
    : `<div class="tenant-empty">当前租户还没有被平台分配 Agent。</div>`;
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

export async function bootPlatformTenantConsolePage() {
  const root = document.querySelector(PAGE_SELECTOR);
  if (!(root instanceof HTMLElement)) {
    return null;
  }
  const session = requireTenantSession(["platform_admin"], { loginHref: PLATFORM_LOGIN_ROUTE });
  if (!session) {
    return null;
  }

  const apiClient = createTenantApiClient();
  const state = {
    tenants: [],
    selectedTenantId: "",
  };

  root.querySelector("[data-platform-username]")?.replaceChildren(
    document.createTextNode(session.session.username),
  );

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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootPlatformTenantConsolePage();
  });
} else {
  void bootPlatformTenantConsolePage();
}
