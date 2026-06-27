/**
 * Client helper for the Mock Core Banking System.
 * Replace BASE_URL with your real bank's CBS endpoint when going live,
 * and add an Authorization header from a secret stored via add_secret.
 */

export type BankCustomer = {
  source: string;
  fetchedAt: string;
  customer: {
    nationalId: string;
    name: string;
    type: "فرد" | "شركة";
    phone: string;
    email: string;
    dob: string;
    gender: string;
    branch: string;
    address: string;
    kycStatus: string;
    occupation: string;
    employer: string;
    monthlyIncome: number;
    registeredAt: string;
  };
  accounts: Array<{
    number: string;
    iban: string;
    type: string;
    balance: number;
    currency: string;
    openedAt: string;
    status: string;
  }>;
  creditProfile: {
    bureauScore: number;
    bureauGrade: string;
    existingDebt: number;
    activeLoans: number;
    dti: number;
    latePayments12m: number;
    defaultsHistory: number;
  };
  flags: { sanctionsHit: boolean; pep: boolean; blacklist: boolean };
};

const BASE_URL = "/api/public/core-banking";

export async function fetchBankCustomer(nationalId: string): Promise<BankCustomer> {
  const res = await fetch(`${BASE_URL}/customer/${encodeURIComponent(nationalId)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "تعذر الاتصال بالنظام البنكي" }));
    throw new Error(body.message || `HTTP ${res.status}`);
  }
  return res.json();
}
