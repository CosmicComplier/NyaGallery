"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useI18n } from "@/components/providers/locale-provider";

const ACKNOWLEDGEMENTS = [
  {
    name: "Yuri-NagaSaki/ImageFlow",
    href: "https://github.com/Yuri-NagaSaki/ImageFlow",
    noteKey: "pages.faq.notes.imageflow",
  },
  {
    name: "rr-/szurubooru",
    href: "https://github.com/rr-/szurubooru",
    noteKey: "pages.faq.notes.szurubooru",
  },
  {
    name: "cxchency/pixiv_crawler_v2",
    href: "https://github.com/cxchency/pixiv_crawler_v2",
    noteKey: "pages.faq.notes.crawler",
  },
  {
    name: "xuejianxianzun/PixivBatchDownloader",
    href: "https://github.com/xuejianxianzun/PixivBatchDownloader",
    noteKey: "pages.faq.notes.pbd",
  },
];

const PERSONAL_LINKS = [
  { labelKey: "pages.faq.projectHome", href: "https://github.com/NayaCcR/NyaGallery" },
  { labelKey: "pages.faq.personalLinks.naya", href: "https://naya.vip" },
  { labelKey: "pages.faq.personalLinks.home", href: "https://home.31n.cc" },
  { label: "Bilibili", href: "https://space.bilibili.com/129323413" },
];

const FEATURE_KEYS = [
  "pages.faq.featureItems.archive",
  "pages.faq.featureItems.tags",
  "pages.faq.featureItems.media",
  "pages.faq.featureItems.auth",
];

export function FaqContent() {
  const { t } = useI18n();

  return (
    <div className="container max-w-4xl py-10">
      <header className="mb-8 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">About</p>
        <h1 className="text-3xl font-semibold tracking-tight">{t("pages.faq.title")}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("pages.faq.description")}
        </p>
      </header>

      <section className="space-y-3 border-t border-border py-6">
        <h2 className="text-sm font-semibold">{t("pages.faq.features")}</h2>
        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          {FEATURE_KEYS.map((key) => (
            <p key={key}>{t(key)}</p>
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-border py-6">
        <h2 className="text-sm font-semibold">{t("pages.faq.acknowledgements")}</h2>
        <div className="space-y-2">
          {ACKNOWLEDGEMENTS.map((item) => (
            <ExternalTextLink key={item.href} href={item.href} label={item.name} note={t(item.noteKey)} />
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-border py-6">
        <h2 className="text-sm font-semibold">{t("pages.faq.links")}</h2>
        <div className="flex flex-wrap gap-2">
          {PERSONAL_LINKS.map((item) => (
            <ExternalPill key={item.href} href={item.href} label={item.labelKey ? t(item.labelKey) : item.label ?? ""} />
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-border py-6">
        <h2 className="text-sm font-semibold">{t("pages.faq.friends")}</h2>
        <p className="text-sm text-muted-foreground">{t("pages.faq.friendsEmpty")}</p>
      </section>

      <div className="border-t border-border pt-6">
        <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
          {t("pages.faq.backHome")}
        </Link>
      </div>
    </div>
  );
}

function ExternalTextLink({ href, label, note }: { href: string; label: string; note: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex flex-col gap-1 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="inline-flex items-center gap-1.5 font-medium">
        {label}
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
      <span className="text-xs text-muted-foreground">{note}</span>
    </a>
  );
}

function ExternalPill({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {label}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}
