export type RiskClass = "good" | "watch" | "sub" | "doubt" | "loss";

export const riskLabels: Record<RiskClass, string> = {
  good: "جيد",
  watch: "تحت المراقبة",
  sub: "دون المعيار",
  doubt: "مشكوك فيه",
  loss: "خسارة",
};

export const LIBYAN_BRANCHES = [
  "طرابلس الرئيسي",
  "بنغازي",
  "مصراتة",
  "الزاوية",
  "سبها",
  "البيضاء",
  "طبرق",
  "سرت",
];

export const LOAN_TYPES = ["تمويل تجاري", "قرض شخصي", "تمويل عقاري", "قرض سيارة", "خط ائتمان", "تمويل صغير"];
export const LEGAL_STAGES = ["مفتوحة", "في المحكمة", "حكم", "تنفيذ", "إغلاق"];
export const COLLATERAL_TYPES = ["عقار", "سيارة", "كفالة", "نقدي"];

export function dpdToBucket(dpd: number): string {
  if (dpd <= 0) return "—";
  if (dpd <= 30) return "1-30";
  if (dpd <= 60) return "31-60";
  if (dpd <= 90) return "61-90";
  if (dpd <= 180) return "91-180";
  return "180+";
}

export function dpdToRisk(dpd: number): RiskClass {
  if (dpd <= 0) return "good";
  if (dpd <= 30) return "watch";
  if (dpd <= 60) return "sub";
  if (dpd <= 180) return "doubt";
  return "loss";
}

/** Compute credit score (0-100) from inputs via weighted formula. */
export function computeScore(input: {
  dpd: number;
  dti?: number; // 0..1
  overdue?: number; // د.ل
  lateCount?: number;
  reschedules?: number;
  years?: number;
  products?: number;
}, weights: Record<string, number> = DEFAULT_WEIGHTS): number {
  const n = (v: number, max: number) => Math.max(0, Math.min(1, v / max));
  const s =
    100 -
    weights.dpd * n(input.dpd, 180) * 100 -
    weights.dti * n(input.dti ?? 0.4, 1) * 100 -
    weights.overdue * n(input.overdue ?? 0, 500_000) * 100 -
    weights.late * n(input.lateCount ?? 0, 12) * 100 -
    weights.resch * (input.reschedules ?? 0 > 0 ? 100 : 0) +
    weights.years * n(input.years ?? 5, 20) * 100 +
    weights.products * n(input.products ?? 1, 6) * 100;
  return Math.max(0, Math.min(100, Math.round(s)));
}

export const DEFAULT_WEIGHTS = {
  dpd: 0.3,
  dti: 0.2,
  overdue: 0.15,
  late: 0.1,
  resch: 0.1,
  years: 0.07,
  products: 0.05,
  behavior: 0.03,
};

const FIRST_NAMES = ["محمد", "أحمد", "علي", "خالد", "سالم", "عبدالله", "حسين", "مصطفى", "إبراهيم", "يوسف", "عمر", "فاطمة", "عائشة", "خديجة", "نور", "هناء", "سلمى", "ليلى"];
const LAST_NAMES = ["القذافي", "المغربي", "الترهوني", "بن غازي", "المصراتي", "الزاوي", "الورفلي", "الفيتوري", "الأوجلي", "السنوسي", "بن نصر", "العبيدي", "الفرجاني"];
const COMPANIES = ["شركة الواحة للمقاولات", "مؤسسة النور التجارية", "شركة الأمل للنقل", "مجموعة طرابلس للاستثمار", "شركة الصحراء للبترول", "مؤسسة البحر المتوسط", "شركة الفجر الجديد", "مجموعة بنغازي التجارية", "شركة سبها للزراعة", "مؤسسة سرت الصناعية"];

function seedRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rnd = seedRand(42);
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

