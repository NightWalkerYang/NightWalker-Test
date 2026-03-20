function normalizeAdapterInput(adaptersInput) {
  if (Array.isArray(adaptersInput)) {
    return adaptersInput.filter(Boolean);
  }
  return adaptersInput ? [adaptersInput] : [];
}

function normalizeLanguageAlias(alias) {
  return String(alias || "")
    .trim()
    .toLowerCase();
}

export function createAdapterRegistry(adaptersInput) {
  const adapters = normalizeAdapterInput(adaptersInput);
  if (adapters.length === 0) {
    throw new Error("At least one fenced-block adapter is required.");
  }

  const adaptersById = new Map();
  const adaptersByLanguage = new Map();

  for (const adapter of adapters) {
    if (!adapter?.id) {
      throw new Error("Each fenced-block adapter must define a stable id.");
    }

    if (adaptersById.has(adapter.id)) {
      throw new Error(`Duplicate fenced-block adapter id: ${adapter.id}`);
    }

    adaptersById.set(adapter.id, adapter);

    for (const alias of adapter.languageAliases || []) {
      const normalizedAlias = normalizeLanguageAlias(alias);
      if (!normalizedAlias) {
        continue;
      }

      const existing = adaptersByLanguage.get(normalizedAlias);
      if (existing && existing.id !== adapter.id) {
        throw new Error(
          `Duplicate fenced-block language alias "${normalizedAlias}" for adapters "${existing.id}" and "${adapter.id}".`,
        );
      }

      adaptersByLanguage.set(normalizedAlias, adapter);
    }
  }

  return {
    adapters,
    combinedStyles: adapters
      .map((adapter) => adapter.getStyles?.() ?? "")
      .filter(Boolean)
      .join("\n"),
    getAdapterById(id) {
      return adaptersById.get(String(id || "").trim()) || null;
    },
    getAdapterByLanguage(language) {
      return adaptersByLanguage.get(normalizeLanguageAlias(language)) || null;
    },
  };
}
