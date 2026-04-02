import { LUFENG_ROUTE, LUFENG_SESSION_KEY, isLufengPublicPath, normalizeLufengRouteUrl } from "./context.js";

const STYLE_ATTR = "data-oc-lufeng-style";

function ensureStyle() {
  let link = document.head.querySelector(`[${STYLE_ATTR}]`);
  if (link instanceof HTMLLinkElement) {
    return link;
  }
  link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./surface.css", import.meta.url).href;
  link.setAttribute(STYLE_ATTR, "true");
  document.head.append(link);
  return link;
}

function normalizeLufengLocation() {
  const normalized = normalizeLufengRouteUrl(window.location.href, window.location.href);
  if (
    normalized.pathname !== window.location.pathname ||
    normalized.search !== window.location.search
  ) {
    window.history.replaceState({}, "", normalized.toString());
  }
}

function pinPublicChatSession(app) {
  if (!(app instanceof HTMLElement)) {
    return;
  }

  if (!app.__openclawLufengPatched) {
    if (typeof app.setTab === "function") {
      const originalSetTab = app.setTab.bind(app);
      app.setTab = () => originalSetTab("chat");
    }
    if (typeof app.applySettings === "function") {
      const originalApplySettings = app.applySettings.bind(app);
      app.applySettings = (next) =>
        originalApplySettings({
          ...next,
          sessionKey: LUFENG_SESSION_KEY,
          lastActiveSessionKey: LUFENG_SESSION_KEY,
        });
    }
    app.__openclawLufengPatched = true;
  }

  if (typeof app.setTab === "function" && app.tab !== "chat") {
    app.setTab("chat");
  }

  if (app.sessionKey !== LUFENG_SESSION_KEY) {
    app.sessionKey = LUFENG_SESSION_KEY;
    if (typeof app.applySettings === "function" && app.settings) {
      app.applySettings({
        ...app.settings,
        sessionKey: LUFENG_SESSION_KEY,
        lastActiveSessionKey: LUFENG_SESSION_KEY,
      });
    }
    if (typeof app.loadAssistantIdentity === "function") {
      void app.loadAssistantIdentity();
    }
  }
}

function syncLufengSurface() {
  if (!isLufengPublicPath()) {
    document.documentElement.removeAttribute("data-oc-lufeng-route");
    document.body?.removeAttribute("data-oc-lufeng-route");
    document.head.querySelector(`[${STYLE_ATTR}]`)?.remove();
    return;
  }

  ensureStyle();
  document.documentElement.setAttribute("data-oc-lufeng-route", "true");
  document.body?.setAttribute("data-oc-lufeng-route", "true");
  normalizeLufengLocation();
  pinPublicChatSession(document.querySelector("openclaw-app"));
}

export function bootLufengSurface() {
  syncLufengSurface();

  if (window.__openclawLufengSurfaceBooted) {
    return;
  }
  window.__openclawLufengSurfaceBooted = true;

  const observer = new MutationObserver(() => {
    syncLufengSurface();
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
  });

  window.addEventListener("popstate", syncLufengSurface);
  window.setInterval(syncLufengSurface, 800);
}

export { LUFENG_ROUTE, LUFENG_SESSION_KEY };
