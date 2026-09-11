"use client";

import Link from "next/link";
import { useActionState } from "react";
import { register, type RegisterState } from "@/app/register/actions";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    register,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">Name</span>
        <input
          name="name"
          type="text"
          required
          autoComplete="name"
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-foreground outline-none transition focus:border-ucl-cyan"
        />
      </label>

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
          minLength={8}
          autoComplete="new-password"
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-foreground outline-none transition focus:border-ucl-cyan"
        />
        <span className="text-xs text-muted">At least 8 characters.</span>
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
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-ucl-cyan hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
