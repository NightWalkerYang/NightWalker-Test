/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { bootEchartsViewSurface } from "../../../tools/openclaw-control-ui-echarts/runtime/echarts-view/surface.js";

function stubVisualizationResolve(html, baseHref) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          html,
          baseHref,
        },
      }),
    })),
  );
}

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  window.history.replaceState({}, "", "/");
  delete window.__openclawEchartsViewSurfaceBooted;
  delete window.__openclawTenantRouteSyncBooted;
  vi.unstubAllGlobals();
});

describe("public echarts view surface", () => {
  it("loads workspace html into the public route and normalizes the alias path", async () => {
    const baseHref = "/workspace-agent-downloads/tenant-agent-1/Echarts/";
    window.history.replaceState(
      {},
      "",
      "/echarts-view/chat?token=member-visualization-token",
    );
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    stubVisualizationResolve(
      `<!doctype html>
       <html>
         <head>
           <title>销售数据可视化</title>
         </head>
         <body>
           <main id="viz">
             <img src="./chart.png" alt="chart">
           </main>
         </body>
       </html>`,
      baseHref,
    );

    await bootEchartsViewSurface();
    await Promise.resolve();

    expect(window.location.pathname).toBe("/echarts-view");
    expect(window.location.search).toContain("token=member-visualization-token");
    expect(document.title).toBe("销售数据可视化");
    const frame = document.querySelector(`iframe#oc-echarts-view-frame`);
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute("srcdoc")).toContain(`<base href="${baseHref}">`);
    expect(frame?.getAttribute("srcdoc")).toContain("<main id=\"viz\">");
    expect(document.body.textContent).not.toContain("native content");
    expect(document.body.textContent).not.toContain("可视化展示");
  });
});
