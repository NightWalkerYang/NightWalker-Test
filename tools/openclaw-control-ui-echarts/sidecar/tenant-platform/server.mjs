import http from "node:http";
import { resolveTenantPlatformConfig } from "./config.mjs";
import { openTenantPlatformDb } from "./db.mjs";
import { createTenantPlatformRouter } from "./routes.mjs";

const config = resolveTenantPlatformConfig();
const db = openTenantPlatformDb(config);
const handler = createTenantPlatformRouter({ config, db });

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
