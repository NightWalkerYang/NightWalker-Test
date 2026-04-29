let pgClientConstructorPromise = null;

function normalizeSourceType(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function readSourceType(binding) {
  return normalizeSourceType(
    binding?.dataSourceType ?? binding?.sourceType ?? binding?.source_type ?? "",
  );
}

export function isSupportedDataSourceType(value) {
  return normalizeSourceType(value) === "kingdee_analytics";
}

function parseConnectionJson(binding) {
  const value = binding?.connectionJson ?? binding?.connection_json ?? binding?.connection ?? "{}";
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  const normalized = String(value || "").trim();
  if (!normalized) {
    return {};
  }
  try {
    const parsed = JSON.parse(normalized);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("connection_json_invalid");
    }
    return parsed;
  } catch {
    throw new Error("org_directory_unavailable");
  }
}

function mapOrganizationRow(row) {
  return {
    orgId: String(row?.orgId || "").trim(),
    orgNumber: String(row?.orgNumber || "").trim(),
    orgName: String(row?.orgName || "").trim(),
    parentOrgId: String(row?.parentOrgId || "").trim() || null,
    status: String(row?.status || "").trim(),
  };
}

async function getPgClientConstructor() {
  if (!pgClientConstructorPromise) {
    pgClientConstructorPromise = import("pg")
      .then((module) => {
        const pg = module?.default ?? module;
        if (!pg || typeof pg.Client !== "function") {
          throw new Error("org_directory_driver_unavailable");
        }
        return pg.Client;
      })
      .catch(() => {
        throw new Error("org_directory_driver_unavailable");
      });
  }
  return pgClientConstructorPromise;
}

async function queryOrganizationDirectory(binding, sql, params = []) {
  if (!isSupportedDataSourceType(readSourceType(binding))) {
    throw new Error("org_directory_unavailable");
  }

  const Client = await getPgClientConstructor();
  const client = new Client(parseConnectionJson(binding));
  try {
    await client.connect();
    const result = await client.query(sql, params);
    return result.rows.map(mapOrganizationRow);
  } catch (error) {
    if (error instanceof Error && error.message === "org_directory_driver_unavailable") {
      throw error;
    }
    throw new Error("org_directory_unavailable");
  } finally {
    try {
      await client.end();
    } catch {
      // Ignore connection cleanup failures so the canonical route error is preserved.
    }
  }
}

export async function listOrganizationsForDataSource(binding) {
  return queryOrganizationDirectory(
    binding,
    `SELECT
       org_id AS "orgId",
       org_number AS "orgNumber",
       org_name AS "orgName",
       parent_org_id AS "parentOrgId",
       status AS "status"
     FROM org_directory_current
     ORDER BY COALESCE(org_number, ''), COALESCE(org_id, '')`,
  );
}

export async function validateOrganizationIds(binding, orgIds) {
  const normalizedOrgIds = [...new Set((Array.isArray(orgIds) ? orgIds : []).map((entry) => String(entry || "").trim()).filter(Boolean))];
  if (normalizedOrgIds.length === 0) {
    return [];
  }
  const rows = await queryOrganizationDirectory(
    binding,
    `SELECT
       org_id AS "orgId",
       org_number AS "orgNumber",
       org_name AS "orgName",
       parent_org_id AS "parentOrgId",
       status AS "status"
     FROM org_directory_current
     WHERE org_id = ANY($1::text[])
     ORDER BY COALESCE(org_number, ''), COALESCE(org_id, '')`,
    [normalizedOrgIds],
  );
  const positions = new Map(normalizedOrgIds.map((orgId, index) => [orgId, index]));
  return rows.toSorted((left, right) => {
    const leftIndex = positions.get(left.orgId) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = positions.get(right.orgId) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
}
