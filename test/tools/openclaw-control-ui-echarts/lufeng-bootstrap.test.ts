/**
 * @vitest-environment jsdom
 */

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyLufengPublicBootstrap,
  injectLufengPublicBootstrap,
} from "../../../tools/openclaw-control-ui-echarts/runtime/lufeng/bootstrap.js";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-oc-lufeng-route");
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  delete window.__OPENCLAW_CONTROL_UI_BASE_PATH__;
  delete window.__OPENCLAW_LUFENG_MODE__;
  delete window.__OPENCLAW_LUFENG_HISTORY_PATCHED__;
});

describe("lufeng public bootstrap", () => {
  it("pins the finance session and root gateway token scope for /lufeng", () => {
    window.history.replaceState({}, "", "/lufeng/chat?session=agent:main:main");

    applyLufengPublicBootstrap(" shared-token ");

    const settingsKey = `openclaw.control.settings.v1:ws://${window.location.host}/lufeng`;
    const tokenKey = `openclaw.control.token.v1:ws://${window.location.host}`;
    const settings = JSON.parse(window.localStorage.getItem(settingsKey) || "{}");

    expect(window.__OPENCLAW_CONTROL_UI_BASE_PATH__).toBe("/lufeng");
    expect(window.__OPENCLAW_LUFENG_MODE__).toBe(true);
    expect(document.documentElement.getAttribute("data-oc-lufeng-route")).toBe("true");
    expect(window.location.pathname).toBe("/lufeng");
    expect(window.location.search).toBe("");
    expect(settings.gatewayUrl).toBe(`ws://${window.location.host}`);
    expect(settings.sessionKey).toBe("agent:subotech-finance:lufeng");
    expect(settings.sessionsByGateway?.[`ws://${window.location.host}`]?.sessionKey).toBe(
      "agent:subotech-finance:lufeng",
    );
    expect(window.sessionStorage.getItem(tokenKey)).toBe("shared-token");
  });

  it("injects the bootstrap script only once", () => {
    const source = [
      "<html>",
      "  <head>",
      '    <script type="module" crossorigin src="./assets/index-realhash.js"></script>',
      "  </head>",
      "  <body></body>",
      "</html>",
    ].join("\n");

    const firstPass = injectLufengPublicBootstrap(source, "token-123");
    const secondPass = injectLufengPublicBootstrap(firstPass, "token-123");

    expect(firstPass).toContain("data-openclaw-lufeng-bootstrap");
    expect(firstPass).toContain("./assets/runtime/lufeng/preboot.js");
    expect(firstPass).toContain('data-gateway-token="token-123"');
    expect(firstPass.indexOf("data-openclaw-lufeng-bootstrap")).toBeLessThan(
      firstPass.indexOf("./assets/index-realhash.js"),
    );
    expect(secondPass.match(/data-openclaw-lufeng-bootstrap/g)).toHaveLength(1);
  });

  it("keeps the shipped preboot script aligned with the isolated lufeng session", () => {
    const preboot = readFileSync(
      "tools/openclaw-control-ui-echarts/runtime/lufeng/preboot.js",
      "utf8",
    );

    expect(preboot).toContain('const SESSION_KEY = "agent:subotech-finance:lufeng";');
    expect(preboot).not.toContain('const SESSION_KEY = "agent:subotech-finance:main";');
  });
});
