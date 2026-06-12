import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "关于",
  description: "NyaGallery 项目功能、参考项目与相关链接。",
};

const ACKNOWLEDGEMENTS = [
  {
    name: "Yuri-NagaSaki/ImageFlow",
    href: "https://github.com/Yuri-NagaSaki/ImageFlow",
    note: "瀑布流浏览体验与图库灵感",
  },
  {
    name: "rr-/szurubooru",
    href: "https://github.com/rr-/szurubooru",
    note: "标签系统与图库管理思路",
  },
  {
    name: "cxchency/pixiv_crawler_v2",
    href: "https://github.com/cxchency/pixiv_crawler_v2",
    note: "Pixiv 抓取与命名习惯参考",
  },
  {
    name: "xuejianxianzun/PixivBatchDownloader",
    href: "https://github.com/xuejianxianzun/PixivBatchDownloader",
    note: "Pixiv 批量下载与归档工作流参考",
  },
];

const PERSONAL_LINKS = [
  { label: "项目主页", href: "https://github.com/NayaCcR/NyaGallery" },
  { label: "柳雪杨Naya", href: "https://naya.vip" },
  { label: "备用主页", href: "https://home.31n.cc" },
  { label: "Bilibili", href: "https://space.bilibili.com/129323413" },
];

export default function FaqPage() {
  return (
    <div className="container max-w-4xl py-10">
      <header className="mb-8 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">About</p>
        <h1 className="text-3xl font-semibold tracking-tight">关于 NyaGallery</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          NyaGallery 是一个自部署图库，用来归档 Pixiv 和本地上传图片，保留原图，
          通过标签、搜索、预览缓存和权限控制管理个人收藏。
        </p>
      </header>

      <section className="space-y-3 border-t border-border py-6">
        <h2 className="text-sm font-semibold">当前功能</h2>
        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <p>Pixiv 同步、上传归档、metadata JSON、数据库重建。</p>
          <p>Szurubooru 风格标签、别名、自动补全、文件名搜索。</p>
          <p>AVIF/WEBP 预览缓存、动图预览、转码进度与上传日志。</p>
          <p>账号密码登录、Cookie 会话、API Token、权限与安全限制。</p>
        </div>
      </section>

      <section className="space-y-3 border-t border-border py-6">
        <h2 className="text-sm font-semibold">鸣谢</h2>
        <div className="space-y-2">
          {ACKNOWLEDGEMENTS.map((item) => (
            <ExternalTextLink key={item.href} href={item.href} label={item.name} note={item.note} />
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-border py-6">
        <h2 className="text-sm font-semibold">相关链接</h2>
        <div className="flex flex-wrap gap-2">
          {PERSONAL_LINKS.map((item) => (
            <ExternalPill key={item.href} href={item.href} label={item.label} />
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-border py-6">
        <h2 className="text-sm font-semibold">友链</h2>
        <p className="text-sm text-muted-foreground">待添加</p>
      </section>

      <div className="border-t border-border pt-6">
        <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
          返回首页
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
