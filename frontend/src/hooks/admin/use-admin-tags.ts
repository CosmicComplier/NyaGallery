"use client";

import { useCallback, useMemo, useState } from "react";
import { NyaApi } from "@/lib/api";
import type { TagSummaryItem } from "@/lib/types";
import type { AdminActionRunner } from "./use-admin-action";

type UseAdminTagsOptions = {
  run: AdminActionRunner;
};

export function useAdminTags({ run }: UseAdminTagsOptions) {
  const [tags, setTags] = useState<TagSummaryItem[]>([]);
  const [tagFilter, setTagFilter] = useState("");
  const [aliasDrafts, setAliasDrafts] = useState<Record<string, string>>({});
  const [summaryPath, setSummaryPath] = useState<string | null>(null);

  const loadTags = useCallback(async () => {
    const summary = await NyaApi.tagSummary();
    setTags(summary.items);
    setAliasDrafts(Object.fromEntries(summary.items.map((tag) => [tag.name, tag.aliases.join(", ")])));
  }, []);

  const filteredTags = useMemo(() => {
    const needle = tagFilter.trim().toLowerCase();
    if (!needle) return tags;
    return tags.filter((tag) =>
      [tag.name, tag.category, ...tag.aliases].join(" ").toLowerCase().includes(needle)
    );
  }, [tagFilter, tags]);

  const aliasesFromDraft = useCallback(
    (name: string): string[] =>
      Array.from(
        new Set(
          (aliasDrafts[name] ?? "")
            .split(/[,\n，]/)
            .map((item) => item.trim())
            .filter(Boolean)
        )
      ),
    [aliasDrafts]
  );

  const saveAliases = useCallback(
    async (tagName: string) => {
      await run(
        `tag-${tagName}`,
        () => NyaApi.updateTagAliases(tagName, aliasesFromDraft(tagName)),
        (tag) => `已保存 ${tag.name}`
      );
      await loadTags();
    },
    [aliasesFromDraft, loadTags, run]
  );

  const exportTagSummary = useCallback(async () => {
    await run("tag-export", () => NyaApi.exportTagSummary(), (result) => {
      setSummaryPath(result.path);
      return `已导出 ${result.total} 个标签`;
    });
  }, [run]);

  return {
    tags,
    filteredTags,
    tagFilter,
    setTagFilter,
    aliasDrafts,
    setAliasDrafts,
    summaryPath,
    loadTags,
    saveAliases,
    exportTagSummary,
  };
}
