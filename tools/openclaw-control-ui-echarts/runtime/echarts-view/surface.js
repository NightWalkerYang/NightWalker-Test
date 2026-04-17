import { createTenantApiClient } from "../tenant/api-client.js";
import {
  isEchartsViewPublicPath,
  normalizeEchartsViewRouteUrl,
  readEchartsViewToken,
} from "./context.js";

const BLANK_DOCUMENT_HTML = "<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>";

function escapeHtmlAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function writeDocumentHtml(html) {
  document.open();
  document.write(String(html || BLANK_DOCUMENT_HTML));
  document.close();
}

function writeBlankDocument() {
  writeDocumentHtml(BLANK_DOCUMENT_HTML);
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
  };
}

export async function bootEchartsViewSurface() {
  if (window.__openclawEchartsViewSurfaceBooted) {
    return null;
  }
  window.__openclawEchartsViewSurfaceBooted = true;

  if (!isEchartsViewPublicPath(window.location.pathname)) {
    return null;
  }

  normalizeEchartsViewLocation();
  writeBlankDocument();

  const token = readEchartsViewToken();
  try {
    const visualizationDocument = await loadVisualizationDocument(token);
    if (!visualizationDocument) {
      return null;
    }
    writeDocumentHtml(visualizationDocument.html);
    return visualizationDocument;
  } catch {
    writeBlankDocument();
    return null;
  }
}
