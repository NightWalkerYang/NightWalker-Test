/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vitest";
import { bootBrandReplacer } from "../../../tools/openclaw-control-ui-echarts/runtime/branding/brand-replacer.js";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.title = "";
  delete window.__openclawBrandReplacerBooted;
});

describe("zero-intrusive brand replacer", () => {
  it("replaces visible OpenClaw text and swaps logo images for SPTC text chips", async () => {
    document.head.innerHTML = `
      <title>OpenClaw</title>
      <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
      <link rel="apple-touch-icon" sizes="180x180" href="./apple-touch-icon.png" />
    `;
    document.body.innerHTML = `
      <div class="sidebar-brand">
        <img class="sidebar-brand__logo" src="favicon.svg" alt="OpenClaw" />
        <span class="sidebar-brand__title">OpenClaw</span>
      </div>
      <div class="login-gate__header">
        <img class="login-gate__logo" src="favicon.svg" alt="OpenClaw" />
        <div class="login-gate__title">OpenClaw</div>
      </div>
      <div class="agent-chat__avatar agent-chat__avatar--logo"><img src="favicon.svg" alt="OpenClaw" /></div>
      <span class="agent-chat__badge"><img src="favicon.svg" alt="" />Ready to chat</span>
    `;

    bootBrandReplacer();
    await Promise.resolve();

    expect(document.title).toBe("苏博泰克");
    expect(document.body.textContent).toContain("苏博泰克");
    expect(document.querySelector('link[rel="icon"]')?.getAttribute("href")).toContain(
      "data:image/svg+xml",
    );
    expect(document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href")).toContain(
      "data:image/svg+xml",
    );
    expect(document.querySelector(".sidebar-brand__logo")).toBeNull();
    expect(document.querySelector(".login-gate__logo")).toBeNull();
    expect(document.querySelector(".agent-chat__badge img")).toBeNull();
    expect(document.querySelector(".oc-text-logo--sidebar")?.textContent).toBe("SPTC");
    expect(document.querySelector(".oc-text-logo--login")?.textContent).toBe("SPTC");
    expect(document.querySelector(".agent-chat__avatar--logo .oc-text-logo--hero")?.textContent).toBe(
      "SPTC",
    );
    expect(document.querySelector(".agent-chat__badge .oc-text-logo--badge")?.textContent).toBe(
      "SPTC",
    );
  });
});
