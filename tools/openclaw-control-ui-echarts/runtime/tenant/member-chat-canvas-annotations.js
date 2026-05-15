import {
  findChatComposer,
  findChatComposerTextarea,
  findChatSurface,
  findContentMountRoot,
  findSidebar,
} from "../framework/dom-compat.js";
import {
  backfillChatComposerPrompt,
  formatMultiAnnotationPrompt,
  formatSingleAnnotationPrompt,
} from "./member-chat-annotations.js";

export const MEMBER_CHAT_CANVAS_ANNOTATION_ROOT_ATTR = "data-oc-member-canvas-annotation-root";
const ROOT_ATTR = MEMBER_CHAT_CANVAS_ANNOTATION_ROOT_ATTR;
const STYLE_ATTR = "data-oc-member-canvas-annotation-style";
const BUTTON_ATTR = "data-oc-member-canvas-annotation-button";
const DRAWER_ATTR = "data-oc-member-canvas-annotation-drawer";
const OVERLAY_ATTR = "data-oc-member-canvas-annotation-overlay";
const RECT_ATTR = "data-oc-member-canvas-annotation-rect";
const DRAFT_ATTR = "data-oc-member-canvas-annotation-draft";
const FRAME_ATTR = "data-oc-member-canvas-annotation-frame";
const RESIZE_ATTR = "data-oc-member-canvas-resize-handle";
const DOCKED_ATTR = "data-oc-member-canvas-docked";
const FULLSCREEN_ATTR = "data-oc-member-canvas-fullscreen";
const WIDTH_STORAGE_KEY = "openclaw:tenant-member-canvas-width:v1";
const DEFAULT_DRAWER_WIDTH = 560;
const MIN_DRAWER_WIDTH = 380;
const MIN_MAIN_WIDTH = 420;

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }
  return Math.min(max, Math.max(min, numeric));
}

function getMaxDrawerWidth() {
  return Math.max(MIN_DRAWER_WIDTH, Math.round((window.innerWidth || 1200) - MIN_MAIN_WIDTH));
}

function normalizeDrawerWidth(value) {
  return clampNumber(value, MIN_DRAWER_WIDTH, getMaxDrawerWidth());
}

function readStoredDrawerWidth() {
  try {
    const stored = window.localStorage?.getItem(WIDTH_STORAGE_KEY);
    return stored ? normalizeDrawerWidth(stored) : normalizeDrawerWidth(DEFAULT_DRAWER_WIDTH);
  } catch {
    return normalizeDrawerWidth(DEFAULT_DRAWER_WIDTH);
  }
}

function writeStoredDrawerWidth(width) {
  try {
    window.localStorage?.setItem(WIDTH_STORAGE_KEY, String(Math.round(width)));
  } catch {}
}

function setElementStyleValue(element, property, value) {
  if (element instanceof HTMLElement) {
    element.style.setProperty(property, value);
  }
}

function clearElementStyleValue(element, property) {
  if (element instanceof HTMLElement) {
    element.style.removeProperty(property);
  }
}

function resolveDockTarget() {
  return findChatSurface(document) || findContentMountRoot(document) || null;
}

function applyDockLayout(state) {
  const dockTarget = resolveDockTarget();
  if (state.dockTarget && state.dockTarget !== dockTarget) {
    state.dockTarget.removeAttribute(DOCKED_ATTR);
    state.dockTarget.removeAttribute(FULLSCREEN_ATTR);
    clearElementStyleValue(state.dockTarget, "--oc-member-canvas-width");
    clearElementStyleValue(state.dockTarget, "--oc-member-canvas-right-offset");
  }
  state.dockTarget = dockTarget;
  if (!(dockTarget instanceof HTMLElement)) {
    return;
  }
  if (!state.drawerOpen) {
    dockTarget.removeAttribute(DOCKED_ATTR);
    dockTarget.removeAttribute(FULLSCREEN_ATTR);
    clearElementStyleValue(dockTarget, "--oc-member-canvas-width");
    clearElementStyleValue(dockTarget, "--oc-member-canvas-right-offset");
    return;
  }
  dockTarget.setAttribute(DOCKED_ATTR, "true");
  dockTarget.setAttribute(FULLSCREEN_ATTR, state.fullscreen ? "true" : "false");
  setElementStyleValue(
    dockTarget,
    "--oc-member-canvas-width",
    `${Math.round(state.drawerWidth)}px`,
  );
  setElementStyleValue(
    dockTarget,
    "--oc-member-canvas-right-offset",
    state.fullscreen ? "0px" : `${Math.round(state.drawerWidth + 20)}px`,
  );
}

