import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell, Card, PageHeader } from "@/components/app-shell";
import { useDebtAging, useStore } from "@/lib/store";
import { fmtCurrency, fmtInt, fmtPct } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/aging")({
  head: () => ({ meta: [{ title: "أعمار الديون — نظام الائتمان البنكي" }] }),
  component: AgingPage,
});

const buckets = [
  { range: "1 - 30 يوم", action: "تذكير SMS", tone: "watch" },
  { range: "31 - 60 يوم", action: "مكالمة هاتفية", tone: "sub" },
  { range: "61 - 90 يوم", action: "زيارة ميدانية", tone: "sub" },
  { range: "91 - 180 يوم", action: "إشراف مباشر + تسوية", tone: "doubt" },
  { range: "أكثر من 180 يوم", action: "إحالة قانونية", tone: "loss" },
];

function AgingPage() {
  const aging = useDebtAging();
  const { loans } = useStore();
  const total = aging.reduce((s, d) => s + d.value, 0);

  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <PageHeader title="تصنيف أعمار الديون" subtitle={`إجمالي المتأخرات: ${fmtCurrency(total)} · ${fmtInt(loans.filter(l=>l.dpd>0).length)} قرض`} />
        <Card title="التوزيع الرسومي">
          <div className="p-5 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aging} margin={{ top: 30, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(v)} />
                <Tooltip formatter={(v: number) => fmtCurrency(v)} contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="value" position="top" fontSize={10} formatter={(v: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(v)} />
                  {aging.map((d, i) => <Cell key={i} fill={`var(--risk-${d.tone})`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="التوزيع التفصيلي">
          <div className="p-5 space-y-4">
            {aging.map((d) => (
              <div key={d.bucket}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">{d.bucket}</span>
                  <span className="tabular font-mono" lang="en">{fmtCurrency(d.value)} · {fmtPct(total ? (d.value / total) * 100 : 0, 1)}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${total ? (d.value / total) * 100 : 0}%`, background: `var(--risk-${d.tone})` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="الإجراءات حسب الفئة">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-5">
            {buckets.map((b) => (
              <div key={b.range} className="p-4 rounded-lg border border-border" style={{ background: `color-mix(in oklab, var(--risk-${b.tone}) 6%, transparent)` }}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="size-2 rounded-full" style={{ background: `var(--risk-${b.tone})` }} />
                  {b.range}
                </div>
                <div className="text-xs text-muted-foreground mt-2">{b.action}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}