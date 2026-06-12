"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Shuffle, X } from "lucide-react";
import { ContentFilterToggles } from "@/components/content/content-filter-toggles";
import { Button } from "@/components/ui/button";
import { useRandomPreview } from "@/hooks/search/use-random-preview";
import { useSearchTags } from "@/hooks/search/use-search-tags";
import { categoryColor, tagCategory, tagLabel, cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { TagChipInput } from "@/components/ui/tag-chip-input";
import { useI18n } from "@/components/providers/locale-provider";

export default function SearchPage() {
  const { locale } = useI18n();
  const {
    selected,
    setSelected,
    selectedSet,
    selectorGroups,
    catalogGroups,
    technicalGroups,
    technicalCount,
    openSelectors,
    setOpenSelectors,
    showTechnical,
    setShowTechnical,
    excludeAnimated,
    setExcludeAnimated,
    toggle,
    effectiveQueryParts,
    submit,
    isFetching,
    error,
  } = useSearchTags();
  const {
    showRandom,
    setShowRandom,
    randomBlobUrl,
    randomAssetKey,
    randomLoaded,
    randomError,
    handleRandom,
  } = useRandomPreview(effectiveQueryParts.join(" "));
  const tagDetails = useMemo(() => {
    const entries = [...selectorGroups, ...catalogGroups, ...technicalGroups]
      .flatMap(([, tags]) => tags)
      .map((tag) => [tag.name, tag] as const);
    return new Map(entries);
  }, [catalogGroups, selectorGroups, technicalGroups]);
  const labelForTag = useCallback(
    (name: string) => tagLabel(name, tagDetails.get(name)?.labels, locale),
    [locale, tagDetails]
  );

  return (
    <div className="container max-w-5xl py-8">
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold">搜索</h1>
        <p className="text-sm text-muted-foreground">
          输入标签后搜索或随机，点击下方标签可快速添加。
        </p>
      </div>

      {/* Tag input + action buttons */}
      <div className="flex items-stretch gap-2">
        <div className="flex-1 min-w-0">
          <TagChipInput
            tags={selected}
            onChange={setSelected}
            getLabel={labelForTag}
            placeholder="输入标签后回车添加"
          />
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <Button onClick={submit} className="gap-1 h-9">
            <ArrowRight className="h-4 w-4" />
            搜索
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRandom}
              className="gap-1 h-7 text-muted-foreground"
            >
              <Shuffle className="h-3.5 w-3.5" />
              随机
            </Button>
            <ContentFilterToggles />
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground select-none cursor-pointer">
              <input
                type="checkbox"
                checked={excludeAnimated}
                onChange={(e) => setExcludeAnimated(e.target.checked)}
                className="h-3 w-3 rounded border-border accent-[hsl(var(--primary))]"
              />
              排除动图
            </label>
          </div>
        </div>
      </div>

      {/* Random image preview */}
      {showRandom && (
        <div className="relative mt-6 mx-auto max-w-3xl overflow-hidden rounded-xl border border-border bg-card">
          <button
            type="button"
            onClick={() => setShowRandom(false)}
            className="absolute right-2 top-2 z-10 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
          {randomError ? (
            <div className="grid place-items-center p-16 text-center text-sm text-muted-foreground">
              没有匹配的图片，换个标签再试
            </div>
          ) : (
            <>
              {!randomLoaded && <div className="skeleton aspect-[4/3] w-full" />}
              {randomBlobUrl &&
                (randomAssetKey ? (
                  <Link href={`/asset/${encodeURIComponent(randomAssetKey)}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={randomBlobUrl}
                      alt="random"
                      className={randomLoaded ? "block w-full cursor-pointer" : "hidden"}
                    />
                  </Link>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={randomBlobUrl}
                    alt="random"
                    className={randomLoaded ? "block w-full" : "hidden"}
                  />
                ))}
            </>
          )}
          <div className="flex items-center justify-center border-t border-border p-2">
            <Button variant="ghost" size="sm" onClick={handleRandom} className="gap-1">
              <Shuffle className="h-3.5 w-3.5" /> 再来一张
            </Button>
            {randomAssetKey && (
              <Button variant="ghost" size="sm" asChild className="gap-1">
                <Link href={`/asset/${encodeURIComponent(randomAssetKey)}`}>
                  查看详情
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Selector dropdowns for rating / meta */}
      {selectorGroups.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {selectorGroups.map(([category, tags]) => {
            const open = openSelectors[category] ?? false;
            const picked = tags.filter((t) => selectedSet.has(t.name));
            return (
              <div key={category} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenSelectors((s) => ({ ...s, [category]: !s[category] }))}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    picked.length > 0
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground hover:bg-accent"
                  )}
                >
                  <span className="opacity-70">{category}:</span>
                  {picked.length > 0 ? picked.map((t) => tagLabel(t.name, t.labels, locale)).join(", ") : "全部"}
                  <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
                </button>
                {open && (
                  <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-56 overflow-auto rounded-lg border border-border bg-popover p-2 shadow-lg">
                    {tags.map((tag) => {
                      const checked = selectedSet.has(tag.name);
                      return (
                        <label
                          key={tag.name}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-accent",
                            checked && "bg-primary/5"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(tag.name)}
                            className="h-3.5 w-3.5 rounded border-border accent-[hsl(var(--primary))]"
                          />
                          <span className="flex-1 truncate">
                            {tagLabel(tag.name, tag.labels, locale)}
                          </span>
                          {tag.count > 0 && (
                            <span className="shrink-0 text-[10px] text-muted-foreground">{tag.count}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tag catalog — checkboxes grouped by category */}
      <div className="mt-6 space-y-6">
        {isFetching && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> 加载中…
          </div>
        )}
        {error && (
          <div className="text-sm text-destructive">{error.message}</div>
        )}
        {!isFetching && catalogGroups.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            没有标签
          </div>
        )}
        {catalogGroups.map(([category, tags]) => (
          <section key={category}>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {category}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const checked = selectedSet.has(tag.name);
                return (
                  <label
                    key={tag.name}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all hover:opacity-80",
                      categoryColor(tag.category),
                      checked && "ring-2 ring-primary ring-offset-1 ring-offset-background scale-[1.02]"
                    )}
                    title={tag.aliases.length > 0 ? tag.aliases.join(" / ") : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(tag.name)}
                      className="h-3 w-3 rounded border-border accent-[hsl(var(--primary))]"
                    />
                    <span className="opacity-70">{tagCategory(tag.name)}:</span>{" "}
                    <span className="font-medium">{tagLabel(tag.name, tag.labels, locale)}</span>
                    {tag.count > 0 && (
                      <span className="opacity-50">{tag.count}</span>
                    )}
                  </label>
                );
              })}
            </div>
          </section>
        ))}

        {/* Technical tags — collapsed by default */}
        {technicalCount > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowTechnical((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", showTechnical && "rotate-180")} />
              技术标签
              <span className="text-xs opacity-60">({technicalCount})</span>
            </button>
            {showTechnical && (
              <div className="mt-3 space-y-4">
                {technicalGroups.map(([category, tags]) => (
                  <div key={category}>
                    <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground/60">
                      {category}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => {
                        const checked = selectedSet.has(tag.name);
                        return (
                          <label
                            key={tag.name}
                            className={cn(
                              "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-all hover:opacity-80 opacity-70",
                              checked && "opacity-100 ring-2 ring-primary ring-offset-1 ring-offset-background scale-[1.02]"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(tag.name)}
                              className="h-3 w-3 rounded border-border accent-[hsl(var(--primary))]"
                            />
                            {tagLabel(tag.name, tag.labels, locale)}
                            {tag.count > 0 && <span className="opacity-50">{tag.count}</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
