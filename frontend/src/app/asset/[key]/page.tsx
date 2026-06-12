"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, Download, ExternalLink, Tags as TagsIcon, Trash2, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAsset, useAssetSiblings } from "@/lib/hooks";
import { downloadOriginalAsset, fileUrl, NyaApi, readToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { cn, isHiddenTag, sourceTagQuery, tagCategory, tagLabel } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import type { Asset } from "@/lib/types";
import { useI18n } from "@/components/providers/locale-provider";

export default function AssetDetailPage() {
  const params = useParams<{ key: string }>();
  const router = useRouter();
  const assetKey = decodeURIComponent(params?.key ?? "");
  const { data: asset, isPending, error, refetch } = useAsset(assetKey);
  const { data: siblingsData } = useAssetSiblings(assetKey);
  const { token, me } = useAuth();
  const toast = useToast();
  const { locale } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draftTags, setDraftTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeAssetKey, setActiveAssetKey] = useState(assetKey);

  const canDeleteRequest = me?.permissions.includes("delete_request") ?? false;
  const canDelete = me?.permissions.includes("delete") ?? false;
  const pages = useMemo(
    () => siblingsData?.items?.length ? siblingsData.items : asset ? [asset] : [],
    [asset, siblingsData?.items]
  );
  const hasMultiplePages = pages.length > 1;
  const activeAsset = pages.find((page) => page.asset_key === activeAssetKey) ?? asset;
  const activePageIndex = Math.max(0, pages.findIndex((page) => page.asset_key === activeAsset?.asset_key));
  const visibleTags = useMemo(
    () => (asset?.tags ?? []).filter((tag) => !isHiddenTag(tag)),
    [asset?.tags]
  );
  const tagDetails = useMemo(
    () => new Map((asset?.tag_details ?? []).map((tag) => [tag.name, tag])),
    [asset?.tag_details]
  );

  useEffect(() => {
    if (!pages.length) return;
    const hashKey = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    const initialKey = pages.some((page) => page.asset_key === hashKey)
      ? hashKey
      : pages.some((page) => page.asset_key === assetKey)
        ? assetKey
        : pages[0].asset_key;
    setActiveAssetKey(initialKey);
  }, [assetKey, pages]);

  useEffect(() => {
    if (!hasMultiplePages) return;
    const elements = pages
      .map((page) => document.getElementById(page.asset_key))
      .filter((element): element is HTMLElement => element !== null);
    if (!elements.length) return;

    let frame = 0;
    const updateActivePage = () => {
      frame = 0;
      const anchorY = window.innerHeight * 0.35;
      let fallback: { id: string; distance: number } | null = null;
      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        if (rect.top <= anchorY && rect.bottom >= anchorY) {
          setActiveAssetKey(element.id);
          return;
        }
        const distance = rect.top > anchorY ? rect.top - anchorY : anchorY - rect.bottom;
        if (fallback === null || distance < fallback.distance) {
          fallback = { id: element.id, distance };
        }
      }
      if (fallback) setActiveAssetKey(fallback.id);
    };
    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateActivePage);
    };
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    elements.forEach((element) => resizeObserver.observe(element));
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [hasMultiplePages, pages]);

  if (isPending) {
    return (
      <div className="container grid gap-6 py-6 lg:grid-cols-[1fr_360px]">
        <Skeleton className="aspect-[3/4] w-full" />
        <div className="space-y-3">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="container flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-sm text-destructive">{error?.message ?? "未找到"}</p>
        <Button onClick={() => router.back()} variant="outline" size="sm">
          返回
        </Button>
      </div>
    );
  }

  function startEdit() {
    setDraftTags((asset!.canonical_tags ?? []).join(" "));
    setEditing(true);
  }

  async function saveTags() {
    if (!asset) return;
    setSaving(true);
    try {
      const next = draftTags.split(/\s+/).filter(Boolean);
      const updated = await NyaApi.updateAssetTags(asset.asset_key, next);
      qc.setQueryData(["asset", asset.asset_key], updated);
      qc.invalidateQueries({ queryKey: ["search"] });
      toast.success("已保存");
      setEditing(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function downloadOriginal() {
    if (!activeAsset) return;
    setDownloading(true);
    try {
      await downloadOriginalAsset(activeAsset);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "下载失败");
    } finally {
      setDownloading(false);
    }
  }

  async function requestDelete() {
    if (!asset) return;
    if (!confirm("确认将此资源标记为待清理？")) return;
    setDeleting(true);
    try {
      const updated = await NyaApi.deleteAsset(asset.asset_key);
      qc.setQueryData(["asset", asset.asset_key], updated);
      qc.invalidateQueries({ queryKey: ["search"] });
      toast.success("已标记为待清理");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  async function purgeAsset() {
    if (!asset) return;
    if (!confirm("⚠️ 彻底清理：文件将被永久删除，不可恢复。确认？")) return;
    setDeleting(true);
    try {
      await NyaApi.cleanupAsset(asset.asset_key);
      qc.invalidateQueries({ queryKey: ["search"] });
      toast.success("已彻底清理");
      router.push("/");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "清理失败");
    } finally {
      setDeleting(false);
    }
  }

  const artistUrl = artistHomeUrl(asset);
  const artworkUrl = artworkHomeUrl(asset);

  return (
    <div className="container grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> 返回
        </Button>
        <div className="space-y-4">
          {hasMultiplePages && (
            <div className="rounded-lg border border-border bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
              同一作品共 {pages.length} 张。点击右侧页码目录可以跳转；右侧资源链接会跟随当前浏览页。
            </div>
          )}
          {pages.map((page, index) => (
            <AssetPageImage
              key={page.asset_key}
              asset={page}
              index={index}
              current={page.asset_key === activeAsset?.asset_key}
            />
          ))}
        </div>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:pr-2">
        <div>
          <h1 className="text-xl font-semibold leading-tight">
            {asset.title || asset.asset_key}
          </h1>
          {asset.artist && (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              by <span className="text-foreground">{asset.artist}</span>
              {artistUrl && (
                <a
                  href={artistUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary underline-offset-4 hover:underline"
                >
                  [主页]
                </a>
              )}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-md border border-border px-2 py-0.5">
              {asset.source}#{asset.source_id}
            </span>
            {hasMultiplePages && (
              <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary">
                {pages.length}P
              </span>
            )}
            {activeAsset?.page_index !== null && activeAsset?.page_index !== undefined && (
              <span className="rounded-md border border-border px-2 py-0.5">
                P{activeAsset.page_index + 1}
              </span>
            )}
            {activeAsset?.width && activeAsset.height && (
              <span className="rounded-md border border-border px-2 py-0.5">
                {activeAsset.width}×{activeAsset.height}
              </span>
            )}
            {asset.duplicate_of && (
              <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-500">
                重复于 {asset.duplicate_of}
              </span>
            )}
            {asset.deletion_status && (
              <span className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-destructive">
                {asset.deletion_status === "pending_cleanup" ? "待清理" : asset.deletion_status}
                {asset.deleted_by_username && ` · by ${asset.deleted_by_username}`}
              </span>
            )}
          </div>
        </div>

        {hasMultiplePages && (
          <section className="space-y-2 rounded-lg border border-border bg-muted/25 p-3">
            <h2 className="text-sm font-medium">页目录</h2>
            <div className="grid max-h-72 grid-cols-4 gap-1 overflow-auto pr-1">
              {pages.map((page, index) => (
                <a
                  key={page.asset_key}
                  href={`#${encodeURIComponent(page.asset_key)}`}
                  className={cn(
                    "rounded-md border border-border bg-background px-2 py-1 text-center text-xs hover:bg-accent",
                    page.asset_key === activeAsset?.asset_key && "border-primary/50 bg-primary/10 text-primary"
                  )}
                  title={page.original_filename || page.asset_key}
                  onClick={() => setActiveAssetKey(page.asset_key)}
                >
                  {page.page_index !== null ? page.page_index + 1 : index + 1}
                </a>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={downloadOriginal} disabled={downloading}>
            {downloading ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            原图
          </Button>
          {asset.original_url && (
            <Button asChild variant="outline" size="sm">
              <a href={asset.original_url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> 来源
              </a>
            </Button>
          )}
          {artworkUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={artworkUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> 作品页
              </a>
            </Button>
          )}
          {canDeleteRequest && !asset.deletion_status && (
            <Button
              variant="destructive"
              size="sm"
              onClick={requestDelete}
              disabled={deleting}
            >
              {deleting ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
              删除
            </Button>
          )}
          {canDelete && asset.deletion_status === "pending_cleanup" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={purgeAsset}
              disabled={deleting}
            >
              {deleting ? <Spinner className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              彻底清理
            </Button>
          )}
        </div>

        {asset.description && (
          <section className="space-y-2 rounded-lg border border-border bg-muted/25 p-3">
            <h2 className="text-sm font-medium">作品简介</h2>
            <p className="whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
              {asset.description}
            </p>
          </section>
        )}

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">标签</h2>
            {token && !editing && (
              <Button variant="ghost" size="sm" onClick={startEdit}>
                <TagsIcon className="h-3.5 w-3.5" /> 编辑
              </Button>
            )}
          </div>

          {editing ? (
            <div className="space-y-2">
              <textarea
                value={draftTags}
                onChange={(e) => setDraftTags(e.target.value)}
                rows={4}
                placeholder="character:misaka_mikoto series:toaru rating:safe"
                className="w-full rounded-md border border-input bg-transparent p-2 font-mono text-xs focus-ring"
              />
              <p className="text-[11px] text-muted-foreground">
                空格分隔，使用 canonical 名（例如 <code>character:misaka_mikoto</code>），未在标签库中注册的会被拒绝。
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveTags} disabled={saving}>
                  {saving ? <Spinner className="h-3.5 w-3.5" /> : null} 保存
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {visibleTags.length === 0 && (
                <span className="text-xs text-muted-foreground">无标签</span>
              )}
              {visibleTags.map((tag) => (
                <Link
                  key={tag}
                  href={`/?q=${encodeURIComponent(tag)}`}
                  className="rounded-full"
                >
                  <Badge variant={tagCategory(tag) as never} className="cursor-pointer">
                    <span className="opacity-60">{tagCategory(tag)}:</span>{" "}
                    {tagLabel(tag, tagDetails.get(tag)?.labels, locale)}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </section>

        {asset.pixiv_tags && asset.pixiv_tags.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-medium">来源标签</h2>
            <div className="flex flex-wrap gap-1.5">
              {(asset.pixiv_tag_details?.length ? asset.pixiv_tag_details : asset.pixiv_tags.map((tag) => ({ name: tag, translated_name: null, source_tag: sourceTagQuery(tag) }))).map((tag) => (
                <Link
                  key={tag.name}
                  href={`/?q=${encodeURIComponent(tag.source_tag || sourceTagQuery(tag.name, tag.translated_name))}`}
                  title={tag.source_tag || sourceTagQuery(tag.name, tag.translated_name)}
                  className="rounded-full border border-dashed border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-600 transition-colors hover:border-cyan-500/60 hover:bg-cyan-500/15 dark:text-cyan-400"
                >
                  {tag.name}
                  {tag.translated_name && <span className="ml-1 opacity-70">/ {tag.translated_name}</span>}
                </Link>
              ))}
            </div>
          </section>
        )}

        <ApiLinksSection
          asset={activeAsset ?? asset}
          pageLabel={hasMultiplePages ? `P${activePageIndex + 1} / ${pages.length}` : undefined}
        />

        <section className="space-y-1 text-xs text-muted-foreground">
          <div>
            asset_key:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] text-foreground">
              {activeAsset?.asset_key ?? asset.asset_key}
            </code>
          </div>
          <div className="break-all">
            sha256:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] text-foreground">
              {activeAsset?.source_file_sha256 ?? asset.source_file_sha256}
            </code>
          </div>
        </section>

        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          刷新
        </Button>
      </aside>
    </div>
  );
}

type ApiLink = {
  label: string;
  hint: string;
  href: string;
  size?: number | null;
  filename?: string;
  needsAuth?: boolean;
  external?: boolean;
};

function AssetPageImage({
  asset,
  index,
  current,
}: {
  asset: Asset;
  index: number;
  current: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <section
      id={asset.asset_key}
      className={cn(
        "scroll-mt-20 overflow-hidden rounded-xl border bg-card",
        current ? "border-primary/45 shadow-sm" : "border-border"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs">
        <div className="min-w-0 truncate text-muted-foreground">
          <span className="font-medium text-foreground">P{asset.page_index !== null ? asset.page_index + 1 : index + 1}</span>
          <span className="mx-1.5">·</span>
          <span title={asset.original_filename || asset.asset_key}>{asset.original_filename || asset.asset_key}</span>
        </div>
        {asset.width && asset.height && (
          <span className="shrink-0 text-muted-foreground">{asset.width}×{asset.height}</span>
        )}
      </div>
      <div className="relative bg-muted">
        {!loaded && (
          <div
            className="skeleton"
            style={{
              paddingTop: asset.width && asset.height
                ? `${(asset.height / asset.width) * 100}%`
                : "75%",
            }}
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileUrl.preview(asset.asset_key)}
          alt={asset.title || asset.asset_key}
          onLoad={() => setLoaded(true)}
          className={cn(
            "h-auto w-full bg-muted",
            loaded ? "block" : "absolute inset-0 opacity-0"
          )}
        />
      </div>
    </section>
  );
}

function ApiLinksSection({
  asset,
  pageLabel,
}: {
  asset: Asset;
  pageLabel?: string;
}) {
  const assetKey = asset.asset_key;
  const links = useMemo<ApiLink[]>(() => {
    const items: ApiLink[] = [
      {
        label: "JSON 详情",
        hint: "GET • application/json",
        href: `/api/assets/${encodeURIComponent(assetKey)}`,
      },
      {
        label: "原图",
        hint: `GET • 流式原始字节${asset.original_filename ? ` • ${asset.original_filename}` : ""}`,
        href: fileUrl.original(assetKey),
        size: asset.file_size ?? null,
        filename: asset.original_filename || assetKey,
        needsAuth: true,
      },
      {
        label: "压缩预览（AVIF/WEBP）",
        hint: "GET • 自动选择缓存格式",
        href: asset.preview_url || fileUrl.preview(assetKey),
        size: asset.preview_file_size ?? null,
        filename: `${assetKey}-preview`,
      },
      {
        label: "缩略图",
        hint: "GET • 卡片用 AVIF",
        href: asset.thumb_url || fileUrl.thumb(assetKey),
        size: asset.thumb_file_size ?? null,
        filename: `${assetKey}-thumb`,
      },
    ];
    if (asset.original_path) {
      items.push({
        label: "存储原始路径",
        hint: "storage 内部相对路径，仅供参考",
        href: asset.original_path,
        external: false,
      });
    }
    return items;
  }, [asset, assetKey]);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">资源链接</h2>
        {pageLabel && (
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
            当前 {pageLabel}
          </span>
        )}
      </div>
      <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-2">
        {links.map((link) => (
          <ApiLinkRow key={link.label} {...link} />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        原图需要带 <code>Authorization: Bearer &lt;token&gt;</code> 才能访问。预览缓存如果还没生成会自动回退到原图。
      </p>
    </section>
  );
}

function ApiLinkRow({ label, hint, href, size, filename, needsAuth }: ApiLink) {
  const toast = useToast();
  const { token } = useAuth();
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);

  async function copy() {
    try {
      const absolute = href.startsWith("http")
        ? href
        : typeof window !== "undefined"
          ? `${window.location.origin}${href.startsWith("/") ? href : `/${href}`}`
          : href;
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      toast.success("已复制");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("复制失败");
    }
  }

  async function openInNewTab() {
    setOpening(true);
    const previewWindow = window.open("", "_blank");
    if (previewWindow) {
      previewWindow.opener = null;
      writeResourceWindow(previewWindow, label, `<main class="message">Loading...</main>`);
    }
    try {
      const absolute = href.startsWith("http")
        ? href
        : `${window.location.origin}${href.startsWith("/") ? href : `/${href}`}`;
      const bearer = readToken();
      const res = await fetch(absolute, {
        headers: bearer ? { authorization: `Bearer ${bearer}` } : undefined,
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const blob = await res.blob();
      const responseFilename = filenameFromDisposition(res.headers.get("content-disposition"));
      await openBlobResource(blob, label, responseFilename || filename || label, previewWindow);
    } catch (e: unknown) {
      previewWindow?.close();
      toast.error(e instanceof Error ? e.message : "打开失败");
    } finally {
      setOpening(false);
    }
  }

  const isHttp = href.startsWith("/") || href.startsWith("http");
  const showOpen = isHttp && (!needsAuth || token);

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-background/60">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-foreground">
          <span className="font-medium">{label}</span>
          {size != null && (
            <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {formatBytes(size)}
            </span>
          )}
          {needsAuth && !token && (
            <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 text-[10px] text-amber-500">
              需要登录
            </span>
          )}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {hint}
        </div>
        <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground" title={href}>
          {href}
        </div>
      </div>
      <button
        type="button"
        onClick={copy}
        title="复制链接"
        className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      {showOpen && (
        <button
          type="button"
          onClick={openInNewTab}
          disabled={opening}
          title="新标签页打开"
          className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {opening ? <Spinner className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}

function artistHomeUrl(asset: Asset): string | null {
  if (asset.source.toLowerCase() !== "pixiv") return null;
  const artistId = asset.artist_id.trim();
  return artistId ? `https://www.pixiv.net/users/${encodeURIComponent(artistId)}` : null;
}

function artworkHomeUrl(asset: Asset): string | null {
  switch (asset.source.toLowerCase()) {
    case "pixiv": {
      const sourceId = asset.source_id.trim();
      return sourceId ? `https://www.pixiv.net/artworks/${encodeURIComponent(sourceId)}` : null;
    }
    default:
      return null;
  }
}

function formatBytes(value: number | null | undefined): string {
  if (value == null) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index++;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function filenameFromDisposition(value: string | null): string | null {
  if (!value) return null;
  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const plainMatch = value.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] ?? null;
}

async function openBlobResource(
  blob: Blob,
  title: string,
  filename: string,
  existingWindow: Window | null,
): Promise<void> {
  const target = existingWindow ?? window.open("", "_blank");
  const objectUrl = URL.createObjectURL(blob);
  if (!target) {
    window.open(objectUrl, "_blank");
    return;
  }

  target.opener = null;
  const type = (blob.type || "application/octet-stream").toLowerCase();
  let body: string;
  if (type.startsWith("image/")) {
    body = `<main class="media"><img src="${escapeHtml(objectUrl)}" alt="${escapeHtml(filename)}" /></main>`;
  } else if (type.startsWith("video/")) {
    body = `<main class="media"><video src="${escapeHtml(objectUrl)}" controls autoplay loop></video></main>`;
  } else if (type.includes("json") || type.startsWith("text/")) {
    body = `<main class="text"><pre>${escapeHtml(await blob.text())}</pre></main>`;
  } else {
    body = `
      <main class="message">
        <h1>${escapeHtml(filename)}</h1>
        <p>This file type cannot be previewed inline by the browser.</p>
        <p class="meta">${escapeHtml(type)} · ${formatBytes(blob.size)}</p>
        <a href="${escapeHtml(objectUrl)}" download="${escapeHtml(filename)}">Download file</a>
      </main>
    `;
  }
  writeResourceWindow(target, title, body);
}

function writeResourceWindow(target: Window, title: string, body: string): void {
  target.document.open();
  target.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: dark light; }
    body {
      margin: 0;
      min-height: 100vh;
      background: #111;
      color: #f5f5f5;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .media {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 16px;
      box-sizing: border-box;
    }
    img, video {
      display: block;
      max-width: 100%;
      max-height: calc(100vh - 32px);
      object-fit: contain;
    }
    .text, .message {
      box-sizing: border-box;
      width: min(960px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 32px 0;
    }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      font: 13px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    h1 {
      margin: 0 0 12px;
      font-size: 18px;
    }
    p {
      color: #cfcfcf;
      line-height: 1.5;
    }
    .meta {
      font-size: 12px;
      color: #999;
    }
    a {
      color: #fff;
    }
  </style>
</head>
<body>${body}</body>
</html>`);
  target.document.close();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
