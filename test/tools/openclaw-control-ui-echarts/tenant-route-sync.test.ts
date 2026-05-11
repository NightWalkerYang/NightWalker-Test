/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bootTenantRouteSync,
  createTenantRouteDrivenScanner,
  resetTenantRouteSyncForTests,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/route-sync.js";

afterEach(() => {
  resetTenantRouteSyncForTests();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
});

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("tenant route sync", () => {
  it("stops reacting after cleanup and can be created again cleanly", async () => {
    const calls = [];
    const scan = vi.fn(() => {
      calls.push(window.location.href);
    });
    bootTenantRouteSync();

    const cleanup = createTenantRouteDrivenScanner(scan, {
      root: document,
      observeTarget: document.body,
      isRelevantNode(node) {
        return node.classList.contains("watched-node");
      },
    });

    expect(scan).toHaveBeenCalledTimes(1);

    window.history.pushState({}, "", "/?ocTenantView=tenant-members");
    await flush();
    expect(scan).toHaveBeenCalledTimes(2);

    document.body.append(document.createElement("div"));
    await flush();
    expect(scan).toHaveBeenCalledTimes(2);

    const watched = document.createElement("div");
    watched.className = "watched-node";
    document.body.append(watched);
    await flush();
    expect(scan).toHaveBeenCalledTimes(3);

    cleanup();

    window.history.pushState({}, "", "/?ocTenantView=tenant-owned-agents");
    const watchedAfterCleanup = document.createElement("div");
    watchedAfterCleanup.className = "watched-node";
    document.body.append(watchedAfterCleanup);
    await flush();
    expect(scan).toHaveBeenCalledTimes(3);

    const secondScan = vi.fn();
    const secondCleanup = createTenantRouteDrivenScanner(secondScan, {
      root: document,
      observeTarget: document.body,
      isRelevantNode(node) {
        return node.classList.contains("watched-node");
      },
    });

    expect(secondScan).toHaveBeenCalledTimes(1);

    window.history.pushState({}, "", "/?ocTenantView=tenant-wallet");
    await flush();
    expect(secondScan).toHaveBeenCalledTimes(2);

    secondCleanup();
  });
});
