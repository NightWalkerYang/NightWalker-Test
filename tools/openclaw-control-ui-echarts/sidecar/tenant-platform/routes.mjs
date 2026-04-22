import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as parse5 from "parse5";
import { issueSessionToken, readSessionToken, verifyPassword } from "./auth.mjs";
import {
  createBootstrapLocalTenantAdmin,
  assignTenantAgentToUser,
  createBootstrapPlatformAdmin,
  deleteTenantMember,
  createTenantMember,
  createTenantWithAdmin,
  getBootstrapStatus,
  getTenantContextForUser,
  getUserByUsername,
  assignTenantAgentsToUser,
  listAssignedAgentsForUser,
  listAssignedAgentVisualizationsForUser,
  listTenants,
  listTenantAgents,
  listTenantMembers,
  listTenantUsageStats,
  listTenantUsageRecords,
  getTenantOverview,
  logAudit,
  readOpenClawAgentCatalog,
  registerTenantAgentSession,
  revokePlatformTenantAgents,
  revokeTenantAgentAssignments,
  syncTenantUsageRecords,
  updateTenantMemberLimit,
  updateTenantMemberPassword,
  updateTenantMemberStatus,
  upsertTenantAgent,
  hideTenantAgentSession,
  listTenantAgentSessions,
} from "./db.mjs";
import {
  readBrandingLogoAsset,
  readBrandingState,
  restoreBrandingState,
  saveBrandingState,
} from "./branding.mjs";
import { applyLocalRenewalCode, importLocalLicense, readLocalLicenseState } from "./license.mjs";

function sendJson(request, response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": request.headers.origin || "*",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
  });
  response.end(JSON.stringify(payload));
}

function sendBinary(request, response, statusCode, body, contentType) {
  response.writeHead(statusCode, {
    "content-type": contentType,
    "cache-control": "no-store",
    "access-control-allow-origin": request.headers.origin || "*",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
  });
  response.end(body);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8").trim();
        resolve(text ? JSON.parse(text) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function buildSessionPayload(user, tenantContext, config, localLicenseState) {
  const localReadonly = Boolean(config.edition === "local" && localLicenseState?.readonly);
  return {
    userId: user.id,
    username: user.username,
    role: user.role,
    tenantId: tenantContext?.tenantId ?? null,
    tenantName: tenantContext?.tenantName ?? null,
    deploymentMode: config.edition === "local" ? "local" : (tenantContext?.deploymentMode ?? null),
    readonly: localReadonly,
    edition: config.edition,
    licenseStatus: localLicenseState?.status ?? null,
    licenseExpiresAt: localLicenseState?.expiresAt ?? tenantContext?.licenseExpiresAt ?? null,
    customerName: localLicenseState?.customerName ?? null,
  };
}

function parseBearerToken(request) {
  const header = String(request.headers.authorization || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return header.slice(7).trim() || null;
}

function requireSession(request, response, deps) {
  const token = parseBearerToken(request);
  if (!token) {
    sendJson(request, response, 401, { ok: false, error: "missing_token" });
    return null;
  }
  const session = readSessionToken(token, deps.config.sessionSecret);
  if (!session?.userId) {
    sendJson(request, response, 401, { ok: false, error: "invalid_token" });
    return null;
  }
  return session;
}

function requireRole(request, response, session, allowedRoles) {
  if (!allowedRoles.includes(session.role)) {
    sendJson(request, response, 403, { ok: false, error: "forbidden" });
    return false;
  }
  return true;
}

function requireEditionRole(request, response, session, deps, cloudRoles, localRoles = cloudRoles) {
  const allowedRoles = deps.config.edition === "local" ? localRoles : cloudRoles;
  return requireRole(request, response, session, allowedRoles);
}

function requireLocalWritable(request, response, deps) {
  if (deps.config.edition !== "local") {
    return true;
  }
  const localLicense = readLocalLicenseState(deps.config);
  if (localLicense.status === "active") {
    return true;
  }
  sendJson(request, response, 403, {
    ok: false,
    error: localLicense.status === "expired" ? "license_readonly" : "license_unavailable",
    data: {
      localLicense,
    },
  });
  return false;
}

function normalizePath(basePath, pathname) {
  if (!pathname.startsWith(basePath)) {
    return null;
  }
  return pathname.slice(basePath.length) || "/";
}

function readTenantId(value) {
  return String(value || "").trim();
}

function readUserIds(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  }
  const normalized = String(value || "").trim();
  return normalized ? [normalized] : [];
}

function readAssignmentIds(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  }
  const normalized = String(value || "").trim();
  return normalized ? [normalized] : [];
}

function readTenantAgentIds(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  }
  const normalized = String(value || "").trim();
  return normalized ? [normalized] : [];
}

function readVisualizationToken(value) {
  return String(value || "").trim();
}

function buildEchartsViewHref(token) {
  return `/echarts-view/?token=${encodeURIComponent(token)}`;
}

const ECHARTS_VIEW_INLINE_SCRIPT_DIR = "__openclaw_echarts_view__";
const ECHARTS_VIEW_INLINE_SCRIPT_PREFIX = "inline-script";
const VISUALIZATION_RESOURCE_ATTRIBUTES = new Set(["src", "href", "data", "poster"]);
const VISUALIZATION_ALIAS_SAFE_PATH_RE = /^[A-Za-z0-9._/-]+$/;
const VISUALIZATION_SCRIPT_RESOURCE_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);
const EXECUTABLE_SCRIPT_TYPES = new Set([
  "",
  "module",
  "text/javascript",
  "application/javascript",
  "text/ecmascript",
  "application/ecmascript",
  "text/jscript",
  "application/x-javascript",
]);

function readAttributeValue(node, attributeName) {
  const match = node?.attrs?.find(
    (attribute) =>
      String(attribute?.name || "")
        .trim()
        .toLowerCase() === attributeName,
  );
  return String(match?.value || "");
}

function isExecutableScriptType(scriptType) {
  return EXECUTABLE_SCRIPT_TYPES.has(
    String(scriptType || "")
      .trim()
      .toLowerCase(),
  );
}

