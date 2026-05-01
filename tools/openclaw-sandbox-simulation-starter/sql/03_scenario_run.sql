CREATE SCHEMA IF NOT EXISTS sandbox_v1;

CREATE OR REPLACE FUNCTION sandbox_v1.generate_run_uuid()
RETURNS uuid
LANGUAGE sql
VOLATILE
AS $$
    SELECT (
        substr(md5(clock_timestamp()::text || random()::text), 1, 8) || '-' ||
        substr(md5(clock_timestamp()::text || random()::text), 1, 4) || '-4' ||
        substr(md5(clock_timestamp()::text || random()::text), 1, 3) || '-' ||
        substr('89ab', (floor(random() * 4)::int + 1), 1) ||
        substr(md5(clock_timestamp()::text || random()::text), 1, 3) || '-' ||
        substr(md5(clock_timestamp()::text || random()::text), 1, 12)
    )::uuid;
$$;

CREATE TABLE IF NOT EXISTS sandbox_v1.scenario_template (
    template_code TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    description TEXT,
    default_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sandbox_v1.scenario_run (
    run_id UUID PRIMARY KEY DEFAULT sandbox_v1.generate_run_uuid(),
    tenant_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    template_code TEXT NOT NULL REFERENCES sandbox_v1.scenario_template(template_code),
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
    current_step TEXT,
    step_progress_pct INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    error_code TEXT,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_scenario_run_tenant_status
    ON sandbox_v1.scenario_run (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS sandbox_v1.scenario_run_input (
    run_id UUID PRIMARY KEY REFERENCES sandbox_v1.scenario_run(run_id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenario_run_input_payload
    ON sandbox_v1.scenario_run_input USING gin (payload);

CREATE TABLE IF NOT EXISTS sandbox_v1.scenario_run_output (
    run_id UUID PRIMARY KEY REFERENCES sandbox_v1.scenario_run(run_id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL,
    forecast_json JSONB,
    rule_result_json JSONB,
    graph_json JSONB,
    report_json JSONB,
    report_md TEXT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenario_run_output_report
    ON sandbox_v1.scenario_run_output USING gin (report_json);

CREATE TABLE IF NOT EXISTS sandbox_v1.scenario_run_agent_msg (
    msg_id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES sandbox_v1.scenario_run(run_id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL,
    agent_role TEXT NOT NULL
        CHECK (agent_role IN ('sales', 'purchasing', 'warehouse', 'production', 'finance', 'facilitator')),
    msg_seq INT NOT NULL,
    role_phase TEXT NOT NULL
        CHECK (role_phase IN ('opening', 'first_round', 'conflict', 'second_round', 'final')),
    content_md TEXT NOT NULL,
    structured JSONB NOT NULL,
    evidence_ids TEXT[],
    token_usage INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, msg_seq)
);

CREATE INDEX IF NOT EXISTS idx_agent_msg_run
    ON sandbox_v1.scenario_run_agent_msg (run_id, msg_seq);

CREATE TABLE IF NOT EXISTS sandbox_v1.scenario_run_log (
    log_id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES sandbox_v1.scenario_run(run_id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('start', 'ok', 'error')),
    duration_ms INT,
    log_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenario_run_log_run
    ON sandbox_v1.scenario_run_log (run_id, created_at);
