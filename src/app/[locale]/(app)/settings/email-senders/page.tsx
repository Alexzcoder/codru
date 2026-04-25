import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import {
  archiveEmailIdentity,
  setDefaultEmailIdentity,
} from "./actions";
import { AddIdentityForm } from "./add-form";

export default async function EmailSendersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireOwner();

  const profiles = await prisma.companyProfile.findMany({
    where: { archivedAt: null },
    include: {
      emailIdentities: {
        where: { archivedAt: null },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Email senders</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            From-addresses you can use when emailing clients. Verify the
            domain in your{" "}
            <a
              href="https://resend.com/domains"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Resend dashboard
            </a>{" "}
            first; this list just records which addresses are available
            inside Codru.
          </p>
        </div>
      </div>

      {profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No company profiles yet. Add one in Settings → Company profiles
          first.
        </p>
      ) : (
        <div className="space-y-8">
          {profiles.map((p) => (
            <section key={p.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-baseline justify-between">
                <h3 className="text-base font-semibold">{p.name}</h3>
                <span className="text-xs text-muted-foreground">
                  {p.emailIdentities.length}{" "}
                  {p.emailIdentities.length === 1 ? "sender" : "senders"}
                </span>
              </div>

              {p.emailIdentities.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No senders yet for this company. Add one below.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border rounded-md border border-border">
                  {p.emailIdentities.map((id) => {
                    const setDefaultBound = async () => {
                      "use server";
                      await setDefaultEmailIdentity(id.id);
                    };
                    const archiveBound = async () => {
                      "use server";
                      await archiveEmailIdentity(id.id);
                    };
                    return (
                      <li
                        key={id.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">
                              {id.displayName ?? id.fromAddress}
                            </span>
                            {id.isDefault && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-800">
                                default
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {id.fromAddress}
                          </span>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {!id.isDefault && (
                            <form action={setDefaultBound}>
                              <Button type="submit" size="sm" variant="outline">
                                Make default
                              </Button>
                            </form>
                          )}
                          <form action={archiveBound}>
                            <Button type="submit" size="sm" variant="outline">
                              Remove
                            </Button>
                          </form>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <AddIdentityForm companyProfileId={p.id} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
