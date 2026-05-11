export function createTenantViewRegistry(viewsInput) {
  const views = viewsInput.slice();
  const viewsById = new Map();

  for (const view of views) {
    if (viewsById.has(view.id)) {
      throw new Error(`Duplicate tenant view id: ${view.id}`);
    }
    viewsById.set(view.id, view);
  }

  return {
    views,
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
