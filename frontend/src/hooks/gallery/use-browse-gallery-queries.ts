"use client";

import { useMemo } from "react";
import { useContentPreferences } from "@/components/providers/content-preferences-provider";

const SENSITIVE_TAGS = ["rating:r18", "rating:r18g"] as const;
const AI_TAG = "meta:ai_generated";

export function useBrowseGalleryQueries(query: string | string[] = "") {
  const {
    ready,
    canViewSensitiveContent,
    showSensitive,
    showAi,
    applyContentFilters,
  } = useContentPreferences();

  const queries = useMemo(() => {
    const parts = Array.isArray(query) ? query.filter(Boolean) : tokenizeQuery(query);
    if (parts.length > 0) return [applyContentFilters(parts)];

    return buildBrowseQueries({
      canViewSensitiveContent,
      showSensitive,
      showAi,
    });
  }, [applyContentFilters, canViewSensitiveContent, query, showAi, showSensitive]);

  return {
    queries,
    ready,
    primaryQuery: queries[0] ?? "",
  };
}

function buildBrowseQueries({
  canViewSensitiveContent,
  showSensitive,
  showAi,
}: {
  canViewSensitiveContent: boolean;
  showSensitive: boolean;
  showAi: boolean;
}): string[] {
  const queries = [
    joinQuery([...excludeSensitiveTags(), excludeTag(AI_TAG)]),
  ];

  if (canViewSensitiveContent && showSensitive) {
    for (const tag of SENSITIVE_TAGS) {
      queries.push(joinQuery([tag, excludeTag(AI_TAG)]));
    }
  }

  if (showAi) {
    queries.push(joinQuery([AI_TAG, ...excludeSensitiveTags()]));
  }

  if (canViewSensitiveContent && showSensitive && showAi) {
    for (const tag of SENSITIVE_TAGS) {
      queries.push(joinQuery([AI_TAG, tag]));
    }
  }

  return Array.from(new Set(queries));
}

function tokenizeQuery(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean);
}

function excludeSensitiveTags(): string[] {
  return SENSITIVE_TAGS.map(excludeTag);
}

function excludeTag(tag: string): string {
  return `-${tag}`;
}

function joinQuery(parts: string[]): string {
  return parts.join(" ");
}
