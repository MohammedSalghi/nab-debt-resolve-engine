import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  Wallet,
  Gauge,
  AlertTriangle,
  CalendarClock,
  Briefcase,
  Scale,
  Shield,
  FileBarChart,
  Bell,
  Settings,
  Search,
  Moon,
  Sun,
  LogOut,
  PanelRightClose,
  PanelLeftClose,
  User as UserIcon,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStore } from "@/lib/store";
import { fmtInt } from "@/lib/format";
import { toast } from "sonner";
import { useAuth, ROLE_LABELS } from "@/lib/auth";
import { useNavigate as useNav } from "@tanstack/react-router";

const navGroups = [
  {
    label: "نظرة عامة",
    items: [
      { to: "/dashboard", icon: LayoutDashboard, label: "لوحة التحكم التنفيذية" },
    ],
  },
  {
    label: "العملاء والائتمان",
    items: [
      { to: "/customers", icon: Users, label: "إدارة العملاء" },
      { to: "/loans", icon: Wallet, label: "محفظة القروض" },
      { to: "/risk", icon: Gauge, label: "محرك تقييم المخاطر" },
    ],
  },
  {
    label: "المخاطر والإنذار",
    items: [
      { to: "/early-warning", icon: AlertTriangle, label: "الإنذار المبكر" },
      { to: "/aging", icon: CalendarClock, label: "أعمار الديون" },
    ],
  },
  {
    label: "التحصيل والقانون",
    items: [
      { to: "/collections", icon: Briefcase, label: "عمليات التحصيل" },
      { to: "/legal", icon: Scale, label: "القضايا القانونية" },
      { to: "/collateral", icon: Shield, label: "إدارة الضمانات" },
    ],
  },
  {
    label: "النظام",
    items: [
      { to: "/reports", icon: FileBarChart, label: "التقارير والتحليلات" },
      { to: "/notifications", icon: Bell, label: "مركز الإشعارات" },
      { to: "/admin", icon: Settings, label: "لوحة الإدارة" },
    ],
  },
];

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("theme")) as
      | "light"
      | "dark"
      | null;
    const initial = saved ?? "light";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
  };
  return { theme, toggle };
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const { notifications, customers, loans, markAllRead, markRead } = useStore();
  const unread = notifications.filter((n) => n.unread).length;

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const cs = customers.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.nationalId.includes(q) || c.phone.includes(q)).slice(0, 5);
    const ls = loans.filter((l) => l.id.toLowerCase().includes(q) || l.customer.toLowerCase().includes(q)).slice(0, 5);
    return { cs, ls };
  }, [search, customers, loans]);

  const sidebarW = collapsed ? "w-16" : "w-64";
  const mainOffset = collapsed ? "mr-16" : "mr-64";

  return (
    <div dir="rtl" className="flex min-h-screen bg-background text-foreground">
      <aside className={cn("fixed inset-y-0 right-0 border-l border-sidebar-border bg-sidebar flex flex-col z-20 transition-all duration-200", sidebarW)}>
        <div className="h-16 flex items-center gap-3 px-4 border-b border-sidebar-border">
          <div className="size-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">ج</div>
          {!collapsed && (
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="font-bold text-sm tracking-tight text-sidebar-foreground whitespace-nowrap">نظام الائتمان البنكي</span>
              <span className="text-[10px] text-muted-foreground font-mono">CREDIT CORE · v1.0</span>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.to;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-primary font-medium ring-1 ring-sidebar-border"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <UserMenu collapsed={collapsed} />
        </div>
      </aside>

      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-200", mainOffset)}>
        <header className="h-16 border-b border-border bg-card/70 backdrop-blur-xl sticky top-0 z-10 flex items-center px-6 gap-4 relative">
          <div className="absolute inset-x-0 -bottom-px h-px" style={{ background: "linear-gradient(90deg, transparent, var(--primary), transparent)", opacity: 0.4 }} />
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-2 rounded-md hover:bg-accent text-muted-foreground"
            title="طي/توسيع القائمة"
          >
            {collapsed ? <PanelLeftClose className="size-4" /> : <PanelRightClose className="size-4" />}
          </button>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن عميل، قرض، أو رقم وطني..."
              className="w-full bg-muted/60 border border-transparent focus:border-ring focus:bg-card rounded-md py-2 pr-10 pl-4 text-sm outline-none transition-colors"
            />
            {searchResults && (searchResults.cs.length > 0 || searchResults.ls.length > 0) && (
              <div className="absolute top-full right-0 left-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-30 max-h-80 overflow-y-auto">
                {searchResults.cs.map((c) => (
                  <button key={c.id} onClick={() => { setSearch(""); navigate({ to: "/customers" }); }} className="w-full text-right px-3 py-2 hover:bg-accent text-sm flex justify-between items-center">
                    <span className="text-muted-foreground text-xs font-mono">{c.id}</span>
                    <span>{c.name}</span>
                  </button>
                ))}
                {searchResults.ls.map((l) => (
                  <button key={l.id} onClick={() => { setSearch(""); navigate({ to: "/loans" }); }} className="w-full text-right px-3 py-2 hover:bg-accent text-sm flex justify-between items-center border-t border-border">
                    <span className="text-muted-foreground text-xs font-mono">{l.id}</span>
                    <span>{l.customer}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/60 text-xs font-mono">
              <span className="size-1.5 rounded-full bg-risk-good animate-pulse" />
              <span className="text-muted-foreground">حالة النظام:</span>
              <span className="text-risk-good">مستقر</span>
            </div>
            <button onClick={toggle} className="p-2 rounded-md hover:bg-accent text-muted-foreground" title="الوضع الليلي">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger className="relative p-2 rounded-md hover:bg-accent text-muted-foreground">
                <Bell className="size-4" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -left-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center font-mono">
                    {fmtInt(unread)}
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between p-2">
                  <DropdownMenuLabel className="p-0">الإشعارات</DropdownMenuLabel>
                  <button
                    onClick={() => { markAllRead(); toast.success("تم تعليم جميع الإشعارات كمقروءة"); }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    تعليم الكل كمقروء
                  </button>
                </div>
                <DropdownMenuSeparator />
                <div className="max-h-80 overflow-y-auto">
                  {notifications.slice(0, 6).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => { markRead(n.id); navigate({ to: "/notifications" }); }}
                      className={cn("w-full text-right p-3 hover:bg-accent border-b border-border last:border-0", n.unread && "bg-primary/5")}
                    >
                      <div className="flex justify-between gap-2">
                        <div className="text-xs font-semibold">{n.title}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{n.time}</div>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 text-right">{n.body}</div>
                    </button>
                  ))}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/notifications" })} className="justify-center text-primary">
                  عرض كل الإشعارات
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { profile, user, primaryRole, signOut } = useAuth();
  const nav = useNav();
  const displayName = profile?.full_name || user?.email || "مستخدم";
  const email = user?.email ?? "";
  const initials = displayName
    .split(" ")
    .map((p: string) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "w-full flex items-center gap-3 p-2 rounded-md hover:bg-sidebar-accent transition text-right",
          collapsed && "justify-center",
        )}
      >
        <div className="size-8 rounded-full bg-gradient-to-br from-primary to-[oklch(0.42_0.12_240)] text-primary-foreground flex items-center justify-center text-[11px] font-bold shrink-0">
          {initials}
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-xs font-semibold truncate">{displayName}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {primaryRole ? ROLE_LABELS[primaryRole] : "—"}
            </div>
          </div>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel className="text-xs truncate">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => nav({ to: "/admin" })}>
          <UserIcon className="size-3.5 ml-2" /> الملف الشخصي
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast.info("سيتم إضافة هذه الميزة قريباً")}>
          <KeyRound className="size-3.5 ml-2" /> تغيير كلمة المرور
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            nav({ to: "/auth", replace: true });
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="size-3.5 ml-2" /> تسجيل الخروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function RiskBadge({ risk, label }: { risk: string; label: string }) {
  const map: Record<string, string> = {
    good: "bg-risk-good/10 text-risk-good ring-risk-good/20",
    watch: "bg-risk-watch/10 text-risk-watch ring-risk-watch/20",
    sub: "bg-risk-sub/10 text-risk-sub ring-risk-sub/20",
    doubt: "bg-risk-doubt/10 text-risk-doubt ring-risk-doubt/20",
    loss: "bg-risk-loss/10 text-risk-loss ring-risk-loss/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1",
        map[risk] ?? map.watch,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function Card({
  children,
  className,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            {title && <h3 className="text-sm font-bold">{title}</h3>}
            {subtitle && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}