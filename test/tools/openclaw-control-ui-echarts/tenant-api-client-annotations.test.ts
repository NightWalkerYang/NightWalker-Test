/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTenantApiClient } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/api-client.js";

describe("tenant api client annotations", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    localStorage.setItem(
      "openclaw:tenant-platform:tenant-session:v1",
      JSON.stringify({
        token: "member-token",
        session: { role: "member", tenantId: "tenant-1", userId: "member-1" },
      }),
    );
  });

  it("lists member annotations with bearer auth", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          data: [{ id: "annotation-1", status: "open" }],
        };
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createTenantApiClient();
    const result = await client.listMemberAnnotations({
      tenantAgentId: "tenant-agent-1",
      openclawSessionKey: "agent:finance:tenant:tenant-1:tenant-agent:tenant-agent-1:user:member-1:chat:001",
      pageId: "visualization-page",
    });

    expect(result).toHaveLength(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/tenant-platform-api/v1/member/annotations?");
    expect(calledUrl).toContain("tenantAgentId=tenant-agent-1");
    expect(calledUrl).toContain("pageId=visualization-page");
    expect(String((calledInit?.headers as Record<string, string>)?.authorization || "")).toBe(
      "Bearer member-token",
    );
  });

  it("creates annotations, replies, and updates status through member annotation endpoints", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          data: {
            id: "annotation-1",
            status: "resolved",
            thread: [{ id: "thread-1", text: "fix this spacing" }],
          },
        };
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createTenantApiClient();

    await client.createMemberAnnotation({
      tenantAgentId: "tenant-agent-1",
      openclawSessionKey: "session-1",
      pageId: "page-1",
      entryUrl: "/echarts-view?token=abc",
      revisionId: "rev-1",
      runId: "run-1",
      messageId: "message-1",
      rect: {
        x: 10,
        y: 20,
        width: 120,
        height: 80,
        pageWidth: 1440,
        pageHeight: 900,
      },
      text: "顶部图表留白不够",
    });
    await client.replyMemberAnnotation({
      annotationId: "annotation-1",
      text: "请和标题一起调整",
    });
    await client.updateMemberAnnotationStatus({
      annotationId: "annotation-1",
      status: "resolved",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [createUrl, createInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(createUrl).toBe("/tenant-platform-api/v1/member/annotations");
    expect(String(createInit?.method || "")).toBe("POST");
    expect(JSON.parse(String(createInit?.body || "{}"))).toMatchObject({
      tenantAgentId: "tenant-agent-1",
      pageId: "page-1",
      messageId: "message-1",
    });

    const [replyUrl, replyInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(replyUrl).toBe("/tenant-platform-api/v1/member/annotations/thread");
    expect(JSON.parse(String(replyInit?.body || "{}"))).toMatchObject({
      annotationId: "annotation-1",
      text: "请和标题一起调整",
    });

    const [statusUrl, statusInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(statusUrl).toBe("/tenant-platform-api/v1/member/annotations/status");
    expect(JSON.parse(String(statusInit?.body || "{}"))).toMatchObject({
      annotationId: "annotation-1",
      status: "resolved",
    });
  });
});
