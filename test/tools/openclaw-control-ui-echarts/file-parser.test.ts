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
      "Absolute file paths must stay inside the workspace.",
    );
  });

  it("rejects multi-line plain text that is not a path payload", () => {
    expect(() =>
      parse(`下载地址如下:
https://files.example.com/a.xlsx`),
    ).toThrow("File blocks must contain one URL or one workspace path.");
  });
});
