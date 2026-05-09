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
          gpt: {
            baseUrl: "https://api.cleannetworkspace.online/v1",
            api: "openai-completions",
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0",
            },
            models: [{ id: "gpt-5.4" }],
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
          },
        },
      },
      agents: {
        defaults: {
          model: {
            primary: "gpt/gpt-5.4",
            fallbacks: ["gpt/gpt-5.4-mini", "gpt/gpt-5.3-codex"],
          },
          models: {
            "gpt/gpt-5.4": {
              alias: "GPT-5.4",
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
          gpt: {
            baseUrl: "https://api.cleannetworkspace.online/v1",
            api: "openai-completions",
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0",
            },
            models: [{ id: "gpt-5.4" }],
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
          },
        },
      },
      agents: {
        defaults: {
          model: {
            primary: "gpt/gpt-5.4",
            fallbacks: ["gpt/gpt-5.4-mini", "gpt/gpt-5.3-codex"],
          },
          models: {
            "gpt/gpt-5.4": {
              alias: "GPT-5.4",
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
          gpt: {
            baseUrl: "https://api.cleannetworkspace.online/v1",
            api: "openai-completions",
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0",
            },
            models: [{ id: "gpt-5.4" }],
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
          },
        },
      },
      agents: {
        defaults: {
          model: {
            primary: "gpt/gpt-5.4",
            fallbacks: ["gpt/gpt-5.4-mini", "gpt/gpt-5.3-codex"],
          },
          models: {
            "gpt/gpt-5.4": {
              alias: "GPT-5.4",
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
      "models.providers.gpt.baseUrl",
      "models.providers.gpt.api",
      "models.providers.gpt.models",
      "models.providers.gpt.headers",
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
      "agents.defaults.model.primary",
      "agents.defaults.model.fallbacks",
      "agents.defaults.models.gpt/gpt-5.4.alias",
    ]);
    expect(paths).not.toContain("gateway.controlUi.root");
    expect(paths).not.toContain("auth.profiles");
    expect(paths).not.toContain("wizard.lastRunAt");
    expect(paths).not.toContain("meta.lastTouchedAt");
    expect(paths).not.toContain("agents.list");
    expect(paths).not.toContain("tools.exec.pathPrepend");
    expect(batch.find((entry) => entry.path === "models.providers.gpt.models")?.value).toEqual([
      { id: "gpt-5.4" },
    ]);
  });
});
