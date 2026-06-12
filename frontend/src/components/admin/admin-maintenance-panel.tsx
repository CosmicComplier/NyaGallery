"use client";

import type { Dispatch, SetStateAction } from "react";
import { Cloud, Plus, RefreshCw, Save, ShieldAlert, ShieldCheck, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/providers/locale-provider";
import type { BackendConfig, DeveloperConfigResponse, StorageStrategyConfig } from "@/lib/types";

type AdminMaintenancePanelProps = {
  busy: string | null;
  rebuildResult: string | null;
  isDeveloper: boolean;
  configResponse: DeveloperConfigResponse | null;
  configDraft: BackendConfig | null;
  onConfigDraftChange: Dispatch<SetStateAction<BackendConfig | null>>;
  onRefreshConfig: () => unknown;
  onSaveConfig: () => unknown;
  onRebuild: () => unknown;
  onRebuildWithCache: () => unknown;
  onGenerateMedia: () => unknown;
};

const STRATEGY_TYPES = ["webdav", "upyun", "aliyun_oss", "onedrive"] as const;

export function AdminMaintenancePanel({
  busy,
  rebuildResult,
  isDeveloper,
  configResponse,
  configDraft,
  onConfigDraftChange,
  onRefreshConfig,
  onSaveConfig,
  onRebuild,
  onRebuildWithCache,
  onGenerateMedia,
}: AdminMaintenancePanelProps) {
  const { t } = useI18n();
  const originalStorage = configDraft?.original_storage ?? { default_strategy: "local", strategies: [] };
  const strategies = originalStorage.strategies ?? [];
  const defaultOptions = ["local", ...strategies.map((strategy) => strategy.name).filter(Boolean)];

  function patchOriginalStorage(values: Partial<BackendConfig["original_storage"]>) {
    onConfigDraftChange((current) => current
      ? { ...current, original_storage: { ...ensureOriginalStorage(current), ...values } }
      : current);
  }

  function updateStrategy(index: number, values: Partial<StorageStrategyConfig>) {
    onConfigDraftChange((current) => {
      if (!current) return current;
      const storage = ensureOriginalStorage(current);
      const next = storage.strategies.map((strategy, itemIndex) => (
        itemIndex === index ? { ...strategy, ...values } : strategy
      ));
      return { ...current, original_storage: { ...storage, strategies: next } };
    });
  }

  function addStrategy(type: StorageStrategyConfig["type"]) {
    onConfigDraftChange((current) => {
      if (!current) return current;
      const storage = ensureOriginalStorage(current);
      const next = [...storage.strategies, makeStorageStrategy(type, storage.strategies.length + 1)];
      return { ...current, original_storage: { ...storage, strategies: next } };
    });
  }

  function removeStrategy(index: number) {
    onConfigDraftChange((current) => {
      if (!current) return current;
      const storage = ensureOriginalStorage(current);
      const removed = storage.strategies[index];
      const next = storage.strategies.filter((_, itemIndex) => itemIndex !== index);
      const defaultStrategy = storage.default_strategy === removed?.name
        ? "local"
        : storage.default_strategy;
      return { ...current, original_storage: { default_strategy: defaultStrategy, strategies: next } };
    });
  }

  return (
    <>
      <section className="space-y-3 rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <RefreshCw className="h-4 w-4" /> {t("admin.maintenance.rebuildTitle")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("admin.maintenance.rebuildDescription")}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy === "rebuild"} onClick={onRebuild}>
            {t("admin.maintenance.rebuild")}
          </Button>
          <Button variant="outline" size="sm" disabled={busy === "rebuild-cache"} onClick={onRebuildWithCache}>
            {t("admin.maintenance.rebuildCache")}
          </Button>
          <Button variant="outline" size="sm" disabled={busy === "media"} onClick={onGenerateMedia}>
            <Wand2 className="h-4 w-4" /> {t("admin.maintenance.generateMedia")}
          </Button>
        </div>
        {rebuildResult && <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">{rebuildResult}</pre>}
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Cloud className="h-4 w-4" /> {t("admin.maintenance.cloudTitle")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {isDeveloper
                ? configResponse ? `${configResponse.path}${configResponse.exists ? "" : t("admin.maintenance.willCreateSuffix")}` : t("admin.maintenance.cloudDescription")
                : t("admin.maintenance.developerOnly")}
            </p>
          </div>
          {isDeveloper && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={busy === "developer-config-refresh"} onClick={onRefreshConfig}>
                {t("common.refresh")}
              </Button>
              <Button size="sm" disabled={!configDraft || busy === "developer-config-save"} onClick={onSaveConfig}>
                <Save className="h-4 w-4" /> {t("admin.maintenance.saveCloud")}
              </Button>
            </div>
          )}
        </div>

        {!isDeveloper && (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t("admin.maintenance.developerOnlyHint")}
          </div>
        )}

        {isDeveloper && configDraft && (
          <div className="space-y-5">
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/35 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
              {configDraft.security?.secret_encryption_enabled ? (
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              )}
              <span>
                {configDraft.security?.secret_encryption_enabled
                  ? t("admin.maintenance.encryptionEnabled")
                  : t("admin.maintenance.encryptionDisabled")}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("admin.maintenance.defaultStrategy")}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-ring"
                  value={originalStorage.default_strategy}
                  onChange={(event) => patchOriginalStorage({ default_strategy: event.target.value })}
                >
                  {Array.from(new Set(defaultOptions)).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {STRATEGY_TYPES.map((type) => (
                <Button key={type} type="button" variant="outline" size="sm" onClick={() => addStrategy(type)}>
                  <Plus className="h-4 w-4" /> {type}
                </Button>
              ))}
            </div>

            <div className="space-y-4">
              {strategies.length === 0 && (
                <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {t("admin.maintenance.emptyStrategies")}
                </div>
              )}
              {strategies.map((strategy, index) => (
                <StrategyEditor
                  key={`${strategy.name}-${index}`}
                  strategy={strategy}
                  onChange={(patch) => updateStrategy(index, patch)}
                  onRemove={() => removeStrategy(index)}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function StrategyEditor({
  strategy,
  onChange,
  onRemove,
}: {
  strategy: StorageStrategyConfig;
  onChange: (patch: Partial<StorageStrategyConfig>) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">{strategy.name || t("admin.maintenance.unnamed")} · {strategy.type}</div>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4" /> {t("pages.asset.delete")}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <TextField label="name" value={strategy.name} onChange={(value) => onChange({ name: value })} />
        <SelectField label="type" value={strategy.type} options={STRATEGY_TYPES} onChange={(value) => onChange({ type: value })} />
        <TextField label="prefix" value={strategy.prefix} onChange={(value) => onChange({ prefix: value })} />
        {commonFields(strategy, onChange)}
        <NumberField label="timeout_seconds" value={strategy.timeout_seconds} onChange={(value) => onChange({ timeout_seconds: value })} />
      </div>
    </div>
  );
}

function commonFields(strategy: StorageStrategyConfig, onChange: (patch: Partial<StorageStrategyConfig>) => void) {
  if (strategy.type === "aliyun_oss") {
    return (
      <>
        <TextField label="endpoint" value={strategy.endpoint} onChange={(value) => onChange({ endpoint: value })} />
        <TextField label="bucket" value={strategy.bucket} onChange={(value) => onChange({ bucket: value })} />
        <TextField label="access_key_id" value={strategy.access_key_id} onChange={(value) => onChange({ access_key_id: value })} />
        <TextField type="password" label="access_key_secret" value={strategy.access_key_secret} onChange={(value) => onChange({ access_key_secret: value })} />
      </>
    );
  }
  if (strategy.type === "onedrive") {
    return (
      <>
        <TextField label="endpoint" value={strategy.endpoint} onChange={(value) => onChange({ endpoint: value })} />
        <TextField type="password" label="token" value={strategy.token} onChange={(value) => onChange({ token: value })} />
        <TextField label="drive_id" value={strategy.drive_id} onChange={(value) => onChange({ drive_id: value })} />
        <TextField label="root_path" value={strategy.root_path} onChange={(value) => onChange({ root_path: value })} />
      </>
    );
  }
  return (
    <>
      <TextField label="endpoint" value={strategy.endpoint} onChange={(value) => onChange({ endpoint: value })} />
      <TextField label="bucket" value={strategy.bucket} onChange={(value) => onChange({ bucket: value })} />
      <TextField label="username" value={strategy.username} onChange={(value) => onChange({ username: value })} />
      <TextField type="password" label="password" value={strategy.password} onChange={(value) => onChange({ password: value })} />
      <TextField type="password" label="token" value={strategy.token} onChange={(value) => onChange({ token: value })} />
    </>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" min={1} value={String(value)} onChange={(event) => onChange(toPositiveInt(event.target.value))} />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-ring"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function makeStorageStrategy(type: string, index: number): StorageStrategyConfig {
  return {
    name: `${type}-${index}`,
    type,
    prefix: "original",
    endpoint: type === "upyun" ? "https://v0.api.upyun.com" : type === "onedrive" ? "https://graph.microsoft.com/v1.0" : "",
    bucket: "",
    username: "",
    password: "",
    token: "",
    access_key_id: "",
    access_key_secret: "",
    drive_id: "",
    root_path: type === "onedrive" ? "NyaGallery" : "",
    timeout_seconds: 60,
  };
}

function ensureOriginalStorage(config: BackendConfig): BackendConfig["original_storage"] {
  return config.original_storage ?? { default_strategy: "local", strategies: [] };
}

function toPositiveInt(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 60;
  return Math.max(1, Math.round(parsed));
}
