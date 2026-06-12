"use client";

import { useCallback, useState } from "react";
import { ApiError, NyaApi } from "@/lib/api";
import type { ApiTokenSummary, Role, UserSummary } from "@/lib/types";
import type { AdminActionRunner } from "./use-admin-action";

type UseAdminAccountsOptions = {
  run: AdminActionRunner;
  onError: (message: string) => void;
};

export function useAdminAccounts({ run, onError }: UseAdminAccountsOptions) {
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "viewer" as Role });
  const [passwordDraft, setPasswordDraft] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [userPasswordDrafts, setUserPasswordDrafts] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [tokenTarget, setTokenTarget] = useState("");
  const [tokenLabel, setTokenLabel] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [apiTokens, setApiTokens] = useState<ApiTokenSummary[]>([]);

  const replaceUsers = useCallback((items: UserSummary[]) => {
    setUsers(items);
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const response = await NyaApi.users();
      setUsers(response.items);
      return response.items;
    } catch (err) {
      onError(err instanceof ApiError ? err.message : String(err));
      return [];
    }
  }, [onError]);

  const loadTokensFor = useCallback(
    async (username: string, showToast = true) => {
      const target = username.trim();
      if (!target) return null;
      if (showToast) {
        const result = await run(
          "token-list",
          () => NyaApi.userTokens(target),
          (response) => `已加载 ${response.items.length} 个 Token`
        );
        if (result) setApiTokens(result.items);
        return result;
      }
      try {
        const result = await NyaApi.userTokens(target);
        setApiTokens(result.items);
        return result;
      } catch (err) {
        onError(err instanceof ApiError ? err.message : String(err));
        return null;
      }
    },
    [onError, run]
  );

  const loadUserTokens = useCallback(
    async (username: string) => {
      await loadTokensFor(username);
    },
    [loadTokensFor]
  );

  const revokeUserToken = useCallback(
    async (tokenId: number, username: string) => {
      const result = await run(
        `token-revoke-${tokenId}`,
        () => NyaApi.revokeToken(tokenId),
        () => "Token 已撤销"
      );
      if (result) await loadTokensFor(username);
    },
    [loadTokensFor, run]
  );

  const issueTokenForTarget = useCallback(
    async (username: string) => {
      const target = username.trim();
      if (!target) return;
      await run("token", () => NyaApi.issueToken(target, tokenLabel.trim()), (result) => {
        setIssuedToken(result.token);
        void loadTokensFor(target, false);
        return "Token 已签发";
      });
    },
    [loadTokensFor, run, tokenLabel]
  );

  const createUser = useCallback(async () => {
    if (!newUser.username || !newUser.password) return;
    const created = await run(
      "create-user",
      () => NyaApi.createUser(newUser.username, newUser.password, newUser.role),
      (user) => `已创建用户 ${user.username}`
    );
    if (!created) return;
    setUsers((current) => {
      const others = current.filter((user) => user.username !== created.username);
      return [...others, created].sort((left, right) =>
        left.username.localeCompare(right.username) || left.id - right.id
      );
    });
    setNewUser((draft) => ({ ...draft, username: "", password: "" }));
  }, [newUser.password, newUser.role, newUser.username, run]);

  const changePassword = useCallback(async () => {
    if (!passwordDraft.oldPassword || !passwordDraft.newPassword) return;
    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      onError("两次输入的新密码不一致");
      return;
    }
    const result = await run(
      "change-password",
      () => NyaApi.changePassword(passwordDraft.oldPassword, passwordDraft.newPassword),
      () => "密码已更新"
    );
    if (result) setPasswordDraft({ oldPassword: "", newPassword: "", confirmPassword: "" });
  }, [onError, passwordDraft.confirmPassword, passwordDraft.newPassword, passwordDraft.oldPassword, run]);

  const resetUserPassword = useCallback(
    async (username: string) => {
      const newPassword = userPasswordDrafts[username] ?? "";
      if (!newPassword) {
        onError("请输入新密码");
        return;
      }
      const updated = await run(
        `user-password-${username}`,
        () => NyaApi.resetUserPassword(username, newPassword),
        (user) => `已重置 ${user.username} 的密码`
      );
      if (!updated) return;
      setUserPasswordDrafts((drafts) => ({ ...drafts, [username]: "" }));
      setUsers((current) => current.map((user) => (user.username === updated.username ? updated : user)));
    },
    [onError, run, userPasswordDrafts]
  );

  return {
    newUser,
    setNewUser,
    passwordDraft,
    setPasswordDraft,
    userPasswordDrafts,
    setUserPasswordDrafts,
    users,
    replaceUsers,
    loadUsers,
    tokenTarget,
    setTokenTarget,
    tokenLabel,
    setTokenLabel,
    issuedToken,
    apiTokens,
    loadTokensFor,
    loadUserTokens,
    revokeUserToken,
    issueTokenForTarget,
    createUser,
    changePassword,
    resetUserPassword,
  };
}
