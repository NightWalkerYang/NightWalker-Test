import { createTenantApiClient } from "./api-client.js";
import { TENANT_LOGIN_ROUTE, requireTenantSession } from "./tenant-context.js";

const PAGE_SELECTOR = "[data-oc-tenant-admin-page]";

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

function renderMembers(root, members) {
  const container = root.querySelector("[data-tenant-members]");
  const memberSelect = root.querySelector('[name="userId"]');
  if (container instanceof HTMLElement) {
    container.innerHTML = members.length
      ? members
          .map(
            (member) => `
              <article class="tenant-item">
                <div class="tenant-item__row">
                  <div class="tenant-item__title">${escapeHtml(member.username)}</div>
                  <span class="tenant-chip">${escapeHtml(member.status)}</span>
                  <span>已分配 ${member.assignedAgentCount} 个 Agent</span>
                </div>
              </article>
            `,
          )
          .join("")
      : `<div class="tenant-empty">当前还没有成员，请先新增成员账号。</div>`;
  }

  if (memberSelect instanceof HTMLSelectElement) {
    memberSelect.innerHTML =
      `<option value="">请选择成员</option>` +
      members
        .map(
          (member) =>
            `<option value="${escapeHtml(member.id)}">${escapeHtml(member.username)}</option>`,
        )
        .join("");
  }
}

function renderTenantAgents(root, agents) {
  const container = root.querySelector("[data-tenant-agent-list]");
  const agentSelect = root.querySelector('[name="tenantAgentId"]');
  if (container instanceof HTMLElement) {
    container.innerHTML = agents.length
      ? agents
          .map(
            (agent) => `
              <article class="tenant-item">
                <div class="tenant-item__row">
                  <div class="tenant-item__title">${escapeHtml(agent.agentName)}</div>
                  <span class="tenant-chip">${escapeHtml(agent.status)}</span>
                  <span>${agent.balancePoints ?? 0} 积分</span>
                  <span>倍率 ${agent.rateMultiplier ?? 1}</span>
                </div>
                <div class="tenant-subtitle">${escapeHtml(agent.description || "平台管理员尚未维护该 Agent 描述。")}</div>
              </article>
            `,
          )
          .join("")
      : `<div class="tenant-empty">平台管理员还没有给本租户分配 Agent。</div>`;
  }

  if (agentSelect instanceof HTMLSelectElement) {
    agentSelect.innerHTML =
      `<option value="">请选择租户可用 Agent</option>` +
      agents
        .map(
          (agent) =>
            `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.agentName)} · ${agent.balancePoints ?? 0} 积分</option>`,
        )
        .join("");
  }
}

export async function bootTenantAdminPage() {
  const root = document.querySelector(PAGE_SELECTOR);
  if (!(root instanceof HTMLElement)) {
    return null;
  }
  const session = requireTenantSession(["tenant_admin"], { loginHref: TENANT_LOGIN_ROUTE });
  if (!session) {
    return null;
  }

  const apiClient = createTenantApiClient();
  root.querySelector("[data-tenant-admin-name]")?.replaceChildren(
    document.createTextNode(session.session.username),
  );
  root.querySelector("[data-tenant-admin-tenant]")?.replaceChildren(
    document.createTextNode(session.session.tenantName || "当前租户"),
  );

  async function refresh() {
    const [members, tenantAgents] = await Promise.all([
      apiClient.listTenantMembers(),
      apiClient.listTenantAgents(),
    ]);
    renderMembers(root, members);
    renderTenantAgents(root, tenantAgents);
  }

  root.querySelector("[data-tenant-member-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      await apiClient.createTenantMember(payload);
      form.reset();
      await refresh();
      setFeedback(root, "成员已创建。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
  });

  root.querySelector("[data-tenant-assignment-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      await apiClient.assignTenantAgent(payload);
      form.reset();
      await refresh();
      setFeedback(root, "成员 Agent 分配已生效。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
  });

  root.querySelector("[data-tenant-admin-logout]")?.addEventListener("click", async () => {
    await apiClient.logout();
    window.location.href = TENANT_LOGIN_ROUTE;
  });

  try {
    await refresh();
    setFeedback(root, "租户成员与 Agent 分配数据已加载。");
  } catch (error) {
    setFeedback(root, error instanceof Error ? error.message : String(error), true);
  }
  return { root };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootTenantAdminPage();
  });
} else {
  void bootTenantAdminPage();
}
