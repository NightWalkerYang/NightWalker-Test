/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  applySandboxViewPublicBootstrap,
  injectSandboxViewPublicBootstrap,
} from "../../../tools/openclaw-control-ui-echarts/runtime/sandbox-view/bootstrap.js";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-oc-sandbox-view-route");
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  delete window.__OPENCLAW_CONTROL_UI_BASE_PATH__;
  delete window.__OPENCLAW_SANDBOX_VIEW_MODE__;
  delete window.__OPENCLAW_SANDBOX_VIEW_HISTORY_PATCHED__;
});

describe("sandbox view public bootstrap", () => {
  it("pins the control-ui base path to root and preserves the sandbox token", () => {
    window.history.replaceState({}, "", "/sandbox-view/chat?token=sandbox-token&session=legacy");

    applySandboxViewPublicBootstrap();

    expect(window.__OPENCLAW_CONTROL_UI_BASE_PATH__).toBe("/");
    expect(window.__OPENCLAW_SANDBOX_VIEW_MODE__).toBe(true);
    expect(document.documentElement.getAttribute("data-oc-sandbox-view-route")).toBe("true");
    expect(window.location.pathname).toBe("/sandbox-view/");
    expect(window.location.search).toContain("token=sandbox-token");
    expect(window.location.search).not.toContain("session=");
  });

  it("injects the public sandbox bootstrap module only once", () => {
    const source = [
      "<html>",
      "  <head>",
      '    <script type="module" crossorigin src="./assets/index-realhash.js"></script>',
      "  </head>",
      "  <body></body>",
      "</html>",
    ].join("\n");

    const firstPass = injectSandboxViewPublicBootstrap(source);
    const secondPass = injectSandboxViewPublicBootstrap(firstPass);

    expect(firstPass).toContain("data-openclaw-sandbox-view-bootstrap");
    expect(firstPass).toContain("/assets/runtime/sandbox-view/preboot.js");
    expect(secondPass.match(/data-openclaw-sandbox-view-bootstrap/g)).toHaveLength(1);
  });
});
