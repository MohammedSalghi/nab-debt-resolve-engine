import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card, PageHeader, RiskBadge } from "@/components/app-shell";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { useStore, type Customer } from "@/lib/store";
import { alerts, riskLabels } from "@/lib/mock-data";
import { fmtCurrency, fmtDPD, fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/early-warning")({
  head: () => ({ meta: [{ title: "الإنذار المبكر — نظام الائتمان البنكي" }] }),
  component: EWS,
});

function EWS() {
  const { customers } = useStore();
  const [openC, setOpenC] = useState<Customer | null>(null);
  const highRisk = customers.filter((c) => c.risk === "doubt" || c.risk === "loss" || c.risk === "sub").sort((a, b) => b.dpd - a.dpd);

  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <PageHeader title="نظام الإنذار المبكر (EWS)" subtitle="اكتشاف تلقائي للمخاطر قبل وقوع التعثر" />
        <div className="grid grid-cols-12 gap-6">
          <Card className="col-span-12 lg:col-span-5" title="تنبيهات نشطة" subtitle="آخر 24 ساعة">
            <div className="divide-y divide-border max-h-[28rem] overflow-y-auto">
              {alerts.map((a) => {
                const tone = a.severity === "high" ? "border-r-risk-loss bg-risk-loss/5" : a.severity === "medium" ? "border-r-risk-sub bg-risk-sub/5" : "border-r-risk-watch bg-risk-watch/5";
                const c = customers.find((cu) => cu.id === a.customerId);
                return (
                  <div key={a.id} className={cn("p-4 border-r-2", tone)}>
                    <div className="flex justify-between gap-2">
                      <div className="text-sm font-semibold">{a.title}</div>
                      <div className="text-[10px] font-mono text-muted-foreground" lang="en">{a.time}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{a.customer}</div>
                    <div className="text-xs mt-1.5">{a.desc}</div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => { if (c) setOpenC(c); else toast.info("معالجة التنبيه"); }} className="text-[11px] px-2.5 py-1 rounded-md bg-primary text-primary-foreground">معالجة</button>
                      <button onClick={() => toast.success("تم تأجيل التنبيه")} className="text-[11px] px-2.5 py-1 rounded-md border border-border">تأجيل</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card className="col-span-12 lg:col-span-7" title="عملاء عاليي المخاطر" subtitle={`${fmtInt(highRisk.length)} عميل`}>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 font-medium">العميل</th>
                    <th className="px-5 py-3 font-medium">التقييم</th>
                    <th className="px-5 py-3 font-medium">المخاطر</th>
                    <th className="px-5 py-3 font-medium">DPD</th>
                    <th className="px-5 py-3 font-medium">المديونية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {highRisk.slice(0, 12).map((c) => (
                    <tr key={c.id} onClick={() => setOpenC(c)} className="hover:bg-muted/30 cursor-pointer">
                      <td className="px-5 py-3 font-medium">{c.name}</td>
                      <td className="px-5 py-3 font-mono tabular" lang="en">{fmtInt(c.score)}</td>
                      <td className="px-5 py-3"><RiskBadge risk={c.risk} label={riskLabels[c.risk]} /></td>
                      <td className="px-5 py-3 font-mono tabular" lang="en">{fmtDPD(c.dpd)}</td>
                      <td className="px-5 py-3 tabular" lang="en">{fmtCurrency(c.debt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <Sheet open={openC !== null} onOpenChange={(o) => !o && setOpenC(null)}>
        <SheetContent side="left" dir="rtl" className="w-96">
          <SheetHeader>
            <SheetTitle>{openC?.name}</SheetTitle>
            <SheetDescription lang="en">{openC?.id} · {openC?.branch}</SheetDescription>
          </SheetHeader>
          {openC && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Detail l="التقييم" v={fmtInt(openC.score)} />
                <Detail l="المخاطر" v={riskLabels[openC.risk]} />
                <Detail l="DPD" v={openC.dpd > 0 ? fmtDPD(openC.dpd) : "—"} />
                <Detail l="القروض" v={fmtInt(openC.loans)} />
                <Detail l="المديونية" v={fmtCurrency(openC.debt)} />
                <Detail l="الرقم الوطني" v={openC.nationalId} />
                <Detail l="الهاتف" v={openC.phone} />
                <Detail l="منذ" v={openC.createdAt} />
              </div>
              <div className="flex flex-col gap-2 pt-3">
                <button onClick={() => { toast.success("تم تسجيل النشاط"); setOpenC(null); }} className="w-full text-xs px-3 py-2 rounded-md bg-primary text-primary-foreground">تسجيل نشاط متابعة</button>
                <button onClick={() => { toast.warning("تم إنشاء قضية قانونية"); setOpenC(null); }} className="w-full text-xs px-3 py-2 rounded-md border border-border">إحالة قانونية</button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function Detail({ l, v }: { l: string; v: string }) {
  return (
    <div className="bg-muted/40 rounded-md p-2">
      <div className="text-[10px] text-muted-foreground">{l}</div>
      <div className="text-sm font-semibold mt-0.5 font-mono" lang="en">{v}</div>
    </div>
  );
}