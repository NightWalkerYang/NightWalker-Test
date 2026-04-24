/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { resolveDashboardRuntimeUrl } from "../../../tools/openclaw-control-ui-echarts/runtime/dashboard-manifest/renderer.js";

describe("dashboard manifest renderer runtime URL resolution", () => {
  it("falls back to a stable top-level URL when srcdoc-like bases are invalid", () => {
    expect(
      resolveDashboardRuntimeUrl("/assets/vendor/echarts.min.js", [
        "about:srcdoc",
        "https://www.hailstone.cn:18789/echarts-view/?token=test-token",
      ]),
    ).toBe("https://www.hailstone.cn:18789/assets/vendor/echarts.min.js");
  });

  it("keeps already absolute same-origin paths usable when no base can be resolved", () => {
    expect(resolveDashboardRuntimeUrl("/assets/vendor/echarts-gl.min.js", ["about:srcdoc"])).toBe(
      new URL("/assets/vendor/echarts-gl.min.js", window.location.href).href,
    );
  });
});
