import { createTenantApiClient } from "./api-client.js";
import {
  TENANT_LOGIN_ROUTE,
  buildTenantMemberChatRoute,
  isLocalEditionSession,
  isReadonlySession,
  requireTenantSession,
  writeSelectedTenantAgent,
} from "./tenant-context.js";
import { navigateTenantRoute } from "./route-sync.js";

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
  feedback.hidden = !text;
  feedback.textContent = text;
  feedback.className = `callout ${isError ? "danger" : "info"} oc-member-surface-feedback`;
}

function renderAvatar(agent) {
  if (agent.avatar) {
    return `<img src="${escapeHtml(agent.avatar)}" alt="${escapeHtml(agent.agentName)}" />`;
  }
  return escapeHtml(agent.emoji || "AI");
}

function statusLabel(agent, localEdition) {
  if (agent.status !== "active") {
    return "已停用";
  }
  if (!localEdition && (agent.balancePoints ?? 0) <= 0) {
    return "预算不足";
  }
  return "正常";
}

function createController(root, session, apiClient) {
  if (root.__ocTenantMemberController) {
    root.__ocTenantMemberController.session = session;
    return root.__ocTenantMemberController;
  }

  const controller = {
    apiClient,
    session,
    agents: [],
  };

  root.__ocTenantMemberController = controller;
  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const trigger = target.closest("[data-member-open-chat]");
    if (!(trigger instanceof HTMLElement)) {
      return;
    }
    const agentId = String(trigger.dataset.memberOpenChat || "").trim();
    const agent = controller.agents.find((item) => item.id === agentId);
    if (!agent) {
      return;
    }
    writeSelectedTenantAgent(agent);
    navigateTenantRoute(buildTenantMemberChatRoute(agent.id));
  });

  return controller;
}

function render(root, controller) {
  const localEdition = isLocalEditionSession(controller.session);
  root.dataset.ocTenantEmbedded = "true";
  root.innerHTML = `
    <section class="oc-member-agent-view">
      <section class="oc-member-agent-grid" data-member-agent-grid>
        ${
          controller.agents.length
            ? controller.agents
                .map(
                  (agent) => `
                    <article class="oc-member-agent-card">
                      <div class="oc-member-agent-card__head">
                        <div class="oc-member-agent-card__avatar">${renderAvatar(agent)}</div>
                        <div class="oc-member-agent-card__meta">
                          <h2 class="oc-member-agent-card__title">${escapeHtml(agent.agentName)}</h2>
                          <span class="oc-member-agent-card__status">${escapeHtml(statusLabel(agent, localEdition))}</span>
                        </div>
                      </div>
                      <p class="oc-member-agent-card__desc">${escapeHtml(agent.description || "该 Agent 描述将由租户平台单独维护。")}</p>
                      ${
                        localEdition
                          ? ""
                          : `<div class="oc-member-agent-card__points">剩余积分 ${escapeHtml(agent.balancePoints ?? 0)}</div>`
                      }
                      <div class="oc-member-agent-card__actions">
                        <button class="btn primary" type="button" data-member-open-chat="${escapeHtml(agent.id)}">进入聊天</button>
                      </div>
                    </article>
                  `,
                )
                .join("")
            : `<div class="oc-member-agent-empty">当前没有已分配的 Agent，请联系租户管理员。</div>`
        }
      </section>
      <div class="callout info oc-member-surface-feedback" data-tenant-feedback hidden></div>
    </section>
  `;
}

export async function mountMemberConsolePage(root) {
  if (!(root instanceof HTMLElement)) {
    return null;
  }

  const session = requireTenantSession(["member"], { loginHref: TENANT_LOGIN_ROUTE });
  if (!session) {
    return null;
  }

  const apiClient = createTenantApiClient();
  const controller = createController(root, session, apiClient);

  try {
    controller.agents = await apiClient.listMemberAgents();
    render(root, controller);
    setFeedback(
      root,
      isReadonlySession(session)
        ? "当前授权已到期，仅允许只读查看历史和统计。"
        : "请选择一个已分配的 Agent 继续使用。",
    );
  } catch (error) {
    render(root, controller);
    setFeedback(root, error instanceof Error ? error.message : String(error), true);
  }

  return { root };
}
