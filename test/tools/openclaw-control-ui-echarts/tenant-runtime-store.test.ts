import { describe, expect, it, vi } from "vitest";
import {
  createTenantRuntimeStore,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/runtime-store.js";

function createInitialState() {
  return {
    currentSession: {
      token: "tenant-token",
      role: "tenant_admin",
    },
    currentRole: "tenant_admin",
    currentTenantView: "tenant-members",
    selectedTenantAgent: {
      id: "tenant-agent-1",
      name: "Agent One",
    },
    shellReady: {
      sidebar: false,
      topbar: false,
      breadcrumb: false,
      content: false,
    },
  };
}

describe("tenant runtime store", () => {
  it("reads the initial state", () => {
    const initialState = createInitialState();
    const store = createTenantRuntimeStore(initialState);

    expect(store.getState()).toEqual(initialState);
  });

  it("updates state through direct values and updater functions", () => {
    const store = createTenantRuntimeStore(createInitialState());

    store.setState({
      ...store.getState(),
      currentTenantView: "tenant-usage-stats",
    });
    store.setState((state) => ({
      ...state,
      shellReady: {
        ...state.shellReady,
        sidebar: true,
      },
    }));

    expect(store.getState().currentTenantView).toBe("tenant-usage-stats");
    expect(store.getState().shellReady.sidebar).toBe(true);
  });

  it("notifies subscribers when state changes", () => {
    const store = createTenantRuntimeStore(createInitialState());
    const listener = vi.fn();

    store.subscribe(listener);
    store.setState((state) => ({
      ...state,
      currentRole: "member",
    }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(store.getState());
  });

  it("does not notify subscribers when state does not change", () => {
    const store = createTenantRuntimeStore(createInitialState());
    const listener = vi.fn();
    const snapshot = store.getState();

    store.subscribe(listener);
    store.setState(snapshot);
    store.setState(() => snapshot);

    expect(listener).not.toHaveBeenCalled();
  });

  it("resets state for tests", () => {
    const initialState = createInitialState();
    const store = createTenantRuntimeStore(initialState);

    store.setState((state) => ({
      ...state,
      currentRole: "member",
      currentTenantView: "tenant-agent-selector",
      shellReady: {
        ...state.shellReady,
        content: true,
      },
    }));

    store.resetForTests();

    expect(store.getState()).toEqual(initialState);
  });
});
