export function createJson5Loader(vendorBaseUrl) {
  let libraryPromise = null;

  return async function ensureJson5() {
    if (window.JSON5) {
      return { json5: window.JSON5 };
    }

    if (!libraryPromise) {
      libraryPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = new URL("./json5.min.js", vendorBaseUrl).href;
        script.async = true;
        script.setAttribute("data-oc-file-lib", "json5");
        script.addEventListener(
          "load",
          () => {
            if (window.JSON5) {
              resolve({ json5: window.JSON5 });
              return;
            }
            reject(
              new Error(`Loaded ${script.src} but window.JSON5 is unavailable.`),
            );
          },
          { once: true },
        );
        script.addEventListener(
          "error",
          () => {
            reject(new Error(`Failed to load ${script.src}`));
          },
          { once: true },
        );
        document.head.append(script);
      }).catch((error) => {
        libraryPromise = null;
        throw error;
      });
    }

    return libraryPromise;
  };
}
