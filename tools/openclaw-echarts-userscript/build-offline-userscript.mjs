import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const templatePath = path.resolve(here, "openclaw-echarts-renderer.template.user.js");
const outputPath = path.resolve(here, "openclaw-echarts-renderer.user.js");
const vendors = [
  {
    token: "__INLINE_ECHARTS_SOURCE__",
    path: path.resolve(here, "vendor", "echarts.min.js"),
  },
  {
    token: "__INLINE_JSON5_SOURCE__",
    path: path.resolve(here, "vendor", "json5.min.js"),
  },
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  let template = await fs.readFile(templatePath, "utf8");

  for (const vendor of vendors) {
    const source = await fs.readFile(vendor.path, "utf8");
    assert(source.trim().length > 0, `Vendor source is empty: ${vendor.path}`);
    template = template.replace(vendor.token, JSON.stringify(source));
  }

  assert(!template.includes("__INLINE_ECHARTS_SOURCE__"), "ECharts placeholder was not replaced.");
  assert(!template.includes("__INLINE_JSON5_SOURCE__"), "JSON5 placeholder was not replaced.");

  await fs.writeFile(outputPath, template, "utf8");
  console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);
}

await main();
