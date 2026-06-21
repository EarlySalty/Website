"""Tests for /api/auth/me with X-Admin-Validated from trusted localhost only."""

import asyncio
import os
from httpx import AsyncClient, ASGITransport

os.environ.setdefault("JWT_SECRET", "test-jwt-secret")

from app.main import app
from app.routers import auth as auth_router
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


async def _login(base_url: str):
    transport = ASGITransport(app=app, client=("127.0.0.1", 80))
    async with AsyncClient(transport=transport, base_url=base_url) as client:
        return await client.get("/api/auth/discord/login", follow_redirects=False)


async def _logout(base_url: str):
    transport = ASGITransport(app=app, client=("127.0.0.1", 80))
    async with AsyncClient(transport=transport, base_url=base_url) as client:
        return await client.post("/api/auth/logout")


def _set_cookie_headers(resp):
    return resp.headers.get_list("set-cookie")


def _pre_auth_cookie(headers):
    return next(header for header in headers if header.startswith("ddc_pre_auth="))


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


def test_me_returns_session_user_from_cookie(monkeypatch):
    async def fake_load_user_role(user_id, fallback_role="user"):
        return fallback_role

    monkeypatch.setattr(auth_router, "_load_user_role", fake_load_user_role)

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
            "is_coach": False,
        }
    }


def test_login_sets_ddc_domain_cookie_on_ddc_host(monkeypatch):
    async def fake_call_dashboard_api(path, payload):
        assert path == "/internal/v1/discord/initiate"
        return {
            "authorize_url": "https://discord.example/oauth",
            "state_id": "state-123",
        }

    monkeypatch.setattr(auth_router, "_call_dashboard_api", fake_call_dashboard_api)

    resp = _run(_login("https://deutsche-deadlock-community.de"))
    cookie = _pre_auth_cookie(_set_cookie_headers(resp))

    assert resp.status_code == 302
    assert "Domain=deutsche-deadlock-community.de" in cookie
    assert "Secure" in cookie


def test_login_keeps_host_only_cookie_on_localhost(monkeypatch):
    async def fake_call_dashboard_api(path, payload):
        assert path == "/internal/v1/discord/initiate"
        return {
            "authorize_url": "https://discord.example/oauth",
            "state_id": "state-123",
        }

    monkeypatch.setattr(auth_router, "_call_dashboard_api", fake_call_dashboard_api)

    resp = _run(_login("http://localhost"))
    cookie = _pre_auth_cookie(_set_cookie_headers(resp))

    assert resp.status_code == 302
    assert "Domain=" not in cookie
    assert "Secure" not in cookie


def test_logout_clears_host_and_ddc_domain_cookie_on_ddc_host():
    resp = _run(_logout("https://coaching.deutsche-deadlock-community.de"))
    cookies = _set_cookie_headers(resp)

    session_deletes = [cookie for cookie in cookies if cookie.startswith("ddc_session=")]

    assert resp.status_code == 204
    assert any("Domain=deutsche-deadlock-community.de" in cookie for cookie in session_deletes)
    assert any("Domain=" not in cookie for cookie in session_deletes)
