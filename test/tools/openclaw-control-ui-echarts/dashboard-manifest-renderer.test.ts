/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  renderDashboardManifest,
  resolveDashboardRuntimeUrl,
} from "../../../tools/openclaw-control-ui-echarts/runtime/dashboard-manifest/renderer.js";

const testGlobal = globalThis as typeof globalThis & {
  echarts?: {
    getInstanceByDom?: (container: HTMLElement) => unknown;
    init?: (container: HTMLElement) => {
      setOption: (option: unknown) => void;
      resize: () => void;
      dispose: () => void;
    };
  };
  __ocDashboardManifestScriptCache?: unknown;
  fetch?: typeof fetch;
};

function installLoadedVendorScript(pathname) {
  const script = document.createElement("script");
  script.src = new URL(pathname, window.location.href).href;
  script.dataset.ocDashboardLoaded = "true";
  document.head.append(script);
}

function clearDashboardRuntimeArtifacts(root) {
  if (!(root instanceof HTMLElement)) {
    return;
  }
  const runtimeRoot = root as HTMLElement & {
    __ocDashboardManifestRuntimeState?: {
      clockTimer?: number;
    };
  };
  const state = runtimeRoot.__ocDashboardManifestRuntimeState;
  if (state?.clockTimer) {
    window.clearInterval(state.clockTimer);
  }
  delete runtimeRoot.__ocDashboardManifestRuntimeState;
  delete root.dataset.ocDashboardSceneFallback;
}

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  delete testGlobal.__ocDashboardManifestScriptCache;
  delete testGlobal.echarts;
  delete testGlobal.fetch;
  vi.restoreAllMocks();
});

describe("dashboard manifest renderer runtime URL resolution", () => {
  it("falls back to a stable top-level URL when srcdoc-like bases are invalid", () => {
    expect(
      resolveDashboardRuntimeUrl("/assets/vendor/echarts.min.js", [
        "about:srcdoc",
        "https://www.hailstone.cn:18789/echarts-view/?token=test-token",
      ]),
    ).toBe("https://www.hailstone.cn:18789/assets/vendor/echarts.min.js");
  });

  it("keeps already absolute same-origin paths usable when no base can be resolved", () => {
    expect(resolveDashboardRuntimeUrl("/assets/vendor/echarts-gl.min.js", ["about:srcdoc"])).toBe(
      new URL("/assets/vendor/echarts-gl.min.js", window.location.href).href,
    );
  });

  it("falls back to a compatible scene and skips fetching embedded object data sources", async () => {
    installLoadedVendorScript("/assets/vendor/echarts.min.js");
    installLoadedVendorScript("/assets/vendor/echarts-gl.min.js");
    installLoadedVendorScript("/assets/vendor/gsap.min.js");

    const root = document.createElement("div");
    document.body.append(root);

    const fetchMock = vi.fn();
    testGlobal.fetch = fetchMock as typeof fetch;

    const liveInstances = new Map();
    const setOptionCalls = [];
    testGlobal.echarts = {
      getInstanceByDom(container) {
        return liveInstances.get(container) || null;
      },
      init(container) {
        const chart = {
          setOption(option) {
            setOptionCalls.push(option);
            if (setOptionCalls.length === 1) {
              throw new Error("Invalid expression.");
            }
          },
          resize() {},
          dispose() {
            liveInstances.delete(container);
          },
        };
        liveInstances.set(container, chart);
        return chart;
      },
    };

    const normalized = await renderDashboardManifest({
      root,
      manifest: {
        version: 1,
        title: "禄丰国控财务大屏",
        particles: false,
        dataSource: {
          type: "embedded",
          company: "禄丰国控",
          period: "202603",
        },
        scene: {
          type: "capital-reactor",
        },
      },
      context: {
        workspaceBaseHref: "/workspace-agent-downloads/tenant-agent-1/Echarts/",
      },
    });

    expect(normalized.title).toBe("禄丰国控财务大屏");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(root.dataset.ocDashboardSceneFallback).toBe("compatible-3d");
    expect(setOptionCalls.length).toBeGreaterThanOrEqual(2);
    clearDashboardRuntimeArtifacts(root);
  });

  it("applies layout variables and block-driven shell metadata for manifest edits", async () => {
    installLoadedVendorScript("/assets/vendor/echarts.min.js");
    installLoadedVendorScript("/assets/vendor/echarts-gl.min.js");
    installLoadedVendorScript("/assets/vendor/gsap.min.js");

    const root = document.createElement("div");
    document.body.append(root);

    const liveInstances = new Map();
    testGlobal.echarts = {
      getInstanceByDom(container) {
        return liveInstances.get(container) || null;
      },
      init(container) {
        const chart = {
          setOption() {},
          resize() {},
          dispose() {
            liveInstances.delete(container);
          },
        };
        liveInstances.set(container, chart);
        return chart;
      },
    };

    const normalized = await renderDashboardManifest({
      root,
      manifest: {
        version: 1,
        title: "布局编辑驾驶舱",
        styleProfile: "cinematic-finance",
        density: "compact",
        motion: "off",
        particles: false,
        layout: {
          shellGap: 30,
          shellPadding: { top: 12, right: 16, bottom: 20, left: 18 },
          leftColumnMin: 250,
          leftColumnMax: 300,
          footerWeights: {
            timeline: 1.8,
            alerts: 0.7,
          },
          cardMode: "solid",
        },
        blocks: {
          rightTop: { visible: false },
          rightBottom: { visible: false },
          scene: { kicker: "DATA CORE" },
          timeline: { weight: 1.8 },
          alerts: { weight: 0.7 },
        },
        metrics: [
          { label: "营收", value: 18.6, unit: "亿元" },
          { label: "利润", value: 3.2, unit: "亿元" },
        ],
        charts: {
          leftTop: {
            type: "line",
            categories: ["1月", "2月"],
            series: [{ name: "营收", data: [16, 18.6] }],
          },
          leftBottom: {
            type: "bar",
            categories: ["投资", "成本"],
            series: [{ name: "金额", data: [12, 9] }],
          },
        },
      },
    });

    expect(normalized.motion.level).toBe("off");
    expect(root.style.getPropertyValue("--oc-dashboard-shell-gap")).toBe("30px");
    expect(root.style.getPropertyValue("--oc-dashboard-shell-padding")).toBe("12px 16px 20px 18px");
    expect(root.style.getPropertyValue("--oc-dashboard-main-columns")).toBe(
      "minmax(250px, 300px) minmax(0, 1fr)",
    );
    expect(root.style.getPropertyValue("--oc-dashboard-footer-columns")).toBe("1.8fr 0.7fr");
    expect(document.documentElement.style.getPropertyValue("--oc-dashboard-shell-gap")).toBe(
      "30px",
    );

    const shell = root.querySelector(".oc-dashboard-shell");
    expect(shell?.getAttribute("data-style-profile")).toBe("cinematic-finance");
    expect(shell?.getAttribute("data-density")).toBe("compact");
    expect(shell?.getAttribute("data-motion")).toBe("off");
    expect(shell?.getAttribute("data-card-mode")).toBe("solid");
    expect(root.innerHTML).toContain("DATA CORE");
    expect(root.innerHTML).not.toContain('data-block-id="right-top"');
    expect(root.innerHTML).not.toContain('data-block-id="right-bottom"');

    clearDashboardRuntimeArtifacts(root);
  });
});
