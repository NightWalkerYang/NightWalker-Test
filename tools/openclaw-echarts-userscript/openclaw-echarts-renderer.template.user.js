// ==UserScript==
// @name         OpenClaw ECharts Fence Renderer
// @namespace    https://github.com/openclaw/openclaw
// @version      0.2.0
// @description  Render ```echarts fenced code blocks as charts in the OpenClaw control UI without changing OpenClaw source.
// @match        http://127.0.0.1:*/*
// @match        http://localhost:*/*
// @match        http://0.0.0.0:*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// Offline bundled userscript.
// If this file still contains __INLINE_* placeholders, rebuild it with:
//   node tools/openclaw-echarts-userscript/build-offline-userscript.mjs

(function () {
  "use strict";

  const EMBEDDED_LIBRARY_SOURCES = {
    echarts: __INLINE_ECHARTS_SOURCE__,
    json5: __INLINE_JSON5_SOURCE__,
  };

  const SOURCE_HASH_ATTR = "data-oc-echarts-source-hash";
  const SOURCE_STATE_ATTR = "data-oc-echarts-source-state";
  const LANGUAGE_ALIASES = new Set([
    "echarts",
    "echart",
    "chart",
    "echarts-option",
    "echartsoption",
  ]);

  const hostByWrapper = new WeakMap();
  const chartStateByHost = new WeakMap();

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

      .oc-echarts-renderer__toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(127, 127, 127, 0.18);
        background: rgba(127, 127, 127, 0.05);
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
    `;
    document.head.append(style);
  }

  function installEmbeddedLibrary(id, globalName) {
    if (window[globalName]) {
      return window[globalName];
    }

    const source = EMBEDDED_LIBRARY_SOURCES[id];
    if (typeof source !== "string" || !source.trim()) {
      throw new Error(`Embedded library source is missing for ${id}.`);
    }

    const target = document.head || document.documentElement;
    if (!target) {
      throw new Error(`No DOM target available to install embedded library ${id}.`);
    }

    const script = document.createElement("script");
    script.setAttribute("data-oc-inline-lib", id);
    script.textContent = `${source}\n//# sourceURL=openclaw-inline-${id}.js`;
    target.append(script);
    script.remove();

    if (!window[globalName]) {
      throw new Error(`Embedded library ${id} loaded but window.${globalName} is missing.`);
    }
    return window[globalName];
  }

  function ensureLibraries() {
    return {
      echarts: installEmbeddedLibrary("echarts", "echarts"),
      json5: installEmbeddedLibrary("json5", "JSON5"),
    };
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

  function unwrapParsedOption(parsed) {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("ECharts option must be an object literal.");
    }

    if (
      parsed.option &&
      typeof parsed.option === "object" &&
      !Array.isArray(parsed.option) &&
      Object.keys(parsed).every((key) => key === "option" || key === "height")
    ) {
      return parsed.option;
    }

    return parsed;
  }

  function parseEchartsOption(raw, json5) {
    const normalized = normalizeOptionSource(raw);
    if (!normalized) {
      throw new Error("The echarts code block is empty.");
    }

    const parsers = [
      { label: "JSON", run: () => JSON.parse(normalized) },
      { label: "JSON5", run: () => json5.parse(normalized) },
    ];

    let lastError = null;
    for (const parser of parsers) {
      try {
        return unwrapParsedOption(parser.run());
      } catch (error) {
        lastError = error;
      }
    }

    const detail =
      lastError && typeof lastError.message === "string" ? lastError.message : String(lastError);
    throw new Error(
      `Could not parse the echarts block as JSON or JSON5. Functions are intentionally not supported. ${detail}`,
    );
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function resolveChartHeight(option) {
    if (typeof option.height === "number" && Number.isFinite(option.height)) {
      return clamp(option.height, 280, 960);
    }

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
      // Ignore observer cleanup errors from detached nodes.
    }

    try {
      state.instance?.dispose();
    } catch {
      // Ignore ECharts dispose errors on partially initialized instances.
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
      button.textContent = state === "hidden" ? "Show source" : "Hide source";
    }
  }

  function renderHostScaffold(host, wrapper, mode, detail) {
    host.replaceChildren();

    const toolbar = document.createElement("div");
    toolbar.className = "oc-echarts-renderer__toolbar";

    const meta = document.createElement("div");
    meta.className = "oc-echarts-renderer__meta";

    const badge = document.createElement("span");
    badge.className = "oc-echarts-renderer__badge";
    badge.textContent = "ECharts";

    const summary = document.createElement("span");
    summary.className = "oc-echarts-renderer__summary";
    if (mode === "loading") {
      summary.textContent = "Rendering chart from fenced code block";
    } else if (mode === "error") {
      summary.textContent = "Chart preview failed";
    } else {
      summary.textContent = "Rendered from fenced code block";
    }

    meta.append(badge, summary);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "oc-echarts-renderer__toggle";
    toggle.addEventListener("click", () => {
      const nextState = getSourceState(wrapper) === "hidden" ? "visible" : "hidden";
      setSourceState(wrapper, nextState);
      const chartState = chartStateByHost.get(host);
      if (chartState?.instance) {
        queueMicrotask(() => {
          try {
            chartState.instance.resize();
          } catch {
            // Ignore transient resize failures while layout settles.
          }
        });
      }
    });

    toolbar.append(meta, toggle);

    const body = document.createElement("div");
    body.className = "oc-echarts-renderer__body";

    if (mode === "success") {
      const chart = document.createElement("div");
      chart.className = "oc-echarts-renderer__chart";
      body.append(chart);
    } else {
      const status = document.createElement("div");
      status.className = `oc-echarts-renderer__status oc-echarts-renderer__status--${mode}`;
      status.innerHTML = detail;
      body.append(status);
    }

    host.append(toolbar, body);
    setSourceState(wrapper, getSourceState(wrapper));

    return body.querySelector(".oc-echarts-renderer__chart");
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
    if (wrapper.getAttribute(SOURCE_HASH_ATTR) === sourceHash && hostByWrapper.get(wrapper)?.isConnected) {
      return;
    }

    installStyles();

    const host = getOrCreateHost(wrapper);
    disposeChart(host);
    renderHostScaffold(host, wrapper, "loading", "Loading embedded ECharts runtime...");

    try {
      const { echarts, json5 } = ensureLibraries();
      const option = parseEchartsOption(source, json5);
      const chartEl = renderHostScaffold(host, wrapper, "success", "");
      chartEl.style.height = `${resolveChartHeight(option)}px`;

      if (typeof option.backgroundColor === "undefined") {
        option.backgroundColor = "transparent";
      }

      const instance = echarts.init(chartEl, null, { renderer: "canvas" });
      instance.setOption(option, true);

      const resizeObserver = new ResizeObserver(() => {
        try {
          instance.resize();
        } catch {
          // Ignore chart resize errors from detached nodes.
        }
      });
      resizeObserver.observe(chartEl);

      chartStateByHost.set(host, { instance, resizeObserver });
      wrapper.setAttribute(SOURCE_HASH_ATTR, sourceHash);
      if (!wrapper.hasAttribute(SOURCE_STATE_ATTR)) {
        setSourceState(wrapper, "hidden");
      } else {
        setSourceState(wrapper, getSourceState(wrapper));
      }
    } catch (error) {
      const detail =
        error && typeof error.message === "string" ? error.message : String(error || "Unknown error");
      renderHostScaffold(
        host,
        wrapper,
        "error",
        `Could not render this chart.<br><code>${escapeHtml(detail)}</code>`,
      );
      wrapper.setAttribute(SOURCE_HASH_ATTR, sourceHash);
      setSourceState(wrapper, "visible");
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
      const candidates = findCandidateCodeBlocks(document);
      for (const codeEl of candidates) {
        // Process sequentially to keep DOM churn predictable.
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
          // Ignore resize failures while the UI is remounting.
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
