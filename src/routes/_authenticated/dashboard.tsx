import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, ArrowUp, Download, ExternalLink, FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, Card, PageHeader, RiskBadge } from "@/components/app-shell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBranchPerf, useDebtAging, useKPIs, useRiskDistribution, useStore } from "@/lib/store";
import { riskLabels, type RiskClass } from "@/lib/mock-data";
import { fmtMillions, fmtPct, fmtInt, today, fmtCurrency } from "@/lib/format";
import { downloadCSV, downloadExcel, downloadPDF } from "@/lib/export-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم التنفيذية — نظام الائتمان البنكي" },
      { name: "description", content: "نظرة شاملة على محفظة القروض، نسبة التعثر، التحصيل، وأداء الفروع." },
    ],
  }),
  component: Dashboard,
});

const riskColors = ["var(--risk-good)", "var(--risk-watch)", "var(--risk-sub)", "var(--risk-doubt)", "var(--risk-loss)"];

function Dashboard() {
  const navigate = useNavigate();
  const kpis = useKPIs();
  const dist = useRiskDistribution();
  const aging = useDebtAging();
  const branches = useBranchPerf();
  const { customers, loans } = useStore();
  const [exportOpen, setExportOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const kpiCards = [
    { id: "portfolio", label: "إجمالي محفظة القروض", value: fmtMillions(kpis.portfolio), delta: "+2.4%", tone: "good", to: "/loans" as const },
    { id: "outstanding", label: "الديون القائمة", value: fmtMillions(kpis.outstanding), delta: "+1.1%", tone: "good", to: "/loans" as const },
    { id: "overdue", label: "إجمالي المتأخرات", value: fmtMillions(kpis.overdue), delta: "+1.2%", tone: "bad", to: "/aging" as const },
    { id: "npl", label: "نسبة التعثر NPL", value: fmtPct(kpis.nplPct), delta: "+0.12%", tone: "bad", to: "/aging" as const },
    { id: "collection", label: "نسبة التحصيل", value: fmtPct(kpis.collectionPct, 1), delta: "+1.5%", tone: "good", to: "/collections" as const },
    { id: "customers", label: "العملاء النشطون", value: fmtInt(kpis.active), delta: `+${fmtInt(12)}`, tone: "good", to: "/customers" as const },
    { id: "defaulters", label: "العملاء المتعثرون", value: fmtInt(kpis.defaulters), delta: `+${fmtInt(3)}`, tone: "bad", to: "/early-warning" as const },
    { id: "legal", label: "القضايا القانونية المفتوحة", value: fmtInt(kpis.openLegal), delta: `+${fmtInt(1)}`, tone: "bad", to: "/legal" as const },
  ];

  const doExport = (kind: "pdf" | "excel" | "csv") => {
    const filename = `dashboard-summary-${today()}.${kind === "excel" ? "xlsx" : kind}`;
    toast.info("جاري إعداد الملف...");
    const headers = ["المؤشر", "القيمة"];
    const rows: (string | number)[][] = kpiCards.map((k) => [k.label, k.value]);
    setTimeout(() => {
      if (kind === "csv") downloadCSV(filename, headers, rows);
      else if (kind === "excel") downloadExcel(filename, "ملخص لوحة التحكم", headers, rows);
      else downloadPDF(filename, "Executive Dashboard Summary", ["KPI", "Value"], rows);
      toast.success("تم تحميل الملف");
      setExportOpen(false);
    }, 400);
  };

  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <PageHeader
          title="لوحة التحكم التنفيذية"
          subtitle={`نظرة شاملة على أداء المحفظة الائتمانية، المخاطر، والتحصيل · ${today()}`}
          actions={
            <>
              <button onClick={() => setExportOpen(true)} className="px-3 py-2 text-xs font-medium rounded-md border border-border hover:bg-accent inline-flex items-center gap-1.5">
                <Download className="size-3.5" /> تصدير
              </button>
              <button onClick={() => setScheduleOpen(true)} className="px-3 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90">
                تقرير مجدول
              </button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpiCards.map((k, idx) => {
            const spark = sparkSeries(idx, k.tone === "good");
            return (
              <button
                key={k.id}
                onClick={() => navigate({ to: k.to })}
                className="group relative text-right bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-[var(--shadow-elegant)] transition-all overflow-hidden"
              >
                <div className="absolute inset-x-0 top-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "var(--gradient-primary)" }} />
                <div className="text-[11px] text-muted-foreground font-medium">{k.label}</div>
                <div className="mt-1.5 text-2xl font-bold tabular tracking-tight" lang="en">{k.value}</div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div className={cn("inline-flex items-center gap-1 text-[10px] font-mono", k.tone === "good" ? "text-risk-good" : "text-risk-loss")} lang="en">
                    {k.tone === "good" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                    {k.delta}
                  </div>
                  <div className="h-7 w-20 opacity-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={spark} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                        <Line type="monotone" dataKey="v" stroke={k.tone === "good" ? "var(--risk-good)" : "var(--risk-loss)"} strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-12 gap-6">
          <Card className="col-span-12 lg:col-span-4" title="توزيع المخاطر" subtitle={`${fmtInt(customers.length)} عميل`}>
            <div className="p-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dist} dataKey="value" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {dist.map((_, i) => <Cell key={i} fill={riskColors[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}%`} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="px-5 pb-5 grid grid-cols-5 gap-2">
              {dist.map((r, i) => (
                <div key={r.key} className="text-center">
                  <div className="size-2 mx-auto rounded-full mb-1" style={{ background: riskColors[i] }} />
                  <div className="text-[10px] text-muted-foreground">{r.name}</div>
                  <div className="text-xs font-mono font-semibold" lang="en">{fmtInt(r.count)}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="col-span-12 lg:col-span-8" title="اتجاهات التحصيل ونسبة التعثر" subtitle="آخر 12 شهر">
            <div className="p-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend12()} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number, k: string) => [`${v}%`, k]} />
                  <Line type="monotone" dataKey="تحصيل" stroke="var(--risk-good)" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="تعثر" stroke="var(--risk-loss)" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <Card className="col-span-12 lg:col-span-8" title="تحليل أعمار الديون" subtitle="توزيع الأرصدة المتأخرة">
            <div className="p-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aging} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="bucket" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {aging.map((d, i) => (
                      <Cell key={i} fill={`var(--risk-${d.tone})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="col-span-12 lg:col-span-4" title="تنبيهات الإنذار المبكر" subtitle="مخاطر اكتُشفت تلقائياً" actions={<span className="size-2 rounded-full bg-destructive animate-pulse" />}>
            <div className="divide-y divide-border max-h-80 overflow-y-auto">
              {loans.filter((l) => l.dpd > 60).slice(0, 6).map((l) => (
                <button
                  key={l.id}
                  onClick={() => { toast.info(`فتح ملف ${l.customer}`); navigate({ to: "/customers" }); }}
                  className="w-full text-right px-5 py-3 hover:bg-accent border-r-2 border-r-risk-loss bg-risk-loss/5"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="text-xs font-semibold">تأخر قسط</div>
                    <div className="text-[10px] font-mono text-muted-foreground" lang="en">{l.id}</div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{l.customer}</div>
                  <div className="text-[11px] mt-1" lang="en">DPD: {fmtInt(l.dpd)} يوم · {fmtMillions(l.balance)}</div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <Card
          title="أداء الفروع والمناطق"
          subtitle="مقارنة شهرية"
          actions={
            <button onClick={() => navigate({ to: "/reports" })} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
              التقرير الكامل <ExternalLink className="size-3" />
            </button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">الفرع</th>
                  <th className="px-5 py-3 font-medium">المحفظة</th>
                  <th className="px-5 py-3 font-medium">العملاء</th>
                  <th className="px-5 py-3 font-medium">نسبة NPL</th>
                  <th className="px-5 py-3 font-medium">نسبة التحصيل</th>
                  <th className="px-5 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {branches.map((b) => (
                  <tr key={b.name} className="hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium">{b.name}</td>
                    <td className="px-5 py-3 tabular" lang="en">{fmtMillions(b.portfolio)}</td>
                    <td className="px-5 py-3 tabular" lang="en">{fmtInt(b.customers)}</td>
                    <td className="px-5 py-3 tabular" lang="en">
                      <span className={cn(b.npl > 5 ? "text-risk-loss" : b.npl > 3 ? "text-risk-sub" : "text-risk-good")}>{fmtPct(b.npl)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${b.collection}%`, background: b.collection >= 90 ? "var(--risk-good)" : b.collection >= 75 ? "var(--risk-sub)" : "var(--risk-loss)" }} />
                        </div>
                        <span className="tabular text-xs w-12" lang="en">{fmtPct(b.collection, 1)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3"><RiskBadge risk={b.status as RiskClass} label={riskLabels[b.status as RiskClass]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Export Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تصدير ملخص اللوحة</DialogTitle>
            <DialogDescription>اختر صيغة الملف المطلوب</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-2">
            <button onClick={() => doExport("pdf")} className="border border-border rounded-lg p-4 hover:bg-accent flex flex-col items-center gap-2">
              <FileText className="size-8 text-destructive" />
              <span className="text-xs font-medium">PDF</span>
            </button>
            <button onClick={() => doExport("excel")} className="border border-border rounded-lg p-4 hover:bg-accent flex flex-col items-center gap-2">
              <FileSpreadsheet className="size-8 text-risk-good" />
              <span className="text-xs font-medium">Excel</span>
            </button>
            <button onClick={() => doExport("csv")} className="border border-border rounded-lg p-4 hover:bg-accent flex flex-col items-center gap-2">
              <FileDown className="size-8 text-primary" />
              <span className="text-xs font-medium">CSV</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>جدولة تقرير دوري</DialogTitle>
            <DialogDescription>سيتم إرسال التقرير تلقائياً للقائمة المحددة</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              toast.success("تم جدولة التقرير بنجاح");
              setScheduleOpen(false);
            }}
            className="space-y-3 text-sm"
          >
            <label className="block">
              <span className="text-xs font-medium">اسم التقرير</span>
              <input required className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm" placeholder="ملخص اللوحة اليومي" />
            </label>
            <label className="block">
              <span className="text-xs font-medium">الدورية</span>
              <select className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm">
                <option>يومي</option><option>أسبوعي</option><option>شهري</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium">البريد الإلكتروني للمستلمين</span>
              <input required className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm" placeholder="risk@bank.ly, exec@bank.ly" />
            </label>
            <DialogFooter>
              <Button type="submit">حفظ الجدولة</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function trend12() {
  // a sliding 12-month series derived from current state (visual)
  return [
    { m: "08", تحصيل: 88, تعثر: 3.4 },
    { m: "09", تحصيل: 89.5, تعثر: 3.5 },
    { m: "10", تحصيل: 90.1, تعثر: 3.3 },
    { m: "11", تحصيل: 91.4, تعثر: 3.2 },
    { m: "12", تحصيل: 92.6, تعثر: 3.18 },
    { m: "01", تحصيل: 92.1, تعثر: 3.25 },
    { m: "02", تحصيل: 93.1, تعثر: 3.15 },
    { m: "03", تحصيل: 93.6, تعثر: 3.12 },
    { m: "04", تحصيل: 93.9, تعثر: 3.18 },
    { m: "05", تحصيل: 94.0, تعثر: 3.14 },
    { m: "06", تحصيل: 94.2, تعثر: 3.1 },
    { m: "07", تحصيل: 94.5, تعثر: 3.05 },
  ];
}

function sparkSeries(seed: number, up: boolean) {
  const base = 50 + (seed * 7) % 25;
  return Array.from({ length: 12 }, (_, i) => {
    const noise = Math.sin((seed + 1) * (i + 1)) * 6;
    const drift = up ? i * 1.4 : -i * 1.2;
    return { v: Math.max(5, base + drift + noise) };
  });
}

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
} as const;