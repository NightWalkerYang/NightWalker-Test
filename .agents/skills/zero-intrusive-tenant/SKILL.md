---
name: zero-intrusive-tenant
description: Use for OpenClaw zero-intrusive tenant work. Route the task to the right tenant module docs, enforce zero-intrusive-only edits, keep docs aligned with the runnable implementation, and follow the local-change -> push -> remote pull/deploy workflow.
---

# Zero-Intrusive Tenant

Use this skill for OpenClaw zero-intrusive tenant work.

This skill is a router, not the full knowledge base.
Its job is:

- tell you the hard rules
- tell you where the zero-intrusive file boundary lives
- tell you which module doc to read next

## Read Order

1. `ZERO_INTRUSIVE_TENANT_SYSTEM_PLAN.md`
2. `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
3. only the module docs that match the task

## Hard Rules

- Modify zero-intrusive files only.
- If you add a new zero-intrusive file, update `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md` in the same change.
- If docs disagree with the runnable implementation, trust the runnable implementation and update the docs immediately.
- Fixed workflow: local edit and test -> push Gitee -> target server pull, verify, deploy.
- Do not directly edit repo files on the server. Testing and inspection are fine; implementation changes must come from the local repo.
- If targeted verification is complete and a commit is made, the commit message must be Chinese.
- Do not write real server credentials, tokens, payment keys, or license files into repo docs or skill files.

## Cleanup Rule

Once the task becomes substantial:

- create a cleanup subagent when supported
- if subagents are unavailable, do the same cleanup tracking yourself

Before starting local commands that may create residual resources, register the expected resources with cleanup tracking:

- processes
- ports
- temp directories
- temp files
- log paths

Pay special attention to:

- `node`
- `pnpm` / `npm`
- `playwright`
- `msedge` / `chrome --headless`
- `vite` / `webpack` / `rsbuild`
- SSH tunnels
- proxies
- port forwarding
- temporary services

Final replies must include a dedicated `本机残留清除结果` section.

## Module Routing

### Architecture and ownership

Read `ZERO_INTRUSIVE_TENANT_ARCHITECTURE.md` when the task is about:

- control-plane / managed-node / standalone-local
- sidecar boundaries
- runtime vs deployment vs workspace overlay ownership
- where a change belongs

### Login, routing, member chat, session behavior

Read `ZERO_INTRUSIVE_TENANT_RUNTIME_AND_ROUTING.md` when the task is about:

- `ocTenantView`
- login shell mounting
- preboot
- same-page navigation
- member session routing
- draft route lock
- session cleanup or visibility

### Docker, proxy, token, origin, packaging, server deploy path

Read `ZERO_INTRUSIVE_TENANT_DEPLOYMENT_AND_OPERATIONS.md` when the task is about:

- direct-docker deploy
- `build-custom-control-ui.mjs`
- `setup-direct-docker-compose-up.sh`
- gateway image rebuilds
- token embedding
- vendor sync
- proxy-fronted local Docker
- `allowedOrigins`
- device auth bypass

### Tables, fields, memberships, wallet records, orders

Read `ZERO_INTRUSIVE_TENANT_DATA_MODEL.md` when the task is about:

- SQLite schema
- tenant/user/member relations
- agent assignment persistence
- wallet tables
- order tables
- audit records

### Wallet, pricing, charge sync, Allinpay, local license

Read `ZERO_INTRUSIVE_TENANT_BILLING_AND_LICENSE.md` when the task is about:

- `CNY` settlement
- static price tables
- `cost.total` fallback rules
- Allinpay flow
- local license
- expiry and read-only behavior

### What is already shipped

Read `ZERO_INTRUSIVE_TENANT_IMPLEMENTATION_STATUS.md` when you need to know:

- what is already real
- which old plan text is stale
- whether a behavior is already implemented

### Open questions and missing materials

Read `ZERO_INTRUSIVE_TENANT_OPEN_DECISIONS.md` when:

- the user needs to make a product or integration decision
- materials are still missing
- a payment or deployment dependency is blocked on operator input

### Prompt upkeep

Read `ZERO_INTRUSIVE_TENANT_AGENT_PROMPT_TEMPLATE.md` when:

- the operator wants to refresh the project prompt
- a shorter or more modular prompt is needed

## Inventory Truth

The skill does not replace `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`.

Keep this split:

- skill = routing and rules
- inventory md = zero-intrusive file truth
- module docs = detailed knowledge
