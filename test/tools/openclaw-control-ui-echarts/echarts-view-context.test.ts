/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  consumeEchartsViewPendingPrompt,
  readEchartsViewRuntimeContext,
  writeEchartsViewPendingPrompt,
  writeEchartsViewRuntimeContext,
  writeEchartsViewToken,
} from "../../../tools/openclaw-control-ui-echarts/runtime/echarts-view/context.js";

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("echarts view context", () => {
  it("stores and reads runtime context by visualization token", () => {
    writeEchartsViewToken("viz-token");
    writeEchartsViewRuntimeContext({
      token: "viz-token",
      tenantAgentId: "tenant-agent-1",
      openclawSessionKey: "session-1",
      returnChatHref: "/chat?tenantAgentId=tenant-agent-1&session=session-1",
      pageId: "page-1",
    });

    expect(readEchartsViewRuntimeContext("viz-token")).toMatchObject({
      tenantAgentId: "tenant-agent-1",
      openclawSessionKey: "session-1",
      pageId: "page-1",
    });
    expect(readEchartsViewRuntimeContext("other-token")).toBeNull();
  });

  it("consumes pending prompt only for matching tenant chat context", () => {
    writeEchartsViewToken("viz-token");
    writeEchartsViewPendingPrompt({
      token: "viz-token",
      tenantAgentId: "tenant-agent-1",
      openclawSessionKey: "session-1",
      pendingPrompt: "请根据批注优化顶部图表留白",
      returnChatHref: "/chat?tenantAgentId=tenant-agent-1&session=session-1",
    });

    expect(
      consumeEchartsViewPendingPrompt({
        token: "viz-token",
        tenantAgentId: "tenant-agent-2",
      }),
    ).toBeNull();

    expect(
      consumeEchartsViewPendingPrompt({
        token: "viz-token",
        tenantAgentId: "tenant-agent-1",
        sessionKey: "session-1",
      }),
    ).toMatchObject({
      prompt: "请根据批注优化顶部图表留白",
      tenantAgentId: "tenant-agent-1",
      openclawSessionKey: "session-1",
    });

    expect(
      consumeEchartsViewPendingPrompt({
        token: "viz-token",
        tenantAgentId: "tenant-agent-1",
        sessionKey: "session-1",
      }),
    ).toBeNull();
  });
});
