// IČO: 8 digits with modulo-11 checksum on the last digit.
// PRD §27: user can override the checksum with a manual flag.
export function isValidIco(raw: string): boolean {
  const digits = raw.replace(/\s/g, "");
  if (!/^\d{8}$/.test(digits)) return false;
  const weights = [8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(digits[i]) * weights[i];
  const remainder = sum % 11;
  const expected = remainder === 0 ? 1 : remainder === 1 ? 0 : 11 - remainder;
  return expected === Number(digits[7]);
}

// DIČ (Czech): "CZ" prefix + 8-10 digits (format only, per PRD §4.1).
export function isValidDic(raw: string): boolean {
  return /^CZ\d{8,10}$/.test(raw.replace(/\s/g, ""));
}
