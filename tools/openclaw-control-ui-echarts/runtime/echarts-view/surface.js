import { createTenantApiClient } from "../tenant/api-client.js";
import {
  isEchartsViewPublicPath,
  normalizeEchartsViewRouteUrl,
  readEchartsViewToken,
} from "./context.js";

const VISUALIZATION_FRAME_ID = "oc-echarts-view-frame";
const SURFACE_STYLE_ATTR = "data-openclaw-echarts-view-surface-style";
const SURFACE_ROOT_ID = "oc-echarts-view-surface";

function readDocumentTitle(html) {
  const match = String(html || "").match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) {
    return "";
  }
  return match[1].replace(/<[^>]*>/g, "").trim();
}

function clearVisualizationHost() {
  document.documentElement.style.background = "#050712";
  document.documentElement.style.margin = "0";
  document.documentElement.style.width = "100%";
  document.documentElement.style.height = "100%";
  if (document.body instanceof HTMLElement) {
    document.body.classList.remove("oc-echarts-view-state-body");
    document.body.style.background = "#050712";
    document.body.style.margin = "0";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    document.body.style.overflow = "hidden";
    document.body.replaceChildren();
  }
}

function ensureSurfaceStyle() {
  let link = document.head.querySelector(`[${SURFACE_STYLE_ATTR}]`);
  if (link instanceof HTMLLinkElement) {
    return link;
  }
  link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./surface.css", import.meta.url).href;
  link.setAttribute(SURFACE_STYLE_ATTR, "true");
  document.head.append(link);
  return link;
}

function createPreviewMetric(label, value) {
  const metric = document.createElement("div");
  metric.className = "oc-echarts-view-preview-metric";

  const labelNode = document.createElement("span");
  labelNode.textContent = label;

  const valueNode = document.createElement("strong");
  valueNode.textContent = value;

  metric.append(labelNode, valueNode);
  return metric;
}

function createPreviewBars() {
  const bars = document.createElement("div");
  bars.className = "oc-echarts-view-preview-bars";
  bars.setAttribute("aria-hidden", "true");
  for (const height of ["46%", "68%", "38%", "82%", "58%", "74%", "52%"]) {
    const bar = document.createElement("span");
    bar.style.height = height;
    bars.append(bar);
  }
  return bars;
}

function createPreviewSurface(tone) {
  const preview = document.createElement("aside");
  preview.className = "oc-echarts-view-preview";
  preview.setAttribute("aria-hidden", "true");

  const topbar = document.createElement("div");
  topbar.className = "oc-echarts-view-preview-topbar";
  for (const label of ["实时", "ECharts", "同源"]) {
    const pill = document.createElement("span");
    pill.textContent = label;
    topbar.append(pill);
  }

  const canvas = document.createElement("div");
  canvas.className = "oc-echarts-view-preview-canvas";
  const orbit = document.createElement("div");
  orbit.className = "oc-echarts-view-preview-orbit";
  const core = document.createElement("div");
  core.className = "oc-echarts-view-preview-core";
  canvas.append(orbit, core);

  const metrics = document.createElement("div");
  metrics.className = "oc-echarts-view-preview-metrics";
  const metricValues =
    tone === "error"
      ? [
          ["凭证", "失效"],
          ["资源", "重试"],
        ]
      : [
          ["渲染", "就绪"],
          ["资源", "同源"],
        ];
  for (const [label, value] of metricValues) {
    metrics.append(createPreviewMetric(label, value));
  }

  preview.append(topbar, canvas, createPreviewBars(), metrics);
  return preview;
}

function createStateShell({ eyebrow, title, message, tone = "neutral" }) {
  const root = document.createElement("main");
  root.id = SURFACE_ROOT_ID;
  root.className = `oc-echarts-view-state oc-echarts-view-state--${tone}`;

  const chrome = document.createElement("header");
  chrome.className = "oc-echarts-view-chrome";
  const brand = document.createElement("div");
  brand.className = "oc-echarts-view-brand";
  brand.textContent = "SPTC";
  const status = document.createElement("div");
  status.className = "oc-echarts-view-status";
  status.textContent = eyebrow;
  chrome.append(brand, status);

  const layout = document.createElement("section");
  layout.className = "oc-echarts-view-layout";

  const copy = document.createElement("div");
  copy.className = "oc-echarts-view-copy";

  const eyebrowNode = document.createElement("p");
  eyebrowNode.className = "oc-echarts-view-eyebrow";
  eyebrowNode.textContent = eyebrow;

  const titleNode = document.createElement("h1");
  titleNode.className = "oc-echarts-view-title";
  titleNode.textContent = title;

  const messageNode = document.createElement("p");
  messageNode.className = "oc-echarts-view-message";
  messageNode.textContent = message;

  const hint = document.createElement("div");
  hint.className = "oc-echarts-view-hint";
  hint.textContent =
    tone === "loading"
      ? "正在准备大屏运行环境"
      : tone === "error" || tone === "warning"
        ? "返回成员侧边栏后可重新打开"
        : "从成员工作台进入后会自动打开目标看板";

  copy.append(eyebrowNode, titleNode, messageNode, hint);
  layout.append(copy, createPreviewSurface(tone));
  root.append(chrome, layout);
  return root;
}

function showVisualizationState(state) {
  ensureSurfaceStyle();
  if (document.body instanceof HTMLElement) {
    document.body.classList.add("oc-echarts-view-state-body");
    document.body.replaceChildren(createStateShell(state));
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
  ensureSurfaceStyle();
  clearVisualizationHost();
  if (!token) {
    showVisualizationState({
      eyebrow: "可视化展示",
      title: "请选择一个可视化看板",
      message: "请从成员侧边栏的“可视化展示”进入，系统会自动携带本次看板访问凭证。",
      tone: "empty",
    });
    return null;
  }

  try {
    showVisualizationState({
      eyebrow: "可视化展示",
      title: "正在装载看板",
      message: "正在校验访问凭证并准备同源可视化资源。",
      tone: "loading",
    });
    const visualizationDocument = await loadVisualizationDocument(token);
    if (!visualizationDocument) {
      showVisualizationState({
        eyebrow: "可视化展示",
        title: "看板暂时不可用",
        message: "没有解析到可展示的页面内容，请返回成员侧边栏重新打开该看板。",
        tone: "warning",
      });
      return null;
    }
    normalizeEchartsViewTokenLocation(token);
    if (visualizationDocument.title) {
      document.title = visualizationDocument.title;
    }
    const frame = createVisualizationFrame(visualizationDocument.html);
    clearVisualizationHost();
    document.body.append(frame);
    return visualizationDocument;
  } catch {
    clearVisualizationHost();
    showVisualizationState({
      eyebrow: "可视化展示",
      title: "看板加载失败",
      message:
        "访问凭证或看板资源校验失败，请返回成员侧边栏重新打开，或联系管理员检查该 Agent 的 Echarts 入口。",
      tone: "error",
    });
    return null;
  }
}
