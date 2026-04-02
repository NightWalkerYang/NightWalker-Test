import { createTenantApiClient } from "./api-client.js";
import { requireTenantSession } from "./tenant-context.js";
import { readSelectedTenantAgentId } from "./chat-shell.js";

const PAGE_SELECTOR = "[data-oc-tenant-chat-page]";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function bootTenantChatPage() {
  const root = document.querySelector(PAGE_SELECTOR);
  if (!(root instanceof HTMLElement)) {
    return null;
  }
  const session = requireTenantSession(["member"]);
  if (!session) {
    return null;
  }
  const tenantAgentId = readSelectedTenantAgentId();
  const apiClient = createTenantApiClient();
  const agents = await apiClient.listMemberAgents();
  const agent = agents.find((item) => item.id === tenantAgentId) ?? agents[0] ?? null;

  const title = root.querySelector("[data-tenant-chat-title]");
  if (title instanceof HTMLElement) {
    title.textContent = agent?.agentName || "未分配 Agent";
  }

  const info = root.querySelector("[data-tenant-chat-info]");
  if (info instanceof HTMLElement) {
    info.innerHTML = agent
      ? `
          <strong>${escapeHtml(agent.agentName)}</strong><br/>
          当前剩余积分：${escapeHtml(agent.balancePoints ?? 0)}<br/>
          当前状态：${escapeHtml(agent.status)}
        `
      : "当前没有可进入的 Agent。";
  }
  return { root };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootTenantChatPage();
  });
} else {
  void bootTenantChatPage();
}

