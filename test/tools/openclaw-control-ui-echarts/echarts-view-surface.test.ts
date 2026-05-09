/**
 * @vitest-environment jsdom
 */

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bootEchartsViewSurface,
  installEchartsViewFrameNavigationBridge,
} from "../../../tools/openclaw-control-ui-echarts/runtime/echarts-view/surface.js";

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
    window.history.replaceState({}, "", "/echarts-view/?token=member-visualization-token");
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
             <img src="/workspace-agent-downloads/tenant-agent-1/Echarts/chart.png" alt="chart">
           </main>
         </body>
       </html>`,
      baseHref,
    );

    await bootEchartsViewSurface();
    await Promise.resolve();

    expect(window.location.pathname).toBe("/echarts-view/");
    expect(window.location.search).toContain("token=member-visualization-token");
    expect(document.title).toBe("销售数据可视化");
    const frame = document.querySelector(`iframe#oc-echarts-view-frame`);
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute("srcdoc")).toContain(
      '<base href="/workspace-agent-downloads/tenant-agent-1/Echarts/" />',
    );
    expect(frame?.getAttribute("srcdoc")).toContain(
      '<img src="/workspace-agent-downloads/tenant-agent-1/Echarts/chart.png" alt="chart">',
    );
    expect(frame?.getAttribute("srcdoc")).toContain('<main id="viz">');
    expect(document.body.textContent).not.toContain("native content");
    expect(document.body.textContent).not.toContain("可视化展示");
  });

  it("injects the workspace base href so relative visualization assets keep loading", async () => {
    const baseHref = "/workspace-agent-downloads/tenant-agent-1/Echarts/";
    window.history.replaceState({}, "", "/echarts-view/?token=member-visualization-token");
    stubVisualizationResolve(
      `<!doctype html>
       <html>
         <head>
           <title>苏博泰克官网简版</title>
         </head>
         <body>
           <header class="brand">
             <img src="./assets/logo.png" alt="logo">
           </header>
         </body>
       </html>`,
      baseHref,
    );

    await bootEchartsViewSurface();
    await Promise.resolve();

    const frame = document.querySelector(`iframe#oc-echarts-view-frame`);
    const srcdoc = frame?.getAttribute("srcdoc") || "";
    expect(srcdoc).toContain('<base href="/workspace-agent-downloads/tenant-agent-1/Echarts/" />');
    expect(srcdoc).toContain('<img src="./assets/logo.png" alt="logo">');
  });

  it("falls back to the stored token when the public route opens without a query token", async () => {
    const baseHref = "/workspace-agent-downloads/tenant-agent-1/Echarts/";
    window.sessionStorage.clear();
    window.localStorage.setItem(
      "openclaw:tenant-platform:echarts-view-token:v1",
      "member-visualization-token",
    );
    window.history.replaceState({}, "", "/echarts-view");
    stubVisualizationResolve(
      `<!doctype html><html><head><title>财务报表可视化</title></head><body><main id="viz">fallback</main></body></html>`,
      baseHref,
    );

    await bootEchartsViewSurface();
    await Promise.resolve();

    expect(window.location.pathname).toBe("/echarts-view/");
    expect(window.location.search).toContain("token=member-visualization-token");
    expect(document.title).toBe("财务报表可视化");
    expect(document.querySelector(`iframe#oc-echarts-view-frame`)).not.toBeNull();
  });

  it("keeps fragment-only navigation inside iframe documents across browser realms", () => {
    const frame = document.createElement("iframe");
    const foreignDom = new JSDOM(
      `<!doctype html>
       <html>
         <body>
           <main id="top">overview</main>
           <section id="contact">contact</section>
           <a id="jump-section" href="#contact"><span id="jump-section-label">jump</span></a>
           <a id="jump-top" href="#"><span id="jump-top-label">top</span></a>
         </body>
       </html>`,
      {
        url: "https://www.hailstone.cn:18789/echarts-view/?token=member-visualization-token",
      },
    );

    try {
      const frameDocument = foreignDom.window.document;
      const frameWindow = foreignDom.window;
      frameWindow.scrollTo = vi.fn();

      const contactSection = frameDocument.getElementById("contact");
      contactSection.scrollIntoView = vi.fn();

      expect(frameDocument.getElementById("jump-section-label") instanceof Element).toBe(false);

      Object.defineProperty(frame, "contentDocument", {
        configurable: true,
        value: frameDocument,
      });
      Object.defineProperty(frame, "contentWindow", {
        configurable: true,
        value: frameWindow,
      });

      installEchartsViewFrameNavigationBridge(frame);

      const jumpSectionResult = frameDocument.getElementById("jump-section-label").dispatchEvent(
        new frameWindow.MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          button: 0,
        }),
      );
      expect(jumpSectionResult).toBe(false);
      expect(contactSection.scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      });

      const jumpTopResult = frameDocument.getElementById("jump-top-label").dispatchEvent(
        new frameWindow.MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          button: 0,
        }),
      );
      expect(jumpTopResult).toBe(false);
      expect(frameWindow.scrollTo).toHaveBeenCalledWith({
        top: 0,
        left: 0,
        behavior: "smooth",
      });
    } finally {
      foreignDom.window.close();
    }
  });
});
