import { isValidIco } from "./czech-validation";

const FIRST_NAMES = ["Jan", "Petr", "Tomáš", "Pavel", "Martin", "Jakub", "Marek", "Lucie", "Anna", "Tereza", "Kateřina", "Eva", "Jana", "Barbora", "Hana"];
const LAST_NAMES = ["Novák", "Svoboda", "Dvořák", "Černý", "Procházka", "Kučera", "Veselý", "Horák", "Němec", "Pokorný", "Marek", "Pospíšil", "Růžička", "Šimek", "Fiala"];
const COMPANY_SUFFIXES = ["s.r.o.", "a.s.", "& syn", "stavby s.r.o.", "servis s.r.o.", "group s.r.o."];
const CITIES = [
  { name: "Praha", zip: "110 00" },
  { name: "Brno", zip: "602 00" },
  { name: "Ostrava", zip: "702 00" },
  { name: "Plzeň", zip: "301 00" },
  { name: "Liberec", zip: "460 01" },
  { name: "Olomouc", zip: "779 00" },
  { name: "České Budějovice", zip: "370 01" },
  { name: "Hradec Králové", zip: "500 02" },
];
const STREETS = ["Národní", "Vinohradská", "Korunní", "Jungmannova", "Havlíčkova", "Masarykova", "Tyršova", "Palackého", "Husova", "Komenského"];
const PHONE_PREFIXES = ["602", "604", "606", "607", "608", "721", "723", "724", "725", "728", "731", "733", "737", "739"];
const STATUSES = ["POTENTIAL", "ACTIVE", "PAST"] as const;
const NOTES = [
  "Repeat customer — reliable, pays on time.",
  "Referred by existing client.",
  "Found us on Seznam.cz.",
  "Expecting quote next week.",
  "Large project, possible multi-stage.",
  "Prefers communication by email.",
];

const JOB_TITLES = [
  "Kompletní rekonstrukce koupelny",
  "Výměna oken — 8 ks",
  "Instalace tepelného čerpadla",
  "Oprava střechy po bouřce",
  "Malířské práce — byt 3+kk",
  "Podlahy — laminát 60 m²",
  "Elektroinstalace novostavba",
  "Zateplení fasády",
  "Rekonstrukce WC",
  "Zednické opravy",
  "Montáž sádrokartonu",
  "Pokládka dlažby v kuchyni",
];

const JOB_NOTES = [
  "Materiál si dodává zákazník.",
  "Potřeba zajistit lešení.",
  "Klient chce začít co nejdřív.",
  "Zvláštní přání: tichá práce mezi 12–14h.",
  "Plánované dokončení před Vánoci.",
  "Fakturace po etapách.",
];

const JOB_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED"] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate a valid 8-digit IČO that passes the modulo-11 checksum.
function generateValidIco(): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const first7 = Math.floor(1000000 + Math.random() * 9000000).toString();
    const weights = [8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 7; i++) sum += Number(first7[i]) * weights[i];
    const remainder = sum % 11;
    const check = remainder === 0 ? 1 : remainder === 1 ? 0 : 11 - remainder;
    if (check >= 0 && check <= 9) {
      const ico = `${first7}${check}`;
      if (isValidIco(ico)) return ico;
    }
  }
  return "27074358"; // fallback known-valid
}

export function generateDemoClient() {
  const type = Math.random() < 0.6 ? "COMPANY" : "INDIVIDUAL";
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const city = pick(CITIES);
  const street = `${pick(STREETS)} ${Math.floor(Math.random() * 200) + 1}`;

  const phone = `+420 ${pick(PHONE_PREFIXES)} ${Math.floor(100 + Math.random() * 900)} ${Math.floor(100 + Math.random() * 900)}`;
  const email = `${first.toLowerCase().replace(/[áčďéěíňóřšťúůýž]/g, (c) => ({ á: "a", č: "c", ď: "d", é: "e", ě: "e", í: "i", ň: "n", ó: "o", ř: "r", š: "s", ť: "t", ú: "u", ů: "u", ý: "y", ž: "z" })[c] ?? c)}.${last.toLowerCase().replace(/[áčďéěíňóřšťúůýž]/g, (c) => ({ á: "a", č: "c", ď: "d", é: "e", ě: "e", í: "i", ň: "n", ó: "o", ř: "r", š: "s", ť: "t", ú: "u", ů: "u", ý: "y", ž: "z" })[c] ?? c)}${Math.floor(Math.random() * 99)}@example.cz`;

  if (type === "COMPANY") {
    const ico = generateValidIco();
    const companyName = `${last} ${pick(COMPANY_SUFFIXES)}`;
    return {
      type: "COMPANY" as const,
      status: pick(STATUSES),
      companyName,
      fullName: null,
      ico,
      dic: `CZ${ico}`,
      email,
      phone,
      addressStreet: street,
      addressCity: city.name,
      addressZip: city.zip,
      addressCountry: "CZ",
      notes: pick(NOTES),
      defaultLanguage: "cs" as const,
      preferredCurrency: "CZK",
    };
  }

  return {
    type: "INDIVIDUAL" as const,
    status: pick(STATUSES),
    companyName: null,
    fullName: `${first} ${last}`,
    ico: null,
    dic: null,
    email,
    phone,
    addressStreet: street,
    addressCity: city.name,
    addressZip: city.zip,
    addressCountry: "CZ",
    notes: pick(NOTES),
    defaultLanguage: "cs" as const,
    preferredCurrency: "CZK",
  };
}

export function generateDemoJob(clientId: string) {
  const startOffsetDays = Math.floor(Math.random() * 30) - 10; // -10..+20 from now
  const start = new Date();
  start.setDate(start.getDate() + startOffsetDays);
  start.setHours(8 + Math.floor(Math.random() * 6), 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 2 + Math.floor(Math.random() * 6));

  return {
    title: pick(JOB_TITLES),
    clientId,
    status: pick(JOB_STATUSES),
    siteStreet: null,
    siteCity: null,
    siteZip: null,
    siteCountry: null,
    scheduledStart: start,
    scheduledEnd: end,
    notes: pick(JOB_NOTES),
  };
}
