"use client";

import { useCallback, useState } from "react";
import { ApiError, NyaApi } from "@/lib/api";
import type { PixivCookieSummary, PixivTokenSummary } from "@/lib/types";
import type { AdminActionRunner } from "./use-admin-action";

type UseAdminPixivCredentialsOptions = {
  run: AdminActionRunner;
  onError: (message: string) => void;
  username: string;
};

export function useAdminPixivCredentials({
  run,
  onError,
  username,
}: UseAdminPixivCredentialsOptions) {
  const [lastPixivUser, setLastPixivUser] = useState<Record<string, unknown> | null>(null);
  const [pixivRefreshToken, setPixivRefreshToken] = useState("");
  const [pixivSavedTokenId, setPixivSavedTokenId] = useState<number | null>(null);
  const [pixivTokenLabel, setPixivTokenLabel] = useState("");
  const [pixivSavedTokens, setPixivSavedTokens] = useState<PixivTokenSummary[]>([]);
  const [pixivTokenDrafts, setPixivTokenDrafts] = useState<Record<number, string>>({});
  const [pixivSavedCookieId, setPixivSavedCookieId] = useState<number | null>(null);
  const [pixivCookieLabel, setPixivCookieLabel] = useState("");
  const [pixivSavedCookies, setPixivSavedCookies] = useState<PixivCookieSummary[]>([]);
  const [pixivCookieDrafts, setPixivCookieDrafts] = useState<Record<number, string>>({});
  const [pixivCookie, setPixivCookie] = useState("");

  const loadPixivTokensFor = useCallback(
    async (targetUsername: string, showToast = true) => {
      const target = targetUsername.trim();
      if (!target) return null;
      if (showToast) {
        const result = await run(
          "pixiv-token-list",
          () => NyaApi.userPixivTokens(target),
          (response) => `已加载 ${response.items.length} 个 Pixiv Token`
        );
        if (result) {
          setPixivSavedTokens(result.items);
          setPixivTokenDrafts(Object.fromEntries(result.items.map((item) => [item.id, item.label || ""])));
          if (pixivSavedTokenId && !result.items.some((item) => item.id === pixivSavedTokenId && item.is_active)) {
            setPixivSavedTokenId(null);
          }
        }
        return result;
      }
      try {
        const result = await NyaApi.userPixivTokens(target);
        setPixivSavedTokens(result.items);
        setPixivTokenDrafts(Object.fromEntries(result.items.map((item) => [item.id, item.label || ""])));
        if (pixivSavedTokenId && !result.items.some((item) => item.id === pixivSavedTokenId && item.is_active)) {
          setPixivSavedTokenId(null);
        }
        return result;
      } catch (err) {
        onError(err instanceof ApiError ? err.message : String(err));
        return null;
      }
    },
    [onError, pixivSavedTokenId, run]
  );

  const loadPixivCookiesFor = useCallback(
    async (targetUsername: string, showToast = true) => {
      const target = targetUsername.trim();
      if (!target) return null;
      if (showToast) {
        const result = await run(
          "pixiv-cookie-list",
          () => NyaApi.userPixivCookies(target),
          (response) => `已加载 ${response.items.length} 个 Pixiv Cookie`
        );
        if (result) {
          setPixivSavedCookies(result.items);
          setPixivCookieDrafts(Object.fromEntries(result.items.map((item) => [item.id, item.label ?? ""])));
        }
        return result;
      }

      try {
        const result = await NyaApi.userPixivCookies(target);
        setPixivSavedCookies(result.items);
        setPixivCookieDrafts(Object.fromEntries(result.items.map((item) => [item.id, item.label ?? ""])));
        return result;
      } catch (err) {
        onError(err instanceof ApiError ? err.message : String(err));
        return null;
      }
    },
    [onError, run]
  );

  const saveCurrentPixivToken = useCallback(async () => {
    const refreshToken = pixivRefreshToken.trim();
    if (!username || !refreshToken) return;
    const result = await run(
      "pixiv-token-save",
      () => NyaApi.savePixivToken(username, {
        refresh_token: refreshToken,
        label: pixivTokenLabel.trim(),
        pixiv_user: lastPixivUser,
      }),
      () => "Pixiv Token 已保存"
    );
    if (!result) return;
    setPixivSavedTokenId(result.id);
    setPixivTokenLabel("");
    setPixivRefreshToken("");
    const refreshed = await loadPixivTokensFor(username, false);
    if (refreshed?.items.some((item) => item.id === result.id && item.is_active)) {
      setPixivSavedTokenId(result.id);
    }
  }, [lastPixivUser, loadPixivTokensFor, pixivRefreshToken, pixivTokenLabel, run, username]);

  const saveCurrentPixivCookie = useCallback(async () => {
    const cookie = pixivCookie.trim();
    if (!username || !cookie) return;
    const result = await run(
      "pixiv-cookie-save",
      () => NyaApi.savePixivCookie(username, {
        cookie,
        label: pixivCookieLabel.trim(),
        pixiv_user: lastPixivUser,
      }),
      () => "Pixiv Cookie 已保存"
    );
    if (!result) return;
    setPixivSavedCookieId(result.id);
    setPixivCookieLabel("");
    setPixivCookie("");
    const refreshed = await loadPixivCookiesFor(username, false);
    if (refreshed?.items.some((item) => item.id === result.id && item.is_active)) {
      setPixivSavedCookieId(result.id);
    }
  }, [lastPixivUser, loadPixivCookiesFor, pixivCookie, pixivCookieLabel, run, username]);

  const updatePixivTokenLabel = useCallback(
    async (tokenId: number) => {
      const label = pixivTokenDrafts[tokenId] ?? "";
      const result = await run(
        `pixiv-token-update-${tokenId}`,
        () => NyaApi.updatePixivToken(tokenId, label),
        () => "Pixiv Token 备注已更新"
      );
      if (result && username) await loadPixivTokensFor(username, false);
    },
    [loadPixivTokensFor, pixivTokenDrafts, run, username]
  );

  const updatePixivCookieLabel = useCallback(
    async (cookieId: number) => {
      const label = pixivCookieDrafts[cookieId] ?? "";
      const result = await run(
        `pixiv-cookie-update-${cookieId}`,
        () => NyaApi.updatePixivCookie(cookieId, label),
        () => "Pixiv Cookie 备注已更新"
      );
      if (result && username) await loadPixivCookiesFor(username, false);
    },
    [loadPixivCookiesFor, pixivCookieDrafts, run, username]
  );

  const revokePixivSavedToken = useCallback(
    async (tokenId: number) => {
      const result = await run(
        `pixiv-token-revoke-${tokenId}`,
        () => NyaApi.revokePixivToken(tokenId),
        () => "Pixiv Token 已撤销"
      );
      if (!result) return;
      if (pixivSavedTokenId === tokenId) setPixivSavedTokenId(null);
      if (username) await loadPixivTokensFor(username, false);
    },
    [loadPixivTokensFor, pixivSavedTokenId, run, username]
  );

  const revokePixivSavedCookie = useCallback(
    async (cookieId: number) => {
      const result = await run(
        `pixiv-cookie-revoke-${cookieId}`,
        () => NyaApi.revokePixivCookie(cookieId),
        () => "Pixiv Cookie 已撤销"
      );
      if (!result) return;
      if (pixivSavedCookieId === cookieId) setPixivSavedCookieId(null);
      if (username) await loadPixivCookiesFor(username, false);
    },
    [loadPixivCookiesFor, pixivSavedCookieId, run, username]
  );

  return {
    lastPixivUser,
    setLastPixivUser,
    pixivRefreshToken,
    setPixivRefreshToken,
    pixivSavedTokenId,
    setPixivSavedTokenId,
    pixivTokenLabel,
    setPixivTokenLabel,
    pixivSavedTokens,
    pixivTokenDrafts,
    setPixivTokenDrafts,
    pixivSavedCookieId,
    setPixivSavedCookieId,
    pixivCookieLabel,
    setPixivCookieLabel,
    pixivSavedCookies,
    pixivCookieDrafts,
    setPixivCookieDrafts,
    pixivCookie,
    setPixivCookie,
    loadPixivTokensFor,
    loadPixivCookiesFor,
    saveCurrentPixivToken,
    saveCurrentPixivCookie,
    updatePixivTokenLabel,
    updatePixivCookieLabel,
    revokePixivSavedToken,
    revokePixivSavedCookie,
  };
}
