// Western numeral formatters. Force en-US locale to guarantee 0-9 digits
// even when the document lang is Arabic.
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const CURRENCY = "د.ل";

/** Format integer with thousand separators using Western digits. */
export function fmtInt(n: number): string {
  return nf0.format(Math.round(n));
}

/** Format with 2 decimals (for installments / rates). */
export function fmt2(n: number): string {
  return nf2.format(n);
}

export function fmt1(n: number): string {
  return nf1.format(n);
}

/** Currency in Libyan Dinar. Whole numbers by default, 2dp when fraction. */
export function fmtCurrency(n: number, decimals?: 0 | 2): string {
  const d = decimals ?? (Number.isInteger(n) ? 0 : 2);
  const s = d === 0 ? nf0.format(Math.round(n)) : nf2.format(n);
  return `${s} ${CURRENCY}`;
}

/** Millions د.ل short format: 1.42M د.ل */
export function fmtMillions(amount: number): string {
  if (amount >= 1_000_000_000) return `${nf2.format(amount / 1_000_000_000)} مليار ${CURRENCY}`;
  if (amount >= 1_000_000) return `${nf2.format(amount / 1_000_000)} مليون ${CURRENCY}`;
  if (amount >= 1_000) return `${nf0.format(amount / 1_000)} ألف ${CURRENCY}`;
  return fmtCurrency(amount);
}

export function fmtPct(n: number, decimals = 2): string {
  return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n)}%`;
}

export function fmtDPD(dpd: number): string {
  return `${nf0.format(dpd)} يوم`;
}

export function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function fmtDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${fmtDate(date)} ${hh}:${mi}`;
}

export function today(): string {
  return fmtDate(new Date());
}