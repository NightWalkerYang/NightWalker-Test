(function () {
  "use strict";

  const currentScript = document.currentScript;
  const scriptUrl =
    currentScript && currentScript.src
      ? new URL(currentScript.src, window.location.href)
      : new URL("./assets/openclaw-echarts-renderer.js", window.location.href);
  const assetBaseUrl = new URL("./", scriptUrl);
  const vendorBaseUrl = new URL("./vendor/", assetBaseUrl);

  const SOURCE_HASH_ATTR = "data-oc-echarts-source-hash";
  const RENDER_MODE_ATTR = "data-oc-echarts-render-mode";
  const SOURCE_STATE_ATTR = "data-oc-echarts-source-state";
  const STREAMING_BUBBLE_ATTR = "data-oc-echarts-loading";
  const STREAMING_PLACEHOLDER_ATTR = "data-oc-echarts-streaming-placeholder";
  const LANGUAGE_ALIASES = new Set([
    "echarts",
    "echart",
    "chart",
    "echarts-option",
    "echartsoption",
  ]);
  const JS_PLACEHOLDER_PREFIX = "__OC_ECHARTS_JS__";
  const UI_TEXT = Object.freeze({
    badge: "图表",
    toggleShowSource: "显示源码",
    toggleHideSource: "隐藏源码",
    summaryLoading: "图表生成中",
    summarySuccess: "图表预览已生成",
    summaryError: "图表预览失败",
    loadingTitle: "图表生成中...",
    loadingRuntimeDetail: "正在加载本地图表运行时...",
    loadingStreamingDetail: "正在等待 AI 输出完整的图表配置",
    errorTitle: "无法渲染该图表。",
    detailTitle: "图表元素详情",
    detailClose: "关闭",
    detailSeries: "系列",
    detailName: "名称",
    detailValue: "值",
    detailComponent: "组件",
    detailSeriesType: "系列类型",
    detailDataType: "数据类型",
    detailDataIndex: "数据索引",
    detailColor: "颜色",
    detailRawData: "原始数据",
    detailRawParams: "事件参数",
    detailNoData: "当前元素没有可展示的详情。",
  });

  const libraryPromiseByKey = new Map();
  const hostByWrapper = new WeakMap();
  const chartStateByHost = new WeakMap();
  let detailModalElements = null;

  let stylesInstalled = false;
  let scanQueued = false;
  let scanRunning = false;

  function installStyles() {
    if (stylesInstalled) {
      return;
    }
    stylesInstalled = true;

    const style = document.createElement("style");
    style.textContent = `
      .oc-echarts-renderer {
        margin: 12px 0;
        border: 1px solid rgba(127, 127, 127, 0.24);
        border-radius: 14px;
        overflow: hidden;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
          rgba(127, 127, 127, 0.04);
      }

      .chat-bubble[data-oc-echarts-loading="true"] > .chat-bubble-actions {
        display: none;
      }

      .oc-echarts-renderer__toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(127, 127, 127, 0.18);
        background: rgba(127, 127, 127, 0.05);
      }

      .oc-echarts-renderer__toolbar--no-toggle {
        justify-content: flex-start;
      }

      .oc-echarts-renderer__meta {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .oc-echarts-renderer__badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #0f172a;
        background: #f59e0b;
      }

      .oc-echarts-renderer__summary {
        font-size: 12px;
        color: inherit;
        opacity: 0.78;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .oc-echarts-renderer__toggle {
        appearance: none;
        border: 1px solid rgba(127, 127, 127, 0.25);
        border-radius: 999px;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font: inherit;
        font-size: 12px;
        padding: 6px 10px;
      }

      .oc-echarts-renderer__toggle:hover {
        background: rgba(127, 127, 127, 0.08);
      }

      .oc-echarts-renderer__body {
        padding: 12px;
      }

      .oc-echarts-renderer__chart {
        width: 100%;
        min-height: 320px;
      }

      .oc-echarts-renderer__status {
        font-size: 13px;
        line-height: 1.5;
        border-radius: 10px;
        padding: 10px 12px;
      }

      .oc-echarts-renderer__status--loading {
        color: inherit;
        opacity: 0.78;
        background: rgba(127, 127, 127, 0.05);
      }

      .oc-echarts-renderer__status--error {
        color: #991b1b;
        background: rgba(220, 38, 38, 0.08);
      }

      .oc-echarts-renderer__status code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 12px;
      }

      .oc-echarts-renderer__loading-shell {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .oc-echarts-renderer__spinner {
        position: relative;
        width: 24px;
        height: 24px;
        flex: 0 0 auto;
        border: 2px solid rgba(245, 158, 11, 0.18);
        border-top-color: rgba(245, 158, 11, 0.88);
        border-radius: 999px;
        animation: oc-echarts-spin 1s linear infinite;
      }

      .oc-echarts-renderer__spinner::after {
        content: "";
        position: absolute;
        inset: 5px;
        border-radius: 999px;
        background: rgba(245, 158, 11, 0.12);
      }

      .oc-echarts-renderer__loading-copy {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .oc-echarts-renderer__loading-title {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
      }

      .oc-echarts-renderer__loading-subtitle {
        font-size: 12px;
        opacity: 0.8;
      }

      .oc-echarts-renderer__pulse-dots {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .oc-echarts-renderer__pulse-dots > span {
        width: 5px;
        height: 5px;
        border-radius: 999px;
        background: currentColor;
        opacity: 0.32;
        animation: oc-echarts-pulse 1.2s ease-in-out infinite;
      }

      .oc-echarts-renderer__pulse-dots > span:nth-child(2) {
        animation-delay: 0.16s;
      }

      .oc-echarts-renderer__pulse-dots > span:nth-child(3) {
        animation-delay: 0.32s;
      }

      .oc-echarts-renderer__error-title {
        margin-bottom: 6px;
        font-weight: 600;
      }

      .oc-echarts-renderer__error-detail {
        display: block;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .oc-echarts-detail-modal[hidden] {
        display: none;
      }

      .oc-echarts-detail-modal {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(15, 23, 42, 0.42);
        backdrop-filter: blur(6px);
      }

      .oc-echarts-detail-modal__dialog {
        width: min(720px, calc(100vw - 32px));
        max-height: min(80vh, 880px);
        overflow: hidden;
        border-radius: 18px;
        border: 1px solid rgba(127, 127, 127, 0.2);
        background: rgba(255, 255, 255, 0.96);
        color: #0f172a;
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
      }

      .oc-echarts-detail-modal__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 18px;
        border-bottom: 1px solid rgba(127, 127, 127, 0.14);
      }

      .oc-echarts-detail-modal__title {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
      }

      .oc-echarts-detail-modal__close {
        appearance: none;
        border: 1px solid rgba(127, 127, 127, 0.22);
        border-radius: 999px;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font: inherit;
        font-size: 13px;
        padding: 7px 12px;
      }

      .oc-echarts-detail-modal__close:hover {
        background: rgba(127, 127, 127, 0.08);
      }

      .oc-echarts-detail-modal__body {
        padding: 18px;
        overflow: auto;
        max-height: calc(min(80vh, 880px) - 74px);
      }

      .oc-echarts-detail-modal__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }

      .oc-echarts-detail-modal__card {
        border-radius: 14px;
        border: 1px solid rgba(127, 127, 127, 0.16);
        background: rgba(248, 250, 252, 0.92);
        padding: 12px 14px;
      }

      .oc-echarts-detail-modal__label {
        margin-bottom: 6px;
        font-size: 12px;
        font-weight: 600;
        color: rgba(15, 23, 42, 0.68);
      }

      .oc-echarts-detail-modal__value {
        font-size: 14px;
        line-height: 1.55;
        word-break: break-word;
      }

      .oc-echarts-detail-modal__value--mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 13px;
      }

      .oc-echarts-detail-modal__swatch {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .oc-echarts-detail-modal__swatch-chip {
        width: 12px;
        height: 12px;
        border-radius: 999px;
        border: 1px solid rgba(15, 23, 42, 0.12);
        flex: 0 0 auto;
      }

      .oc-echarts-detail-modal__section {
        margin-top: 18px;
      }

      .oc-echarts-detail-modal__section:first-child {
        margin-top: 0;
      }

      .oc-echarts-detail-modal__section-title {
        margin: 0 0 10px;
        font-size: 13px;
        font-weight: 700;
      }

      .oc-echarts-detail-modal__pre {
        margin: 0;
        padding: 12px 14px;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
        border-radius: 14px;
        border: 1px solid rgba(127, 127, 127, 0.16);
        background: rgba(248, 250, 252, 0.92);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 12px;
        line-height: 1.6;
      }

      .oc-echarts-detail-modal__empty {
        font-size: 14px;
        line-height: 1.6;
        color: rgba(15, 23, 42, 0.7);
      }

      @keyframes oc-echarts-spin {
        from {
          transform: rotate(0deg);
        }

        to {
          transform: rotate(360deg);
        }
      }

      @keyframes oc-echarts-pulse {
        0%,
        80%,
        100% {
          opacity: 0.25;
          transform: translateY(0);
        }

        40% {
          opacity: 0.9;
          transform: translateY(-1px);
        }
      }
    `;
    document.head.append(style);
  }

  function loadScriptOnce(key, url, globalName) {
    if (window[globalName]) {
      return Promise.resolve(window[globalName]);
    }

    const existingPromise = libraryPromiseByKey.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url.href;
      script.async = true;
      script.setAttribute("data-oc-echarts-lib", key);
      script.addEventListener(
        "load",
        () => {
          if (window[globalName]) {
            resolve(window[globalName]);
            return;
          }
          reject(new Error(`Loaded ${url.href} but window.${globalName} is unavailable.`));
        },
        { once: true },
      );
      script.addEventListener(
        "error",
        () => {
          reject(new Error(`Failed to load ${url.href}`));
        },
        { once: true },
      );
      document.head.append(script);
    }).catch((error) => {
      libraryPromiseByKey.delete(key);
      throw error;
    });

    libraryPromiseByKey.set(key, promise);
    return promise;
  }

  async function ensureLibraries() {
    const echarts = await loadScriptOnce(
      "echarts",
      new URL("./echarts.min.js", vendorBaseUrl),
      "echarts",
    );
    const json5 = await loadScriptOnce("json5", new URL("./json5.min.js", vendorBaseUrl), "JSON5");
    return { echarts, json5 };
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\r\n?/g, "\n")
      .trim();
  }

  function hashText(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getLanguageFromCodeBlock(codeEl) {
    for (const className of codeEl.classList) {
      if (className.startsWith("language-")) {
        return className.slice("language-".length).trim().toLowerCase();
      }
    }

    const wrapper = codeEl.closest(".code-block-wrapper");
    const label = wrapper?.querySelector(".code-block-lang")?.textContent?.trim().toLowerCase();
    return label || "";
  }

  function isEchartsLanguage(codeEl) {
    return LANGUAGE_ALIASES.has(getLanguageFromCodeBlock(codeEl));
  }

  function getWrapperElement(codeEl) {
    return codeEl.closest(".code-block-wrapper") || codeEl.closest("pre");
  }

  function findCandidateCodeBlocks(root) {
    return Array.from(root.querySelectorAll("pre > code")).filter(isEchartsLanguage);
  }

  function isStreamingBubble(node) {
    return Boolean(node?.closest?.(".chat-bubble.streaming"));
  }

  function getRenderMode(anchor) {
    return anchor.getAttribute(RENDER_MODE_ATTR) || "";
  }

  function setRenderMode(anchor, mode) {
    anchor.setAttribute(RENDER_MODE_ATTR, mode);
  }

  function setBubbleLoadingState(anchor, active) {
    const bubble = anchor?.closest?.(".chat-bubble");
    if (!bubble) {
      return;
    }
    if (active) {
      bubble.setAttribute(STREAMING_BUBBLE_ATTR, "true");
      return;
    }
    bubble.removeAttribute(STREAMING_BUBBLE_ATTR);
  }

  function hasPendingEchartsFence(text) {
    const normalized = String(text || "").replace(/\r\n?/g, "\n");
    if (!normalized.includes("```")) {
      return false;
    }

    const fencePattern = /(^|\n)(`{3,}|~{3,})[^\S\n]*([A-Za-z0-9_-]*)[^\n]*(?=\n|$)/g;
    let openMarker = "";
    let openLanguage = "";

    for (const match of normalized.matchAll(fencePattern)) {
      const marker = (match[2] || "")[0] || "";
      const language = String(match[3] || "")
        .trim()
        .toLowerCase();

      if (!openMarker) {
        openMarker = marker;
        openLanguage = language;
        continue;
      }

      if (openMarker === marker) {
        openMarker = "";
        openLanguage = "";
      } else {
        openMarker = marker;
        openLanguage = language;
      }
    }

    return Boolean(openMarker && LANGUAGE_ALIASES.has(openLanguage));
  }

  function shouldHideStreamingTextBlock(textEl) {
    if (!isStreamingBubble(textEl)) {
      return false;
    }
    if (findCandidateCodeBlocks(textEl).length > 0) {
      return false;
    }

    const rawText = String(textEl.textContent || "").replace(/\r\n?/g, "\n").trim();
    if (!rawText) {
      return false;
    }

    return /^```+\s*(?:echar|chart)/i.test(rawText) && hasPendingEchartsFence(rawText);
  }

  function localizeSourceWrapper(wrapper) {
    const languageLabel = wrapper.querySelector(".code-block-lang");
    const normalizedLanguage = normalizeText(languageLabel?.textContent || "").toLowerCase();
    if (languageLabel && LANGUAGE_ALIASES.has(normalizedLanguage)) {
      languageLabel.textContent = UI_TEXT.badge;
    }

    const copyButton = wrapper.querySelector(".code-block-copy");
    if (copyButton) {
      copyButton.setAttribute("aria-label", "复制代码");
    }

    const idleLabel = wrapper.querySelector(".code-block-copy__idle");
    if (idleLabel) {
      idleLabel.textContent = "复制";
    }

    const copiedLabel = wrapper.querySelector(".code-block-copy__done");
    if (copiedLabel) {
      copiedLabel.textContent = "已复制";
    }
  }

  function localizeErrorMessage(detail) {
    let message = normalizeText(detail);
    if (!message) {
      return "未知错误。";
    }

    const exactMessages = new Map([
      ["The echarts code block is empty.", "图表代码块为空。"],
      ["ECharts option must be an object literal.", "图表配置必须是对象字面量。"],
      ["Unterminated block comment in echarts block.", "图表代码块中的块注释未闭合。"],
      ["Unterminated template literal in echarts block.", "图表代码块中的模板字符串未闭合。"],
      ["Unterminated string literal in echarts block.", "图表代码块中的字符串未闭合。"],
      ["Unsupported function syntax in echarts block.", "图表代码块中的函数语法暂不支持。"],
      ["Unsupported function body syntax in echarts block.", "图表代码块中的函数体语法暂不支持。"],
      [
        "Unsupported echarts.graphic constructor in echarts block.",
        "图表代码块中的图形渐变构造器暂不支持。",
      ],
      [
        "Unsupported echarts.graphic constructor call in echarts block.",
        "图表代码块中的图形渐变调用暂不支持。",
      ],
      ["Unsupported echarts.graphic constructor.", "不支持的图形渐变构造器。"],
      ["Unsupported echarts.graphic constructor syntax.", "不支持的图形渐变构造语法。"],
    ]);

    if (exactMessages.has(message)) {
      return exactMessages.get(message);
    }

    const transforms = [
      {
        pattern: /^Could not parse the echarts block\.\s*/i,
        replace: "无法解析图表代码块。",
      },
      {
        pattern: /^Could not parse JavaScript-style ECharts value\.\s*/i,
        replace: "无法解析 JavaScript 风格的图表配置值。",
      },
      {
        pattern: /^JSON5:\s*/i,
        replace: "JSON5 解析错误：",
      },
      {
        pattern: /^Loaded .+ but window\.(\w+) is unavailable\.?$/i,
        replace: (_, globalName) => `资源已加载，但 window.${globalName} 不可用。`,
      },
      {
        pattern: /^Failed to load (.+)$/i,
        replace: (_, url) => `资源加载失败：${url}`,
      },
      {
        pattern: /^echarts\.graphic\.(\w+) is unavailable\.?$/i,
        replace: (_, constructorName) =>
          `当前图表运行时不支持 ${constructorName} 渐变构造器。`,
      },
      {
        pattern: /^Unterminated ([^\s]+) pair in echarts block\.?$/i,
        replace: (_, pair) => `图表代码块中的 ${pair} 结构未闭合。`,
      },
    ];

    for (const { pattern, replace } of transforms) {
      if (pattern.test(message)) {
        message = message.replace(pattern, replace);
      }
    }

    message = message
      .replace(/Functions are intentionally not supported\./gi, "出于安全考虑，不支持直接执行函数。")
      .replace(/Unknown error/gi, "未知错误");

    return /[A-Za-z]/.test(message)
      ? "请检查图表配置是否完整，确认括号、引号和代码块都已闭合。"
      : message;
  }

  function createLoadingStatusMarkup(detail) {
    return `
      <div class="oc-echarts-renderer__loading-shell">
        <span class="oc-echarts-renderer__spinner" aria-hidden="true"></span>
        <div class="oc-echarts-renderer__loading-copy">
          <div class="oc-echarts-renderer__loading-title">
            <span>${escapeHtml(UI_TEXT.loadingTitle)}</span>
            <span class="oc-echarts-renderer__pulse-dots" aria-hidden="true">
              <span></span><span></span><span></span>
            </span>
          </div>
          <div class="oc-echarts-renderer__loading-subtitle">${escapeHtml(detail)}</div>
        </div>
      </div>
    `;
  }

  function createErrorStatusMarkup(detail) {
    return `
      <div class="oc-echarts-renderer__error-title">${escapeHtml(UI_TEXT.errorTitle)}</div>
      <code class="oc-echarts-renderer__error-detail">${escapeHtml(localizeErrorMessage(detail))}</code>
    `;
  }

  function truncateString(value, maxLength = 160) {
    const text = String(value ?? "");
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
  }

  function toDisplayString(value) {
    if (value == null) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  function cloneSerializableValue(value, seen = new WeakSet(), depth = 0) {
    if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }

    if (typeof value === "bigint") {
      return String(value);
    }

    if (typeof value === "function") {
      return "[Function]";
    }

    if (typeof value !== "object") {
      return String(value);
    }

    if (seen.has(value)) {
      return "[Circular]";
    }

    if (depth >= 4) {
      return "[MaxDepth]";
    }

    seen.add(value);
    try {
      if (Array.isArray(value)) {
        return value.slice(0, 60).map((item) => cloneSerializableValue(item, seen, depth + 1));
      }

      const result = {};
      const entries = Object.entries(value).slice(0, 60);
      for (const [key, child] of entries) {
        result[key] = cloneSerializableValue(child, seen, depth + 1);
      }
      return result;
    } finally {
      seen.delete(value);
    }
  }

  function stringifyDetailJson(value) {
    if (typeof value === "undefined") {
      return "";
    }

    try {
      return JSON.stringify(cloneSerializableValue(value), null, 2);
    } catch {
      return toDisplayString(value);
    }
  }

  function isSafeCssColor(value) {
    const text = String(value || "").trim();
    if (!text) {
      return false;
    }

    return /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]{1,64}\)|hsla?\([^)]{1,64}\)|[a-zA-Z]{3,24})$/.test(text);
  }

  function formatDetailValueHtml(value, options = {}) {
    if (typeof value === "undefined" || value === null || value === "") {
      return "";
    }

    if (options.colorSwatch && typeof value === "string" && isSafeCssColor(value)) {
      return `
        <span class="oc-echarts-detail-modal__swatch">
          <span class="oc-echarts-detail-modal__swatch-chip" style="background:${escapeHtml(value)}"></span>
          <span class="oc-echarts-detail-modal__value--mono">${escapeHtml(value)}</span>
        </span>
      `;
    }

    const text = options.mono ? toDisplayString(value) : truncateString(toDisplayString(value), 220);
    return `<span class="${options.mono ? "oc-echarts-detail-modal__value oc-echarts-detail-modal__value--mono" : "oc-echarts-detail-modal__value"}">${escapeHtml(text)}</span>`;
  }

  function buildDetailCardsHtml(rows) {
    const visibleRows = rows.filter((row) => typeof row.value !== "undefined" && row.value !== null && row.value !== "");
    if (visibleRows.length === 0) {
      return `<div class="oc-echarts-detail-modal__empty">${escapeHtml(UI_TEXT.detailNoData)}</div>`;
    }

    return `
      <div class="oc-echarts-detail-modal__grid">
        ${visibleRows
          .map(
            (row) => `
              <section class="oc-echarts-detail-modal__card">
                <div class="oc-echarts-detail-modal__label">${escapeHtml(row.label)}</div>
                <div class="oc-echarts-detail-modal__value">
                  ${formatDetailValueHtml(row.value, row.options)}
                </div>
              </section>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function buildDetailSectionHtml(title, content) {
    if (!content) {
      return "";
    }

    return `
      <section class="oc-echarts-detail-modal__section">
        <h4 class="oc-echarts-detail-modal__section-title">${escapeHtml(title)}</h4>
        <pre class="oc-echarts-detail-modal__pre">${escapeHtml(content)}</pre>
      </section>
    `;
  }

  function extractClickDetailRows(params) {
    return [
      { label: UI_TEXT.detailSeries, value: params.seriesName },
      { label: UI_TEXT.detailName, value: params.name },
      { label: UI_TEXT.detailValue, value: params.value, options: { mono: Array.isArray(params.value) || typeof params.value === "object" } },
      { label: UI_TEXT.detailComponent, value: params.componentType },
      { label: UI_TEXT.detailSeriesType, value: params.seriesType },
      { label: UI_TEXT.detailDataType, value: params.dataType },
      { label: UI_TEXT.detailDataIndex, value: params.dataIndex, options: { mono: true } },
      { label: UI_TEXT.detailColor, value: typeof params.color === "string" ? params.color : undefined, options: { colorSwatch: true } },
    ];
  }

  function ensureDetailModal() {
    if (detailModalElements?.root?.isConnected) {
      return detailModalElements;
    }

    const root = document.createElement("div");
    root.className = "oc-echarts-detail-modal";
    root.hidden = true;
    root.innerHTML = `
      <div class="oc-echarts-detail-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="oc-echarts-detail-title">
        <div class="oc-echarts-detail-modal__header">
          <h3 id="oc-echarts-detail-title" class="oc-echarts-detail-modal__title">${escapeHtml(UI_TEXT.detailTitle)}</h3>
          <button type="button" class="oc-echarts-detail-modal__close">${escapeHtml(UI_TEXT.detailClose)}</button>
        </div>
        <div class="oc-echarts-detail-modal__body"></div>
      </div>
    `;

    const body = root.querySelector(".oc-echarts-detail-modal__body");
    const closeButton = root.querySelector(".oc-echarts-detail-modal__close");

    const closeModal = () => {
      root.hidden = true;
    };

    root.addEventListener("click", (event) => {
      if (event.target === root) {
        closeModal();
      }
    });

    closeButton?.addEventListener("click", closeModal);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !root.hidden) {
        closeModal();
      }
    });

    document.body.append(root);
    detailModalElements = { root, body, closeModal };
    return detailModalElements;
  }

  function openChartDetailModal(params) {
    installStyles();

    const modal = ensureDetailModal();
    const detailRows = extractClickDetailRows(params);
    const rawData = stringifyDetailJson(params.data);
    const rawParams = stringifyDetailJson({
      componentType: params.componentType,
      componentSubType: params.componentSubType,
      seriesType: params.seriesType,
      seriesIndex: params.seriesIndex,
      seriesName: params.seriesName,
      name: params.name,
      value: params.value,
      dataIndex: params.dataIndex,
      dataType: params.dataType,
      color: params.color,
      dimensionNames: params.dimensionNames,
      encode: params.encode,
      percent: params.percent,
    });

    modal.body.innerHTML = `
      ${buildDetailCardsHtml(detailRows)}
      ${buildDetailSectionHtml(UI_TEXT.detailRawData, rawData)}
      ${buildDetailSectionHtml(UI_TEXT.detailRawParams, rawParams)}
    `;

    modal.root.hidden = false;
  }

  function normalizeOptionSource(raw) {
    let text = normalizeText(raw);
    if (!text) {
      return text;
    }

    text = text
      .replace(/^```[a-z0-9_-]*\s*\n/i, "")
      .replace(/\n```$/i, "")
      .trim();

    const wrappers = [
      /^(?:const|let|var)\s+option\s*=\s*/i,
      /^option\s*=\s*/i,
      /^return\s+/i,
      /^export\s+default\s+/i,
    ];

    for (const pattern of wrappers) {
      if (pattern.test(text)) {
        text = text.replace(pattern, "").trim();
      }
    }

    text = text.replace(/;\s*$/, "").trim();

    if (text.startsWith("(") && text.endsWith(")")) {
      const inner = text.slice(1, -1).trim();
      if (inner.startsWith("{") && inner.endsWith("}")) {
        text = inner;
      }
    }

    return text;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function unwrapParsedPayload(parsed) {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("ECharts option must be an object literal.");
    }

    const heightOverride =
      typeof parsed.height === "number" && Number.isFinite(parsed.height)
        ? clamp(parsed.height, 280, 960)
        : null;

    if (
      parsed.option &&
      typeof parsed.option === "object" &&
      !Array.isArray(parsed.option) &&
      Object.keys(parsed).every((key) => key === "option" || key === "height")
    ) {
      return { option: parsed.option, heightOverride };
    }

    return { option: parsed, heightOverride };
  }

  function wrapBareObjectLiteral(source) {
    const trimmed = source.trim();
    if (!trimmed) {
      return trimmed;
    }

    if (trimmed.startsWith("{")) {
      return trimmed;
    }

    return `{\n${trimmed}\n}`;
  }

  function isIdentifierStart(char) {
    return /^[A-Za-z_$]$/.test(char || "");
  }

  function isIdentifierChar(char) {
    return /^[A-Za-z0-9_$]$/.test(char || "");
  }

  function skipWhitespace(source, index) {
    let cursor = index;
    while (cursor < source.length && /\s/.test(source[cursor])) {
      cursor += 1;
    }
    return cursor;
  }

  function scanLineComment(source, start) {
    let cursor = start + 2;
    while (cursor < source.length && source[cursor] !== "\n") {
      cursor += 1;
    }
    return cursor;
  }

  function scanBlockComment(source, start) {
    const endIndex = source.indexOf("*/", start + 2);
    if (endIndex === -1) {
      throw new Error("Unterminated block comment in echarts block.");
    }
    return endIndex + 2;
  }

  function scanTemplateLiteral(source, start) {
    let cursor = start + 1;
    while (cursor < source.length) {
      const char = source[cursor];
      if (char === "\\") {
        cursor += 2;
        continue;
      }
      if (char === "`") {
        return cursor + 1;
      }
      if (char === "$" && source[cursor + 1] === "{") {
        cursor = scanBalanced(source, cursor + 1, "{", "}");
        continue;
      }
      cursor += 1;
    }
    throw new Error("Unterminated template literal in echarts block.");
  }

  function scanQuotedString(source, start, quote) {
    if (quote === "`") {
      return scanTemplateLiteral(source, start);
    }

    let cursor = start + 1;
    while (cursor < source.length) {
      const char = source[cursor];
      if (char === "\\") {
        cursor += 2;
        continue;
      }
      if (char === quote) {
        return cursor + 1;
      }
      cursor += 1;
    }
    throw new Error("Unterminated string literal in echarts block.");
  }

  function scanBalanced(source, start, openChar, closeChar) {
    let depth = 1;
    let cursor = start + 1;

    while (cursor < source.length) {
      const char = source[cursor];
      const next = source[cursor + 1];

      if (char === "'" || char === '"' || char === "`") {
        cursor = scanQuotedString(source, cursor, char);
        continue;
      }
      if (char === "/" && next === "/") {
        cursor = scanLineComment(source, cursor);
        continue;
      }
      if (char === "/" && next === "*") {
        cursor = scanBlockComment(source, cursor);
        continue;
      }
      if (char === openChar) {
        depth += 1;
        cursor += 1;
        continue;
      }
      if (char === closeChar) {
        depth -= 1;
        cursor += 1;
        if (depth === 0) {
          return cursor;
        }
        continue;
      }
      cursor += 1;
    }

    throw new Error(`Unterminated ${openChar}${closeChar} pair in echarts block.`);
  }

  function scanFunctionExpression(source, start) {
    let cursor = start + "function".length;
    cursor = skipWhitespace(source, cursor);

    if (source[cursor] === "*") {
      cursor += 1;
      cursor = skipWhitespace(source, cursor);
    }

    if (isIdentifierStart(source[cursor])) {
      cursor += 1;
      while (cursor < source.length && isIdentifierChar(source[cursor])) {
        cursor += 1;
      }
      cursor = skipWhitespace(source, cursor);
    }

    if (source[cursor] !== "(") {
      throw new Error("Unsupported function syntax in echarts block.");
    }
    cursor = scanBalanced(source, cursor, "(", ")");
    cursor = skipWhitespace(source, cursor);

    if (source[cursor] !== "{") {
      throw new Error("Unsupported function body syntax in echarts block.");
    }
    return scanBalanced(source, cursor, "{", "}");
  }

  function scanGraphicConstructor(source, start) {
    const prefix = "new echarts.graphic.";
    let cursor = start + prefix.length;

    if (!isIdentifierStart(source[cursor])) {
      throw new Error("Unsupported echarts.graphic constructor in echarts block.");
    }

    cursor += 1;
    while (cursor < source.length && isIdentifierChar(source[cursor])) {
      cursor += 1;
    }
    cursor = skipWhitespace(source, cursor);

    if (source[cursor] !== "(") {
      throw new Error("Unsupported echarts.graphic constructor call in echarts block.");
    }

    return scanBalanced(source, cursor, "(", ")");
  }

  function createJsPlaceholder(index) {
    return `${JS_PLACEHOLDER_PREFIX}${index}__`;
  }

  function extractJsOnlyConstructs(source) {
    let result = "";
    let cursor = 0;
    const placeholders = new Map();

    while (cursor < source.length) {
      const char = source[cursor];
      const next = source[cursor + 1];

      if (char === "'" || char === '"' || char === "`") {
        const endIndex = scanQuotedString(source, cursor, char);
        result += source.slice(cursor, endIndex);
        cursor = endIndex;
        continue;
      }

      if (char === "/" && next === "/") {
        const endIndex = scanLineComment(source, cursor);
        result += source.slice(cursor, endIndex);
        cursor = endIndex;
        continue;
      }

      if (char === "/" && next === "*") {
        const endIndex = scanBlockComment(source, cursor);
        result += source.slice(cursor, endIndex);
        cursor = endIndex;
        continue;
      }

      if (
        source.startsWith("function", cursor) &&
        !isIdentifierChar(source[cursor - 1]) &&
        !isIdentifierChar(source[cursor + "function".length])
      ) {
        const endIndex = scanFunctionExpression(source, cursor);
        const token = createJsPlaceholder(placeholders.size);
        placeholders.set(token, {
          type: "function",
          source: source.slice(cursor, endIndex),
        });
        result += JSON.stringify(token);
        cursor = endIndex;
        continue;
      }

      if (source.startsWith("new echarts.graphic.", cursor)) {
        const endIndex = scanGraphicConstructor(source, cursor);
        const token = createJsPlaceholder(placeholders.size);
        placeholders.set(token, {
          type: "graphic-constructor",
          source: source.slice(cursor, endIndex),
        });
        result += JSON.stringify(token);
        cursor = endIndex;
        continue;
      }

      result += char;
      cursor += 1;
    }

    return { sanitizedSource: result, placeholders };
  }

  function splitTopLevelCommaSeparated(source) {
    const parts = [];
    let start = 0;
    let cursor = 0;
    let parenDepth = 0;
    let braceDepth = 0;
    let bracketDepth = 0;

    while (cursor < source.length) {
      const char = source[cursor];
      const next = source[cursor + 1];

      if (char === "'" || char === '"' || char === "`") {
        cursor = scanQuotedString(source, cursor, char);
        continue;
      }

      if (char === "/" && next === "/") {
        cursor = scanLineComment(source, cursor);
        continue;
      }

      if (char === "/" && next === "*") {
        cursor = scanBlockComment(source, cursor);
        continue;
      }

      if (char === "(") {
        parenDepth += 1;
      } else if (char === ")") {
        parenDepth -= 1;
      } else if (char === "{") {
        braceDepth += 1;
      } else if (char === "}") {
        braceDepth -= 1;
      } else if (char === "[") {
        bracketDepth += 1;
      } else if (char === "]") {
        bracketDepth -= 1;
      } else if (char === "," && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
        const part = source.slice(start, cursor).trim();
        if (part) {
          parts.push(part);
        }
        start = cursor + 1;
      }

      cursor += 1;
    }

    const tail = source.slice(start).trim();
    if (tail) {
      parts.push(tail);
    }
    return parts;
  }

  function buildGenericTooltipFormatter() {
    return function genericTooltipFormatter(params) {
      const rows = Array.isArray(params) ? params : [params];
      const visibleRows = rows.filter(Boolean);
      if (visibleRows.length === 0) {
        return "";
      }

      const title =
        visibleRows[0].axisValueLabel ?? visibleRows[0].axisValue ?? visibleRows[0].name ?? "";
      const body = visibleRows
        .map((row) => {
          const marker = typeof row.marker === "string" ? row.marker : "";
          const label = row.seriesName ?? row.name ?? "";
          let value = row.value;
          if (Array.isArray(value)) {
            value = value.join(", ");
          }
          return `${marker}${escapeHtml(String(label))}: ${escapeHtml(String(value ?? ""))}`;
        })
        .join("<br/>");

      return title ? `${escapeHtml(String(title))}<br/>${body}` : body;
    };
  }

  function compileSimpleFunctionFallback(source, path) {
    const propertyName = String(path[path.length - 1] ?? "");

    if (propertyName === "formatter") {
      return buildGenericTooltipFormatter();
    }

    if (propertyName !== "symbolSize") {
      return undefined;
    }

    const directPattern =
      /^function(?:\s+\w+)?\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{\s*return\s+\(?\s*\1\s*\[\s*(\d+)\s*\]\s*([*\/+\-])\s*(-?\d+(?:\.\d+)?)\s*\)?\s*;?\s*\}$/s;
    const inversePattern =
      /^function(?:\s+\w+)?\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{\s*return\s+\(?\s*(-?\d+(?:\.\d+)?)\s*([*\/+\-])\s*\1\s*\[\s*(\d+)\s*\]\s*\)?\s*;?\s*\}$/s;

    let match = source.match(directPattern);
    let inverse = false;
    if (!match) {
      match = source.match(inversePattern);
      inverse = true;
    }
    if (!match) {
      return undefined;
    }

    const index = Number(inverse ? match[3] : match[2]);
    const operator = inverse ? match[2] : match[3];
    const scalar = Number(inverse ? match[1] : match[4]);

    return function compiledSymbolSize(value) {
      const sample = Array.isArray(value) ? Number(value[index]) : Number.NaN;
      if (!Number.isFinite(sample)) {
        return undefined;
      }

      switch (operator) {
        case "*":
          return inverse ? scalar * sample : sample * scalar;
        case "/":
          return inverse ? scalar / sample : sample / scalar;
        case "+":
          return inverse ? scalar + sample : sample + scalar;
        case "-":
          return inverse ? scalar - sample : sample - scalar;
        default:
          return undefined;
      }
    };
  }

  function parseLooseJsValue(source, json5, echarts) {
    const trimmed = source.trim();
    if (!trimmed) {
      return undefined;
    }

    const { sanitizedSource, placeholders } = extractJsOnlyConstructs(trimmed);
    let parsedValue;
    try {
      parsedValue = json5.parse(sanitizedSource);
    } catch (error) {
      const detail =
        error && typeof error.message === "string" ? error.message : String(error || "Unknown error");
      throw new Error(`Could not parse JavaScript-style ECharts value. ${detail}`);
    }

    return reviveJsPlaceholders(parsedValue, placeholders, echarts, json5, []);
  }

  function materializeGraphicConstructor(source, echarts, json5) {
    const prefix = "new echarts.graphic.";
    if (!source.startsWith(prefix)) {
      throw new Error("Unsupported echarts.graphic constructor.");
    }

    let cursor = prefix.length;
    while (cursor < source.length && isIdentifierChar(source[cursor])) {
      cursor += 1;
    }

    const constructorName = source.slice(prefix.length, cursor);
    cursor = skipWhitespace(source, cursor);
    if (!constructorName || source[cursor] !== "(") {
      throw new Error("Unsupported echarts.graphic constructor syntax.");
    }

    const endIndex = scanBalanced(source, cursor, "(", ")");
    const argsSource = source.slice(cursor + 1, endIndex - 1);
    const ctor = echarts?.graphic?.[constructorName];
    if (typeof ctor !== "function") {
      throw new Error(`echarts.graphic.${constructorName} is unavailable.`);
    }

    const args = splitTopLevelCommaSeparated(argsSource).map((part) =>
      parseLooseJsValue(part, json5, echarts),
    );
    return new ctor(...args);
  }

  function reviveJsPlaceholders(value, placeholders, echarts, json5, path) {
    if (Array.isArray(value)) {
      return value.map((item, index) =>
        reviveJsPlaceholders(item, placeholders, echarts, json5, [...path, index]),
      );
    }

    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        const revived = reviveJsPlaceholders(child, placeholders, echarts, json5, [...path, key]);
        if (typeof revived === "undefined") {
          delete value[key];
          continue;
        }
        value[key] = revived;
      }
      return value;
    }

    if (typeof value !== "string") {
      return value;
    }

    const placeholder = placeholders.get(value);
    if (!placeholder) {
      return value;
    }

    if (placeholder.type === "function") {
      return compileSimpleFunctionFallback(placeholder.source, path);
    }
    if (placeholder.type === "graphic-constructor") {
      return materializeGraphicConstructor(placeholder.source, echarts, json5);
    }
    return value;
  }

  function parseEchartsPayload(raw, json5, echarts) {
    const normalized = normalizeOptionSource(raw);
    if (!normalized) {
      throw new Error("The echarts code block is empty.");
    }

    const preparedSource = wrapBareObjectLiteral(normalized);
    const { sanitizedSource, placeholders } = extractJsOnlyConstructs(preparedSource);
    const parsers = [
      () => JSON.parse(sanitizedSource),
      () => json5.parse(sanitizedSource),
    ];

    let lastError = null;
    for (const parse of parsers) {
      try {
        const payload = unwrapParsedPayload(parse());
        payload.option = reviveJsPlaceholders(payload.option, placeholders, echarts, json5, []);
        return payload;
      } catch (error) {
        lastError = error;
      }
    }

    const detail =
      lastError && typeof lastError.message === "string" ? lastError.message : String(lastError);
    throw new Error(`Could not parse the echarts block. ${detail}`);
  }

  function resolveChartHeight(payload) {
    if (payload.heightOverride !== null) {
      return payload.heightOverride;
    }

    const option = payload.option;
    if (Array.isArray(option.grid) && option.grid.length > 1) {
      return clamp(260 + option.grid.length * 120, 320, 960);
    }

    if (Array.isArray(option.series) && option.series.length >= 8) {
      return 520;
    }

    return 420;
  }

  function getOrCreateHost(wrapper) {
    const known = hostByWrapper.get(wrapper);
    if (known && known.isConnected) {
      return known;
    }

    const previous = wrapper.previousElementSibling;
    if (previous && previous.classList.contains("oc-echarts-renderer")) {
      hostByWrapper.set(wrapper, previous);
      return previous;
    }

    const host = document.createElement("section");
    host.className = "oc-echarts-renderer";
    wrapper.parentElement.insertBefore(host, wrapper);
    hostByWrapper.set(wrapper, host);
    return host;
  }

  function disposeChart(host) {
    const state = chartStateByHost.get(host);
    if (!state) {
      return;
    }

    try {
      state.resizeObserver?.disconnect();
    } catch {
      // Ignore cleanup issues from detached nodes.
    }

    try {
      state.instance?.dispose();
    } catch {
      // Ignore ECharts cleanup issues on partially initialized charts.
    }

    chartStateByHost.delete(host);
  }

  function getSourceState(wrapper) {
    return wrapper.getAttribute(SOURCE_STATE_ATTR) || "hidden";
  }

  function setSourceState(wrapper, state) {
    wrapper.setAttribute(SOURCE_STATE_ATTR, state);
    wrapper.hidden = state === "hidden";

    const host = hostByWrapper.get(wrapper);
    const button = host?.querySelector(".oc-echarts-renderer__toggle");
    if (button) {
      button.textContent = state === "hidden" ? UI_TEXT.toggleShowSource : UI_TEXT.toggleHideSource;
    }
  }

  function renderHostScaffold(host, wrapper, mode, detail, options = {}) {
    const allowSourceToggle = options.allowSourceToggle ?? true;
    const summaryText =
      options.summaryText ??
      (mode === "loading"
        ? UI_TEXT.summaryLoading
        : mode === "error"
          ? UI_TEXT.summaryError
          : UI_TEXT.summarySuccess);

    host.replaceChildren();

    const toolbar = document.createElement("div");
    toolbar.className = `oc-echarts-renderer__toolbar${allowSourceToggle ? "" : " oc-echarts-renderer__toolbar--no-toggle"}`;

    const meta = document.createElement("div");
    meta.className = "oc-echarts-renderer__meta";

    const badge = document.createElement("span");
    badge.className = "oc-echarts-renderer__badge";
    badge.textContent = UI_TEXT.badge;

    const summary = document.createElement("span");
    summary.className = "oc-echarts-renderer__summary";
    summary.textContent = summaryText;

    meta.append(badge, summary);
    toolbar.append(meta);

    if (allowSourceToggle) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "oc-echarts-renderer__toggle";
      toggle.addEventListener("click", () => {
        const nextState = getSourceState(wrapper) === "hidden" ? "visible" : "hidden";
        setSourceState(wrapper, nextState);
        const chartState = chartStateByHost.get(host);
        if (!chartState?.instance) {
          return;
        }
        queueMicrotask(() => {
          try {
            chartState.instance.resize();
          } catch {
            // Ignore transient resize failures while layout settles.
          }
        });
      });
      toolbar.append(toggle);
    }

    const body = document.createElement("div");
    body.className = "oc-echarts-renderer__body";

    if (mode === "success") {
      const chart = document.createElement("div");
      chart.className = "oc-echarts-renderer__chart";
      body.append(chart);
    } else {
      const status = document.createElement("div");
      status.className = `oc-echarts-renderer__status oc-echarts-renderer__status--${mode}`;
      status.innerHTML =
        mode === "loading" ? createLoadingStatusMarkup(detail) : createErrorStatusMarkup(detail);
      body.append(status);
    }

    host.append(toolbar, body);
    if (allowSourceToggle) {
      setSourceState(wrapper, getSourceState(wrapper));
    }

    return body.querySelector(".oc-echarts-renderer__chart");
  }

  function clearStreamingPlaceholder(textEl) {
    const host = hostByWrapper.get(textEl);
    if (host?.getAttribute(STREAMING_PLACEHOLDER_ATTR) === "true") {
      disposeChart(host);
      host.remove();
      hostByWrapper.delete(textEl);
    }

    if (textEl.getAttribute(STREAMING_PLACEHOLDER_ATTR) === "true") {
      textEl.hidden = false;
      textEl.removeAttribute(STREAMING_PLACEHOLDER_ATTR);
    }

    setBubbleLoadingState(textEl, false);
  }

  function syncStreamingPlaceholders(root) {
    const textBlocks = Array.from(root.querySelectorAll(".chat-bubble .chat-text"));
    for (const textEl of textBlocks) {
      if (!shouldHideStreamingTextBlock(textEl)) {
        clearStreamingPlaceholder(textEl);
        continue;
      }

      installStyles();
      const host = getOrCreateHost(textEl);
      host.setAttribute(STREAMING_PLACEHOLDER_ATTR, "true");
      textEl.setAttribute(STREAMING_PLACEHOLDER_ATTR, "true");
      textEl.hidden = true;
      setBubbleLoadingState(textEl, true);
      renderHostScaffold(host, textEl, "loading", UI_TEXT.loadingStreamingDetail, {
        allowSourceToggle: false,
      });
    }
  }

  async function processCodeBlock(codeEl) {
    const wrapper = getWrapperElement(codeEl);
    if (!wrapper || !wrapper.parentElement) {
      return;
    }

    const source = normalizeText(codeEl.textContent);
    if (!source) {
      return;
    }

    const sourceHash = hashText(source);
    const streaming = isStreamingBubble(wrapper);
    const renderMode = getRenderMode(wrapper);
    if (
      wrapper.getAttribute(SOURCE_HASH_ATTR) === sourceHash &&
      hostByWrapper.get(wrapper)?.isConnected &&
      ((streaming && renderMode === "streaming") ||
        (!streaming && (renderMode === "success" || renderMode === "error")))
    ) {
      return;
    }

    installStyles();
    localizeSourceWrapper(wrapper);

    const host = getOrCreateHost(wrapper);
    disposeChart(host);

    if (streaming) {
      setBubbleLoadingState(wrapper, true);
      renderHostScaffold(host, wrapper, "loading", UI_TEXT.loadingStreamingDetail, {
        allowSourceToggle: false,
      });
      wrapper.setAttribute(SOURCE_HASH_ATTR, sourceHash);
      setRenderMode(wrapper, "streaming");
      setSourceState(wrapper, "hidden");
      return;
    }

    renderHostScaffold(host, wrapper, "loading", UI_TEXT.loadingRuntimeDetail, {
      allowSourceToggle: false,
    });
    setSourceState(wrapper, "hidden");
    setBubbleLoadingState(wrapper, true);

    try {
      const { echarts, json5 } = await ensureLibraries();
      const payload = parseEchartsPayload(source, json5, echarts);
      const option = payload.option;
      const chartEl = renderHostScaffold(host, wrapper, "success", "");
      chartEl.style.height = `${resolveChartHeight(payload)}px`;

      if (typeof option.backgroundColor === "undefined") {
        option.backgroundColor = "transparent";
      }

      const instance = echarts.init(chartEl, null, { renderer: "canvas" });
      instance.on("click", (params) => {
        try {
          openChartDetailModal(params);
        } catch {
          // Ignore modal rendering failures so the chart interaction remains usable.
        }
      });
      instance.setOption(option, true);

      let resizeObserver = null;
      if (typeof ResizeObserver === "function") {
        resizeObserver = new ResizeObserver(() => {
          try {
            instance.resize();
          } catch {
            // Ignore chart resize errors from detached nodes.
          }
        });
        resizeObserver.observe(chartEl);
      }

      chartStateByHost.set(host, { instance, resizeObserver });
      wrapper.setAttribute(SOURCE_HASH_ATTR, sourceHash);
      setRenderMode(wrapper, "success");
      setSourceState(wrapper, wrapper.hasAttribute(SOURCE_STATE_ATTR) ? getSourceState(wrapper) : "hidden");
      setBubbleLoadingState(wrapper, false);
    } catch (error) {
      const detail =
        error && typeof error.message === "string" ? error.message : String(error || "Unknown error");
      renderHostScaffold(host, wrapper, "error", detail);
      wrapper.setAttribute(SOURCE_HASH_ATTR, sourceHash);
      setRenderMode(wrapper, "error");
      setSourceState(wrapper, "visible");
      setBubbleLoadingState(wrapper, false);
    }
  }

  async function runScan() {
    if (scanRunning) {
      scanQueued = true;
      return;
    }

    scanQueued = false;
    scanRunning = true;

    try {
      syncStreamingPlaceholders(document);
      const candidates = findCandidateCodeBlocks(document);
      for (const codeEl of candidates) {
        // Keep processing sequential to reduce DOM thrash during streaming updates.
        // eslint-disable-next-line no-await-in-loop
        await processCodeBlock(codeEl);
      }
    } finally {
      scanRunning = false;
      if (scanQueued) {
        queueMicrotask(runScan);
      }
    }
  }

  function scheduleScan() {
    if (scanQueued) {
      return;
    }
    scanQueued = true;
    queueMicrotask(runScan);
  }

  function boot() {
    scheduleScan();

    const observer = new MutationObserver(() => {
      scheduleScan();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("resize", () => {
      for (const host of document.querySelectorAll(".oc-echarts-renderer")) {
        const chartState = chartStateByHost.get(host);
        if (!chartState?.instance) {
          continue;
        }
        try {
          chartState.instance.resize();
        } catch {
          // Ignore resize failures while the UI remounts.
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
