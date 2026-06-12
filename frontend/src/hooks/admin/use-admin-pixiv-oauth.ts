"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, NyaApi } from "@/lib/api";
import type { AdminActionRunner } from "./use-admin-action";

const PIXIV_OAUTH_SESSION_KEY = "nya.pixiv.oauth";

type PixivLoginDraft = {
  username: string;
  password: string;
};

type PixivVisibleSession = {
  id: string;
  status: string;
  message?: string | null;
  error?: string | null;
};

type UseAdminPixivOAuthOptions = {
  busy: string | null;
  run: AdminActionRunner;
  supportsBrowserOAuthLogin?: boolean;
  setPixivRefreshToken: (value: string) => void;
  setLastPixivUser: (value: Record<string, unknown> | null) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

export type PixivOAuthInputKind =
  | "empty"
  | "code"
  | "login"
  | "post_redirect"
  | "start"
  | "callback"
  | "third_party"
  | "unknown";

export function useAdminPixivOAuth({
  busy,
  run,
  supportsBrowserOAuthLogin,
  setPixivRefreshToken,
  setLastPixivUser,
  onError,
  onSuccess,
}: UseAdminPixivOAuthOptions) {
  const [pixivLoginDraft, setPixivLoginDraft] = useState<PixivLoginDraft>({ username: "", password: "" });
  const [pixivVisibleSession, setPixivVisibleSession] = useState<PixivVisibleSession | null>(null);
  const [pixivOAuthCallback, setPixivOAuthCallback] = useState("");
  const [pixivOAuthVerifier, setPixivOAuthVerifier] = useState("");
  const [pixivOAuthUrl, setPixivOAuthUrl] = useState("");

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(PIXIV_OAUTH_SESSION_KEY);
      if (!raw) return;
      const session = JSON.parse(raw) as { code_verifier?: string; authorization_url?: string };
      setPixivOAuthVerifier(session.code_verifier || "");
      setPixivOAuthUrl(session.authorization_url || "");
    } catch {
      window.sessionStorage.removeItem(PIXIV_OAUTH_SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    if (!pixivVisibleSession?.id || pixivVisibleSession.status !== "running") return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const session = await NyaApi.pixivOAuthVisibleStatus(pixivVisibleSession.id);
        if (cancelled) return;
        setPixivVisibleSession({
          id: session.id,
          status: session.status,
          message: session.message,
          error: session.error,
        });
        if (session.status === "success" && session.refresh_token) {
          setPixivRefreshToken(session.refresh_token);
          setLastPixivUser(session.user);
          setPixivLoginDraft({ username: "", password: "" });
          onSuccess("可见浏览器登录已获取 Refresh Token");
        }
        if (session.status === "error" && session.error) {
          onError(session.error);
        }
      } catch (err) {
        if (!cancelled) {
          onError(err instanceof ApiError ? err.message : String(err));
        }
      }
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [onError, onSuccess, pixivVisibleSession?.id, pixivVisibleSession?.status, setLastPixivUser, setPixivRefreshToken]);

  const pixivOAuthContinueUrl = useMemo(() => pixivPostRedirectUrl(pixivOAuthCallback), [pixivOAuthCallback]);
  const pixivOAuthStartUrl = useMemo(() => pixivPostRedirectStartUrl(pixivOAuthCallback), [pixivOAuthCallback]);
  const pixivOAuthInputKind = useMemo(() => pixivOAuthKind(pixivOAuthCallback), [pixivOAuthCallback]);
  const pixivOAuthOpenInputUrl = useMemo(
    () => (pixivOAuthInputKind === "login" || pixivOAuthInputKind === "start" ? pixivOAuthCallback.trim() : pixivOAuthContinueUrl),
    [pixivOAuthCallback, pixivOAuthContinueUrl, pixivOAuthInputKind]
  );
  const pixivOAuthHintText = useMemo(() => pixivOAuthHint(pixivOAuthInputKind), [pixivOAuthInputKind]);

  const pixivBrowserLoginDisabledReason = useMemo(() => {
    if (busy === "pixiv-oauth-browser-login") return "正在登录 Pixiv...";
    if (supportsBrowserOAuthLogin === false) return "后端未安装 pixiv-login，请安装后重启。";
    if (!pixivLoginDraft.username.trim()) return "请先填写 Pixiv ID / 邮箱。";
    if (!pixivLoginDraft.password) return "请先填写 Pixiv 密码。";
    return "";
  }, [busy, pixivLoginDraft.password, pixivLoginDraft.username, supportsBrowserOAuthLogin]);

  const pixivVisibleLoginDisabledReason = useMemo(() => {
    if (pixivVisibleSession?.status === "running") return "可见浏览器登录进行中，请在弹出的浏览器内完成登录。";
    if (busy === "pixiv-oauth-visible-start") return "正在启动可见浏览器...";
    if (supportsBrowserOAuthLogin === false) return "后端未安装 pixiv-login，请安装后重启。";
    return "";
  }, [busy, pixivVisibleSession?.status, supportsBrowserOAuthLogin]);

  const startPixivOAuth = useCallback(async () => {
    const popup = window.open("about:blank", "_blank");
    if (popup) {
      try {
        popup.document.title = "Pixiv OAuth";
        popup.document.body.innerHTML = '<p style="font:14px system-ui,sans-serif;padding:24px;">Opening Pixiv login...</p>';
      } catch {
        /* best effort placeholder */
      }
    }
    const result = await run(
      "pixiv-oauth-start",
      () => NyaApi.pixivOAuthStart(),
      () => "已生成 Pixiv 登录入口"
    );
    if (!result) {
      popup?.close();
      return;
    }
    setPixivOAuthVerifier(result.code_verifier);
    setPixivOAuthUrl(result.authorization_url);
    setPixivOAuthCallback("");
    try {
      window.sessionStorage.setItem(
        PIXIV_OAUTH_SESSION_KEY,
        JSON.stringify({
          code_verifier: result.code_verifier,
          authorization_url: result.authorization_url,
        })
      );
    } catch {
      /* session storage is only a convenience */
    }
    if (popup) {
      try {
        popup.opener = null;
        popup.location.replace(result.authorization_url);
      } catch {
        window.open(result.authorization_url, "_blank", "noopener,noreferrer");
      }
    } else {
      onError("浏览器拦截了新窗口，请点击下方登录链接。");
      window.open(result.authorization_url, "_blank", "noopener,noreferrer");
    }
  }, [onError, run]);

  const exchangePixivOAuth = useCallback(async () => {
    if (!pixivOAuthVerifier.trim()) {
      onError("请先打开 Pixiv 登录入口。");
      return;
    }
    const callback = pixivOAuthCallback.trim();
    if (!callback) {
      onError("请粘贴 Pixiv 回调 URL 或 code。");
      return;
    }
    const continueUrl = pixivPostRedirectUrl(callback);
    if (continueUrl) {
      onError("这是 Pixiv 中转页，请在 Pixiv 页面继续跳转后再复制 callback。");
      window.open(continueUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (pixivOAuthKind(callback) === "login") {
      onError("这是 Pixiv 登录入口，不是 callback。请先打开它完成登录。");
      window.open(callback, "_blank", "noopener,noreferrer");
      return;
    }
    if (pixivOAuthKind(callback) === "start") {
      onError("这是 Pixiv start 中间页，不是 callback；请回到 Pixiv 中转页继续流程。");
      return;
    }
    if (isPixivPicturesCallback(callback)) {
      onError("这是 pixiv.pictures 的第三方回调，不属于本次登录。请重新点击 NyaGallery 的 Pixiv 登录入口。");
      return;
    }
    const result = await run(
      "pixiv-oauth-exchange",
      () => NyaApi.pixivOAuthExchange({
        callback_url: callback,
        code_verifier: pixivOAuthVerifier.trim(),
      }),
      () => "已获取 Refresh Token"
    );
    if (!result) return;
    setPixivRefreshToken(result.refresh_token);
    setLastPixivUser(result.user);
    setPixivOAuthCallback("");
    try {
      window.sessionStorage.removeItem(PIXIV_OAUTH_SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, [onError, pixivOAuthCallback, pixivOAuthVerifier, run, setLastPixivUser, setPixivRefreshToken]);

  const loginPixivInBrowser = useCallback(async () => {
    const username = pixivLoginDraft.username.trim();
    if (!username || !pixivLoginDraft.password) {
      onError("请填写 Pixiv ID/邮箱和密码。");
      return;
    }
    const result = await run(
      "pixiv-oauth-browser-login",
      () => NyaApi.pixivOAuthBrowserLogin({ username, password: pixivLoginDraft.password }),
      () => "已获取 Pixiv Refresh Token"
    );
    if (!result) return;
    setPixivRefreshToken(result.refresh_token);
    setLastPixivUser(result.user);
    setPixivLoginDraft({ username, password: "" });
  }, [onError, pixivLoginDraft.password, pixivLoginDraft.username, run, setLastPixivUser, setPixivRefreshToken]);

  const startVisiblePixivLogin = useCallback(async () => {
    const username = pixivLoginDraft.username.trim();
    const result = await run(
      "pixiv-oauth-visible-start",
      () => NyaApi.pixivOAuthVisibleStart({
        username: username || undefined,
        password: pixivLoginDraft.password || undefined,
        timeout_seconds: 900,
      }),
      () => "已启动可见 Pixiv 登录浏览器"
    );
    if (!result) return;
    setPixivVisibleSession({
      id: result.id,
      status: result.status,
      message: result.message,
      error: result.error,
    });
  }, [pixivLoginDraft.password, pixivLoginDraft.username, run]);

  return {
    pixivLoginDraft,
    setPixivLoginDraft,
    pixivVisibleSession,
    pixivOAuthCallback,
    setPixivOAuthCallback,
    pixivOAuthVerifier,
    pixivOAuthUrl,
    pixivOAuthInputKind,
    pixivOAuthOpenInputUrl,
    pixivOAuthStartUrl,
    pixivOAuthHintText,
    pixivBrowserLoginDisabledReason,
    pixivVisibleLoginDisabledReason,
    startPixivOAuth,
    exchangePixivOAuth,
    loginPixivInBrowser,
    startVisiblePixivLogin,
  };
}

function isPixivPicturesCallback(value: string): boolean {
  try {
    return new URL(value).hostname.toLowerCase().endsWith("pixiv.pictures");
  } catch {
    return false;
  }
}

function pixivOAuthKind(value: string): PixivOAuthInputKind {
  const text = value.trim();
  if (!text) return "empty";
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    if (host.endsWith("pixiv.pictures")) return "third_party";
    if (host === "app-api.pixiv.net" && url.pathname === "/web/v1/login") return "login";
    if (host === "accounts.pixiv.net" && url.pathname === "/post-redirect") return "post_redirect";
    if (host === "app-api.pixiv.net" && url.pathname === "/web/v1/users/auth/pixiv/start") return "start";
    if (host === "app-api.pixiv.net" && url.pathname === "/web/v1/users/auth/pixiv/callback" && url.searchParams.get("code")) {
      return "callback";
    }
    return "unknown";
  } catch {
    return /^[A-Za-z0-9_-]{20,}$/.test(text) ? "code" : "unknown";
  }
}

function pixivOAuthHint(kind: PixivOAuthInputKind): string {
  if (kind === "empty") return "这里粘贴最终 callback URL，或只粘贴 code。";
  if (kind === "code") return "已识别为 code，可以换取 Token。";
  if (kind === "callback") return "已识别为 Pixiv callback，可以换取 Token。";
  if (kind === "login") return "这是登录入口：先打开它完成 Pixiv 登录，之后再复制 callback。";
  if (kind === "post_redirect") return "这是 Pixiv 中转页：点击“继续 Pixiv 跳转”会重新打开该 Pixiv 页面。";
  if (kind === "start") return "这是 Pixiv start 中间页，不能由 NyaGallery 直接提交；最终需要 callback 或 code。";
  if (kind === "third_party") return "这是第三方回调，不属于本次 NyaGallery OAuth。";
  return "未识别的内容：需要最终 callback URL 或 code。";
}

function pixivPostRedirectUrl(value: string): string | null {
  const clean = pixivPostRedirectStartUrl(value);
  if (!clean) return null;
  const rewritten = new URL("https://accounts.pixiv.net/post-redirect");
  rewritten.searchParams.set("return_to", clean);
  return rewritten.toString();
}

function pixivPostRedirectStartUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.hostname.toLowerCase() !== "accounts.pixiv.net" || url.pathname !== "/post-redirect") return null;
    const target = url.searchParams.get("return_to");
    if (!target) return null;
    const targetUrl = new URL(target);
    if (targetUrl.hostname.toLowerCase() !== "app-api.pixiv.net" || targetUrl.pathname !== "/web/v1/users/auth/pixiv/start") {
      return null;
    }
    const clean = new URL("https://app-api.pixiv.net/web/v1/users/auth/pixiv/start");
    for (const key of ["code_challenge", "code_challenge_method", "client", "via"]) {
      const raw = targetUrl.searchParams.get(key);
      if (raw) clean.searchParams.set(key, trimBeforeEmbeddedUrl(raw));
    }
    return clean.toString();
  } catch {
    return null;
  }
}

function trimBeforeEmbeddedUrl(value: string): string {
  const index = value.search(/https?:\/\//i);
  return index >= 0 ? value.slice(0, index) : value;
}
