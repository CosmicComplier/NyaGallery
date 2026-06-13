from __future__ import annotations

import os
import json
import sys

from nyagallery.pixiv import PixivOAuthError, get_pixiv_refresh_token_with_browser, get_pixiv_refresh_token_with_cookie


def _apply_proxy(proxy_url: str) -> None:
    proxy = proxy_url.strip()
    if not proxy:
        return
    for key in (
        "NYAGALLERY_NETWORK_PROXY",
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
    ):
        os.environ[key] = proxy


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        mode = str(payload.get("mode") or "browser")
        proxy_url = str(payload.get("proxy_url") or payload.get("proxy") or "").strip()
        _apply_proxy(proxy_url)
        if mode == "cookie":
            token = get_pixiv_refresh_token_with_cookie(
                cookie=str(payload.get("cookie") or ""),
                headless=bool(payload.get("headless", True)),
                timeout_seconds=int(payload.get("timeout_seconds") or 180),
                proxy_url=proxy_url,
            )
        else:
            token = get_pixiv_refresh_token_with_browser(
                headless=bool(payload.get("headless", True)),
                username=str(payload.get("username") or "").strip() or None,
                password=str(payload.get("password") or "") or None,
                proxy_url=proxy_url,
            )
        print(
            json.dumps(
                {
                    "access_token": token.access_token,
                    "refresh_token": token.refresh_token,
                    "expires_in": token.expires_in,
                    "token_type": token.token_type,
                    "scope": token.scope,
                    "user": token.user,
                },
                ensure_ascii=False,
            )
        )
        return 0
    except (PixivOAuthError, Exception) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
