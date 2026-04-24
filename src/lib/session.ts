import { auth } from "@/auth";
import { prisma } from "./prisma";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";

export async function requireUser(): Promise<User> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.deactivatedAt) redirect("/login");
  return user;
}

export async function requireOwner(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "OWNER") redirect("/dashboard");
  return user;
}
