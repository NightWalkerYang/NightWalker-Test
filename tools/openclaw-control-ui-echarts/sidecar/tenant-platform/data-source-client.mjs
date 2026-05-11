let pgClientConstructorPromise = null;
const LOCALHOST_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const DOCKER_HOST_ALIAS = "host.docker.internal";
const DEFAULT_POSTGRES_PORT = 5432;
const DYNAMIC_DATASET_LIMIT = 60;
const DATE_COLUMN_PRIORITIES = [
  "bill_date",
  "biz_date",
  "business_date",
  "date",
  "order_date",
  "delivery_date",
  "receive_date",
  "stock_date",
  "entry_effective_date",
  "header_effective_date",
];
const ORG_COLUMN_PRIORITIES = [
  "sale_org_id",
  "purchase_org_id",
  "stock_org_id",
  "use_org_id",
  "org_id",
  "sale_org_number",
  "purchase_org_number",
  "stock_org_number",
  "use_org_number",
  "org_number",
];
const SANDBOX_DATASET_CATALOG = [
  {
    id: "sales_order",
    label: "销售订单",
    relationName: "sales_order_current",
    dateColumn: "bill_date",
    orgColumn: "sale_org_id",
    description: "销售订单分录、客户需求与订货节奏",
    defaultSelected: true,
    periodMode: "range",
  },
  {
    id: "sales_outbound",
    label: "销售出库",
    relationName: "sales_delivery_notice_current",
    dateColumn: "bill_date",
    orgColumn: "sale_org_id",
    description: "实际出库、物料消耗与需求兑现情况",
    defaultSelected: true,
    periodMode: "range",
  },
  {
    id: "material_master",
    label: "物料主数据",
    relationName: "bd_material_current",
    dateColumn: "",
    orgColumn: "",
    description: "物料编码、名称与基础属性",
    defaultSelected: true,
    periodMode: "snapshot",
  },
  {
    id: "purchase_order",
    label: "采购订单",
    relationName: "pur_purchaseorder_current",
    dateColumn: "",
    orgColumn: "",
    description: "采购订单、未结采购与历史补货节奏",
    defaultSelected: true,
    periodMode: "snapshot",
  },
  {
    id: "purchase_receipt",
    label: "采购收货",
    relationName: "pur_receivebill_current",
    dateColumn: "",
    orgColumn: "",
    description: "采购到货与收货兑现情况",
    defaultSelected: false,
    periodMode: "snapshot",
  },
  {
    id: "supplier_price",
    label: "供应商价格",
    relationName: "bd_supplier_current",
    dateColumn: "",
    orgColumn: "",
    description: "供应商与价格覆盖的基础参考",
    defaultSelected: true,
    periodMode: "snapshot",
  },
];
const CORE_DATASET_RELATION_NAMES = new Set(
  SANDBOX_DATASET_CATALOG.map((dataset) => dataset.relationName),
);
const RECOMMENDED_DEMAND_DATASET_IDS = new Set(["sales_order", "sales_outbound"]);
const SANDBOX_MATERIAL_LIMIT = 60;

function normalizeSourceType(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeConnectionPort(value) {
  const port = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(port) && port > 0 ? port : null;
}

function readAnalyticsConnectionErrorCode(error) {
  const code = String(error?.code || error?.errno || "")
    .trim()
    .toUpperCase();
  return code || "";
}

export function isRetryableAnalyticsConnectionError(error) {
  const code = readAnalyticsConnectionErrorCode(error);
  if (
    code &&
    ["ECONNREFUSED", "ENOTFOUND", "EHOSTUNREACH", "ETIMEDOUT", "ECONNRESET", "ENOENT"].includes(code)
  ) {
    return true;
  }
  const message = String(error?.message || error || "")
    .trim()
    .toLowerCase();
  if (!message) {
    return false;
  }
  return (
    message.includes("connect econnrefused") ||
    message.includes("connect enoent") ||
    message.includes("getaddrinfo enotfound") ||
    message.includes("ehostunreach") ||
    message.includes("connect etimedout") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes(".s.pgsql.5432")
  );
}

function cloneConnectionCandidate(connection, overrides = {}) {
  return {
    ...connection,
    ...overrides,
  };
}

function parseAnalyticsDsnCandidate(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return null;
  }
  try {
    const url = new URL(normalized);
    if (!/^postgres(?:ql)?$/i.test(url.protocol.replace(/:$/, ""))) {
      return null;
    }
    const database = url.pathname.replace(/^\/+/, "").trim();
    const hostParam = url.searchParams.get("host")?.trim() || "";
    const host = url.hostname?.trim() || hostParam;
    const port =
      normalizeConnectionPort(url.port) ??
      (hostParam.startsWith("/") ? DEFAULT_POSTGRES_PORT : DEFAULT_POSTGRES_PORT);
    return {
      host,
      port,
      database,
      user: decodeURIComponent(url.username || "").trim(),
      password: decodeURIComponent(url.password || "").trim(),
    };
  } catch {
    return null;
  }
}

