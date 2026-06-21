import os
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlsplit

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse, Response
from jose import jwt

from app.database import get_db

router = APIRouter()

JWT_ALGORITHM = "HS256"
SESSION_COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "ddc_session").strip() or "ddc_session"
LEGACY_SESSION_COOKIE_NAMES = ("auth_token",)
PRE_AUTH_COOKIE_NAME = (
    os.getenv("AUTH_PRE_AUTH_COOKIE_NAME", "ddc_pre_auth").strip() or "ddc_pre_auth"
)
SESSION_TTL_SECONDS = int(os.getenv("AUTH_SESSION_TTL_SECONDS", str(30 * 24 * 60 * 60)))
PRE_AUTH_TTL_SECONDS = int(os.getenv("AUTH_PRE_AUTH_TTL_SECONDS", "600"))
SESSION_AUDIENCE = os.getenv("AUTH_SESSION_AUDIENCE", "ddc-web").strip() or "ddc-web"
SESSION_ISSUER = os.getenv("AUTH_SESSION_ISSUER", "ddc-auth").strip() or "ddc-auth"
COOKIE_DOMAIN = os.getenv("AUTH_COOKIE_DOMAIN", "").strip() or None
DDC_COOKIE_DOMAIN = (
    os.getenv("AUTH_DDC_COOKIE_DOMAIN", "deutsche-deadlock-community.de")
    .strip()
    .lower()
    .lstrip(".")
    or "deutsche-deadlock-community.de"
)
COOKIE_PATH = os.getenv("AUTH_COOKIE_PATH", "/").strip() or "/"
COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "lax").strip().lower() or "lax"
AUTH_PUBLIC_CALLBACK_URL = os.getenv("AUTH_PUBLIC_CALLBACK_URL", "").strip()
DASHBOARD_INTERNAL_API_BASE = (
    os.getenv("DASHBOARD_INTERNAL_API_BASE", "http://127.0.0.1:8766").strip()
    or "http://127.0.0.1:8766"
)
_DASHBOARD_INTERNAL_TOKEN_ENV_NAMES = (
    "WEBSITE_INTERNAL_API_TOKEN",
    "TURNIER_INTERNAL_API_TOKEN",
    "MAIN_BOT_INTERNAL_TOKEN",
    "TWITCH_INTERNAL_API_TOKEN",
)


def _session_secret(required: bool = False) -> str:
    secret = (
        os.getenv("AUTH_SESSION_SECRET", "").strip()
        or os.getenv("JWT_SECRET", "").strip()
        or os.getenv("SESSIONS_ENCRYPTION_KEY", "").strip()
    )
    if required and not secret:
        raise HTTPException(
            status_code=503,
            detail="Auth session secret is not configured",
        )
    return secret


def _dashboard_internal_token() -> str:
    for name in _DASHBOARD_INTERNAL_TOKEN_ENV_NAMES:
        value = os.getenv(name, "").strip()
        if value:
            return value
    return ""


def _is_trusted_forward_auth_proxy(request: Request) -> bool:
    client = request.client
    if not client:
        return False
    return client.host in {"127.0.0.1", "::1", "localhost"}


