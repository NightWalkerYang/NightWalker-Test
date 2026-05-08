import JSON5 from "json5";
import { describe, expect, it } from "vitest";
import {
  parseImageUploadPayload,
} from "../../../tools/openclaw-control-ui-echarts/runtime/image-upload/parser.js";

function parse(raw: string) {
  return parseImageUploadPayload(raw, JSON5);
}

describe("image-upload parser", () => {
  it("parses minimal multi-slot payload under Echarts", () => {
    const payload = parse(String.raw`{
  title: "上传官网素材",
  targetDir: "Echarts/assets",
  slots: [
    { id: "logo", label: "Logo", path: "logo.png", required: true },
    { id: "hero", label: "主页图片", path: "hero-banner.jpg" }
  ]
}`);

    expect(payload.targetDir).toBe("Echarts/assets");
    expect(payload.slots).toHaveLength(2);
    expect(payload.slots[0]).toMatchObject({
      id: "logo",
      label: "Logo",
      path: "logo.png",
      workspacePath: "Echarts/assets/logo.png",
      required: true,
    });
  });

  it("rejects non-Echarts targetDir", () => {
    expect(() =>
      parse(String.raw`{
  targetDir: "assets",
  slots: [{ id: "logo", label: "Logo", path: "logo.png" }]
}`),
    ).toThrow("targetDir 必须落在 Echarts/ 目录下。");
  });

  it("rejects path traversal in slot path", () => {
    expect(() =>
      parse(String.raw`{
  targetDir: "Echarts/assets",
  slots: [{ id: "logo", label: "Logo", path: "../logo.png" }]
}`),
    ).toThrow("slots[0].path不能包含上级目录(..)。");
  });

  it("rejects unsupported accept types", () => {
    expect(() =>
      parse(String.raw`{
  targetDir: "Echarts/assets",
  slots: [{ id: "logo", label: "Logo", path: "logo.png", accept: ["image/gif"] }]
}`),
    ).toThrow("slot.accept 仅支持 png/jpeg/webp");
  });
});

