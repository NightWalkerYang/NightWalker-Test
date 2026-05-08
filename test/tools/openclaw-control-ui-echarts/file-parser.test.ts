import JSON5 from "json5";
import { describe, expect, it } from "vitest";
import { parseFilePayload } from "../../../tools/openclaw-control-ui-echarts/runtime/file/parser.js";

function parse(raw: string) {
  return parseFilePayload(raw, JSON5);
}

function fenced(language: string, body: string) {
  return ["```" + language, body, "```"].join("\n");
}

describe("zero-intrusive file parser", () => {
  it("parses a plain https download link", () => {
    const payload = parse("https://files.example.com/reports/q1-summary.xlsx");

    expect(payload).toMatchObject({
      kind: "url",
      url: "https://files.example.com/reports/q1-summary.xlsx",
      name: "q1-summary.xlsx",
      extension: "XLSX",
      sourceLabel: "files.example.com",
    });
  });

  it("parses markdown links and keeps the label as the card name", () => {
    const payload = parse("[下载月报](https://cdn.example.com/export/monthly-report.pdf)");

    expect(payload).toMatchObject({
      kind: "url",
      name: "下载月报",
      url: "https://cdn.example.com/export/monthly-report.pdf",
      extension: "PDF",
    });
  });

  it("accepts JSON5-style objects with metadata", () => {
    const payload = parse(
      fenced(
        "file",
        String.raw`{
  name: "科目余额数据示例.xlsx",
  url: "https://hailstone.cn/downloads/%E7%A7%91%E7%9B%AE.xlsx",
  description: "导出的余额明细文件",
  size: 2097152,
}`,
      ),
    );

    expect(payload).toMatchObject({
      kind: "url",
      name: "科目余额数据示例.xlsx",
      description: "导出的余额明细文件",
      sizeLabel: "2 MB",
      sourceLabel: "hailstone.cn",
    });
  });

  it("accepts a plain workspace-relative path with spaces and unicode", () => {
    const payload = parse("output/财务分析/小故事 1774409149.docx");

    expect(payload).toMatchObject({
      kind: "path",
      path: "output/财务分析/小故事 1774409149.docx",
      name: "小故事 1774409149.docx",
      extension: "DOCX",
    });
  });

  it("normalizes absolute container workspace paths to relative paths", () => {
    const payload = parse("/home/node/.openclaw/workspace/output/小故事_1774409149.docx");

    expect(payload).toMatchObject({
      kind: "path",
      path: "output/小故事_1774409149.docx",
      name: "小故事_1774409149.docx",
    });
  });

  it("accepts the compact single-line file prefix syntax from chat output", () => {
    const payload = parse("file /home/node/.openclaw/workspace/项目收支情况统计表.xlsx");

    expect(payload).toMatchObject({
      kind: "path",
      path: "项目收支情况统计表.xlsx",
      name: "项目收支情况统计表.xlsx",
      extension: "XLSX",
    });
  });

  it("normalizes absolute agent workspace paths to agent-relative paths", () => {
    const payload = parse(
      "/home/node/.openclaw/workspace-agents/subotech-finance/cache/api_cache_202601_1775178974.xlsx",
    );

    expect(payload).toMatchObject({
      kind: "path",
      scope: "agent-workspace",
      path: "subotech-finance/cache/api_cache_202601_1775178974.xlsx",
      name: "api_cache_202601_1775178974.xlsx",
      sourceLabel: "agent workspace",
    });
  });

  it("normalizes derived workspace-<agentId> absolute paths to agent-relative paths", () => {
    const payload = parse(
      "/home/node/.openclaw/workspace-tenant-local-finance-a1b2c3/cache/report.xlsx",
    );

    expect(payload).toMatchObject({
      kind: "path",
      scope: "agent-workspace",
      path: "tenant-local-finance-a1b2c3/cache/report.xlsx",
      name: "report.xlsx",
      sourceLabel: "agent workspace",
    });
  });

  it("accepts workspace-agents relative paths", () => {
    const payload = parse(
      "workspace-agents/subotech-finance/cache/company_summary_202601_1775178979.xlsx",
    );

    expect(payload).toMatchObject({
      kind: "path",
      scope: "agent-workspace",
      path: "subotech-finance/cache/company_summary_202601_1775178979.xlsx",
      name: "company_summary_202601_1775178979.xlsx",
    });
  });

  it("normalizes windows and file:// workspace paths to relative paths", () => {
    const windowsPayload = parse(
      String.raw`C:\Users\root-ai\.openclaw\workspace\exports\预算执行\年度汇总.xls`,
    );
    const fileUrlPayload = parse(
      "file:///C:/Users/root-ai/.openclaw/workspace/output/generated/report-final.csv",
    );

    expect(windowsPayload.path).toBe("exports/预算执行/年度汇总.xls");
    expect(fileUrlPayload.path).toBe("output/generated/report-final.csv");
  });

  it("accepts wrapped object payloads that use path fields", () => {
    const payload = parse(
      String.raw`const file = {
  fileName: "往来余额分析.xlsx",
  path: "/srv/runtime/workspace/output/reports/往来余额分析.xlsx",
  hint: "工作区导出文件",
};`,
    );

    expect(payload).toMatchObject({
      kind: "path",
      path: "output/reports/往来余额分析.xlsx",
      name: "往来余额分析.xlsx",
      description: "工作区导出文件",
    });
  });

  it("rejects absolute paths outside the workspace", () => {
    expect(() => parse("/home/root-ai/downloads/top-secret.xlsx")).toThrow(
      "Absolute file paths must stay inside the workspace or agent workspace.",
    );
  });

  it("rejects multi-line plain text that is not a path payload", () => {
    const payload = parse(`下载地址如下:
https://files.example.com/a.xlsx`);

    expect(payload).toMatchObject({
      kind: "url",
      url: "https://files.example.com/a.xlsx",
      name: "a.xlsx",
      extension: "XLSX",
    });
  });

  it("parses noisy payloads that include smart quotes and wrapper text", () => {
    const payload = parse(`说明：这是导出文件
{
  “name”: “资产负债率.xlsx”,
  “url”: “https://files.example.com/export/debt-ratio.xlsx”,
}
请下载`);

    expect(payload).toMatchObject({
      kind: "url",
      name: "资产负债率.xlsx",
      url: "https://files.example.com/export/debt-ratio.xlsx",
      extension: "XLSX",
    });
  });

  it("uses the first valid entry when structured payload is an array", () => {
    const payload = parse(String.raw`[
  { name: "无效", note: "missing url/path" },
  { path: "output/reports/final-summary.csv", name: "final-summary.csv" }
]`);

    expect(payload).toMatchObject({
      kind: "path",
      path: "output/reports/final-summary.csv",
      name: "final-summary.csv",
      extension: "CSV",
    });
  });
});
