// ISO 3166-1 alpha-2 with Czech + English labels. Czech-first ordering, then
// the rest of the EU + a few common partners alphabetised by Czech name.
const COUNTRIES: { code: string; cs: string; en: string }[] = [
  { code: "CZ", cs: "Česká republika", en: "Czech Republic" },
  { code: "SK", cs: "Slovensko", en: "Slovakia" },
  { code: "AT", cs: "Rakousko", en: "Austria" },
  { code: "DE", cs: "Německo", en: "Germany" },
  { code: "PL", cs: "Polsko", en: "Poland" },
  { code: "HU", cs: "Maďarsko", en: "Hungary" },
  { code: "BE", cs: "Belgie", en: "Belgium" },
  { code: "BG", cs: "Bulharsko", en: "Bulgaria" },
  { code: "HR", cs: "Chorvatsko", en: "Croatia" },
  { code: "CY", cs: "Kypr", en: "Cyprus" },
  { code: "DK", cs: "Dánsko", en: "Denmark" },
  { code: "EE", cs: "Estonsko", en: "Estonia" },
  { code: "FI", cs: "Finsko", en: "Finland" },
  { code: "FR", cs: "Francie", en: "France" },
  { code: "GR", cs: "Řecko", en: "Greece" },
  { code: "IE", cs: "Irsko", en: "Ireland" },
  { code: "IT", cs: "Itálie", en: "Italy" },
  { code: "LV", cs: "Lotyšsko", en: "Latvia" },
  { code: "LT", cs: "Litva", en: "Lithuania" },
  { code: "LU", cs: "Lucembursko", en: "Luxembourg" },
  { code: "MT", cs: "Malta", en: "Malta" },
  { code: "NL", cs: "Nizozemsko", en: "Netherlands" },
  { code: "PT", cs: "Portugalsko", en: "Portugal" },
  { code: "RO", cs: "Rumunsko", en: "Romania" },
  { code: "SI", cs: "Slovinsko", en: "Slovenia" },
  { code: "ES", cs: "Španělsko", en: "Spain" },
  { code: "SE", cs: "Švédsko", en: "Sweden" },
  { code: "GB", cs: "Velká Británie", en: "United Kingdom" },
  { code: "CH", cs: "Švýcarsko", en: "Switzerland" },
  { code: "NO", cs: "Norsko", en: "Norway" },
  { code: "UA", cs: "Ukrajina", en: "Ukraine" },
  { code: "MD", cs: "Moldavsko", en: "Moldova" },
  { code: "US", cs: "USA", en: "United States" },
  { code: "CA", cs: "Kanada", en: "Canada" },
];

export function CountrySelect({
  name,
  defaultValue = "CZ",
  locale = "cs",
  id,
  className = "",
  required,
}: {
  name: string;
  defaultValue?: string | null;
  locale?: "cs" | "en";
  id?: string;
  className?: string;
  required?: boolean;
}) {
  return (
    <select
      id={id ?? name}
      name={name}
      defaultValue={defaultValue ?? "CZ"}
      required={required}
      className={`h-9 w-full rounded-md border border-input bg-background px-2 text-sm ${className}`}
    >
      {COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>
          {locale === "cs" ? c.cs : c.en} ({c.code})
        </option>
      ))}
    </select>
  );
}

export function countryName(code: string | null | undefined, locale: "cs" | "en" = "cs"): string {
  if (!code) return "";
  const c = COUNTRIES.find((x) => x.code === code);
  if (!c) return code;
  return locale === "cs" ? c.cs : c.en;
}
