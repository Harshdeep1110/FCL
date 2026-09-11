"use client";

import { useActionState } from "react";
import { authenticate, type LoginState } from "@/app/login/actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    authenticate,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-foreground outline-none transition focus:border-ucl-cyan"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-foreground outline-none transition focus:border-ucl-cyan"
        />
      </label>

      {state?.error && (
        <p className="text-sm text-bad" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-gradient-to-r from-ucl-cyan to-ucl-blue px-4 py-2.5 font-semibold text-[#04122e] shadow-lg shadow-ucl-blue/25 transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
