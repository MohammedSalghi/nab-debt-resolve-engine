import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { AppShell, Card, PageHeader } from "@/components/app-shell";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { fmtInt } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "مركز الإشعارات — نظام الائتمان البنكي" }] }),
  component: NotificationsPage,
});

const TABS = [
  { id: "all", label: "الكل" },
  { id: "unread", label: "غير مقروء" },
  { id: "تنبيهات", label: "تنبيهات" },
  { id: "تذكيرات", label: "تذكيرات" },
];

function NotificationsPage() {
  const { notifications, markAllRead, markRead } = useStore();
  const [tab, setTab] = useState("all");

  const list = notifications.filter((n) => {
    if (tab === "all") return true;
    if (tab === "unread") return n.unread;
    return n.type === tab;
  });

  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <PageHeader
          title="مركز الإشعارات"
          subtitle="جميع التنبيهات والإشعارات في مكان واحد"
          actions={<button onClick={() => { markAllRead(); toast.success("تم تعليم الكل كمقروء"); }} className="text-xs px-3 py-2 rounded-md border border-border">تعليم الكل كمقروء</button>}
        />
        <Card>
          <div className="p-3 border-b border-border flex gap-2 flex-wrap">
            {TABS.map((t) => {
              const count = t.id === "all" ? notifications.length : t.id === "unread" ? notifications.filter((n) => n.unread).length : notifications.filter((n) => n.type === t.id).length;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} className={cn("text-xs px-3 py-1.5 rounded-full", tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent")}>
                  {t.label} <span lang="en">({fmtInt(count)})</span>
                </button>
              );
            })}
          </div>
          <div className="divide-y divide-border">
            {list.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">لا توجد إشعارات</div>}
            {list.map((n) => (
              <button key={n.id} onClick={() => markRead(n.id)} className={cn("w-full text-right flex items-start gap-3 p-4 hover:bg-muted/30", n.unread && "bg-primary/5")}>
                <div className="size-9 rounded-full bg-accent flex items-center justify-center text-muted-foreground shrink-0">
                  <Bell className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2">
                    <div className="font-semibold text-sm">{n.title}</div>
                    <div className="text-[11px] text-muted-foreground font-mono" lang="en">{n.time}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{n.body}</div>
                  <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-accent">{n.type}</span>
                </div>
                {n.unread && <span className="size-2 rounded-full bg-primary mt-2 shrink-0" />}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}