def _is_truthy(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _bare_host(value: str | None) -> str:
    raw = (value or "").split(",")[0].strip().lower()
    if raw.startswith("["):
        end = raw.find("]")
        return raw[1:end] if end > 0 else raw.strip("[]")
    if raw.count(":") == 1:
        return raw.rsplit(":", 1)[0]
    return raw


def _request_host(request: Request) -> str:
    return _bare_host(
        request.headers.get("X-Forwarded-Host")
        or request.headers.get("Host")
        or request.url.netloc
    )


def _cookie_secure(request: Request) -> bool:
    explicit = os.getenv("AUTH_COOKIE_SECURE")
    if explicit is not None:
        return _is_truthy(explicit)
    if _is_truthy(os.getenv("AUTH_INSECURE_COOKIE"), default=False):
        return False
    bare_host = _request_host(request)
    if bare_host in {"127.0.0.1", "localhost", "::1"}:
        return False
    scheme = (
        (request.headers.get("X-Forwarded-Proto") or request.url.scheme or "").split(",")[0]
    ).strip().lower()
    return scheme == "https"


def _normalized_cookie_domain(value: str | None) -> str | None:
    domain = (value or "").strip().lower().lstrip(".")
    return domain or None


def _cookie_domain(request: Request) -> str | None:
    explicit_domain = _normalized_cookie_domain(COOKIE_DOMAIN)
    if explicit_domain:
        return explicit_domain

    host = _request_host(request)
    if host == DDC_COOKIE_DOMAIN or host.endswith(f".{DDC_COOKIE_DOMAIN}"):
        return DDC_COOKIE_DOMAIN
    return None


def _cookie_delete_kwargs(domain: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"path": COOKIE_PATH}
    if domain:
        payload["domain"] = domain
    return payload


def _cookie_delete_kwargs_variants(request: Request) -> list[dict[str, Any]]:
    variants = [_cookie_delete_kwargs()]
    domain = _cookie_domain(request)
    if domain:
        variants.append(_cookie_delete_kwargs(domain))
    return variants


def _delete_cookie_variants(response: Response, request: Request, name: str) -> None:
    for kwargs in _cookie_delete_kwargs_variants(request):
        response.delete_cookie(name, **kwargs)


def _cookie_set_kwargs(request: Request) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "httponly": True,
        "secure": _cookie_secure(request),
        "samesite": COOKIE_SAMESITE,
        "path": COOKIE_PATH,
    }
    domain = _cookie_domain(request)
    if domain:
        payload["domain"] = domain
    return payload


def _normalize_redirect_path(value: str | None, fallback: str = "/") -> str:
    raw = (value or "").strip()
    if not raw:
        return fallback
    if any(ch in raw for ch in ("\r", "\n", "\x00")):
        return fallback
    parsed = urlsplit(raw)
    if parsed.scheme or parsed.netloc:
        return fallback
    if not parsed.path.startswith("/") or parsed.path.startswith("//"):
        return fallback
    if ".." in parsed.path.split("/"):
        return fallback
    normalized = parsed.path
    if parsed.query:
        normalized = f"{normalized}?{parsed.query}"
    if parsed.fragment:
        normalized = f"{normalized}#{parsed.fragment}"
    return normalized


def _public_base_path(request: Request) -> str:
    callback_path = urlsplit(str(request.url_for("discord_callback"))).path
    suffix = "/api/auth/discord/callback"
    if callback_path.endswith(suffix):
        base_path = callback_path[: -len(suffix)]
        return base_path or "/"
    return "/"


def _default_redirect_path(request: Request) -> str:
    base_path = _public_base_path(request)
    return base_path if base_path.endswith("/") else f"{base_path}/"


def _build_callback_url(request: Request) -> str:
    if AUTH_PUBLIC_CALLBACK_URL:
        return AUTH_PUBLIC_CALLBACK_URL

    callback_path = urlsplit(str(request.url_for("discord_callback"))).path
    scheme = (
        (request.headers.get("X-Forwarded-Proto") or request.url.scheme or "").split(",")[0]
    ).strip()
    host = (
        (request.headers.get("X-Forwarded-Host") or request.headers.get("Host") or request.url.netloc).split(",")[0]
    ).strip()
    if not scheme or not host:
        raise HTTPException(status_code=503, detail="Cannot determine external auth callback URL")
    return f"{scheme}://{host}{callback_path}"


