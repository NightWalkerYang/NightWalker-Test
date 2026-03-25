import { createAdapterRegistry } from "./adapter-registry.js";
import { escapeHtml, hashText, normalizeText } from "./shared.js";
import { getFrameworkStyles } from "./styles.js";

const BUBBLE_LOADING_ATTR = "data-oc-block-loading";
const BLOCK_ADAPTER_ATTR = "data-oc-block-adapter";
const BLOCK_HOST_ATTR = "data-oc-block-host";
const BLOCK_SOURCE_HASH_ATTR = "data-oc-block-source-hash";
const BLOCK_RENDER_MODE_ATTR = "data-oc-block-render-mode";
const BLOCK_SOURCE_STATE_ATTR = "data-oc-block-source-state";
const BLOCK_STREAMING_PLACEHOLDER_ATTR = "data-oc-block-streaming-placeholder";
const SOURCE_TOGGLE_DISABLED = true;

function getLanguageFromCodeBlock(codeEl) {
  for (const className of codeEl.classList) {
    if (className.startsWith("language-")) {
      return className.slice("language-".length).trim().toLowerCase();
    }
  }

  const wrapper = codeEl.closest(".code-block-wrapper");
  const label = wrapper
    ?.querySelector(".code-block-lang")
    ?.textContent?.trim()
    .toLowerCase();
  return label || "";
}

function getWrapperElement(codeEl) {
  const explicitWrapper = codeEl.closest(".code-block-wrapper") || codeEl.closest("pre");
  if (explicitWrapper) {
    return explicitWrapper;
  }

  const parent = codeEl.parentElement;
  if (!parent) {
    return codeEl;
  }

  const parentText = normalizeText(parent.textContent);
  const codeText = normalizeText(codeEl.textContent);
  if (parentText && codeText && parentText === codeText) {
    return parent;
  }

  return codeEl;
}

function isStreamingBubble(node) {
  return Boolean(node?.closest?.(".chat-bubble.streaming"));
}

function getRenderMode(anchor) {
  return anchor.getAttribute(BLOCK_RENDER_MODE_ATTR) || "";
}

function setRenderMode(anchor, mode) {
  anchor.setAttribute(BLOCK_RENDER_MODE_ATTR, mode);
}

function getSourceState(anchor) {
  if (SOURCE_TOGGLE_DISABLED) {
    return "hidden";
  }
  return anchor.getAttribute(BLOCK_SOURCE_STATE_ATTR) || "hidden";
}

function setAnchorAdapter(anchor, adapter) {
  anchor.setAttribute(BLOCK_ADAPTER_ATTR, adapter.id);
}

function setBubbleLoadingState(anchor, active) {
  const bubble = anchor?.closest?.(".chat-bubble");
  if (!bubble) {
    return;
  }

  if (active) {
    bubble.setAttribute(BUBBLE_LOADING_ATTR, "true");
    return;
  }

  bubble.removeAttribute(BUBBLE_LOADING_ATTR);
}

