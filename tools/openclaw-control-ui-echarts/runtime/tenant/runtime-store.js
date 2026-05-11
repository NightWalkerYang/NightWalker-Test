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

function cloneValue(value) {
  if (value == null || typeof value !== "object") {
    return value ?? null;
  }
  return structuredClone(value);
}

function cloneStateSnapshot(state) {
  return {
    currentSession: cloneValue(state.currentSession),
    currentRole: state.currentRole,
    currentTenantView: state.currentTenantView,
    selectedTenantAgent: cloneValue(state.selectedTenantAgent),
    shellReady: {
      ...state.shellReady,
    },
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object";
}

function isEqualValue(left, right) {
  if (left === right) {
    return true;
  }
  if (!isPlainObject(left) || !isPlainObject(right)) {
    return false;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => isEqualValue(left[key], right[key]));
}

function hasSameStateShape(left, right) {
  return (
    isEqualValue(left.currentSession, right.currentSession) &&
    left.currentRole === right.currentRole &&
    left.currentTenantView === right.currentTenantView &&
    isEqualValue(left.selectedTenantAgent, right.selectedTenantAgent) &&
    left.shellReady.sidebar === right.shellReady.sidebar &&
    left.shellReady.topbar === right.shellReady.topbar &&
    left.shellReady.breadcrumb === right.shellReady.breadcrumb &&
    left.shellReady.content === right.shellReady.content
  );
}

export function createTenantRuntimeStore(initialState) {
  const baselineState = cloneInitialState(initialState);
  let state = cloneStateSnapshot(baselineState);
  const listeners = new Set();

  function getState() {
    return cloneStateSnapshot(state);
  }

  function setState(nextOrUpdater) {
    const nextState =
      typeof nextOrUpdater === "function"
        ? nextOrUpdater(getState())
        : nextOrUpdater;
    const normalizedNextState = cloneInitialState(nextState);
    if (hasSameStateShape(normalizedNextState, state)) {
      return state;
    }
    state = normalizedNextState;
    listeners.forEach((listener) => {
      listener(getState());
    });
    return getState();
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
