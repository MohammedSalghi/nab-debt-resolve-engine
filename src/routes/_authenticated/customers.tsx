import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Filter, Plus, Printer, Pencil, Trash2, Scale } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, PageHeader, RiskBadge } from "@/components/app-shell";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useStore, type Customer } from "@/lib/store";
import { dpdToBucket, LIBYAN_BRANCHES, riskLabels } from "@/lib/mock-data";
import { fmtCurrency, fmtDPD, fmtInt } from "@/lib/format";
import { downloadCSV } from "@/lib/export-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "إدارة العملاء — نظام الائتمان البنكي" }] }),
  component: CustomersPage,
});

type SortKey = "id" | "name" | "score" | "debt" | "dpd";

function CustomersPage() {
  const { customers, addCustomer, updateCustomer, removeCustomer } = useStore();
  const [search, setSearch] = useState("");
  const [branchF, setBranchF] = useState("all");
  const [riskF, setRiskF] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "id", dir: "asc" });
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [removing, setRemoving] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    let list = customers;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.nationalId.includes(q) || c.phone.includes(q));
    if (branchF !== "all") list = list.filter((c) => c.branch === branchF);
    if (riskF !== "all") list = list.filter((c) => c.risk === riskF);
    list = [...list].sort((a, b) => {
      const av = a[sort.key] as string | number;
      const bv = b[sort.key] as string | number;
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [customers, search, branchF, riskF, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (k: SortKey) => setSort((s) => ({ key: k, dir: s.key === k && s.dir === "asc" ? "desc" : "asc" }));
  const sortIcon = (k: SortKey) => sort.key !== k ? null : sort.dir === "asc" ? <ArrowUp className="size-3 inline" /> : <ArrowDown className="size-3 inline" />;

  const totals = {
    total: customers.length,
    active: customers.filter((c) => c.dpd <= 30).length,
    watch: customers.filter((c) => c.dpd > 30 && c.dpd <= 90).length,
    npl: customers.filter((c) => c.dpd > 90).length,
  };

  const handleExport = () => {
    toast.info("جاري إعداد الملف...");
    downloadCSV(
      `customers-${new Date().toISOString().slice(0, 10)}.csv`,
      ["رقم", "الاسم", "النوع", "الفرع", "رقم وطني", "هاتف", "التقييم", "المخاطر", "المديونية", "DPD"],
      filtered.map((c) => [c.id, c.name, c.type, c.branch, c.nationalId, c.phone, c.score, riskLabels[c.risk], c.debt, c.dpd]),
    );
    toast.success("تم تحميل الملف");
  };

  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <PageHeader
          title="إدارة العملاء"
          subtitle="قاعدة بيانات العملاء مع التقييم الائتماني والمخاطر"
          actions={
            <>
              <button onClick={handleExport} className="px-3 py-2 text-xs rounded-md border border-border hover:bg-accent inline-flex items-center gap-1.5">
                <Download className="size-3.5" /> تصدير CSV
              </button>
              <button onClick={() => window.print()} className="px-3 py-2 text-xs rounded-md border border-border hover:bg-accent inline-flex items-center gap-1.5">
                <Printer className="size-3.5" /> طباعة
              </button>
              <button onClick={() => setAddOpen(true)} className="px-3 py-2 text-xs rounded-md bg-primary text-primary-foreground inline-flex items-center gap-1.5">
                <Plus className="size-3.5" /> عميل جديد
              </button>
            </>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { l: "إجمالي العملاء", v: totals.total },
            { l: "نشطون", v: totals.active },
            { l: "تحت المراقبة", v: totals.watch },
            { l: "متعثرون", v: totals.npl },
          ].map((s) => (
            <div key={s.l} className="bg-card border border-border rounded-xl p-4">
              <div className="text-[11px] text-muted-foreground">{s.l}</div>
              <div className="text-2xl font-bold tabular mt-1" lang="en">{fmtInt(s.v)}</div>
            </div>
          ))}
        </div>

        <Card>
          <div className="p-4 border-b border-border flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="ابحث بالاسم، الرقم الوطني، أو الهاتف..."
                className="w-full bg-muted/60 rounded-md py-2 pr-10 pl-4 text-sm outline-none"
              />
            </div>
            <select value={branchF} onChange={(e) => { setBranchF(e.target.value); setPage(1); }} className="text-xs bg-muted/60 rounded-md py-2 px-3">
              <option value="all">كل الفروع</option>
              {LIBYAN_BRANCHES.map((b) => <option key={b}>{b}</option>)}
            </select>
            <select value={riskF} onChange={(e) => { setRiskF(e.target.value); setPage(1); }} className="text-xs bg-muted/60 rounded-md py-2 px-3">
              <option value="all">كل المخاطر</option>
              {Object.entries(riskLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <span className="text-xs text-muted-foreground" lang="en">{fmtInt(filtered.length)} نتيجة</span>
          </div>

          {paged.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              {search ? `لا توجد نتائج للبحث عن "${search}"` : "لا توجد بيانات"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {(["id", "name", "score", "dpd", "debt"] as SortKey[]).map((k) => (
                      <th key={k} className="px-5 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort(k)}>
                        {({ id: "رقم العميل", name: "الاسم", score: "التقييم", dpd: "DPD", debt: "المديونية" } as any)[k]} {sortIcon(k)}
                      </th>
                    ))}
                    <th className="px-5 py-3 font-medium">النوع</th>
                    <th className="px-5 py-3 font-medium">الفرع</th>
                    <th className="px-5 py-3 font-medium">المخاطر</th>
                    <th className="px-5 py-3 font-medium">أعمار</th>
                    <th className="px-5 py-3 font-medium">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paged.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="px-5 py-3 font-mono text-xs text-primary" lang="en">{c.id}</td>
                      <td className="px-5 py-3 font-medium">{c.name}</td>
                      <td className="px-5 py-3" lang="en">
                        <div className="flex items-center gap-2">
                          <span className="tabular font-semibold">{fmtInt(c.score)}</span>
                          <div className="w-16 h-1 bg-muted rounded-full">
                            <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: c.score >= 70 ? "var(--risk-good)" : c.score >= 50 ? "var(--risk-sub)" : "var(--risk-loss)" }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 tabular font-mono text-xs" lang="en">{c.dpd > 0 ? fmtDPD(c.dpd) : "—"}</td>
                      <td className="px-5 py-3 tabular" lang="en">{fmtCurrency(c.debt)}</td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{c.type}</td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{c.branch}</td>
                      <td className="px-5 py-3"><RiskBadge risk={c.risk} label={riskLabels[c.risk]} /></td>
                      <td className="px-5 py-3 font-mono text-xs" lang="en">{dpdToBucket(c.dpd)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditing(c)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground" title="تعديل">
                            <Pencil className="size-3.5" />
                          </button>
                          <button onClick={() => { toast.warning(`تم إنشاء القضية رقم LC-2025-${100 + Math.floor(Math.random() * 999)}`); }} className="p-1.5 rounded-md hover:bg-accent text-risk-sub" title="إحالة قانونية">
                            <Scale className="size-3.5" />
                          </button>
                          <button onClick={() => setRemoving(c)} className="p-1.5 rounded-md hover:bg-accent text-destructive" title="حذف">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between p-4 border-t border-border">
            <div className="text-xs text-muted-foreground" lang="en">
              صفحة {fmtInt(safePage)} من {fmtInt(totalPages)}
            </div>
            <div className="flex gap-1">
              <button disabled={safePage === 1} onClick={() => setPage(safePage - 1)} className="px-3 py-1.5 text-xs rounded-md border border-border disabled:opacity-50 hover:bg-accent">السابق</button>
              <button disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)} className="px-3 py-1.5 text-xs rounded-md border border-border disabled:opacity-50 hover:bg-accent">التالي</button>
            </div>
          </div>
        </Card>
      </div>

      <CustomerForm
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={(data) => {
          addCustomer(data);
          toast.success("تم الحفظ بنجاح");
          setAddOpen(false);
        }}
      />
      <CustomerForm
        open={editing !== null}
        existing={editing}
        onClose={() => setEditing(null)}
        onSubmit={(data) => {
          if (editing) updateCustomer(editing.id, data);
          toast.success("تم الحفظ بنجاح");
          setEditing(null);
        }}
      />
      <AlertDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف العميل {removing?.name}؟ لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className={cn("bg-destructive text-destructive-foreground")}
              onClick={() => { if (removing) { removeCustomer(removing.id); toast.success("تم الحذف"); } setRemoving(null); }}
            >
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function CustomerForm({ open, onClose, onSubmit, existing }: { open: boolean; onClose: () => void; onSubmit: (d: any) => void; existing?: Customer | null }) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries()) as Record<string, string>;
    const errs: Record<string, string> = {};
    if (!data.name) errs.name = "الاسم مطلوب";
    if (!/^\d{12}$/.test(data.nationalId)) errs.nationalId = "الرقم الوطني يجب أن يكون 12 رقماً";
    if (!/^09\d{8}$/.test(data.phone)) errs.phone = "رقم الهاتف بصيغة 09xxxxxxxx";
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("يرجى تصحيح الأخطاء");
      return;
    }
    onSubmit({ name: data.name, type: data.type as "فرد" | "شركة", branch: data.branch, nationalId: data.nationalId, phone: data.phone });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{existing ? "تعديل بيانات العميل" : "إضافة عميل جديد"}</DialogTitle>
          <DialogDescription>أدخل بيانات العميل بشكل كامل</DialogDescription>
        </DialogHeader>
        <form onSubmit={handle} className="space-y-3">
          <Field label="الاسم الكامل" error={errors.name}>
            <input name="name" defaultValue={existing?.name} className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="النوع">
              <select name="type" defaultValue={existing?.type ?? "فرد"} className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm">
                <option>فرد</option><option>شركة</option>
              </select>
            </Field>
            <Field label="الفرع">
              <select name="branch" defaultValue={existing?.branch ?? LIBYAN_BRANCHES[0]} className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm">
                {LIBYAN_BRANCHES.map((b) => <option key={b}>{b}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الرقم الوطني" error={errors.nationalId}>
              <input name="nationalId" defaultValue={existing?.nationalId} maxLength={12} className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono" placeholder="123456789012" />
            </Field>
            <Field label="رقم الهاتف" error={errors.phone}>
              <input name="phone" defaultValue={existing?.phone} maxLength={10} className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono" placeholder="0912345678" />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
            <Button type="submit">حفظ</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium">{label}</span>
      <div className="mt-1">{children}</div>
      {error && <span className="text-[11px] text-destructive mt-1 block">{error}</span>}
    </label>
  );
}