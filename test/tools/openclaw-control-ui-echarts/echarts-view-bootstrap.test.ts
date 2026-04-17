/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  applyEchartsViewPublicBootstrap,
  injectEchartsViewPublicBootstrap,
} from "../../../tools/openclaw-control-ui-echarts/runtime/echarts-view/bootstrap.js";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-oc-echarts-view-route");
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  delete window.__OPENCLAW_CONTROL_UI_BASE_PATH__;
  delete window.__OPENCLAW_ECHARTS_VIEW_MODE__;
  delete window.__OPENCLAW_ECHARTS_VIEW_HISTORY_PATCHED__;
});

describe("echarts view public bootstrap", () => {
  it("pins the control-ui base path to root and preserves the visualization token", () => {
    window.history.replaceState({}, "", "/echarts-view/chat?token=viz-token&session=legacy");

    applyEchartsViewPublicBootstrap();

    expect(window.__OPENCLAW_CONTROL_UI_BASE_PATH__).toBe("/");
    expect(window.__OPENCLAW_ECHARTS_VIEW_MODE__).toBe(true);
    expect(document.documentElement.getAttribute("data-oc-echarts-view-route")).toBe("true");
    expect(window.location.pathname).toBe("/echarts-view/");
    expect(window.location.search).toContain("token=viz-token");
    expect(window.location.search).not.toContain("session=");

    window.history.pushState({}, "", "/echarts-view/chat?token=next-token");
    expect(window.location.pathname).toBe("/echarts-view/");
    expect(window.location.search).toContain("token=next-token");
  });

  it("injects the public bootstrap module only once", () => {
    const source = [
      "<html>",
      "  <head>",
      '    <script type="module" crossorigin src="./assets/index-realhash.js"></script>',
      "  </head>",
      "  <body></body>",
      "</html>",
    ].join("\n");

    const firstPass = injectEchartsViewPublicBootstrap(source);
    const secondPass = injectEchartsViewPublicBootstrap(firstPass);

    expect(firstPass).toContain("data-openclaw-echarts-view-bootstrap");
    expect(firstPass).toContain("./assets/runtime/echarts-view/preboot.js");
    expect(firstPass).toContain('type="module"');
    expect(firstPass.indexOf("data-openclaw-echarts-view-bootstrap")).toBeLessThan(
      firstPass.indexOf("./assets/index-realhash.js"),
    );
    expect(secondPass.match(/data-openclaw-echarts-view-bootstrap/g)).toHaveLength(1);
  });
});
