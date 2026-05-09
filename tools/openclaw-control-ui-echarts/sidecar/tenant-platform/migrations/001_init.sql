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

CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  connection_json TEXT NOT NULL,
  source_dbid TEXT,
  source_tenant_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_data_source_bindings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  data_source_id TEXT NOT NULL UNIQUE,
  bound_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE CASCADE,
  FOREIGN KEY (bound_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tenant_member_source_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  data_source_id TEXT NOT NULL,
  scope_mode TEXT NOT NULL,
  sandbox_enabled INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, user_id, data_source_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tenant_member_org_scopes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  data_source_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  org_name_snapshot TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, user_id, data_source_id, org_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS tenant_usage_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  member_user_id TEXT,
  member_username TEXT NOT NULL DEFAULT '',
  tenant_agent_id TEXT NOT NULL,
  openclaw_session_key TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  message_timestamp TEXT NOT NULL,
  usage_day TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(openclaw_session_key, source_fingerprint),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_agent_id) REFERENCES tenant_agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS platform_update_logs (
  id TEXT PRIMARY KEY,
  version_label TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by_user_id TEXT,
  created_by_username TEXT NOT NULL DEFAULT '',
  published_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
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

CREATE TABLE IF NOT EXISTS managed_nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  shared_secret_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  node_role TEXT NOT NULL DEFAULT 'managed-node',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS managed_node_leases (
  node_id TEXT PRIMARY KEY,
  lease_status TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT,
  readonly_after_expiry INTEGER NOT NULL DEFAULT 1,
  issued_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (node_id) REFERENCES managed_nodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS managed_node_agent_inventory (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  agent_emoji TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  updated_at TEXT NOT NULL,
  UNIQUE(node_id, agent_id),
  FOREIGN KEY (node_id) REFERENCES managed_nodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenant_node_bindings (
  tenant_id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (node_id) REFERENCES managed_nodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS managed_node_sync_state (
  node_id TEXT PRIMARY KEY,
  desired_revision INTEGER NOT NULL DEFAULT 1,
  last_applied_revision INTEGER NOT NULL DEFAULT 0,
  last_registered_at TEXT,
  last_heartbeat_at TEXT,
  last_inventory_at TEXT,
  last_sync_at TEXT,
  last_seen_ip TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (node_id) REFERENCES managed_nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_role
  ON tenant_memberships (tenant_id, role);

CREATE INDEX IF NOT EXISTS idx_user_agent_assignments_user
  ON user_agent_assignments (user_id, status);

CREATE INDEX IF NOT EXISTS idx_tenant_agent_sessions_user_agent
  ON tenant_agent_sessions (user_id, tenant_agent_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_usage_records_tenant_day
  ON tenant_usage_records (tenant_id, usage_day, message_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_usage_records_user_day
  ON tenant_usage_records (user_id, usage_day, message_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_usage_records_agent_day
  ON tenant_usage_records (tenant_agent_id, usage_day, message_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_wallet_ledger_usage_note
  ON tenant_wallet_ledger (tenant_id, category, note);

CREATE INDEX IF NOT EXISTS idx_payment_orders_tenant_status
  ON payment_orders (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_update_logs_published
  ON platform_update_logs (published_at DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_managed_node_agent_inventory_node_status
  ON managed_node_agent_inventory (node_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_node_bindings_node
  ON tenant_node_bindings (node_id, updated_at DESC);
