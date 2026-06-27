import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Phone, MapPin, Mail, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { AppShell, Card, PageHeader } from "@/components/app-shell";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStore, type Activity } from "@/lib/store";
import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/collections")({
  head: () => ({ meta: [{ title: "عمليات التحصيل — نظام الائتمان البنكي" }] }),
  component: CollectionsPage,
});

const COLUMNS: { id: Activity["stage"]; label: string; tone: string }[] = [
  { id: "todo", label: "للمتابعة", tone: "watch" },
  { id: "calling", label: "قيد الاتصال", tone: "sub" },
  { id: "promised", label: "وعد بالدفع", tone: "good" },
  { id: "escalated", label: "تصعيد قانوني", tone: "loss" },
];

const actionIcon: Record<string, typeof Phone> = { "مكالمة هاتفية": Phone, "تذكير SMS": Mail, "إحالة قانونية": FileText, "زيارة ميدانية": MapPin };

function CollectionsPage() {
  const { activities, customers, addActivity, moveActivity } = useStore();
  const [addOpen, setAddOpen] = useState(false);

  const byStage = useMemo(() => {
    const m: Record<Activity["stage"], Activity[]> = { todo: [], calling: [], promised: [], escalated: [] };
    activities.forEach((a) => { (m[a.stage] ?? m.todo).push(a); });
    return m;
  }, [activities]);

  const onDragEnd = (e: DragEndEvent) => {
    const id = Number(e.active.id);
    const over = e.over?.id as Activity["stage"] | undefined;
    if (!over) return;
    moveActivity(id, over);
    toast.success(`تم نقل المهمة → ${COLUMNS.find((c) => c.id === over)?.label}`);
  };

  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <PageHeader
          title="عمليات التحصيل"
          subtitle="لوحة عمل تفاعلية مع سحب وإفلات"
          actions={
            <button onClick={() => setAddOpen(true)} className="px-3 py-2 text-xs rounded-md bg-primary text-primary-foreground inline-flex items-center gap-1.5">
              <Plus className="size-3.5" /> تسجيل نشاط
            </button>
          }
        />

        <DndContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {COLUMNS.map((col) => (
              <Column key={col.id} {...col} items={byStage[col.id]} />
            ))}
          </div>
        </DndContext>

        <Card title="جميع الأنشطة">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">العميل</th>
                  <th className="px-5 py-3 font-medium">النشاط</th>
                  <th className="px-5 py-3 font-medium">المسؤول</th>
                  <th className="px-5 py-3 font-medium">التاريخ</th>
                  <th className="px-5 py-3 font-medium">النتيجة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activities.slice(0, 15).map((a) => {
                  const Icon = actionIcon[a.action] ?? RefreshCw;
                  return (
                    <tr key={a.id} className="hover:bg-muted/30">
                      <td className="px-5 py-3 font-medium">{a.customer}</td>
                      <td className="px-5 py-3"><span className="inline-flex items-center gap-2 text-xs"><Icon className="size-3.5 text-muted-foreground" />{a.action}</span></td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{a.agent}</td>
                      <td className="px-5 py-3 font-mono text-xs" lang="en">{a.date}</td>
                      <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full text-[11px] bg-accent">{a.outcome}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تسجيل نشاط تحصيل</DialogTitle><DialogDescription>سيُسجل في سجل التحصيل والتدقيق</DialogDescription></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const customerId = String(f.get("customerId"));
              const customer = customers.find((c) => c.id === customerId);
              if (!customer) return;
              addActivity({
                customerId, customer: customer.name,
                action: String(f.get("action")), agent: String(f.get("agent") || "أحمد الزهراني"),
                note: String(f.get("note")), outcome: String(f.get("outcome")), stage: "todo",
              });
              toast.success("تم تسجيل النشاط");
              setAddOpen(false);
            }}
            className="space-y-3"
          >
            <label className="block"><span className="text-xs font-medium">العميل</span>
              <select name="customerId" required className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm">
                {customers.filter((c) => c.dpd > 0).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-xs font-medium">النوع</span>
                <select name="action" className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm">
                  <option>مكالمة هاتفية</option><option>تذكير SMS</option><option>زيارة ميدانية</option><option>وعد بالدفع</option>
                </select>
              </label>
              <label className="block"><span className="text-xs font-medium">النتيجة</span>
                <select name="outcome" className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm">
                  <option>وعد بالدفع</option><option>لا رد</option><option>تمت التسوية</option><option>إحالة</option>
                </select>
              </label>
            </div>
            <label className="block"><span className="text-xs font-medium">ملاحظات</span>
              <textarea name="note" rows={3} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm" />
            </label>
            <DialogFooter><Button type="submit">حفظ النشاط</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Column({ id, label, tone, items }: { id: Activity["stage"]; label: string; tone: string; items: Activity[] }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn("bg-card border border-border rounded-xl p-3 min-h-96 transition-colors", isOver && "ring-2 ring-primary")}>
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: `var(--risk-${tone})` }} />
          <span className="text-sm font-bold">{label}</span>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground" lang="en">{fmtInt(items.length)}</span>
      </div>
      <div className="space-y-2">
        {items.slice(0, 8).map((a) => <DraggableCard key={a.id} a={a} />)}
        {items.length === 0 && <div className="text-center text-xs text-muted-foreground py-8">لا توجد مهام</div>}
      </div>
    </div>
  );
}

function DraggableCard({ a }: { a: Activity }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: a.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef} {...listeners} {...attributes} style={style}
      className={cn("p-3 rounded-lg border border-border bg-background hover:border-primary/40 cursor-grab active:cursor-grabbing", isDragging && "opacity-50 shadow-lg")}
    >
      <div className="text-xs font-semibold truncate">{a.customer}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{a.action}</div>
      <div className="text-[10px] font-mono text-muted-foreground mt-2" lang="en">{a.date}</div>
    </div>
  );
}