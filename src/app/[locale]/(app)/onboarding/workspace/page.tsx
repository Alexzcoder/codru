import { setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CreateWorkspaceForm } from "./form";

export default async function OnboardingWorkspacePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser();

  // If the user already has memberships, get out of the way.
  const existing = await prisma.membership.count({ where: { userId: user.id } });
  if (existing > 0) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Create your workspace
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A workspace holds one business&apos;s clients, jobs, invoices, and team.
        You can create more later — and switch between them from the header.
      </p>
      <div className="mt-8">
        <CreateWorkspaceForm />
      </div>
    </div>
  );
}
