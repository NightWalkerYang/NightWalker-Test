import { describe, expect, it, vi } from "vitest";
import {
  createTenantViewRegistry,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/view-registry.js";

describe("tenant view registry", () => {
  it("creates a registry from registered views", () => {
    const views = [
      {
        id: "tenant-overview",
        match: () => false,
        mount: vi.fn(),
        unmount: vi.fn(),
      },
      {
        id: "tenant-usage-stats",
        match: () => true,
        mount: vi.fn(),
        unmount: vi.fn(),
        sync: vi.fn(),
      },
    ];

    const registry = createTenantViewRegistry(views);

    expect(registry.views).toEqual(views);
  });

  it("rejects duplicate view ids", () => {
    expect(() =>
      createTenantViewRegistry([
        {
          id: "tenant-overview",
          match: () => false,
          mount: vi.fn(),
          unmount: vi.fn(),
        },
        {
          id: "tenant-overview",
          match: () => true,
          mount: vi.fn(),
          unmount: vi.fn(),
        },
      ]),
    ).toThrow("Duplicate tenant view id: tenant-overview");
  });

  it("matches the first registered view whose matcher returns true", () => {
    const context = {
      currentTenantView: "tenant-console",
    };
    const firstMatch = {
      id: "tenant-console",
      match: vi.fn(() => true),
      mount: vi.fn(),
      unmount: vi.fn(),
    };
    const laterMatch = {
      id: "tenant-overview",
      match: vi.fn(() => true),
      mount: vi.fn(),
      unmount: vi.fn(),
    };

    const registry = createTenantViewRegistry([
      {
        id: "tenant-login",
        match: vi.fn(() => false),
        mount: vi.fn(),
        unmount: vi.fn(),
      },
      firstMatch,
      laterMatch,
    ]);

    expect(registry.findMatchingView(context)).toBe(firstMatch);
    expect(firstMatch.match).toHaveBeenCalledWith(context);
    expect(laterMatch.match).not.toHaveBeenCalled();
  });

  it("exposes the registered mount, unmount, and sync contract on matched views", () => {
    const context = {
      currentTenantView: "tenant-overview",
    };
    const mount = vi.fn();
    const unmount = vi.fn();
    const sync = vi.fn();
    const registry = createTenantViewRegistry([
      {
        id: "tenant-overview",
        match: vi.fn(() => true),
        mount,
        unmount,
        sync,
      },
    ]);

    const view = registry.findMatchingView(context);
    expect(view).toBeTruthy();

    view?.mount(context);
    view?.sync?.(context);
    view?.unmount(context);

    expect(mount).toHaveBeenCalledWith(context);
    expect(sync).toHaveBeenCalledWith(context);
    expect(unmount).toHaveBeenCalledWith(context);
  });
});
