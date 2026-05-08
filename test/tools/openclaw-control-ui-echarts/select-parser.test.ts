import JSON5 from "json5";
import { describe, expect, it } from "vitest";
import {
  detectSelectMode,
  parseSelectPayload,
} from "../../../tools/openclaw-control-ui-echarts/runtime/select/parser.js";

function parse(raw: string, mode: "single" | "multi") {
  return parseSelectPayload(raw, JSON5, mode);
}

function fenced(language: string, body: string) {
  return ["```" + language, body, "```"].join("\n");
}

describe("zero-intrusive select parser", () => {
  it("detects single-select and multi-select modes from fenced language aliases", () => {
    expect(detectSelectMode("{}", "single-select")).toBe("single");
    expect(detectSelectMode("{}", "radio")).toBe("single");
    expect(detectSelectMode("{}", "multi-select")).toBe("multi");
    expect(detectSelectMode("{}", "checkbox")).toBe("multi");
  });

  it("parses a single-select payload with object options", () => {
    const payload = parse(
      fenced(
        "single-select",
        String.raw`{
  title: "下一步怎么做？",
  description: "请选择一个方向。",
  submitLabel: "按所选继续",
  defaultValue: "theme-red",
  options: [
    {
      value: "theme-red",
      label: "把界面优化成红色",
      description: "统一主色和强调色",
      prompt: "把界面优化成红色，统一主色和强调色。"
    },
    {
      value: "theme-blue",
      label: "把界面优化成蓝色"
    }
  ]
}`,
      ),
      "single",
    );

    expect(payload).toMatchObject({
      kind: "single",
      title: "下一步怎么做？",
      description: "请选择一个方向。",
      submitLabel: "按所选继续",
      defaultValue: "theme-red",
      options: [
        expect.objectContaining({
          value: "theme-red",
          label: "把界面优化成红色",
          description: "统一主色和强调色",
          prompt: "把界面优化成红色，统一主色和强调色。",
        }),
        expect.objectContaining({
          value: "theme-blue",
          label: "把界面优化成蓝色",
        }),
      ],
    });
  });

  it("parses a multi-select payload with defaults and min/max constraints", () => {
    const payload = parse(
      fenced(
        "multi-select",
        String.raw`{
  title: "下一步处理哪些项？",
  minSelected: 1,
  maxSelected: 2,
  defaultValues: ["theme-red", "tight-spacing", "theme-red"],
  options: [
    "改成红色主题",
    {
      value: "tight-spacing",
      label: "收紧页面间距",
      prompt: "把页面间距收紧，让信息密度更高。"
    },
    {
      value: "improve-contrast",
      label: "增强按钮和文字对比度",
      disabled: true
    }
  ]
}`,
      ),
      "multi",
    );

    expect(payload.kind).toBe("multi");
    expect(payload.minSelected).toBe(1);
    expect(payload.maxSelected).toBe(2);
    expect(payload.defaultValues).toEqual(["tight-spacing"]);
    expect(payload.options).toEqual([
      expect.objectContaining({
        value: "改成红色主题",
        label: "改成红色主题",
      }),
      expect.objectContaining({
        value: "tight-spacing",
        label: "收紧页面间距",
      }),
      expect.objectContaining({
        value: "improve-contrast",
        disabled: true,
      }),
    ]);
  });

  it("accepts compact prefix syntax for single-select blocks", () => {
    const payload = parse(
      String.raw`single-select {
  title: "请选择",
  options: [
    { value: "red", label: "红色" },
    { value: "blue", label: "蓝色" }
  ]
}`,
      "single",
    );

    expect(payload.kind).toBe("single");
    expect(payload.options).toHaveLength(2);
  });

  it("normalizes invisible whitespace that can leak from rendered code blocks", () => {
    const payload = parse(
      "{\n\u200b\u200b\"title\": \"请选择\",\n\u00a0\u00a0\"defaultValue\": \"blue\",\n\u202f\u202f\"options\": [\n\u00a0\u00a0\u00a0\u00a0{ \"value\": \"red\", \"label\": \"红色\" },\n\u00a0\u00a0\u00a0\u00a0{ \"value\": \"blue\", \"label\": \"蓝色\" }\n\u00a0\u00a0]\n}",
      "single",
    );

    expect(payload).toMatchObject({
      kind: "single",
      title: "请选择",
      defaultValue: "blue",
      options: [
        expect.objectContaining({ value: "red", label: "红色" }),
        expect.objectContaining({ value: "blue", label: "蓝色" }),
      ],
    });
  });

  it("rejects duplicate option values", () => {
    const payload = parse(
      String.raw`{
  options: [
    { value: "theme-red", label: "红色一" },
    { value: "theme-red", label: "红色二" }
  ]
}`,
      "single",
    );

    expect(payload.options).toHaveLength(1);
    expect(payload.options[0]).toMatchObject({
      value: "theme-red",
      label: "红色一",
    });
  });

  it("accepts noisy wrappers with prefixed chatter and balanced json extraction", () => {
    const payload = parse(
      String.raw`这里是配置，请直接渲染 single-select：
single-select {
  title: "请选择处理方向",
  options: [
    { value: "red", label: "红色方案", },
    { value: "blue", label: "蓝色方案", },
  ],
}
谢谢`,
      "single",
    );

    expect(payload.kind).toBe("single");
    expect(payload.options.map((item) => item.value)).toEqual(["red", "blue"]);
  });

  it("accepts top-level arrays and normalizes them into options", () => {
    const payload = parse(
      String.raw`[
  "方案 A",
  "方案 B",
]`,
      "single",
    );

    expect(payload.options).toHaveLength(2);
    expect(payload.options[0]).toMatchObject({
      value: "方案 A",
      label: "方案 A",
    });
  });

  it("falls back to single mode when mode is unknown", () => {
    const payload = parseSelectPayload(
      String.raw`{
  options: ["保守方案", "激进方案"]
}`,
      JSON5,
      "" as "single",
    );

    expect(payload.kind).toBe("single");
    expect(payload.options).toHaveLength(2);
  });
});
