import { createTenantApiClient } from "../tenant/api-client.js";
import {
  isEchartsViewPublicPath,
  normalizeEchartsViewRouteUrl,
  readEchartsViewToken,
} from "./context.js";

const VISUALIZATION_FRAME_ID = "oc-echarts-view-frame";

function escapeHtmlAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readDocumentTitle(html) {
  const match = String(html || "").match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) {
    return "";
  }
  return match[1].replace(/<[^>]*>/g, "").trim();
}

function injectBaseHref(html, baseHref) {
  const normalizedBaseHref = String(baseHref || "").trim();
  if (!normalizedBaseHref) {
    return html;
  }

  const baseTag = `<base href="${escapeHtmlAttribute(normalizedBaseHref)}">`;
  if (/<base\b[^>]*>/i.test(html)) {
    return html.replace(/<base\b[^>]*>/i, baseTag);
  }
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (headOpen) => `${headOpen}\n    ${baseTag}`);
  }
  return html;
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
    html: injectBaseHref(html, result?.baseHref),
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
    if (visualizationDocument.title) {
      document.title = visualizationDocument.title;
    }
    const frame = createVisualizationFrame(visualizationDocument.html);
    document.body.append(frame);
    return visualizationDocument;
  } catch {
    clearVisualizationHost();
    return null;
  }
}
