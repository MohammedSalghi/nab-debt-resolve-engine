import { createFileRoute } from "@tanstack/react-router";

/**
 * Mock Core Banking API.
 * Public, read-only, deterministic. Returns a synthesized customer
 * profile keyed on national ID — same ID always returns the same data.
 *
 * Swap the body of this handler with a real fetch() to the bank's CBS
 * (Temenos / Finacle / FlexCube / in-house) to go live.
 */

const FIRST_NAMES = ["محمد", "أحمد", "علي", "خالد", "سالم", "عبدالله", "حسين", "مصطفى", "إبراهيم", "يوسف", "عمر", "فاطمة", "عائشة", "نور", "هناء", "سلمى", "ليلى", "مريم"];
const LAST_NAMES = ["القذافي", "المغربي", "الترهوني", "بن غازي", "المصراتي", "الزاوي", "الورفلي", "الفيتوري", "السنوسي", "العبيدي", "الفرجاني"];
const BRANCHES = ["طرابلس الرئيسي", "بنغازي", "مصراتة", "الزاوية", "سبها", "البيضاء", "طبرق", "سرت"];
const OCCUPATIONS = ["موظف حكومي", "مهندس", "طبيب", "محاسب", "تاجر", "معلم", "ضابط", "مدير", "صاحب عمل حر"];
const EMPLOYERS = ["وزارة المالية", "شركة النفط الوطنية", "وزارة الصحة", "بنك ليبيا المركزي", "شركة الاتصالات", "وزارة التعليم", "خاص"];
const ACCOUNT_TYPES = ["جاري", "توفير", "وديعة لأجل", "راتب"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function seeded(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function pick<T>(rnd: () => number, arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

function buildProfile(nationalId: string) {
  const seed = hash(nationalId);
  const rnd = seeded(seed);
  const isCompany = nationalId.startsWith("9");
  const first = pick(rnd, FIRST_NAMES);
  const last = pick(rnd, LAST_NAMES);
  const name = isCompany ? `شركة ${last} للتجارة` : `${first} ${last}`;
  const branch = pick(rnd, BRANCHES);
  const phone = `09${Math.floor(10000000 + rnd() * 89999999)}`;
  const dob = new Date(1960 + Math.floor(rnd() * 45), Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27))
    .toISOString().slice(0, 10);

  const accountsCount = 1 + Math.floor(rnd() * 3);
  const accounts = Array.from({ length: accountsCount }, (_, i) => {
    const num = `0${20 + Math.floor(rnd() * 79)}-${Math.floor(100000 + rnd() * 899999)}-${i + 1}`;
    const iban = `LY${Math.floor(10 + rnd() * 89)}${num.replace(/-/g, "")}${Math.floor(1000 + rnd() * 8999)}`.slice(0, 25);
    return {
      number: num,
      iban,
      type: pick(rnd, ACCOUNT_TYPES),
      balance: Math.floor(rnd() * 250000),
      currency: "LYD",
      openedAt: new Date(2015 + Math.floor(rnd() * 9), Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27))
        .toISOString().slice(0, 10),
      status: rnd() > 0.08 ? "نشط" : "مغلق",
    };
  });

  const monthlyIncome = isCompany ? 0 : Math.floor(2000 + rnd() * 18000);
  const existingDebt = Math.floor(rnd() * 400000);
  const creditBureauScore = Math.floor(400 + rnd() * 450); // 400-850
  const dti = monthlyIncome ? Math.min(0.9, (existingDebt * 0.04) / monthlyIncome) : 0.3;

  return {
    source: "MOCK-CBS-v1",
    fetchedAt: new Date().toISOString(),
    customer: {
      nationalId,
      name,
      type: isCompany ? "شركة" : "فرد",
      phone,
      email: `${nationalId.slice(-6)}@example.ly`,
      dob,
      gender: rnd() > 0.5 ? "ذكر" : "أنثى",
      branch,
      address: `${pick(rnd, ["شارع جمال عبد الناصر", "طريق المطار", "شارع الزاوية", "شارع طرابلس"])}, ${branch}`,
      kycStatus: rnd() > 0.1 ? "موثّق" : "بانتظار التحديث",
      occupation: isCompany ? "—" : pick(rnd, OCCUPATIONS),
      employer: isCompany ? "—" : pick(rnd, EMPLOYERS),
      monthlyIncome,
      registeredAt: new Date(2010 + Math.floor(rnd() * 14), Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27))
        .toISOString().slice(0, 10),
    },
    accounts,
    creditProfile: {
      bureauScore: creditBureauScore,
      bureauGrade:
        creditBureauScore >= 750 ? "ممتاز" :
        creditBureauScore >= 650 ? "جيد جداً" :
        creditBureauScore >= 550 ? "جيد" :
        creditBureauScore >= 450 ? "مقبول" : "ضعيف",
      existingDebt,
      activeLoans: Math.floor(rnd() * 4),
      dti: Math.round(dti * 100) / 100,
      latePayments12m: Math.floor(rnd() * 6),
      defaultsHistory: rnd() > 0.85 ? 1 : 0,
    },
    flags: {
      sanctionsHit: rnd() > 0.98,
      pep: rnd() > 0.95,
      blacklist: rnd() > 0.97,
    },
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const Route = createFileRoute("/api/public/core-banking/customer/$nationalId")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ params }) => {
        const nid = String(params.nationalId || "").trim();
        if (!/^\d{8,14}$/.test(nid)) {
          return new Response(
            JSON.stringify({ error: "INVALID_NATIONAL_ID", message: "الرقم الوطني غير صالح (8-14 رقماً)" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
          );
        }
        // Deterministic "not found" for IDs ending in 0000
        if (nid.endsWith("0000")) {
          return new Response(
            JSON.stringify({ error: "NOT_FOUND", message: "لا يوجد عميل بهذا الرقم في النظام البنكي المركزي" }),
            { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
          );
        }
        // Simulate network latency 150-400ms
        await new Promise((r) => setTimeout(r, 150 + Math.random() * 250));
        return new Response(JSON.stringify(buildProfile(nid)), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      },
    },
  },
});
