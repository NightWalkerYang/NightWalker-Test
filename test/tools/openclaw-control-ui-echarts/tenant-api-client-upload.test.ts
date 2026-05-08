/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTenantApiClient } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/api-client.js";

describe("tenant api client multipart upload", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("uploads member image assets with multipart/form-data and auth header", async () => {
    const responsePayload = {
      ok: true,
      data: {
        uploadedItems: [{ slotId: "logo", workspacePath: "Echarts/assets/logo.png" }],
      },
    };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.body as FormData;
      return {
        ok: true,
        status: 200,
        async json() {
          return responsePayload;
        },
        _body: body,
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    localStorage.setItem(
      "openclaw:tenant-platform:tenant-session:v1",
      JSON.stringify({
        token: "member-token",
        session: { role: "member" },
      }),
    );

    const client = createTenantApiClient();
    const result = await client.uploadMemberImageAsset({
      tenantAgentId: "tenant-agent-1",
      slotId: "logo",
      workspacePath: "Echarts/assets/logo.png",
      file: new File(["png"], "logo.png", { type: "image/png" }),
    });

    expect(result.uploadedItems[0]?.workspacePath).toBe("Echarts/assets/logo.png");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [_calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(calledInit?.method || "")).toBe("POST");
    expect(String((calledInit?.headers as Record<string, string>)?.authorization || "")).toBe(
      "Bearer member-token",
    );
    const multipartBody = calledInit?.body as FormData;
    expect(multipartBody.get("tenantAgentId")).toBe("tenant-agent-1");
    expect(multipartBody.get("slotId")).toBe("logo");
    expect(multipartBody.get("workspacePath")).toBe("Echarts/assets/logo.png");
    const uploadedFile = multipartBody.get("file");
    expect(uploadedFile).toBeInstanceOf(File);
    expect((uploadedFile as File).name).toBe("logo.png");
  });
});

