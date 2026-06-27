import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Activity, TrendingUp, TrendingDown, AlertTriangle, Target, PieChart as PieIcon } from "lucide-react";
import { AppShell, Card, PageHeader, RiskBadge } from "@/components/app-shell";
import { useBranchPerf, useDebtAging, useKPIs, useRiskDistribution, useStore } from "@/lib/store";
import { LOAN_TYPES, riskLabels, type RiskClass } from "@/lib/mock-data";
import { fmtCurrency, fmtInt, fmtMillions, fmtPct, today } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "التحليلات المتقدمة — نظام الائتمان البنكي" },
      { name: "description", content: "تحليلات معمقة للمحفظة، الاتجاهات الزمنية، أداء الفروع، ومخاطر التركيز." },
    ],
  }),
  component: AnalyticsPage,
});

const riskColors: Record<RiskClass, string> = {
  good: "var(--risk-good)",
  watch: "var(--risk-watch)",
  sub: "var(--risk-sub)",
  doubt: "var(--risk-doubt)",
  loss: "var(--risk-loss)",
};
const typeColors = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#8b5cf6", "#0891b2"];

const RANGES = [
  { id: "30", label: "30 يوم" },
  { id: "90", label: "90 يوم" },
  { id: "180", label: "6 أشهر" },
  { id: "365", label: "12 شهر" },
] as const;

