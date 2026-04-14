/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { bootMemberSurface } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/member-surface.js";
import { writeTenantSession } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  delete window.__openclawMemberSurfaceBooted;
  delete window.__openclawTenantRouteSyncBooted;
  vi.unstubAllGlobals();
});

describe("member surface", () => {
  it("mounts the native member agent selector into the control-ui content area", async () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-agent-selector");
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/member/agents")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: [
                  {
                    id: "tenant-agent-1",
                    agentId: "subotech-finance",
                    agentName: "苏博泰克财务分析助手",
                    status: "active",
                    balancePoints: 120,
                    description: "财务分析",
                  },
                ],
              };
            },
          };
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootMemberSurface();

    const content = document.querySelector(".content");
    const surfaceRoot = document.querySelector("[data-oc-member-surface-root]");
    expect(content?.getAttribute("data-oc-member-surface-active")).toBe("true");
    expect(surfaceRoot).not.toBeNull();
    expect(surfaceRoot?.textContent).toContain("苏博泰克财务分析助手");
    expect(surfaceRoot?.querySelector("[data-member-open-chat]")?.textContent).toContain("进入聊天");
    expect(surfaceRoot?.querySelector("[data-tenant-feedback]")).toBeNull();
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")?.textContent).toContain(
      "请选择一个已分配的 Agent 继续使用。",
    );
  });
});
