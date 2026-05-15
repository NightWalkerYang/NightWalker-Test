/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mountMemberChatCanvasAnnotations,
  unmountMemberChatCanvasAnnotations,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-canvas-annotations.js";

function createController() {
  const app = document.createElement("openclaw-app");
  app.chatRunId = "run-1";
  return {
    app,
    selectedAgent: { id: "tenant-agent-1" },
    currentSessionKey: "session-1",
  };
}

function createApiClient() {
  const createdAnnotation = {
    id: "annotation-1",
    status: "open",
    rect: { x: 20, y: 30, width: 160, height: 90, pageWidth: 480, pageHeight: 620 },
    thread: [{ id: "thread-1", text: "顶部卡片层级不清晰" }],
  };
  return {
    createdAnnotation,
    listMemberVisualizations: vi.fn(async () => [
      {
        id: "viz-page-1",
        tenantAgentId: "tenant-agent-1",
        token: "viz-token-1",
        href: "/echarts-view/?token=viz-token-1",
        visualizationName: "销售大屏",
        revisionId: "rev-1",
      },
    ]),
    resolveMemberVisualization: vi.fn(async () => ({
      html: '<!doctype html><html><head><title>销售大屏</title><script src="/assets/vendor/echarts.min.js"></script></head><body><section class="dashboard-card"><img src="./assets/logo.png" alt="logo">顶部概览卡片</section></body></html>',
      baseHref: "/workspace-agent-downloads/tenant-agent-1/Echarts/",
    })),
    listMemberAnnotations: vi.fn(async () => []),
    createMemberAnnotation: vi.fn(async () => createdAnnotation),
    replyMemberAnnotation: vi.fn(async () => ({
      ...createdAnnotation,
      thread: [...createdAnnotation.thread, { id: "thread-2", text: "请同时加大标题和图表间距" }],
    })),
    updateMemberAnnotationStatus: vi.fn(async () => ({
      ...createdAnnotation,
      status: "resolved",
    })),
  };
}

function pointer(type: string, x: number, y: number) {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
}

async function flush() {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }
}

