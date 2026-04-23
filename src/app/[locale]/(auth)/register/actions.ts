"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { redirect } from "next/navigation";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(200),
});

export type RegisterState = { error?: string };

export async function registerOwner(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  // PRD §2.2: first person to register becomes owner. Self-registration disabled after.
  const ownerCount = await prisma.user.count({ where: { role: "OWNER" } });
  if (ownerCount > 0) {
    return { error: "registerClosed" };
  }

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    if (firstIssue?.path[0] === "password") return { error: "passwordTooShort" };
    return { error: "invalidInput" };
  }
  const { name, email, password } = parsed.data;

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: "OWNER",
      },
    });
  } catch {
    // Race condition: another OWNER may have been created between the count check and create.
    return { error: "registerClosed" };
  }

  await signIn("credentials", {
    email,
    password,
    redirect: false,
  });

  redirect("/onboarding");
}