function isExecutableInlineScript(node) {
  if (
    !node ||
    String(node.tagName || "")
      .trim()
      .toLowerCase() !== "script"
  ) {
    return false;
  }
  if (readAttributeValue(node, "src")) {
    return false;
  }
  return isExecutableScriptType(readAttributeValue(node, "type"));
}

function readScriptText(node) {
  if (!Array.isArray(node?.childNodes) || node.childNodes.length === 0) {
    return "";
  }
  return node.childNodes
    .map((child) => {
      if (
        String(child?.nodeName || "")
          .trim()
          .toLowerCase() === "#text"
      ) {
        return String(child.value || "");
      }
      return readScriptText(child);
    })
    .join("");
}

function createVisualizationAssetSubdir(visualizationFileName) {
  const digest = crypto
    .createHash("sha256")
    .update(String(visualizationFileName || ""), "utf8")
    .digest("hex")
    .slice(0, 12);
  return `${ECHARTS_VIEW_INLINE_SCRIPT_DIR}-${digest}`;
}

function isAbsoluteOrSpecialHref(value) {
  return /^(?:[a-zA-Z][a-zA-Z\d+\-.]*:|\/\/|\/)/.test(value) || value.startsWith("#") || value.startsWith("?");
}

function buildWorkspaceAssetHref(workspaceBaseHref, relativePath) {
  const normalizedBaseHref = String(workspaceBaseHref || "").trim();
  const normalizedRelativePath = String(relativePath || "").trim();
  if (!normalizedRelativePath) {
    return "";
  }
  if (isAbsoluteOrSpecialHref(normalizedRelativePath) || !normalizedBaseHref) {
    return normalizedRelativePath;
  }
  const baseUrl = new URL(normalizedBaseHref, "http://127.0.0.1");
  const resolved = new URL(normalizedRelativePath, baseUrl);
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

function isPathInsideRoot(targetPath, rootPath) {
  const relativePath = path.relative(rootPath, targetPath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function normalizeVisualizationRelativePath(resourcePath) {
  return path.posix.normalize(String(resourcePath || "").trim()).replace(/^(\.\/)+/, "");
}

function needsVisualizationResourceAlias(resourcePath) {
  const normalizedPath = normalizeVisualizationRelativePath(resourcePath);
  if (!normalizedPath) {
    return false;
  }
  return !VISUALIZATION_ALIAS_SAFE_PATH_RE.test(normalizedPath);
}

function shouldForceVisualizationResourceAlias(nodeName, attributeName) {
  const normalizedNodeName = String(nodeName || "").trim().toLowerCase();
  const normalizedAttributeName = String(attributeName || "").trim().toLowerCase();
  return normalizedNodeName === "script" && normalizedAttributeName === "src";
}

function createVisualizationRewriteContext(
  workspaceBaseHref,
  generatedScriptDir,
  visualizationFileName,
  visualizationHrefMap = new Map(),
) {
  const generatedSubdir = createVisualizationAssetSubdir(visualizationFileName);
  return {
    generatedSubdir,
    generatedPathRoot: path.join(generatedScriptDir, generatedSubdir),
    generatedScriptDir,
    workspaceBaseHref: String(workspaceBaseHref || "").trim(),
    workspaceRootDir: path.dirname(generatedScriptDir),
    visualizationHrefMap,
    resourceAliasHrefMap: new Map(),
  };
}

function createVisualizationResourceAliasFileName(resourcePath) {
  const normalizedPath = normalizeVisualizationRelativePath(resourcePath);
  const extension = path.extname(normalizedPath).toLowerCase();
  const digest = crypto
    .createHash("sha256")
    .update(normalizedPath, "utf8")
    .digest("hex")
    .slice(0, 12);
  return `asset-${digest}${extension}`;
}

function splitHrefSuffix(value) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return { path: "", suffix: "" };
  }
  const queryIndex = normalizedValue.indexOf("?");
  const hashIndex = normalizedValue.indexOf("#");
  const suffixIndex = [queryIndex, hashIndex]
    .filter((index) => index >= 0)
    .reduce((minimum, index) => Math.min(minimum, index), normalizedValue.length);
  return {
    path: normalizedValue.slice(0, suffixIndex),
    suffix: normalizedValue.slice(suffixIndex),
  };
}

function materializeVisualizationResourceAlias(resourceHref, context) {
  const normalizedHref = String(resourceHref || "").trim();
  if (!normalizedHref) {
    return "";
  }
  const { path: hrefPath, suffix } = splitHrefSuffix(normalizedHref);
  const normalizedResourcePath = normalizeVisualizationRelativePath(hrefPath);
  if (!normalizedResourcePath) {
    return buildWorkspaceAssetHref(context.workspaceBaseHref, normalizedHref);
  }
  const cachedAliasHref = context.resourceAliasHrefMap.get(normalizedResourcePath);
  if (cachedAliasHref) {
    return `${cachedAliasHref}${suffix}`;
  }

  const sourcePath = path.resolve(context.generatedScriptDir, hrefPath);
  if (!isPathInsideRoot(sourcePath, context.workspaceRootDir)) {
    return buildWorkspaceAssetHref(context.workspaceBaseHref, normalizedHref);
  }

  let sourceStat;
  try {
    sourceStat = fs.statSync(sourcePath);
  } catch {
    return buildWorkspaceAssetHref(context.workspaceBaseHref, normalizedHref);
  }
  if (!sourceStat.isFile()) {
    return buildWorkspaceAssetHref(context.workspaceBaseHref, normalizedHref);
  }

  const aliasFileName = createVisualizationResourceAliasFileName(normalizedResourcePath);
  const aliasHref = buildWorkspaceAssetHref(
    context.workspaceBaseHref,
    path.posix.join(context.generatedSubdir, aliasFileName),
  );
  context.resourceAliasHrefMap.set(normalizedResourcePath, aliasHref);

  const extension = path.extname(normalizedResourcePath).toLowerCase();
  const sourceBuffer = fs.readFileSync(sourcePath);
  const outputBuffer = VISUALIZATION_SCRIPT_RESOURCE_EXTENSIONS.has(extension)
    ? Buffer.from(rewriteVisualizationScriptContent(sourceBuffer.toString("utf8"), context), "utf8")
    : sourceBuffer;

  fs.mkdirSync(context.generatedPathRoot, { recursive: true });
  fs.writeFileSync(path.join(context.generatedPathRoot, aliasFileName), outputBuffer);
  return `${aliasHref}${suffix}`;
}

function resolveVisualizationResourceHref(resourceHref, context, options = {}) {
  const normalizedHref = String(resourceHref || "").trim();
  if (!normalizedHref) {
    return "";
  }
  if (isAbsoluteOrSpecialHref(normalizedHref)) {
    return normalizedHref;
  }
  const { path: hrefPath, suffix } = splitHrefSuffix(normalizedHref);
  const targetFileName = path.posix.basename(hrefPath);
  if (
    targetFileName.toLowerCase().endsWith(".html") &&
    context.visualizationHrefMap instanceof Map &&
    context.visualizationHrefMap.has(targetFileName)
  ) {
    return `${context.visualizationHrefMap.get(targetFileName)}${suffix}`;
  }
  if (options.forceAlias || needsVisualizationResourceAlias(hrefPath)) {
    return materializeVisualizationResourceAlias(normalizedHref, context);
  }
  return buildWorkspaceAssetHref(context.workspaceBaseHref, normalizedHref);
}

function isVisualizationNavigationHref(resourceHref, context) {
  const normalizedHref = String(resourceHref || "").trim();
  if (!normalizedHref || isAbsoluteOrSpecialHref(normalizedHref)) {
    return false;
  }
  const { path: hrefPath } = splitHrefSuffix(normalizedHref);
  const targetFileName = path.posix.basename(hrefPath);
  return (
    targetFileName.toLowerCase().endsWith(".html") &&
    context.visualizationHrefMap instanceof Map &&
    context.visualizationHrefMap.has(targetFileName)
  );
}

function upsertNodeAttribute(node, attributeName, attributeValue) {
  const normalizedAttributeName = String(attributeName || "").trim().toLowerCase();
  if (!normalizedAttributeName) {
    return;
  }
  if (!Array.isArray(node?.attrs)) {
    node.attrs = [];
  }
  const existingAttribute = node.attrs.find(
    (attribute) =>
      String(attribute?.name || "")
        .trim()
        .toLowerCase() === normalizedAttributeName,
  );
  if (existingAttribute) {
    existingAttribute.value = String(attributeValue || "");
    return;
  }
  node.attrs.push({
    name: attributeName,
    value: String(attributeValue || ""),
  });
}

function rewriteVisualizationScriptContent(scriptContent, context) {
  let rewrittenScriptContent = String(scriptContent || "");
  const rewriteQuotedUrl = (pattern, prefixTransformer = null) =>
    rewrittenScriptContent.replace(pattern, (match, prefix, quote, url) => {
      const isVisualizationNavigation = isVisualizationNavigationHref(url, context);
      const resolvedHref = resolveVisualizationResourceHref(url, context);
      const rewrittenPrefix =
        typeof prefixTransformer === "function"
          ? prefixTransformer(prefix, isVisualizationNavigation)
          : prefix;
      return `${rewrittenPrefix}${quote}${resolvedHref}${quote}`;
    });

  // Keep executable inline scripts self-contained: resolve common URL-based APIs
  // against the workspace download path before writing the generated asset.
  rewrittenScriptContent = rewriteQuotedUrl(/(fetch\s*\(\s*)(['"])([^'"]+)\2/g);
  rewrittenScriptContent = rewriteQuotedUrl(/((?:window\.)?open\s*\(\s*)(['"])([^'"]+)\2/g);
  rewrittenScriptContent = rewriteQuotedUrl(
    /((?:window\.)?(?:location|document\.location)\.assign\s*\(\s*)(['"])([^'"]+)\2/g,
    (prefix, isVisualizationNavigation) =>
      isVisualizationNavigation ? "window.top.location.assign(" : prefix,
  );
  rewrittenScriptContent = rewriteQuotedUrl(
    /((?:window\.)?(?:location|document\.location)\.replace\s*\(\s*)(['"])([^'"]+)\2/g,
    (prefix, isVisualizationNavigation) =>
      isVisualizationNavigation ? "window.top.location.replace(" : prefix,
  );
  rewrittenScriptContent = rewriteQuotedUrl(
    /((?:window\.)?(?:location|document\.location)\.href\s*=\s*)(['"])([^'"]+)\2/g,
    (prefix, isVisualizationNavigation) =>
      isVisualizationNavigation ? "window.top.location.href = " : prefix,
  );
  rewrittenScriptContent = rewriteQuotedUrl(
    /((?:window\.)?(?:location|document\.location)\s*=\s*)(['"])([^'"]+)\2/g,
    (prefix, isVisualizationNavigation) =>
      isVisualizationNavigation ? "window.top.location = " : prefix,
  );
  rewrittenScriptContent = rewriteQuotedUrl(/((?:[\w$]+\.)+href\s*=\s*)(['"])([^'"]+)\2/g);
  rewrittenScriptContent = rewriteQuotedUrl(/((?:[\w$]+\.)+src\s*=\s*)(['"])([^'"]+)\2/g);

  return rewrittenScriptContent;
}

function rewriteVisualizationHtml(
  html,
  workspaceBaseHref,
  generatedScriptDir,
  visualizationFileName,
  visualizationHrefMap = new Map(),
) {
  const document = parse5.parse(String(html || ""));
  const context = createVisualizationRewriteContext(
    workspaceBaseHref,
    generatedScriptDir,
    visualizationFileName,
    visualizationHrefMap,
  );
  let inlineScriptIndex = 0;

  const rewriteAttributes = (node) => {
    if (!Array.isArray(node?.attrs) || node.attrs.length === 0) {
      return;
    }
    const nodeName = String(node?.nodeName || "").trim().toLowerCase();
    for (const attr of node.attrs) {
      const attributeName = String(attr?.name || "").trim().toLowerCase();
      if (attributeName.startsWith("on")) {
        attr.value = rewriteVisualizationScriptContent(attr.value, context);
        continue;
      }
      if (!VISUALIZATION_RESOURCE_ATTRIBUTES.has(attributeName)) {
        continue;
      }
      const originalValue = String(attr?.value || "");
      attr.value = resolveVisualizationResourceHref(
        originalValue,
        context,
        {
          forceAlias: shouldForceVisualizationResourceAlias(nodeName, attributeName),
        },
      );
      if (
        nodeName === "a" &&
        attributeName === "href" &&
        isVisualizationNavigationHref(originalValue, context)
      ) {
        upsertNodeAttribute(node, "target", "_top");
      }
    }
  };

  const visit = (node) => {
    if (node?.content) {
      visit(node.content);
    }
    rewriteAttributes(node);
    if (!Array.isArray(node?.childNodes) || node.childNodes.length === 0) {
      return;
    }
    for (let index = 0; index < node.childNodes.length; index += 1) {
      const child = node.childNodes[index];
      if (isExecutableInlineScript(child)) {
        const scriptContent = readScriptText(child).replace(/\r\n?/g, "\n");
        const rewrittenScriptContent = rewriteVisualizationScriptContent(scriptContent, context);
        const scriptHash = crypto
          .createHash("sha256")
          .update(rewrittenScriptContent, "utf8")
          .digest("hex")
          .slice(0, 12);
        const scriptFileName = `${ECHARTS_VIEW_INLINE_SCRIPT_PREFIX}-${inlineScriptIndex + 1}-${scriptHash}.js`;
        fs.mkdirSync(context.generatedPathRoot, { recursive: true });
        fs.writeFileSync(
          path.join(context.generatedPathRoot, scriptFileName),
          rewrittenScriptContent,
          "utf8",
        );
        const scriptHref = buildWorkspaceAssetHref(
          context.workspaceBaseHref,
          path.posix.join(context.generatedSubdir, scriptFileName),
        );
        const nextAttrs = [];
        for (const attr of Array.isArray(child.attrs) ? child.attrs : []) {
          const attrName = String(attr?.name || "").trim();
          if (!attrName || attrName.toLowerCase() === "src") {
            continue;
          }
          nextAttrs.push({
            name: attrName,
            value: String(attr?.value || ""),
          });
        }
        nextAttrs.push({ name: "src", value: scriptHref });
        node.childNodes[index] = {
          ...child,
          attrs: nextAttrs,
          childNodes: [],
        };
        inlineScriptIndex += 1;
        continue;
      }
      visit(child);
    }
  };

  visit(document);
  return parse5.serialize(document);
}

function buildWorkspaceAgentDownloadHref(segments) {
  const pathname = Array.isArray(segments) ? segments : [];
  const encoded = pathname
    .map((segment) => encodeURIComponent(String(segment || "").trim()))
    .join("/");
  return `/${encoded}`;
}

function buildWorkspaceAgentDownloadBaseHref(derivedAgentId) {
  return buildWorkspaceAgentDownloadHref([
    "workspace-agent-downloads",
    derivedAgentId,
    "Echarts",
    "",
  ]);
}

function readMemberVisualizationTokenPayload(token, secret) {
  const payload = readSessionToken(token, secret);
  if (!payload || typeof payload !== "object") {
    return null;
  }
  if (String(payload.purpose || "").trim() !== "member_visualization") {
    return null;
  }
  const tenantId = String(payload.tenantId || "").trim();
  const userId = String(payload.userId || "").trim();
  const derivedAgentId = String(payload.derivedAgentId || "").trim();
  const visualizationFileName = String(payload.visualizationFileName || "").trim();
  if (!tenantId || !userId || !derivedAgentId || !visualizationFileName) {
    return null;
  }
  return {
    tenantId,
    userId,
    derivedAgentId,
    visualizationFileName,
  };
}

export function createTenantPlatformRouter(deps) {
  return async function handleTenantPlatformRequest(request, response) {
    const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
    const relativePath = normalizePath(deps.config.apiBasePath, url.pathname);
    const configAgents = readOpenClawAgentCatalog(deps.config.configPath);
    const localLicense = readLocalLicenseState(deps.config);

    if (request.method === "OPTIONS") {
      sendJson(request, response, 204, {});
      return;
    }

    if (url.pathname === "/healthz") {
      sendJson(request, response, 200, { ok: true });
      return;
    }

    if (!relativePath) {
      sendJson(request, response, 404, { ok: false, error: "not_found" });
      return;
    }

    if (request.method === "GET" && relativePath === "/bootstrap") {
      sendJson(request, response, 200, {
        ok: true,
        data: {
          ...getBootstrapStatus(deps.db, deps.config.edition),
          apiBasePath: deps.config.apiBasePath,
          edition: deps.config.edition,
          localLicense,
          configAgents,
        },
      });
      return;
    }

    if (request.method === "GET" && relativePath === "/public/branding") {
      sendJson(request, response, 200, {
        ok: true,
        data: readBrandingState(deps.config),
      });
      return;
    }

    if (request.method === "GET" && relativePath === "/public/branding/logo") {
      const asset = readBrandingLogoAsset(deps.config);
      if (!asset) {
        sendJson(request, response, 404, { ok: false, error: "branding_logo_not_found" });
        return;
      }
      sendBinary(request, response, 200, asset.buffer, asset.mimeType);
      return;
    }

    if (request.method === "POST" && relativePath === "/setup/platform-admin") {
      if (deps.config.edition === "local") {
        sendJson(request, response, 400, { ok: false, error: "local_edition_uses_tenant_admin" });
        return;
      }
      try {
        const body = await readJsonBody(request);
        const user = createBootstrapPlatformAdmin(deps.db, {
          username: String(body.username || "").trim(),
          password: String(body.password || ""),
        });
        const session = buildSessionPayload(user, null, deps.config, localLicense);
        sendJson(request, response, 200, {
          ok: true,
          data: {
            token: issueSessionToken(session, deps.config.sessionSecret),
            session,
          },
        });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/setup/local-tenant-admin") {
      if (deps.config.edition !== "local") {
        sendJson(request, response, 400, { ok: false, error: "local_edition_required" });
        return;
      }
      try {
        const body = await readJsonBody(request);
        const user = createBootstrapLocalTenantAdmin(deps.db, {
          username: String(body.username || "").trim(),
          password: String(body.password || ""),
          tenantName: localLicense.customerName || "本地租户",
        });
        const tenantContext = getTenantContextForUser(deps.db, user.id);
        const session = buildSessionPayload(user, tenantContext, deps.config, localLicense);
        sendJson(request, response, 200, {
          ok: true,
          data: {
            token: issueSessionToken(session, deps.config.sessionSecret),
            session,
          },
        });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/login") {
      try {
        const body = await readJsonBody(request);
        const user = getUserByUsername(deps.db, String(body.username || "").trim());
        if (!user || !verifyPassword(String(body.password || ""), user.password_hash)) {
          sendJson(request, response, 401, { ok: false, error: "invalid_credentials" });
          return;
        }
        if (user.status !== "active") {
          sendJson(request, response, 403, { ok: false, error: "account_disabled" });
          return;
        }
        const tenantContext = user.tenantId ? getTenantContextForUser(deps.db, user.id) : null;
        if (
          deps.config.edition === "local" &&
          user.role === "member" &&
          (localLicense.status === "missing" || localLicense.status === "invalid")
        ) {
          sendJson(request, response, 403, {
            ok: false,
            error: "license_unavailable",
            data: { localLicense },
          });
          return;
        }
        if (tenantContext?.tenantStatus === "frozen") {
          sendJson(request, response, 403, { ok: false, error: "tenant_frozen" });
          return;
        }
        const session = buildSessionPayload(user, tenantContext, deps.config, localLicense);
        sendJson(request, response, 200, {
          ok: true,
          data: {
            token: issueSessionToken(session, deps.config.sessionSecret),
            session,
          },
        });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/logout") {
      sendJson(request, response, 200, { ok: true });
      return;
    }

    if (request.method === "PUT" && relativePath === "/platform/branding") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["platform_admin"])) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const state = saveBrandingState(deps.config, body);
        sendJson(request, response, 200, { ok: true, data: state });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "DELETE" && relativePath === "/platform/branding") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["platform_admin"])) {
        return;
      }
      sendJson(request, response, 200, {
        ok: true,
        data: restoreBrandingState(deps.config),
      });
      return;
    }

    if (request.method === "GET" && relativePath === "/me") {
      const session = requireSession(request, response, deps);
      if (!session) {
        return;
      }
      const user = getUserByUsername(deps.db, session.username);
      if (user?.status !== "active") {
        sendJson(request, response, 403, { ok: false, error: "account_disabled" });
        return;
      }
      const tenant = session.tenantId ? getTenantContextForUser(deps.db, session.userId) : null;
      sendJson(request, response, 200, {
        ok: true,
        data: {
          session,
          tenant,
          edition: deps.config.edition,
          localLicense,
        },
      });
      return;
    }

    if (request.method === "GET" && relativePath === "/platform/local-license") {
      const session = requireSession(request, response, deps);
      if (
        !session ||
        !requireEditionRole(request, response, session, deps, ["platform_admin"], ["tenant_admin"])
      ) {
        return;
      }
      sendJson(request, response, 200, { ok: true, data: localLicense });
      return;
    }

    if (request.method === "POST" && relativePath === "/platform/local-license/import") {
      const session = requireSession(request, response, deps);
      if (
        !session ||
        !requireEditionRole(request, response, session, deps, ["platform_admin"], ["tenant_admin"])
      ) {
        return;
      }
      if (deps.config.edition !== "local") {
        sendJson(request, response, 400, { ok: false, error: "local_edition_required" });
        return;
      }
      try {
        const body = await readJsonBody(request);
        const nextLicense = importLocalLicense(deps.config, body.licenseText || body.license);
        sendJson(request, response, 200, { ok: true, data: nextLicense });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/platform/local-license/renew") {
      const session = requireSession(request, response, deps);
      if (
        !session ||
        !requireEditionRole(request, response, session, deps, ["platform_admin"], ["tenant_admin"])
      ) {
        return;
      }
      if (deps.config.edition !== "local") {
        sendJson(request, response, 400, { ok: false, error: "local_edition_required" });
        return;
      }
      try {
        const body = await readJsonBody(request);
        const nextLicense = applyLocalRenewalCode(deps.config, body.renewalCode);
        sendJson(request, response, 200, { ok: true, data: nextLicense });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "GET" && relativePath === "/platform/tenants") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["platform_admin"])) {
        return;
      }
      sendJson(request, response, 200, { ok: true, data: listTenants(deps.db) });
      return;
    }

    if (request.method === "POST" && relativePath === "/platform/tenants") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["platform_admin"])) {
        return;
      }
      if (!requireLocalWritable(request, response, deps)) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const tenant = createTenantWithAdmin(deps.db, {
          code: String(body.code || "").trim(),
          name: String(body.name || "").trim(),
          adminUsername: String(body.adminUsername || "").trim(),
          adminPassword: String(body.adminPassword || ""),
          memberLimit: Number.parseInt(String(body.memberLimit || "5"), 10),
          deploymentMode:
            deps.config.edition === "local"
              ? "local"
              : body.deploymentMode === "local"
                ? "local"
                : "cloud",
          licenseExpiresAt:
            deps.config.edition === "local"
              ? null
              : String(body.licenseExpiresAt || "").trim() || null,
          renewalCode:
            deps.config.edition === "local" ? null : String(body.renewalCode || "").trim() || null,
        });
        logAudit(deps.db, {
          userId: session.userId,
          action: "tenant.create",
          resourceType: "tenant",
          resourceId: tenant.id,
          payloadJson: { code: tenant.code, name: tenant.name },
        });
        sendJson(request, response, 200, { ok: true, data: tenant });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/platform/tenant-member-limit") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["platform_admin"])) {
        return;
      }
      if (!requireLocalWritable(request, response, deps)) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const tenant = updateTenantMemberLimit(deps.db, {
          tenantId: body.tenantId,
          memberLimit: body.memberLimit,
        });
        logAudit(deps.db, {
          userId: session.userId,
          action: "tenant.member_limit.update",
          resourceType: "tenant",
          resourceId: tenant?.id || null,
          payloadJson: {
            tenantId: body.tenantId,
            memberLimit: body.memberLimit,
          },
        });
        sendJson(request, response, 200, { ok: true, data: tenant });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "GET" && relativePath === "/platform/catalog-agents") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["platform_admin"])) {
        return;
      }
      sendJson(request, response, 200, { ok: true, data: configAgents });
      return;
    }

    if (request.method === "GET" && relativePath === "/platform/tenant-members") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["platform_admin"])) {
        return;
      }
      const tenantId = readTenantId(url.searchParams.get("tenantId"));
      if (!tenantId) {
        sendJson(request, response, 400, { ok: false, error: "tenant_id_required" });
        return;
      }
      sendJson(request, response, 200, { ok: true, data: listTenantMembers(deps.db, tenantId) });
      return;
    }

    if (request.method === "GET" && relativePath === "/platform/tenant-agents") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["platform_admin"])) {
        return;
      }
      const tenantId = readTenantId(url.searchParams.get("tenantId"));
      if (!tenantId) {
        sendJson(request, response, 400, { ok: false, error: "tenant_id_required" });
        return;
      }
      sendJson(request, response, 200, {
        ok: true,
        data: listTenantAgents(deps.db, tenantId, configAgents),
      });
      return;
    }

    if (request.method === "POST" && relativePath === "/platform/tenant-agents") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["platform_admin"])) {
        return;
      }
      if (!requireLocalWritable(request, response, deps)) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const tenantId = readTenantId(body.tenantId);
        if (!tenantId) {
          sendJson(request, response, 400, { ok: false, error: "tenant_id_required" });
          return;
        }
        const tenantAgentId = upsertTenantAgent(deps.db, {
          tenantId,
          agentId: String(body.agentId || "").trim(),
          description: String(body.description || "").trim(),
          rateMultiplier:
            deps.config.edition === "local"
              ? 1
              : Number.parseFloat(String(body.rateMultiplier || "1")) || 1,
          balancePoints:
            deps.config.edition === "local"
              ? 0
              : Number.parseFloat(String(body.balancePoints || "0")) || 0,
          status: "active",
        });
        const agent = listTenantAgents(deps.db, tenantId, configAgents).find(
          (item) => item.id === tenantAgentId,
        );
        sendJson(request, response, 200, { ok: true, data: agent ?? null });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/platform/revoke-tenant-agents") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["platform_admin"])) {
        return;
      }
      if (!requireLocalWritable(request, response, deps)) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const tenantId = readTenantId(body.tenantId);
        if (!tenantId) {
          sendJson(request, response, 400, { ok: false, error: "tenant_id_required" });
          return;
        }
        const tenantAgentIds = readTenantAgentIds(body.tenantAgentIds ?? body.tenantAgentId);
        const result = revokePlatformTenantAgents(deps.db, {
          tenantId,
          tenantAgentIds,
        });
        logAudit(deps.db, {
          userId: session.userId,
          tenantId,
          action: "platform.tenant_agent.revoke",
          resourceType: "tenant",
          resourceId: tenantId,
          payloadJson: {
            tenantId,
            tenantAgentIds,
            revokedTenantAgentIds: result.tenantAgentIds,
            revokedTenantAgentCount: result.revokedTenantAgentCount,
            revokedAssignmentCount: result.revokedAssignmentCount,
            affectedUserIds: result.affectedUserIds,
          },
        });
        sendJson(request, response, 200, { ok: true, data: result });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "GET" && relativePath === "/tenant/admin/members") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      sendJson(request, response, 200, {
        ok: true,
        data: listTenantMembers(deps.db, session.tenantId),
      });
      return;
    }

    if (request.method === "POST" && relativePath === "/tenant/admin/members") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      if (!requireLocalWritable(request, response, deps)) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const member = createTenantMember(deps.db, {
          tenantId: session.tenantId,
          username: String(body.username || "").trim(),
          password: String(body.password || ""),
        });
        sendJson(request, response, 200, { ok: true, data: member });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/tenant/admin/members/password") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      if (!requireLocalWritable(request, response, deps)) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const member = updateTenantMemberPassword(deps.db, {
          tenantId: session.tenantId,
          userId: String(body.userId || "").trim(),
          password: String(body.password || ""),
        });
        logAudit(deps.db, {
          userId: session.userId,
          tenantId: session.tenantId,
          action: "tenant.member.password.update",
          resourceType: "member",
          resourceId: member?.id || String(body.userId || "").trim() || null,
          payloadJson: {
            userId: String(body.userId || "").trim(),
            username: member?.username || null,
          },
        });
        sendJson(request, response, 200, { ok: true, data: member });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/tenant/admin/members/status") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      if (!requireLocalWritable(request, response, deps)) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const member = updateTenantMemberStatus(deps.db, {
          tenantId: session.tenantId,
          userId: String(body.userId || "").trim(),
          status: String(body.status || "").trim(),
        });
        logAudit(deps.db, {
          userId: session.userId,
          tenantId: session.tenantId,
          action: "tenant.member.status.update",
          resourceType: "member",
          resourceId: member?.id || String(body.userId || "").trim() || null,
          payloadJson: {
            userId: String(body.userId || "").trim(),
            status: member?.status || String(body.status || "").trim() || null,
          },
        });
        sendJson(request, response, 200, { ok: true, data: member });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/tenant/admin/members/delete") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      if (!requireLocalWritable(request, response, deps)) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const member = deleteTenantMember(deps.db, {
          tenantId: session.tenantId,
          userId: String(body.userId || "").trim(),
          configDir: deps.config?.configDir,
          configPath: deps.config?.configPath,
        });
        logAudit(deps.db, {
          userId: session.userId,
          tenantId: session.tenantId,
          action: "tenant.member.delete",
          resourceType: "member",
          resourceId: member?.id || String(body.userId || "").trim() || null,
          payloadJson: {
            userId: String(body.userId || "").trim(),
            username: member?.username || null,
            revokedAssignmentCount: Number(member?.revokedAssignmentCount || 0),
            removedWorkspaceCount: Number(member?.removedWorkspaceCount || 0),
          },
        });
        sendJson(request, response, 200, { ok: true, data: member });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "GET" && relativePath === "/tenant/admin/tenant-agents") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      sendJson(request, response, 200, {
        ok: true,
        data: listTenantAgents(deps.db, session.tenantId, configAgents),
      });
      return;
    }

    if (request.method === "POST" && relativePath === "/tenant/admin/assign-agent") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      if (!requireLocalWritable(request, response, deps)) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const tenantAgentIds = readAssignmentIds(body.tenantAgentIds ?? body.tenantAgentId);
        const assignment = assignTenantAgentsToUser(deps.db, {
          tenantId: session.tenantId,
          userId: String(body.userId || "").trim(),
          tenantAgentIds,
          configPath: deps.config.configPath,
          configDir: deps.config.configDir,
        });
        logAudit(deps.db, {
          userId: session.userId,
          tenantId: session.tenantId,
          action: "tenant.member.agent_assignment.assign",
          resourceType: "member",
          resourceId: String(body.userId || "").trim() || null,
          payloadJson: {
            userId: String(body.userId || "").trim(),
            tenantAgentIds,
            assignmentIds: assignment.assignmentIds,
            assignedAssignmentCount: assignment.assignedAssignmentCount,
          },
        });
        sendJson(request, response, 200, {
          ok: true,
          data: {
            assignmentId: assignment.assignmentId,
            derivedAgentId: assignment.derivedAgentId,
            assignmentIds: assignment.assignmentIds,
            derivedAgentIds: assignment.derivedAgentIds,
            assignedAssignmentCount: assignment.assignedAssignmentCount,
            affectedUserIds: assignment.affectedUserIds,
            affectedMemberCount: assignment.affectedMemberCount,
          },
        });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "GET" && relativePath === "/tenant/admin/members/agents") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      const userId = String(url.searchParams.get("userId") || "").trim();
      if (!userId) {
        sendJson(request, response, 400, { ok: false, error: "user_id_required" });
        return;
      }
      const member = deps.db
        .prepare(
          `SELECT u.id
           FROM users u
           JOIN tenant_memberships tm ON tm.user_id = u.id
           WHERE tm.tenant_id = ? AND tm.role = 'member' AND tm.status = 'active' AND u.id = ?`,
        )
        .get(session.tenantId, userId);
      if (!member) {
        sendJson(request, response, 404, { ok: false, error: "member_not_found" });
        return;
      }
      sendJson(request, response, 200, {
        ok: true,
        data: listAssignedAgentsForUser(
          deps.db,
          {
            userId,
            configPath: deps.config.configPath,
            configDir: deps.config.configDir,
          },
          configAgents,
        ),
      });
      return;
    }

    if (request.method === "POST" && relativePath === "/tenant/admin/revoke-agent-assignments") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      if (!requireLocalWritable(request, response, deps)) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const userIds = readUserIds(body.userIds ?? body.userId);
        const assignmentIds = readAssignmentIds(body.assignmentIds ?? body.assignmentId);
        const result = revokeTenantAgentAssignments(deps.db, {
          tenantId: session.tenantId,
          userIds,
          userId: String(body.userId || "").trim(),
          assignmentIds,
        });
        logAudit(deps.db, {
          userId: session.userId,
          tenantId: session.tenantId,
          action: "tenant.member.agent_assignment.revoke",
          resourceType: "member",
          resourceId:
            result.affectedUserIds[0] || String(body.userId || "").trim() || userIds[0] || null,
          payloadJson: {
            userIds,
            assignmentIds,
            affectedUserIds: result.affectedUserIds,
            revokedAssignmentCount: result.revokedAssignmentCount,
          },
        });
        sendJson(request, response, 200, { ok: true, data: result });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "GET" && relativePath === "/tenant/admin/usage-stats") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      try {
        const hasPagedRecordQuery =
          url.searchParams.has("page") ||
          url.searchParams.has("pageSize") ||
          url.searchParams.has("search");
        if (hasPagedRecordQuery) {
          const result = listTenantUsageRecords(deps.db, {
            tenantId: session.tenantId,
            search: url.searchParams.get("search") || "",
            page: url.searchParams.get("page"),
            pageSize: url.searchParams.get("pageSize"),
          });
          const configMap = new Map((configAgents || []).map((entry) => [entry.id, entry]));
          const items = result.items.map((row) => {
            const configEntry = configMap.get(row.agentId) ?? null;
            return {
              ...row,
              agentName: configEntry?.name ?? row.agentId ?? "-",
              agentEmoji: configEntry?.emoji ?? null,
            };
          });
          sendJson(request, response, 200, {
            ok: true,
            data: {
              items,
              total: result.total,
              page: result.page,
              pageSize: result.pageSize,
            },
          });
          return;
        }
        sendJson(request, response, 200, {
          ok: true,
          data: listTenantUsageStats(
            deps.db,
            {
              tenantId: session.tenantId,
              startDate: url.searchParams.get("startDate"),
              endDate: url.searchParams.get("endDate"),
            },
            configAgents,
          ),
        });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "GET" && relativePath === "/tenant/admin/overview") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["tenant_admin"])) {
        return;
      }
      try {
        const data = getTenantOverview(deps.db, { tenantId: session.tenantId }, configAgents);
        sendJson(request, response, 200, { ok: true, data });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "GET" && relativePath === "/member/agents") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["member"])) {
        return;
      }
      sendJson(request, response, 200, {
        ok: true,
        data: listAssignedAgentsForUser(
          deps.db,
          {
            ...session,
            configPath: deps.config.configPath,
            configDir: deps.config.configDir,
          },
          configAgents,
        ),
      });
      return;
    }

    if (request.method === "GET" && relativePath === "/member/visualizations") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["member"])) {
        return;
      }
      const visualizations = listAssignedAgentVisualizationsForUser(
        deps.db,
        {
          ...session,
          configPath: deps.config.configPath,
          configDir: deps.config.configDir,
        },
        configAgents,
      ).map((item) => {
        const token = issueSessionToken(
          {
            purpose: "member_visualization",
            tenantId: item.tenantId,
            userId: item.userId,
            derivedAgentId: item.derivedAgentId,
            visualizationFileName: item.visualizationFileName,
          },
          deps.config.sessionSecret,
        );
        const title = item.agentName
          ? `${item.visualizationName} · ${item.agentName}`
          : item.visualizationName;
        return {
          id: `${item.derivedAgentId}:${item.visualizationFileName}`,
          agentId: item.derivedAgentId,
          baseAgentId: item.baseAgentId,
          agentName: item.agentName,
          visualizationFileName: item.visualizationFileName,
          visualizationName: item.visualizationName,
          title,
          token,
          href: buildEchartsViewHref(token),
        };
      });
      sendJson(request, response, 200, {
        ok: true,
        data: visualizations,
      });
      return;
    }

    if (request.method === "GET" && relativePath === "/member/visualizations/resolve") {
      const token = readVisualizationToken(url.searchParams.get("token"));
      if (!token) {
        sendJson(request, response, 400, { ok: false, error: "missing_fields" });
        return;
      }
      const payload = readMemberVisualizationTokenPayload(token, deps.config.sessionSecret);
      if (!payload) {
        sendJson(request, response, 401, { ok: false, error: "invalid_token" });
        return;
      }
      const visualizations = listAssignedAgentVisualizationsForUser(
        deps.db,
        {
          tenantId: payload.tenantId,
          userId: payload.userId,
          configPath: deps.config.configPath,
          configDir: deps.config.configDir,
        },
        configAgents,
      );
      const visualizationHrefMap = new Map();
      for (const item of visualizations) {
        if (String(item?.derivedAgentId || "").trim() !== payload.derivedAgentId) {
          continue;
        }
        const tokenForVisualization = issueSessionToken(
          {
            purpose: "member_visualization",
            tenantId: payload.tenantId,
            userId: payload.userId,
            derivedAgentId: item.derivedAgentId,
            visualizationFileName: item.visualizationFileName,
          },
          deps.config.sessionSecret,
        );
        visualizationHrefMap.set(item.visualizationFileName, buildEchartsViewHref(tokenForVisualization));
      }
      const match = visualizations.find(
        (item) =>
          item.derivedAgentId === payload.derivedAgentId &&
          item.visualizationFileName === payload.visualizationFileName,
      );
      if (!match) {
        sendJson(request, response, 404, { ok: false, error: "visualization_not_found" });
        return;
      }
      const workspaceRoot = String(match.derivedWorkspaceDir || "").trim();
      if (!workspaceRoot) {
        sendJson(request, response, 404, { ok: false, error: "visualization_not_found" });
        return;
      }
      const visualizationPath = path.join(workspaceRoot, "Echarts", match.visualizationFileName);
      try {
        const html = fs.readFileSync(visualizationPath, "utf8");
        const workspaceBaseHref = buildWorkspaceAgentDownloadBaseHref(match.derivedAgentId);
        const generatedScriptHtml = rewriteVisualizationHtml(
          html,
          workspaceBaseHref,
          path.join(workspaceRoot, "Echarts"),
          match.visualizationFileName,
          visualizationHrefMap,
        );
        sendJson(request, response, 200, {
          ok: true,
          data: {
            html: generatedScriptHtml,
            baseHref: workspaceBaseHref,
            href: buildWorkspaceAgentDownloadHref([
              "workspace-agent-downloads",
              match.derivedAgentId,
              "Echarts",
              match.visualizationFileName,
            ]),
            visualizationName: match.visualizationName,
            agentName: match.agentName,
            agentId: match.derivedAgentId,
          },
        });
      } catch {
        sendJson(request, response, 404, {
          ok: false,
          error: "visualization_not_found",
        });
      }
      return;
    }

    if (request.method === "GET" && relativePath === "/member/sessions") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["member"])) {
        return;
      }
      const tenantAgentId = String(url.searchParams.get("tenantAgentId") || "").trim();
      if (!tenantAgentId) {
        sendJson(request, response, 400, { ok: false, error: "tenant_agent_id_required" });
        return;
      }
      sendJson(request, response, 200, {
        ok: true,
        data: listTenantAgentSessions(deps.db, { userId: session.userId, tenantAgentId }),
      });
      return;
    }

    if (request.method === "POST" && relativePath === "/member/sessions") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["member"])) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const tenantAgentId = String(body.tenantAgentId || "").trim();
        const openclawSessionKey = String(body.openclawSessionKey || "").trim();
        if (!tenantAgentId || !openclawSessionKey) {
          sendJson(request, response, 400, { ok: false, error: "missing_fields" });
          return;
        }
        const sessionId = registerTenantAgentSession(deps.db, {
          tenantId: session.tenantId,
          userId: session.userId,
          tenantAgentId,
          openclawSessionKey,
          title: String(body.title || "").trim() || "新会话",
        });
        sendJson(request, response, 200, { ok: true, data: { sessionId } });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/member/usage-records/sync") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["member"])) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const tenantAgentId = String(body.tenantAgentId || "").trim();
        const openclawSessionKey = String(body.openclawSessionKey || "").trim();
        if (!tenantAgentId || !openclawSessionKey) {
          sendJson(request, response, 400, { ok: false, error: "missing_fields" });
          return;
        }
        const result = syncTenantUsageRecords(deps.db, {
          tenantId: session.tenantId,
          userId: session.userId,
          tenantAgentId,
          openclawSessionKey,
          records: Array.isArray(body.records) ? body.records : [],
        });
        sendJson(request, response, 200, { ok: true, data: result });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/member/sessions/hide") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["member"])) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const openclawSessionKey = String(body.openclawSessionKey || "").trim();
        if (!openclawSessionKey) {
          sendJson(request, response, 400, { ok: false, error: "missing_fields" });
          return;
        }
        hideTenantAgentSession(deps.db, {
          userId: session.userId,
          openclawSessionKey,
        });
        sendJson(request, response, 200, { ok: true });
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && relativePath === "/member/sessions/delete") {
      const session = requireSession(request, response, deps);
      if (!session || !requireRole(request, response, session, ["member"])) {
        return;
      }
      try {
        const body = await readJsonBody(request);
        const openclawSessionKey = String(body.openclawSessionKey || "").trim();
        if (!openclawSessionKey) {
          sendJson(request, response, 400, { ok: false, error: "missing_fields" });
          return;
        }
        deps.db.exec("BEGIN TRANSACTION");
        try {
          deps.db
            .prepare(
              `DELETE FROM tenant_agent_sessions
             WHERE user_id = @userId AND openclaw_session_key = @openclawSessionKey`,
            )
            .run({
              userId: session.userId,
              openclawSessionKey,
            });
          deps.db.exec("COMMIT");
          sendJson(request, response, 200, { ok: true });
        } catch (err) {
          deps.db.exec("ROLLBACK");
          throw err;
        }
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    sendJson(request, response, 404, { ok: false, error: "not_found" });
  };
}
