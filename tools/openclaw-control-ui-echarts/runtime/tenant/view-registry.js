function normalizeViewsInput(viewsInput) {
  if (Array.isArray(viewsInput)) {
    return viewsInput.filter(Boolean);
  }
  return viewsInput ? [viewsInput] : [];
}

export function createTenantViewRegistry(viewsInput) {
  const views = normalizeViewsInput(viewsInput);
  const viewsById = new Map();

  for (const view of views) {
    if (!view?.id) {
      throw new Error("Each tenant view must define a stable id.");
    }
    if (typeof view.match !== "function") {
      throw new Error(`Tenant view "${view.id}" must define a match(context) function.`);
    }
    if (typeof view.mount !== "function") {
      throw new Error(`Tenant view "${view.id}" must define a mount(context) function.`);
    }
    if (typeof view.unmount !== "function") {
      throw new Error(`Tenant view "${view.id}" must define an unmount(context) function.`);
    }
    if (viewsById.has(view.id)) {
      throw new Error(`Duplicate tenant view id: ${view.id}`);
    }
    viewsById.set(view.id, view);
  }

  return {
    views,
    getViewById(id) {
      return viewsById.get(String(id || "").trim()) || null;
    },
    findMatchingView(context) {
      for (const view of views) {
        if (view.match(context)) {
          return view;
        }
      }
      return null;
    },
  };
}
