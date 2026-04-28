#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path


DEFAULT_HOST = "10.20.30.31"
DEFAULT_USER = "root-ai"
DEFAULT_DB_DSN = "postgresql:///kingdee_analytics?host=/var/run/postgresql"
DEFAULT_SSH_KEY = "/home/node/.openclaw/ssh/kingdee-db-query-ed25519"
DEFAULT_TIMEOUT = 120


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


def run_bridge_request(
    *,
    host: str,
    user: str,
    ssh_key: str,
    payload: dict[str, object],
    timeout: int,
) -> dict[str, object]:
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
        timeout=timeout,
        check=False,
    )
    if result.returncode != 0:
        error = result.stderr.strip() or result.stdout.strip() or (
            f"ssh bridge failed with exit code {result.returncode}"
        )
        raise RuntimeError(error)
    return json.loads(result.stdout)