function inferHostUserFromPath(value) {
  const normalized = String(value || "").trim().replace(/\\/g, "/");
  const match = normalized.match(/^\/home\/([^/]+)\//i);
  return match?.[1]?.trim() || "";
}

function inferAnalyticsUnixSocketUser(connection) {
  if (!connection || typeof connection !== "object" || Array.isArray(connection)) {
    return "";
  }
  return (
    inferHostUserFromPath(connection.analyticsProjectRoot) ||
    inferHostUserFromPath(connection.tenantPlatformDbPath) ||
    ""
  );
}

export function buildAnalyticsConnectionCandidates(connection) {
  if (!connection || typeof connection !== "object" || Array.isArray(connection)) {
    return [];
  }

  const dsnCandidate =
    parseAnalyticsDsnCandidate(connection.analyticsPgDsn) ||
    parseAnalyticsDsnCandidate(connection.pgDsn) ||
    parseAnalyticsDsnCandidate(connection.dsn);
  const baseCandidate = {
    ...dsnCandidate,
    ...connection,
    host:
      String(connection.host || "").trim() ||
      String(dsnCandidate?.host || "").trim(),
    port:
      normalizeConnectionPort(connection.port) ??
      normalizeConnectionPort(dsnCandidate?.port) ??
      DEFAULT_POSTGRES_PORT,
    database:
      String(connection.database || "").trim() ||
      String(dsnCandidate?.database || "").trim(),
    user:
      String(connection.user || "").trim() ||
      String(dsnCandidate?.user || "").trim() ||
      inferAnalyticsUnixSocketUser(connection),
    password:
      String(connection.password || "").trim() ||
      String(dsnCandidate?.password || "").trim(),
  };
  const normalizedHost = String(baseCandidate.host || "")
    .trim()
    .toLowerCase();
  const normalizedPort = normalizeConnectionPort(baseCandidate.port);
  const candidates = [];
  const seen = new Set();

  const pushCandidate = (candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return;
    }
    const nextHost = String(candidate.host || "")
      .trim()
      .toLowerCase();
    const nextPort = normalizeConnectionPort(candidate.port) ?? DEFAULT_POSTGRES_PORT;
    const dedupeKey = JSON.stringify({
      host: nextHost,
      port: nextPort,
      database: String(candidate.database || "").trim(),
      user: String(candidate.user || "").trim(),
    });
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);
    candidates.push({
      ...candidate,
      port: nextPort,
    });
  };

  pushCandidate(baseCandidate);

  if (String(baseCandidate.host || "").trim().startsWith("/")) {
    pushCandidate(
      cloneConnectionCandidate(baseCandidate, {
        host: DOCKER_HOST_ALIAS,
        port: DEFAULT_POSTGRES_PORT,
      }),
    );
    pushCandidate(
      cloneConnectionCandidate(baseCandidate, {
        host: "172.18.0.1",
        port: DEFAULT_POSTGRES_PORT,
      }),
    );
  }

  if (LOCALHOST_HOSTS.has(normalizedHost)) {
    pushCandidate(cloneConnectionCandidate(baseCandidate, { host: DOCKER_HOST_ALIAS }));
  }

  if (normalizedPort !== DEFAULT_POSTGRES_PORT) {
    pushCandidate(cloneConnectionCandidate(baseCandidate, { port: DEFAULT_POSTGRES_PORT }));
    if (LOCALHOST_HOSTS.has(normalizedHost)) {
      pushCandidate(
        cloneConnectionCandidate(baseCandidate, {
          host: DOCKER_HOST_ALIAS,
          port: DEFAULT_POSTGRES_PORT,
        }),
      );
    }
    if (normalizedHost === DOCKER_HOST_ALIAS) {
      pushCandidate(cloneConnectionCandidate(baseCandidate, { port: DEFAULT_POSTGRES_PORT }));
    }
  }

  return candidates;
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
  const errors = [];
  for (const candidate of buildAnalyticsConnectionCandidates(parseConnectionJson(binding))) {
    const client = new Client(candidate);
    try {
      await client.connect();
      const result = await client.query(sql, params);
      return result.rows.map(mapOrganizationRow);
    } catch (error) {
      if (error instanceof Error && error.message === "org_directory_driver_unavailable") {
        throw error;
      }
      if (!isRetryableAnalyticsConnectionError(error)) {
        throw error;
      }
      errors.push(error);
    } finally {
      try {
        await client.end();
      } catch {
        // Ignore connection cleanup failures so the canonical route error is preserved.
      }
    }
  }
  throw new Error("org_directory_unavailable");
}

function normalizeCatalogDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const normalized = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }
  const parsed = new Date(normalized);
  if (Number.isFinite(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return "";
}

function normalizeAllowedOrgIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((entry) => String(entry || "").trim()).filter(Boolean))];
}

function compareCatalogDates(left, right) {
  const leftValue = normalizeCatalogDate(left);
  const rightValue = normalizeCatalogDate(right);
  if (!leftValue && !rightValue) {
    return 0;
  }
  if (!leftValue) {
    return 1;
  }
  if (!rightValue) {
    return -1;
  }
  return leftValue.localeCompare(rightValue);
}

function buildRecommendedInputPeriod(datasets) {
  const demandDatasets = (Array.isArray(datasets) ? datasets : []).filter(
    (dataset) =>
      RECOMMENDED_DEMAND_DATASET_IDS.has(String(dataset?.id || "").trim()) &&
      Number(dataset?.rowCount || 0) > 0 &&
      normalizeCatalogDate(dataset?.minDate) &&
      normalizeCatalogDate(dataset?.maxDate),
  );
  if (demandDatasets.length === 0) {
    return null;
  }
  const sorted = [...demandDatasets].sort((left, right) => {
    const leftRows = Number(left?.rowCount || 0);
    const rightRows = Number(right?.rowCount || 0);
    if (leftRows !== rightRows) {
      return rightRows - leftRows;
    }
    return compareCatalogDates(left?.minDate, right?.minDate);
  });
  const best = sorted[0];
  return {
    startDate: normalizeCatalogDate(best?.minDate) || null,
    endDate: normalizeCatalogDate(best?.maxDate) || null,
    source: String(best?.id || "").trim() || null,
  };
}

function parseCatalogDate(value) {
  const normalized = normalizeCatalogDate(value);
  if (!normalized) {
    return null;
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function calculateDateSpanDays(startDate, endDate) {
  const start = parseCatalogDate(startDate);
  const end = parseCatalogDate(endDate);
  if (!start || !end) {
    return null;
  }
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs) + 1);
}

function buildRecommendedInputWindow(period, options = {}) {
  const start = parseCatalogDate(period?.startDate);
  const end = parseCatalogDate(period?.endDate);
  if (!start || !end) {
    return period || null;
  }
  const preferredSpanDays = calculateDateSpanDays(options.inputStartDate, options.inputEndDate);
  if (!preferredSpanDays) {
    return period;
  }
  const boundedSpanDays = Math.min(preferredSpanDays, 60);
  const dayMs = 24 * 60 * 60 * 1000;
  const alignedEnd = end;
  const alignedStart = new Date(alignedEnd.getTime() - (boundedSpanDays - 1) * dayMs);
  const clampedStart = alignedStart < start ? start : alignedStart;
  return {
    ...period,
    startDate: clampedStart.toISOString().slice(0, 10),
    endDate: alignedEnd.toISOString().slice(0, 10),
  };
}

async function loadRecommendedInputPeriod(binding, datasets, catalog, options = {}) {
  const currentRecommendation = buildRecommendedInputPeriod(datasets);
  if (currentRecommendation) {
    return currentRecommendation;
  }
  const demandCatalog = (Array.isArray(catalog) ? catalog : []).filter(
    (dataset) =>
      RECOMMENDED_DEMAND_DATASET_IDS.has(String(dataset?.id || "").trim()) &&
      String(dataset?.dateColumn || "").trim(),
  );
  if (demandCatalog.length === 0) {
    return null;
  }
  const fallbackDatasets = [];
  for (const dataset of demandCatalog) {
    const stats = await loadDatasetStats(binding, dataset, {
      allowedOrgIds: options.allowedOrgIds,
    });
    fallbackDatasets.push({
      id: dataset.id,
      rowCount: stats.rowCount,
      minDate: stats.minDate,
      maxDate: stats.maxDate,
    });
  }
  return buildRecommendedInputWindow(buildRecommendedInputPeriod(fallbackDatasets), options);
}

function quotePgIdentifier(value) {
  const normalized = String(value || "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized)) {
    throw new Error("data_catalog_unavailable");
  }
  return `"${normalized.replaceAll('"', '""')}"`;
}

function mapDatasetDictionaryRow(row) {
  if (!row) {
    return null;
  }
  return {
    relationName: String(row.relationName || "").trim(),
    objectCode: String(row.objectCode || "").trim(),
    storageRole: String(row.storageRole || "").trim(),
    businessGrain: String(row.businessGrain || "").trim(),
    description: String(row.description || "").trim(),
  };
}

function mapDatasetColumnRow(row) {
  return {
    relationName: String(row?.relationName || "").trim(),
    columnName: String(row?.columnName || "").trim(),
    dataType: String(row?.dataType || "")
      .trim()
      .toLowerCase(),
  };
}

function toDatasetId(relationName) {
  return String(relationName || "")
    .trim()
    .replace(/_current$/, "")
    .replace(/[^A-Za-z0-9_]+/g, "_");
}

