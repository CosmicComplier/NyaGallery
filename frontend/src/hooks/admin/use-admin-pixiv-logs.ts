"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, NyaApi } from "@/lib/api";
import type { UploadLogItem } from "@/lib/types";
import type { AdminPollingMode } from "./use-admin-operations";

const PIXIV_ACTIVE_POLL_MS = 5_000;
const PIXIV_IDLE_POLL_MS = 20_000;

type UseAdminPixivLogsOptions = {
  enabled: boolean;
  onError: (message: string) => void;
};

export function useAdminPixivLogs({ enabled, onError }: UseAdminPixivLogsOptions) {
  const [logs, setLogs] = useState<UploadLogItem[]>([]);
  const [pollingMode, setPollingMode] = useState<AdminPollingMode>("idle");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const latestLogsRef = useRef<UploadLogItem[]>([]);
  const pollNowRef = useRef<((showError?: boolean) => Promise<UploadLogItem[] | null>) | null>(null);
  const loadPromiseRef = useRef<Promise<UploadLogItem[] | null> | null>(null);

  useEffect(() => {
    latestLogsRef.current = logs;
  }, [logs]);

  const loadPixivLogs = useCallback(
    async (showError = true) => {
      if (loadPromiseRef.current) return loadPromiseRef.current;

      const promise = (async () => {
        try {
          const response = await NyaApi.pixivLogs(40);
          setLogs(response.items);
          latestLogsRef.current = response.items;
          setLastUpdatedAt(new Date().toISOString());
          return response.items;
        } catch (err) {
          if (showError) onError(err instanceof ApiError ? err.message : String(err));
          return null;
        }
      })();

      loadPromiseRef.current = promise;
      try {
        return await promise;
      } finally {
        if (loadPromiseRef.current === promise) {
          loadPromiseRef.current = null;
        }
      }
    },
    [onError]
  );

  const refreshPixivLogs = useCallback(
    async (showError = true) => {
      return pollNowRef.current ? pollNowRef.current(showError) : loadPixivLogs(showError);
    },
    [loadPixivLogs]
  );

  useEffect(() => {
    if (!enabled) {
      setPollingMode("paused");
      pollNowRef.current = null;
      return;
    }

    let stopped = false;
    let timer: number | null = null;

    function clearTimer() {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    }

    function scheduleNext(logs: UploadLogItem[] | null | undefined) {
      if (stopped) return;
      clearTimer();
      if (document.hidden) {
        setPollingMode("paused");
        return;
      }

      const active = hasRecentPixivActivity(logs ?? latestLogsRef.current);
      setPollingMode(active ? "active" : "idle");
      timer = window.setTimeout(
        () => void poll(false),
        active ? PIXIV_ACTIVE_POLL_MS : PIXIV_IDLE_POLL_MS
      );
    }

    async function poll(showError = false): Promise<UploadLogItem[] | null> {
      if (stopped) return null;
      if (document.hidden) {
        scheduleNext(null);
        return null;
      }
      const logs = await loadPixivLogs(showError);
      scheduleNext(logs);
      return logs;
    }

    function onVisibilityChange() {
      if (document.hidden) {
        clearTimer();
        setPollingMode("paused");
      } else {
        void poll(false);
      }
    }

    pollNowRef.current = (showError = false) => {
      clearTimer();
      return poll(showError);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    void poll(false);

    return () => {
      stopped = true;
      clearTimer();
      pollNowRef.current = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, loadPixivLogs]);

  return {
    logs,
    pollingMode,
    lastUpdatedAt,
    loadPixivLogs,
    refreshPixivLogs,
  };
}

function hasRecentPixivActivity(logs: UploadLogItem[]): boolean {
  const latest = logs[0];
  if (!latest?.created_at) return false;
  if (latest.status === "queued" || latest.status === "running") return true;
  const created = new Date(latest.created_at).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created < 60_000;
}
