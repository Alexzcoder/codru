"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { redirect } from "next/navigation";

const companySchema = z.object({
  name: z.string().trim().min(1).max(200),
  ico: z.string().trim().max(20).optional().or(z.literal("")),
  dic: z.string().trim().max(20).optional().or(z.literal("")),
  addressStreet: z.string().trim().max(200).optional().or(z.literal("")),
  addressCity: z.string().trim().max(100).optional().or(z.literal("")),
  addressZip: z.string().trim().max(20).optional().or(z.literal("")),
  iban: z.string().trim().max(40).optional().or(z.literal("")),
});

const localeSchema = z.object({ locale: z.enum(["cs", "en"]) });

export type OnboardingState = { error?: string };

export async function saveCompanyProfile(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const { workspace } = await requireWorkspace();
  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const d = parsed.data;
  const existing = await prisma.companyProfile.findFirst({
    where: { workspaceId: workspace.id, isDefault: true },
  });
  const payload = {
    name: d.name,
    ico: d.ico || null,
    dic: d.dic || null,
    addressStreet: d.addressStreet || null,
    addressCity: d.addressCity || null,
    addressZip: d.addressZip || null,
    iban: d.iban || null,
  };

  if (existing) {
    await prisma.companyProfile.update({
      where: { id: existing.id },
      data: payload,
    });
  } else {
    await prisma.companyProfile.create({
      data: { ...payload, workspaceId: workspace.id, isDefault: true },
    });
  }

  redirect("/onboarding?step=2");
}

export async function saveLocale(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const { user } = await requireWorkspace();
  const parsed = localeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  await prisma.user.update({
    where: { id: user.id },
    data: { locale: parsed.data.locale, onboardingDoneAt: new Date() },
  });
  redirect(`/${parsed.data.locale}/dashboard`);
}

export async function skipOnboarding() {
  const { user } = await requireWorkspace();
  await prisma.user.update({
    where: { id: user.id },
    data: { onboardingDoneAt: new Date() },
  });
  redirect("/dashboard");
}