function clearDockLayout(state) {
  if (state?.dockTarget instanceof HTMLElement) {
    state.dockTarget.removeAttribute(DOCKED_ATTR);
    state.dockTarget.removeAttribute(FULLSCREEN_ATTR);
    clearElementStyleValue(state.dockTarget, "--oc-member-canvas-width");
    clearElementStyleValue(state.dockTarget, "--oc-member-canvas-right-offset");
  }
  state.dockTarget = null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function ensureStyle() {
  if (document.head.querySelector(`[${STYLE_ATTR}]`)) {
    return;
  }
  const style = document.createElement("style");
  style.setAttribute(STYLE_ATTR, "true");
  style.textContent = `
    [${ROOT_ATTR}="true"] {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 999990;
      color: #172033;
      font-family: inherit;
      --oc-member-canvas-width: ${DEFAULT_DRAWER_WIDTH}px;
    }
    [${DOCKED_ATTR}="true"] {
      margin-right: var(--oc-member-canvas-right-offset, 0px) !important;
      transition: margin-right 160ms ease;
    }
    [${FULLSCREEN_ATTR}="true"] {
      margin-right: 0 !important;
    }
    .oc-member-canvas-annotation-button {
      position: fixed;
      right: 22px;
      top: 74px;
      z-index: 999995;
      pointer-events: auto;
      border: 1px solid rgba(37, 99, 235, 0.22);
      border-radius: 999px;
      padding: 9px 15px;
      color: #1e3a8a;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
      cursor: pointer;
      font-size: 14px;
      font-weight: 650;
    }
    .oc-member-canvas-annotation-button[data-active="true"] {
      color: #ffffff;
      border-color: rgba(37, 99, 235, 0.42);
      background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%);
    }
    .oc-member-canvas-annotation-drawer {
      position: fixed;
      top: 58px;
      right: 14px;
      bottom: 14px;
      width: min(var(--oc-member-canvas-width), calc(100vw - 28px));
      z-index: 999996;
      pointer-events: auto;
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr) auto;
      gap: 10px;
      padding: 14px;
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 22px;
      background: #f8fafc;
      box-shadow: 0 22px 58px rgba(15, 23, 42, 0.22);
    }
    .oc-member-canvas-annotation-drawer[data-fullscreen="true"] {
      left: calc((var(--oc-member-sidebar-width, 0px)) + 8px);
      right: 8px;
      top: 8px;
      bottom: var(--oc-member-composer-bottom-space, 92px);
      width: auto;
      border-radius: 18px;
    }
    .oc-member-canvas-annotation-resize {
      position: absolute;
      left: -8px;
      top: 16px;
      bottom: 16px;
      width: 14px;
      border: 0;
      padding: 0;
      background: transparent;
      cursor: ew-resize;
    }
    .oc-member-canvas-annotation-resize::after {
      content: "";
      position: absolute;
      left: 6px;
      top: 42%;
      width: 3px;
      height: 56px;
      border-radius: 999px;
      background: rgba(100, 116, 139, 0.36);
    }
    .oc-member-canvas-annotation-drawer[data-fullscreen="true"] .oc-member-canvas-annotation-resize {
      display: none;
    }
    .oc-member-canvas-annotation-drawer header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .oc-member-canvas-annotation-title {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .oc-member-canvas-annotation-title strong {
      color: #0f172a;
      font-size: 16px;
    }
    .oc-member-canvas-annotation-title span,
    .oc-member-canvas-annotation-muted {
      color: #64748b;
      font-size: 12px;
    }
    .oc-member-canvas-annotation-actions,
    .oc-member-canvas-annotation-card-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .oc-member-canvas-annotation-drawer button,
    .oc-member-canvas-annotation-drawer select {
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 12px;
      padding: 7px 10px;
      color: #1e293b;
      background: rgba(255, 255, 255, 0.92);
      cursor: pointer;
      font-size: 13px;
    }
    .oc-member-canvas-annotation-drawer button.primary {
      border-color: rgba(37, 99, 235, 0.38);
      color: #ffffff;
      background: #2563eb;
    }
    .oc-member-canvas-annotation-drawer button.note-count {
      border-color: rgba(239, 68, 68, 0.28);
      color: #991b1b;
      background: #fff7ed;
      font-weight: 700;
    }
    .oc-member-canvas-annotation-drawer button[aria-pressed="true"] {
      border-color: rgba(37, 99, 235, 0.44);
      color: #1d4ed8;
      background: #eff6ff;
    }
    .oc-member-canvas-annotation-icon-button {
      width: 36px;
      height: 36px;
      padding: 0 !important;
      display: grid;
      place-items: center;
      font-size: 17px !important;
      line-height: 1;
    }
    .oc-member-canvas-annotation-select {
      min-width: 0;
      width: 100%;
    }
    .oc-member-canvas-annotation-stage {
      position: relative;
      min-height: 0;
      overflow: auto;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 18px;
      background:
        radial-gradient(circle at 18px 18px, rgba(37, 99, 235, 0.08) 0 2px, transparent 3px),
        linear-gradient(180deg, #eef5ff 0%, #f8fafc 100%);
      background-size: 28px 28px, auto;
      padding: 16px;
    }
    .oc-member-canvas-annotation-frame-wrap {
      position: relative;
      width: 100%;
      min-height: 520px;
      overflow: hidden;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 18px;
      background: #ffffff;
      box-shadow: 0 14px 36px rgba(15, 23, 42, 0.12);
    }
    .oc-member-canvas-annotation-frame {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 520px;
      border: 0;
      background: #ffffff;
    }
    .oc-member-canvas-annotation-overlay {
      position: absolute;
      inset: 0;
      cursor: crosshair;
      pointer-events: auto;
      background: rgba(37, 99, 235, 0.02);
    }
    .oc-member-canvas-annotation-overlay[data-disabled="true"] {
      pointer-events: none;
      background: transparent;
    }
    .oc-member-canvas-annotation-rect {
      position: absolute;
      border: 2px solid #0ea5e9;
      background: rgba(14, 165, 233, 0.1);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.92) inset;
      pointer-events: none;
    }
    .oc-member-canvas-annotation-rect[data-draft="true"] {
      border-color: #ef4444;
      border-style: dashed;
      background: rgba(239, 68, 68, 0.12);
    }
    .oc-member-canvas-annotation-rect[data-smart="true"] {
      border-color: #f97316;
      background: rgba(249, 115, 22, 0.1);
    }
    .oc-member-canvas-annotation-marker {
      position: absolute;
      transform: translate(-50%, -50%);
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      border: 2px solid #ffffff;
      border-radius: 999px;
      color: #ffffff;
      background: #1683f7;
      box-shadow: 0 7px 18px rgba(37, 99, 235, 0.28);
      font-size: 13px;
      font-weight: 800;
      pointer-events: auto;
    }
    .oc-member-canvas-annotation-comment {
      position: absolute;
      z-index: 2;
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 8px;
      width: min(390px, calc(100% - 36px));
      padding: 8px;
      border-radius: 999px;
      background: rgba(51, 51, 47, 0.92);
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.2);
    }
    .oc-member-canvas-annotation-comment input {
      min-width: 0;
      border: 0;
      outline: 0;
      color: #ffffff;
      background: transparent;
      font-size: 15px;
    }
    .oc-member-canvas-annotation-comment input::placeholder {
      color: rgba(255, 255, 255, 0.58);
    }
    .oc-member-canvas-annotation-comment button {
      width: 42px;
      height: 42px;
      padding: 0;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 999px;
      color: #334155;
      background: #ffffff;
      font-size: 24px;
      line-height: 1;
    }
    .oc-member-canvas-annotation-list {
      min-height: 0;
      max-height: 190px;
      overflow: auto;
      display: grid;
      align-content: start;
      gap: 8px;
      padding: 2px;
    }
    .oc-member-canvas-annotation-card {
      display: grid;
      gap: 8px;
      padding: 10px;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 14px;
      background: #ffffff;
    }
    .oc-member-canvas-annotation-card textarea {
      width: 100%;
      min-height: 58px;
      resize: vertical;
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 10px;
      padding: 8px;
      color: #0f172a;
      background: #f8fafc;
    }
    .oc-member-canvas-annotation-empty,
    .oc-member-canvas-annotation-error {
      display: grid;
      place-items: center;
      min-height: 300px;
      text-align: center;
      color: #64748b;
      padding: 24px;
    }
    @media (max-width: 720px) {
      .oc-member-canvas-annotation-drawer {
        top: 54px;
        right: 8px;
        left: 8px;
        width: auto;
      }
      .oc-member-canvas-annotation-button {
        right: 14px;
      }
      [${DOCKED_ATTR}="true"] {
        margin-right: 0 !important;
      }
    }
  `;
  document.head.append(style);
}

function normalizeText(annotation) {
  return String(annotation?.thread?.[0]?.text || annotation?.text || "").trim();
}

function normalizeThread(annotation) {
  return Array.isArray(annotation?.thread) ? annotation.thread : [];
}

function getVisualizationTitle(visualization) {
  return String(
    visualization?.visualizationName ||
      visualization?.title ||
      visualization?.visualizationFileName ||
      visualization?.name ||
      "当前大屏",
  ).trim();
}

function getVisualizationToken(visualization) {
  const directToken = String(visualization?.token || "").trim();
  if (directToken) {
    return directToken;
  }
  try {
    return (
      new URL(String(visualization?.href || ""), window.location.origin).searchParams.get(
        "token",
      ) || ""
    );
  } catch {
    return "";
  }
}

function getVisualizationHref(visualization) {
  const href = String(visualization?.href || "").trim();
  const token = getVisualizationToken(visualization);
  return (
    href ||
    (token
      ? `/echarts-view/?token=${encodeURIComponent(token)}`
      : window.location.pathname + window.location.search)
  );
}

function getVisualizationPageId(visualization) {
  return String(
    visualization?.pageId ||
      visualization?.id ||
      visualization?.revisionId ||
      getVisualizationToken(visualization) ||
      "member-canvas",
  ).trim();
}

function normalizeBaseHref(baseHref) {
  const normalized = String(baseHref || "").trim();
  if (!normalized) {
    return "";
  }
  try {
    const resolved = new URL(normalized, window.location.origin);
    if (resolved.origin !== window.location.origin) {
      return "";
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "";
  }
}

function isRewritableVisualizationUrl(value) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.startsWith("#") || normalized.startsWith("//")) {
    return false;
  }
  return !/^(?:[a-z][a-z0-9+.-]*:)/i.test(normalized);
}

