CREATE TABLE IF NOT EXISTS kingdee_connections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  server_url TEXT NOT NULL,
  app_id TEXT NOT NULL,
  app_secret_encrypted TEXT NOT NULL,
  account_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_tested_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dashboards (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  dashboard_type TEXT NOT NULL DEFAULT 'custom',
  layout_json TEXT NOT NULL DEFAULT '{}',
  theme TEXT NOT NULL DEFAULT 'dark',
  refresh_interval_seconds INTEGER DEFAULT 300,
  is_public INTEGER NOT NULL DEFAULT 0,
  public_token TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dashboards_tenant_user ON dashboards (tenant_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboards_public_token ON dashboards (public_token) WHERE public_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS dashboard_charts (
  id TEXT PRIMARY KEY,
  dashboard_id TEXT NOT NULL,
  title TEXT NOT NULL,
  chart_type TEXT NOT NULL,
  echarts_option_json TEXT NOT NULL,
  data_query_json TEXT,
  position_json TEXT NOT NULL DEFAULT '{"x":0,"y":0,"w":6,"h":4}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dashboard_charts_dashboard ON dashboard_charts (dashboard_id);

CREATE TABLE IF NOT EXISTS kingdee_query_cache (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(tenant_id, query_hash)
);
