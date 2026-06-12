"use client";

import { useCallback, useState } from "react";
import { useI18n } from "@/components/providers/locale-provider";
import { ApiError, NyaApi } from "@/lib/api";
import type { BackendConfig, DeveloperConfigResponse, DeveloperConsoleResponse } from "@/lib/types";
import type { AdminActionRunner } from "./use-admin-action";

type UseAdminDeveloperOptions = {
  run: AdminActionRunner;
  onError: (message: string) => void;
};

export function useAdminDeveloper({ run, onError }: UseAdminDeveloperOptions) {
  const { t } = useI18n();
  const [configResponse, setConfigResponse] = useState<DeveloperConfigResponse | null>(null);
  const [configDraft, setConfigDraft] = useState<BackendConfig | null>(null);
  const [consoleStatus, setConsoleStatus] = useState<DeveloperConsoleResponse | null>(null);
  const [consolePasswordDraft, setConsolePasswordDraft] = useState({ username: "", password: "" });

  const loadDeveloperConfig = useCallback(async () => {
    try {
      const response = await NyaApi.developerConfig();
      setConfigResponse(response);
      setConfigDraft(response.config);
      return response;
    } catch (err) {
      onError(err instanceof ApiError ? err.message : String(err));
      return null;
    }
  }, [onError]);

  const saveDeveloperConfig = useCallback(async () => {
    if (!configDraft) return null;
    const response = await run(
      "developer-config-save",
      () => NyaApi.updateDeveloperConfig(configDraft),
      () => t("admin.developer.configSaved")
    );
    if (response) {
      setConfigResponse(response);
      setConfigDraft(response.config);
    }
    return response;
  }, [configDraft, run, t]);

  const loadDeveloperConsole = useCallback(async () => {
    try {
      const response = await NyaApi.developerConsole();
      setConsoleStatus(response);
      return response;
    } catch (err) {
      onError(err instanceof ApiError ? err.message : String(err));
      return null;
    }
  }, [onError]);

  const resetConsolePassword = useCallback(async () => {
    const username = consolePasswordDraft.username.trim();
    const password = consolePasswordDraft.password;
    if (!username || !password) {
      onError(t("admin.developer.enterUserAndPassword"));
      return null;
    }
    const response = await run(
      "developer-reset-password",
      () => NyaApi.developerResetPassword(username, password),
      (user) => t("admin.accounts.passwordResetFor", { username: user.username })
    );
    if (response) setConsolePasswordDraft({ username: "", password: "" });
    return response;
  }, [consolePasswordDraft.password, consolePasswordDraft.username, onError, run, t]);

  return {
    configResponse,
    configDraft,
    setConfigDraft,
    loadDeveloperConfig,
    saveDeveloperConfig,
    consoleStatus,
    loadDeveloperConsole,
    consolePasswordDraft,
    setConsolePasswordDraft,
    resetConsolePassword,
  };
}