function resolveVisualizationAssetUrl(value, baseHref) {
  if (!isRewritableVisualizationUrl(value)) {
    return value;
  }
  try {
    const normalizedValue = String(value || "").trim();
    const normalizedBaseHref = String(baseHref || "").trim();
    if (
      normalizedValue.startsWith("/") &&
      !normalizedValue.startsWith(normalizedBaseHref) &&
      !normalizedValue.startsWith("/assets/vendor/") &&
      !normalizedValue.startsWith("/assets/runtime/") &&
      !normalizedValue.startsWith("/workspace-downloads/") &&
      !normalizedValue.startsWith("/workspace-agent-downloads/") &&
      !normalizedValue.startsWith("/tenant-platform-api/")
    ) {
      return `${normalizedBaseHref.replace(/\/+$/, "")}/${normalizedValue.replace(/^\/+/, "")}`;
    }
    const resolved = new URL(normalizedValue, new URL(normalizedBaseHref, window.location.origin));
    if (resolved.origin !== window.location.origin) {
      return value;
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return value;
  }
}

function rewriteSrcsetAttribute(value, baseHref) {
  return String(value || "")
    .split(",")
    .map((candidate) => {
      const trimmed = candidate.trim();
      if (!trimmed) {
        return trimmed;
      }
      const parts = trimmed.split(/\s+/);
      const url = parts.shift() || "";
      return [resolveVisualizationAssetUrl(url, baseHref), ...parts].join(" ");
    })
    .join(", ");
}

function rewriteVisualizationAssetUrls(html, baseHref) {
  const normalizedBaseHref = normalizeBaseHref(baseHref);
  const htmlText = String(html || "").replace(/<base\b[^>]*>/gi, "");
  if (!normalizedBaseHref) {
    return htmlText;
  }
  return htmlText.replace(
    /\b(src|href|action|poster|data-src|data-href|srcset)\s*=\s*(["'])([^"']*)\2/gi,
    (match, attrName, quote, attrValue) => {
      const rewritten =
        String(attrName).toLowerCase() === "srcset"
          ? rewriteSrcsetAttribute(attrValue, normalizedBaseHref)
          : resolveVisualizationAssetUrl(attrValue, normalizedBaseHref);
      return `${attrName}=${quote}${escapeHtmlAttribute(rewritten)}${quote}`;
    },
  );
}

function buildRectStyle(rect) {
  const pageWidth = Number(rect?.pageWidth || 0);
  const pageHeight = Number(rect?.pageHeight || 0);
  if (pageWidth > 0 && pageHeight > 0) {
    return [
      `left:${(Number(rect.x || 0) / pageWidth) * 100}%`,
      `top:${(Number(rect.y || 0) / pageHeight) * 100}%`,
      `width:${(Number(rect.width || 0) / pageWidth) * 100}%`,
      `height:${(Number(rect.height || 0) / pageHeight) * 100}%`,
    ].join(";");
  }
  return [
    `left:${Number(rect?.x || 0)}px`,
    `top:${Number(rect?.y || 0)}px`,
    `width:${Number(rect?.width || 0)}px`,
    `height:${Number(rect?.height || 0)}px`,
  ].join(";");
}

function buildDraftCommentStyle(rect) {
  const x = Math.max(10, Number(rect?.x || 0) + 38);
  const y = Math.max(10, Number(rect?.y || 0) - 50);
  return [`left:${x}px`, `top:${y}px`].join(";");
}

function buildMarkerStyle(rect) {
  const pageWidth = Number(rect?.pageWidth || 0);
  const pageHeight = Number(rect?.pageHeight || 0);
  if (pageWidth > 0 && pageHeight > 0) {
    return [
      `left:${(Number(rect.x || 0) / pageWidth) * 100}%`,
      `top:${(Number(rect.y || 0) / pageHeight) * 100}%`,
    ].join(";");
  }
  return [`left:${Number(rect?.x || 0)}px`, `top:${Number(rect?.y || 0)}px`].join(";");
}

function normalizePreviewRect(start, end, base) {
  const x = Math.max(0, Math.min(start.x, end.x));
  const y = Math.max(0, Math.min(start.y, end.y));
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    pageWidth: Math.round(base.width || 0),
    pageHeight: Math.round(base.height || 0),
  };
}

function getFrameAndOverlay(state) {
  const frame = state.root.querySelector(`iframe[${FRAME_ATTR}]`);
  const overlay = state.root.querySelector(`[${OVERLAY_ATTR}]`);
  return {
    frame: frame instanceof HTMLIFrameElement ? frame : null,
    overlay: overlay instanceof HTMLElement ? overlay : null,
  };
}

function isElementNode(value) {
  return Boolean(
    value &&
    value.nodeType === 1 &&
    typeof value.tagName === "string" &&
    typeof value.getBoundingClientRect === "function",
  );
}

function isUsefulFrameElement(element) {
  if (!isElementNode(element)) {
    return false;
  }
  const tag = element.tagName.toLowerCase();
  if (["html", "body", "script", "style", "link", "meta", "head"].includes(tag)) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  const width = Number(rect.width || 0);
  const height = Number(rect.height || 0);
  if (width < 28 || height < 24) {
    return false;
  }
  if (width * height < 1200) {
    return false;
  }
  return true;
}

function scoreFrameElement(element) {
  if (!isUsefulFrameElement(element)) {
    return Number.NEGATIVE_INFINITY;
  }
  const tag = element.tagName.toLowerCase();
  const signal = [
    element.getAttribute("role"),
    element.getAttribute("aria-label"),
    element.getAttribute("data-testid"),
    element.getAttribute("class"),
    element.getAttribute("id"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const rect = element.getBoundingClientRect();
  let score = 20;
  if (["section", "article", "main", "aside", "nav", "header", "footer"].includes(tag)) {
    score += 32;
  }
  if (["div", "li", "table", "canvas", "svg"].includes(tag)) {
    score += 18;
  }
  if (
    /(card|panel|chart|module|widget|section|table|grid|item|overview|概览|图表|卡片|模块)/i.test(
      signal,
    )
  ) {
    score += 42;
  }
  if (element.querySelector("canvas, svg, table")) {
    score += 24;
  }
  score += Math.min(36, Math.round((rect.width * rect.height) / 12000));
  return score;
}

function findSmartFrameElement(target) {
  let current = isElementNode(target) ? target : null;
  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let depth = 0;
  while (current && depth < 8) {
    if (isElementNode(current)) {
      const score = scoreFrameElement(current);
      if (score > bestScore) {
        best = current;
        bestScore = score;
      }
    }
    current = current.parentElement;
    depth += 1;
  }
  return best;
}

function mapFrameRectToOverlayRect(frame, overlay, element) {
  const frameWindow = frame.contentWindow;
  const frameRect = element.getBoundingClientRect();
  const overlayWidth = overlay.clientWidth || overlay.getBoundingClientRect().width || 1;
  const overlayHeight = overlay.clientHeight || overlay.getBoundingClientRect().height || 1;
  const viewportWidth =
    frameWindow?.innerWidth || frame.contentDocument?.documentElement?.clientWidth || overlayWidth;
  const viewportHeight =
    frameWindow?.innerHeight ||
    frame.contentDocument?.documentElement?.clientHeight ||
    overlayHeight;
  const scaleX = overlayWidth / Math.max(1, viewportWidth);
  const scaleY = overlayHeight / Math.max(1, viewportHeight);
  return {
    x: Math.round(Math.max(0, frameRect.left * scaleX)),
    y: Math.round(Math.max(0, frameRect.top * scaleY)),
    width: Math.round(Math.max(0, frameRect.width * scaleX)),
    height: Math.round(Math.max(0, frameRect.height * scaleY)),
    pageWidth: Math.round(overlayWidth),
    pageHeight: Math.round(overlayHeight),
  };
}

function findSmartFrameElementAtOverlayPoint(state, point, overlay) {
  const frame = state.root.querySelector(`iframe[${FRAME_ATTR}]`);
  if (!(frame instanceof HTMLIFrameElement) || !(overlay instanceof HTMLElement)) {
    return null;
  }
  const frameDocument = frame.contentDocument;
  if (!frameDocument || typeof frameDocument.elementFromPoint !== "function") {
    return null;
  }
  const overlayWidth = overlay.clientWidth || overlay.getBoundingClientRect().width || 1;
  const overlayHeight = overlay.clientHeight || overlay.getBoundingClientRect().height || 1;
  const viewportWidth =
    frame.contentWindow?.innerWidth || frameDocument.documentElement?.clientWidth || overlayWidth;
  const viewportHeight =
    frame.contentWindow?.innerHeight ||
    frameDocument.documentElement?.clientHeight ||
    overlayHeight;
  const frameTarget = frameDocument.elementFromPoint(
    (point.x / Math.max(1, overlayWidth)) * viewportWidth,
    (point.y / Math.max(1, overlayHeight)) * viewportHeight,
  );
  return findSmartFrameElement(frameTarget);
}

function getSmartOverlayRectAtPoint(state, point, overlay) {
  const frame = state.root.querySelector(`iframe[${FRAME_ATTR}]`);
  const target = findSmartFrameElementAtOverlayPoint(state, point, overlay);
  if (!(frame instanceof HTMLIFrameElement) || !(overlay instanceof HTMLElement) || !target) {
    return null;
  }
  const rect = mapFrameRectToOverlayRect(frame, overlay, target);
  return rect.width >= 12 && rect.height >= 12 ? rect : null;
}

function updateSmartHoverRectElement(state) {
  const overlay = state.root.querySelector(`[${OVERLAY_ATTR}]`);
  if (!(overlay instanceof HTMLElement)) {
    return;
  }
  const existing = overlay.querySelector(`[${RECT_ATTR}][data-smart="true"]`);
  if (!state.smartHoverRect || state.selecting || state.draft) {
    existing?.remove();
    return;
  }
  const rectElement =
    existing instanceof HTMLElement
      ? existing
      : Object.assign(document.createElement("div"), {
          className: "oc-member-canvas-annotation-rect",
        });
  rectElement.setAttribute(RECT_ATTR, "true");
  rectElement.dataset.smart = "true";
  rectElement.setAttribute("style", buildRectStyle(state.smartHoverRect));
  if (!existing) {
    overlay.append(rectElement);
  }
}

function bindFrameSmartSelection(state) {
  const { frame, overlay } = getFrameAndOverlay(state);
  if (!(frame instanceof HTMLIFrameElement) || !(overlay instanceof HTMLElement)) {
    return;
  }
  if (state.boundFrameDocument && state.onFramePointerMove) {
    state.boundFrameDocument.removeEventListener("pointermove", state.onFramePointerMove, true);
    state.boundFrameDocument.removeEventListener("click", state.onFrameClick, true);
  }
  const frameDocument = frame.contentDocument;
  if (!frameDocument) {
    return;
  }
  state.boundFrame = frame;
  state.boundFrameDocument = frameDocument;
  state.onFramePointerMove = (event) => {
    if (!state.annotationMode || state.selecting || state.draft) {
      return;
    }
    const target = findSmartFrameElement(event.target);
    if (!target) {
      if (state.smartHoverRect) {
        state.smartHoverRect = null;
        updateSmartHoverRectElement(state);
      }
      return;
    }
    const rect = mapFrameRectToOverlayRect(frame, overlay, target);
    if (
      !state.smartHoverRect ||
      Math.abs(state.smartHoverRect.x - rect.x) > 2 ||
      Math.abs(state.smartHoverRect.y - rect.y) > 2 ||
      Math.abs(state.smartHoverRect.width - rect.width) > 2 ||
      Math.abs(state.smartHoverRect.height - rect.height) > 2
    ) {
      state.smartHoverRect = rect;
      updateSmartHoverRectElement(state);
    }
  };
  state.onFrameClick = (event) => {
    if (!state.annotationMode || state.selecting || state.draft) {
      return;
    }
    const target = findSmartFrameElement(event.target);
    if (!target) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const rect = mapFrameRectToOverlayRect(frame, overlay, target);
    if (rect.width < 12 || rect.height < 12) {
      return;
    }
    state.smartHoverRect = null;
    state.draft = { rect, text: "" };
    render(state);
  };
  frameDocument.addEventListener("pointermove", state.onFramePointerMove, true);
  frameDocument.addEventListener("click", state.onFrameClick, true);
}

function clearFrameSmartSelection(state) {
  if (state?.boundFrameDocument && state.onFramePointerMove) {
    state.boundFrameDocument.removeEventListener("pointermove", state.onFramePointerMove, true);
  }
  if (state?.boundFrameDocument && state.onFrameClick) {
    state.boundFrameDocument.removeEventListener("click", state.onFrameClick, true);
  }
  state.boundFrame = null;
  state.boundFrameDocument = null;
  state.onFramePointerMove = null;
  state.onFrameClick = null;
}

function restoreStablePreviewFrame(state) {
  const frame = state.root.querySelector(`iframe[${FRAME_ATTR}]`);
  const html = state.visualizationDocument?.html || "";
  if (!(frame instanceof HTMLIFrameElement) || !html) {
    return;
  }
  if (state.previewFrame instanceof HTMLIFrameElement && state.previewFrameHtml === html) {
    frame.replaceWith(state.previewFrame);
    bindFrameSmartSelection(state);
    return;
  }
  state.previewFrame = frame;
  state.previewFrameHtml = html;
  frame.srcdoc = html;
  frame.addEventListener(
    "load",
    () => {
      bindFrameSmartSelection(state);
    },
    { once: true },
  );
  bindFrameSmartSelection(state);
}

function findComposerLayoutElement() {
  const composer = findChatComposer(document);
  if (composer instanceof HTMLElement) {
    return composer;
  }
  const textarea = findChatComposerTextarea(document);
  return textarea instanceof HTMLElement
    ? textarea.closest("form, [data-oc-chat-composer], [class*='composer'], [class*='chat-input']")
    : null;
}

function makePromptAndBackfill(annotations) {
  const prompt = formatMultiAnnotationPrompt(annotations);
  if (!prompt) {
    return false;
  }
  return backfillChatComposerPrompt(prompt, document);
}

function makeSinglePromptAndBackfill(annotation) {
  const prompt = formatSingleAnnotationPrompt(annotation);
  if (!prompt) {
    return false;
  }
  return backfillChatComposerPrompt(prompt, document);
}

function getOpenAnnotationCount(annotations) {
  return (Array.isArray(annotations) ? annotations : []).filter(
    (annotation) => String(annotation?.status || "open") !== "resolved",
  ).length;
}

function getSelectedVisualization(state) {
  return (
    state.visualizations.find(
      (item) => getVisualizationToken(item) === state.selectedVisualizationToken,
    ) || null
  );
}

function filterVisualizationsForAgent(controller, visualizations) {
  const tenantAgentId = String(controller?.selectedAgent?.id || "").trim();
  const rows = Array.isArray(visualizations) ? visualizations : [];
  const scoped = rows.filter((item) => String(item?.tenantAgentId || "").trim() === tenantAgentId);
  return scoped.length > 0 ? scoped : rows;
}

async function loadVisualizations(state) {
  state.loading = true;
  state.error = "";
  render(state);
  try {
    const rows = filterVisualizationsForAgent(
      state.controller,
      await state.apiClient.listMemberVisualizations(),
    );
    state.visualizations = rows;
    if (
      !state.selectedVisualizationToken ||
      !rows.some((row) => getVisualizationToken(row) === state.selectedVisualizationToken)
    ) {
      state.selectedVisualizationToken = getVisualizationToken(rows[0]) || "";
    }
    await loadSelectedVisualization(state);
  } catch (error) {
    state.error = String(error?.message || error || "加载 Canvas 失败");
    state.visualizationDocument = null;
    state.annotations = [];
  } finally {
    state.loading = false;
    render(state);
  }
}

async function loadSelectedVisualization(state) {
  const visualization = getSelectedVisualization(state);
  const token = getVisualizationToken(visualization);
  state.draft = null;
  state.selecting = null;
  state.smartHoverRect = null;
  state.visualizationDocument = null;
  state.annotations = [];
  state.previewFrame = null;
  state.previewFrameHtml = "";
  clearFrameSmartSelection(state);
  if (!visualization || !token) {
    return;
  }
  const resolved = await state.apiClient.resolveMemberVisualization(token);
  const html = String(resolved?.html || "").trim();
  if (!html) {
    throw new Error("visualization_empty");
  }
  state.visualizationDocument = {
    html: rewriteVisualizationAssetUrls(html, resolved?.baseHref),
    baseHref: normalizeBaseHref(resolved?.baseHref),
  };
  await loadAnnotations(state);
}

async function loadAnnotations(state) {
  const visualization = getSelectedVisualization(state);
  const pageId = getVisualizationPageId(visualization);
  state.annotations = await state.apiClient.listMemberAnnotations({
    tenantAgentId: state.controller.selectedAgent.id,
    openclawSessionKey: state.controller.currentSessionKey,
    pageId,
  });
  if (!Array.isArray(state.annotations)) {
    state.annotations = [];
  }
}

function renderVisualizationSelect(state) {
  if (state.visualizations.length <= 1) {
    return `<span class="oc-member-canvas-annotation-muted">${escapeHtml(getVisualizationTitle(getSelectedVisualization(state)) || "当前大屏")}</span>`;
  }
  return `<select class="oc-member-canvas-annotation-select" data-action="select-visualization" aria-label="选择 Canvas 预览">
    ${state.visualizations
      .map((item) => {
        const token = getVisualizationToken(item);
        return `<option value="${escapeHtmlAttribute(token)}" ${token === state.selectedVisualizationToken ? "selected" : ""}>${escapeHtml(getVisualizationTitle(item))}</option>`;
      })
      .join("")}
  </select>`;
}

function renderStage(state) {
  if (state.loading) {
    return `<div class="oc-member-canvas-annotation-empty">正在加载 Canvas 预览...</div>`;
  }
  if (state.error) {
    return `<div class="oc-member-canvas-annotation-error">Canvas 加载失败：${escapeHtml(state.error)}</div>`;
  }
  if (!getSelectedVisualization(state)) {
    return `<div class="oc-member-canvas-annotation-empty">暂无可批注的大屏文件。生成大屏后会在这里展示。</div>`;
  }
  return `<div class="oc-member-canvas-annotation-frame-wrap">
    <iframe class="oc-member-canvas-annotation-frame" ${FRAME_ATTR}="true" title="Canvas 预览"></iframe>
    <div class="oc-member-canvas-annotation-overlay" ${OVERLAY_ATTR}="true" data-disabled="${state.annotationMode ? "false" : "true"}">
      ${state.annotations
        .map(
          (annotation, index) =>
            `<div class="oc-member-canvas-annotation-rect" ${RECT_ATTR}="true" style="${buildRectStyle(annotation.rect || {})}"></div>
            <button class="oc-member-canvas-annotation-marker" type="button" data-action="focus-annotation" data-id="${escapeHtmlAttribute(annotation.id)}" style="${buildMarkerStyle(annotation.rect || {})}">${index + 1}</button>`,
        )
        .join("")}
      ${
        state.smartHoverRect && !state.selecting && !state.draft
          ? `<div class="oc-member-canvas-annotation-rect" ${RECT_ATTR}="true" data-smart="true" style="${buildRectStyle(
              state.smartHoverRect,
            )}"></div>`
          : ""
      }
      ${
        state.selecting || state.draft
          ? `<div class="oc-member-canvas-annotation-rect" ${RECT_ATTR}="true" data-draft="true" style="${buildRectStyle(
              (state.selecting && state.selecting.rect) || state.draft?.rect || {},
            )}"></div>`
          : ""
      }
      ${
        state.draft
          ? `<div class="oc-member-canvas-annotation-comment" ${DRAFT_ATTR}="true" style="${buildDraftCommentStyle(state.draft.rect)}">
              <input data-draft-text placeholder="添加评论..." value="${escapeHtmlAttribute(state.draft.text || "")}" />
              <button type="button" data-action="save-draft" aria-label="保存并回填批注">↑</button>
            </div>`
          : ""
      }
    </div>
  </div>`;
}

function render(state) {
  const { root, drawerOpen, annotationMode, annotations } = state;
  const openCount = getOpenAnnotationCount(annotations);
  root.style.setProperty("--oc-member-canvas-width", `${Math.round(state.drawerWidth)}px`);
  const sidebar = findSidebar(document);
  const sidebarWidth =
    sidebar instanceof HTMLElement ? Math.round(sidebar.getBoundingClientRect().width || 0) : 0;
  const composer = findComposerLayoutElement();
  const composerHeight =
    composer instanceof HTMLElement ? Math.round(composer.getBoundingClientRect().height || 0) : 0;
  root.style.setProperty("--oc-member-sidebar-width", `${sidebarWidth}px`);
  root.style.setProperty(
    "--oc-member-composer-bottom-space",
    `${Math.max(92, composerHeight + 22)}px`,
  );
  applyDockLayout(state);
  root.innerHTML = `
    <button class="oc-member-canvas-annotation-button" ${BUTTON_ATTR}="true" data-active="${drawerOpen ? "true" : "false"}" type="button">
      Canvas
    </button>
    ${
      drawerOpen
        ? `<aside class="oc-member-canvas-annotation-drawer" ${DRAWER_ATTR}="true" data-fullscreen="${state.fullscreen ? "true" : "false"}">
            <button class="oc-member-canvas-annotation-resize" ${RESIZE_ATTR}="true" type="button" aria-label="拖动调整 Canvas 宽度"></button>
            <header>
              <div class="oc-member-canvas-annotation-title">
                <strong>Canvas 批注</strong>
                <span>移动鼠标自动识别模块，点击模块或拖拽框选后添加批注。</span>
              </div>
              <div class="oc-member-canvas-annotation-actions">
                <button class="oc-member-canvas-annotation-icon-button" type="button" data-action="toggle-fullscreen" aria-label="${state.fullscreen ? "退出全屏 Canvas" : "放大全屏 Canvas"}">${state.fullscreen ? "↙" : "↗"}</button>
                <button type="button" data-action="close">关闭</button>
              </div>
            </header>
            <div class="oc-member-canvas-annotation-actions">
              ${renderVisualizationSelect(state)}
              <button type="button" data-action="toggle-mode" aria-pressed="${annotationMode ? "true" : "false"}">${annotationMode ? "批注中" : "批注模式"}</button>
            </div>
            <section class="oc-member-canvas-annotation-stage">
              ${renderStage(state)}
            </section>
            <section class="oc-member-canvas-annotation-list" aria-label="Canvas 批注列表">
              <div class="oc-member-canvas-annotation-actions">
                <button type="button" class="note-count" data-action="all-prompts">${openCount} 条注释</button>
                <span class="oc-member-canvas-annotation-muted">点击注释数可回填全部未解决批注</span>
              </div>
              ${annotations
                .map(
                  (annotation) =>
                    `<section class="oc-member-canvas-annotation-card" data-annotation-id="${escapeHtmlAttribute(annotation.id)}">
                      <div>
                        <strong>#${escapeHtml(String(annotation.id || "").slice(-6))}</strong>
                        <span class="oc-member-canvas-annotation-muted">${escapeHtml(annotation.status === "resolved" ? "已解决" : "未解决")}</span>
                      </div>
                      <div>${escapeHtml(normalizeText(annotation) || "无内容")}</div>
                      ${normalizeThread(annotation)
                        .slice(1)
                        .map(
                          (message) =>
                            `<div class="oc-member-canvas-annotation-muted">回复：${escapeHtml(message?.text || "")}</div>`,
                        )
                        .join("")}
                      <textarea data-reply-text placeholder="回复此批注..."></textarea>
                      <div class="oc-member-canvas-annotation-card-actions">
                        <button type="button" class="primary" data-action="single-prompt" data-id="${escapeHtmlAttribute(annotation.id)}">回填此批注</button>
                        <button type="button" data-action="reply" data-id="${escapeHtmlAttribute(annotation.id)}">回复</button>
                        <button type="button" data-action="toggle-status" data-id="${escapeHtmlAttribute(annotation.id)}">${annotation.status === "resolved" ? "重新打开" : "解决"}</button>
                      </div>
                    </section>`,
                )
                .join("")}
            </section>
          </aside>`
        : ""
    }
  `;
  restoreStablePreviewFrame(state);
  const draftInput = root.querySelector("[data-draft-text]");
  if (draftInput instanceof HTMLInputElement && state.draft) {
    draftInput.focus();
    draftInput.setSelectionRange(draftInput.value.length, draftInput.value.length);
  }
}

function bindRoot(state) {
  const clearPointerListeners = () => {
    if (state.onWindowPointerMove) {
      window.removeEventListener("pointermove", state.onWindowPointerMove, true);
      state.onWindowPointerMove = null;
    }
    if (state.onWindowPointerUp) {
      window.removeEventListener("pointerup", state.onWindowPointerUp, true);
      state.onWindowPointerUp = null;
    }
    if (state.onWindowResizePointerMove) {
      window.removeEventListener("pointermove", state.onWindowResizePointerMove, true);
      state.onWindowResizePointerMove = null;
    }
    if (state.onWindowResizePointerUp) {
      window.removeEventListener("pointerup", state.onWindowResizePointerUp, true);
      state.onWindowResizePointerUp = null;
    }
  };

  const resolveOverlayPoint = (event, overlay) => {
    const bounds = overlay.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      width: overlay.clientWidth || bounds.width,
      height: overlay.clientHeight || bounds.height,
    };
  };

  const updateSelection = (event) => {
    if (!state.selecting) {
      return;
    }
    const overlay = state.root.querySelector(`[${OVERLAY_ATTR}]`);
    if (!(overlay instanceof HTMLElement)) {
      return;
    }
    const point = resolveOverlayPoint(event, overlay);
    state.selecting.rect = normalizePreviewRect(
      state.selecting.start,
      point,
      state.selecting.base || point,
    );
    render(state);
  };

  const finishSelection = (event) => {
    if (!state.selecting) {
      return;
    }
    const overlay = state.root.querySelector(`[${OVERLAY_ATTR}]`);
    clearPointerListeners();
    if (!(overlay instanceof HTMLElement)) {
      state.selecting = null;
      render(state);
      return;
    }
    const point = resolveOverlayPoint(event, overlay);
    const rect = normalizePreviewRect(state.selecting.start, point, state.selecting.base || point);
    const smartRect = state.selecting.smartRect;
    state.selecting = null;
    if (rect.width < 12 || rect.height < 12) {
      if (smartRect) {
        state.smartHoverRect = null;
        state.draft = { rect: smartRect, text: "" };
        render(state);
        return;
      }
      render(state);
      return;
    }
    state.draft = { rect, text: "" };
    render(state);
  };

  state.clearPointerListeners = clearPointerListeners;

  state.root.addEventListener("input", (event) => {
    const target = event.target;
    if (state.draft && target instanceof HTMLInputElement && target.matches("[data-draft-text]")) {
      state.draft.text = target.value;
    }
  });

  state.root.addEventListener("change", async (event) => {
    const target = event.target;
    if (
      !(target instanceof HTMLSelectElement) ||
      target.dataset.action !== "select-visualization"
    ) {
      return;
    }
    state.selectedVisualizationToken = target.value;
    state.loading = true;
    state.error = "";
    render(state);
    try {
      await loadSelectedVisualization(state);
    } catch (error) {
      state.error = String(error?.message || error || "加载 Canvas 失败");
    } finally {
      state.loading = false;
      render(state);
    }
  });

  state.root.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const action = String(target.dataset.action || "").trim();
    if (target.matches(`[${BUTTON_ATTR}]`)) {
      state.drawerOpen = !state.drawerOpen;
      state.draft = null;
      if (state.drawerOpen && !state.visualizationsLoaded) {
        state.visualizationsLoaded = true;
        await loadVisualizations(state);
        return;
      }
      render(state);
      return;
    }
    if (!action) {
      return;
    }
    if (action === "close") {
      state.drawerOpen = false;
      state.draft = null;
      state.fullscreen = false;
      clearPointerListeners();
      render(state);
      return;
    }
    if (action === "toggle-fullscreen") {
      state.fullscreen = !state.fullscreen;
      state.draft = null;
      state.smartHoverRect = null;
      clearPointerListeners();
      render(state);
      return;
    }
    if (action === "toggle-mode") {
      state.annotationMode = !state.annotationMode;
      state.draft = null;
      clearPointerListeners();
      render(state);
      return;
    }
    if (action === "save-draft" && state.draft) {
      const input = state.root.querySelector("[data-draft-text]");
      const text =
        input instanceof HTMLInputElement
          ? input.value.trim()
          : String(state.draft.text || "").trim();
      if (!text) {
        return;
      }
      const visualization = getSelectedVisualization(state);
      const created = await state.apiClient.createMemberAnnotation({
        tenantAgentId: state.controller.selectedAgent.id,
        openclawSessionKey: state.controller.currentSessionKey,
        runId: String(state.controller.app?.chatRunId || "").trim(),
        messageId: "",
        pageId: getVisualizationPageId(visualization),
        entryUrl: getVisualizationHref(visualization),
        revisionId: String(visualization?.revisionId || "").trim(),
        rect: state.draft.rect,
        text,
      });
      state.annotations.unshift(created);
      state.draft = null;
      render(state);
      makeSinglePromptAndBackfill(created);
      return;
    }
    if (action === "all-prompts") {
      makePromptAndBackfill(state.annotations);
      return;
    }
    const annotationId = String(target.dataset.id || "").trim();
    const annotation = state.annotations.find((item) => item.id === annotationId);
    if (!annotation) {
      return;
    }
    if (action === "focus-annotation") {
      const card = state.root.querySelector(`[data-annotation-id="${CSS.escape(annotationId)}"]`);
      card?.scrollIntoView?.({ block: "nearest" });
      return;
    }
    if (action === "single-prompt") {
      makeSinglePromptAndBackfill(annotation);
      return;
    }
    if (action === "toggle-status") {
      const updated = await state.apiClient.updateMemberAnnotationStatus({
        annotationId,
        status: annotation.status === "resolved" ? "open" : "resolved",
      });
      state.annotations = state.annotations.map((item) =>
        item.id === annotationId ? updated : item,
      );
      render(state);
      return;
    }
    if (action === "reply") {
      const card = target.closest("[data-annotation-id]");
      const textarea = card instanceof HTMLElement ? card.querySelector("[data-reply-text]") : null;
      const text = textarea instanceof HTMLTextAreaElement ? textarea.value.trim() : "";
      if (!text) {
        return;
      }
      const updated = await state.apiClient.replyMemberAnnotation({ annotationId, text });
      state.annotations = state.annotations.map((item) =>
        item.id === annotationId ? updated : item,
      );
      render(state);
    }
  });

  state.root.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.matches(`[${RESIZE_ATTR}]`)) {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startWidth = state.drawerWidth;
      clearPointerListeners();
      state.onWindowResizePointerMove = (moveEvent) => {
        const delta = startX - moveEvent.clientX;
        state.drawerWidth = normalizeDrawerWidth(startWidth + delta);
        state.root.style.setProperty(
          "--oc-member-canvas-width",
          `${Math.round(state.drawerWidth)}px`,
        );
        applyDockLayout(state);
      };
      state.onWindowResizePointerUp = () => {
        writeStoredDrawerWidth(state.drawerWidth);
        clearPointerListeners();
        render(state);
      };
      window.addEventListener("pointermove", state.onWindowResizePointerMove, true);
      window.addEventListener("pointerup", state.onWindowResizePointerUp, true);
      return;
    }
    if (
      !state.annotationMode ||
      !(target instanceof HTMLElement) ||
      !target.matches(`[${OVERLAY_ATTR}]`)
    ) {
      return;
    }
    const point = resolveOverlayPoint(event, target);
    const smartRect = getSmartOverlayRectAtPoint(state, point, target);
    state.draft = null;
    state.selecting = {
      start: point,
      base: { width: point.width, height: point.height },
      rect: normalizePreviewRect(point, point, point),
      smartRect,
    };
    clearPointerListeners();
    state.onWindowPointerMove = updateSelection;
    state.onWindowPointerUp = finishSelection;
    window.addEventListener("pointermove", state.onWindowPointerMove, true);
    window.addEventListener("pointerup", state.onWindowPointerUp, true);
    render(state);
  });

  state.root.addEventListener("pointermove", (event) => {
    const target = event.target;
    if (
      state.annotationMode &&
      !state.selecting &&
      !state.draft &&
      target instanceof HTMLElement &&
      target.matches(`[${OVERLAY_ATTR}]`)
    ) {
      const rect = getSmartOverlayRectAtPoint(state, resolveOverlayPoint(event, target), target);
      if (
        (!rect && state.smartHoverRect) ||
        (rect &&
          (!state.smartHoverRect ||
            Math.abs(state.smartHoverRect.x - rect.x) > 2 ||
            Math.abs(state.smartHoverRect.y - rect.y) > 2 ||
            Math.abs(state.smartHoverRect.width - rect.width) > 2 ||
            Math.abs(state.smartHoverRect.height - rect.height) > 2))
      ) {
        state.smartHoverRect = rect;
        updateSmartHoverRectElement(state);
      }
    }
    updateSelection(event);
  });

  state.root.addEventListener("pointerup", (event) => {
    finishSelection(event);
  });
}

export function mountMemberChatCanvasAnnotations(controller, apiClient) {
  if (!controller?.selectedAgent?.id || !controller?.currentSessionKey || !apiClient) {
    return null;
  }
  ensureStyle();
  const surfaceKey = [
    "member-chat-canvas",
    String(controller.selectedAgent.id || "").trim(),
    String(controller.currentSessionKey || "").trim(),
  ]
    .filter(Boolean)
    .join(":");
  const activeSurface = window._ocMemberChatCanvasAnnotationSurface;
  if (activeSurface?.state?.root?.isConnected && activeSurface.state.surfaceKey === surfaceKey) {
    activeSurface.state.controller = controller;
    activeSurface.state.apiClient = apiClient;
    render(activeSurface.state);
    return activeSurface;
  }
  activeSurface?.unmount?.();
  document.querySelector(`[${ROOT_ATTR}]`)?.remove();
  const root = document.createElement("div");
  root.setAttribute(ROOT_ATTR, "true");
  document.body.append(root);
  const state = {
    root,
    controller,
    apiClient,
    surfaceKey,
    drawerOpen: false,
    fullscreen: false,
    drawerWidth: readStoredDrawerWidth(),
    annotationMode: true,
    visualizationsLoaded: false,
    visualizations: [],
    selectedVisualizationToken: "",
    visualizationDocument: null,
    loading: false,
    error: "",
    selecting: null,
    smartHoverRect: null,
    draft: null,
    annotations: [],
    dockTarget: null,
    boundFrame: null,
    boundFrameDocument: null,
    previewFrame: null,
    previewFrameHtml: "",
    clearPointerListeners: null,
    onWindowPointerMove: null,
    onWindowPointerUp: null,
    onWindowResizePointerMove: null,
    onWindowResizePointerUp: null,
    onFramePointerMove: null,
    onFrameClick: null,
  };
  bindRoot(state);
  render(state);
  const surface = {
    state,
    unmount() {
      state.clearPointerListeners?.();
      clearFrameSmartSelection(state);
      clearDockLayout(state);
      root.remove();
      if (window._ocMemberChatCanvasAnnotationSurface === surface) {
        delete window._ocMemberChatCanvasAnnotationSurface;
      }
    },
  };
  window._ocMemberChatCanvasAnnotationSurface = surface;
  return surface;
}

export function unmountMemberChatCanvasAnnotations() {
  window._ocMemberChatCanvasAnnotationSurface?.unmount?.();
  delete window._ocMemberChatCanvasAnnotationSurface;
  document.querySelector(`[${ROOT_ATTR}]`)?.remove();
}
