"use client";

import Link from "next/link";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyLine } from "@/components/admin/admin-fields";
import { useI18n } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";
import type { AccessLogItem, ApiTokenSummary, TranscodeJob, UploadHistoryItem, UploadLogItem } from "@/lib/types";
import {
  cacheDetail,
  cacheStatusClass,
  cacheStatusLabel,
  cacheStatusOfLog,
  cacheStatusPillClass,
  elapsedSecondsBetween,
  estimateRemainingSeconds,
  extraNumber,
  extraString,
  formatBytes,
  formatDate,
  formatDuration,
  formatLogEvent,
  httpStatusClass,
  localizedPixivMessage,
  pixivStageLabel,
  stageDetail,
  stageLabel,
  statusLabel,
  statusPillClass,
  terminalStatus,
  statusClass,
} from "./admin-format";

export function TranscodeJobRow({ job }: { job: TranscodeJob }) {
  const { t } = useI18n();
  const progress = Math.max(0, Math.min(100, job.progress || 0));
  const terminal = terminalStatus(job) === "success" || terminalStatus(job) === "error";
  const finishedAt = terminal ? job.finished_at || job.updated_at : undefined;
  const elapsed = elapsedSecondsBetween(job.started_at, finishedAt);
  const stageElapsed = elapsedSecondsBetween(job.stage_started_at || job.updated_at, finishedAt);
  const eta = estimateRemainingSeconds(job);
  const etaText = terminal
    ? terminalStatus(job) === "error"
      ? t("admin.transcode.etaError")
      : t("admin.transcode.etaComplete")
    : eta == null
      ? t("admin.transcode.etaEstimating")
      : formatDuration(eta);

  return (
    <div className="rounded-lg border border-border p-3 text-xs">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Link href={`/asset/${encodeURIComponent(job.asset_key)}`} className="min-w-0 truncate font-mono hover:underline">
          {job.asset_key}
        </Link>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-medium", statusPillClass(terminalStatus(job)))}>
          {statusLabel(terminalStatus(job), t)}
        </span>
      </div>
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", terminalStatus(job) === "error" ? "bg-destructive" : terminalStatus(job) === "success" ? "bg-emerald-500" : "bg-primary")}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="grid gap-1 text-muted-foreground sm:grid-cols-2">
        <span>{stageLabel(job.stage || job.message, t)} · {progress.toFixed(1)}%</span>
        <span className="sm:text-right">
          {job.frames_total ? `${job.frames_done ?? 0}/${job.frames_total} 帧` : t("admin.transcode.framesStatic")}
          {job.frames_per_second ? ` · ${job.frames_per_second.toFixed(2)} fps` : ""}
        </span>
        <span>{job.uploader_username || "unknown"} · {formatBytes(job.file_size)}</span>
        <span className="sm:text-right">{formatDate(job.updated_at)}</span>
      </div>
      <div className="mt-2 grid gap-1 rounded-md border border-border/70 bg-muted/35 p-2 text-[11px] text-muted-foreground sm:grid-cols-2">
        <span>{t("admin.transcode.stageCurrent", { stage: stageLabel(job.stage, t) })}</span>
        <span className="sm:text-right">{t("admin.transcode.durationStage", { value: formatDuration(stageElapsed) })}</span>
        <span>{t("admin.transcode.durationElapsed", { value: formatDuration(elapsed) })}</span>
        <span className="sm:text-right">
          {terminal ? etaText : t("admin.transcode.etaRemaining", { value: etaText })}
        </span>
        <span className="sm:col-span-2">{stageDetail(job, t)}</span>
      </div>
      {job.error && <div className="mt-2 text-destructive">{job.error}</div>}
    </div>
  );
}

