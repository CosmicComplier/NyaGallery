"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, NyaApi } from "@/lib/api";
import type { TranscodeJob, UploadHistoryItem, UploadLogItem } from "@/lib/types";

const OPS_ACTIVE_POLL_MS = 2500;
const OPS_IDLE_POLL_MS = 15_000;
const OPS_PAGE_SIZE = 40;

export type AdminPollingMode = "active" | "idle" | "paused";

type UseAdminOperationsOptions = {
  enabled: boolean;
  onError: (message: string) => void;
};

export function useAdminOperations({ enabled, onError }: UseAdminOperationsOptions) {
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);
  const [uploadLogs, setUploadLogs] = useState<UploadLogItem[]>([]);
  const [transcodeJobs, setTranscodeJobs] = useState<TranscodeJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pollingMode, setPollingMode] = useState<AdminPollingMode>("idle");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const latestTranscodeJobsRef = useRef<TranscodeJob[]>([]);
  const pollNowRef = useRef<((showError?: boolean) => Promise<TranscodeJob[] | null>) | null>(null);
  const loadPromiseRef = useRef<Promise<TranscodeJob[] | null> | null>(null);

  useEffect(() => {
    latestTranscodeJobsRef.current = transcodeJobs;
  }, [transcodeJobs]);

  const loadOperations = useCallback(
    async (showError = true) => {
      if (loadPromiseRef.current) return loadPromiseRef.current;

      const promise = (async () => {
        try {
          const [history, logs, jobs] = await Promise.all([
            optionalListResponse<UploadHistoryItem>(NyaApi.uploadHistory(OPS_PAGE_SIZE), OPS_PAGE_SIZE, 0),
            optionalListResponse<UploadLogItem>(NyaApi.uploadLogs(OPS_PAGE_SIZE), OPS_PAGE_SIZE, 0),
            optionalListResponse<TranscodeJob>(NyaApi.transcodeJobs(OPS_PAGE_SIZE), OPS_PAGE_SIZE, 0),
          ]);
          setUploadHistory(history.items);
          setUploadLogs(logs.items);
          setTranscodeJobs(jobs.items);
          latestTranscodeJobsRef.current = jobs.items;
          setLastUpdatedAt(new Date().toISOString());
          setError(null);
          return jobs.items;
        } catch (err) {
          const message = err instanceof ApiError ? err.message : String(err);
          setError(message);
          if (showError) onError(message);
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

  const refreshOperations = useCallback(
    async (showError = true) => {
      return pollNowRef.current ? pollNowRef.current(showError) : loadOperations(showError);
    },
    [loadOperations]
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

    function scheduleNext(jobs: TranscodeJob[] | null | undefined) {
      if (stopped) return;
      clearTimer();
      if (document.hidden) {
        setPollingMode("paused");
        return;
      }

      const active = hasActiveTranscodeJobs(jobs ?? latestTranscodeJobsRef.current);
      setPollingMode(active ? "active" : "idle");
      timer = window.setTimeout(
        () => void poll(false),
        active ? OPS_ACTIVE_POLL_MS : OPS_IDLE_POLL_MS
      );
    }

    async function poll(showError = false): Promise<TranscodeJob[] | null> {
      if (stopped) return null;
      if (document.hidden) {
        scheduleNext(null);
        return null;
      }
      const jobs = await loadOperations(showError);
      scheduleNext(jobs);
      return jobs;
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
    void poll(true);

    return () => {
      stopped = true;
      clearTimer();
      pollNowRef.current = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, loadOperations]);

  return {
    uploadHistory,
    uploadLogs,
    transcodeJobs,
    error,
    pollingMode,
    lastUpdatedAt,
    loadOperations,
    refreshOperations,
  };
}

function hasActiveTranscodeJobs(jobs: TranscodeJob[]): boolean {
  return jobs.some((job) => {
    if (isTerminalTranscodeJob(job)) return false;
    const status = job.status.toLowerCase();
    if (status === "queued" || status === "running") return true;
    return status !== "success" && status !== "error" && job.progress > 0 && job.progress < 100;
  });
}

function isTerminalTranscodeJob(job: TranscodeJob): boolean {
  const status = job.status.toLowerCase();
  return status === "success" || status === "error" || job.stage === "done" || job.progress >= 100;
}

type ListResponse<T> = {
  items: T[];
  limit: number;
  offset: number;
};

async function optionalListResponse<T>(
  request: Promise<ListResponse<T>>,
  limit: number,
  offset: number
): Promise<ListResponse<T>> {
  try {
    return await request;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { items: [], limit, offset };
    }
    throw err;
  }
}
