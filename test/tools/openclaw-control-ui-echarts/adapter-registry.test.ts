import { describe, expect, it } from "vitest";
import { createAdapterRegistry } from "../../../tools/openclaw-control-ui-echarts/runtime/framework/adapter-registry.js";

describe("fenced-block adapter registry", () => {
  it("routes compact single-line prefixes to the matching adapter", () => {
    const registry = createAdapterRegistry([
      {
        id: "file",
        languageAliases: new Set(["file", "download"]),
      },
      {
        id: "echarts",
        languageAliases: new Set(["echarts"]),
      },
      {
        id: "select",
        languageAliases: new Set(["single-select", "multi-select"]),
      },
    ]);

    expect(registry.getAdapterBySourcePrefix("file /home/node/.openclaw/workspace/report.xlsx")).toMatchObject({
      id: "file",
    });
    expect(registry.getAdapterBySourcePrefix("download https://example.com/report.xlsx")).toMatchObject(
      { id: "file" },
    );
    expect(
      registry.getAdapterBySourcePrefix("single-select { options: [{ value: 'red', label: '红色' }] }"),
    ).toMatchObject({ id: "select" });
    expect(
      registry.getAdapterBySourcePrefix("multi-select { options: [{ value: 'blue', label: '蓝色' }] }"),
    ).toMatchObject({ id: "select" });
    expect(registry.getAdapterBySourcePrefix("{\"title\":\"plain json\"}")).toBeNull();
  });
});
