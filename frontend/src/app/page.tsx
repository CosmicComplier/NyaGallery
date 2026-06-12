"use client";

import { Suspense } from "react";
import { ContentFilterToggles } from "@/components/content/content-filter-toggles";
import { InfiniteGallery } from "@/components/gallery/infinite-gallery";
import { SwitchLabel } from "@/components/ui/switch-label";
import { useGalleryQueryControls } from "@/hooks/gallery/use-gallery-query-controls";

function HomeContent() {
  const {
    q,
    tokens,
    effectiveQuery,
    effectiveQueries,
    contentReady,
    multi,
    setMulti,
    collapseWorks,
    setCollapseWorks,
    onTagClick,
  } = useGalleryQueryControls();

  return (
    <div className="container py-6">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {q ? `搜索：${q}` : "最新作品"}
        </h1>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <ContentFilterToggles />
          <SwitchLabel label="折叠多页" checked={collapseWorks} onChange={setCollapseWorks} />
          <SwitchLabel label="多选" checked={multi} onChange={setMulti} />
        </div>
      </header>

      <InfiniteGallery
        query={effectiveQuery}
        queries={effectiveQueries}
        enabled={contentReady}
        activeTags={tokens}
        onTagClick={onTagClick}
        collapseWorks={collapseWorks}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="container py-6 text-sm text-muted-foreground">加载中...</div>}>
      <HomeContent />
    </Suspense>
  );
}
