function cloneInitialState(initialState) {
  if (!initialState || typeof initialState !== "object") {
    return {
      currentSession: null,
      currentRole: null,
      currentTenantView: null,
      selectedTenantAgent: null,
      shellReady: {
        sidebar: false,
        topbar: false,
        breadcrumb: false,
        content: false,
      },
    };
  }
  return {
    currentSession: initialState.currentSession ?? null,
    currentRole: initialState.currentRole ?? null,
    currentTenantView: initialState.currentTenantView ?? null,
    selectedTenantAgent: initialState.selectedTenantAgent ?? null,
    shellReady: {
      sidebar: Boolean(initialState.shellReady?.sidebar),
      topbar: Boolean(initialState.shellReady?.topbar),
      breadcrumb: Boolean(initialState.shellReady?.breadcrumb),
      content: Boolean(initialState.shellReady?.content),
    },
  };
}

export function createTenantRuntimeStore(initialState) {
  const baselineState = cloneInitialState(initialState);
  let state = baselineState;
  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(nextOrUpdater) {
    const nextState =
      typeof nextOrUpdater === "function" ? nextOrUpdater(state) : nextOrUpdater;
    if (nextState === state) {
      return state;
    }
    state = nextState;
    listeners.forEach((listener) => {
      listener(state);
    });
    return state;
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function resetForTests() {
    state = cloneInitialState(baselineState);
  }

  return {
    getState,
    setState,
    subscribe,
    resetForTests,
  };
}
