"use server";

import { z } from "zod";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import crypto from "node:crypto";
import { redirect } from "next/navigation";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export type LoginState = { error?: string };

// PRD §23: rate limit login by IP. Window: 15 min, max 10 attempts per IP.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

async function hashIp(): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown";
  return crypto.createHash("sha256").update(ip).digest("hex");
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });
  if (!parsed.success) return { error: "loginError" };
  const { email, password, next } = parsed.data;

  const ipHash = await hashIp();
  const since = new Date(Date.now() - WINDOW_MS);
  const recentFailures = await prisma.loginAttempt.count({
    where: { ipHash, success: false, createdAt: { gte: since } },
  });
  if (recentFailures >= MAX_ATTEMPTS) {
    return { error: "rateLimited" };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch {
    await prisma.loginAttempt.create({
      data: { ipHash, email, success: false },
    });
    return { error: "loginError" };
  }

  await prisma.loginAttempt.create({
    data: { ipHash, email, success: true },
  });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { onboardingDoneAt: true, role: true },
  });
  const target =
    next && next.startsWith("/")
      ? next
      : user?.role === "OWNER" && !user.onboardingDoneAt
        ? "/onboarding"
        : "/dashboard";

  redirect(target);
}
