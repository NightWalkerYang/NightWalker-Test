/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vitest";
import { bootTenantEntry } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/entry.js";

afterEach(() => {
  document.body.innerHTML = "";
  delete window.__openclawTenantEntryBooted;
});

describe("zero-intrusive tenant entry", () => {
  it("injects a single tenant platform link into the sidebar utility group", () => {
    document.body.innerHTML = `<div class="sidebar-utility-group"></div>`;

    bootTenantEntry();
    bootTenantEntry();

    const links = document.querySelectorAll(".oc-tenant-platform-link");
    expect(links).toHaveLength(1);
    expect(links[0]?.textContent).toContain("租户平台");
    expect(links[0]?.getAttribute("href")).toContain("tenant-login.html");
  });
});