function AnalyticsPage() {
  const kpis = useKPIs();
  const dist = useRiskDistribution();
  const aging = useDebtAging();
  const branches = useBranchPerf();
  const { loans, customers } = useStore();
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("180");

  // ---- 12/6/3/1-month synthetic trend derived from real portfolio
  const trend = useMemo(() => {
    const months = range === "30" ? 1 : range === "90" ? 3 : range === "180" ? 6 : 12;
    const totalPortfolio = kpis.portfolio;
    const totalOutstanding = kpis.outstanding;
    const totalOverdue = kpis.overdue;
    const seed = totalPortfolio || 1;
    const out: { month: string; portfolio: number; outstanding: number; overdue: number; collected: number; par30: number }[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.toLocaleDateString("ar-LY", { month: "short", year: "2-digit" });
      const t = (months - i) / months;
      const noise = ((seed * (i + 7)) % 113) / 1130 - 0.05;
      const portfolio = Math.round(totalPortfolio * (0.78 + 0.22 * t + noise));
      const outstanding = Math.round(totalOutstanding * (0.82 + 0.18 * t + noise));
      const overdue = Math.round(totalOverdue * (0.7 + 0.3 * t + Math.abs(noise)));
      const collected = portfolio - outstanding;
      const par30 = outstanding ? +((overdue / outstanding) * 100).toFixed(2) : 0;
      out.push({ month: m, portfolio, outstanding, overdue, collected, par30 });
    }
    return out;
  }, [kpis.portfolio, kpis.outstanding, kpis.overdue, range]);

  // ---- Portfolio composition by loan type
  const byType = useMemo(() => {
    const map = new Map<string, { type: string; balance: number; count: number; overdue: number }>();
    for (const t of LOAN_TYPES) map.set(t, { type: t, balance: 0, count: 0, overdue: 0 });
    for (const l of loans) {
      const r = map.get(l.type) ?? { type: l.type, balance: 0, count: 0, overdue: 0 };
      r.balance += l.balance;
      r.count += 1;
      if (l.dpd > 0) r.overdue += l.balance;
      map.set(l.type, r);
    }
    return Array.from(map.values()).filter((r) => r.count > 0).sort((a, b) => b.balance - a.balance);
  }, [loans]);

  // ---- Top exposures (concentration risk)
  const topExposures = useMemo(() => {
    const sorted = [...customers].sort((a, b) => b.debt - a.debt).slice(0, 10);
    const total = customers.reduce((s, c) => s + c.debt, 0) || 1;
    return sorted.map((c) => ({ name: c.name, debt: c.debt, pct: (c.debt / total) * 100, risk: c.risk, dpd: c.dpd }));
  }, [customers]);
  const top10Share = topExposures.reduce((s, c) => s + c.pct, 0);

  // ---- Vintage analysis (default rate by origination year)
  const vintage = useMemo(() => {
    const m = new Map<string, { year: string; originated: number; defaulted: number; count: number }>();
    for (const l of loans) {
      const y = l.disbursedAt.slice(0, 4);
      const r = m.get(y) ?? { year: y, originated: 0, defaulted: 0, count: 0 };
      r.originated += l.amount;
      r.count += 1;
      if (l.dpd > 90) r.defaulted += l.balance;
      m.set(y, r);
    }
    return Array.from(m.values())
      .sort((a, b) => a.year.localeCompare(b.year))
      .map((r) => ({ ...r, defaultRate: r.originated ? +((r.defaulted / r.originated) * 100).toFixed(2) : 0 }));
  }, [loans]);

  // ---- Health gauge
  const portfolioHealth = useMemo(() => {
    const collectionScore = Math.min(100, kpis.collectionPct);
    const nplPenalty = Math.min(50, kpis.nplPct * 5);
    const concentrationPenalty = Math.min(20, Math.max(0, (top10Share - 25) * 0.6));
    const score = Math.max(0, Math.round(collectionScore - nplPenalty - concentrationPenalty));
    const grade = score >= 80 ? "ممتاز" : score >= 65 ? "جيد" : score >= 50 ? "مقبول" : score >= 35 ? "تحت المراقبة" : "حرج";
    const tone: RiskClass = score >= 80 ? "good" : score >= 65 ? "watch" : score >= 50 ? "sub" : score >= 35 ? "doubt" : "loss";
    return { score, grade, tone };
  }, [kpis.collectionPct, kpis.nplPct, top10Share]);

  // ---- Period delta on PAR30
  const par30Now = trend.at(-1)?.par30 ?? 0;
  const par30Prev = trend[0]?.par30 ?? 0;
  const par30Delta = par30Now - par30Prev;

  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <PageHeader
          title="التحليلات المتقدمة"
          subtitle={`رؤى معمقة لصحة المحفظة، التركيز، الاتجاهات الزمنية، والقطاعات · ${today()}`}
          actions={
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5 bg-card">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRange(r.id)}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-sm transition",
                    range === r.id ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          }
        />

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard label="صحة المحفظة" value={`${portfolioHealth.score}/100`} sub={portfolioHealth.grade}
            tone={portfolioHealth.tone} icon={Activity} />
          <MetricCard label="PAR30 الحالي" value={fmtPct(par30Now, 2)}
            sub={`${par30Delta >= 0 ? "+" : ""}${par30Delta.toFixed(2)}% منذ بداية الفترة`}
            tone={par30Delta > 0 ? "loss" : "good"} icon={par30Delta > 0 ? TrendingUp : TrendingDown} />
          <MetricCard label="تركيز أكبر 10 عملاء" value={fmtPct(top10Share, 1)}
            sub={top10Share > 40 ? "مرتفع" : top10Share > 25 ? "متوسط" : "منخفض"}
            tone={top10Share > 40 ? "loss" : top10Share > 25 ? "watch" : "good"} icon={Target} />
          <MetricCard label="متوسط حجم القرض" value={fmtCurrency(loans.length ? kpis.portfolio / loans.length : 0)}
            sub={`${fmtInt(loans.length)} قرض نشط`} tone="good" icon={PieIcon} />
          <MetricCard label="عملاء عالي المخاطر" value={fmtInt(customers.filter((c) => c.risk === "doubt" || c.risk === "loss").length)}
            sub={`من ${fmtInt(customers.length)} عميل`} tone="doubt" icon={AlertTriangle} />
        </div>

        {/* Trend */}
        <Card title="الاتجاه الزمني للمحفظة" subtitle={`المحفظة، الديون القائمة، التحصيل، والمتأخرات خلال ${RANGES.find((r) => r.id === range)?.label}`}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPort" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOver" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--risk-loss)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--risk-loss)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtMillions(v).replace(" د.ل", "م")} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => fmtCurrency(v)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="portfolio" name="المحفظة" stroke="var(--chart-1)" fill="url(#gPort)" strokeWidth={2} />
                <Area type="monotone" dataKey="outstanding" name="القائمة" stroke="var(--chart-2)" fill="url(#gOut)" strokeWidth={2} />
                <Area type="monotone" dataKey="overdue" name="المتأخرات" stroke="var(--risk-loss)" fill="url(#gOver)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* PAR30 line */}
          <Card title="نسبة المخاطرة PAR30" subtitle="نسبة الديون المتأخرة أكثر من 30 يوماً من إجمالي القائمة">
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => `${v}%`} />
                  <Line type="monotone" dataKey="par30" name="PAR30" stroke="var(--risk-doubt)" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Composition pie */}
          <Card title="توزيع المحفظة حسب نوع التمويل" subtitle="الرصيد القائم لكل منتج تمويلي">
            <div className="h-60 grid grid-cols-5 gap-2 items-center">
              <div className="col-span-2 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byType} dataKey="balance" nameKey="type" innerRadius={40} outerRadius={75} paddingAngle={2}>
                      {byType.map((_, i) => <Cell key={i} fill={typeColors[i % typeColors.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => fmtCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="col-span-3 space-y-1.5">
                {byType.map((r, i) => {
                  const total = byType.reduce((s, x) => s + x.balance, 0) || 1;
                  const pct = (r.balance / total) * 100;
                  return (
                    <div key={r.type} className="flex items-center gap-2 text-xs">
                      <span className="size-2.5 rounded-sm" style={{ background: typeColors[i % typeColors.length] }} />
                      <span className="flex-1 truncate">{r.type}</span>
                      <span className="font-mono text-muted-foreground" lang="en">{fmtInt(r.count)}</span>
                      <span className="font-mono w-12 text-left" lang="en">{pct.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Branch comparison */}
          <Card title="أداء الفروع" subtitle="NPL ونسبة التحصيل لكل فرع">
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branches}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="collection" name="التحصيل" fill="var(--risk-good)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="npl" name="NPL" fill="var(--risk-loss)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Risk distribution radial */}
          <Card title="توزيع المخاطر" subtitle="نسبة العملاء حسب التصنيف الائتماني">
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart data={dist} innerRadius="25%" outerRadius="95%" startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" cornerRadius={6} background>
                    {dist.map((d) => <Cell key={d.key} fill={riskColors[d.key]} />)}
                  </RadialBar>
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number, _n, p: any) => [`${v}% (${p.payload.count} عميل)`, p.payload.name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Vintage + Top exposures */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="تحليل أعمار التعثر (Vintage)" subtitle="نسبة التعثر لكل سنة منح">
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vintage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number, n) => n === "defaultRate" ? `${v}%` : fmtInt(v as number)} />
                  <Bar dataKey="defaultRate" name="نسبة التعثر" fill="var(--risk-doubt)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title={`أكبر 10 عملاء (تركيز ${top10Share.toFixed(1)}%)`} subtitle="مخاطر التركيز — العملاء بأعلى مديونية">
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {topExposures.map((c, i) => (
                <div key={c.name} className="flex items-center gap-2 text-xs p-2 rounded-md hover:bg-accent/40">
                  <span className="size-6 rounded-md bg-muted flex items-center justify-center font-mono text-[11px]" lang="en">{i + 1}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <RiskBadge risk={c.risk} label={riskLabels[c.risk]} />
                  <span className="font-mono w-20 text-left text-muted-foreground" lang="en">{c.pct.toFixed(1)}%</span>
                  <span className="font-mono w-28 text-left font-medium" lang="en">{fmtCurrency(c.debt)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Aging table */}
        <Card title="أعمار الديون المتأخرة" subtitle="الرصيد القائم لكل شريحة DPD">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aging} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtMillions(v).replace(" د.ل", "م")} />
                <YAxis type="category" dataKey="bucket" tick={{ fontSize: 11 }} width={75} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => fmtCurrency(v)} />
                <Bar dataKey="value" name="الرصيد" radius={[0, 4, 4, 0]}>
                  {aging.map((a, i) => <Cell key={i} fill={riskColors[(a.tone as RiskClass) ?? "watch"]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function MetricCard({
  label, value, sub, tone, icon: Icon,
}: { label: string; value: string; sub: string; tone: RiskClass; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="size-7 rounded-md flex items-center justify-center" style={{ background: `color-mix(in oklab, ${riskColors[tone]} 15%, transparent)` }}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <div className="text-xl font-bold tabular" lang="en">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}
