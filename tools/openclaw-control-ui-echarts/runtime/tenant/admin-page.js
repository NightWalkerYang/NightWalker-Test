import { createTenantApiClient } from "./api-client.js";
import { requireTenantSession } from "./tenant-context.js";

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
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (!members.length) {
    container.innerHTML = `<div class="tenant-empty">当前还没有成员，请先新增成员账号。</div>`;
    return;
  }
  container.innerHTML = members
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
    .join("");
}

function renderTenantAgents(root, agents) {
  const container = root.querySelector("[data-tenant-agent-list]");
  const select = root.querySelector('[name="tenantAgentId"]');
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
                <div class="tenant-subtitle">${escapeHtml(agent.description || "暂无描述")}</div>
              </article>
            `,
          )
          .join("")
      : `<div class="tenant-empty">当前还没有为本租户分配 Agent。</div>`;
  }

  if (select instanceof HTMLSelectElement) {
    select.innerHTML =
      `<option value="">请选择已分配到租户的 Agent</option>` +
      agents
        .map(
          (agent) =>
            `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.agentName)} · ${agent.balancePoints ?? 0} 积分</option>`,
        )
        .join("");
  }
}

function renderCatalog(root, agents) {
  const select = root.querySelector('[name="agentId"]');
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  select.innerHTML =
    `<option value="">请选择 OpenClaw Agent</option>` +
    agents
      .map((agent) => `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.name)}</option>`)
      .join("");
}

function renderMemberSelect(root, members) {
  const select = root.querySelector('[name="userId"]');
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  select.innerHTML =
    `<option value="">请选择成员</option>` +
    members
      .map((member) => `<option value="${escapeHtml(member.id)}">${escapeHtml(member.username)}</option>`)
      .join("");
}

export async function bootTenantAdminPage() {
  const root = document.querySelector(PAGE_SELECTOR);
  if (!(root instanceof HTMLElement)) {
    return null;
  }
  const session = requireTenantSession(["tenant_admin"]);
  if (!session) {
    return null;
  }

  const apiClient = createTenantApiClient();

  async function refresh() {
    const [members, catalogAgents, tenantAgents] = await Promise.all([
      apiClient.listTenantMembers(),
      apiClient.listCatalogAgents(),
      apiClient.listTenantAgents(),
    ]);
    renderMembers(root, members);
    renderMemberSelect(root, members);
    renderCatalog(root, catalogAgents);
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

  root.querySelector("[data-tenant-agent-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      await apiClient.upsertTenantAgent(payload);
      form.reset();
      await refresh();
      setFeedback(root, "租户 Agent 已更新。");
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
    window.location.href = "./tenant-login.html";
  });

  try {
    await refresh();
    setFeedback(root, "租户管理数据已加载。");
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
