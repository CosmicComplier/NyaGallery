"use client";

import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyLine } from "@/components/admin/admin-fields";
import { cn } from "@/lib/utils";
import type { PixivCookieSummary, PixivTokenSummary } from "@/lib/types";
import { formatDate } from "./admin-format";

export function PixivTokenManager({
  tokens,
  selectedTokenId,
  label,
  drafts,
  busy,
  canSave,
  onSelect,
  onLabelChange,
  onSave,
  onDraftChange,
  onUpdateLabel,
  onRevoke,
}: {
  tokens: PixivTokenSummary[];
  selectedTokenId: number | null;
  label: string;
  drafts: Record<number, string>;
  busy: string | null;
  canSave: boolean;
  onSelect: (tokenId: number | null) => void;
  onLabelChange: (label: string) => void;
  onSave: () => void;
  onDraftChange: (tokenId: number, label: string) => void;
  onUpdateLabel: (tokenId: number) => void;
  onRevoke: (tokenId: number) => void;
}) {
  const activeTokens = tokens.filter((token) => token.is_active);

  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-background/50 p-3">
      <div className="space-y-1.5">
        <Label>使用已保存的 Pixiv Token</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-ring"
          value={selectedTokenId ?? ""}
          onChange={(event) => onSelect(event.target.value ? Number(event.target.value) : null)}
        >
          <option value="">不使用保存项，改用上方临时 Token / 环境变量</option>
          {activeTokens.map((token) => (
            <option key={token.id} value={token.id}>
              {pixivTokenDisplayName(token)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] xl:grid-cols-1">
        <Input
          value={label}
          onChange={(event) => onLabelChange(event.target.value)}
          placeholder="备注，例如：主账号 / R18 可见 / 备用"
        />
        <Button
          type="button"
          variant="outline"
          disabled={!canSave || busy === "pixiv-token-save"}
          onClick={onSave}
        >
          <Save className="h-4 w-4" /> 保存当前 Token
        </Button>
      </div>
      {tokens.length === 0 ? (
        <EmptyLine text="暂无已保存 Pixiv Token" />
      ) : (
        <div className="max-h-64 space-y-2 overflow-auto">
          {tokens.map((token) => (
            <div
              key={token.id}
              className={cn(
                "rounded-md border border-border p-2 text-[11px]",
                selectedTokenId === token.id && "border-primary/45 bg-primary/5",
                !token.is_active && "opacity-55"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-mono" title={`${token.token_prefix}...${token.token_suffix}`}>
                    {token.token_prefix}...{token.token_suffix}
                  </div>
                  <div className="truncate text-muted-foreground" title={pixivTokenAccountLine(token)}>
                    {pixivTokenAccountLine(token)}
                  </div>
                </div>
                <span className={token.is_active ? "shrink-0 text-emerald-600 dark:text-emerald-400" : "shrink-0 text-muted-foreground"}>
                  {token.is_active ? "active" : "revoked"}
                </span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto] xl:grid-cols-1">
                <Input
                  className="h-8 text-xs"
                  value={drafts[token.id] ?? token.label ?? ""}
                  onChange={(event) => onDraftChange(token.id, event.target.value)}
                  placeholder="备注"
                  disabled={!token.is_active}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!token.is_active || busy === `pixiv-token-update-${token.id}`}
                  onClick={() => onUpdateLabel(token.id)}
                >
                  备注
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!token.is_active || busy === `pixiv-token-revoke-${token.id}`}
                  onClick={() => onRevoke(token.id)}
                >
                  撤销
                </Button>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                <span>创建 {formatDate(token.created_at)}</span>
                <span>使用 {formatDate(token.last_used_at)}</span>
                {token.last_used_ip && <span className="font-mono">{token.last_used_ip}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PixivCookieManager({
  cookies,
  selectedCookieId,
  label,
  drafts,
  busy,
  canSave,
  onSelect,
  onLabelChange,
  onSave,
  onDraftChange,
  onUpdateLabel,
  onRevoke,
}: {
  cookies: PixivCookieSummary[];
  selectedCookieId: number | null;
  label: string;
  drafts: Record<number, string>;
  busy: string | null;
  canSave: boolean;
  onSelect: (cookieId: number | null) => void;
  onLabelChange: (label: string) => void;
  onSave: () => void;
  onDraftChange: (cookieId: number, label: string) => void;
  onUpdateLabel: (cookieId: number) => void;
  onRevoke: (cookieId: number) => void;
}) {
  const activeCookies = cookies.filter((cookie) => cookie.is_active);

  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-background/50 p-3">
      <div className="space-y-1.5">
        <Label>使用已保存的 Pixiv Cookie</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-ring"
          value={selectedCookieId ?? ""}
          onChange={(event) => onSelect(event.target.value ? Number(event.target.value) : null)}
        >
          <option value="">不使用保存项，改用上方临时 Cookie</option>
          {activeCookies.map((cookie) => (
            <option key={cookie.id} value={cookie.id}>
              {pixivCookieDisplayName(cookie)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] xl:grid-cols-1">
        <Input
          value={label}
          onChange={(event) => onLabelChange(event.target.value)}
          placeholder="备注，例如：浏览器主会话 / 备用"
        />
        <Button
          type="button"
          variant="outline"
          disabled={!canSave || busy === "pixiv-cookie-save"}
          onClick={onSave}
        >
          <Save className="h-4 w-4" /> 保存当前 Cookie
        </Button>
      </div>
      {cookies.length === 0 ? (
        <EmptyLine text="暂无已保存 Pixiv Cookie" />
      ) : (
        <div className="max-h-64 space-y-2 overflow-auto">
          {cookies.map((cookie) => (
            <div
              key={cookie.id}
              className={cn(
                "rounded-md border border-border p-2 text-[11px]",
                selectedCookieId === cookie.id && "border-primary/45 bg-primary/5",
                !cookie.is_active && "opacity-55"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-mono" title={`${cookie.cookie_prefix}...${cookie.cookie_suffix}`}>
                    {cookie.cookie_prefix}...{cookie.cookie_suffix}
                  </div>
                  <div className="truncate text-muted-foreground" title={pixivCookieAccountLine(cookie)}>
                    {pixivCookieAccountLine(cookie)}
                  </div>
                </div>
                <span className={cookie.is_active ? "shrink-0 text-emerald-600 dark:text-emerald-400" : "shrink-0 text-muted-foreground"}>
                  {cookie.is_active ? "active" : "revoked"}
                </span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto] xl:grid-cols-1">
                <Input
                  className="h-8 text-xs"
                  value={drafts[cookie.id] ?? cookie.label ?? ""}
                  onChange={(event) => onDraftChange(cookie.id, event.target.value)}
                  placeholder="备注"
                  disabled={!cookie.is_active}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!cookie.is_active || busy === `pixiv-cookie-update-${cookie.id}`}
                  onClick={() => onUpdateLabel(cookie.id)}
                >
                  备注
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!cookie.is_active || busy === `pixiv-cookie-revoke-${cookie.id}`}
                  onClick={() => onRevoke(cookie.id)}
                >
                  撤销
                </Button>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                <span>创建 {formatDate(cookie.created_at)}</span>
                <span>使用 {formatDate(cookie.last_used_at)}</span>
                {cookie.last_used_ip && <span className="font-mono">{cookie.last_used_ip}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function pixivTokenDisplayName(token: PixivTokenSummary): string {
  const label = token.label?.trim();
  const account = token.pixiv_name || token.pixiv_account || token.pixiv_user_id || "Pixiv";
  const suffix = `${token.token_prefix}...${token.token_suffix}`;
  return label ? `${label} · ${account} · ${suffix}` : `${account} · ${suffix}`;
}

function pixivTokenAccountLine(token: PixivTokenSummary): string {
  const parts = [token.label, token.pixiv_name, token.pixiv_account, token.pixiv_user_id ? `UID ${token.pixiv_user_id}` : ""]
    .map((item) => item?.trim())
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : "未记录 Pixiv 账号信息";
}

function pixivCookieDisplayName(cookie: PixivCookieSummary): string {
  const label = cookie.label?.trim();
  const account = cookie.pixiv_name || cookie.pixiv_account || cookie.pixiv_user_id || "Pixiv";
  const suffix = `${cookie.cookie_prefix}...${cookie.cookie_suffix}`;
  return label ? `${label} · ${account} · ${suffix}` : `${account} · ${suffix}`;
}

function pixivCookieAccountLine(cookie: PixivCookieSummary): string {
  const parts = [cookie.label, cookie.pixiv_name, cookie.pixiv_account, cookie.pixiv_user_id ? `UID ${cookie.pixiv_user_id}` : ""]
    .map((item) => item?.trim())
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : "未记录 Pixiv 账号信息";
}