function toReadableDatasetLabel(row) {
  const relationName = String(row?.relationName || "").trim();
  const labelByRelation = new Map([
    ["bd_materialcategory_current", "物料分类"],
    ["bd_materialunitconvert_current", "物料单位换算"],
    ["pur_contract_current", "采购合同"],
    ["pur_purchaseorder_current", "采购订单"],
    ["pur_receivebill_current", "采购收货"],
    ["pur_requisition_current", "采购申请"],
    ["pur_schedulepurchase_current", "采购排程"],
    ["sales_order_current", "销售订单"],
    ["sales_delivery_notice_current", "销售出库"],
    ["sales_outstock_current", "销售出库单"],
    ["sal_returnnotice_current", "销售退货通知"],
    ["sales_returnstock_current", "销售退货入库"],
    ["stk_inventory_current", "库存余额"],
    ["stk_instock_current", "采购入库"],
    ["stk_transferin_current", "调拨入库"],
    ["stk_transferout_current", "调拨出库"],
    ["scp_purchaseorder_current", "供应协同采购订单"],
    ["scp_receivebill_current", "供应协同收货"],
    ["scp_stkinventory_current", "供应协同库存"],
    ["scp_instock_current", "供应协同入库"],
    ["bd_supplier_current", "供应商"],
    ["bd_customer_current", "客户"],
    ["org_directory_current", "组织目录"],
    ["org_organizations_current", "组织主数据"],
  ]);
  const mapped = labelByRelation.get(relationName);
  if (mapped) {
    return mapped;
  }
  const objectCode = String(row?.objectCode || "").trim();
  const prefixLabels = [
    ["pur_", "采购"],
    ["scp_", "供应协同"],
    ["stk_", "库存"],
    ["sales_", "销售"],
    ["sal_", "销售"],
    ["bd_", "基础资料"],
    ["pln_", "计划"],
    ["eng_", "工程"],
  ];
  const prefix = prefixLabels.find(([key]) => relationName.startsWith(key));
  if (prefix) {
    const base = relationName
      .replace(/_current$/, "")
      .slice(prefix[0].length)
      .replaceAll("_", " ");
    return `${prefix[1]} ${base}`;
  }
  if (objectCode) {
    return objectCode.replaceAll("_", " ").replace(/\b\w/g, (value) => value.toUpperCase());
  }
  return relationName
    .replace(/_current$/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());
}

function pickColumn(columns, priorities, fallbackMatcher = null) {
  const byName = new Map(
    columns.map((column) => [column.columnName.toLowerCase(), column.columnName]),
  );
  for (const name of priorities) {
    const match = byName.get(name.toLowerCase());
    if (match) {
      return match;
    }
  }
  if (typeof fallbackMatcher === "function") {
    const match = columns.find((column) =>
      fallbackMatcher(column.columnName.toLowerCase(), column),
    );
    return match?.columnName || "";
  }
  return "";
}

function qualifyPgIdentifier(alias, value) {
  return `${String(alias || "").trim()}.${quotePgIdentifier(value)}`;
}

function hasPgColumn(columns, name) {
  const normalizedName = String(name || "")
    .trim()
    .toLowerCase();
  return columns.some(
    (column) =>
      String(column?.columnName || "")
        .trim()
        .toLowerCase() === normalizedName,
  );
}

function buildJsonTextExpression(alias, columnName, keys) {
  if (!Array.isArray(keys) || keys.length === 0) {
    return "";
  }
  return `COALESCE(${keys
    .map((key) => `NULLIF(${qualifyPgIdentifier(alias, columnName)} ->> '${key}', '')`)
    .join(", ")})`;
}

function buildJsonDateExpression(alias, columnName, keys) {
  if (!Array.isArray(keys) || keys.length === 0) {
    return "";
  }
  return `COALESCE(${keys
    .map(
      (key) =>
        `NULLIF(${qualifyPgIdentifier(alias, columnName)} ->> '${key}', '')::timestamp without time zone::date`,
    )
    .join(", ")})`;
}

