#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSON5 from "json5";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultSourcePath = path.join(here, "openclaw.local.example.json5");

const defaultPortableConfig = {
  gateway: {
    mode: "local",
    bind: "loopback",
    port: 18789,
    tailscale: {
      mode: "off",
      resetOnExit: false,
    },
    nodes: {
      denyCommands: [
        "camera.snap",
        "camera.clip",
        "screen.record",
        "contacts.add",
        "calendar.add",
        "reminders.add",
        "sms.send",
      ],
    },
  },
  models: {
    mode: "merge",
    providers: {
      zai: {
        baseUrl: "https://open.bigmodel.cn/api/paas/v4",
        api: "openai-completions",
        models: [
          {
            id: "glm-5",
            name: "GLM-5",
            reasoning: true,
            input: ["text"],
            cost: {
              input: 1,
              output: 3.2,
              cacheRead: 0.2,
              cacheWrite: 0,
            },
            contextWindow: 202800,
            maxTokens: 131100,
          },
          {
            id: "glm-5-turbo",
            name: "GLM-5 Turbo",
            reasoning: true,
            input: ["text"],
            cost: {
              input: 1.2,
              output: 4,
              cacheRead: 0.24,
              cacheWrite: 0,
            },
            contextWindow: 202800,
            maxTokens: 131100,
          },
          {
            id: "glm-4.7",
            name: "GLM-4.7",
            reasoning: true,
            input: ["text"],
            cost: {
              input: 0.6,
              output: 2.2,
              cacheRead: 0.11,
              cacheWrite: 0,
            },
            contextWindow: 204800,
            maxTokens: 131072,
          },
          {
            id: "glm-4.7-flash",
            name: "GLM-4.7 Flash",
            reasoning: true,
            input: ["text"],
            cost: {
              input: 0.07,
              output: 0.4,
              cacheRead: 0,
              cacheWrite: 0,
            },
            contextWindow: 200000,
            maxTokens: 131072,
          },
          {
            id: "glm-4.7-flashx",
            name: "GLM-4.7 FlashX",
            reasoning: true,
            input: ["text"],
            cost: {
              input: 0.06,
              output: 0.4,
              cacheRead: 0.01,
              cacheWrite: 0,
            },
            contextWindow: 200000,
            maxTokens: 128000,
          },
          {
            id: "glm-4.6",
            name: "GLM-4.6",
            reasoning: true,
            input: ["text"],
            cost: {
              input: 0.6,
              output: 2.2,
              cacheRead: 0.11,
              cacheWrite: 0,
            },
            contextWindow: 204800,
            maxTokens: 131072,
          },
          {
            id: "glm-4.6v",
            name: "GLM-4.6V",
            reasoning: true,
            input: ["text", "image"],
            cost: {
              input: 0.3,
              output: 0.9,
              cacheRead: 0,
              cacheWrite: 0,
            },
            contextWindow: 128000,
            maxTokens: 32768,
          },
          {
            id: "glm-4.5",
            name: "GLM-4.5",
            reasoning: true,
            input: ["text"],
            cost: {
              input: 0.6,
              output: 2.2,
              cacheRead: 0.11,
              cacheWrite: 0,
            },
            contextWindow: 131072,
            maxTokens: 98304,
          },
          {
            id: "glm-4.5-air",
            name: "GLM-4.5 Air",
            reasoning: true,
            input: ["text"],
            cost: {
              input: 0.2,
              output: 1.1,
              cacheRead: 0.03,
              cacheWrite: 0,
            },
            contextWindow: 131072,
            maxTokens: 98304,
          },
          {
            id: "glm-4.5-flash",
            name: "GLM-4.5 Flash",
            reasoning: true,
            input: ["text"],
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
            },
            contextWindow: 131072,
            maxTokens: 98304,
          },
          {
            id: "glm-4.5v",
            name: "GLM-4.5V",
            reasoning: true,
            input: ["text", "image"],
            cost: {
              input: 0.6,
              output: 1.8,
              cacheRead: 0,
              cacheWrite: 0,
            },
            contextWindow: 64000,
            maxTokens: 16384,
          },
        ],
      },
    },
  },
  tools: {
    profile: "coding",
    exec: {
      security: "full",
      host: "gateway",
      ask: "off",
    },
  },
  commands: {
    native: "auto",
    nativeSkills: "auto",
    restart: true,
    ownerDisplay: "raw",
  },
  session: {
    dmScope: "per-channel-peer",
  },
  hooks: {
    internal: {
      enabled: true,
      entries: {
        "self-improvement": {
          enabled: true,
        },
        "tenant-member-bootstrap-filter": {
          enabled: true,
        },
      },
    },
  },
  agents: {
    defaults: {
      model: {
        primary: "zai/glm-5",
        fallbacks: ["volcengine-plan/ark-code-latest"],
      },
      models: {
        "volcengine-plan/ark-code-latest": {},
        "zai/glm-5": {
          alias: "GLM",
        },
      },
      compaction: {
        mode: "safeguard",
      },
    },
    list: [
      {
        id: "main",
        name: "默认助手",
        tools: {
          profile: "full",
        },
      },
    ],
  },
};

