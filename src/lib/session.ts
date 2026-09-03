import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Returns the current session user or redirects to /login. Use in pages/actions. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

/** Like requireUser, but 404s (via redirect home) non-admins. */
export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}

/** Returns the session user or null (no redirect). */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}