function buildMaterialActivitySourceSpec(relationName, columns, alias = "base") {
  const relation = String(relationName || "").trim();
  const hasDocumentJson = hasPgColumn(columns, "document_json");
  const materialIdSql = hasPgColumn(columns, "material_id")
    ? `NULLIF(${qualifyPgIdentifier(alias, "material_id")}::text, '')`
    : hasPgColumn(columns, "material_number")
      ? `NULLIF(${qualifyPgIdentifier(alias, "material_number")}::text, '')`
      : hasDocumentJson
        ? buildJsonTextExpression(alias, "document_json", ["FMaterialId", "FNumber"])
        : "";
  const materialNameSql = hasPgColumn(columns, "material_name")
    ? `NULLIF(${qualifyPgIdentifier(alias, "material_name")}::text, '')`
    : hasDocumentJson
      ? buildJsonTextExpression(alias, "document_json", ["FName", "FMaterialDesc", "FMaterialDesc"])
      : "";
  if (!materialIdSql) {
    return null;
  }

  if (relation === "sales_order_current" || relation === "sales_delivery_notice_current") {
    return {
      relationName: relation,
      materialIdSql,
      materialNameSql,
      dateSql: hasPgColumn(columns, "bill_date") ? qualifyPgIdentifier(alias, "bill_date") : "",
      orgSql: hasPgColumn(columns, "sale_org_id")
        ? qualifyPgIdentifier(alias, "sale_org_id")
        : hasPgColumn(columns, "sale_org_number")
          ? qualifyPgIdentifier(alias, "sale_org_number")
          : "",
    };
  }

  if (relation === "pur_purchaseorder_current") {
    return {
      relationName: relation,
      materialIdSql,
      materialNameSql,
      dateSql: hasPgColumn(columns, "bill_date")
        ? qualifyPgIdentifier(alias, "bill_date")
        : hasDocumentJson
          ? buildJsonDateExpression(alias, "document_json", [
              "FDate",
              "FDeliveryDate",
              "FPREARRIVALDATE",
            ])
          : "",
      orgSql: hasPgColumn(columns, "purchase_org_id")
        ? qualifyPgIdentifier(alias, "purchase_org_id")
        : hasDocumentJson
          ? buildJsonTextExpression(alias, "document_json", [
              "FPurchaseOrgId",
              "FReceiveOrgId",
              "FRequireOrgId",
            ])
          : "",
    };
  }

  if (relation === "pur_receivebill_current") {
    return {
      relationName: relation,
      materialIdSql,
      materialNameSql,
      dateSql: hasPgColumn(columns, "bill_date")
        ? qualifyPgIdentifier(alias, "bill_date")
        : hasDocumentJson
          ? buildJsonDateExpression(alias, "document_json", ["FDate", "FReceived", "FCreateDate"])
          : "",
      orgSql: hasPgColumn(columns, "purchase_org_id")
        ? qualifyPgIdentifier(alias, "purchase_org_id")
        : hasDocumentJson
          ? buildJsonTextExpression(alias, "document_json", [
              "FPurchaseOrgId",
              "FStockOrgId",
              "FPayOrgId",
            ])
          : "",
    };
  }

  return {
    relationName: relation,
    materialIdSql,
    materialNameSql,
    dateSql: "",
    orgSql: "",
  };
}

function buildMaterialMasterLookupSpec(columns, alias = "master") {
  const hasDocumentJson = hasPgColumn(columns, "document_json");
  const materialIdSql = hasPgColumn(columns, "material_id")
    ? `NULLIF(${qualifyPgIdentifier(alias, "material_id")}::text, '')`
    : hasPgColumn(columns, "material_number")
      ? `NULLIF(${qualifyPgIdentifier(alias, "material_number")}::text, '')`
      : hasPgColumn(columns, "source_object_id")
        ? `NULLIF(${qualifyPgIdentifier(alias, "source_object_id")}::text, '')`
        : hasDocumentJson
          ? buildJsonTextExpression(alias, "document_json", ["FNumber", "FMaterialId"])
          : "";
  const materialCodeSql = hasPgColumn(columns, "material_number")
    ? `NULLIF(${qualifyPgIdentifier(alias, "material_number")}::text, '')`
    : hasPgColumn(columns, "source_object_id")
      ? `NULLIF(${qualifyPgIdentifier(alias, "source_object_id")}::text, '')`
      : hasDocumentJson
        ? buildJsonTextExpression(alias, "document_json", ["FNumber", "FMaterialId"])
        : "";
  const materialNameSql = hasPgColumn(columns, "material_name")
    ? `NULLIF(${qualifyPgIdentifier(alias, "material_name")}::text, '')`
    : hasDocumentJson
      ? buildJsonTextExpression(alias, "document_json", ["FName", "FMaterialDesc", "FMaterialDesc"])
      : "";
  return {
    materialIdSql,
    materialCodeSql,
    materialNameSql,
  };
}

function inferDatasetColumns(columns) {
  const dateColumn = pickColumn(
    columns.filter(
      (column) => column.dataType.includes("date") || column.dataType.includes("time"),
    ),
    DATE_COLUMN_PRIORITIES,
    (name) => name.endsWith("_date") || name.includes("bill") || name.includes("biz"),
  );
  const orgColumn = pickColumn(
    columns,
    ORG_COLUMN_PRIORITIES,
    (name) => name.endsWith("org_id") || name.endsWith("org_number"),
  );
  return {
    dateColumn,
    orgColumn,
  };
}

