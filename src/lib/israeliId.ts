/** Standard Israeli teudat zehut (ID number) checksum validation. */
export function isValidIsraeliId(rawId: string): boolean {
  const digitsOnly = rawId.trim();
  if (!/^\d{5,9}$/.test(digitsOnly)) return false;

  const id = digitsOnly.padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = Number(id[i]) * ((i % 2) + 1);
    if (digit > 9) digit -= 9;
    sum += digit;
  }
  return sum % 10 === 0;
}
