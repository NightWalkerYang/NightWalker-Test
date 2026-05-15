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
      width: min(560px, calc(100vw - 28px));
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
      height: 620px;
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

function injectBaseHrefIntoHtml(html, baseHref) {
  const normalizedBaseHref = normalizeBaseHref(baseHref);
  const htmlText = String(html || "");
  if (!normalizedBaseHref) {
    return htmlText;
  }
  const baseTag = `<base href="${escapeHtmlAttribute(normalizedBaseHref)}" />`;
  if (/<base\b[^>]*href\s*=/i.test(htmlText)) {
    return htmlText.replace(/<base\b[^>]*href\s*=\s*(["'])[^"']*\1[^>]*>/i, baseTag);
  }
  if (/<head\b[^>]*>/i.test(htmlText)) {
    return htmlText.replace(/<head\b[^>]*>/i, (match) => `${match}\n${baseTag}`);
  }
  if (/<html\b[^>]*>/i.test(htmlText)) {
    return htmlText.replace(/<html\b[^>]*>/i, (match) => `${match}\n<head>${baseTag}</head>`);
  }
  return `<!doctype html><html><head>${baseTag}</head><body>${htmlText}</body></html>`;
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
  state.visualizationDocument = null;
  state.annotations = [];
  if (!visualization || !token) {
    return;
  }
  const resolved = await state.apiClient.resolveMemberVisualization(token);
  const html = String(resolved?.html || "").trim();
  if (!html) {
    throw new Error("visualization_empty");
  }
  state.visualizationDocument = {
    html: injectBaseHrefIntoHtml(html, resolved?.baseHref),
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
  root.innerHTML = `
    <button class="oc-member-canvas-annotation-button" ${BUTTON_ATTR}="true" data-active="${drawerOpen ? "true" : "false"}" type="button">
      Canvas
    </button>
    ${
      drawerOpen
        ? `<aside class="oc-member-canvas-annotation-drawer" ${DRAWER_ATTR}="true">
            <header>
              <div class="oc-member-canvas-annotation-title">
                <strong>Canvas 批注</strong>
                <span>在大屏预览上框选区域，输入批注后点击上箭头保存。</span>
              </div>
              <button type="button" data-action="close">关闭</button>
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
  const frame = root.querySelector(`iframe[${FRAME_ATTR}]`);
  if (frame instanceof HTMLIFrameElement && state.visualizationDocument?.html) {
    frame.srcdoc = state.visualizationDocument.html;
  }
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
    state.selecting = null;
    if (rect.width < 12 || rect.height < 12) {
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
    if (
      !state.annotationMode ||
      !(target instanceof HTMLElement) ||
      !target.matches(`[${OVERLAY_ATTR}]`)
    ) {
      return;
    }
    const point = resolveOverlayPoint(event, target);
    state.draft = null;
    state.selecting = {
      start: point,
      base: { width: point.width, height: point.height },
      rect: normalizePreviewRect(point, point, point),
    };
    clearPointerListeners();
    state.onWindowPointerMove = updateSelection;
    state.onWindowPointerUp = finishSelection;
    window.addEventListener("pointermove", state.onWindowPointerMove, true);
    window.addEventListener("pointerup", state.onWindowPointerUp, true);
    render(state);
  });

  state.root.addEventListener("pointermove", (event) => {
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
    annotationMode: true,
    visualizationsLoaded: false,
    visualizations: [],
    selectedVisualizationToken: "",
    visualizationDocument: null,
    loading: false,
    error: "",
    selecting: null,
    draft: null,
    annotations: [],
    clearPointerListeners: null,
    onWindowPointerMove: null,
    onWindowPointerUp: null,
  };
  bindRoot(state);
  render(state);
  const surface = {
    state,
    unmount() {
      state.clearPointerListeners?.();
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