function datasetSortScore(row) {
  const relationName = String(row?.relationName || "");
  const objectCode = String(row?.objectCode || "");
  if (CORE_DATASET_RELATION_NAMES.has(relationName)) {
    return 0;
  }
  if (/^(sales|sal|pur|scp|stk|bd_material|bd_supplier)/i.test(relationName)) {
    return 1;
  }
  if (/^(sales|sal|pur|scp|stk|bd_material|bd_supplier)/i.test(objectCode)) {
    return 2;
  }
  return 3;
}

async function queryRawRows(binding, sql, params = []) {
  if (!isSupportedDataSourceType(readSourceType(binding))) {
    throw new Error("data_catalog_unavailable");
  }

  const Client = await getPgClientConstructor();
  const errors = [];
  for (const candidate of buildAnalyticsConnectionCandidates(parseConnectionJson(binding))) {
    const client = new Client(candidate);
    try {
      await client.connect();
      const result = await client.query(sql, params);
      return result.rows;
    } catch (error) {
      if (error instanceof Error && error.message === "org_directory_driver_unavailable") {
        throw error;
      }
      if (!isRetryableAnalyticsConnectionError(error)) {
        throw error;
      }
      errors.push(error);
    } finally {
      try {
        await client.end();
      } catch {
        // Ignore cleanup errors; the route should report the primary query failure.
      }
    }
  }
  throw new Error("data_catalog_unavailable");
}

async function loadDatasetDictionary(binding) {
  const rows = await queryRawRows(
    binding,
    `SELECT
       relation_name AS "relationName",
       object_code AS "objectCode",
       storage_role AS "storageRole",
       business_grain AS "businessGrain",
       description AS "description"
     FROM analytics_table_dictionary
     WHERE relation_name = ANY($1::text[])`,
    [SANDBOX_DATASET_CATALOG.map((dataset) => dataset.relationName)],
  );
  return new Map(
    rows
      .map(mapDatasetDictionaryRow)
      .filter(Boolean)
      .map((row) => [row.relationName, row]),
  );
}

async function loadDynamicDatasetDictionary(binding) {
  const rows = await queryRawRows(
    binding,
    `SELECT
       d.relation_name AS "relationName",
       d.object_code AS "objectCode",
       d.storage_role AS "storageRole",
       d.business_grain AS "businessGrain",
       d.description AS "description"
     FROM analytics_table_dictionary d
     JOIN information_schema.tables t
       ON t.table_schema = 'public'
      AND t.table_name = d.relation_name
     WHERE d.storage_role = 'current'
       AND d.relation_name LIKE '%\\_current' ESCAPE '\\'
     ORDER BY d.relation_name`,
  );
  return rows
    .map(mapDatasetDictionaryRow)
    .filter(Boolean)
    .toSorted((left, right) => {
      const scoreDelta = datasetSortScore(left) - datasetSortScore(right);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return left.relationName.localeCompare(right.relationName);
    })
    .slice(0, DYNAMIC_DATASET_LIMIT);
}

async function loadDatasetColumns(binding, relationNames) {
  const names = [
    ...new Set(relationNames.map((name) => String(name || "").trim()).filter(Boolean)),
  ];
  if (names.length === 0) {
    return new Map();
  }
  const rows = await queryRawRows(
    binding,
    `SELECT
       table_name AS "relationName",
       column_name AS "columnName",
       data_type AS "dataType"
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])
     ORDER BY table_name, ordinal_position`,
    [names],
  );
  const grouped = new Map();
  for (const row of rows.map(mapDatasetColumnRow)) {
    if (!row.relationName || !row.columnName) {
      continue;
    }
    const list = grouped.get(row.relationName) || [];
    list.push(row);
    grouped.set(row.relationName, list);
  }
  return grouped;
}

