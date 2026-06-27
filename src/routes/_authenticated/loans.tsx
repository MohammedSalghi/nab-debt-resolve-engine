import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, CreditCard, RotateCw, Scale, Eye, Download } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, PageHeader } from "@/components/app-shell";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStore, type Loan } from "@/lib/store";
import { LIBYAN_BRANCHES, LOAN_TYPES } from "@/lib/mock-data";
import { fmtCurrency, fmtInt, fmtPct, fmt2, fmtDPD } from "@/lib/format";
import { downloadCSV } from "@/lib/export-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/loans")({
  head: () => ({ meta: [{ title: "محفظة القروض — نظام الائتمان البنكي" }] }),
  component: LoansPage,
});

const STATUSES = ["نشط", "متأخر", "متعثر", "قانوني"];
const statusTone: Record<string, string> = {
  "نشط": "text-risk-good bg-risk-good/10",
  "متأخر": "text-risk-sub bg-risk-sub/10",
  "متعثر": "text-risk-doubt bg-risk-doubt/10",
  "قانوني": "text-risk-loss bg-risk-loss/10",
};

function LoansPage() {
  const { loans, customers, addLoan, recordPayment, reschedule, referToLegal } = useStore();
  const [statusF, setStatusF] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [paying, setPaying] = useState<Loan | null>(null);
  const [reschOpen, setReschOpen] = useState<Loan | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState<Loan | null>(null);

  const filtered = useMemo(() => (statusF === "all" ? loans : loans.filter((l) => l.status === statusF)), [loans, statusF]);
  const totals = {
    count: loans.length,
    portfolio: loans.reduce((s, l) => s + l.amount, 0),
    avgRate: loans.reduce((s, l) => s + l.rate, 0) / (loans.length || 1),
    late: loans.filter((l) => l.dpd > 0).length,
  };

  const handleExport = () => {
    toast.info("جاري إعداد الملف...");
    downloadCSV(
      `loans-${new Date().toISOString().slice(0, 10)}.csv`,
      ["رقم القرض", "العميل", "النوع", "الفرع", "القيمة", "الرصيد", "الفائدة", "المدة (شهر)", "DPD", "الحالة"],
      filtered.map((l) => [l.id, l.customer, l.type, l.branch, l.amount, l.balance, `${l.rate}%`, l.term, l.dpd, l.status]),
    );
    toast.success("تم تحميل الملف");
  };

  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <PageHeader
          title="محفظة القروض والتسهيلات الائتمانية"
          subtitle="جميع القروض النشطة، المتأخرة، والمتعثرة"
          actions={
            <>
              <button onClick={handleExport} className="px-3 py-2 text-xs rounded-md border border-border hover:bg-accent inline-flex items-center gap-1.5">
                <Download className="size-3.5" /> تصدير
              </button>
              <button onClick={() => setAddOpen(true)} className="px-3 py-2 text-xs rounded-md bg-primary text-primary-foreground inline-flex items-center gap-1.5">
                <Plus className="size-3.5" /> قرض جديد
              </button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat l="إجمالي القروض" v={fmtInt(totals.count)} />
          <Stat l="حجم المحفظة" v={fmtCurrency(totals.portfolio)} />
          <Stat l="متوسط الفائدة" v={fmtPct(totals.avgRate, 2)} />
          <Stat l="قروض متأخرة" v={fmtInt(totals.late)} />
        </div>

        <Card>
          <div className="p-4 border-b border-border flex gap-2 flex-wrap">
            <button onClick={() => setStatusF("all")} className={cn("text-xs px-3 py-1.5 rounded-full", statusF === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent")}>
              الكل ({fmtInt(loans.length)})
            </button>
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatusF(s)} className={cn("text-xs px-3 py-1.5 rounded-full", statusF === s ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent")}>
                {s} ({fmtInt(loans.filter((l) => l.status === s).length)})
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">رقم القرض</th>
                  <th className="px-5 py-3 font-medium">العميل</th>
                  <th className="px-5 py-3 font-medium">النوع</th>
                  <th className="px-5 py-3 font-medium">القيمة</th>
                  <th className="px-5 py-3 font-medium">الرصيد</th>
                  <th className="px-5 py-3 font-medium">الفائدة</th>
                  <th className="px-5 py-3 font-medium">المدة</th>
                  <th className="px-5 py-3 font-medium">DPD</th>
                  <th className="px-5 py-3 font-medium">الحالة</th>
                  <th className="px-5 py-3 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} className="p-10 text-center text-sm text-muted-foreground">لا توجد بيانات</td></tr>
                ) : filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3 font-mono text-xs text-primary" lang="en">{l.id}</td>
                    <td className="px-5 py-3 font-medium">{l.customer}</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">{l.type}</td>
                    <td className="px-5 py-3 tabular" lang="en">{fmtCurrency(l.amount)}</td>
                    <td className="px-5 py-3 tabular" lang="en">{fmtCurrency(l.balance)}</td>
                    <td className="px-5 py-3 tabular" lang="en">{fmtPct(l.rate, 1)}</td>
                    <td className="px-5 py-3 tabular font-mono text-xs" lang="en">{fmtInt(l.term)} شهر</td>
                    <td className="px-5 py-3 tabular font-mono text-xs" lang="en">{l.dpd > 0 ? fmtDPD(l.dpd) : "—"}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => setStatusF(l.status)} className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", statusTone[l.status])}>
                        {l.status}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setScheduleOpen(l)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground" title="عرض الجدول"><Eye className="size-3.5" /></button>
                        <button onClick={() => setPaying(l)} className="p-1.5 rounded-md hover:bg-accent text-risk-good" title="تسجيل دفعة"><CreditCard className="size-3.5" /></button>
                        <button onClick={() => setReschOpen(l)} className="p-1.5 rounded-md hover:bg-accent text-risk-watch" title="إعادة جدولة"><RotateCw className="size-3.5" /></button>
                        <button
                          onClick={() => {
                            const c = referToLegal(l.id, "تجاوز حد التأخير");
                            if (c) toast.warning(`تم إنشاء القضية ${c.id}`);
                          }}
                          className="p-1.5 rounded-md hover:bg-accent text-destructive" title="إحالة قانونية"
                        ><Scale className="size-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Add Loan */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>قرض جديد</DialogTitle><DialogDescription>إنشاء قرض جديد لعميل قائم</DialogDescription></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const customerId = String(f.get("customerId"));
              const customer = customers.find((c) => c.id === customerId);
              if (!customer) { toast.error("اختر عميل صالح"); return; }
              const amount = Number(f.get("amount"));
              if (!amount || amount <= 0 || amount > 50_000_000) { toast.error("القيمة يجب أن تكون بين 1 و 50,000,000"); return; }
              const rate = Number(f.get("rate"));
              if (rate < 0.1 || rate > 25) { toast.error("الفائدة يجب أن تكون بين 0.1% و 25%"); return; }
              addLoan({
                customer: customer.name, customerId, type: String(f.get("type")), branch: customer.branch,
                amount, rate, term: Number(f.get("term")), dpd: 0, disbursedAt: new Date().toISOString().slice(0, 10),
                officer: "أحمد الزهراني",
              });
              toast.success("تم الحفظ بنجاح");
              setAddOpen(false);
            }}
            className="space-y-3"
          >
            <FormRow label="العميل"><select name="customerId" required className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm">{customers.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.id}</option>)}</select></FormRow>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="نوع التمويل"><select name="type" className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm">{LOAN_TYPES.map((t) => <option key={t}>{t}</option>)}</select></FormRow>
              <FormRow label="المبلغ (د.ل)"><input name="amount" type="number" min={1} max={50_000_000} required className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono" lang="en" /></FormRow>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="نسبة الفائدة %"><input name="rate" type="number" step="0.1" min={0.1} max={25} required defaultValue={7.5} className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono" lang="en" /></FormRow>
              <FormRow label="المدة (شهر)"><input name="term" type="number" min={6} max={360} required defaultValue={36} className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono" lang="en" /></FormRow>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button><Button type="submit">حفظ</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment */}
      <Dialog open={paying !== null} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تسجيل دفعة</DialogTitle><DialogDescription>{paying?.id} — {paying?.customer}</DialogDescription></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const amount = Number(new FormData(e.currentTarget).get("amount"));
              if (!amount || amount <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
              if (paying) recordPayment(paying.id, amount);
              toast.success("تم تسجيل الدفعة");
              setPaying(null);
            }}
            className="space-y-3"
          >
            <div className="text-xs text-muted-foreground" lang="en">الرصيد الحالي: {fmtCurrency(paying?.balance ?? 0)}</div>
            <FormRow label="المبلغ المدفوع (د.ل)"><input name="amount" type="number" min={1} required className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono" lang="en" /></FormRow>
            <FormRow label="رقم الإيصال"><input name="receipt" className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono" lang="en" defaultValue={`R-${Date.now().toString().slice(-8)}`} /></FormRow>
            <DialogFooter><Button type="submit">تسجيل الدفعة</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reschedule */}
      <Dialog open={reschOpen !== null} onOpenChange={(o) => !o && setReschOpen(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إعادة جدولة القرض</DialogTitle><DialogDescription>{reschOpen?.id} — {reschOpen?.customer}</DialogDescription></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (reschOpen) reschedule(reschOpen.id, Number(f.get("term")), Number(f.get("rate")));
              toast.success("تمت إعادة الجدولة");
              setReschOpen(null);
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="مدة جديدة (شهر)"><input name="term" type="number" required defaultValue={reschOpen ? reschOpen.term + 12 : 48} className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono" lang="en" /></FormRow>
              <FormRow label="فائدة جديدة %"><input name="rate" type="number" step="0.1" required defaultValue={reschOpen?.rate ?? 7} className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono" lang="en" /></FormRow>
            </div>
            <DialogFooter><Button type="submit">حفظ الجدولة</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Installment schedule preview */}
      <Dialog open={scheduleOpen !== null} onOpenChange={(o) => !o && setScheduleOpen(null)}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader><DialogTitle>جدول الأقساط</DialogTitle><DialogDescription>{scheduleOpen?.id} — {scheduleOpen?.customer}</DialogDescription></DialogHeader>
          {scheduleOpen && <ScheduleTable loan={scheduleOpen} />}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function ScheduleTable({ loan }: { loan: Loan }) {
  // Simple amortization
  const r = loan.rate / 100 / 12;
  const n = loan.term;
  const pmt = (loan.amount * r) / (1 - Math.pow(1 + r, -n));
  const rows: { i: number; principal: number; interest: number; balance: number }[] = [];
  let bal = loan.amount;
  for (let i = 1; i <= Math.min(12, n); i++) {
    const interest = bal * r;
    const principal = pmt - interest;
    bal -= principal;
    rows.push({ i, principal, interest, balance: bal });
  }
  return (
    <div className="max-h-96 overflow-y-auto">
      <table className="w-full text-right text-sm" lang="en">
        <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">القسط</th><th className="px-3 py-2">الفائدة</th><th className="px-3 py-2">الأصل</th><th className="px-3 py-2">الرصيد</th></tr>
        </thead>
        <tbody className="divide-y divide-border font-mono text-xs">
          {rows.map((r) => (
            <tr key={r.i}>
              <td className="px-3 py-2">{r.i}</td>
              <td className="px-3 py-2">{fmt2(pmt)}</td>
              <td className="px-3 py-2">{fmt2(r.interest)}</td>
              <td className="px-3 py-2">{fmt2(r.principal)}</td>
              <td className="px-3 py-2">{fmt2(Math.max(0, r.balance))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-muted-foreground p-3 text-center">عرض أول {Math.min(12, n)} قسط من أصل {fmtInt(n)} — جميع الأرقام بالدينار الليبي</p>
    </div>
  );
}

function Stat({ l, v }: { l: string; v: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-[11px] text-muted-foreground">{l}</div>
      <div className="text-2xl font-bold tabular mt-1" lang="en">{v}</div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}