import { createTenantApiClient } from "./api-client.js";
import { TENANT_LOGIN_ROUTE, requireTenantSession } from "./tenant-context.js";

const PAGE_SELECTOR = "[data-oc-tenant-agent-selector-page]";

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

function renderAvatar(agent) {
  if (agent.avatar) {
    return `<img src="${escapeHtml(agent.avatar)}" alt="${escapeHtml(agent.agentName)}" />`;
  }
  return escapeHtml(agent.emoji || "AI");
}

function statusLabel(agent) {
  if (agent.status !== "active") {
    return "已停用";
  }
  if ((agent.balancePoints ?? 0) <= 0) {
    return "预算不足";
  }
  return "正常";
}

function renderAgents(root, agents) {
  const container = root.querySelector("[data-tenant-agents]");
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (!agents.length) {
    container.innerHTML = `<div class="tenant-empty">当前没有可用 Agent，请联系租户管理员分配。</div>`;
    return;
  }
  container.innerHTML = agents
    .map(
      (agent) => `
        <article class="tenant-agent-card">
          <div class="tenant-agent-card__head">
            <div class="tenant-agent-card__avatar">${renderAvatar(agent)}</div>
            <div>
              <h2 class="tenant-agent-card__title">${escapeHtml(agent.agentName)}</h2>
              <span class="tenant-chip">${escapeHtml(statusLabel(agent))}</span>
            </div>
          </div>
          <p class="tenant-agent-card__desc">${escapeHtml(agent.description || "该 Agent 描述将由租户平台单独维护。")}</p>
          <div class="tenant-item__row">
            <span>剩余积分 ${agent.balancePoints ?? 0}</span>
          </div>
          <div class="tenant-actions" style="margin-top:14px;">
            <a class="tenant-btn tenant-btn--primary" href="./tenant-chat.html?tenantAgentId=${encodeURIComponent(agent.id)}">进入聊天</a>
          </div>
        </article>
      `,
    )
    .join("");
}

export async function bootTenantAgentSelectorPage() {
  const root = document.querySelector(PAGE_SELECTOR);
  if (!(root instanceof HTMLElement)) {
    return null;
  }
  const session = requireTenantSession(["member"]);
  if (!session) {
    return null;
  }
  const apiClient = createTenantApiClient();
  root.querySelector("[data-tenant-member-name]")?.replaceChildren(document.createTextNode(session.session.username));

  try {
    const agents = await apiClient.listMemberAgents();
    renderAgents(root, agents);
    setFeedback(root, "请选择一个已分配的 Agent 继续使用。");
  } catch (error) {
    setFeedback(root, error instanceof Error ? error.message : String(error), true);
  }

  root.querySelector("[data-tenant-member-logout]")?.addEventListener("click", async () => {
    await apiClient.logout("tenant");
    window.location.href = TENANT_LOGIN_ROUTE;
  });
  return { root };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootTenantAgentSelectorPage();
  });
} else {
  void bootTenantAgentSelectorPage();
}
