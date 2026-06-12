"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useBrowseGalleryQueries } from "./use-browse-gallery-queries";

export function tokenizeQuery(query: string): string[] {
  if (!query) return [];
  return query.split(/\s+/).filter(Boolean);
}

export function useGalleryQueryControls() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params?.get("q") ?? "";
  const [multi, setMulti] = useState(false);
  const [collapseWorks, setCollapseWorks] = useState(true);
  const {
    queries: effectiveQueries,
    primaryQuery: effectiveQuery,
    ready: contentReady,
  } = useBrowseGalleryQueries(q);

  const tokens = useMemo(() => tokenizeQuery(q), [q]);

  const setQuery = useCallback(
    (next: string) => {
      const search = new URLSearchParams();
      if (next) search.set("q", next);
      const qs = search.toString();
      router.push(qs ? `/?${qs}` : "/");
    },
    [router]
  );

  const onTagClick = useCallback(
    (tag: string) => {
      if (multi) {
        const set = new Set(tokens);
        if (set.has(tag)) set.delete(tag);
        else set.add(tag);
        setQuery(Array.from(set).join(" "));
      } else {
        setQuery(tag);
      }
    },
    [multi, setQuery, tokens]
  );

  return {
    q,
    tokens,
    effectiveQuery,
    effectiveQueries,
    contentReady,
    multi,
    setMulti,
    collapseWorks,
    setCollapseWorks,
    setQuery,
    onTagClick,
  };
}
