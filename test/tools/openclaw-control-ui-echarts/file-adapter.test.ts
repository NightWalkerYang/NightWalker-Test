import { describe, expect, it } from "vitest";
import { buildWorkspaceDownloadUrl } from "../../../tools/openclaw-control-ui-echarts/runtime/file/adapter.js";

describe("file adapter workspace download urls", () => {
  it("builds same-origin workspace download urls with encoded path segments", () => {
    const url = buildWorkspaceDownloadUrl(
      new URL("https://hailstone.cn:18789/"),
      "output/财务分析/项目收支情况统计表.xlsx",
    );

    expect(url).toBe(
      "https://hailstone.cn:18789/workspace-downloads/output/%E8%B4%A2%E5%8A%A1%E5%88%86%E6%9E%90/%E9%A1%B9%E7%9B%AE%E6%94%B6%E6%94%AF%E6%83%85%E5%86%B5%E7%BB%9F%E8%AE%A1%E8%A1%A8.xlsx",
    );
  });

  it("preserves control-ui subpaths when served from a nested base", () => {
    const url = buildWorkspaceDownloadUrl(
      new URL("https://example.com/openclaw/"),
      "报表.xlsx",
    );

    expect(url).toBe(
      "https://example.com/openclaw/workspace-downloads/%E6%8A%A5%E8%A1%A8.xlsx",
    );
  });
});
