"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";

import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";

export type RegisterState = { error: string } | undefined;

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(50),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
      "Enter a valid email address.",
    ),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function register(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "That email is already registered — try signing in." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, name, passwordHash, isAdmin: false },
  });

  // Sign the new user straight in and send them to the season hub.
  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      // Account exists but auto-login failed for some reason — let them log in.
      return { error: "Account created. Please sign in." };
    }
    // Re-throw redirect (NEXT_REDIRECT) and other control-flow errors.
    throw error;
  }
}