function findOpenFenceLanguage(text) {
  const normalized = String(text || "").replace(/\r\n?/g, "\n");
  if (!normalized.includes("```") && !normalized.includes("~~~")) {
    return "";
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

  return openMarker ? openLanguage : "";
}

function findLeadingFenceLanguage(text) {
  const normalized = String(text || "").replace(/\r\n?/g, "\n").trimStart();
  const match = normalized.match(/^(?:`{3,}|~{3,})[^\S\n]*([A-Za-z0-9_-]*)/);
  return String(match?.[1] || "")
    .trim()
    .toLowerCase();
}

export function createFencedBlockRuntime(adaptersInput) {
  const registry = createAdapterRegistry(adaptersInput);
  const hostByAnchor = new WeakMap();
  const stateByHost = new WeakMap();

  let stylesInstalled = false;
  let scanQueued = false;
  let scanRunning = false;

  function getAdapterForAnchor(anchor) {
    return registry.getAdapterById(anchor?.getAttribute?.(BLOCK_ADAPTER_ATTR) || "");
  }

  function getAdapterForHost(host) {
    return registry.getAdapterById(host?.getAttribute?.(BLOCK_HOST_ATTR) || "");
  }

  function installStyles() {
    if (stylesInstalled) {
      return;
    }
    stylesInstalled = true;

    const style = document.createElement("style");
    style.textContent = `${getFrameworkStyles()}\n${registry.combinedStyles}`;
    document.head.append(style);
  }

  function findCandidateCodeBlocks(root) {
    const codeElements = Array.from(root.querySelectorAll("code")).filter(
      (codeEl) => !codeEl.closest(".oc-block-renderer"),
    );

    return codeElements
      .map((codeEl) => {
        const explicitLanguage = getLanguageFromCodeBlock(codeEl);
        const adapter =
          registry.getAdapterByLanguage(explicitLanguage) ||
          registry.getAdapterBySourcePrefix(codeEl.textContent);
        return { codeEl, adapter };
      })
      .filter((entry) => Boolean(entry.adapter));
  }

  function findStreamingPlaceholderAdapter(textEl) {
    if (!isStreamingBubble(textEl)) {
      return null;
    }
    if (findCandidateCodeBlocks(textEl).length > 0) {
      return null;
    }

    const rawText = String(textEl.textContent || "").replace(/\r\n?/g, "\n").trim();
    if (!rawText) {
      return null;
    }

    const leadingAdapter = registry.getAdapterByLanguage(findLeadingFenceLanguage(rawText));
    if (!leadingAdapter) {
      return null;
    }

    const openFenceLanguage = findOpenFenceLanguage(rawText);
    const openFenceAdapter = registry.getAdapterByLanguage(openFenceLanguage);
    if (!openFenceAdapter || openFenceAdapter.id !== leadingAdapter.id) {
      return null;
    }

    return leadingAdapter;
  }

  function localizeSourceWrapper(adapter, wrapper) {
    const languageLabel = wrapper.querySelector(".code-block-lang");
    const normalizedLanguage = normalizeText(languageLabel?.textContent || "").toLowerCase();
    if (languageLabel && adapter.languageAliases.has(normalizedLanguage)) {
      languageLabel.textContent = adapter.uiText.badge;
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

    adapter.localizeSourceWrapper?.(wrapper);
  }

  function createLoadingStatusMarkup(adapter, detail) {
    return `
      <div class="oc-block-renderer__loading-shell">
        <span class="oc-block-renderer__spinner" aria-hidden="true"></span>
        <div class="oc-block-renderer__loading-copy">
          <div class="oc-block-renderer__loading-title">
            <span>${escapeHtml(adapter.uiText.loadingTitle)}</span>
            <span class="oc-block-renderer__pulse-dots" aria-hidden="true">
              <span></span><span></span><span></span>
            </span>
          </div>
          <div class="oc-block-renderer__loading-subtitle">${escapeHtml(detail)}</div>
        </div>
      </div>
    `;
  }

  function createErrorStatusMarkup(adapter, detail) {
    return `
      <div class="oc-block-renderer__error-title">${escapeHtml(adapter.uiText.errorTitle)}</div>
      <code class="oc-block-renderer__error-detail">${escapeHtml(adapter.localizeErrorMessage?.(detail) ?? detail)}</code>
    `;
  }

  function getOrCreateHost(anchor, adapter) {
    const known = hostByAnchor.get(anchor);
    if (
      known &&
      known.isConnected &&
      known.getAttribute(BLOCK_HOST_ATTR) === adapter.id
    ) {
      return known;
    }

    if (known?.isConnected) {
      disposeHostState(known);
      known.remove();
    }

    const previous = anchor.previousElementSibling;
    if (previous?.classList.contains("oc-block-renderer")) {
      if (previous.getAttribute(BLOCK_HOST_ATTR) === adapter.id) {
        hostByAnchor.set(anchor, previous);
        return previous;
      }

      disposeHostState(previous);
      previous.remove();
    }

    const host = document.createElement("section");
    host.className = `oc-block-renderer oc-block-renderer--${adapter.id}`;
    host.setAttribute(BLOCK_HOST_ATTR, adapter.id);
    anchor.parentElement.insertBefore(host, anchor);
    hostByAnchor.set(anchor, host);
    return host;
  }

  function disposeHostState(host) {
    const entry = stateByHost.get(host);
    if (!entry) {
      return;
    }
    entry.adapter.disposeState?.(entry.state);
    stateByHost.delete(host);
  }

  function setSourceState(anchor, state) {
    // 中文标记：源码展示入口已停用，统一强制隐藏源码块。
    if (SOURCE_TOGGLE_DISABLED) {
      anchor.setAttribute(BLOCK_SOURCE_STATE_ATTR, "hidden");
      anchor.hidden = true;
      return;
    }

    anchor.setAttribute(BLOCK_SOURCE_STATE_ATTR, state);
    anchor.hidden = state === "hidden";

    // 中文标记：下面这段是原来的“显示源码 / 隐藏源码”按钮文案同步逻辑，现已停用。
    /*
    const host = hostByAnchor.get(anchor);
    const button = host?.querySelector(".oc-block-renderer__toggle");
    const adapter = getAdapterForAnchor(anchor) || getAdapterForHost(host);
    if (button && adapter) {
      button.textContent =
        state === "hidden"
          ? adapter.uiText.toggleShowSource
          : adapter.uiText.toggleHideSource;
    }
    */
  }

  function renderHostScaffold(adapter, host, anchor, mode, detail, options = {}) {
    // 中文标记：源码切换按钮已停用，统一不再渲染“显示源码 / 隐藏源码”入口。
    const allowSourceToggle =
      SOURCE_TOGGLE_DISABLED ? false : (options.allowSourceToggle ?? true);
    const actions = Array.isArray(options.actions) ? options.actions : [];
    const summaryText =
      options.summaryText ??
      (mode === "loading"
        ? adapter.uiText.summaryLoading
        : mode === "error"
          ? adapter.uiText.summaryError
          : adapter.uiText.summarySuccess);

    host.replaceChildren();
    host.className = `oc-block-renderer oc-block-renderer--${adapter.id}`;
    host.setAttribute(BLOCK_HOST_ATTR, adapter.id);

    const toolbar = document.createElement("div");
    toolbar.className = `oc-block-renderer__toolbar${allowSourceToggle ? "" : " oc-block-renderer__toolbar--no-toggle"}`;

    const meta = document.createElement("div");
    meta.className = "oc-block-renderer__meta";

    const badge = document.createElement("span");
    badge.className = "oc-block-renderer__badge";
    badge.textContent = adapter.uiText.badge;

    const summary = document.createElement("span");
    summary.className = "oc-block-renderer__summary";
    summary.textContent = summaryText;

    meta.append(badge, summary);
    toolbar.append(meta);

    const controls = document.createElement("div");
    controls.className = "oc-block-renderer__controls";

    for (const action of actions) {
      if (!action || typeof action.onClick !== "function") {
        continue;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "oc-block-renderer__action";
      button.textContent = String(action.label || "");
      button.addEventListener("click", () => {
        void action.onClick();
      });
      controls.append(button);
    }

    // 中文标记：下面这段是原来的源码开关按钮创建逻辑，现已注释停用。
    /*
    if (allowSourceToggle) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "oc-block-renderer__toggle";
      toggle.addEventListener("click", () => {
        const nextState = getSourceState(anchor) === "hidden" ? "visible" : "hidden";
        setSourceState(anchor, nextState);
        const entry = stateByHost.get(host);
        entry?.adapter.onSourceToggle?.(entry.state, nextState);
      });
      controls.append(toggle);
    }
    */

    if (controls.childElementCount > 0) {
      toolbar.append(controls);
    }

    const body = document.createElement("div");
    body.className = "oc-block-renderer__body";

    if (mode === "success") {
      const content = document.createElement("div");
      content.className = "oc-block-renderer__chart";
      body.append(content);
    } else {
      const status = document.createElement("div");
      status.className = `oc-block-renderer__status oc-block-renderer__status--${mode}`;
      status.innerHTML =
        mode === "loading"
          ? createLoadingStatusMarkup(adapter, detail)
          : createErrorStatusMarkup(adapter, detail);
      body.append(status);
    }

    host.append(toolbar, body);
    // 中文标记：源码开关已停用，渲染完成后仍统一隐藏源码。
    setSourceState(anchor, "hidden");

    return body.querySelector(".oc-block-renderer__chart");
  }

  function clearStreamingPlaceholder(textEl) {
    const host = hostByAnchor.get(textEl);
    if (host?.getAttribute(BLOCK_STREAMING_PLACEHOLDER_ATTR) === "true") {
      disposeHostState(host);
      host.remove();
      hostByAnchor.delete(textEl);
    }

    if (textEl.getAttribute(BLOCK_STREAMING_PLACEHOLDER_ATTR) === "true") {
      textEl.hidden = false;
      textEl.removeAttribute(BLOCK_STREAMING_PLACEHOLDER_ATTR);
    }

    setBubbleLoadingState(textEl, false);
  }

  function syncStreamingPlaceholders(root) {
    const textBlocks = Array.from(root.querySelectorAll(".chat-bubble .chat-text"));
    for (const textEl of textBlocks) {
      const adapter = findStreamingPlaceholderAdapter(textEl);
      if (!adapter) {
        clearStreamingPlaceholder(textEl);
        continue;
      }

      installStyles();
      setAnchorAdapter(textEl, adapter);

      const host = getOrCreateHost(textEl, adapter);
      host.setAttribute(BLOCK_STREAMING_PLACEHOLDER_ATTR, "true");
      textEl.setAttribute(BLOCK_STREAMING_PLACEHOLDER_ATTR, "true");
      textEl.hidden = true;
      setBubbleLoadingState(textEl, true);
      renderHostScaffold(
        adapter,
        host,
        textEl,
        "loading",
        adapter.uiText.loadingStreamingDetail,
        {
          allowSourceToggle: false,
        },
      );
    }
  }

  async function processCodeBlock(codeEl, adapter) {
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
    const cachedAdapter = getAdapterForAnchor(wrapper);
    if (
      cachedAdapter?.id === adapter.id &&
      wrapper.getAttribute(BLOCK_SOURCE_HASH_ATTR) === sourceHash &&
      hostByAnchor.get(wrapper)?.isConnected &&
      ((streaming && renderMode === "streaming") ||
        (!streaming && (renderMode === "success" || renderMode === "error")))
    ) {
      return;
    }

    installStyles();
    setAnchorAdapter(wrapper, adapter);
    localizeSourceWrapper(adapter, wrapper);

    const host = getOrCreateHost(wrapper, adapter);
    disposeHostState(host);

    if (streaming) {
      setBubbleLoadingState(wrapper, true);
      renderHostScaffold(
        adapter,
        host,
        wrapper,
        "loading",
        adapter.uiText.loadingStreamingDetail,
        {
          allowSourceToggle: false,
        },
      );
      wrapper.setAttribute(BLOCK_SOURCE_HASH_ATTR, sourceHash);
      setRenderMode(wrapper, "streaming");
      setSourceState(wrapper, "hidden");
      return;
    }

    renderHostScaffold(
      adapter,
      host,
      wrapper,
      "loading",
      adapter.uiText.loadingRuntimeDetail,
      {
        allowSourceToggle: false,
      },
    );
    setSourceState(wrapper, "hidden");
    setBubbleLoadingState(wrapper, true);

    try {
      const context = await adapter.ensureReady();
      const state = await adapter.renderContent({
        source,
        wrapper,
        host,
        context,
        renderHostScaffold: (targetHost, targetWrapper, mode, detail, options) =>
          renderHostScaffold(adapter, targetHost, targetWrapper, mode, detail, options),
        getSourceState,
        setSourceState,
      });
      if (state) {
        stateByHost.set(host, { adapter, state });
      }
      wrapper.setAttribute(BLOCK_SOURCE_HASH_ATTR, sourceHash);
      setRenderMode(wrapper, "success");
      // 中文标记：成功态也不再恢复源码显示。
      setSourceState(wrapper, "hidden");
      setBubbleLoadingState(wrapper, false);
    } catch (error) {
      const detail =
        error && typeof error.message === "string"
          ? error.message
          : String(error || "Unknown error");
      renderHostScaffold(adapter, host, wrapper, "error", detail);
      wrapper.setAttribute(BLOCK_SOURCE_HASH_ATTR, sourceHash);
      setRenderMode(wrapper, "error");
      // 中文标记：错误态原本会回退显示源码，现已改为继续隐藏。
      // setSourceState(wrapper, "visible");
      setSourceState(wrapper, "hidden");
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
      for (const { codeEl, adapter } of candidates) {
        // Keep processing sequential to reduce DOM thrash during streaming updates.
        // eslint-disable-next-line no-await-in-loop
        await processCodeBlock(codeEl, adapter);
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
    installStyles();
    scheduleScan();

    const observer = new MutationObserver(() => {
      scheduleScan();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("resize", () => {
      for (const host of document.querySelectorAll(".oc-block-renderer")) {
        const entry = stateByHost.get(host);
        const adapter = entry?.adapter || getAdapterForHost(host);
        adapter?.onViewportResize?.(entry?.state);
      }
    });
  }

  return { boot };
}
