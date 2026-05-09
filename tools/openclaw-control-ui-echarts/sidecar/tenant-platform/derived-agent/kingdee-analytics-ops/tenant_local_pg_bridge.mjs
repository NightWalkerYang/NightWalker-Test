import fs from "node:fs/promises";
import { createRequire } from "node:module";
import process from "node:process";

const LOCALHOST_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const DOCKER_HOST_ALIAS = "host.docker.internal";
const DEFAULT_POSTGRES_PORT = 5432;
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const INSERT_CHUNK_SIZE = 200;

function readConnectionErrorCode(error) {
  return String(error?.code || error?.errno || "")
    .trim()
    .toUpperCase();
}

function isRetryableConnectionError(error) {
  const code = readConnectionErrorCode(error);
  if (code && ["ECONNREFUSED", "ENOTFOUND", "EHOSTUNREACH", "ETIMEDOUT", "ECONNRESET"].includes(code)) {
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
    message.includes("getaddrinfo enotfound") ||
    message.includes("ehostunreach") ||
    message.includes("connect etimedout") ||
    message.includes("connection terminated unexpectedly")
  );
}

function resolvePgClientConstructor() {
  const candidates = [import.meta.url, "file:///app/package.json"];
  for (const candidate of candidates) {
    try {
      const requireFrom = createRequire(candidate);
      const pg = requireFrom("pg");
      if (pg && typeof pg.Client === "function") {
        return pg.Client;
      }
    } catch {
      // Try next resolution root.
    }
  }
  throw new Error("tenant_data_access_driver_missing");
}

function fail(message) {
  process.stderr.write(`${String(message || "tenant_local_pg_bridge_failed").trim()}\n`);
  process.exit(1);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}

function decodeSql(payload) {
  const sqlBase64 = String(payload?.sql_b64 || "").trim();
  if (!sqlBase64) {
    throw new Error("sql_b64_required");
  }
  return Buffer.from(sqlBase64, "base64").toString("utf8");
}

