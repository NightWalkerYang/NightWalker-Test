/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import {
  buildWorkspaceDownloadUrl,
  createFileAdapter,
} from "../../../tools/openclaw-control-ui-echarts/runtime/file/adapter.js";

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

  it("builds same-origin agent workspace download urls with encoded path segments", () => {
    const url = buildWorkspaceDownloadUrl(
      new URL("https://hailstone.cn:18789/"),
      "subotech-finance/cache/api_cache_202601_1775178974.xlsx",
      "agent-workspace",
    );

    expect(url).toBe(
      "https://hailstone.cn:18789/workspace-agent-downloads/subotech-finance/cache/api_cache_202601_1775178974.xlsx",
    );
  });

  it("renders a single download action for url cards", async () => {
    const { host } = await renderCard("https://files.example.com/export/report.xlsx");
    const labels = [...host.querySelectorAll(".oc-file-card__button")].map((element) =>
      element.textContent?.trim(),
    );

    expect(labels).toEqual(["下载"]);
  });

  it("renders a single download action for workspace path cards", async () => {
    const { host } = await renderCard("/home/node/.openclaw/workspace/output/report.xlsx");
    const labels = [...host.querySelectorAll(".oc-file-card__button")].map((element) =>
      element.textContent?.trim(),
    );

    expect(labels).toEqual(["下载"]);
  });

  it("renders a single download action for agent workspace path cards", async () => {
    const { host } = await renderCard(
      "/home/node/.openclaw/workspace-agents/subotech-finance/cache/company_summary_202601_1775178979.xlsx",
    );
    const labels = [...host.querySelectorAll(".oc-file-card__button")].map((element) =>
      element.textContent?.trim(),
    );

    expect(labels).toEqual(["下载"]);
    expect(host.querySelector(".oc-file-card__path")?.textContent).toBe(
      "subotech-finance/cache/company_summary_202601_1775178979.xlsx",
    );
  });
});

async function renderCard(source: string) {
  const adapter = createFileAdapter({
    vendorBaseUrl: new URL("https://hailstone.cn:18789/assets/vendor/"),
    controlUiRootUrl: new URL("https://hailstone.cn:18789/"),
  });
  const host = document.createElement("div");
  const wrapper = document.createElement("div");

  await adapter.renderContent({
    source,
    wrapper,
    host,
    context: {},
    renderHostScaffold(currentHost) {
      const card = document.createElement("div");
      currentHost.append(card);
      return card;
    },
  });

  return { host, wrapper };
}