const secretKeyNames = new Set([
  "access_token",
  "accessToken",
  "accessKey",
  "accessKeyId",
  "api_key",
  "apikey",
  "apiKey",
  "authorization",
  "auth",
  "authToken",
  "bearerToken",
  "client_secret",
  "clientSecret",
  "cookie",
  "credential",
  "credentials",
  "password",
  "private_key",
  "privateKey",
  "secretKey",
  "refresh_token",
  "refreshToken",
  "sessionToken",
  "secret",
  "token",
  "token_ref",
  "tokenRef",
  "key_ref",
  "keyRef",
]);

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function clone(value) {
  return structuredClone(value);
}

function sanitizeSecretBearingValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeSecretBearingValue(entry));
  }
  if (!isPlainObject(value)) {
    return clone(value);
  }
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (secretKeyNames.has(key) || secretKeyNames.has(key.toLowerCase())) {
      continue;
    }
    out[key] = sanitizeSecretBearingValue(child);
  }
  return out;
}

function getString(source, key, fallback) {
  const value = source?.[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return fallback;
}

function getBoolean(source, key, fallback) {
  const value = source?.[key];
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function getArray(source, key, fallback) {
  const value = source?.[key];
  if (Array.isArray(value) && value.length > 0) {
    return clone(value);
  }
  return clone(fallback);
}

function buildPortableGateway(sourceGateway) {
  const gateway = isPlainObject(sourceGateway) ? sourceGateway : {};
  const tailscale = isPlainObject(gateway.tailscale) ? gateway.tailscale : {};
  const nodes = isPlainObject(gateway.nodes) ? gateway.nodes : {};
  return {
    mode: getString(gateway, "mode", defaultPortableConfig.gateway.mode),
    bind: getString(gateway, "bind", defaultPortableConfig.gateway.bind),
    port: typeof gateway.port === "number" ? gateway.port : defaultPortableConfig.gateway.port,
    tailscale: {
      mode: getString(tailscale, "mode", defaultPortableConfig.gateway.tailscale.mode),
      resetOnExit: getBoolean(
        tailscale,
        "resetOnExit",
        defaultPortableConfig.gateway.tailscale.resetOnExit,
      ),
    },
    nodes: {
      denyCommands: getArray(
        nodes,
        "denyCommands",
        defaultPortableConfig.gateway.nodes.denyCommands,
      ),
    },
  };
}

function buildPortableModels(sourceModels) {
  const models = isPlainObject(sourceModels) ? sourceModels : {};
  const providers = isPlainObject(models.providers) ? sanitizeSecretBearingValue(models.providers) : undefined;
  return {
    mode: getString(models, "mode", defaultPortableConfig.models.mode),
    providers:
      providers && Object.keys(providers).length > 0
        ? clone(providers)
        : clone(defaultPortableConfig.models.providers),
  };
}

function buildPortableTools(sourceTools) {
  const tools = isPlainObject(sourceTools) ? sourceTools : {};
  const exec = isPlainObject(tools.exec) ? tools.exec : {};
  return {
    profile: getString(tools, "profile", defaultPortableConfig.tools.profile),
    exec: {
      security: getString(exec, "security", defaultPortableConfig.tools.exec.security),
      host: getString(exec, "host", defaultPortableConfig.tools.exec.host),
      ask: getString(exec, "ask", defaultPortableConfig.tools.exec.ask),
    },
  };
}

function buildPortableCommands(sourceCommands) {
  const commands = isPlainObject(sourceCommands) ? sourceCommands : {};
  return {
    native: getString(commands, "native", defaultPortableConfig.commands.native),
    nativeSkills: getString(
      commands,
      "nativeSkills",
      defaultPortableConfig.commands.nativeSkills,
    ),
    restart: getBoolean(commands, "restart", defaultPortableConfig.commands.restart),
    ownerDisplay: getString(
      commands,
      "ownerDisplay",
      defaultPortableConfig.commands.ownerDisplay,
    ),
  };
}

function buildPortableSession(sourceSession) {
  const session = isPlainObject(sourceSession) ? sourceSession : {};
  return {
    dmScope: getString(session, "dmScope", defaultPortableConfig.session.dmScope),
  };
}

function buildPortableHooks(sourceHooks) {
  const hooks = isPlainObject(sourceHooks) ? sourceHooks : {};
  const internal = isPlainObject(hooks.internal) ? hooks.internal : {};
  const entries = isPlainObject(internal.entries) ? internal.entries : {};
  const selfImprovement = isPlainObject(entries["self-improvement"])
    ? entries["self-improvement"]
    : {};
  const tenantMemberBootstrapFilter = isPlainObject(entries["tenant-member-bootstrap-filter"])
    ? entries["tenant-member-bootstrap-filter"]
    : {};
  return {
    internal: {
      enabled: getBoolean(internal, "enabled", defaultPortableConfig.hooks.internal.enabled),
      entries: {
        "self-improvement": {
          enabled: getBoolean(
            selfImprovement,
            "enabled",
            defaultPortableConfig.hooks.internal.entries["self-improvement"].enabled,
          ),
        },
        "tenant-member-bootstrap-filter": {
          enabled: getBoolean(
            tenantMemberBootstrapFilter,
            "enabled",
            true,
          ),
        },
      },
    },
  };
}

function buildPortableAgentSeed(sourceAgents) {
  const agents = isPlainObject(sourceAgents) ? sourceAgents : {};
  const list = Array.isArray(agents.list) ? agents.list : [];
  const main = list.find(
    (entry) =>
      isPlainObject(entry) &&
      typeof entry.id === "string" &&
      entry.id.trim() === "main",
  );
  const mainName =
    typeof main?.name === "string" && main.name.trim()
      ? main.name.trim()
      : defaultPortableConfig.agents.list[0].name;
  const mainTools = isPlainObject(main?.tools) ? main.tools : {};
  return [
    {
      id: "main",
      name: mainName,
      tools: {
        profile: getString(
          mainTools,
          "profile",
          defaultPortableConfig.agents.list[0].tools.profile,
        ),
      },
    },
  ];
}

function buildPortableAgents(sourceAgents) {
  const agents = isPlainObject(sourceAgents) ? sourceAgents : {};
  const defaults = isPlainObject(agents.defaults) ? agents.defaults : {};
  const model = isPlainObject(defaults.model) ? defaults.model : {};
  const models = isPlainObject(defaults.models) ? defaults.models : {};
  const compaction = isPlainObject(defaults.compaction) ? defaults.compaction : {};
  return {
    defaults: {
      model: {
        primary: getString(
          model,
          "primary",
          defaultPortableConfig.agents.defaults.model.primary,
        ),
        fallbacks: getArray(
          model,
          "fallbacks",
          defaultPortableConfig.agents.defaults.model.fallbacks,
        ),
      },
      models:
        Object.keys(models).length > 0
          ? clone(models)
          : clone(defaultPortableConfig.agents.defaults.models),
      compaction: {
        mode: getString(
          compaction,
          "mode",
          defaultPortableConfig.agents.defaults.compaction.mode,
        ),
      },
    },
    list: buildPortableAgentSeed(agents),
  };
}

export function buildPortableExampleConfig(source = {}) {
  return {
    gateway: buildPortableGateway(source.gateway),
    models: buildPortableModels(source.models),
    tools: buildPortableTools(source.tools),
    commands: buildPortableCommands(source.commands),
    session: buildPortableSession(source.session),
    hooks: buildPortableHooks(source.hooks),
    agents: buildPortableAgents(source.agents),
  };
}

export function buildPortableConfigBatch(source = {}) {
  // Keep the batch narrow so deploys update the shared baseline without
  // clobbering per-host paths, saved auth state, or created Agents.
  const example = buildPortableExampleConfig(source);
  return [
    {
      path: "gateway.mode",
      value: example.gateway.mode,
    },
    {
      path: "gateway.bind",
      value: example.gateway.bind,
    },
    {
      path: "gateway.port",
      value: example.gateway.port,
    },
    {
      path: "gateway.tailscale.mode",
      value: example.gateway.tailscale.mode,
    },
    {
      path: "gateway.tailscale.resetOnExit",
      value: example.gateway.tailscale.resetOnExit,
    },
    {
      path: "gateway.nodes.denyCommands",
      value: example.gateway.nodes.denyCommands,
    },
    {
      path: "models.mode",
      value: example.models.mode,
    },
    {
      path: "models.providers.zai.baseUrl",
      value: example.models.providers.zai.baseUrl,
    },
    {
      path: "models.providers.zai.api",
      value: example.models.providers.zai.api,
    },
    {
      path: "models.providers.zai.models",
      value: example.models.providers.zai.models,
    },
    {
      path: "tools.profile",
      value: example.tools.profile,
    },
    {
      path: "tools.exec.security",
      value: example.tools.exec.security,
    },
    {
      path: "tools.exec.host",
      value: example.tools.exec.host,
    },
    {
      path: "tools.exec.ask",
      value: example.tools.exec.ask,
    },
    {
      path: "commands.native",
      value: example.commands.native,
    },
    {
      path: "commands.nativeSkills",
      value: example.commands.nativeSkills,
    },
    {
      path: "commands.restart",
      value: example.commands.restart,
    },
    {
      path: "commands.ownerDisplay",
      value: example.commands.ownerDisplay,
    },
    {
      path: "session.dmScope",
      value: example.session.dmScope,
    },
    {
      path: "hooks.internal.enabled",
      value: example.hooks.internal.enabled,
    },
    {
      path: "hooks.internal.entries.self-improvement.enabled",
      value: example.hooks.internal.entries["self-improvement"].enabled,
    },
    {
      path: "hooks.internal.entries.tenant-member-bootstrap-filter.enabled",
      value: example.hooks.internal.entries["tenant-member-bootstrap-filter"].enabled,
    },
    {
      path: "agents.defaults.model.primary",
      value: example.agents.defaults.model.primary,
    },
    {
      path: "agents.defaults.model.fallbacks",
      value: example.agents.defaults.model.fallbacks,
    },
    {
      path: "agents.defaults.models.zai/glm-5.alias",
      value: example.agents.defaults.models["zai/glm-5"]?.alias,
    },
  ];
}

function readPortableConfigSource(sourcePath) {
  if (!sourcePath) {
    return {};
  }
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Portable config source not found: ${sourcePath}`);
  }
  return JSON5.parse(fs.readFileSync(sourcePath, "utf8"));
}

function parseArgs(argv) {
  const options = {
    emit: "example",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") {
      options.help = true;
      continue;
    }
    if (value === "--source") {
      options.source = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--emit") {
      options.emit = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--write") {
      options.write = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  if (options.emit !== "example" && options.emit !== "batch") {
    throw new Error(`Unknown emit mode: ${options.emit}`);
  }

  return options;
}

function usage() {
  process.stdout.write(
    [
      "Usage: node tools/openclaw-control-ui-echarts/local-runtime/portable-config.mjs [options]",
      "",
      "Options:",
      "  --source <path>   Read a source openclaw.json or JSON5 template. Default: the packaged portable example.",
      "  --emit <mode>     Output mode: example or batch. Default: example.",
      "  --write <path>    Write the emitted payload to a file instead of stdout.",
      "  --help            Show this help.",
    ].join("\n"),
  );
}

function formatOutput(emit, sourceConfig) {
  if (emit === "batch") {
    return `${JSON.stringify(buildPortableConfigBatch(sourceConfig))}\n`;
  }
  return `${JSON.stringify(buildPortableExampleConfig(sourceConfig), null, 2)}\n`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  const sourcePath = options.source ? path.resolve(options.source) : defaultSourcePath;
  const sourceConfig = readPortableConfigSource(sourcePath);
  const output = formatOutput(options.emit, sourceConfig);

  if (options.write) {
    fs.writeFileSync(path.resolve(options.write), output, "utf8");
    process.stdout.write(`Wrote ${path.resolve(options.write)}\n`);
    return;
  }

  process.stdout.write(output);
}

const isEntrypoint =
  !!process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
