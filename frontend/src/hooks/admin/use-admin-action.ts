"use client";

import { useCallback, useState } from "react";
import { ApiError } from "@/lib/api";

export type AdminActionRunner = <T>(
  key: string,
  fn: () => Promise<T>,
  ok: (result: T) => string
) => Promise<T | null>;

type UseAdminActionOptions = {
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

export function useAdminAction({ onError, onSuccess }: UseAdminActionOptions) {
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback<AdminActionRunner>(
    async (key, fn, ok) => {
      setBusy(key);
      try {
        const result = await fn();
        onSuccess(ok(result));
        return result;
      } catch (err) {
        onError(err instanceof ApiError ? err.message : String(err));
        return null;
      } finally {
        setBusy(null);
      }
    },
    [onError, onSuccess]
  );

  return {
    busy,
    setBusy,
    run,
  };
}
