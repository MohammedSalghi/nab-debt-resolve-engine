import { create } from "zustand";
import {
  DEFAULT_WEIGHTS,
  computeScore,
  dpdToRisk,
  seedActivities,
  seedCollateral,
  seedCustomers,
  seedLegal,
  seedLoans,
  seedNotifications,
  seedUsers,
  type RiskClass,
} from "./mock-data";

export type Customer = (typeof seedCustomers)[number];
export type Loan = (typeof seedLoans)[number];
export type Activity = (typeof seedActivities)[number];
export type LegalCase = (typeof seedLegal)[number];
export type Collateral = (typeof seedCollateral)[number];
export type Notification = (typeof seedNotifications)[number];
export type User = (typeof seedUsers)[number];
export type Weights = typeof DEFAULT_WEIGHTS;

export type AuditEntry = { id: number; ts: string; user: string; action: string };

type State = {
  customers: Customer[];
  loans: Loan[];
  activities: Activity[];
  legal: LegalCase[];
  collateral: Collateral[];
  notifications: Notification[];
  users: User[];
  weights: Weights;
  audit: AuditEntry[];

  // customers
  addCustomer: (c: Omit<Customer, "id" | "score" | "risk" | "createdAt" | "loans" | "debt"> & { debt?: number; loans?: number }) => Customer;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  removeCustomer: (id: string) => void;

  // loans
  addLoan: (l: Omit<Loan, "id" | "balance" | "status">) => Loan;
  recordPayment: (loanId: string, amount: number) => void;
  reschedule: (loanId: string, newTerm: number, newRate: number) => void;
  referToLegal: (loanId: string, reason: string) => LegalCase | null;

  // activities (kanban)
  addActivity: (a: Omit<Activity, "id" | "date">) => void;
  moveActivity: (id: number, stage: Activity["stage"]) => void;

  // legal
  addLegalCase: (c: Omit<LegalCase, "id" | "openedAt">) => LegalCase;
  updateLegalStage: (id: string, stage: string) => void;

  // collateral
  addCollateral: (c: Omit<Collateral, "id" | "status">) => void;
  reappraise: (id: string, newValue: number) => void;

  // notifications
  markAllRead: () => void;
  markRead: (id: number) => void;

  // admin
  setWeights: (w: Weights) => void;
  addUser: (u: Omit<User, "id">) => void;
  toggleUser: (id: number) => void;
  logAudit: (action: string) => void;
};

let nextActivityId = seedActivities.length + 1;
let nextNotificationId = seedNotifications.length + 1;
let nextUserId = seedUsers.length + 1;
let nextLegalId = seedLegal.length + 1;
let nextCollateralId = seedCollateral.length + 1;
let nextAuditId = 1;

function recomputeCustomer(c: Customer, loans: Loan[], weights: Weights): Customer {
  const own = loans.filter((l) => l.customerId === c.id);
  const debt = own.reduce((s, l) => s + l.balance, 0);
  const dpd = own.reduce((m, l) => Math.max(m, l.dpd), 0);
  const score = computeScore({ dpd, overdue: debt * 0.1, lateCount: Math.floor(dpd / 30), years: 5, products: own.length }, weights);
  return { ...c, debt, dpd, loans: own.length, score, risk: dpdToRisk(dpd) };
}

