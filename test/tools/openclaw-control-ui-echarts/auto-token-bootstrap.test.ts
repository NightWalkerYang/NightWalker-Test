/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  applyAutoGatewayTokenBootstrap,
  injectAutoGatewayTokenBootstrap,
} from "../../../tools/openclaw-control-ui-echarts/runtime/branding/auto-token.js";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  delete window.__OPENCLAW_CONTROL_UI_BASE_PATH__;
  delete window.__OPENCLAW_CONTROL_UI_AUTO_TOKEN__;
});

describe("zero-intrusive auto token bootstrap", () => {
  it("stores the shared token for the inferred gateway scope", () => {
    window.history.replaceState({}, "", "/openclaw/chat");

    applyAutoGatewayTokenBootstrap("  demo-token  ");

    const expectedKeys = [
      `openclaw.control.token.v1:ws://${window.location.host}/openclaw`,
      `openclaw.control.token.v1:ws://${window.location.host}`,
    ];
    for (const key of expectedKeys) {
      expect(window.sessionStorage.getItem(key)).toBe("demo-token");
    }
    expect(window.__OPENCLAW_CONTROL_UI_AUTO_TOKEN__).toBe(true);
  });

  it("prefers the configured base path when present", () => {
    window.__OPENCLAW_CONTROL_UI_BASE_PATH__ = "/dashboard/";
    window.history.replaceState({}, "", "/something-else");

    applyAutoGatewayTokenBootstrap("demo-token");

    const expectedKeys = [
      `openclaw.control.token.v1:ws://${window.location.host}/dashboard`,
      `openclaw.control.token.v1:ws://${window.location.host}`,
    ];
    for (const key of expectedKeys) {
      expect(window.sessionStorage.getItem(key)).toBe("demo-token");
    }
  });

  it("injects a single bootstrap script into index.html", () => {
    const source = ["<html>", "  <head>", "  </head>", "  <body></body>", "</html>"].join("\n");

    const firstPass = injectAutoGatewayTokenBootstrap(source, "token-123");
    const secondPass = injectAutoGatewayTokenBootstrap(firstPass, "token-123");

    expect(firstPass).toContain("data-openclaw-auto-token-bootstrap");
    expect(firstPass).toContain("./assets/runtime/branding/auto-token-preboot.js");
    expect(firstPass).toContain('data-gateway-token="token-123"');
    expect(secondPass.match(/data-openclaw-auto-token-bootstrap/g)).toHaveLength(1);
  });

  it("escapes script-breaking token content", () => {
    const source = ["<html>", "  <head>", "  </head>", "  <body></body>", "</html>"].join("\n");

    const result = injectAutoGatewayTokenBootstrap(source, "</script><img>");

    expect(result).not.toContain('data-gateway-token="</script><img>"');
    expect(result).toContain("&lt;/script&gt;&lt;img&gt;");
  });
});