async function loadDatasetStats(binding, dataset, options = {}) {
  const inputStartDate = normalizeCatalogDate(options.inputStartDate);
  const inputEndDate = normalizeCatalogDate(options.inputEndDate);
  const allowedOrgIds = normalizeAllowedOrgIds(options.allowedOrgIds);
  const where = [];
  const params = [];
  if (dataset.dateColumn && inputStartDate) {
    params.push(inputStartDate);
    where.push(`${quotePgIdentifier(dataset.dateColumn)} >= $${params.length}::date`);
  }
  if (dataset.dateColumn && inputEndDate) {
    params.push(inputEndDate);
    where.push(`${quotePgIdentifier(dataset.dateColumn)} <= $${params.length}::date`);
  }
  if (dataset.orgColumn && allowedOrgIds.length > 0) {
    params.push(allowedOrgIds);
    where.push(`${quotePgIdentifier(dataset.orgColumn)} = ANY($${params.length}::text[])`);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const updatedAtSql = dataset.hasUpdatedAt
    ? `MAX(updated_at) AS "lastUpdatedAt"`
    : `NULL::timestamptz AS "lastUpdatedAt"`;
  const dateSql = dataset.dateColumn
    ? `MIN(${quotePgIdentifier(dataset.dateColumn)}) AS "minDate",
       MAX(${quotePgIdentifier(dataset.dateColumn)}) AS "maxDate",`
    : `NULL::date AS "minDate",
       NULL::date AS "maxDate",`;
  const orgSql = dataset.orgColumn
    ? `COUNT(DISTINCT NULLIF(${quotePgIdentifier(dataset.orgColumn)}, '')) AS "orgCount",`
    : `0::bigint AS "orgCount",`;
  const rows = await queryRawRows(
    binding,
    `SELECT
       COUNT(*)::bigint AS "rowCount",
       ${dateSql}
       ${orgSql}
       ${updatedAtSql}
     FROM ${quotePgIdentifier(dataset.relationName)}
     ${whereSql}`,
    params,
  );
  const row = rows[0] || {};
  const rowCount = Number(row.rowCount || 0);
  return {
    rowCount: Number.isFinite(rowCount) ? rowCount : 0,
    minDate: normalizeCatalogDate(row.minDate) || null,
    maxDate: normalizeCatalogDate(row.maxDate) || null,
    orgCount: Number(row.orgCount || 0),
    lastUpdatedAt: row.lastUpdatedAt ? new Date(row.lastUpdatedAt).toISOString() : null,
  };
}

function resolveDatasetStatus(dataset, stats) {
  if (!stats || stats.rowCount <= 0) {
    return "empty";
  }
  if (dataset.periodMode === "range" && (!stats.minDate || !stats.maxDate)) {
    return "partial";
  }
  return "available";
}

export async function listSandboxDataCatalogForDataSource(binding, options = {}) {
  if (!isSupportedDataSourceType(readSourceType(binding))) {
    throw new Error("data_catalog_unavailable");
  }
  const [coreDictionary, dynamicDictionary] = await Promise.all([
    loadDatasetDictionary(binding),
    loadDynamicDatasetDictionary(binding),
  ]);
  const columnsByRelation = await loadDatasetColumns(
    binding,
    dynamicDictionary.map((row) => row.relationName),
  );
  const dynamicByRelation = new Map(dynamicDictionary.map((row) => [row.relationName, row]));
  const catalog = [
    ...SANDBOX_DATASET_CATALOG.map((dataset) => {
      const columns = columnsByRelation.get(dataset.relationName) || [];
      return {
        ...dataset,
        hasUpdatedAt: columns.some((column) => column.columnName === "updated_at"),
      };
    }),
    ...dynamicDictionary
      .filter((row) => !CORE_DATASET_RELATION_NAMES.has(row.relationName))
      .map((row) => {
        const columns = columnsByRelation.get(row.relationName) || [];
        const inferred = inferDatasetColumns(columns);
        return {
          id: toDatasetId(row.relationName),
          label: toReadableDatasetLabel(row),
          relationName: row.relationName,
          dateColumn: inferred.dateColumn,
          orgColumn: inferred.orgColumn,
          description: row.description,
          defaultSelected: false,
          periodMode: inferred.dateColumn ? "range" : "snapshot",
          hasUpdatedAt: columns.some((column) => column.columnName === "updated_at"),
        };
      }),
  ];
  const datasets = [];
  for (const dataset of catalog) {
    const dictionaryRow =
      coreDictionary.get(dataset.relationName) ?? dynamicByRelation.get(dataset.relationName);
    if (!dictionaryRow) {
      datasets.push({
        id: dataset.id,
        label: dataset.label,
        relationName: dataset.relationName,
        description: dataset.description,
        defaultSelected: false,
        periodMode: dataset.periodMode,
        status: "missing",
        rowCount: 0,
        orgCount: 0,
        minDate: null,
        maxDate: null,
        lastUpdatedAt: null,
      });
      continue;
    }
    let stats = null;
    try {
      stats = await loadDatasetStats(binding, dataset, options);
    } catch {
      datasets.push({
        id: dataset.id,
        label: dataset.label,
        relationName: dataset.relationName,
        objectCode: dictionaryRow.objectCode,
        storageRole: dictionaryRow.storageRole,
        businessGrain: dictionaryRow.businessGrain,
        description: dictionaryRow.description || dataset.description,
        defaultSelected: false,
        periodMode: dataset.periodMode,
        status: "partial",
        rowCount: 0,
        orgCount: 0,
        minDate: null,
        maxDate: null,
        lastUpdatedAt: null,
      });
      continue;
    }
    datasets.push({
      id: dataset.id,
      label: dataset.label,
      relationName: dataset.relationName,
      objectCode: dictionaryRow.objectCode,
      storageRole: dictionaryRow.storageRole,
      businessGrain: dictionaryRow.businessGrain,
      description: dictionaryRow.description || dataset.description,
      defaultSelected: dataset.defaultSelected && stats.rowCount > 0,
      periodMode: dataset.periodMode,
      status: resolveDatasetStatus(dataset, stats),
      ...stats,
    });
  }
  const recommendedInputPeriod = await loadRecommendedInputPeriod(
    binding,
    datasets,
    catalog,
    options,
  );
  return {
    dataSourceId: String(binding?.dataSourceId || binding?.id || "").trim(),
    dataSourceName: String(binding?.dataSourceName || binding?.name || "").trim(),
    inputStartDate: normalizeCatalogDate(options.inputStartDate) || null,
    inputEndDate: normalizeCatalogDate(options.inputEndDate) || null,
    scopeMode: String(options.scopeMode || "").trim() || "unknown",
    recommendedInputPeriod,
    datasets,
  };
}

export async function listSandboxMaterialCandidatesForDataSource(binding, options = {}) {
  if (!isSupportedDataSourceType(readSourceType(binding))) {
    throw new Error("material_candidates_unavailable");
  }
  const inputStartDate = normalizeCatalogDate(options.inputStartDate);
  const inputEndDate = normalizeCatalogDate(options.inputEndDate);
  const keyword = String(options.keyword || "").trim();
  const allowedOrgIds = normalizeAllowedOrgIds(options.allowedOrgIds);
  const tenantCode = String(
    binding?.sourceTenantCode ||
      binding?.source_tenant_code ||
      binding?.connectionJson?.sourceTenantCode ||
      binding?.connection_json?.sourceTenantCode ||
      "",
  ).trim();
  if (!tenantCode) {
    throw new Error("material_candidates_unavailable");
  }
  const params = [tenantCode];
  const where = ["tenant_id = $1::text"];
  if (allowedOrgIds.length > 0) {
    params.push(allowedOrgIds);
    where.push(`org_id = ANY($${params.length}::text[])`);
  }
  if (inputStartDate) {
    params.push(inputStartDate);
    where.push(`target_month >= date_trunc('month', $${params.length}::date)::date`);
  }
  if (inputEndDate) {
    params.push(inputEndDate);
    where.push(`target_month <= date_trunc('month', $${params.length}::date)::date`);
  }
  let keywordWhereSql = "";
  if (keyword) {
    params.push(`%${keyword}%`);
    keywordWhereSql = `AND (
      demand.material_id ILIKE $${params.length}
      OR COALESCE(master.material_name, demand.material_id) ILIKE $${params.length}
    )`;
  }
  params.push(SANDBOX_MATERIAL_LIMIT);
  const limitRef = `$${params.length}`;
  const rows = await queryRawRows(
    binding,
    `WITH demand AS (
       SELECT
         material_id,
         SUM(demand_qty)::numeric AS activity_qty
       FROM sandbox_v1.feature_material_monthly_demand
       WHERE ${where.join(" AND ")}
       GROUP BY material_id
     ),
     master_materials AS (
       SELECT
         COALESCE(
           NULLIF(document_json ->> 'FNumber', ''),
           NULLIF(source_object_id::text, ''),
           NULLIF(document_json ->> 'FMaterialId', '')
         ) AS material_id,
         MAX(
           COALESCE(
             NULLIF(document_json ->> 'FName', ''),
             NULLIF(document_json ->> 'FMaterialDesc', '')
           )
         ) AS material_name
       FROM bd_material_current
       GROUP BY 1
     )
     SELECT
       demand.material_id AS "materialId",
       demand.material_id AS "materialCode",
       COALESCE(master.material_name, demand.material_id) AS "materialName",
       demand.activity_qty AS "activityQty"
     FROM demand
     LEFT JOIN master_materials master
       ON master.material_id = demand.material_id
     WHERE 1 = 1
       ${keywordWhereSql}
     ORDER BY demand.activity_qty DESC, demand.material_id
     LIMIT ${limitRef}`,
    params,
  );
  return {
    dataSourceId: String(binding?.dataSourceId || binding?.id || "").trim(),
    dataSourceName: String(binding?.dataSourceName || binding?.name || "").trim(),
    inputStartDate: inputStartDate || null,
    inputEndDate: inputEndDate || null,
    keyword: keyword || null,
    items: [
      ...new Map(
        rows
          .map((row) => ({
            materialId: String(row?.materialId || "").trim(),
            materialCode: String(row?.materialCode || "").trim(),
            materialName: String(row?.materialName || "").trim(),
            activityQty: Number(row?.activityQty || row?.activity_score || 0),
          }))
          .filter((item) => item.materialId || item.materialCode || item.materialName)
          .map((item) => [item.materialId || item.materialCode || item.materialName, item]),
      ).values(),
    ],
  };
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
  const normalizedOrgIds = [
    ...new Set(
      (Array.isArray(orgIds) ? orgIds : [])
        .map((entry) => String(entry || "").trim())
        .filter(Boolean),
    ),
  ];
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
