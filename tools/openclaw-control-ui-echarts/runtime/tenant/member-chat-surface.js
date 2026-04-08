import {
  readSelectedTenantAgent,
  readTenantSession,
} from "./tenant-context.js";

function isMemberChatRoute(pathname = window.location.pathname, href = window.location.href) {
  const normalizedPath = String(pathname || "/").trim() || "/";
  if (normalizedPath !== "/chat") {
    return false;
  }
  const session = readTenantSession();
  if (session?.session?.role !== "member") {
    return false;
  }
  const selectedAgent = readSelectedTenantAgent(href);
  return Boolean(selectedAgent?.id && selectedAgent?.agentId);
}

function selectedSessionKey(selectedAgent) {
  return `agent:${selectedAgent.agentId}:tenant-${selectedAgent.id}`;
}

function pinMemberChatSession(app) {
  if (!(app instanceof HTMLElement)) {
    return;
  }
  const selectedAgent = readSelectedTenantAgent();
  if (!selectedAgent?.id || !selectedAgent?.agentId) {
    return;
  }
  const sessionKey = selectedSessionKey(selectedAgent);

  if (!app.__openclawTenantMemberPatched) {
    if (typeof app.setTab === "function") {
      const originalSetTab = app.setTab.bind(app);
      app.setTab = () => originalSetTab("chat");
    }
    if (typeof app.applySettings === "function") {
      const originalApplySettings = app.applySettings.bind(app);
      app.applySettings = (next) =>
        originalApplySettings({
          ...next,
          sessionKey,
          lastActiveSessionKey: sessionKey,
        });
    }
    app.__openclawTenantMemberPatched = true;
  }

  if (typeof app.setTab === "function" && app.tab !== "chat") {
    app.setTab("chat");
  }

  if (app.sessionKey !== sessionKey) {
    app.sessionKey = sessionKey;
    if (typeof app.applySettings === "function" && app.settings) {
      app.applySettings({
        ...app.settings,
        sessionKey,
        lastActiveSessionKey: sessionKey,
      });
    }
    if (typeof app.loadAssistantIdentity === "function") {
      void app.loadAssistantIdentity();
    }
  }
}

function syncMemberChatSurface() {
  if (!isMemberChatRoute()) {
    document.documentElement.removeAttribute("data-oc-member-chat-route");
    document.body?.removeAttribute("data-oc-member-chat-route");
    return;
  }

  document.documentElement.setAttribute("data-oc-member-chat-route", "true");
  document.body?.setAttribute("data-oc-member-chat-route", "true");
  pinMemberChatSession(document.querySelector("openclaw-app"));
}

export function bootMemberChatSurface() {
  syncMemberChatSurface();

  if (window.__openclawMemberChatSurfaceBooted) {
    return;
  }
  window.__openclawMemberChatSurfaceBooted = true;

  const observer = new MutationObserver(() => {
    syncMemberChatSurface();
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
  });

  window.addEventListener("popstate", syncMemberChatSurface);
  window.setInterval(syncMemberChatSurface, 800);
}
