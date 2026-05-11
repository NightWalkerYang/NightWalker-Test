/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from "vitest";
import {
  listSessions,
  loadChatHistory,
  loadSessionUsageTimeseries,
  patchSession,
} from "../../../tools/openclaw-control-ui-echarts/runtime/framework/rpc-compat.js";

function createApp(requestImpl) {
  return {
    client: {
      request: vi.fn(requestImpl),
    },
  };
}

describe("rpc compat", () => {
  it("forwards sessions.list and chat.history calls", async () => {
    const app = createApp(async (method, params) => ({ method, params }));

    await expect(listSessions(app, {}, "test")).resolves.toEqual({
      method: "sessions.list",
      params: {},
    });
    await expect(loadChatHistory(app, { sessionKey: "a" }, "test")).resolves.toEqual({
      method: "chat.history",
      params: { sessionKey: "a" },
    });
  });

  it("forwards sessions.patch calls", async () => {
    const app = createApp(async (method, params) => ({ method, params }));

    await expect(patchSession(app, { key: "a", model: "openai/gpt-5.4" }, "test")).resolves.toEqual(
      {
        method: "sessions.patch",
        params: { key: "a", model: "openai/gpt-5.4" },
      },
    );
  });

  it("falls back from usage timeseries to chat.history when needed", async () => {
    const app = createApp(async (method, params) => {
      if (method === "sessions.usage.timeseries") {
        throw new Error("unavailable");
      }
      return { method, params, messages: [] };
    });

    const result = await loadSessionUsageTimeseries(app, { key: "agent:1" }, "test");
    expect(result?.fallback).toBe("chat.history");
    expect(result?.history?.method).toBe("chat.history");
  });
});
