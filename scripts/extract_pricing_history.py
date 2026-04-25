"""Extract line items from past iDoklad quotes/invoices into a JSON dataset.

Reads every PDF under .pricing-data/Price quotes and invoices/, finds the line-
item table (rows between the "Označení dodávky ... Celkem" header and the
boilerplate "Pokud objednatel ..." paragraph), and writes a normalised dataset
to src/lib/pricing-history/data.json.

Each output record looks like:
{
  "source": "Cenová nabídka - CN20250015.pdf",
  "doc_number": "O20250015",
  "issue_date": "2025-09-09",
  "description": "Veškeré práce, materiál, nářadí, montáž provizoria, úklid a likvidace odpadu",
  "quantity": 1.00,
  "unit": "",
  "unit_price": 8800.00,
  "vat_percent": 21,
  "net": 8800.00,
  "vat": 1848.00,
  "gross": 10648.00
}
"""

from __future__ import annotations
import glob
import json
import re
import sys
from pathlib import Path

import pdfplumber

PDF_DIR = Path(".pricing-data/Price quotes and invoices")
OUT = Path("src/lib/pricing-history/data.json")

HEADER_RE = re.compile(
    r"Označení dodávky\s+Počet\s+m\.\s*j\.\s+Cena za m\.j\.\s+DPH\s*%\s+Bez DPH\s+DPH\s+Celkem"
)
END_MARKERS = (
    "Pokud objednatel",
    "Sazba DPH",
    "Vystaveno v online",
    "Vytiskl",
    "CELKEM",
)
ISSUE_DATE_RE = re.compile(r"vystavení:\s*(\d{2}\.\d{2}\.\d{4})")
DOC_NUMBER_RE = re.compile(r"Objednávka\s+(\S+)")

# Numbers may contain internal spaces ("1 000,00") so we cannot tokenise on
# whitespace. Anchor on the trailing four columns (net, vat, gross are numeric;
# vat_percent is 1-2 digits) and parse from the right.
TRAIL_RE = re.compile(
    r"(?P<vat_pct>\b\d{1,2}\b)\s+"
    r"(?P<net>-?\d{1,3}(?:\s\d{3})*(?:,\d+)?)\s+"
    r"(?P<vat_amt>-?\d{1,3}(?:\s\d{3})*(?:,\d+)?)\s+"
    r"(?P<gross>-?\d{1,3}(?:\s\d{3})*(?:,\d+)?)\s*$"
)
# Used on the prefix once trailing 4 cols are stripped.
QTY_UP_RE = re.compile(
    r"^(?P<desc>.+?)\s+(?P<qty>-?\d{1,3}(?:\s\d{3})*(?:,\d+)?)"
    r"(?:\s+(?P<unit>[A-Za-zÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž][\w²³./²]*))?"
    r"\s+(?P<unit_price>-?\d{1,3}(?:\s\d{3})*(?:,\d+)?)\s*$"
)


def parse_num(s: str) -> float:
    return float(s.replace(" ", "").replace("\xa0", "").replace(".", "").replace(",", "."))


def extract_lines_from_text(text: str) -> list[dict]:
    rows: list[dict] = []
    lines = text.splitlines()
    in_table = False
    pending: str | None = None  # holds a wrapped description from the previous line

    for line in lines:
        line = line.strip()
        if not line:
            continue
        if not in_table:
            if HEADER_RE.search(line):
                in_table = True
            continue
        if any(line.startswith(m) for m in END_MARKERS):
            in_table = False
            pending = None
            continue
        candidate = (pending + " " + line) if pending else line
        tail = TRAIL_RE.search(candidate)
        if not tail:
            pending = candidate  # description wrapped, retry with next line
            continue
        prefix = candidate[: tail.start()].rstrip()
        head = QTY_UP_RE.match(prefix)
        if not head:
            # malformed row — skip
            pending = None
            continue
        desc = head.group("desc").strip()
        if is_junk(desc):
            pending = None
            continue
        rows.append({
            "description": desc,
            "quantity": parse_num(head.group("qty")),
            "unit": (head.group("unit") or "").strip(),
            "unit_price": parse_num(head.group("unit_price")),
            "vat_percent": int(tail.group("vat_pct")),
            "net": parse_num(tail.group("net")),
            "vat": parse_num(tail.group("vat_amt")),
            "gross": parse_num(tail.group("gross")),
        })
        pending = None
    return rows


def parse_iso_date(s: str) -> str:
    d, m, y = s.split(".")
    return f"{y}-{m}-{d}"


# Drop administrative / non-service rows that would pollute the model.
JUNK_PATTERNS = [
    re.compile(r"^Zaokrouhlení", re.IGNORECASE),
    re.compile(r"^Záloha\b", re.IGNORECASE),
    re.compile(r"^\d{1,3}%:"),  # "30%:" deduction lines
    re.compile(r"^O20\d{6}\b"),  # references to other order numbers
    re.compile(r"^Odpočet\s+zálohy", re.IGNORECASE),
]


def is_junk(desc: str) -> bool:
    return any(p.search(desc) for p in JUNK_PATTERNS)


def main() -> int:
    files = sorted(glob.glob(str(PDF_DIR / "*.pdf")))
    if not files:
        print(f"no PDFs found in {PDF_DIR}", file=sys.stderr)
        return 1

    out: list[dict] = []
    no_lines = []
    for fp in files:
        try:
            with pdfplumber.open(fp) as pdf:
                full = "\n".join((page.extract_text() or "") for page in pdf.pages)
        except Exception as e:
            print(f"!! failed to read {fp}: {e}", file=sys.stderr)
            continue
        date_m = ISSUE_DATE_RE.search(full)
        doc_m = DOC_NUMBER_RE.search(full)
        date = parse_iso_date(date_m.group(1)) if date_m else None
        doc_number = doc_m.group(1) if doc_m else Path(fp).stem
        rows = extract_lines_from_text(full)
        if not rows:
            no_lines.append(fp)
            continue
        for r in rows:
            r.update({
                "source": Path(fp).name,
                "doc_number": doc_number,
                "issue_date": date,
            })
            out.append(r)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"wrote {len(out)} line items from {len(files) - len(no_lines)}/{len(files)} PDFs to {OUT}")
    if no_lines:
        print(f"!! no line items parsed from {len(no_lines)} PDF(s):")
        for p in no_lines[:10]:
            print(f"   {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