async def _call_dashboard_api(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    token = _dashboard_internal_token()
    if not token:
        raise HTTPException(status_code=503, detail="Internal dashboard auth token is not configured")

    url = f"{DASHBOARD_INTERNAL_API_BASE.rstrip('/')}{path}"
    headers = {"X-Internal-Token": token, "Content-Type": "application/json"}
    timeout = httpx.Timeout(20.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload, headers=headers)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Central auth service is not reachable") from exc

    if response.status_code != 200:
        detail = response.text.strip() or "Central auth service rejected the request"
        raise HTTPException(status_code=503, detail=detail[:300])

    data = response.json()
    if not isinstance(data, dict):
        raise HTTPException(status_code=503, detail="Central auth service returned invalid payload")
    return data


def create_jwt(
    user_id: str,
    username: str,
    role: str,
    *,
    display_name: str | None = None,
    avatar_url: str | None = None,
    ttl_seconds: int = SESSION_TTL_SECONDS,
) -> str:
    secret = _session_secret(required=True)
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "username": username,
        "display_name": display_name or username,
        "avatar_url": avatar_url,
        "role": role,
        "iss": SESSION_ISSUER,
        "aud": SESSION_AUDIENCE,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl_seconds)).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def _create_pre_auth_token(state_id: str, next_path: str) -> str:
    secret = _session_secret(required=True)
    now = datetime.now(timezone.utc)
    payload = {
        "state_id": state_id,
        "next": next_path,
        "kind": "pre_auth",
        "iss": SESSION_ISSUER,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=PRE_AUTH_TTL_SECONDS)).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> dict[str, Any] | None:
    secret = _session_secret(required=False)
    if not token or not secret:
        return None
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=[JWT_ALGORITHM],
            audience=SESSION_AUDIENCE,
            issuer=SESSION_ISSUER,
        )
        return payload if isinstance(payload, dict) else None
    except Exception:
        try:
            payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
            return payload if isinstance(payload, dict) else None
        except Exception:
            return None


def _decode_pre_auth_token(token: str) -> dict[str, Any] | None:
    payload = decode_jwt(token)
    if not payload:
        return None
    if str(payload.get("kind") or "") != "pre_auth":
        return None
    return payload


def _session_cookie_value(request: Request) -> str:
    primary = request.cookies.get(SESSION_COOKIE_NAME)
    if primary:
        return primary
    for legacy_name in LEGACY_SESSION_COOKIE_NAMES:
        legacy = request.cookies.get(legacy_name)
        if legacy:
            return legacy
    return ""


async def _upsert_meta_user(
    *,
    user_id: str,
    username: str,
    display_name: str,
    avatar_url: str | None,
) -> str:
    db = await get_db()
    try:
        cursor = await db.execute("SELECT role FROM meta_users WHERE id = ?", (user_id,))
        existing = await cursor.fetchone()
        role = str(existing["role"] or "user") if existing else "user"

        if existing:
            await db.execute(
                """
                UPDATE meta_users
                SET username = ?, display_name = ?, avatar_url = ?
                WHERE id = ?
                """,
                (username, display_name, avatar_url, user_id),
            )
        else:
            await db.execute(
                """
                INSERT INTO meta_users (id, username, display_name, avatar_url, role)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, username, display_name, avatar_url, role),
            )
        await db.commit()
        return role
    finally:
        await db.close()


async def _load_user_role(user_id: str, fallback_role: str = "user") -> str:
    db = await get_db()
    try:
        cursor = await db.execute("SELECT role FROM meta_users WHERE id = ?", (user_id,))
        row = await cursor.fetchone()
        if row and row["role"]:
            return str(row["role"])
        return fallback_role
    finally:
        await db.close()


async def get_current_user_optional(request: Request) -> dict[str, Any] | None:
    if (
        request.headers.get("X-Admin-Validated") == "1"
        and _is_trusted_forward_auth_proxy(request)
    ):
        username = request.headers.get("X-Admin-User") or "admin"
        return {
            "id": "caddy-validated-admin",
            "username": username,
            "displayName": username,
            "avatarUrl": None,
            "role": "admin",
            "sub": "caddy-validated-admin",
        }

    token = _session_cookie_value(request)
    payload = decode_jwt(token)
    if not payload:
        return None

    user_id = str(payload.get("sub") or "").strip()
    username = str(payload.get("username") or "").strip()
    if not user_id or not username:
        return None

    role = await _load_user_role(user_id, str(payload.get("role") or "user"))
    display_name = str(payload.get("display_name") or payload.get("displayName") or username).strip()
    avatar_url = payload.get("avatar_url") or payload.get("avatarUrl")

    return {
        "id": user_id,
        "username": username,
        "displayName": display_name or username,
        "avatarUrl": avatar_url,
        "role": role,
        "sub": user_id,
    }


async def require_authenticated_user(request: Request) -> dict[str, Any]:
    user = await get_current_user_optional(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def require_admin_user(request: Request) -> dict[str, Any]:
    user = await require_authenticated_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


async def _is_active_coach(user_id: str) -> bool:
    """True, wenn der Discord-User eine aktive Zeile in coaches hat."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT 1 FROM coaches WHERE discord_user_id=? AND status='active'",
            (int(user_id),),
        )
        return (await cursor.fetchone()) is not None
    except Exception:
        return False
    finally:
        await db.close()


