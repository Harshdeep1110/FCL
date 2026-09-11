import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config: no database or bcrypt imports, so it can run in
 * middleware. The Credentials provider (which needs Prisma + bcrypt) is added
 * in the Node-only `src/auth.ts`.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [], // real providers live in src/auth.ts
  callbacks: {
    // Route protection for middleware: everything requires login except the
    // public auth pages (/login and /register).
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPublic =
        nextUrl.pathname === "/login" || nextUrl.pathname === "/register";

      if (isPublic) {
        // Bounce already-authenticated users away from the auth pages.
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }
      return isLoggedIn; // false → redirect to signIn page
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isAdmin = (token.isAdmin as boolean) ?? false;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
