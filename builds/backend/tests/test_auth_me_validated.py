"""Tests for /api/auth/me with X-Admin-Validated from trusted localhost only."""

import asyncio
import os
from httpx import AsyncClient, ASGITransport

os.environ.setdefault("JWT_SECRET", "test-jwt-secret")

from app.main import app


def _run(coro):
    return asyncio.run(coro)


async def _get_me(client_host: str, headers: dict[str, str] | None = None):
    transport = ASGITransport(app=app, client=(client_host, 80))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get("/api/auth/me", headers=headers)


def test_me_with_validated_header_from_localhost_returns_admin_user():
    resp = _run(
        _get_me(
            "127.0.0.1",
            {
                "X-Admin-Validated": "1",
                "X-Admin-User": "caddy-admin",
            },
        )
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["role"] == "admin"
    assert data["user"]["username"] == "caddy-admin"


def test_me_without_validated_header_keeps_jwt_or_none_behavior():
    resp = _run(_get_me("127.0.0.1"))

    assert resp.status_code == 200
    assert resp.json() == {"user": None}


def test_me_rejects_validated_header_from_non_localhost():
    resp = _run(
        _get_me(
            "1.2.3.4",
            {"X-Admin-Validated": "1"},
        )
    )

    assert resp.status_code == 200
    assert resp.json() == {"user": None}