// Generate 30 customers
function genCustomers() {
  const arr: {
    id: string;
    name: string;
    type: "فرد" | "شركة";
    branch: string;
    nationalId: string;
    phone: string;
    score: number;
    risk: RiskClass;
    debt: number;
    loans: number;
    dpd: number;
    createdAt: string;
  }[] = [];
  for (let i = 0; i < 30; i++) {
    const isCompany = rnd() < 0.4;
    const name = isCompany ? pick(COMPANIES) + ` ${i + 1}` : `${pick(FIRST_NAMES)} ${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    // distribute DPD: 60% healthy, 15% 1-30, 10% 31-60, 8% 61-90, 5% 91-180, 2% 180+
    const r = rnd();
    let dpd = 0;
    if (r > 0.6 && r <= 0.75) dpd = Math.floor(rnd() * 30) + 1;
    else if (r > 0.75 && r <= 0.85) dpd = Math.floor(rnd() * 30) + 31;
    else if (r > 0.85 && r <= 0.93) dpd = Math.floor(rnd() * 30) + 61;
    else if (r > 0.93 && r <= 0.98) dpd = Math.floor(rnd() * 90) + 91;
    else if (r > 0.98) dpd = Math.floor(rnd() * 120) + 181;
    const debt = isCompany ? Math.round((rnd() * 8_000_000 + 500_000)) : Math.round(rnd() * 200_000 + 10_000);
    const loans = isCompany ? Math.floor(rnd() * 4) + 1 : Math.floor(rnd() * 2) + 1;
    const score = computeScore({ dpd, overdue: dpd > 0 ? debt * 0.1 : 0, lateCount: dpd > 0 ? Math.floor(dpd / 30) : 0, years: Math.floor(rnd() * 15) + 1, products: loans + Math.floor(rnd() * 3) });
    const risk = dpdToRisk(dpd);
    arr.push({
      id: `C-${1000 + i}`,
      name,
      type: isCompany ? "شركة" : "فرد",
      branch: pick(LIBYAN_BRANCHES),
      nationalId: String(119000000000 + i * 13571).slice(0, 12),
      phone: `09${Math.floor(10000000 + rnd() * 89999999)}`,
      score,
      risk,
      debt,
      loans,
      dpd,
      createdAt: `2024-${String(Math.floor(rnd() * 11) + 1).padStart(2, "0")}-${String(Math.floor(rnd() * 28) + 1).padStart(2, "0")}`,
    });
  }
  return arr;
}

export const seedCustomers = genCustomers();

function genLoans() {
  const out: {
    id: string;
    customer: string;
    customerId: string;
    type: string;
    branch: string;
    amount: number;
    balance: number;
    rate: number;
    term: number;
    status: string;
    dpd: number;
    disbursedAt: string;
    officer: string;
  }[] = [];
  let i = 0;
  for (const c of seedCustomers) {
    for (let j = 0; j < c.loans; j++) {
      i++;
      const amount = c.type === "شركة" ? Math.round(rnd() * 5_000_000 + 200_000) : Math.round(rnd() * 200_000 + 20_000);
      const balance = Math.round(amount * (0.3 + rnd() * 0.6));
      const dpd = j === 0 ? c.dpd : Math.max(0, c.dpd - Math.floor(rnd() * 30));
      let status = "نشط";
      if (dpd > 180) status = "قانوني";
      else if (dpd > 90) status = "متعثر";
      else if (dpd > 0) status = "متأخر";
      out.push({
        id: `L-${20000 + i}`,
        customer: c.name,
        customerId: c.id,
        type: pick(LOAN_TYPES),
        branch: c.branch,
        amount,
        balance,
        rate: Math.round((4 + rnd() * 8) * 10) / 10,
        term: pick([12, 24, 36, 48, 60, 84, 120, 240]),
        status,
        dpd,
        disbursedAt: `2023-${String(Math.floor(rnd() * 11) + 1).padStart(2, "0")}-${String(Math.floor(rnd() * 28) + 1).padStart(2, "0")}`,
        officer: pick(["أحمد الزهراني", "نوف القحطاني", "سامي البلوي", "هند العبيدي"]),
      });
      if (out.length >= 55) return out;
    }
  }
  return out;
}

export const seedLoans = genLoans();

function genActivities() {
  const actions = ["مكالمة هاتفية", "تذكير SMS", "زيارة ميدانية", "وعد بالدفع", "إحالة قانونية", "تسوية"];
  const outcomes = ["وعد بالدفع", "أُرسل", "لا رد", "تمت التسوية", "تم التحصيل جزئياً", "محول للقانوني"];
  const lateCustomers = seedCustomers.filter((c) => c.dpd > 0);
  return Array.from({ length: 35 }).map((_, i) => {
    const c = lateCustomers[i % lateCustomers.length] ?? seedCustomers[0];
    const d = new Date(2025, 4, 1 + (i % 30), 9 + (i % 8), (i * 7) % 60);
    return {
      id: i + 1,
      customerId: c.id,
      customer: c.name,
      action: actions[i % actions.length],
      agent: pick(["أحمد الزهراني", "نوف القحطاني", "سامي البلوي", "هند العبيدي"]),
      date: d.toISOString().slice(0, 16).replace("T", " "),
      note: "تابع المتابعة حسب البروتوكول",
      outcome: outcomes[i % outcomes.length],
      stage: i % 4 === 0 ? "todo" : i % 4 === 1 ? "calling" : i % 4 === 2 ? "promised" : "escalated",
    };
  });
}
export const seedActivities = genActivities();

function genLegal() {
  const stages = LEGAL_STAGES;
  const lawyers = ["م. خالد السنوسي", "م. نواف الورفلي", "م. سارة الفرجاني", "م. عمر الترهوني"];
  const courts = ["المحكمة التجارية - طرابلس", "محكمة التنفيذ - بنغازي", "محكمة الاستئناف - مصراتة", "المحكمة العامة - الزاوية"];
  const highRisk = seedCustomers.filter((c) => c.dpd > 90);
  return highRisk.slice(0, 10).map((c, i) => ({
    id: `LC-2025-${100 + i}`,
    customerId: c.id,
    customer: c.name,
    loan: seedLoans.find((l) => l.customerId === c.id)?.id ?? "—",
    court: courts[i % courts.length],
    lawyer: lawyers[i % lawyers.length],
    stage: stages[i % stages.length],
    openedAt: `2024-${String((i % 12) + 1).padStart(2, "0")}-${String((i * 3 + 1) % 28).padStart(2, "0")}`,
    nextHearing: `2025-${String(((i + 1) % 12) + 1).padStart(2, "0")}-15`,
  }));
}
export const seedLegal = genLegal();

function genCollateral() {
  return seedLoans.slice(0, 18).map((l, i) => ({
    id: `CL-${500 + i}`,
    type: COLLATERAL_TYPES[i % COLLATERAL_TYPES.length],
    value: Math.round(l.balance * (0.8 + (i % 5) * 0.1)),
    customerId: l.customerId,
    customer: l.customer,
    loan: l.id,
    evaluatedAt: `2024-${String((i % 12) + 1).padStart(2, "0")}-12`,
    status: i % 7 === 0 ? "قيد التنفيذ" : "نشط",
  }));
}
export const seedCollateral = genCollateral();

export const seedNotifications = [
  { id: 1, title: "تنبيه مخاطر عالية", body: "العميل C-1015 تجاوز حدود التعثر", type: "تنبيهات", time: "قبل 12 دقيقة", unread: true },
  { id: 2, title: "قسط مستحق غدًا", body: "قرض L-20007 - مجموعة طرابلس", type: "تذكيرات", time: "قبل 45 دقيقة", unread: true },
  { id: 3, title: "تحديث قضية", body: "LC-2025-103 - جلسة جديدة 21 يوليو", type: "تنبيهات", time: "قبل ساعتين", unread: true },
  { id: 4, title: "تقرير شهري جاهز", body: "تقرير أداء التحصيل - يونيو 2025", type: "تذكيرات", time: "أمس", unread: false },
  { id: 5, title: "إعادة جدولة قرض", body: "تمت إعادة جدولة L-20012", type: "تنبيهات", time: "أمس", unread: false },
];

export const seedUsers = [
  { id: 1, name: "أحمد العتيبي", role: "مدير المخاطر", branch: "طرابلس الرئيسي", status: "نشط" as "نشط" | "موقوف" },
  { id: 2, name: "نوف القحطاني", role: "مسؤول قانوني", branch: "طرابلس الرئيسي", status: "نشط" as const },
  { id: 3, name: "سامي البلوي", role: "محصل", branch: "بنغازي", status: "نشط" as const },
  { id: 4, name: "هند الزهراني", role: "محلل ائتمان", branch: "مصراتة", status: "موقوف" as const },
  { id: 5, name: "علي السنوسي", role: "مدير فرع", branch: "سبها", status: "نشط" as const },
];

// 12 months trend
export const collectionTrend = [
  { m: "أغسطس", تحصيل: 88.4, تعثر: 3.4 },
  { m: "سبتمبر", تحصيل: 89.5, تعثر: 3.5 },
  { m: "أكتوبر", تحصيل: 90.1, تعثر: 3.3 },
  { m: "نوفمبر", تحصيل: 91.4, تعثر: 3.2 },
  { m: "ديسمبر", تحصيل: 92.6, تعثر: 3.18 },
  { m: "يناير", تحصيل: 92.1, تعثر: 3.25 },
  { m: "فبراير", تحصيل: 93.1, تعثر: 3.15 },
  { m: "مارس", تحصيل: 93.6, تعثر: 3.12 },
  { m: "أبريل", تحصيل: 93.9, تعثر: 3.18 },
  { m: "مايو", تحصيل: 94.0, تعثر: 3.14 },
  { m: "يونيو", تحصيل: 94.2, تعثر: 3.1 },
  { m: "يوليو", تحصيل: 94.5, تعثر: 3.05 },
];

export const alerts = [
  { id: 1, customerId: "C-1015", title: "تجاوز الحد الائتماني", customer: "شركة الأمل للنقل 5", time: "14:12", severity: "high" as const, desc: "تجاوز الرصيد المتاح بنسبة 12%" },
  { id: 2, customerId: "C-1003", title: "تأخر قسط > 30 يوم", customer: "محمد الترهوني", time: "12:45", severity: "medium" as const, desc: "DPD = 34 يوم على قرض شخصي" },
  { id: 3, customerId: "C-1008", title: "انخفاض في التقييم", customer: "مجموعة طرابلس 8", time: "11:20", severity: "medium" as const, desc: "هبط التقييم من 78 إلى 62" },
  { id: 4, customerId: "C-1020", title: "إحالة قانونية جديدة", customer: "شركة الصحراء 20", time: "10:20", severity: "high" as const, desc: "بدء إجراءات التنفيذ" },
  { id: 5, customerId: "C-1011", title: "وعد بالدفع مكسور", customer: "علي الورفلي", time: "09:05", severity: "low" as const, desc: "لم يلتزم بموعد السداد" },
];