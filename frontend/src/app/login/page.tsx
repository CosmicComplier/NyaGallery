"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/providers/auth-provider";
import { useI18n } from "@/components/providers/locale-provider";
import { useToast } from "@/components/providers/toast-provider";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!username.trim() || !password) return;
    setBusy(true);
    try {
      await login(username.trim(), password, remember);
      toast.success(t("auth.loginSuccess"));
      router.push("/");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container max-w-md py-16">
      <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">{t("auth.login")}</h1>
            <p className="text-xs text-muted-foreground">{t("auth.loginDescription")}</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="username">{t("auth.username")}</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            {t("auth.remember30Days")}
          </label>
          <Button type="submit" className="w-full" disabled={busy || !username.trim() || !password}>
            {t("auth.login")}
          </Button>
        </form>
      </div>
    </div>
  );
}
