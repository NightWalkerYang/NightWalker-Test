export function createLibraryLoader(vendorBaseUrl) {
  const libraryPromiseByKey = new Map();

  function loadScriptOnce(key, url, globalName) {
    if (window[globalName]) {
      return Promise.resolve(window[globalName]);
    }

    const existingPromise = libraryPromiseByKey.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url.href;
      script.async = true;
      script.setAttribute("data-oc-echarts-lib", key);
      script.addEventListener(
        "load",
        () => {
          if (window[globalName]) {
            resolve(window[globalName]);
            return;
          }
          reject(
            new Error(`Loaded ${url.href} but window.${globalName} is unavailable.`),
          );
        },
        { once: true },
      );
      script.addEventListener(
        "error",
        () => {
          reject(new Error(`Failed to load ${url.href}`));
        },
        { once: true },
      );
      document.head.append(script);
    }).catch((error) => {
      libraryPromiseByKey.delete(key);
      throw error;
    });

    libraryPromiseByKey.set(key, promise);
    return promise;
  }

  return async function ensureLibraries() {
    const echarts = await loadScriptOnce(
      "echarts",
      new URL("./echarts.min.js", vendorBaseUrl),
      "echarts",
    );
    const json5 = await loadScriptOnce(
      "json5",
      new URL("./json5.min.js", vendorBaseUrl),
      "JSON5",
    );
    return { echarts, json5 };
  };
}
