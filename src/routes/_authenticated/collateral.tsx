import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, RefreshCw, Building2, Car, FileSignature, Banknote, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, PageHeader } from "@/components/app-shell";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStore, type Collateral } from "@/lib/store";
import { COLLATERAL_TYPES } from "@/lib/mock-data";
import { fmtCurrency, fmtInt, fmtPct } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/collateral")({
  head: () => ({ meta: [{ title: "إدارة الضمانات — نظام الائتمان البنكي" }] }),
  component: CollateralPage,
});

const typeIcon: Record<string, typeof Building2> = { "عقار": Building2, "سيارة": Car, "كفالة": FileSignature, "نقدي": Banknote };

function CollateralPage() {
  const { collateral, loans, addCollateral, reappraise } = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [reapp, setReapp] = useState<Collateral | null>(null);

  const total = collateral.reduce((s, c) => s + c.value, 0);
  const totalLoan = loans.reduce((s, l) => s + l.balance, 0);
  const coverage = totalLoan ? (total / totalLoan) * 100 : 0;

  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <PageHeader
          title="إدارة الضمانات"
          subtitle={`القيمة الإجمالية: ${fmtCurrency(total)} — ${fmtInt(collateral.length)} ضمان · نسبة التغطية: ${fmtPct(coverage, 1)}`}
          actions={<button onClick={() => setAddOpen(true)} className="px-3 py-2 text-xs rounded-md bg-primary text-primary-foreground inline-flex items-center gap-1.5"><Plus className="size-3.5" /> ضمان جديد</button>}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {COLLATERAL_TYPES.map((type) => {
            const Icon = typeIcon[type];
            const items = collateral.filter((c) => c.type === type);
            const sum = items.reduce((s, c) => s + c.value, 0);
            return (
              <div key={type} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{type}</span>
                </div>
                <div className="text-xl font-bold tabular mt-2" lang="en">{fmtCurrency(sum)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5" lang="en">{fmtInt(items.length)} ضمان</div>
              </div>
            );
          })}
        </div>

        <Card title="سجل الضمانات">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">رقم الضمان</th>
                  <th className="px-5 py-3 font-medium">النوع</th>
                  <th className="px-5 py-3 font-medium">القيمة</th>
                  <th className="px-5 py-3 font-medium">العميل</th>
                  <th className="px-5 py-3 font-medium">القرض</th>
                  <th className="px-5 py-3 font-medium">تاريخ التقييم</th>
                  <th className="px-5 py-3 font-medium">الحالة</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {collateral.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3 font-mono text-xs text-primary" lang="en">{c.id}</td>
                    <td className="px-5 py-3">{c.type}</td>
                    <td className="px-5 py-3 tabular" lang="en">{fmtCurrency(c.value)}</td>
                    <td className="px-5 py-3 font-medium">{c.customer}</td>
                    <td className="px-5 py-3 font-mono text-xs" lang="en">{c.loan}</td>
                    <td className="px-5 py-3 font-mono text-xs" lang="en">{c.evaluatedAt}</td>
                    <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full text-[11px] bg-accent">{c.status}</span></td>
                    <td className="px-5 py-3"><button onClick={() => setReapp(c)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground" title="إعادة تقييم"><RefreshCw className="size-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>ضمان جديد</DialogTitle><DialogDescription>ربط الضمان بقرض قائم</DialogDescription></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const loanId = String(f.get("loan"));
              const loan = loans.find((l) => l.id === loanId);
              if (!loan) return;
              addCollateral({
                type: String(f.get("type")), value: Number(f.get("value")),
                customerId: loan.customerId, customer: loan.customer, loan: loanId,
                evaluatedAt: new Date().toISOString().slice(0, 10),
              });
              toast.success("تم الحفظ بنجاح");
              setAddOpen(false);
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-xs font-medium">النوع</span>
                <select name="type" className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm">
                  {COLLATERAL_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="block"><span className="text-xs font-medium">القيمة (د.ل)</span>
                <input name="value" type="number" required className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm font-mono" lang="en" />
              </label>
            </div>
            <label className="block"><span className="text-xs font-medium">القرض المرتبط</span>
              <select name="loan" required className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm">
                {loans.map((l) => <option key={l.id} value={l.id}>{l.id} — {l.customer}</option>)}
              </select>
            </label>
            <label className="block"><span className="text-xs font-medium">مستند التقييم</span>
              <div className="mt-1 border border-dashed border-border rounded-md p-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Upload className="size-4" />
                <input type="file" onChange={(e) => e.target.files?.[0] && toast.success(`تم رفع: ${e.target.files[0].name}`)} className="text-xs" />
              </div>
            </label>
            <DialogFooter><Button type="submit">حفظ</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={reapp !== null} onOpenChange={(o) => !o && setReapp(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إعادة تقييم الضمان</DialogTitle><DialogDescription>{reapp?.id} — قيمة سابقة: {fmtCurrency(reapp?.value ?? 0)}</DialogDescription></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = Number(new FormData(e.currentTarget).get("value"));
              if (reapp && v > 0) reappraise(reapp.id, v);
              toast.success("تمت إعادة التقييم");
              setReapp(null);
            }}
            className="space-y-3"
          >
            <label className="block"><span className="text-xs font-medium">القيمة الجديدة (د.ل)</span>
              <input name="value" type="number" required defaultValue={reapp?.value} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm font-mono" lang="en" />
            </label>
            <label className="block"><span className="text-xs font-medium">اسم المُقيِّم</span>
              <input name="appraiser" defaultValue="مكتب الزاوي للتقييم" className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm" />
            </label>
            <DialogFooter><Button type="submit">حفظ التقييم</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}