import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next.js 16 "proxy" convention (formerly "middleware"). Uses the edge-safe
// config only (no Prisma/bcrypt). The `authorized` callback in authConfig
// decides who may access which route.
export default NextAuth(authConfig).auth;

export const config = {
  // Run on everything except API routes (they do their own auth — session for
  // Auth.js, CRON_SECRET for cron jobs), Next.js internals and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
