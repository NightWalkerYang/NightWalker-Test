import JSON5 from "json5";
import { describe, expect, it } from "vitest";
import {
  parseEchartsPayload,
  resolveChartHeight,
} from "../../../tools/openclaw-control-ui-echarts/runtime/echarts/parser.js";

class FakeLinearGradient {
  args: unknown[];

  constructor(...args: unknown[]) {
    this.args = args;
  }
}

class FakeRadialGradient {
  args: unknown[];

  constructor(...args: unknown[]) {
    this.args = args;
  }
}

const fakeEcharts = {
  graphic: {
    LinearGradient: FakeLinearGradient,
    RadialGradient: FakeRadialGradient,
  },
};

function parse(raw: string, echarts = fakeEcharts) {
  return parseEchartsPayload(raw, JSON5, echarts);
}

function fenced(language: string, body: string) {
  return ["```" + language, body, "```"].join("\n");
}

describe("zero-intrusive echarts parser", () => {
  it("parses the malformed balance-top10 chart from a fenced echarts block", () => {
    const payload = parse(
      fenced(
        "echarts",
        String.raw`{
  "title": { "text": "禄丰市财政局往来余额TOP10", "left": "center" },
  "tooltip": { "trigger": "axis", "axisPointer": { "type": "shadow" },
  "xAxis": { "type": "value", "name": "期末余额(万元)" },
  "yAxis": { "type": "category", "data": ["禄丰国控", "云南元通水务", "康养医疗", "市开发投资", "基础设施", "国投教育", "鑫龙农业", "龙城农业", "金禾实业", "创新开发"].reverse() },
  "series": [{ "type": "bar", "data": [-32094, -28168, -3962, -3619, -2010, -905, -1083, -1030, -575, -561].reverse(), "label": { "show": true, "position": "right" }],
  "grid": { "left": "15%", "right": "10%" }
}`,
      ),
    );

    expect(payload.option.title).toEqual({
      text: "禄丰市财政局往来余额TOP10",
      left: "center",
    });
    expect(payload.option.tooltip).toEqual({
      trigger: "axis",
      axisPointer: { type: "shadow" },
    });
    expect(payload.option.yAxis.data.slice(0, 3)).toEqual(["创新开发", "金禾实业", "龙城农业"]);
    expect(payload.option.series[0].data.slice(0, 3)).toEqual([-561, -575, -1030]);
    expect(payload.option.series[0].label).toEqual({ show: true, position: "right" });
  });

  it("accepts wrappers like const option, comments, trailing commas, and json5 keys", () => {
    const payload = parse(
      fenced(
        "echarts-option",
        String.raw`const option = {
  title: { text: 'Weekly revenue' },
  tooltip: { trigger: 'axis' }, // trailing line comment
  xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed',], },
  yAxis: { type: 'value' },
  series: [
    { type: 'line', smooth: true, data: [12, 20, 18,], },
  ],
};`,
      ),
    );

    expect(payload.option.title.text).toBe("Weekly revenue");
    expect(payload.option.tooltip.trigger).toBe("axis");
    expect(payload.option.xAxis.data).toEqual(["Mon", "Tue", "Wed"]);
    expect(payload.option.series[0]).toMatchObject({
      type: "line",
      smooth: true,
      data: [12, 20, 18],
    });
  });

  it("accepts export default with a parenthesized object", () => {
    const payload = parse(
      fenced(
        "chart",
        String.raw`export default ({
  title: { text: "Inventory" },
  xAxis: { type: "category", data: ["A", "B"] },
  yAxis: { type: "value" },
  series: [{ type: "bar", data: [4, 9] }]
})`,
      ),
    );

    expect(payload.option.title.text).toBe("Inventory");
    expect(payload.option.series[0].data).toEqual([4, 9]);
  });

  it("unwraps option payload envelopes and clamps height overrides", () => {
    const payload = parse(String.raw`{
  option: {
    title: { text: "Wrapped" },
    series: [{ type: "pie", data: [{ value: 3, name: "A" }] }]
  },
  height: 1200
}`);

    expect(payload.option.title.text).toBe("Wrapped");
    expect(payload.heightOverride).toBe(960);
    expect(resolveChartHeight(payload)).toBe(960);
  });

  it("reverses nested array expressions and supports chained reverse calls", () => {
    const payload = parse(String.raw`{
  xAxis: { type: "category", data: [["Q1", "North"], ["Q2", "South"]].reverse().reverse() },
  yAxis: { type: "value" },
  series: [{ type: "heatmap", data: [[1, 2], [3, 4]].reverse() }]
}`);

    expect(payload.option.xAxis.data).toEqual([
      ["Q1", "North"],
      ["Q2", "South"],
    ]);
    expect(payload.option.series[0].data).toEqual([
      [3, 4],
      [1, 2],
    ]);
  });

  it("preserves literal strings that merely mention function bodies or reverse expressions", () => {
    const payload = parse(String.raw`{
  title: { text: "function (x) { return x; } and [1, 2].reverse() are literal text" },
  xAxis: { type: "category", data: ["A"] },
  yAxis: { type: "value" },
  series: [{ type: "bar", data: [1] }]
}`);

    expect(payload.option.title.text).toBe(
      "function (x) { return x; } and [1, 2].reverse() are literal text",
    );
  });

  it("creates a generic tooltip formatter fallback from function syntax", () => {
    const payload = parse(String.raw`{
  tooltip: {
    formatter: function (params) {
      return params[0].name;
    }
  },
  xAxis: { type: "category", data: ["Q1"] },
  yAxis: { type: "value" },
  series: [{ type: "bar", name: "Revenue", data: [12] }]
}`);

    expect(typeof payload.option.tooltip.formatter).toBe("function");
    expect(
      payload.option.tooltip.formatter([
        {
          axisValueLabel: "Q1",
          seriesName: "Revenue",
          value: 12,
          marker: "<span></span>",
        },
      ]),
    ).toBe("Q1<br/><span></span>Revenue: 12");
  });

  it("compiles supported symbolSize fallback functions", () => {
    const payload = parse(String.raw`{
  series: [
    {
      type: "scatter",
      symbolSize: function (value) { return value[2] * 4; },
      data: [[10, 20, 3]]
    },
    {
      type: "scatter",
      symbolSize: function (row) { return 100 / row[1]; },
      data: [[8, 5]]
    }
  ]
}`);

    expect(payload.option.series[0].symbolSize([10, 20, 3])).toBe(12);
    expect(payload.option.series[1].symbolSize([8, 5])).toBe(20);
  });

  it("drops unsupported callback properties instead of failing the whole parse", () => {
    const payload = parse(String.raw`{
  series: [
    {
      type: "custom",
      renderItem: function () {
        return { type: "rect" };
      },
      data: [1, 2, 3]
    }
  ]
}`);

    expect(payload.option.series[0]).toEqual({
      type: "custom",
      data: [1, 2, 3],
    });
  });

  it("materializes echarts.graphic constructors with parsed arguments", () => {
    const payload = parse(
      String.raw`{
  xAxis: { type: "category", data: ["Mon", "Tue"] },
  yAxis: { type: "value" },
  series: [{
    type: "bar",
    data: [12, 19],
    itemStyle: {
      color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: "#dbeafe" },
        { offset: 1, color: "#1d4ed8" }
      ])
    }
  }]
}`,
    );

    expect(payload.option.series[0].itemStyle.color).toBeInstanceOf(FakeLinearGradient);
    expect(payload.option.series[0].itemStyle.color.args).toEqual([
      0,
      0,
      0,
      1,
      [
        { offset: 0, color: "#dbeafe" },
        { offset: 1, color: "#1d4ed8" },
      ],
    ]);
  });

  it("accepts a return wrapper around a complete option object", () => {
    const payload = parse(String.raw`return {
  title: { text: "Returned option" },
  xAxis: { type: "category", data: ["One", "Two"] },
  yAxis: { type: "value" },
  series: [{ type: "bar", data: [7, 11] }]
};`);

    expect(payload.option.title.text).toBe("Returned option");
    expect(payload.option.series[0].data).toEqual([7, 11]);
  });

  it("keeps multi-line comments and block comments from breaking object parsing", () => {
    const payload = parse(String.raw`{
  /* summary block */
  title: { text: "Commented chart" },
  xAxis: {
    type: "category",
    data: [
      "North", // region 1
      "South"
    ]
  },
  yAxis: { type: "value" },
  series: [{ type: "bar", data: [21, 34] }]
}`);

    expect(payload.option.xAxis.data).toEqual(["North", "South"]);
    expect(payload.option.series[0].data).toEqual([21, 34]);
  });

  it("repairs data item objects that omit trailing braces before sibling items", () => {
    const payload = parse(
      fenced(
        "echarts",
        String.raw`{
  "title": { "text": "主要公司资产负债率对比", "left": "center" },
  "tooltip": { "trigger": "axis", "formatter": "{b}: {c}%" },
  "xAxis": {
    "type": "category",
    "data": ["国控集团", "资源建投", "国投运营"]
  },
  "yAxis": { "type": "value", "name": "资产负债率(%)", "max": 200 },
  "series": [{
    "name": "资产负债率",
    "data": [
      {"value": 100.02, "itemStyle": {"color": "#e74c3c"},
      {"value": 142.06, "itemStyle": {"color": "#e74c3c"},
      {"value": 70.71, "itemStyle": {"color": "#f39c12"}
    ],
    "type": "bar"
  }]
}`,
      ),
    );

    expect(payload.option.series[0].data).toEqual([
      { value: 100.02, itemStyle: { color: "#e74c3c" } },
      { value: 142.06, itemStyle: { color: "#e74c3c" } },
      { value: 70.71, itemStyle: { color: "#f39c12" } },
    ]);
  });

  it("extracts a chart option object from noisy wrapper text and smart quotes", () => {
    const payload = parse(String.raw`说明：图表如下
echarts {
  “title”: { “text”: “资产负债率趋势” },
  “xAxis”: { “type”: “category”, “data”: [“Q1”, “Q2”,] },
  “yAxis”: { “type”: “value” },
  “series”: [{ “type”: “line”, “data”: [12, 15,], }],
}
结束`);

    expect(payload.option.title.text).toBe("资产负债率趋势");
    expect(payload.option.xAxis.data).toEqual(["Q1", "Q2"]);
    expect(payload.option.series[0].data).toEqual([12, 15]);
  });
});
