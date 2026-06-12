import enUS from "./en-US.json";
import zhCN from "./zh-CN.json";

export const DEFAULT_LOCALE = "zh-CN";

export const dictionaries = {
  "zh-CN": zhCN,
  "en-US": enUS,
} as const;

export type LocaleCode = keyof typeof dictionaries;

export type MessageTree = {
  [key: string]: string | MessageTree;
};

export const localeOptions: Array<{ code: LocaleCode; label: string; shortLabel: string }> = [
  { code: "zh-CN", label: "简体中文", shortLabel: "中" },
  { code: "en-US", label: "English", shortLabel: "EN" },
];

export function isLocaleCode(value: string): value is LocaleCode {
  return value in dictionaries;
}