async def require_coach_user(request: Request) -> dict[str, Any]:
    """Coach-Gate: eingeloggt UND (Admin ODER aktive Zeile in coaches)."""
    user = await require_authenticated_user(request)
    if user.get("role") == "admin":
        return user
    if not await _is_active_coach(user["sub"]):
        raise HTTPException(status_code=403, detail="Coach only")
    return user


@router.get("/discord/login")
async def discord_login(request: Request, next: str | None = None):
    callback_url = _build_callback_url(request)
    next_path = _normalize_redirect_path(next, fallback=_default_redirect_path(request))
    data = await _call_dashboard_api(
        "/internal/v1/discord/initiate",
        {
            "scope": "identify",
            "redirect_after": callback_url,
            "requesting_service": "builds",
            "metadata": {"site": "builds"},
        },
    )
    authorize_url = str(data.get("authorize_url") or "").strip()
    state_id = str(data.get("state_id") or "").strip()
    if not authorize_url or not state_id:
        raise HTTPException(status_code=503, detail="Central auth service returned incomplete data")

    response = RedirectResponse(authorize_url, status_code=302)
    response.set_cookie(
        PRE_AUTH_COOKIE_NAME,
        _create_pre_auth_token(state_id, next_path),
        max_age=PRE_AUTH_TTL_SECONDS,
        **_cookie_set_kwargs(request),
    )
    return response


@router.get("/discord/callback", name="discord_callback")
async def discord_callback(request: Request, state_id: str | None = None):
    next_path = _default_redirect_path(request)
    pre_auth = _decode_pre_auth_token(request.cookies.get(PRE_AUTH_COOKIE_NAME, ""))
    if pre_auth:
        next_path = _normalize_redirect_path(pre_auth.get("next"), fallback=next_path)

    response = RedirectResponse(next_path, status_code=302)
    _delete_cookie_variants(response, request, PRE_AUTH_COOKIE_NAME)

    state_id_value = str(state_id or (pre_auth or {}).get("state_id") or "").strip()
    if not state_id_value:
        return response

    try:
        data = await _call_dashboard_api(
            "/internal/v1/discord/consume-result",
            {"state_id": state_id_value},
        )
    except HTTPException:
        return response
    discord_id = str(data.get("discord_id") or "").strip()
    discord_name = str(data.get("discord_name") or "").strip()
    if not discord_id or not discord_name:
        return response

    avatar_url = data.get("discord_avatar")
    role = await _upsert_meta_user(
        user_id=discord_id,
        username=discord_name,
        display_name=discord_name,
        avatar_url=avatar_url,
    )
    session_token = create_jwt(
        discord_id,
        discord_name,
        role,
        display_name=discord_name,
        avatar_url=avatar_url,
    )
    response.set_cookie(
        SESSION_COOKIE_NAME,
        session_token,
        max_age=SESSION_TTL_SECONDS,
        **_cookie_set_kwargs(request),
    )
    for legacy_name in LEGACY_SESSION_COOKIE_NAMES:
        _delete_cookie_variants(response, request, legacy_name)
    return response


@router.get("/me")
async def me(request: Request):
    user = await get_current_user_optional(request)
    if not user:
        return {"user": None}
    is_coach = user["role"] == "admin" or await _is_active_coach(user["sub"])
    return {
        "user": {
            "id": user["id"],
            "username": user["username"],
            "displayName": user["displayName"],
            "avatarUrl": user["avatarUrl"],
            "role": user["role"],
            "is_coach": is_coach,
        }
    }


@router.post("/logout")
async def logout(request: Request):
    response = Response(status_code=204)
    _delete_cookie_variants(response, request, SESSION_COOKIE_NAME)
    _delete_cookie_variants(response, request, PRE_AUTH_COOKIE_NAME)
    for legacy_name in LEGACY_SESSION_COOKIE_NAMES:
        _delete_cookie_variants(response, request, legacy_name)
    return response
