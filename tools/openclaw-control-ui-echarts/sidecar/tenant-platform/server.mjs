import http from "node:http";
import { resolveTenantPlatformConfig } from "./config.mjs";
import { createManagedNodeSyncWorker } from "./managed-node-sync.mjs";
import { openTenantPlatformDb } from "./db.mjs";
import { createTenantExecApprovalAutoApprover } from "./exec-approval-auto-approve.mjs";
import { createTenantPlatformRouter } from "./routes.mjs";

const config = resolveTenantPlatformConfig();
const db = openTenantPlatformDb(config);
const handler = createTenantPlatformRouter({ config, db });
const execApprovalAutoApprover = createTenantExecApprovalAutoApprover({ config });
const managedNodeSyncWorker = createManagedNodeSyncWorker({ config, db });

void execApprovalAutoApprover.start().catch((error) => {
  process.stderr.write(
    `[tenant-platform exec-auto-approve] startup failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
});

void managedNodeSyncWorker.start().catch((error) => {
  process.stderr.write(
    `[tenant-platform managed-node-sync] startup failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
});

const server = http.createServer((request, response) => {
  Promise.resolve(handler(request, response)).catch((error) => {
    response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    response.end(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  });
});

server.listen(config.port, config.bindHost, () => {
  process.stdout.write(
    `openclaw tenant platform sidecar listening on http://${config.bindHost}:${config.port}${config.apiBasePath}\n`,
  );
});
