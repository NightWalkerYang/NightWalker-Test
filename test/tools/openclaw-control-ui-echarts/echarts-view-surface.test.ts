/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vitest";
import { bootEchartsViewSurface } from "../../../tools/openclaw-control-ui-echarts/runtime/echarts-view/surface.js";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-oc-echarts-view-route");
  document.body.removeAttribute("data-oc-echarts-view-route");
  window.history.replaceState({}, "", "/");
  delete window.__openclawEchartsViewSurfaceBooted;
  delete window.__openclawTenantRouteSyncBooted;
});

describe("public echarts view surface", () => {
  it("mounts a placeholder card and cleans up when the route changes", async () => {
    window.history.replaceState({}, "", "/echarts-view");
    document.body.innerHTML = `
      <button class="topbar-search"></button>
      <nav class="sidebar-nav"></nav>
      <div class="sidebar-utility-group"></div>
      <div class="sidebar-shell__footer"></div>
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;

    await bootEchartsViewSurface();

    expect(document.documentElement.getAttribute("data-oc-echarts-view-route")).toBe("true");
    expect(document.body.getAttribute("data-oc-echarts-view-route")).toBe("true");
    expect(document.querySelector(".content")?.getAttribute("data-oc-echarts-view-active")).toBe(
      "true",
    );
    expect(document.querySelector("[data-oc-echarts-view-root]")?.textContent).toContain(
      "可视化展示",
    );
    expect(document.head.querySelector('[data-oc-echarts-view-style="true"]')).toBeInstanceOf(
      HTMLLinkElement,
    );

    window.history.replaceState({}, "", "/chat");
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector("[data-oc-echarts-view-root]")).toBeNull();
    expect(document.head.querySelector('[data-oc-echarts-view-style="true"]')).toBeNull();
    expect(document.documentElement.getAttribute("data-oc-echarts-view-route")).toBeNull();
  });
});
