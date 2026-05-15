import {
  backfillChatComposerPrompt,
  formatMultiAnnotationPrompt,
  formatSingleAnnotationPrompt,
} from "./member-chat-annotations.js";

export const MEMBER_CHAT_CANVAS_ANNOTATION_ROOT_ATTR = "data-oc-member-canvas-annotation-root";
const ROOT_ATTR = MEMBER_CHAT_CANVAS_ANNOTATION_ROOT_ATTR;
const STYLE_ATTR = "data-oc-member-canvas-annotation-style";
const BUTTON_ATTR = "data-oc-member-canvas-annotation-button";
const OVERLAY_ATTR = "data-oc-member-canvas-annotation-overlay";
const PANEL_ATTR = "data-oc-member-canvas-annotation-panel";
const RECT_ATTR = "data-oc-member-canvas-annotation-rect";
const DRAFT_ATTR = "data-oc-member-canvas-annotation-draft";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
      color: #e5e7eb;
      font-family: inherit;
    }
    .oc-member-canvas-annotation-button {
      position: fixed;
      right: 24px;
      top: 76px;
      z-index: 999995;
      pointer-events: auto;
      border: 1px solid rgba(251, 146, 60, 0.38);
      border-radius: 18px;
      padding: 8px 14px;
      color: #fed7aa;
      background: rgba(67, 38, 24, 0.92);
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.24);
      cursor: pointer;
      font-size: 14px;
    }
    .oc-member-canvas-annotation-button[data-active="true"] {
      color: #fff7ed;
      background: rgba(154, 52, 18, 0.96);
    }
    .oc-member-canvas-annotation-overlay {
      position: fixed;
      inset: 0;
      z-index: 999991;
      pointer-events: auto;
      cursor: crosshair;
      background: rgba(2, 6, 23, 0.08);
    }
    .oc-member-canvas-annotation-rect {
      position: fixed;
      border: 2px solid #38bdf8;
      background: rgba(56, 189, 248, 0.14);
      box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.36);
      pointer-events: none;
    }
    .oc-member-canvas-annotation-rect[data-draft="true"] {
      border-color: #fb7185;
      background: rgba(251, 113, 133, 0.16);
      border-style: dashed;
    }
    .oc-member-canvas-annotation-panel {
      position: fixed;
      top: 126px;
      right: 22px;
      bottom: 24px;
      width: min(380px, calc(100vw - 44px));
      z-index: 999996;
      pointer-events: auto;
      display: grid;
      grid-template-rows: auto auto 1fr;
      gap: 12px;
      padding: 14px;
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 16px;
      background: rgba(15, 23, 42, 0.96);
      box-shadow: 0 20px 56px rgba(0, 0, 0, 0.34);
    }
    .oc-member-canvas-annotation-panel header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .oc-member-canvas-annotation-panel h2 {
      margin: 0;
      font-size: 15px;
      color: #f8fafc;
    }
    .oc-member-canvas-annotation-actions,
    .oc-member-canvas-annotation-card-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .oc-member-canvas-annotation-panel button {
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 10px;
      padding: 7px 10px;
      color: #e2e8f0;
      background: rgba(30, 41, 59, 0.96);
      cursor: pointer;
      font-size: 13px;
    }
    .oc-member-canvas-annotation-panel button.primary {
      border-color: rgba(56, 189, 248, 0.44);
      color: #e0f2fe;
      background: rgba(14, 116, 144, 0.72);
    }
    .oc-member-canvas-annotation-list {
      min-height: 0;
      overflow: auto;
      display: grid;
      align-content: start;
      gap: 10px;
    }
    .oc-member-canvas-annotation-card {
      display: grid;
      gap: 8px;
      padding: 10px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 12px;
      background: rgba(30, 41, 59, 0.84);
    }
    .oc-member-canvas-annotation-card textarea {
      width: 100%;
      min-height: 74px;
      resize: vertical;
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 10px;
      padding: 9px;
      color: #f8fafc;
      background: rgba(2, 6, 23, 0.82);
    }
    .oc-member-canvas-annotation-muted {
      color: #94a3b8;
      font-size: 12px;
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

function buildPageId(controller) {
  return [
    "member-chat",
    String(controller?.selectedAgent?.id || "").trim(),
    String(controller?.currentSessionKey || "").trim(),
  ]
    .filter(Boolean)
    .join(":");
}

function buildRectStyle(rect) {
  return [
    `left:${Number(rect.x || 0)}px`,
    `top:${Number(rect.y || 0)}px`,
    `width:${Number(rect.width || 0)}px`,
    `height:${Number(rect.height || 0)}px`,
  ].join(";");
}

function normalizeViewportRect(start, end) {
  const x = Math.max(0, Math.min(start.x, end.x));
  const y = Math.max(0, Math.min(start.y, end.y));
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    pageWidth: Math.round(window.innerWidth || document.documentElement.clientWidth || 0),
    pageHeight: Math.round(window.innerHeight || document.documentElement.clientHeight || 0),
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

async function loadAnnotations(state) {
  state.annotations = await state.apiClient.listMemberAnnotations({
    tenantAgentId: state.controller.selectedAgent.id,
    openclawSessionKey: state.controller.currentSessionKey,
    pageId: state.pageId,
  });
  if (!Array.isArray(state.annotations)) {
    state.annotations = [];
  }
}

function render(state) {
  const { root, open, selecting, draft, annotations } = state;
  root.innerHTML = `
    <button class="oc-member-canvas-annotation-button" ${BUTTON_ATTR}="true" data-active="${open ? "true" : "false"}" type="button">
      ${open ? "正在批注" : "批注"}
    </button>
    ${
      open
        ? `<div class="oc-member-canvas-annotation-overlay" ${OVERLAY_ATTR}="true"></div>
          ${annotations
            .map(
              (annotation) =>
                `<div class="oc-member-canvas-annotation-rect" ${RECT_ATTR}="true" style="${buildRectStyle(
                  annotation.rect || {},
                )}"></div>`,
            )
            .join("")}
          ${
            selecting || draft
              ? `<div class="oc-member-canvas-annotation-rect" ${RECT_ATTR}="true" data-draft="true" style="${buildRectStyle(
                  (selecting && selecting.rect) || draft?.rect || {},
                )}"></div>`
              : ""
          }
          <aside class="oc-member-canvas-annotation-panel" ${PANEL_ATTR}="true">
            <header>
              <h2>Canvas 批注</h2>
              <button type="button" data-action="close">关闭</button>
            </header>
            <div class="oc-member-canvas-annotation-actions">
              <button type="button" class="primary" data-action="all-prompts">回填全部未解决</button>
              <span class="oc-member-canvas-annotation-muted">拖拽页面区域创建批注</span>
            </div>
            <div class="oc-member-canvas-annotation-list">
              ${
                draft
                  ? `<section class="oc-member-canvas-annotation-card" ${DRAFT_ATTR}="true">
                      <strong>新批注</strong>
                      <textarea data-draft-text placeholder="描述这个区域需要怎么修改..."></textarea>
                      <div class="oc-member-canvas-annotation-card-actions">
                        <button type="button" class="primary" data-action="save-draft">保存批注</button>
                        <button type="button" data-action="cancel-draft">取消</button>
                      </div>
                    </section>`
                  : ""
              }
              ${annotations
                .map(
                  (annotation) =>
                    `<section class="oc-member-canvas-annotation-card" data-annotation-id="${escapeHtml(annotation.id)}">
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
                        <button type="button" class="primary" data-action="single-prompt" data-id="${escapeHtml(annotation.id)}">回填此批注</button>
                        <button type="button" data-action="reply" data-id="${escapeHtml(annotation.id)}">回复</button>
                        <button type="button" data-action="toggle-status" data-id="${escapeHtml(annotation.id)}">${annotation.status === "resolved" ? "重新打开" : "解决"}</button>
                      </div>
                    </section>`,
                )
                .join("")}
            </div>
          </aside>`
        : ""
    }
  `;
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

  const updateSelection = (event) => {
    if (!state.selecting) {
      return;
    }
    state.selecting.rect = normalizeViewportRect(state.selecting.start, {
      x: event.clientX,
      y: event.clientY,
    });
    render(state);
  };

  const finishSelection = (event) => {
    if (!state.selecting) {
      return;
    }
    clearPointerListeners();
    const rect = normalizeViewportRect(state.selecting.start, {
      x: event.clientX,
      y: event.clientY,
    });
    state.selecting = null;
    if (rect.width < 12 || rect.height < 12) {
      render(state);
      return;
    }
    state.draft = { rect };
    render(state);
  };

  state.clearPointerListeners = clearPointerListeners;

  state.root.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const action = String(target.dataset.action || "").trim();
    if (target.matches(`[${BUTTON_ATTR}]`)) {
      state.open = !state.open;
      if (state.open) {
        await loadAnnotations(state).catch(() => {
          state.annotations = [];
        });
      }
      state.draft = null;
      render(state);
      return;
    }
    if (!action) {
      return;
    }
    if (action === "close") {
      state.open = false;
      state.draft = null;
      render(state);
      return;
    }
    if (action === "cancel-draft") {
      state.draft = null;
      render(state);
      return;
    }
    if (action === "save-draft" && state.draft) {
      const textarea = state.root.querySelector("[data-draft-text]");
      const text = textarea instanceof HTMLTextAreaElement ? textarea.value.trim() : "";
      if (!text) {
        return;
      }
      const created = await state.apiClient.createMemberAnnotation({
        tenantAgentId: state.controller.selectedAgent.id,
        openclawSessionKey: state.controller.currentSessionKey,
        runId: String(state.controller.app?.chatRunId || "").trim(),
        messageId: "",
        pageId: state.pageId,
        entryUrl: window.location.pathname + window.location.search,
        revisionId: "",
        rect: state.draft.rect,
        text,
      });
      state.annotations.unshift(created);
      state.draft = null;
      render(state);
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
    if (!(target instanceof HTMLElement) || !target.matches(`[${OVERLAY_ATTR}]`)) {
      return;
    }
    state.selecting = {
      start: { x: event.clientX, y: event.clientY },
      rect: normalizeViewportRect(
        { x: event.clientX, y: event.clientY },
        { x: event.clientX, y: event.clientY },
      ),
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
  const pageId = buildPageId(controller);
  const activeSurface = window._ocMemberChatCanvasAnnotationSurface;
  if (activeSurface?.state?.root?.isConnected && activeSurface.state.pageId === pageId) {
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
    pageId,
    open: false,
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
