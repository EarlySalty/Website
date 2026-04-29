"""Tests for /api/auth/me with X-Admin-Validated from trusted localhost only."""

import asyncio
import os
from httpx import AsyncClient, ASGITransport

os.environ.setdefault("JWT_SECRET", "test-jwt-secret")

from app.main import app
from app.routers.auth import create_jwt


def _run(coro):
    return asyncio.run(coro)


async def _get_me(client_host: str, headers: dict[str, str] | None = None):
    transport = ASGITransport(app=app, client=(client_host, 80))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get("/api/auth/me", headers=headers)


async def _get_me_with_cookie(token: str):
    transport = ASGITransport(app=app, client=("127.0.0.1", 80))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.cookies.set("ddc_session", token)
        return await client.get("/api/auth/me")


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


def test_me_returns_session_user_from_cookie():
    token = create_jwt(
        "12345",
        "discord-user",
        "user",
        display_name="Discord User",
        avatar_url="https://cdn.example/avatar.png",
    )
    resp = _run(_get_me_with_cookie(token))

    assert resp.status_code == 200
    assert resp.json() == {
        "user": {
            "id": "12345",
            "username": "discord-user",
            "displayName": "Discord User",
            "avatarUrl": "https://cdn.example/avatar.png",
            "role": "user",
        }
    }
