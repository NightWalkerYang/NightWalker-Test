/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { bootTenantAuthSurface } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/auth-surface.js";

afterEach(() => {
  document.body.innerHTML = "";
  document.body.removeAttribute("data-oc-tenant-auth-active");
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

describe("tenant auth surface", () => {
  it("mounts platform login over the native app entry when the query route is active", async () => {
    document.body.innerHTML = "<openclaw-app></openclaw-app>";
    window.history.replaceState({}, "", "/?ocTenantView=platform-login");
    const fetchMock = vi.fn(async () =>
      ({
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            data: { initialized: true },
          };
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await bootTenantAuthSurface();

    expect(document.body.getAttribute("data-oc-tenant-auth-active")).toBe("true");
    expect(document.querySelector("[data-oc-tenant-auth-root]")).not.toBeNull();
    expect(document.querySelector(".login-gate__title")?.textContent).toContain("平台管理员登录");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
