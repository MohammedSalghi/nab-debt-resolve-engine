import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileBarChart, FileSpreadsheet, FileText, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, PageHeader } from "@/components/app-shell";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore, useBranchPerf, useDebtAging } from "@/lib/store";
import { riskLabels } from "@/lib/mock-data";
import { fmtCurrency, fmtInt, fmtPct, today } from "@/lib/format";
import { downloadCSV, downloadExcel, downloadPDF } from "@/lib/export-utils";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "التقارير والتحليلات — نظام الائتمان البنكي" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { customers, loans, legal } = useStore();
  const branches = useBranchPerf();
  const aging = useDebtAging();
  const [preview, setPreview] = useState<null | { title: string; headers: string[]; rows: (string | number)[][] }>(null);

  const reports = [
    {
      id: "portfolio", title: "أداء المحفظة الائتمانية", desc: "تحليل شامل لمحفظة القروض", freq: "شهري", icon: FileBarChart,
      build: () => ({
        title: "أداء المحفظة الائتمانية",
        headers: ["الفرع", "حجم المحفظة (د.ل)", "العملاء", "نسبة NPL", "نسبة التحصيل"],
        rows: branches.map((b) => [b.name, fmtCurrency(b.portfolio), fmtInt(b.customers), fmtPct(b.npl), fmtPct(b.collection)]),
      }),
    },
    {
      id: "npl", title: "تقرير الديون المتعثرة (NPL)", desc: "تصنيف CBL", freq: "أسبوعي", icon: FileBarChart,
      build: () => {
        const classes: { name: string; key: keyof typeof prov }[] = [
          { name: "مدين عادي", key: "good" }, { name: "تحت المراقبة", key: "watch" },
          { name: "دون المستوى", key: "sub" }, { name: "مشكوك فيه", key: "doubt" }, { name: "خسارة", key: "loss" },
        ];
        const prov = { good: 0.01, watch: 0.05, sub: 0.2, doubt: 0.5, loss: 1.0 };
        const totalOut = loans.reduce((s, l) => s + l.balance, 0);
        const rows = classes.map((c) => {
          const ls = customers.filter((cu) => cu.risk === c.key);
          const bal = loans.filter((l) => ls.some((cu) => cu.id === l.customerId)).reduce((s, l) => s + l.balance, 0);
          return [c.name, fmtInt(ls.length), fmtCurrency(bal), fmtPct((bal / (totalOut || 1)) * 100), fmtCurrency(bal * prov[c.key])];
        });
        return { title: "تصنيف الديون حسب مصرف ليبيا المركزي", headers: ["التصنيف", "عدد العملاء", "الرصيد", "% المحفظة", "المخصص المطلوب"], rows };
      },
    },
    {
      id: "aging", title: "تقرير أعمار الديون", desc: "توزيع المتأخرات حسب أيام التأخير", freq: "يومي", icon: FileText,
      build: () => ({
        title: "أعمار الديون",
        headers: ["الفئة", "الرصيد (د.ل)", "عدد القروض"],
        rows: aging.map((a) => [a.bucket, fmtCurrency(a.value), fmtInt(loans.filter((l) => l.dpd >= a.min && l.dpd <= a.max).length)]),
      }),
    },
    {
      id: "collection", title: "تقرير أداء التحصيل", desc: "أداء الموظفين", freq: "أسبوعي", icon: FileBarChart,
      build: () => {
        const officers = Array.from(new Set(loans.map((l) => l.officer)));
        const rows = officers.map((o) => {
          const ls = loans.filter((l) => l.officer === o);
          const collected = ls.reduce((s, l) => s + (l.amount - l.balance), 0);
          const total = ls.reduce((s, l) => s + l.amount, 0);
          return [o, fmtInt(ls.length), fmtCurrency(collected), fmtPct(total ? (collected / total) * 100 : 0)];
        });
        return { title: "أداء الموظفين في التحصيل", headers: ["الموظف", "الحالات", "المحصل (د.ل)", "نسبة التحصيل"], rows };
      },
    },
    {
      id: "branches", title: "تقرير الفروع", desc: "مقارنة بين الفروع", freq: "شهري", icon: FileSpreadsheet,
      build: () => ({
        title: "أداء الفروع",
        headers: ["الفرع", "العملاء", "المحفظة (د.ل)", "NPL", "التحصيل"],
        rows: branches.sort((a, b) => a.npl - b.npl).map((b) => [b.name, fmtInt(b.customers), fmtCurrency(b.portfolio), fmtPct(b.npl), fmtPct(b.collection)]),
      }),
    },
    {
      id: "cbl", title: "تقرير مصرف ليبيا المركزي (CBL)", desc: "تقرير امتثال — منشور رقم 4 لسنة 2021", freq: "ربعي", icon: FileText, cbl: true,
      build: () => ({
        title: "تقرير الامتثال - مصرف ليبيا المركزي",
        headers: ["البند", "القيمة", "النسبة"],
        rows: [
          ["إجمالي المحفظة", fmtCurrency(loans.reduce((s, l) => s + l.amount, 0)), "100%"],
          ["الديون القائمة", fmtCurrency(loans.reduce((s, l) => s + l.balance, 0)), "—"],
          ["الديون المتعثرة (>90 يوم)", fmtCurrency(loans.filter((l) => l.dpd > 90).reduce((s, l) => s + l.balance, 0)), "—"],
          ["القضايا القانونية", fmtInt(legal.length), "—"],
        ],
      }),
    },
  ];

  const doExport = (r: typeof reports[number], kind: "pdf" | "excel" | "csv") => {
    toast.info("جاري إعداد الملف...");
    const { title, headers, rows } = r.build();
    const filename = `${r.id}-${today()}.${kind === "excel" ? "xlsx" : kind}`;
    setTimeout(() => {
      if (kind === "csv") downloadCSV(filename, headers, rows);
      else if (kind === "excel") downloadExcel(filename, title, headers, rows);
      else downloadPDF(filename, title, headers, rows, { orientation: "l", watermark: r.cbl ? "CONFIDENTIAL" : undefined });
      toast.success("تم تحميل الملف");
    }, 400);
  };

  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <PageHeader title="التقارير والتحليلات" subtitle="تقارير جاهزة قابلة للتصدير بصيغ متعددة" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((r) => {
            const Icon = r.icon;
            return (
              <Card key={r.id} className="p-5">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{r.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{r.desc}</div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.freq}</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => setPreview(r.build())} className="text-[10px] px-2 py-1 rounded-md border border-border hover:bg-accent inline-flex items-center gap-1"><Eye className="size-3" /> معاينة</button>
                        <button onClick={() => doExport(r, "pdf")} className="text-[10px] px-2 py-1 rounded-md border border-border hover:bg-accent">PDF</button>
                        {!r.cbl && <button onClick={() => doExport(r, "excel")} className="text-[10px] px-2 py-1 rounded-md border border-border hover:bg-accent">Excel</button>}
                        {!r.cbl && <button onClick={() => doExport(r, "csv")} className="text-[10px] px-2 py-1 rounded-md border border-border hover:bg-accent">CSV</button>}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card title="تقارير مجدولة">
          <div className="p-5 space-y-2">
            {[
              { name: "ملخص يومي للمخاطر", time: "كل يوم 07:00 صباحاً", recipients: "12 مستلم" },
              { name: "أداء التحصيل الأسبوعي", time: "كل أحد 09:00 صباحاً", recipients: "8 مستلمين" },
              { name: "تقرير NPL الشهري", time: "أول كل شهر", recipients: "اللجنة التنفيذية" },
            ].map((s) => (
              <div key={s.name} className="flex items-center justify-between p-3 rounded-md border border-border">
                <div>
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5" lang="en">{s.time} · {s.recipients}</div>
                </div>
                <button onClick={() => toast.success("تم إرسال آخر نسخة")} className="text-[11px] px-2.5 py-1 rounded-md border border-border inline-flex items-center gap-1">
                  <Download className="size-3" /> آخر نسخة
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent dir="rtl" className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
            <DialogDescription>معاينة قبل التصدير · {today()}</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-muted/40">
                <tr>{preview?.headers.map((h) => <th key={h} className="px-3 py-2 text-xs font-medium text-muted-foreground">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview?.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-2 text-xs" lang="en">{String(c)}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}