function quoteIdentifier(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

function normalizeObjectCode(value) {
  const normalized = String(value || "").trim();
  if (!SAFE_IDENTIFIER.test(normalized)) {
    throw new Error(`unsafe_object_code:${normalized || "unknown"}`);
  }
  return normalized;
}

function normalizeRecords(records) {
  if (!Array.isArray(records)) {
    throw new Error("sync_plan_records_must_be_array");
  }
  return records;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildInsertQuery(tableName, columns, rows) {
  const values = [];
  const tuples = rows.map((row) => {
    const placeholders = row.map((value) => {
      values.push(value);
      return `$${values.length}`;
    });
    return `(${placeholders.join(", ")})`;
  });
  return {
    text: `insert into ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(", ")}) values ${tuples.join(", ")}`,
    values,
  };
}

async function insertRowsInChunks(client, tableName, columns, rows) {
  if (!rows.length) {
    return;
  }
  for (const chunk of chunkArray(rows, INSERT_CHUNK_SIZE)) {
    const query = buildInsertQuery(tableName, columns, chunk);
    await client.query(query);
  }
}

function normalizeConnection(accessPayload) {
  const connection =
    accessPayload?.connection &&
    typeof accessPayload.connection === "object" &&
    !Array.isArray(accessPayload.connection)
      ? accessPayload.connection
      : null;
  if (!connection) {
    throw new Error("tenant_data_access_connection_missing");
  }
  return connection;
}

function normalizePort(value) {
  const port = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(port) && port > 0 ? port : null;
}

function buildConnectionCandidates(accessPayload) {
  const connection = normalizeConnection(accessPayload);
  const normalizedHost = String(connection.host || "")
    .trim()
    .toLowerCase();
  const normalizedPort = normalizePort(connection.port);
  const candidates = [];
  const seen = new Set();

  const pushCandidate = (candidate) => {
    const nextPort = normalizePort(candidate.port) ?? DEFAULT_POSTGRES_PORT;
    const dedupeKey = JSON.stringify({
      host: String(candidate.host || "").trim().toLowerCase(),
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

  pushCandidate(connection);

  if (LOCALHOST_HOSTS.has(normalizedHost)) {
    pushCandidate({
      ...connection,
      host: DOCKER_HOST_ALIAS,
    });
  }

  if (normalizedPort !== DEFAULT_POSTGRES_PORT) {
    pushCandidate({
      ...connection,
      port: DEFAULT_POSTGRES_PORT,
    });
    if (LOCALHOST_HOSTS.has(normalizedHost)) {
      pushCandidate({
        ...connection,
        host: DOCKER_HOST_ALIAS,
        port: DEFAULT_POSTGRES_PORT,
      });
    }
    if (normalizedHost === DOCKER_HOST_ALIAS) {
      pushCandidate({
        ...connection,
        port: DEFAULT_POSTGRES_PORT,
      });
    }
  }

  return candidates;
}

async function runQuery(client, payload) {
  const sql = decodeSql(payload);
  const maxRows = Math.max(1, Number(payload?.max_rows) || 2000);
  const result = await client.query(sql);
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const fields = Array.isArray(result?.fields) ? result.fields : [];
  return {
    columns: fields.length ? fields.map((field) => String(field?.name || "")) : Object.keys(rows[0] || {}),
    rows: rows.slice(0, maxRows),
    row_count: rows.length,
    truncated: rows.length > maxRows,
  };
}

async function runWriteSql(client, payload) {
  const sql = decodeSql(payload);
  const result = await client.query(sql);
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const fields = Array.isArray(result?.fields) ? result.fields : [];
  return {
    ok: true,
    command: String(result?.command || "").trim() || null,
    row_count: Number.isFinite(result?.rowCount) ? Number(result.rowCount) : rows.length,
    columns: fields.length ? fields.map((field) => String(field?.name || "")) : Object.keys(rows[0] || {}),
    rows,
  };
}

function buildSyncTableNames(objectCode) {
  const normalized = normalizeObjectCode(objectCode);
  return {
    raw: `${normalized}_raw`,
    current: `${normalized}_current`,
  };
}

function buildDocumentRawRows(records, snapshotFile) {
  return records.map((record) => [
    String(record.row_key ?? ""),
    Number(record.source_row_number ?? 0),
    String(record.source_object_id ?? ""),
    record.document_json ?? {},
    String(record.sync_batch_id ?? ""),
    snapshotFile,
  ]);
}

function buildDocumentCurrentRows(records) {
  return records.map((record) => [
    String(record.row_key ?? ""),
    Number(record.source_row_number ?? 0),
    String(record.source_object_id ?? ""),
    record.document_json ?? {},
    String(record.sync_batch_id ?? ""),
  ]);
}

function buildGenericRawRows(records, snapshotFile) {
  return records.map((record) => [
    String(record.row_key ?? ""),
    Number(record.source_row_number ?? 0),
    record.row_json ?? {},
    String(record.sync_batch_id ?? ""),
    snapshotFile,
  ]);
}

function buildGenericCurrentRows(records) {
  return records.map((record) => [
    String(record.row_key ?? ""),
    Number(record.source_row_number ?? 0),
    record.row_json ?? {},
    String(record.sync_batch_id ?? ""),
  ]);
}

async function runExecuteSyncPlan(client, payload) {
  const plan =
    payload?.plan && typeof payload.plan === "object" && !Array.isArray(payload.plan)
      ? payload.plan
      : null;
  if (!plan) {
    throw new Error("sync_plan_required");
  }
  const objectCode = normalizeObjectCode(plan.object_code);
  const storageProfile = String(plan.storage_profile || "").trim();
  const records = normalizeRecords(plan.records);
  const batchId = String(plan.batch_id || "").trim();
  const startDate = String(plan.start_date || "").trim();
  const endDate = String(plan.end_date || "").trim();
  const runId = String(plan.run_id || batchId || "").trim();
  const runStatus = String(plan.run_status || "success").trim() || "success";
  const startedAt = String(plan.started_at || "").trim() || new Date().toISOString();
  const endedAt = String(plan.ended_at || "").trim() || new Date().toISOString();
  const snapshotFile = String(plan.snapshot_file || "").trim() || null;
  if (!batchId || !startDate || !endDate || !runId) {
    throw new Error("sync_plan_metadata_missing");
  }
  const tableNames = buildSyncTableNames(objectCode);

  await client.query("BEGIN");
  try {
    if (storageProfile === "document_json_v1") {
      await insertRowsInChunks(
        client,
        tableNames.raw,
        ["row_key", "source_row_number", "source_object_id", "document_json", "sync_batch_id", "snapshot_file"],
        buildDocumentRawRows(records, snapshotFile),
      );
      await client.query(`delete from ${quoteIdentifier(tableNames.current)}`);
      await insertRowsInChunks(
        client,
        tableNames.current,
        ["row_key", "source_row_number", "source_object_id", "document_json", "sync_batch_id"],
        buildDocumentCurrentRows(records),
      );
    } else if (storageProfile === "generic_rows_v1") {
      await insertRowsInChunks(
        client,
        tableNames.raw,
        ["row_key", "source_row_number", "row_json", "sync_batch_id", "snapshot_file"],
        buildGenericRawRows(records, snapshotFile),
      );
      await client.query(`delete from ${quoteIdentifier(tableNames.current)}`);
      await insertRowsInChunks(
        client,
        tableNames.current,
        ["row_key", "source_row_number", "row_json", "sync_batch_id"],
        buildGenericCurrentRows(records),
      );
    } else {
      throw new Error(`unsupported_sync_storage_profile:${storageProfile || "unknown"}`);
    }

    await client.query(
      `
        insert into sync_state (
          source_name,
          last_sync_start,
          last_sync_end,
          last_batch_id,
          last_success_at
        ) values ($1, $2, $3, $4, now())
        on conflict (source_name) do update set
          last_sync_start = excluded.last_sync_start,
          last_sync_end = excluded.last_sync_end,
          last_batch_id = excluded.last_batch_id,
          last_success_at = excluded.last_success_at
      `,
      [objectCode, startDate, endDate, batchId],
    );

    await client.query(
      `
        insert into object_publish_state (
          object_code,
          published_batch_id,
          previous_batch_id,
          publish_status,
          published_at
        ) values ($1, $2, null, 'published', now())
        on conflict (object_code) do update set
          previous_batch_id = object_publish_state.published_batch_id,
          published_batch_id = excluded.published_batch_id,
          publish_status = 'published',
          published_at = excluded.published_at,
          updated_at = now()
      `,
      [objectCode, batchId],
    );

    await client.query(
      `
        insert into sync_run_log (
          run_id,
          object_code,
          batch_id,
          run_status,
          started_at,
          ended_at,
          row_count,
          error_message
        ) values ($1, $2, $3, $4, $5, $6, $7, null)
      `,
      [runId, objectCode, batchId, runStatus, startedAt, endedAt, records.length],
    );

    await client.query("COMMIT");
    return {
      ok: true,
      object_code: objectCode,
      batch_id: batchId,
      row_count: records.length,
      storage_profile: storageProfile,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function main() {
  const accessFilePath = String(process.argv[2] || "").trim();
  if (!accessFilePath) {
    fail("tenant_data_access_file_required");
  }
  const accessPayload = JSON.parse(await fs.readFile(accessFilePath, "utf8"));
  const payload = JSON.parse((await readStdin()) || "{}");
  const mode = String(payload?.mode || "").trim().toLowerCase();
  const Client = resolvePgClientConstructor();
  let lastError = null;
  for (const candidate of buildConnectionCandidates(accessPayload)) {
    const client = new Client(candidate);
    try {
      await client.connect();
      const response =
        mode === "query"
          ? await runQuery(client, payload)
          : mode === "write_sql"
            ? await runWriteSql(client, payload)
            : mode === "execute_sync_plan"
              ? await runExecuteSyncPlan(client, payload)
            : null;
      if (!response) {
        fail(`unsupported_local_pg_mode:${mode || "unknown"}`);
      }
      process.stdout.write(JSON.stringify(response));
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryableConnectionError(error)) {
        break;
      }
    } finally {
      await client.end().catch(() => {});
    }
  }
  fail(lastError instanceof Error ? lastError.message : String(lastError || "tenant_local_pg_bridge_failed"));
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
