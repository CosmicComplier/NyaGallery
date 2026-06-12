"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/providers/locale-provider";
import { AssetCard } from "./asset-card";
import type { Asset } from "@/lib/types";

const BREAKPOINTS: Array<[number, number]> = [
  [1536, 6],
  [1280, 5],
  [1024, 4],
  [768, 3],
  [480, 2],
  [0, 2],
];

function columnsForWidth(width: number): number {
  for (const [min, cols] of BREAKPOINTS) {
    if (width >= min) return cols;
  }
  return 2;
}

export function MasonryGrid({
  assets,
  activeTags = [],
  onTagClick,
  collapseWorks = true,
}: {
  assets: Asset[];
  activeTags?: string[];
  onTagClick?: (tag: string) => void;
  collapseWorks?: boolean;
}) {
  const { t } = useI18n();
  const [columns, setColumns] = useState(4);

  useEffect(() => {
    const update = () => setColumns(columnsForWidth(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const displayItems = useMemo(() => {
    if (!collapseWorks) {
      return assets.map((asset) => ({
        asset,
        count: 1,
        href: detailHref(asset, false),
      }));
    }
    const groups = new Map<string, { asset: Asset; count: number }>();
    for (const asset of assets) {
      const key = workGroupKey(asset);
      const current = groups.get(key);
      if (!current) {
        groups.set(key, { asset, count: 1 });
        continue;
      }
      current.count += 1;
      if (assetSortPage(asset) < assetSortPage(current.asset)) {
        current.asset = asset;
      }
    }
    return Array.from(groups.values()).map((item) => ({
      asset: item.asset,
      count: item.count,
      href: detailHref(item.asset, true),
    }));
  }, [assets, collapseWorks]);

  const buckets = useMemo(() => {
    const cols: Array<Array<{ asset: Asset; count: number; href: string }>> = Array.from({ length: columns }, () => []);
    const heights = new Array(columns).fill(0);
    for (const item of displayItems) {
      const asset = item.asset;
      const ratio = asset.width && asset.height ? asset.height / asset.width : 1;
      let target = 0;
      for (let i = 1; i < columns; i++) {
        if (heights[i] < heights[target]) target = i;
      }
      cols[target].push(item);
      heights[target] += ratio;
    }
    return cols;
  }, [displayItems, columns]);

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {buckets.map((bucket, i) => (
        <div key={i} className="flex flex-col gap-3">
          {bucket.map(({ asset, count, href }) => (
            <AssetCard
              key={asset.asset_key}
              asset={asset}
              activeTags={activeTags}
              onTagClick={onTagClick}
              href={href}
              groupCount={count}
              groupLabel={count > 1 ? t("gallery.groupLabel", { count }) : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function workGroupKey(asset: Asset): string {
  return asset.source && asset.source_id
    ? `${asset.source}:${asset.source_id}`
    : asset.asset_key;
}

function assetSortPage(asset: Asset): number {
  return asset.page_index ?? 0;
}

function detailHref(asset: Asset, collapsed: boolean): string {
  const base = `/asset/${encodeURIComponent(asset.asset_key)}`;
  return collapsed ? base : `${base}#${encodeURIComponent(asset.asset_key)}`;
}
