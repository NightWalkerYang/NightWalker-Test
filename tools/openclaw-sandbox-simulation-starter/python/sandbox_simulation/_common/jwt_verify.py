"""
校验 sidecar tenant-platform 签发的 JWT。
HS256，密钥来自 SANDBOX_SIDECAR_JWT_SECRET。
返回 claims dict，校验失败抛 SandboxError。
"""

from __future__ import annotations

import os

from .errors import SandboxError


JWT_SECRET_ENV = "SANDBOX_SIDECAR_JWT_SECRET"


def verify(token: str) -> dict:
    secret = os.environ.get(JWT_SECRET_ENV)
    if not secret:
        raise SandboxError("SIDECAR_JWT_SECRET_missing")
    try:
        from jose import JWTError, jwt
    except ImportError as exc:
        raise RuntimeError(
            "python-jose is required to verify sandbox sidecar JWTs"
        ) from exc
    try:
        claims = jwt.decode(token, secret, algorithms=["HS256"])
    except JWTError as exc:
        raise SandboxError(f"jwt_invalid: {exc}") from exc
    if "tenant_id" not in claims:
        raise SandboxError("jwt_missing_tenant_id")
    return claims
