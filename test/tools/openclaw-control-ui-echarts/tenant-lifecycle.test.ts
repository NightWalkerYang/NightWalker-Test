/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from "vitest";
import {
  createTenantLifecycle,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/lifecycle.js";

describe("tenant lifecycle", () => {
  it("registers plain cleanup callbacks", () => {
    const lifecycle = createTenantLifecycle();
    const cleanupA = vi.fn();
    const cleanupB = vi.fn();

    lifecycle.addCleanup(cleanupA);
    lifecycle.addCleanup(cleanupB);

    lifecycle.cleanup();

    expect(cleanupA).toHaveBeenCalledTimes(1);
    expect(cleanupB).toHaveBeenCalledTimes(1);
  });

  it("registers timer, listener, and observer-style teardown callbacks", () => {
    const lifecycle = createTenantLifecycle();
    const clearIntervalSpy = vi.fn();
    const clearTimeoutSpy = vi.fn();
    const listener = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const target = {
      addEventListener,
      removeEventListener,
    };
    const observer = {
      disconnect: vi.fn(),
    };

    lifecycle.registerInterval(11, clearIntervalSpy);
    lifecycle.registerTimeout(22, clearTimeoutSpy);
    lifecycle.registerEventListener(target, "click", listener, { capture: true });
    lifecycle.registerObserver(observer);

    expect(addEventListener).toHaveBeenCalledWith("click", listener, { capture: true });

    lifecycle.cleanup();

    expect(clearIntervalSpy).toHaveBeenCalledWith(11);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(22);
    expect(removeEventListener).toHaveBeenCalledWith("click", listener, { capture: true });
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  it("runs cleanup once even when cleanup is called repeatedly", () => {
    const lifecycle = createTenantLifecycle();
    const cleanup = vi.fn();

    lifecycle.addCleanup(cleanup);

    lifecycle.cleanup();
    lifecycle.cleanup();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("resets cleanup state for tests", () => {
    const lifecycle = createTenantLifecycle();
    const staleCleanup = vi.fn();
    const freshCleanup = vi.fn();

    lifecycle.addCleanup(staleCleanup);
    lifecycle.resetForTests();
    lifecycle.addCleanup(freshCleanup);

    lifecycle.cleanup();

    expect(staleCleanup).not.toHaveBeenCalled();
    expect(freshCleanup).toHaveBeenCalledTimes(1);
  });
});
