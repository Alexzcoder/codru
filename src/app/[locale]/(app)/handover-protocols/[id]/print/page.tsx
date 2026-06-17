import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PrintButton } from "../../print-button";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "____________";
  return d.toLocaleDateString("cs-CZ");
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        border: "1.5px solid #111",
        marginRight: 6,
        position: "relative",
        verticalAlign: "middle",
        background: on ? "#111" : "transparent",
      }}
    />
  );
}

export default async function ProtocolPrintPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();

  const p = await prisma.handoverProtocol.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!p) notFound();

  return (
    <div className="bg-white text-black">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
        }
        .protokol { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #111; max-width: 800px; margin: 0 auto; padding: 24px; font-size: 12px; line-height: 1.4; }
        .protokol h1 { font-size: 18px; font-weight: 700; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.05em; }
        .protokol h2 { font-size: 11px; font-weight: 700; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #111; padding-bottom: 2px; }
        .protokol .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
        .protokol .field { display: flex; gap: 6px; align-items: baseline; }
        .protokol .field-label { font-weight: 600; min-width: 110px; }
        .protokol .field-value { border-bottom: 1px dotted #777; flex: 1; min-height: 14px; padding: 0 2px; }
        .protokol table { width: 100%; border-collapse: collapse; margin-top: 4px; }
        .protokol th, .protokol td { border: 1px solid #111; padding: 4px 6px; vertical-align: top; font-size: 11px; }
        .protokol th { background: #f3f3f3; text-align: left; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
        .protokol .signature { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .protokol .signature-block { padding-top: 28px; border-top: 1px solid #111; font-size: 11px; }
        .protokol .check-row { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 2px; }
        .protokol .check { display: inline-flex; align-items: center; gap: 4px; }
        .protokol .small { font-size: 10px; color: #555; }
      `}</style>

      <div className="no-print mx-auto max-w-[800px] px-6 pt-4 text-right">
        <PrintButton label="Tisk / Print" />
      </div>

      <div className="protokol">
        <h1>Předávací protokol</h1>
        <p className="small">Protokol o provedených pracích</p>

        <h2>1. Identifikace</h2>
        <div className="grid">
          <div className="field"><span className="field-label">Číslo protokolu:</span><span className="field-value">{p.number ?? ""}</span></div>
          <div className="field"><span className="field-label">Číslo zakázky:</span><span className="field-value">{p.zakazkaNumber ?? ""}</span></div>
          <div className="field"><span className="field-label">Zákazník:</span><span className="field-value">{p.clientName ?? ""}</span></div>
          <div className="field"><span className="field-label">Telefon:</span><span className="field-value">{p.clientPhone ?? ""}</span></div>
          <div className="field"><span className="field-label">E-mail:</span><span className="field-value">{p.clientEmail ?? ""}</span></div>
          <div className="field"><span className="field-label">Adresa realizace:</span><span className="field-value">{p.siteAddress ?? ""}</span></div>
          <div className="field"><span className="field-label">Zhotovitel:</span><span className="field-value">{p.contractorName ?? ""}</span></div>
          <div className="field"><span className="field-label">Vedoucí zakázky:</span><span className="field-value">{p.leaderName ?? ""}</span></div>
          <div className="field"><span className="field-label">Datum realizace:</span><span className="field-value">{fmtDate(p.realizationDate)}</span></div>
          <div className="field"><span className="field-label">Datum podpisu:</span><span className="field-value">{fmtDate(p.signedAt)}</span></div>
        </div>

        <h2>2. Položky – původní rozsah a skutečné provedení</h2>
        <table>
          <thead>
            <tr>
              <th style={{ width: 24 }}>#</th>
              <th>Položka</th>
              <th style={{ width: 60 }}>Množ.</th>
              <th style={{ width: 50 }}>Jedn.</th>
              <th style={{ width: 90 }}>Provedeno</th>
              <th style={{ width: 90 }}>Neprovedeno</th>
              <th>Poznámka</th>
            </tr>
          </thead>
          <tbody>
            {p.items.length === 0 ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td style={{ textAlign: "center" }}><Check on={false} /></td>
                  <td style={{ textAlign: "center" }}><Check on={false} /></td>
                  <td></td>
                </tr>
              ))
            ) : (
              p.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.position}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{it.name}</div>
                    {it.description && (
                      <div className="small">{it.description}</div>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>{it.quantity ?? ""}</td>
                  <td>{it.unit ?? ""}</td>
                  <td style={{ textAlign: "center" }}><Check on={it.completed} /></td>
                  <td style={{ textAlign: "center" }}><Check on={it.notCompleted} /></td>
                  <td>{it.note ?? ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <h2>3. Vícepráce</h2>
        <div className="check-row">
          <span className="check"><Check on={!p.vicepraceDone} /> Ne</span>
          <span className="check"><Check on={p.vicepraceDone} /> Ano</span>
        </div>
        {p.vicepraceDone && (
          <div style={{ marginTop: 4 }}>
            <div className="field"><span className="field-label">Popis víceprací:</span><span className="field-value">{p.vicepraceDescription ?? ""}</span></div>
            <div className="field"><span className="field-label">Cena víceprací:</span><span className="field-value">{p.vicepracePrice ?? ""}</span></div>
            <div className="field"><span className="field-label">Souhlas zákazníka:</span><span className="field-value">{p.vicepraceConsent ?? ""}</span></div>
          </div>
        )}

        <h2>4. Použitý materiál</h2>
        <div className="field-value" style={{ minHeight: 28, whiteSpace: "pre-wrap" }}>{p.usedMaterials ?? ""}</div>

        <h2>5. Odpad / bioodpad</h2>
        <div className="field"><span className="field-label">Rozsah:</span><span className="field-value">{p.wasteGenerated ?? ""}</span></div>
        <div className="field"><span className="field-label">Odvoz:</span><span className="field-value">{p.wasteRemoved ?? ""}</span></div>

        <h2>6. Fotodokumentace</h2>
        <div className="check-row">
          <span className="check"><Check on={p.photosBeforeTaken} /> před zahájením prací</span>
          <span className="check"><Check on={p.photosDuringTaken} /> v průběhu prací</span>
          <span className="check"><Check on={p.photosAfterTaken} /> po dokončení prací</span>
        </div>

        <h2>7. Stav předání</h2>
        <div className="check-row">
          <span className="check"><Check on={p.acceptance === "ACCEPTED_NO_ISSUES"} /> převzato bez vad</span>
          <span className="check"><Check on={p.acceptance === "ACCEPTED_WITH_RESERVATIONS"} /> převzato s výhradami</span>
          <span className="check"><Check on={p.acceptance === "NOT_ACCEPTED"} /> nepřevzato</span>
          <span className="check"><Check on={p.acceptance === "CLIENT_ABSENT"} /> klient nebyl přítomen</span>
        </div>
        {p.clientReservations && (
          <div style={{ marginTop: 6 }}>
            <div className="field"><span className="field-label">Výhrady:</span><span className="field-value">{p.clientReservations}</span></div>
          </div>
        )}

        {p.contractorNote && (
          <>
            <h2>8. Poznámka zhotovitele</h2>
            <div className="field-value" style={{ minHeight: 28, whiteSpace: "pre-wrap" }}>{p.contractorNote}</div>
          </>
        )}

        <div className="signature">
          <div className="signature-block">
            Za zhotovitele<br />
            Jméno: ____________________<br />
            Podpis: ____________________<br />
            Datum: ____________________
          </div>
          <div className="signature-block">
            Za zákazníka<br />
            Jméno: ____________________<br />
            Podpis: ____________________<br />
            Datum: ____________________
          </div>
        </div>
      </div>
    </div>
  );
}
