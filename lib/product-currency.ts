/** Supported product price currencies (lowercase ISO 4217, stored on `products.currency`). */
export const PRODUCT_CURRENCY_OPTIONS = [
  { code: "gbp", label: "£ GBP — British pound" },
  { code: "usd", label: "$ USD — US dollar" },
  { code: "eur", label: "€ EUR — Euro" },
  { code: "aud", label: "A$ AUD — Australian dollar" },
  { code: "cad", label: "C$ CAD — Canadian dollar" },
  { code: "chf", label: "CHF — Swiss franc" },
  { code: "nzd", label: "NZ$ NZD — New Zealand dollar" },
  { code: "sek", label: "kr SEK — Swedish krona" },
  { code: "nok", label: "kr NOK — Norwegian krone" },
  { code: "dkk", label: "kr DKK — Danish krone" },
  { code: "pln", label: "zł PLN — Polish złoty" },
  { code: "czk", label: "Kč CZK — Czech koruna" },
  { code: "ils", label: "₪ ILS — Israeli shekel" },
  { code: "aed", label: "د.إ AED — UAE dirham" },
] as const;

const ALLOWED: ReadonlySet<string> = new Set(PRODUCT_CURRENCY_OPTIONS.map((o) => o.code));

export function normalizeProductCurrency(raw: string | null | undefined): string {
  const c = (raw ?? "gbp").trim().toLowerCase();
  return ALLOWED.has(c) ? c : "gbp";
}

export function isAllowedProductCurrency(raw: string): boolean {
  return ALLOWED.has(raw.trim().toLowerCase());
}

/** Parse a display/CSV amount to minor units (2 decimal places). */
export function parsePriceAmountToMinor(raw: string | undefined): { minor: number } | { error: string } {
  const t = (raw ?? "").trim();
  if (!t) return { minor: 0 };
  let s = t.replace(/[£$€₹¥₽\u00A0\s]/gu, "");
  if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n < 0) return { error: "Invalid price" };
  return { minor: Math.round(n * 100) };
}

export function formatProductPriceMinor(minor: number, currencyCode: string, locale = "en-GB"): string {
  const code = normalizeProductCurrency(currencyCode).toUpperCase();
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${code}`;
  }
}
