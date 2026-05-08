import { createTenantApiClient } from "../tenant/api-client.js";
import {
  isEchartsViewPublicPath,
  normalizeEchartsViewRouteUrl,
  readEchartsViewToken,
} from "./context.js";

const VISUALIZATION_FRAME_ID = "oc-echarts-view-frame";
const ECHARTS_VIEW_FRAME_NAVIGATION_BRIDGE_MARKER = "data-oc-echarts-view-navigation-bridge";

function readDocumentTitle(html) {
  const match = String(html || "").match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) {
    return "";
  }
  return match[1].replace(/<[^>]*>/g, "").trim();
}

function clearVisualizationHost() {
  document.documentElement.style.background = "#fff";
  document.documentElement.style.margin = "0";
  document.documentElement.style.width = "100%";
  document.documentElement.style.height = "100%";
  if (document.body instanceof HTMLElement) {
    document.body.style.background = "#fff";
    document.body.style.margin = "0";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    document.body.style.overflow = "hidden";
    document.body.replaceChildren();
  }
}

function normalizeEchartsViewLocation() {
  const normalized = normalizeEchartsViewRouteUrl(window.location.href, window.location.href);
  if (
    normalized.pathname !== window.location.pathname ||
    normalized.search !== window.location.search
  ) {
    window.history.replaceState({}, "", normalized.toString());
  }
}

function normalizeEchartsViewTokenLocation(token) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) {
    return;
  }
  const url = new URL(window.location.href);
  if (url.searchParams.get("token") === normalizedToken) {
    return;
  }
  url.searchParams.set("token", normalizedToken);
  window.history.replaceState({}, "", url.toString());
}

async function loadVisualizationDocument(token) {
  if (!token) {
    return null;
  }

  const result = await createTenantApiClient().resolveMemberVisualization(token);
  const html = String(result?.html || "").trim();
  if (!html) {
    return null;
  }
  return {
    html,
    title: readDocumentTitle(html),
  };
}

function createVisualizationFrame(html) {
  const frame = document.createElement("iframe");
  frame.id = VISUALIZATION_FRAME_ID;
  frame.title = "可视化展示";
  frame.setAttribute("loading", "eager");
  frame.setAttribute("referrerpolicy", "no-referrer");
  frame.style.border = "0";
  frame.style.display = "block";
  frame.style.width = "100%";
  frame.style.height = "100%";
  frame.style.minHeight = "100vh";
  frame.srcdoc = String(html || "");
  return frame;
}

function decodeFragmentValue(fragmentValue) {
  const normalized = String(fragmentValue || "")
    .trim()
    .replace(/^#/, "");
  if (!normalized) {
    return "";
  }
  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
}

function findFragmentTarget(frameDocument, fragmentValue) {
  const normalizedFragment = decodeFragmentValue(fragmentValue);
  if (!normalizedFragment) {
    return null;
  }
  const byId = frameDocument.getElementById(normalizedFragment);
  if (byId) {
    return byId;
  }
  for (const element of frameDocument.querySelectorAll("[name]")) {
    if (element.getAttribute("name") === normalizedFragment) {
      return element;
    }
  }
  return null;
}

function scrollFrameToTop(frameWindow, frameDocument) {
  if (typeof frameWindow?.scrollTo === "function") {
    frameWindow.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    });
    return;
  }
  const scrollingElement = frameDocument.scrollingElement || frameDocument.documentElement;
  if (scrollingElement) {
    scrollingElement.scrollTop = 0;
    scrollingElement.scrollLeft = 0;
  }
}

function scrollFrameToFragment(frameDocument, frameWindow, fragmentValue) {
  if (String(fragmentValue || "").trim() === "#") {
    scrollFrameToTop(frameWindow, frameDocument);
    return;
  }
  const target = findFragmentTarget(frameDocument, fragmentValue);
  if (target && typeof target.scrollIntoView === "function") {
    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
    return;
  }
  scrollFrameToTop(frameWindow, frameDocument);
}

export function installEchartsViewFrameNavigationBridge(frame) {
  if (!(frame instanceof HTMLIFrameElement)) {
    return;
  }

  const bindNavigationBridge = () => {
    const frameDocument = frame.contentDocument;
    const frameWindow = frame.contentWindow;
    if (!frameDocument || !frameWindow) {
      return;
    }
    if (
      frameDocument.documentElement?.getAttribute(ECHARTS_VIEW_FRAME_NAVIGATION_BRIDGE_MARKER) ===
      "true"
    ) {
      return;
    }

    frameDocument.addEventListener(
      "click",
      (event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }
        const anchor = target.closest("a[href]");
        if (!(anchor instanceof HTMLAnchorElement)) {
          return;
        }
        const rawHref = anchor.getAttribute("href")?.trim() || "";
        const rawTarget = anchor.getAttribute("target")?.trim().toLowerCase() || "";
        if (!rawHref.startsWith("#") || (rawTarget && rawTarget !== "_self")) {
          return;
        }
        event.preventDefault();
        scrollFrameToFragment(frameDocument, frameWindow, rawHref);
      },
      true,
    );

    frameDocument.documentElement?.setAttribute(
      ECHARTS_VIEW_FRAME_NAVIGATION_BRIDGE_MARKER,
      "true",
    );
  };

  frame.addEventListener("load", bindNavigationBridge);
  bindNavigationBridge();
}

export async function bootEchartsViewSurface() {
  if (window.__openclawEchartsViewSurfaceBooted) {
    return null;
  }
  window.__openclawEchartsViewSurfaceBooted = true;

  if (!isEchartsViewPublicPath(window.location.pathname)) {
    return null;
  }

  const token = readEchartsViewToken();
  normalizeEchartsViewLocation();
  clearVisualizationHost();
  if (!token) {
    return null;
  }

  try {
    const visualizationDocument = await loadVisualizationDocument(token);
    if (!visualizationDocument) {
      return null;
    }
    normalizeEchartsViewTokenLocation(token);
    if (visualizationDocument.title) {
      document.title = visualizationDocument.title;
    }
    const frame = createVisualizationFrame(visualizationDocument.html);
    installEchartsViewFrameNavigationBridge(frame);
    document.body.append(frame);
    return visualizationDocument;
  } catch {
    clearVisualizationHost();
    return null;
  }
}
