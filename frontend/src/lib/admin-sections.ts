import type { Role } from "@/lib/types";

export type AdminSection =
  | "dashboard"
  | "pixiv"
  | "operations"
  | "security"
  | "tags"
  | "maintenance"
  | "accounts";

export const ADMIN_SECTION_ORDER: AdminSection[] = [
  "dashboard",
  "pixiv",
  "operations",
  "security",
  "tags",
  "maintenance",
  "accounts",
];

export const ADMIN_SECTION_LABELS: Record<AdminSection, string> = {
  dashboard: "仪表盘",
  pixiv: "Pixiv",
  operations: "上传与转码",
  security: "安全",
  tags: "标签",
  maintenance: "维护",
  accounts: "账户",
};

const ADMIN_SECTION_ROLES: Record<AdminSection, Role[]> = {
  dashboard: ["viewer", "editor", "admin"],
  pixiv: ["editor", "admin"],
  operations: ["viewer", "editor", "admin"],
  security: ["admin"],
  tags: ["admin"],
  maintenance: ["admin"],
  accounts: ["viewer", "editor", "admin"],
};

export function normalizeAdminSection(value: string | null | undefined): AdminSection {
  return isAdminSection(value) ? value : "dashboard";
}

export function canAccessAdminSection(role: Role | null | undefined, section: AdminSection): boolean {
  if (!role || role === "guest") return false;
  return ADMIN_SECTION_ROLES[section].includes(role);
}

export function getAdminSectionsForRole(role: Role | null | undefined): AdminSection[] {
  return ADMIN_SECTION_ORDER.filter((section) => canAccessAdminSection(role, section));
}

export function getDefaultAdminSection(role: Role | null | undefined): AdminSection | null {
  return getAdminSectionsForRole(role)[0] ?? null;
}

export function getVisibleAdminSection(
  role: Role | null | undefined,
  requested: AdminSection
): AdminSection | null {
  return canAccessAdminSection(role, requested) ? requested : getDefaultAdminSection(role);
}

export function getAdminSectionHref(section: AdminSection): string {
  return section === "dashboard" ? "/admin" : `/admin?section=${section}`;
}

export function getAdminSectionLabel(section: AdminSection): string {
  return ADMIN_SECTION_LABELS[section];
}

function isAdminSection(value: string | null | undefined): value is AdminSection {
  return Boolean(value && (ADMIN_SECTION_ORDER as string[]).includes(value));
}
