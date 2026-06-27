import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, Card, PageHeader } from "@/components/app-shell";
import { useStore } from "@/lib/store";
import { fmtPct } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/risk")({
  head: () => ({ meta: [{ title: "محرك تقييم المخاطر — نظام الائتمان البنكي" }] }),
  component: RiskPage,
});

const LABELS: Record<string, string> = {
  dpd: "أيام التأخير (DPD)", dti: "نسبة الدين إلى الدخل", overdue: "حجم المتأخرات",
  late: "عدد مرات التأخير", resch: "إعادة الجدولة السابقة", years: "تاريخ العلاقة",
  products: "عدد المنتجات", behavior: "السلوك المالي السابق",
};

const buckets = [
  { range: "80 - 100", label: "جيد", tone: "good" },
  { range: "65 - 79", label: "تحت المراقبة", tone: "watch" },
  { range: "50 - 64", label: "دون المعيار", tone: "sub" },
  { range: "30 - 49", label: "مشكوك فيه", tone: "doubt" },
  { range: "0 - 29", label: "خسارة", tone: "loss" },
];

function RiskPage() {
  const { weights } = useStore();
  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <PageHeader
          title="محرك تقييم المخاطر الائتمانية"
          subtitle="نظام داخلي يحسب درجة المخاطر لكل عميل (0 - 100)"
          actions={<Link to="/admin" className="px-3 py-2 text-xs rounded-md bg-primary text-primary-foreground">تعديل الأوزان</Link>}
        />
        <div className="grid grid-cols-12 gap-6">
          <Card className="col-span-12 lg:col-span-7" title="أوزان معايير التقييم" subtitle="مرتبطة بإعدادات الإدارة">
            <div className="p-5 space-y-3">
              {Object.entries(weights).map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span>{LABELS[k]}</span>
                    <span className="tabular font-mono font-semibold" lang="en">{fmtPct(v * 100, 0)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${v * 200}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="col-span-12 lg:col-span-5" title="حدود التصنيف">
            <div className="p-5 space-y-2">
              {buckets.map((b) => (
                <div key={b.label} className="flex items-center justify-between p-3 rounded-md border border-border" style={{ background: `color-mix(in oklab, var(--risk-${b.tone}) 8%, transparent)` }}>
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: `var(--risk-${b.tone})` }} />
                    <span className="text-sm font-medium">{b.label}</span>
                  </div>
                  <span className="font-mono text-xs tabular" lang="en">{b.range}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <Card title="معادلة الحساب">
          <pre dir="ltr" className="p-5 font-mono text-xs bg-muted/40 leading-relaxed overflow-x-auto">{`score = 100
  - (DPD_weight       * normalize(DPD, 0..180) * 100)
  - (DTI_weight       * normalize(DTI, 0..1) * 100)
  - (overdue_weight   * normalize(overdueAmount, 0..max) * 100)
  - (lateCount_weight * normalize(lateCount, 0..12) * 100)
  - (reschedule_weight * (reschedules > 0 ? 100 : 0))
  + (relationship_weight * normalize(years, 0..20) * 100)
  + (products_weight    * normalize(products, 0..6) * 100)
  + (behavior_weight    * behaviorScore * 100)`}</pre>
        </Card>
      </div>
    </AppShell>
  );
}