export const useStore = create<State>((set, get) => ({
  customers: seedCustomers,
  loans: seedLoans,
  activities: seedActivities,
  legal: seedLegal,
  collateral: seedCollateral,
  notifications: seedNotifications,
  users: seedUsers,
  weights: DEFAULT_WEIGHTS,
  audit: [],

  addCustomer: (c) => {
    const id = `C-${1000 + get().customers.length + Math.floor(Math.random() * 9000)}`;
    const newC: Customer = {
      id,
      name: c.name,
      type: c.type,
      branch: c.branch,
      nationalId: c.nationalId,
      phone: c.phone,
      score: 75,
      risk: "good",
      debt: c.debt ?? 0,
      loans: c.loans ?? 0,
      dpd: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    set((s) => ({ customers: [newC, ...s.customers] }));
    get().logAudit(`إضافة عميل ${newC.name}`);
    return newC;
  },
  updateCustomer: (id, patch) => {
    set((s) => ({ customers: s.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
    get().logAudit(`تعديل بيانات ${id}`);
  },
  removeCustomer: (id) => {
    set((s) => ({ customers: s.customers.filter((c) => c.id !== id) }));
    get().logAudit(`حذف العميل ${id}`);
  },

  addLoan: (l) => {
    const id = `L-${20000 + get().loans.length + Math.floor(Math.random() * 9000)}`;
    const newL: Loan = { ...l, id, balance: l.amount, status: "نشط" };
    set((s) => {
      const loans = [newL, ...s.loans];
      const customers = s.customers.map((c) => (c.id === l.customerId ? recomputeCustomer(c, loans, s.weights) : c));
      return { loans, customers };
    });
    get().logAudit(`إضافة قرض ${id} للعميل ${l.customerId}`);
    return newL;
  },
  recordPayment: (loanId, amount) => {
    set((s) => {
      const loans = s.loans.map((l) => (l.id === loanId ? { ...l, balance: Math.max(0, l.balance - amount), dpd: 0, status: "نشط" } : l));
      const target = loans.find((l) => l.id === loanId);
      const customers = target ? s.customers.map((c) => (c.id === target.customerId ? recomputeCustomer(c, loans, s.weights) : c)) : s.customers;
      return { loans, customers };
    });
    get().logAudit(`تسجيل دفعة ${amount} للقرض ${loanId}`);
  },
  reschedule: (loanId, newTerm, newRate) => {
    set((s) => ({ loans: s.loans.map((l) => (l.id === loanId ? { ...l, term: newTerm, rate: newRate, dpd: 0, status: "نشط" } : l)) }));
    get().logAudit(`إعادة جدولة القرض ${loanId}`);
  },
  referToLegal: (loanId, reason) => {
    const loan = get().loans.find((l) => l.id === loanId);
    if (!loan) return null;
    const id = `LC-2025-${100 + nextLegalId++}`;
    const newCase: LegalCase = {
      id,
      customerId: loan.customerId,
      customer: loan.customer,
      loan: loanId,
      court: "المحكمة التجارية - طرابلس",
      lawyer: "م. خالد السنوسي",
      stage: "مفتوحة",
      openedAt: new Date().toISOString().slice(0, 10),
      nextHearing: "—",
    };
    set((s) => ({
      legal: [newCase, ...s.legal],
      loans: s.loans.map((l) => (l.id === loanId ? { ...l, status: "قانوني" } : l)),
    }));
    get().logAudit(`إحالة قانونية للقرض ${loanId} — ${reason}`);
    return newCase;
  },

  addActivity: (a) => {
    const id = nextActivityId++;
    const date = new Date().toISOString().slice(0, 16).replace("T", " ");
    set((s) => ({ activities: [{ ...a, id, date }, ...s.activities] }));
    get().logAudit(`نشاط تحصيل: ${a.action} للعميل ${a.customer}`);
  },
  moveActivity: (id, stage) => {
    set((s) => ({ activities: s.activities.map((a) => (a.id === id ? { ...a, stage } : a)) }));
  },

  addLegalCase: (c) => {
    const id = `LC-2025-${100 + nextLegalId++}`;
    const newC: LegalCase = { ...c, id, openedAt: new Date().toISOString().slice(0, 10) };
    set((s) => ({ legal: [newC, ...s.legal] }));
    get().logAudit(`إضافة قضية ${id}`);
    return newC;
  },
  updateLegalStage: (id, stage) => {
    set((s) => ({ legal: s.legal.map((c) => (c.id === id ? { ...c, stage } : c)) }));
    get().logAudit(`تحديث مرحلة القضية ${id} → ${stage}`);
  },

  addCollateral: (c) => {
    const id = `CL-${500 + nextCollateralId++}`;
    set((s) => ({ collateral: [{ ...c, id, status: "نشط" }, ...s.collateral] }));
    get().logAudit(`إضافة ضمان ${id}`);
  },
  reappraise: (id, newValue) => {
    set((s) => ({ collateral: s.collateral.map((c) => (c.id === id ? { ...c, value: newValue, evaluatedAt: new Date().toISOString().slice(0, 10) } : c)) }));
    get().logAudit(`إعادة تقييم الضمان ${id} → ${newValue}`);
  },

  markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, unread: false })) })),
  markRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, unread: false } : n)) })),

  setWeights: (w) => {
    set((s) => {
      const customers = s.customers.map((c) => recomputeCustomer(c, s.loans, w));
      return { weights: w, customers };
    });
    get().logAudit("تحديث أوزان تقييم المخاطر");
  },
  addUser: (u) => {
    set((s) => ({ users: [{ ...u, id: nextUserId++ }, ...s.users] }));
    get().logAudit(`إضافة مستخدم ${u.name}`);
  },
  toggleUser: (id) => {
    set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, status: u.status === "نشط" ? "موقوف" : "نشط" } : u)) }));
  },
  logAudit: (action) => {
    set((s) => ({ audit: [{ id: nextAuditId++, ts: new Date().toISOString().slice(0, 16).replace("T", " "), user: "أحمد العتيبي", action }, ...s.audit].slice(0, 200) }));
  },
}));

