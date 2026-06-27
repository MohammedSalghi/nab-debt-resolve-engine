import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, PageHeader } from "@/components/app-shell";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStore, type LegalCase } from "@/lib/store";
import { LEGAL_STAGES } from "@/lib/mock-data";
import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/legal")({
  head: () => ({ meta: [{ title: "القضايا القانونية — نظام الائتمان البنكي" }] }),
  component: LegalPage,
});

const stageTone: Record<string, string> = {
  "مفتوحة": "bg-risk-watch/10 text-risk-watch",
  "في المحكمة": "bg-risk-sub/10 text-risk-sub",
  "حكم": "bg-primary/10 text-primary",
  "تنفيذ": "bg-risk-doubt/10 text-risk-doubt",
  "إغلاق": "bg-risk-good/10 text-risk-good",
};

function LegalPage() {
  const { legal, loans, addLegalCase, updateLegalStage } = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<LegalCase | null>(null);

  const counts = LEGAL_STAGES.reduce((m, s) => ({ ...m, [s]: legal.filter((c) => c.stage === s).length }), {} as Record<string, number>);

  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <PageHeader
          title="إدارة القضايا القانونية"
          subtitle="القضايا المرتبطة بالقروض المتعثرة"
          actions={<button onClick={() => setAddOpen(true)} className="px-3 py-2 text-xs rounded-md bg-primary text-primary-foreground inline-flex items-center gap-1.5"><Plus className="size-3.5" /> قضية جديدة</button>}
        />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {LEGAL_STAGES.map((s) => (
            <div key={s} className="bg-card border border-border rounded-xl p-4">
              <div className="text-[11px] text-muted-foreground">{s}</div>
              <div className="text-2xl font-bold tabular mt-1" lang="en">{fmtInt(counts[s] || 0)}</div>
            </div>
          ))}
        </div>
        <Card title="جميع القضايا">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">رقم القضية</th>
                  <th className="px-5 py-3 font-medium">العميل</th>
                  <th className="px-5 py-3 font-medium">القرض</th>
                  <th className="px-5 py-3 font-medium">المحكمة</th>
                  <th className="px-5 py-3 font-medium">المحامي</th>
                  <th className="px-5 py-3 font-medium">تاريخ الإحالة</th>
                  <th className="px-5 py-3 font-medium">المرحلة</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {legal.length === 0 ? <tr><td colSpan={8} className="p-10 text-center text-sm text-muted-foreground">لا توجد قضايا</td></tr> :
                legal.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3 font-mono text-xs text-primary" lang="en">{c.id}</td>
                    <td className="px-5 py-3 font-medium">{c.customer}</td>
                    <td className="px-5 py-3 font-mono text-xs" lang="en">{c.loan}</td>
                    <td className="px-5 py-3 text-xs">{c.court}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{c.lawyer}</td>
                    <td className="px-5 py-3 font-mono text-xs" lang="en">{c.openedAt}</td>
                    <td className="px-5 py-3"><span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", stageTone[c.stage])}>{c.stage}</span></td>
                    <td className="px-5 py-3"><button onClick={() => setEditing(c)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><Pencil className="size-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>قضية جديدة</DialogTitle><DialogDescription>إنشاء قضية قانونية</DialogDescription></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const loanId = String(f.get("loan"));
              const loan = loans.find((l) => l.id === loanId);
              if (!loan) return;
              const c = addLegalCase({
                customerId: loan.customerId, customer: loan.customer, loan: loanId,
                court: String(f.get("court")), lawyer: String(f.get("lawyer")), stage: "مفتوحة",
                nextHearing: String(f.get("nextHearing") || "—"),
              });
              toast.warning(`تم إنشاء القضية ${c.id}`);
              setAddOpen(false);
            }}
            className="space-y-3"
          >
            <label className="block"><span className="text-xs font-medium">القرض</span>
              <select name="loan" required className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm">
                {loans.filter((l) => l.dpd > 90).map((l) => <option key={l.id} value={l.id}>{l.id} — {l.customer}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-xs font-medium">المحكمة</span><input name="court" required defaultValue="المحكمة التجارية - طرابلس" className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm" /></label>
              <label className="block"><span className="text-xs font-medium">المحامي</span><input name="lawyer" required defaultValue="م. خالد السنوسي" className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm" /></label>
            </div>
            <label className="block"><span className="text-xs font-medium">الجلسة القادمة</span><input type="date" name="nextHearing" className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm font-mono" lang="en" /></label>
            <DialogFooter><Button type="submit">إنشاء القضية</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تحديث مرحلة القضية</DialogTitle><DialogDescription>{editing?.id} — {editing?.customer}</DialogDescription></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const stage = String(new FormData(e.currentTarget).get("stage"));
              if (editing) updateLegalStage(editing.id, stage);
              toast.success("تم تحديث المرحلة");
              setEditing(null);
            }}
            className="space-y-3"
          >
            <label className="block"><span className="text-xs font-medium">المرحلة الجديدة</span>
              <select name="stage" defaultValue={editing?.stage} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm">
                {LEGAL_STAGES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <DialogFooter><Button type="submit">حفظ</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}