import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NewRecurringChooser({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  const cards = [
    {
      kind: "EXPENSE",
      href: "/recurring/new/expense",
      desc: "Monthly subscriptions, insurance, rent, recurring supplier bills.",
    },
    {
      kind: "INVOICE",
      href: "/recurring/new/invoice",
      desc: "Retainer invoices, subscription billing, recurring maintenance charges.",
    },
    {
      kind: "JOB",
      href: "/recurring/new/job",
      desc: "Weekly cleaning, monthly maintenance, quarterly inspections.",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("Recurring.new")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("Recurring.pickKind")}</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.kind}
            href={c.href}
            className="rounded-xl border border-border bg-card shadow-sm p-5 hover:border-neutral-400"
          >
            <h2 className="text-lg font-semibold">
              {t(`Recurring.kinds.${c.kind}`)}
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
