function createCleanupBucket() {
  const callbacks = [];
  let cleaned = false;

  function add(callback) {
    if (typeof callback !== "function" || cleaned) {
      return callback;
    }
    callbacks.push(callback);
    return callback;
  }

  function cleanup() {
    if (cleaned) {
      return;
    }
    cleaned = true;
    while (callbacks.length) {
      const callback = callbacks.pop();
      try {
        callback?.();
      } catch {
        // Keep draining remaining teardown callbacks.
      }
    }
  }

  function reset() {
    callbacks.length = 0;
    cleaned = false;
  }

  return {
    add,
    cleanup,
    reset,
  };
}

export function createTenantLifecycle() {
  const bucket = createCleanupBucket();

  function addCleanup(callback) {
    return bucket.add(callback);
  }

  function registerInterval(intervalId) {
    return addCleanup(() => window.clearInterval(intervalId));
  }

  function registerTimeout(timeoutId) {
    return addCleanup(() => window.clearTimeout(timeoutId));
  }

  function registerEventListener(target, type, listener, options) {
    if (typeof target?.addEventListener === "function") {
      target.addEventListener(type, listener, options);
    }
    return addCleanup(() => {
      if (typeof target?.removeEventListener === "function") {
        target.removeEventListener(type, listener, options);
      }
    });
  }

  function registerObserver(observer) {
    return addCleanup(() => observer?.disconnect?.());
  }

  return {
    addCleanup,
    registerInterval,
    registerTimeout,
    registerEventListener,
    registerObserver,
    cleanup: bucket.cleanup,
    resetForTests: bucket.reset,
  };
}
