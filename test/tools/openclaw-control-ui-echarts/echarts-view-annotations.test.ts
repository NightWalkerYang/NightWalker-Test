/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mountEchartsViewAnnotations,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/echarts-view-annotations.js";
import {
  writeEchartsViewRuntimeContext,
  writeEchartsViewToken,
} from "../../../tools/openclaw-control-ui-echarts/runtime/echarts-view/context.js";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("echarts view annotations", () => {
  it("mounts annotation mode on controlled echarts-view frames", async () => {
    writeEchartsViewToken("viz-token");
    writeEchartsViewRuntimeContext({
      token: "viz-token",
      tenantAgentId: "tenant-agent-1",
      openclawSessionKey: "session-1",
      returnChatHref: "/chat?tenantAgentId=tenant-agent-1&session=session-1",
      pageId: "viz-page",
      visualizationName: "销售驾驶舱",
    });

    const frame = document.createElement("iframe");
    frame.srcdoc = "<html><body><main>viz</main></body></html>";
    Object.defineProperty(frame, "clientWidth", { configurable: true, get: () => 800 });
    Object.defineProperty(frame, "clientHeight", { configurable: true, get: () => 600 });

    const apiClient = {
      listMemberAnnotations: vi.fn(async () => []),
      createMemberAnnotation: vi.fn(async () => ({
        id: "annotation-1",
        status: "open",
        rect: { x: 10, y: 10, width: 100, height: 80, pageWidth: 800, pageHeight: 600 },
        thread: [{ id: "thread-1", text: "顶部图表太挤" }],
      })),
      replyMemberAnnotation: vi.fn(async () => null),
      updateMemberAnnotationStatus: vi.fn(async () => null),
    };

    const state = await mountEchartsViewAnnotations({
      apiClient,
      frame,
      visualization: { title: "销售驾驶舱" },
    });

    expect(state).not.toBeNull();
    expect(apiClient.listMemberAnnotations).toHaveBeenCalledWith({
      tenantAgentId: "tenant-agent-1",
      openclawSessionKey: "session-1",
      pageId: "viz-page",
    });
    expect(document.querySelector('[data-oc-echarts-annotation-host="true"]')).not.toBeNull();
    expect(document.body.textContent).toContain("批注模式");
    expect(document.body.textContent).toContain("根据全部未解决批注继续修改");
  });
});