// Selectors / derived metrics
export function useKPIs() {
  const { customers, loans, legal } = useStore();
  const portfolio = loans.reduce((s, l) => s + l.amount, 0);
  const outstanding = loans.reduce((s, l) => s + l.balance, 0);
  const overdue = loans.filter((l) => l.dpd > 0).reduce((s, l) => s + l.balance, 0);
  const npl = loans.filter((l) => l.dpd > 90).reduce((s, l) => s + l.balance, 0);
  const nplPct = outstanding ? (npl / outstanding) * 100 : 0;
  const collected = portfolio - outstanding;
  const collectionPct = portfolio ? (collected / portfolio) * 100 : 0;
  const active = customers.filter((c) => c.dpd <= 30).length;
  const defaulters = customers.filter((c) => c.dpd > 90).length;
  const openLegal = legal.filter((c) => c.stage !== "إغلاق").length;
  return { portfolio, outstanding, overdue, nplPct, collectionPct, active, defaulters, openLegal, totalCustomers: customers.length };
}

export function useRiskDistribution() {
  const { customers } = useStore();
  const counts: Record<RiskClass, number> = { good: 0, watch: 0, sub: 0, doubt: 0, loss: 0 };
  customers.forEach((c) => (counts[c.risk] += 1));
  const total = customers.length || 1;
  return (["good", "watch", "sub", "doubt", "loss"] as RiskClass[]).map((k) => ({
    key: k,
    name: { good: "جيد", watch: "مراقبة", sub: "دون المعيار", doubt: "مشكوك فيه", loss: "خسارة" }[k],
    value: Math.round((counts[k] / total) * 100),
    count: counts[k],
  }));
}

export function useDebtAging() {
  const { loans } = useStore();
  const buckets = [
    { bucket: "1-30 يوم", min: 1, max: 30, tone: "watch" },
    { bucket: "31-60 يوم", min: 31, max: 60, tone: "sub" },
    { bucket: "61-90 يوم", min: 61, max: 90, tone: "sub" },
    { bucket: "91-180 يوم", min: 91, max: 180, tone: "doubt" },
    { bucket: "180+ يوم", min: 181, max: 99999, tone: "loss" },
  ];
  return buckets.map((b) => {
    const value = loans.filter((l) => l.dpd >= b.min && l.dpd <= b.max).reduce((s, l) => s + l.balance, 0);
    return { ...b, value };
  });
}

export function useBranchPerf() {
  const { customers, loans } = useStore();
  const map = new Map<string, { name: string; portfolio: number; overdue: number; outstanding: number; collected: number }>();
  for (const l of loans) {
    const b = map.get(l.branch) ?? { name: l.branch, portfolio: 0, overdue: 0, outstanding: 0, collected: 0 };
    b.portfolio += l.amount;
    b.outstanding += l.balance;
    b.collected += l.amount - l.balance;
    if (l.dpd > 90) b.overdue += l.balance;
    map.set(l.branch, b);
  }
  return Array.from(map.values()).map((b) => ({
    name: b.name,
    portfolio: b.portfolio,
    npl: b.outstanding ? (b.overdue / b.outstanding) * 100 : 0,
    collection: b.portfolio ? (b.collected / b.portfolio) * 100 : 0,
    customers: customers.filter((c) => c.branch === b.name).length,
    status: (b.outstanding ? (b.overdue / b.outstanding) * 100 : 0) > 5 ? ("loss" as RiskClass) : (b.outstanding ? (b.overdue / b.outstanding) * 100 : 0) > 3 ? ("sub" as RiskClass) : ("good" as RiskClass),
  }));
}