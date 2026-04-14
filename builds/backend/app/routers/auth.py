import os

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
import httpx
import secrets
from datetime import datetime, timedelta
from jose import jwt

router = APIRouter()

DISCORD_CLIENT_ID = "YOUR_DISCORD_CLIENT_ID"  # TODO: from config
DISCORD_CLIENT_SECRET = "YOUR_DISCORD_CLIENT_SECRET"  # TODO: from config
DISCORD_REDIRECT_URI = "http://localhost:8000/api/auth/discord/callback"
DISCORD_API_BASE = "https://discord.com/api/v10"
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"

oauth_states: dict[str, dict] = {}


def _is_trusted_forward_auth_proxy(request: Request) -> bool:
    client = request.client
    if not client:
        return False

    return client.host in {"127.0.0.1", "::1", "localhost"}

def create_jwt(user_id: str, username: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except:
        return None

@router.get("/discord/login")
async def discord_login(request: Request):
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        "created_at": datetime.utcnow().timestamp(),
        "next": request.query_params.get("next", "/")
    }

    params = {
        "client_id": DISCORD_CLIENT_ID,
        "redirect_uri": DISCORD_REDIRECT_URI,
        "response_type": "code",
        "scope": "identify",
        "state": state
    }

    query = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(f"{DISCORD_API_BASE}/oauth2/authorize?{query}")

@router.get("/discord/callback")
async def discord_callback(request: Request, code: str = None, state: str = None, error: str = None):
    if error:
        raise HTTPException(status_code=401, detail=f"Discord OAuth error: {error}")

    if not code or state not in oauth_states:
        raise HTTPException(status_code=400, detail="Invalid state or missing code")

    # Clean up state
    oauth_states.pop(state, None)

    # Exchange code for token
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            f"{DISCORD_API_BASE}/oauth2/token",
            data={
                "client_id": DISCORD_CLIENT_ID,
                "client_secret": DISCORD_CLIENT_SECRET,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": DISCORD_REDIRECT_URI
            }
        )

    if token_res.status_code != 200:
        raise HTTPException(status_code=401, detail="Failed to exchange code for token")

    token_data = token_res.json()
    access_token = token_data.get("access_token")

    # Get user info
    async with httpx.AsyncClient() as client:
        user_res = await client.get(
            f"{DISCORD_API_BASE}/users/@me",
            headers={"Authorization": f"Bearer {access_token}"}
        )

    if user_res.status_code != 200:
        raise HTTPException(status_code=401, detail="Failed to get user info")

    user_data = user_res.json()

    # Create JWT
    jwt_token = create_jwt(user_data["id"], user_data["username"], "user")

    # TODO: Store user in database

    response = RedirectResponse(url="http://localhost:3000/?logged_in=true")
    response.set_cookie(
        key="auth_token",
        value=jwt_token,
        httponly=True,
        secure=False,  # TODO: True in production
        samesite="lax",
        max_age=60 * 60 * 24 * 7  # 7 days
    )
    return response

@router.get("/me")
async def me(request: Request):
    if (
        request.headers.get("X-Admin-Validated") == "1"
        and _is_trusted_forward_auth_proxy(request)
    ):
        username = request.headers.get("X-Admin-User") or "admin"
        return {
            "user": {
                "id": "caddy-validated-admin",
                "username": username,
                "displayName": username,
                "avatarUrl": None,
                "role": "admin",
            }
        }

    token = request.cookies.get("auth_token")
    if not token:
        return {"user": None}

    data = decode_jwt(token)
    if not data:
        return {"user": None}

    return {
        "user": {
            "id": data["sub"],
            "username": data["username"],
            "displayName": data["username"],
            "avatarUrl": None,
            "role": data["role"]
        }
    }

@router.post("/logout")
async def logout(request: Request):
    response = {"message": "Logged out"}
    response = RedirectResponse(url="http://localhost:3000/", status_code=303)
    response.delete_cookie("auth_token")
    return response
