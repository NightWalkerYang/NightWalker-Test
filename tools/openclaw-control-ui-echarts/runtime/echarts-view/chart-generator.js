import { parseEchartsPayload } from "../echarts/parser.js";
import { renderContent } from "../echarts/adapter.js";

const CHART_GEN_ATTR = "data-oc-chart-gen-processed";

/**
 * 监听 AI 对话中出现的 echarts 代码块，自动渲染并提供"添加到大屏"按钮
 * @param {HTMLElement} root - 大屏编辑器根节点
 * @param {Function} onAddChart - 用户点击"添加到大屏"后的回调，接收 echartsOption
 */
export function bootChartGenerator(root, { onAddChart } = {}) {
  if (typeof onAddChart !== "function") {
    return;
  }

  const observer = new MutationObserver(() => {
    interceptEchartsBlocks(root, onAddChart);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  interceptEchartsBlocks(root, onAddChart);

  return () => observer.disconnect();
}

function interceptEchartsBlocks(root, onAddChart) {
  const blocks = document.querySelectorAll(
    `pre code[class*="language-echarts"]:not([${CHART_GEN_ATTR}]),
     pre[class*="language-echarts"]:not([${CHART_GEN_ATTR}]),
     [data-oc-echarts-rendered]:not([${CHART_GEN_ATTR}])`,
  );

  for (const block of blocks) {
    block.setAttribute(CHART_GEN_ATTR, "true");
    tryAttachAddButton(block, onAddChart);
  }
}

function tryAttachAddButton(block, onAddChart) {
  const codeText =
    block.textContent ||
    block.querySelector("code")?.textContent ||
    "";
  if (!codeText.trim()) {
    return;
  }

  let echartsOption;
  try {
    const payload = parseEchartsPayload(codeText.trim());
    echartsOption = payload?.option || payload;
    if (!echartsOption || typeof echartsOption !== "object") {
      return;
    }
  } catch {
    return;
  }

  const container = block.closest("pre") || block.parentElement;
  if (!container) {
    return;
  }

  if (container.querySelector(".oc-chart-gen-btn")) {
    return;
  }

  const btn = document.createElement("button");
  btn.className = "oc-chart-gen-btn";
  btn.textContent = "+ 添加到当前大屏";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onAddChart(echartsOption);
    btn.textContent = "✓ 已添加";
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = "+ 添加到当前大屏";
      btn.disabled = false;
    }, 2000);
  });

  container.style.position = "relative";
  container.append(btn);

  injectChartGenStyles();
}

let _stylesInjected = false;
function injectChartGenStyles() {
  if (_stylesInjected) {
    return;
  }
  _stylesInjected = true;

  const style = document.createElement("style");
  style.setAttribute("data-oc-chart-gen-style", "true");
  style.textContent = `
    .oc-chart-gen-btn {
      position: absolute;
      bottom: 8px;
      right: 8px;
      padding: 5px 10px;
      border-radius: 7px;
      border: none;
      background: var(--accent, #2563eb);
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s;
      z-index: 10;
    }
    pre:hover .oc-chart-gen-btn,
    [data-oc-echarts-rendered]:hover .oc-chart-gen-btn {
      opacity: 1;
    }
    .oc-chart-gen-btn:disabled {
      background: #16a34a;
      cursor: default;
    }
  `;
  document.head.append(style);
}
