import { createTenantApiClient } from "../tenant/api-client.js";
import {
  isSandboxViewPublicPath,
  normalizeSandboxViewRouteUrl,
  readSandboxViewToken,
} from "./context.js";

const SURFACE_STYLE_ATTR = "data-openclaw-sandbox-view-surface-style";
const G6_VENDOR_PATH = "/assets/vendor/g6/g6.min.js";

function clearHost() {
  document.documentElement.style.background = "#06121f";
  document.documentElement.style.margin = "0";
  document.documentElement.style.width = "100%";
  document.documentElement.style.height = "100%";
  if (document.body instanceof HTMLElement) {
    document.body.classList.add("oc-sandbox-view-state-body");
    document.body.style.background = "#06121f";
    document.body.style.margin = "0";
    document.body.style.minHeight = "100vh";
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

function showState({ eyebrow, title, message }) {
  ensureSurfaceStyle();
  const card = document.createElement("section");
  card.className = "oc-sandbox-view-state-card";
  card.innerHTML = `
    <p class="oc-sandbox-view-eyebrow">${eyebrow}</p>
    <h1 class="oc-sandbox-view-title">${title}</h1>
    <p class="oc-sandbox-view-subtitle">${message}</p>
  `;
  const root = document.createElement("main");
  root.className = "oc-sandbox-view-state";
  root.append(card);
  document.body.replaceChildren(root);
}

function normalizeLocation() {
  const normalized = normalizeSandboxViewRouteUrl(window.location.href, window.location.href);
  if (
    normalized.pathname !== window.location.pathname ||
    normalized.search !== window.location.search
  ) {
    window.history.replaceState({}, "", normalized.toString());
  }
}

function normalizeTokenLocation(token) {
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

async function loadSandboxPayload(token) {
  if (!token) {
    return null;
  }
  return createTenantApiClient().resolveMemberSandbox(token);
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(number);
}

function createMetric(label, value) {
  const element = document.createElement("div");
  element.className = "oc-sandbox-view-metric";
  element.innerHTML = `
    <span class="oc-sandbox-view-metric-label">${label}</span>
    <strong class="oc-sandbox-view-metric-value">${value}</strong>
  `;
  return element;
}

function ensureG6Library() {
  if (window.G6?.Graph) {
    return Promise.resolve(window.G6);
  }
  if (window.__openclawSandboxViewG6LoadPromise) {
    return window.__openclawSandboxViewG6LoadPromise;
  }
  window.__openclawSandboxViewG6LoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = G6_VENDOR_PATH;
    script.async = true;
    script.onload = () => resolve(window.G6);
    script.onerror = () => reject(new Error("sandbox_g6_load_failed"));
    document.head.append(script);
  });
  return window.__openclawSandboxViewG6LoadPromise;
}

async function renderGraph(graphPayload) {
  const container = document.querySelector("#oc-sandbox-view-graph");
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (!Array.isArray(graphPayload?.nodes) || graphPayload.nodes.length === 0) {
    container.innerHTML = `<div class="oc-sandbox-view-graph-fallback">暂无图谱数据</div>`;
    return;
  }
  try {
    await ensureG6Library();
    if (!window.G6?.Graph) {
      throw new Error("sandbox_g6_unavailable");
    }
    const graph = new window.G6.Graph({
      container,
      width: Math.max(container.clientWidth, 320),
      height: Math.max(container.clientHeight, 520),
      data: graphPayload,
      layout: {
        type: "force",
        preventOverlap: true,
        nodeStrength: -220,
        linkDistance: 140,
      },
      node: {
        style: {
          labelText: (datum) => datum.label,
          size: 28,
          fill: (datum) => {
            const riskLevel = String(datum.riskLevel || "").trim().toLowerCase();
            if (riskLevel === "high") {
              return "#ef4444";
            }
            if (riskLevel === "medium") {
              return "#f59e0b";
            }
            return "#10b981";
          },
          stroke: "#dbeafe",
          lineWidth: 1.2,
        },
      },
      edge: {
        style: {
          labelText: (datum) => datum.label || "",
          stroke: "#6ea8d7",
          endArrow: true,
        },
      },
      behaviors: ["drag-canvas", "zoom-canvas", "drag-element"],
    });
    graph.render();
    window.__openclawSandboxGraphInstance = graph;
  } catch {
    container.innerHTML = `<div class="oc-sandbox-view-graph-fallback">G6 图谱资源加载失败，已降级为摘要视图</div>`;
  }
}

function renderSandbox(payload) {
  ensureSurfaceStyle();
  const sandboxName = String(payload?.sandboxName || "沙盒模拟").trim();
  const agentName = String(payload?.agentName || "").trim();
  const summary = payload?.summary || {};
  const recommendations = Array.isArray(payload?.recommendations) ? payload.recommendations : [];
  const report = payload?.report || {};

  document.title = sandboxName;
  const root = document.createElement("main");
  root.className = "oc-sandbox-view-shell";
  root.innerHTML = `
    <header class="oc-sandbox-view-header">
      <div>
        <p class="oc-sandbox-view-eyebrow">沙盒模拟</p>
        <h1 class="oc-sandbox-view-title">${sandboxName}</h1>
        <p class="oc-sandbox-view-subtitle">${agentName || "成员沙盒模拟工作台"}</p>
      </div>
    </header>
  `;

  const metrics = document.createElement("section");
  metrics.className = "oc-sandbox-view-metrics";
  metrics.append(
    createMetric("预测需求", formatNumber(summary.forecastDemandQty)),
    createMetric("建议采购量", formatNumber(summary.recommendedPurchaseQty)),
    createMetric("预计采购成本", formatNumber(summary.estimatedPurchaseCost)),
    createMetric("缺料风险", String(summary.shortageRiskLevel || "-")),
  );

  const grid = document.createElement("section");
  grid.className = "oc-sandbox-view-grid";

  const left = document.createElement("section");
  left.className = "oc-sandbox-view-panel";
  left.innerHTML = `
    <h2 class="oc-sandbox-view-section-title">知识图谱</h2>
    <div id="oc-sandbox-view-graph"></div>
  `;

  const right = document.createElement("section");
  right.className = "oc-sandbox-view-panel";
  const rowsHtml = recommendations
    .map(
      (item) => `
        <tr>
          <td>${item.materialId || "-"}</td>
          <td>${item.materialName || "-"}</td>
          <td>${formatNumber(item.recommendedQty)}</td>
          <td>${formatNumber(item.estimatedCost)}</td>
        </tr>`,
    )
    .join("");
  const bulletsHtml = Array.isArray(report.bullets)
    ? report.bullets.map((item) => `<li>${item}</li>`).join("")
    : "";
  right.innerHTML = `
    <h2 class="oc-sandbox-view-section-title">采购建议</h2>
    <table class="oc-sandbox-view-table">
      <thead>
        <tr>
          <th>物料编码</th>
          <th>物料名称</th>
          <th>建议数量</th>
          <th>预计成本</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <h2 class="oc-sandbox-view-section-title" style="margin-top:18px;">解释报告</h2>
    <p class="oc-sandbox-view-subtitle">${report.headline || ""}</p>
    <ul class="oc-sandbox-view-report">${bulletsHtml}</ul>
  `;

  grid.append(left, right);
  root.append(metrics, grid);
  document.body.replaceChildren(root);
  void renderGraph(payload?.graph || {});
}

export async function bootSandboxViewSurface() {
  if (window.__openclawSandboxViewSurfaceBooted) {
    return null;
  }
  window.__openclawSandboxViewSurfaceBooted = true;

  if (!isSandboxViewPublicPath(window.location.pathname)) {
    return null;
  }

  const token = readSandboxViewToken();
  normalizeLocation();
  ensureSurfaceStyle();
  clearHost();
  if (!token) {
    showState({
      eyebrow: "沙盒模拟",
      title: "请选择一个沙盒模拟",
      message: "请从成员侧边栏的“沙盒模拟”进入，系统会自动携带本次模拟访问凭证。",
    });
    return null;
  }

  try {
    showState({
      eyebrow: "沙盒模拟",
      title: "正在装载模拟场景",
      message: "正在读取图谱、预测结果和采购建议。",
    });
    const payload = await loadSandboxPayload(token);
    if (!payload) {
      throw new Error("sandbox_payload_empty");
    }
    normalizeTokenLocation(token);
    renderSandbox(payload);
    return payload;
  } catch {
    showState({
      eyebrow: "沙盒模拟",
      title: "沙盒加载失败",
      message: "当前访问凭证不可用，返回成员侧边栏后可重新打开。",
    });
    return null;
  }
}
