/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import {
  PLATFORM_TENANT_MANAGEMENT_ROUTE,
  TENANT_AGENT_SELECTOR_ROUTE,
  TENANT_STATISTICS_OVERVIEW_ROUTE,
  routeForRole,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";

describe("tenant context", () => {
  it("routes tenant admins to the statistics overview home", () => {
    expect(routeForRole("tenant_admin")).toBe(TENANT_STATISTICS_OVERVIEW_ROUTE);
  });

  it("keeps the existing homes for platform admins and members", () => {
    expect(routeForRole("platform_admin")).toBe(PLATFORM_TENANT_MANAGEMENT_ROUTE);
    expect(routeForRole("member")).toBe(TENANT_AGENT_SELECTOR_ROUTE);
  });
});
