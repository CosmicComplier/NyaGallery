"use client";

import { RefreshCw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type AdminMaintenancePanelProps = {
  busy: string | null;
  rebuildResult: string | null;
  onRebuild: () => unknown;
  onRebuildWithCache: () => unknown;
  onGenerateMedia: () => unknown;
};

export function AdminMaintenancePanel({
  busy,
  rebuildResult,
  onRebuild,
  onRebuildWithCache,
  onGenerateMedia,
}: AdminMaintenancePanelProps) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <RefreshCw className="h-4 w-4" /> 数据库重建
      </h2>
      <p className="text-xs text-muted-foreground">从 metadata JSON 重建索引，可选同时重新生成预览缓存。</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy === "rebuild"} onClick={onRebuild}>
          重建索引
        </Button>
        <Button variant="outline" size="sm" disabled={busy === "rebuild-cache"} onClick={onRebuildWithCache}>
          重建索引 + 缓存
        </Button>
        <Button variant="outline" size="sm" disabled={busy === "media"} onClick={onGenerateMedia}>
          <Wand2 className="h-4 w-4" /> 生成全部缓存
        </Button>
      </div>
      {rebuildResult && <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">{rebuildResult}</pre>}
    </section>
  );
}
