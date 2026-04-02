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
  it("injects separate platform and tenant links into the sidebar utility group", () => {
    document.body.innerHTML = `<div class="sidebar-utility-group"></div>`;

    bootTenantEntry();
    bootTenantEntry();

    const platformLinks = document.querySelectorAll(".oc-platform-admin-link");
    const tenantLinks = document.querySelectorAll(".oc-tenant-user-link");

    expect(platformLinks).toHaveLength(1);
    expect(platformLinks[0]?.textContent).toContain("平台管理");
    expect(platformLinks[0]?.getAttribute("href")).toContain("ocTenantView=platform-login");

    expect(tenantLinks).toHaveLength(1);
    expect(tenantLinks[0]?.textContent).toContain("租户登录");
    expect(tenantLinks[0]?.getAttribute("href")).toContain("ocTenantView=tenant-login");
  });
});