export function UploadHistoryRow({ item, busy, onStartTranscode }: { item: UploadHistoryItem; busy: boolean; onStartTranscode: () => void }) {
  const { t } = useI18n();
  const latestStatus = item.latest_transcode_job ? terminalStatus(item.latest_transcode_job) : "";
  const activeJob = latestStatus === "queued" || latestStatus === "running";
  const canStart = item.cache_status !== "ready" && !activeJob;

  return (
    <div className={cn("rounded-lg border border-border p-3 text-xs", item.is_hidden && "bg-muted/35 opacity-70")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link href={`/asset/${encodeURIComponent(item.asset_key)}`} className="min-w-0 truncate font-medium hover:underline">
            {item.original_filename || item.title || item.asset_key}
          </Link>
          {item.is_hidden && (
            <span
              title={t("admin.logs.hiddenTitle")}
              className="shrink-0 rounded border border-border bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {t("admin.logs.hidden")}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 font-medium", cacheStatusPillClass(item.cache_status))}>{cacheStatusLabel(item.cache_status, t)}</span>
          <span className="text-muted-foreground">{formatBytes(item.file_size)}</span>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
        <span>{item.uploader_username || "unknown"}</span>
        <span>{formatDate(item.uploaded_at)}</span>
        <span>{item.width && item.height ? `${item.width}x${item.height}` : "size unknown"}</span>
        {item.is_animated && <span>animated</span>}
        <span>{cacheDetail(item, t)}</span>
        {item.latest_transcode_job && (
          <span className={statusClass(terminalStatus(item.latest_transcode_job))}>
            {t("admin.transcode.latest", {
              status: statusLabel(terminalStatus(item.latest_transcode_job), t),
              progress: item.latest_transcode_job.progress.toFixed(0),
            })}
          </span>
        )}
      </div>
      {canStart && (
        <div className="mt-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onStartTranscode} className="h-7">
            <Wand2 className="h-3.5 w-3.5" /> 开始转码
          </Button>
        </div>
      )}
    </div>
  );
}

export function UploadLogRow({ log }: { log: UploadLogItem }) {
  const { t } = useI18n();
  const event = formatLogEvent(log, t);
  const cacheStatus = cacheStatusOfLog(log);
  const filename = log.original_filename || log.asset_key || "(unknown)";

  return (
    <div
      className={cn(
        "space-y-2 border-b border-border p-3 text-xs last:border-b-0",
        log.is_hidden && "bg-muted/35 opacity-70"
      )}
    >
      <div className="grid gap-2 sm:grid-cols-[150px_minmax(130px,1fr)_120px_110px] sm:items-center">
        <span className="text-muted-foreground">{formatDate(log.created_at)}</span>
        <span className={cn("min-w-0 truncate font-medium", statusClass(log.status))} title={event}>
          {event}
        </span>
        <span className={cn("min-w-0 truncate text-muted-foreground", cacheStatusClass(cacheStatus))}>
          {cacheStatusLabel(cacheStatus, t)}
        </span>
        <span className="text-right text-muted-foreground">{formatBytes(log.file_size)}</span>
      </div>
      <div
        className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5"
        title={log.original_filename || log.asset_key || ""}
      >
        <span className="break-all font-mono text-[11px] leading-5 text-foreground">{filename}</span>
        {log.is_hidden && (
          <span
            title={t("admin.logs.hiddenTitle")}
            className="shrink-0 rounded border border-border bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            {t("admin.logs.hidden")}
          </span>
        )}
      </div>
    </div>
  );
}

export function PixivLogRow({ log }: { log: UploadLogItem }) {
  const { t } = useI18n();
  const target = extraString(log.extra, "target") ?? log.original_filename.replace(/^pixiv:/, "");
  const mode = extraString(log.extra, "auth_mode") ?? "-";
  const stage = extraString(log.extra, "stage");
  const title = extraString(log.extra, "title");
  const assetKey = extraString(log.extra, "asset_key");
  const error = extraString(log.extra, "error");
  const jobId = extraString(log.extra, "sync_job_id");
  const lastUpdateAt = extraString(log.extra, "last_update_at");
  const syncCount = extraNumber(log.extra, "sync_count");
  const queued = extraNumber(log.extra, "queued_transcode_jobs");
  const retryAfter = extraNumber(log.extra, "retry_after_seconds");
  const pageNumber = extraNumber(log.extra, "page_number");
  const pageCount = extraNumber(log.extra, "page_count");
  const artworksDone = extraNumber(log.extra, "artworks_done");
  const currentArtworkIndex = extraNumber(log.extra, "current_artwork_index");
  const progress = extraNumber(log.extra, "progress");
  const progressValue = progress == null ? null : Math.max(0, Math.min(100, progress));
  const active = log.status === "queued" || log.status === "running";

  return (
    <div className={cn(
      "rounded-lg border border-border p-3 text-xs",
      active && "border-primary/30 bg-primary/5",
      log.status === "error" && "border-destructive/35 bg-destructive/5"
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium" title={target}>
            {target || "pixiv"}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {formatDate(lastUpdateAt || log.created_at)} · {mode}{jobId ? ` · ${jobId}` : ""}
          </div>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-medium", statusPillClass(log.status))}>
          {statusLabel(log.status, t)}
        </span>
      </div>
      {progressValue !== null && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="truncate">{pixivStageLabel(stage)}</span>
            <span>{progressValue.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progressValue}%` }} />
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
        {syncCount !== null && <span>文件 {syncCount}</span>}
        {pageNumber !== null && pageCount !== null && <span>页 {pageNumber}/{pageCount}</span>}
        {currentArtworkIndex !== null && <span>作品 #{currentArtworkIndex}</span>}
        {artworksDone !== null && <span>已完成作品 {artworksDone}</span>}
        {queued !== null && <span>转码 {queued}</span>}
        {retryAfter !== null && <span className="text-amber-600 dark:text-amber-400">429 等待 {retryAfter}s</span>}
        {title && <span className="max-w-full truncate" title={title}>{title}</span>}
        {assetKey && <span className="font-mono">{assetKey}</span>}
        <span>{localizedPixivMessage(log.message)}</span>
      </div>
      {error && <div className="mt-2 break-words text-destructive">{error}</div>}
    </div>
  );
}

export function AccessLogRow({ log }: { log: AccessLogItem }) {
  const path = log.query_string ? `${log.path}?${log.query_string}` : log.path;
  const actor = `${log.username || "guest"} · ${log.client_ip}`;
  return (
    <div className="grid gap-1 border-b border-border p-3 text-xs last:border-b-0 lg:grid-cols-[150px_74px_minmax(0,1fr)_170px_80px] lg:items-center">
      <span className="text-muted-foreground">{formatDate(log.created_at)}</span>
      <span className={cn("font-medium", httpStatusClass(log.status_code))}>{log.method} {log.status_code}</span>
      <span className="min-w-0 truncate font-mono" title={path}>{path}</span>
      <span className="min-w-0 truncate text-muted-foreground" title={actor}>{actor}</span>
      <span className="text-right text-muted-foreground">{log.duration_ms.toFixed(0)} ms</span>
      {(log.rejection_reason || log.error) && (
        <span className="min-w-0 truncate text-destructive lg:col-span-5" title={log.rejection_reason || log.error || ""}>
          {log.rejection_reason || log.error}
        </span>
      )}
    </div>
  );
}

export function TokenList({
  tokens,
  busy,
  onRevoke,
}: {
  tokens: ApiTokenSummary[];
  busy: string | null;
  onRevoke: (tokenId: number) => void;
}) {
  if (tokens.length === 0) {
    return <EmptyLine text="暂无 API Token" />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border text-xs">
      {tokens.map((item) => (
        <div key={item.id} className="grid gap-2 border-b border-border p-3 last:border-b-0 sm:grid-cols-[1fr_140px_150px_120px_auto] sm:items-center">
          <div className="min-w-0">
            <div className="truncate font-mono">{item.token_prefix}...</div>
            <div className="truncate text-muted-foreground">{item.label || "no label"}</div>
          </div>
          <div className="text-muted-foreground">{formatDate(item.created_at)}</div>
          <div className="min-w-0 text-muted-foreground">
            <div>{formatDate(item.last_used_at)}</div>
            <div className="truncate font-mono" title={item.last_used_ip || ""}>
              {item.last_used_ip || "no ip"}
            </div>
          </div>
          <div className={item.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
            {item.is_active ? "active" : "revoked"}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!item.is_active || busy === `token-revoke-${item.id}`}
            onClick={() => onRevoke(item.id)}
          >
            撤销
          </Button>
        </div>
      ))}
    </div>
  );
}
