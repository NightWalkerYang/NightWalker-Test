CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  deployment_mode TEXT NOT NULL DEFAULT 'cloud',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  UNIQUE(tenant_id, user_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenant_quotas (
  tenant_id TEXT PRIMARY KEY,
  member_limit INTEGER NOT NULL DEFAULT 1,
  license_expires_at TEXT,
  renewal_code TEXT,
  readonly_after_expiry INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenant_wallets (
  tenant_id TEXT PRIMARY KEY,
  balance_points REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenant_agents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  description TEXT,
  rate_multiplier REAL NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  balance_points REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, agent_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_agent_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tenant_agent_id TEXT NOT NULL,
  derived_agent_id TEXT,
  derived_workspace_dir TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  UNIQUE(user_id, tenant_agent_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_agent_id) REFERENCES tenant_agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenant_agent_budgets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  tenant_agent_id TEXT NOT NULL,
  amount_points REAL NOT NULL DEFAULT 0,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_agent_id) REFERENCES tenant_agents(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tenant_wallet_ledger (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_points REAL NOT NULL,
  balance_after REAL NOT NULL,
  tenant_agent_id TEXT,
  payment_order_id TEXT,
  actor_user_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_agent_id) REFERENCES tenant_agents(id) ON DELETE SET NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  amount_cny REAL NOT NULL,
  amount_points REAL NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_confirmation',
  provider_order_id TEXT,
  provider_payload TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenant_agent_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tenant_agent_id TEXT NOT NULL,
  openclaw_session_key TEXT NOT NULL,
  openclaw_session_id TEXT,
  title TEXT NOT NULL,
  hidden_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_agent_id) REFERENCES tenant_agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_role
  ON tenant_memberships (tenant_id, role);

CREATE INDEX IF NOT EXISTS idx_user_agent_assignments_user
  ON user_agent_assignments (user_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_agent_assignments_derived_agent
  ON user_agent_assignments (derived_agent_id)
  WHERE derived_agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_agent_sessions_user_agent
  ON tenant_agent_sessions (user_id, tenant_agent_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_orders_tenant_status
  ON payment_orders (tenant_id, status, created_at DESC);
