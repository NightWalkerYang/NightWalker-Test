#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


DEFAULT_HOST = "10.20.30.31"
DEFAULT_USER = "root-ai"
DEFAULT_DB_DSN = "postgresql:///kingdee_analytics?host=/var/run/postgresql"
DEFAULT_SSH_KEY = "/home/node/.openclaw/ssh/kingdee-db-query-ed25519"
DEFAULT_TIMEOUT = 120
DERIVED_AGENT_METADATA_FILE = ".tenant-derived-agent.json"
TENANT_DATA_ACCESS_RUNTIME_FILE = "tenant-data-access.json"
TENANT_DATA_ACCESS_NOT_CONFIGURED = (
    "tenant data access is not configured for this member; "
    "ask a tenant admin to bind a data source and set org scope first"
)


def _read_json_file(file_path: Path) -> dict[str, object] | None:
    try:
        raw = file_path.read_text(encoding="utf-8").strip()
    except OSError:
        return None
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def resolve_workspace_root() -> Path | None:
    parents = Path(__file__).resolve().parents
    return parents[3] if len(parents) >= 4 else None


def resolve_tenant_data_access_file() -> str | None:
    env_path = os.environ.get("OPENCLAW_TENANT_DATA_ACCESS_FILE", "").strip()
    candidates: list[Path] = []
    if env_path:
        candidates.append(Path(env_path))

    workspace_root = resolve_workspace_root()
    metadata = (
        _read_json_file(workspace_root / DERIVED_AGENT_METADATA_FILE) if workspace_root else None
    )
    derived_agent_id = str(metadata.get("derivedAgentId", "")).strip() if metadata else ""
    if workspace_root and derived_agent_id:
        if workspace_root.parent.name == "workspace-agents":
            candidates.append(
                workspace_root.parent.parent
                / "agents"
                / derived_agent_id
                / "agent"
                / TENANT_DATA_ACCESS_RUNTIME_FILE
            )
        if workspace_root.name == f"workspace-{derived_agent_id}":
            candidates.append(
                workspace_root.parent
                / "agents"
                / derived_agent_id
                / "agent"
                / TENANT_DATA_ACCESS_RUNTIME_FILE
            )
        candidates.append(
            Path.home()
            / ".openclaw"
            / "agents"
            / derived_agent_id
            / "agent"
            / TENANT_DATA_ACCESS_RUNTIME_FILE
        )

    seen: list[str] = []
    for candidate in candidates:
        normalized = str(candidate)
        if normalized in seen:
            continue
        seen.append(normalized)
        if candidate.exists() and os.access(candidate, os.R_OK):
            return normalized
    return None


def resolve_ssh_key(preferred: str) -> str:
    values = [
        preferred,
        DEFAULT_SSH_KEY,
        str(Path.home() / ".openclaw" / "ssh" / "kingdee-db-query-ed25519"),
    ]
    seen: list[str] = []
    for value in values:
        if not value or value in seen:
            continue
        seen.append(value)
        path = Path(value)
        if path.exists() and os.access(path, os.R_OK):
            return str(path)
    checked = ", ".join(seen)
    raise RuntimeError(f"no readable SSH key found; checked: {checked}")


def resolve_ssh_binary() -> str:
    ssh = shutil.which("ssh")
    if not ssh:
        raise RuntimeError("ssh client not found in PATH")
    return ssh


def resolve_node_binary() -> str:
    node = shutil.which("node")
    if not node:
        raise RuntimeError("node client not found in PATH")
    return node


def run_local_pg_request(payload: dict[str, object], timeout: int) -> dict[str, object] | None:
    access_file = resolve_tenant_data_access_file()
    if not access_file:
        return None
    helper_path = Path(__file__).resolve().with_name("tenant_local_pg_bridge.mjs")
    if not helper_path.exists():
        raise RuntimeError("tenant_local_pg_bridge_missing")
    result = subprocess.run(
        [resolve_node_binary(), str(helper_path), access_file],
        input=json.dumps(payload, ensure_ascii=False),
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=timeout,
        check=False,
    )
    if result.returncode != 0:
        error = result.stderr.strip() or result.stdout.strip() or (
            f"local pg bridge failed with exit code {result.returncode}"
        )
        raise RuntimeError(error)
    return json.loads(result.stdout)


def is_derived_tenant_agent_workspace() -> bool:
    workspace_root = resolve_workspace_root()
    metadata_path = workspace_root / DERIVED_AGENT_METADATA_FILE if workspace_root else None
    return bool(metadata_path and metadata_path.exists())


def run_bridge_request(
    *,
    host: str,
    user: str,
    ssh_key: str,
    payload: dict[str, object],
    timeout: int,
) -> dict[str, object]:
    mode = str(payload.get("mode", "")).strip().lower() if isinstance(payload, dict) else ""
    if mode in {"query", "write_sql"}:
        response = run_local_pg_request(payload, timeout)
        if response is not None:
            return response
        if is_derived_tenant_agent_workspace():
            raise RuntimeError(TENANT_DATA_ACCESS_NOT_CONFIGURED)
    if mode == "cli":
        access_file = resolve_tenant_data_access_file()
        cli_timeout = max(timeout, 7200)
        if access_file:
            helper_path = Path(__file__).resolve().with_name("local_sync_engine.py")
            if not helper_path.exists():
                raise RuntimeError("tenant_local_sync_engine_missing")
            result = subprocess.run(
                [sys.executable, str(helper_path), access_file],
                input=json.dumps(payload, ensure_ascii=False),
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=cli_timeout,
                check=False,
            )
            if result.returncode == 0:
                return json.loads(result.stdout)
            error = result.stderr.strip() or result.stdout.strip() or (
                f"tenant local sync engine failed with exit code {result.returncode}"
            )
            raise RuntimeError(error)
        if is_derived_tenant_agent_workspace():
            raise RuntimeError(TENANT_DATA_ACCESS_NOT_CONFIGURED)

    command = [
        resolve_ssh_binary(),
        "-i",
        resolve_ssh_key(ssh_key),
        "-T",
        "-o",
        "BatchMode=yes",
        "-o",
        "IdentitiesOnly=yes",
        "-o",
        "StrictHostKeyChecking=accept-new",
        "-o",
        "ConnectTimeout=10",
        f"{user}@{host}",
    ]
    result = subprocess.run(
        command,
        input=json.dumps(payload, ensure_ascii=False),
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=max(timeout, 7200) if mode == "cli" else timeout,
        check=False,
    )
    if result.returncode != 0:
        error = result.stderr.strip() or result.stdout.strip() or (
            f"ssh bridge failed with exit code {result.returncode}"
        )
        raise RuntimeError(error)
    return json.loads(result.stdout)
