import { describe, expect, it } from "vitest";

import {
  buildPortableConfigBatch,
  buildPortableExampleConfig,
} from "../../../tools/openclaw-control-ui-echarts/local-runtime/portable-config.mjs";

describe("portable config", () => {
  it("keeps the portable baseline and strips runtime-only state", () => {
    const source = {
      meta: {
        lastTouchedVersion: "2026.4.1",
        lastTouchedAt: "2026-04-15T09:43:28.351Z",
      },
      wizard: {
        lastRunAt: "2026-03-31T09:55:34.618Z",
        lastRunVersion: "2026.3.24",
        lastRunCommand: "configure",
        lastRunMode: "local",
      },
      auth: {
        profiles: {
          zai: {
            provider: "zai",
            mode: "api_key",
            apiKey: "should-not-escape",
          },
        },
      },
      gateway: {
        mode: "local",
        bind: "loopback",
        port: 18789,
        controlUi: {
          root: "/app/dist/control-ui",
          allowedOrigins: ["https://example.invalid"],
        },
        tailscale: {
          mode: "off",
          resetOnExit: false,
        },
        nodes: {
          denyCommands: ["camera.snap", "sms.send"],
        },
        auth: {
          mode: "token",
          token: "secret",
        },
      },
      models: {
        mode: "merge",
        providers: {
          zai: {
            baseUrl: "https://open.bigmodel.cn/api/paas/v4",
            api: "openai-completions",
            models: [{ id: "glm-5" }],
            apiKey: "secret",
            nested: {
              token: "secret",
            },
          },
          custom: {
            apiKey: "secret",
            nested: {
              token: "secret",
            },
          },
        },
      },
      tools: {
        profile: "coding",
        exec: {
          security: "full",
          host: "gateway",
          ask: "off",
          pathPrepend: ["/tmp/secret"],
          extraSecret: "secret",
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
            "foo/bar": {
              alias: "Foo",
            },
          },
          compaction: {
            mode: "safeguard",
          },
          workspace: "/home/node/.openclaw/workspace",
        },
        list: [
          {
            id: "main",
            name: "默认助手",
            tools: {
              profile: "full",
            },
            agentDir: "/home/node/.openclaw/agents/main/agent",
          },
          {
            id: "kingdee-cloud",
            name: "kingdee-cloud",
          },
        ],
      },
    };

    expect(buildPortableExampleConfig(source)).toEqual({
      gateway: {
        mode: "local",
        bind: "loopback",
        port: 18789,
        tailscale: {
          mode: "off",
          resetOnExit: false,
        },
        nodes: {
          denyCommands: ["camera.snap", "sms.send"],
        },
      },
      models: {
        mode: "merge",
        providers: {
          zai: {
            baseUrl: "https://open.bigmodel.cn/api/paas/v4",
            api: "openai-completions",
            models: [{ id: "glm-5" }],
            nested: {},
          },
          custom: {
            nested: {},
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
            "foo/bar": {
              alias: "Foo",
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
    });
  });

  it("emits a portable batch without runtime-only paths", () => {
    const batch = buildPortableConfigBatch({
      gateway: {
        mode: "local",
        bind: "loopback",
        port: 18789,
        tailscale: {
          mode: "off",
          resetOnExit: false,
        },
        nodes: {
          denyCommands: ["camera.snap", "sms.send"],
        },
      },
      models: {
        mode: "merge",
        providers: {
          zai: {
            baseUrl: "https://open.bigmodel.cn/api/paas/v4",
            api: "openai-completions",
            models: [{ id: "glm-5" }],
          },
        },
      },
      tools: {
        profile: "coding",
        exec: {
          security: "full",
          host: "gateway",
          ask: "off",
          pathPrepend: ["/tmp/secret"],
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
            tools: {
              profile: "full",
            },
          },
        ],
      },
    });

    const paths = batch.map((entry) => entry.path);
    expect(paths).toEqual([
      "gateway.mode",
      "gateway.bind",
      "gateway.port",
      "gateway.tailscale.mode",
      "gateway.tailscale.resetOnExit",
      "gateway.nodes.denyCommands",
      "models.mode",
      "models.providers.zai.baseUrl",
      "models.providers.zai.api",
      "models.providers.zai.models",
      "tools.profile",
      "tools.exec.security",
      "tools.exec.host",
      "tools.exec.ask",
      "commands.native",
      "commands.nativeSkills",
      "commands.restart",
      "commands.ownerDisplay",
      "session.dmScope",
      "hooks.internal.enabled",
      "hooks.internal.entries.self-improvement.enabled",
      "hooks.internal.entries.tenant-member-bootstrap-filter.enabled",
      "agents.defaults.model.primary",
      "agents.defaults.model.fallbacks",
      "agents.defaults.models.zai/glm-5.alias",
    ]);
    expect(paths).not.toContain("gateway.controlUi.root");
    expect(paths).not.toContain("auth.profiles");
    expect(paths).not.toContain("wizard.lastRunAt");
    expect(paths).not.toContain("meta.lastTouchedAt");
    expect(paths).not.toContain("agents.list");
    expect(paths).not.toContain("tools.exec.pathPrepend");
    expect(batch.find((entry) => entry.path === "models.providers.zai.models")?.value).toEqual([
      { id: "glm-5" },
    ]);
  });
});
