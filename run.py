import os
import hashlib
import hmac
import secrets
import time

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from backend.main import app


AUTH_COOKIE_NAME = "butterfly_session"
AUTH_MAX_AGE_SECONDS = 60 * 60 * 12
BUTTERFLY_PASSWORD = os.environ.get("BUTTERFLY_PASSWORD", "butterfly-demo")
BUTTERFLY_SECRET = os.environ.get("BUTTERFLY_SECRET", "local-butterfly-secret-change-on-render")
BUTTERFLY_COOKIE_SECURE = os.environ.get("BUTTERFLY_COOKIE_SECURE", "false").lower() == "true"


def sign_session(expires_at: int) -> str:
    payload = f"butterfly:{expires_at}"
    signature = hmac.new(BUTTERFLY_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}:{signature}"


def valid_session(cookie_value: str | None) -> bool:
    if not cookie_value:
        return False
    parts = cookie_value.split(":")
    if len(parts) != 3 or parts[0] != "butterfly":
        return False
    try:
        expires_at = int(parts[1])
    except ValueError:
        return False
    if expires_at < int(time.time()):
        return False
    return hmac.compare_digest(cookie_value, sign_session(expires_at))


@app.middleware("http")
async def password_gate(request: Request, call_next):
    open_paths = {
        "/",
        "/api/health",
        "/api/auth/status",
        "/api/auth/login",
        "/api/auth/logout",
    }
    if request.url.path.startswith("/assets") or request.url.path in open_paths:
        return await call_next(request)
    if request.url.path.startswith("/api") and not valid_session(request.cookies.get(AUTH_COOKIE_NAME)):
        return JSONResponse({"detail": "Login required"}, status_code=401)
    return await call_next(request)


@app.get("/api/auth/status")
def runtime_auth_status(request: Request) -> dict[str, bool]:
    return {"authenticated": valid_session(request.cookies.get(AUTH_COOKIE_NAME))}


@app.post("/api/auth/login")
async def runtime_auth_login(request: Request, response: Response) -> dict[str, bool]:
    payload = await request.json()
    if not secrets.compare_digest(str(payload.get("password", "")), BUTTERFLY_PASSWORD):
        return JSONResponse({"detail": "Incorrect password"}, status_code=401)
    expires_at = int(time.time()) + AUTH_MAX_AGE_SECONDS
    response.set_cookie(
        AUTH_COOKIE_NAME,
        sign_session(expires_at),
        max_age=AUTH_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=BUTTERFLY_COOKIE_SECURE,
    )
    return {"authenticated": True}


@app.post("/api/auth/logout")
def runtime_auth_logout(response: Response) -> dict[str, bool]:
    response.delete_cookie(AUTH_COOKIE_NAME)
    return {"authenticated": False}

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