afterEach(() => {
  unmountMemberChatCanvasAnnotations();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("member chat canvas annotations", () => {
  it("opens a light Canvas drawer, annotates the preview, and backfills the comment", async () => {
    document.body.innerHTML = `
      <main class="content content--chat" data-testid="chat-shell">
        <form class="agent-chat__input" data-testid="chat-composer">
          <textarea placeholder="Type a message below"></textarea>
          <button type="submit">Send</button>
        </form>
      </main>
    `;

    const apiClient = createApiClient();
    const surface = mountMemberChatCanvasAnnotations(createController(), apiClient);

    expect(surface).not.toBeNull();
    expect(document.body.textContent).toContain("Canvas");

    document.querySelector<HTMLElement>("[data-oc-member-canvas-annotation-button]")?.click();
    await flush();

    expect(apiClient.listMemberVisualizations).toHaveBeenCalledTimes(1);
    expect(apiClient.resolveMemberVisualization).toHaveBeenCalledWith("viz-token-1");
    expect(apiClient.listMemberAnnotations).toHaveBeenCalledWith({
      tenantAgentId: "tenant-agent-1",
      openclawSessionKey: "session-1",
      pageId: "viz-page-1",
    });
    expect(document.body.textContent).toContain("销售大屏");
    expect(document.body.textContent).toContain("0 条注释");
    expect(document.querySelector("[data-oc-member-canvas-annotation-drawer]")).not.toBeNull();
    expect(
      document
        .querySelector<HTMLElement>('[data-testid="chat-shell"]')
        ?.getAttribute("data-oc-member-canvas-docked"),
    ).toBe("true");
    expect(document.querySelector<HTMLIFrameElement>("iframe")?.srcdoc).not.toContain("<base ");
    expect(document.querySelector<HTMLIFrameElement>("iframe")?.srcdoc).toContain(
      '<script src="/workspace-agent-downloads/tenant-agent-1/Echarts/assets/vendor/echarts.min.js"></script>',
    );
    expect(document.querySelector<HTMLIFrameElement>("iframe")?.srcdoc).toContain(
      '<img src="/workspace-agent-downloads/tenant-agent-1/Echarts/assets/logo.png" alt="logo">',
    );

    const overlay = document.querySelector<HTMLElement>(
      "[data-oc-member-canvas-annotation-overlay]",
    );
    expect(overlay).not.toBeNull();
    Object.defineProperty(overlay, "clientWidth", { configurable: true, value: 480 });
    Object.defineProperty(overlay, "clientHeight", { configurable: true, value: 620 });
    overlay!.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 480,
        bottom: 620,
        width: 480,
        height: 620,
        toJSON: () => ({}),
      }) as DOMRect;
    overlay?.dispatchEvent(pointer("pointerdown", 20, 30));
    window.dispatchEvent(pointer("pointermove", 180, 120));
    window.dispatchEvent(pointer("pointerup", 180, 120));

    const draft = document.querySelector<HTMLInputElement>("[data-draft-text]");
    expect(draft).not.toBeNull();
    draft!.value = "顶部卡片层级不清晰";
    draft!.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector<HTMLElement>('[data-action="save-draft"]')?.click();
    await flush();

    expect(apiClient.createMemberAnnotation).toHaveBeenCalledWith({
      tenantAgentId: "tenant-agent-1",
      openclawSessionKey: "session-1",
      runId: "run-1",
      messageId: "",
      pageId: "viz-page-1",
      entryUrl: "/echarts-view/?token=viz-token-1",
      revisionId: "rev-1",
      rect: { x: 20, y: 30, width: 160, height: 90, pageWidth: 480, pageHeight: 620 },
      text: "顶部卡片层级不清晰",
    });
    expect(document.body.textContent).toContain("1 条注释");
    expect(document.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "请处理这条标注反馈：顶部卡片层级不清晰",
    );

    document.querySelector<HTMLElement>('[data-action="all-prompts"]')?.click();
    expect(document.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      ["请一起处理这些未解决的标注反馈：", "1. 顶部卡片层级不清晰"].join("\n"),
    );
  });

  it("supports docked resizing and fullscreen mode", async () => {
    document.body.innerHTML = `
      <main class="content content--chat" data-testid="chat-shell">
        <form class="agent-chat__input" data-testid="chat-composer">
          <textarea placeholder="Type a message below"></textarea>
          <button type="submit">Send</button>
        </form>
      </main>
    `;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    const composer = document.querySelector<HTMLElement>('[data-testid="chat-composer"]');
    composer!.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 760,
        top: 760,
        left: 0,
        right: 820,
        bottom: 880,
        width: 820,
        height: 120,
        toJSON: () => ({}),
      }) as DOMRect;
    const apiClient = createApiClient();
    mountMemberChatCanvasAnnotations(createController(), apiClient);

    document.querySelector<HTMLElement>("[data-oc-member-canvas-annotation-button]")?.click();
    await flush();

    const root = document.querySelector<HTMLElement>("[data-oc-member-canvas-annotation-root]");
    const dockTarget = document.querySelector<HTMLElement>('[data-testid="chat-shell"]');
    expect(root?.style.getPropertyValue("--oc-member-canvas-width")).toContain("560px");
    expect(dockTarget?.style.getPropertyValue("--oc-member-canvas-right-offset")).toContain(
      "580px",
    );
    expect(root?.style.getPropertyValue("--oc-member-composer-bottom-space")).toContain("142px");

    document
      .querySelector<HTMLElement>("[data-oc-member-canvas-resize-handle]")
      ?.dispatchEvent(pointer("pointerdown", 700, 60));
    window.dispatchEvent(pointer("pointermove", 600, 60));
    window.dispatchEvent(pointer("pointerup", 600, 60));
    await flush();

    expect(root?.style.getPropertyValue("--oc-member-canvas-width")).toContain("660px");
    expect(dockTarget?.style.getPropertyValue("--oc-member-canvas-right-offset")).toContain(
      "680px",
    );

    document.querySelector<HTMLElement>('[data-action="toggle-fullscreen"]')?.click();
    await flush();

    expect(
      document.querySelector<HTMLElement>("[data-oc-member-canvas-annotation-drawer]")?.dataset
        .fullscreen,
    ).toBe("true");
    expect(dockTarget?.getAttribute("data-oc-member-canvas-fullscreen")).toBe("true");
  });

  it("creates a draft from an automatically detected iframe module", async () => {
    document.body.innerHTML = `
      <main class="content content--chat" data-testid="chat-shell">
        <form data-testid="chat-composer">
          <textarea placeholder="Type a message below"></textarea>
          <button type="submit">Send</button>
        </form>
      </main>
    `;
    const apiClient = createApiClient();
    mountMemberChatCanvasAnnotations(createController(), apiClient);
    document.querySelector<HTMLElement>("[data-oc-member-canvas-annotation-button]")?.click();
    await flush();

    const frame = document.querySelector<HTMLIFrameElement>("iframe");
    const overlay = document.querySelector<HTMLElement>(
      "[data-oc-member-canvas-annotation-overlay]",
    );
    expect(frame).not.toBeNull();
    expect(overlay).not.toBeNull();
    Object.defineProperty(overlay, "clientWidth", { configurable: true, value: 480 });
    Object.defineProperty(overlay, "clientHeight", { configurable: true, value: 620 });
    const frameDocument = frame!.contentDocument!;
    frameDocument.open();
    frameDocument.write(
      '<!doctype html><html><body><section class="dashboard-card">顶部概览卡片</section></body></html>',
    );
    frameDocument.close();
    const card = frameDocument.querySelector<HTMLElement>(".dashboard-card")!;
    card.getBoundingClientRect = () =>
      ({
        x: 40,
        y: 50,
        top: 50,
        left: 40,
        right: 260,
        bottom: 190,
        width: 220,
        height: 140,
        toJSON: () => ({}),
      }) as DOMRect;
    Object.defineProperty(frame!.contentWindow, "innerWidth", { configurable: true, value: 480 });
    Object.defineProperty(frame!.contentWindow, "innerHeight", { configurable: true, value: 620 });
    frame!.dispatchEvent(new Event("load"));
    card.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    const draft = document.querySelector<HTMLInputElement>("[data-draft-text]");
    expect(draft).not.toBeNull();
    expect(document.querySelector<HTMLIFrameElement>("iframe")).toBe(frame);
    draft!.value = "自动识别到顶部概览卡片";
    draft!.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector<HTMLElement>('[data-action="save-draft"]')?.click();
    await flush();

    expect(apiClient.createMemberAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({
        rect: { x: 40, y: 50, width: 220, height: 140, pageWidth: 480, pageHeight: 620 },
        text: "自动识别到顶部概览卡片",
      }),
    );
  });

  it("creates a draft from a smart overlay click on the iframe module", async () => {
    document.body.innerHTML = `
      <main class="content content--chat" data-testid="chat-shell">
        <form data-testid="chat-composer">
          <textarea placeholder="Type a message below"></textarea>
          <button type="submit">Send</button>
        </form>
      </main>
    `;
    const apiClient = createApiClient();
    mountMemberChatCanvasAnnotations(createController(), apiClient);
    document.querySelector<HTMLElement>("[data-oc-member-canvas-annotation-button]")?.click();
    await flush();

    const frame = document.querySelector<HTMLIFrameElement>("iframe");
    const overlay = document.querySelector<HTMLElement>(
      "[data-oc-member-canvas-annotation-overlay]",
    );
    expect(frame).not.toBeNull();
    expect(overlay).not.toBeNull();
    Object.defineProperty(overlay, "clientWidth", { configurable: true, value: 480 });
    Object.defineProperty(overlay, "clientHeight", { configurable: true, value: 620 });
    overlay!.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 480,
        bottom: 620,
        width: 480,
        height: 620,
        toJSON: () => ({}),
      }) as DOMRect;
    const frameDocument = frame!.contentDocument!;
    frameDocument.open();
    frameDocument.write(
      '<!doctype html><html><body><section class="dashboard-card">顶部概览卡片</section></body></html>',
    );
    frameDocument.close();
    const card = frameDocument.querySelector<HTMLElement>(".dashboard-card")!;
    card.getBoundingClientRect = () =>
      ({
        x: 40,
        y: 50,
        top: 50,
        left: 40,
        right: 260,
        bottom: 190,
        width: 220,
        height: 140,
        toJSON: () => ({}),
      }) as DOMRect;
    Object.defineProperty(frameDocument, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => card),
    });
    Object.defineProperty(frame!.contentWindow, "innerWidth", { configurable: true, value: 480 });
    Object.defineProperty(frame!.contentWindow, "innerHeight", { configurable: true, value: 620 });
    frame!.dispatchEvent(new Event("load"));

    overlay!.dispatchEvent(pointer("pointermove", 90, 100));
    expect(document.querySelector<HTMLElement>('[data-smart="true"]')).not.toBeNull();
    overlay!.dispatchEvent(pointer("pointerdown", 90, 100));
    window.dispatchEvent(pointer("pointerup", 90, 100));

    const draft = document.querySelector<HTMLInputElement>("[data-draft-text]");
    expect(draft).not.toBeNull();
    draft!.value = "覆盖层智能识别顶部概览卡片";
    draft!.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector<HTMLElement>('[data-action="save-draft"]')?.click();
    await flush();

    expect(apiClient.createMemberAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({
        rect: { x: 40, y: 50, width: 220, height: 140, pageWidth: 480, pageHeight: 620 },
        text: "覆盖层智能识别顶部概览卡片",
      }),
    );
  });

  it("updates annotation thread and resolved state", async () => {
    const apiClient = createApiClient();
    apiClient.listMemberAnnotations.mockResolvedValueOnce([apiClient.createdAnnotation]);
    mountMemberChatCanvasAnnotations(createController(), apiClient);

    document.querySelector<HTMLElement>("[data-oc-member-canvas-annotation-button]")?.click();
    await flush();

    const reply = document.querySelector<HTMLTextAreaElement>("[data-reply-text]");
    expect(reply).not.toBeNull();
    reply!.value = "请同时加大标题和图表间距";
    document.querySelector<HTMLElement>('[data-action="reply"]')?.click();
    await flush();

    expect(apiClient.replyMemberAnnotation).toHaveBeenCalledWith({
      annotationId: "annotation-1",
      text: "请同时加大标题和图表间距",
    });
    expect(document.body.textContent).toContain("回复：请同时加大标题和图表间距");

    document.querySelector<HTMLElement>('[data-action="toggle-status"]')?.click();
    await flush();

    expect(apiClient.updateMemberAnnotationStatus).toHaveBeenCalledWith({
      annotationId: "annotation-1",
      status: "resolved",
    });
    expect(document.body.textContent).toContain("已解决");
    expect(document.body.textContent).toContain("0 条注释");
  });

  it("preserves an open Canvas drawer across same-page remounts", async () => {
    const controller = createController();
    const apiClient = createApiClient();
    const surface = mountMemberChatCanvasAnnotations(controller, apiClient);
    document.querySelector<HTMLElement>("[data-oc-member-canvas-annotation-button]")?.click();
    await flush();

    expect(document.body.textContent).toContain("Canvas 批注");
    expect(document.querySelector("[data-oc-member-canvas-annotation-drawer]")).not.toBeNull();

    const remounted = mountMemberChatCanvasAnnotations(controller, apiClient);

    expect(remounted).toBe(surface);
    expect(document.body.textContent).toContain("Canvas 批注");
    expect(document.querySelector("[data-oc-member-canvas-annotation-drawer]")).not.toBeNull();
  });
});
