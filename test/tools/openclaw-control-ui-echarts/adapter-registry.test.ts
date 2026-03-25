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
    ]);

    expect(registry.getAdapterBySourcePrefix("file /home/node/.openclaw/workspace/report.xlsx")).toMatchObject({
      id: "file",
    });
    expect(registry.getAdapterBySourcePrefix("download https://example.com/report.xlsx")).toMatchObject(
      { id: "file" },
    );
    expect(registry.getAdapterBySourcePrefix("{\"title\":\"plain json\"}")).toBeNull();
  });
});
