/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import {
  PLATFORM_TENANT_MANAGEMENT_VIEW,
  PLATFORM_TENANTS_VIEW,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";

describe("tenant context constants", () => {
  it("keeps the legacy platform tenant management view alias", () => {
    expect(PLATFORM_TENANT_MANAGEMENT_VIEW).toBe(PLATFORM_TENANTS_VIEW);
  });
});
