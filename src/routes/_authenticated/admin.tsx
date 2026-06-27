import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, PageHeader } from "@/components/app-shell";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { LIBYAN_BRANCHES } from "@/lib/mock-data";
import { fmtInt, fmtPct } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "لوحة الإدارة — نظام الائتمان البنكي" }] }),
  component: AdminPage,
});

const WEIGHT_LABELS: Record<string, string> = {
  dpd: "أيام التأخير (DPD)", dti: "الدين إلى الدخل", overdue: "حجم المتأخرات",
  late: "عدد مرات التأخير", resch: "إعادة الجدولة", years: "تاريخ العلاقة",
  products: "عدد المنتجات", behavior: "السلوك السابق",
};

function AdminPage() {
  const { weights, setWeights, users, addUser, toggleUser, audit, customers } = useStore();
  const [draft, setDraft] = useState(weights);
  const [addOpen, setAddOpen] = useState(false);

  const total = Object.values(draft).reduce((s, v) => s + v, 0);

  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <PageHeader title="لوحة الإدارة" subtitle="إعدادات النظام، الصلاحيات، وأوزان المخاطر" />

        <div className="grid grid-cols-12 gap-6">
          <Card className="col-span-12 lg:col-span-7" title="أوزان معايير تقييم المخاطر" subtitle={`المجموع: ${fmtPct(total * 100, 0)}`}>
            <div className="p-5 space-y-3">
              {Object.entries(draft).map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span>{WEIGHT_LABELS[k]}</span>
                    <span className="tabular font-mono font-semibold" lang="en">{fmtPct(v * 100, 0)}</span>
                  </div>
                  <input
                    type="range" min={0} max={0.5} step={0.01} value={v}
                    onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button onClick={() => { setWeights(draft); toast.success("تم حفظ الإعدادات بنجاح — تم تحديث تقييم المخاطر للعملاء"); }}>
                  <Save className="size-4 ml-1" /> حفظ الإعدادات
                </Button>
                <Button variant="outline" onClick={() => setDraft(weights)}>إلغاء</Button>
              </div>
            </div>
          </Card>

          <Card className="col-span-12 lg:col-span-5" title="إحصائيات سريعة">
            <div className="p-5 grid grid-cols-2 gap-3">
              {[
                { l: "مستخدمون نشطون", v: fmtInt(users.filter((u) => u.status === "نشط").length) },
                { l: "عملاء", v: fmtInt(customers.length) },
                { l: "فروع", v: fmtInt(LIBYAN_BRANCHES.length) },
                { l: "MFA", v: "مفعّل" },
              ].map((s) => (
                <div key={s.l} className="bg-muted/40 rounded-lg p-3">
                  <div className="text-[10px] text-muted-foreground">{s.l}</div>
                  <div className="text-lg font-bold tabular mt-1" lang="en">{s.v}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card
          title="المستخدمون"
          actions={<button onClick={() => setAddOpen(true)} className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground inline-flex items-center gap-1.5"><Plus className="size-3.5" /> مستخدم جديد</button>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">المستخدم</th>
                  <th className="px-5 py-3 font-medium">الدور</th>
                  <th className="px-5 py-3 font-medium">الفرع</th>
                  <th className="px-5 py-3 font-medium">الحالة</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium">{u.name}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{u.role}</td>
                    <td className="px-5 py-3 text-xs">{u.branch}</td>
                    <td className="px-5 py-3">
                      <span className={u.status === "نشط" ? "px-2 py-0.5 rounded-full text-[11px] bg-risk-good/10 text-risk-good" : "px-2 py-0.5 rounded-full text-[11px] bg-risk-loss/10 text-risk-loss"}>{u.status}</span>
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => { toggleUser(u.id); toast.success(`تم ${u.status === "نشط" ? "إيقاف" : "تفعيل"} ${u.name}`); }} className="text-[11px] text-primary hover:underline">
                        {u.status === "نشط" ? "إيقاف" : "تفعيل"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="سجل التدقيق (Audit Log)" subtitle="جميع الإجراءات في الجلسة الحالية">
          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {audit.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">لا توجد إجراءات بعد</div>}
            {audit.map((a) => (
              <div key={a.id} className="px-5 py-2.5 text-sm flex items-center justify-between hover:bg-muted/30">
                <div className="flex-1">{a.action}</div>
                <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground" lang="en">
                  <span>{a.user}</span><span>{a.ts}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>مستخدم جديد</DialogTitle><DialogDescription>سيتم إرسال بيانات الدخول بالبريد</DialogDescription></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              addUser({ name: String(f.get("name")), role: String(f.get("role")), branch: String(f.get("branch")), status: "نشط" });
              toast.success("تم إضافة المستخدم");
              setAddOpen(false);
            }}
            className="space-y-3"
          >
            <label className="block"><span className="text-xs font-medium">الاسم</span><input name="name" required className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-xs font-medium">الدور</span>
                <select name="role" className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm">
                  <option>مدير المخاطر</option><option>محصل</option><option>محلل ائتمان</option><option>مسؤول قانوني</option><option>مدير فرع</option>
                </select>
              </label>
              <label className="block"><span className="text-xs font-medium">الفرع</span>
                <select name="branch" className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm">
                  {LIBYAN_BRANCHES.map((b) => <option key={b}>{b}</option>)}
                </select>
              </label>
            </div>
            <DialogFooter><Button type="submit">إضافة</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}