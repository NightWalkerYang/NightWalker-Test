/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTenantLifecycle,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/lifecycle.js";
import {
  createTenantRuntimeStore,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/runtime-store.js";
import {
  createTenantShellCoordinator,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/shell-coordinator.js";

function createContext() {
  return {
    root: document,
  };
}

function createShellMarkup() {
  document.body.innerHTML = `
    <div class="workspace-shell">
      <aside class="sidebar-shell" aria-label="navigation sidebar">
        <a class="nav-item" href="/tenant">Tenant</a>
      </aside>
      <header class="workspace-header">
        <button class="topbar-search" type="button" aria-label="搜索控制台">搜索</button>
        <nav class="dashboard-header__breadcrumb">
          <a href="/">Home</a>
        </nav>
      </header>
      <main class="content--chat">
        <section class="agent-chat__input">
          <textarea aria-label="消息输入"></textarea>
        </section>
      </main>
    </div>
  `;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("tenant shell coordinator", () => {
  it("locates shell anchors through dom compat", () => {
    createShellMarkup();
    const store = createTenantRuntimeStore();
    const lifecycle = createTenantLifecycle();
    const coordinator = createTenantShellCoordinator({
      context: createContext(),
      store,
      lifecycle,
    });

    const anchors = coordinator.resolveAnchors();

    expect(anchors.sidebar).toBe(document.querySelector(".sidebar-shell"));
    expect(anchors.topbar).toBe(document.querySelector(".topbar-search"));
    expect(anchors.breadcrumb).toBe(document.querySelector(".dashboard-header__breadcrumb"));
    expect(anchors.content).toBe(document.querySelector(".content--chat"));
  });

  it("creates and updates shell coordination state for sidebar and topbar readiness", () => {
    createShellMarkup();
    const store = createTenantRuntimeStore();
    const lifecycle = createTenantLifecycle();
    const coordinator = createTenantShellCoordinator({
      context: createContext(),
      store,
      lifecycle,
    });

    expect(store.getState().shellReady).toEqual({
      sidebar: false,
      topbar: false,
      breadcrumb: false,
      content: false,
    });

    const initialState = coordinator.sync();
    expect(initialState.shellReady).toEqual({
      sidebar: true,
      topbar: true,
      breadcrumb: true,
      content: true,
    });

    document.querySelector(".topbar-search")?.remove();

    const nextState = coordinator.sync();
    expect(nextState.shellReady).toEqual({
      sidebar: true,
      topbar: false,
      breadcrumb: true,
      content: true,
    });
  });

  it("cleans up coordinator state and registered teardown behavior", () => {
    createShellMarkup();
    const store = createTenantRuntimeStore();
    const lifecycle = createTenantLifecycle();
    const coordinator = createTenantShellCoordinator({
      context: createContext(),
      store,
      lifecycle,
    });
    const listener = vi.fn();

    store.subscribe(listener);
    coordinator.sync();
    expect(store.getState().shellReady.sidebar).toBe(true);

    coordinator.cleanup();

    expect(store.getState().shellReady).toEqual({
      sidebar: false,
      topbar: false,
      breadcrumb: false,
      content: false,
    });

    listener.mockClear();
    document.querySelector(".sidebar-shell")?.remove();
    coordinator.sync();

    expect(listener).not.toHaveBeenCalled();
    expect(store.getState().shellReady).toEqual({
      sidebar: false,
      topbar: false,
      breadcrumb: false,
      content: false,
    });
  });
});
