import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Shield, Lock, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth, type AppRole } from "@/lib/auth";
import nabLogo from "@/assets/nab-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — نظام الائتمان البنكي" },
      {
        name: "description",
        content: "صفحة الدخول الآمنة لمنصة إدارة الائتمان والمخاطر والتحصيل.",
      },
    ],
  }),
  component: AuthPage,
});

type AuthRedirectTarget =
  | "/admin"
  | "/aging"
  | "/collateral"
  | "/collections"
  | "/customers"
  | "/dashboard"
  | "/early-warning"
  | "/legal"
  | "/loans"
  | "/notifications"
  | "/onboarding"
  | "/reports"
  | "/risk";

const AUTH_REDIRECT_TARGETS = new Set<AuthRedirectTarget>([
  "/admin",
  "/aging",
  "/collateral",
  "/collections",
  "/customers",
  "/dashboard",
  "/early-warning",
  "/legal",
  "/loans",
  "/notifications",
  "/onboarding",
  "/reports",
  "/risk",
]);

const PENDING_ONBOARDING_KEY = "credit-core:onboarding-selection";
const ONBOARDING_COMPLETED_KEY = "credit-core:onboarding-completed";
const ALLOWED_PENDING_ROLES = new Set<AppRole>([
  "admin",
  "credit_risk_officer",
  "collection_officer",
  "legal_officer",
  "branch_manager",
  "executive",
]);

async function completePendingOnboarding(userId: string, refresh: () => Promise<void>) {
  const raw = localStorage.getItem(PENDING_ONBOARDING_KEY);
  if (!raw) return false;

  const parsed = JSON.parse(raw) as { role?: AppRole; title?: string };
  const role = parsed.role;
  if (!role || !ALLOWED_PENDING_ROLES.has(role)) {
    localStorage.removeItem(PENDING_ONBOARDING_KEY);
    return false;
  }

  const { error: deleteRoleErr } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .neq("role", "admin");
  if (deleteRoleErr) throw deleteRoleErr;

  const { error: roleErr } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
  if (roleErr && !roleErr.message.toLowerCase().includes("duplicate")) {
    throw roleErr;
  }

  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ onboarded: true, job_title: parsed.title ?? null })
    .eq("id", userId);
  if (profileErr) throw profileErr;

  localStorage.removeItem(PENDING_ONBOARDING_KEY);
  sessionStorage.setItem(ONBOARDING_COMPLETED_KEY, "1");
  await refresh();
  return true;
}

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { session, profile, refresh, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [finalizingOnboarding, setFinalizingOnboarding] = useState(false);

  // Redirect away if already signed in (reacts when AuthProvider hydrates)
  useEffect(() => {
    if (authLoading || !session) return;
    let cancelled = false;

    const redirectAfterAuth = async () => {
      setFinalizingOnboarding(true);
      try {
        const target = getSafeRedirect(redirect);
        const completed = await completePendingOnboarding(session.user.id, refresh);
        if (cancelled) return;
        navigate({
          to: completed || profile?.onboarded ? target : "/onboarding",
          replace: true,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذّر إكمال الإعداد");
        if (!cancelled) navigate({ to: "/onboarding", replace: true });
      } finally {
        if (!cancelled) setFinalizingOnboarding(false);
      }
    };

    void redirectAfterAuth();
    return () => {
      cancelled = true;
    };
  }, [authLoading, session, profile, refresh, navigate, redirect]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (mode === "signup") {
        if (password.length < 6) {
          toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب بنجاح");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("مرحباً بعودتك");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "حدث خطأ";
      toast.error(
        message.toLowerCase().includes("invalid")
          ? "بيانات الدخول غير صحيحة"
          : message.toLowerCase().includes("registered")
            ? "هذا البريد مسجّل مسبقاً"
            : message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    if (oauthLoading) return;
    setOauthLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("تعذّر تسجيل الدخول عبر Google");
        setOauthLoading(false);
      }
    } catch {
      toast.error("تعذّر تسجيل الدخول عبر Google");
      setOauthLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex bg-background text-foreground">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[42%] p-12 text-primary-foreground relative overflow-hidden" style={{ background: "var(--gradient-primary)" }}>
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: "linear-gradient(var(--primary-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--primary-foreground) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="absolute inset-0 opacity-[0.10] pointer-events-none">
          <div className="absolute -top-20 -right-20 size-96 rounded-full bg-white blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
          <div className="absolute bottom-10 left-10 size-72 rounded-full bg-[oklch(0.55_0.18_256)] blur-3xl animate-pulse" style={{ animationDuration: "8s" }} />
        </div>
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-lg bg-white ring-1 ring-primary-foreground/20 flex items-center justify-center p-1 shrink-0">
              <img src={nabLogo.url} alt="NAB" className="size-full object-contain" />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-base">مصرف شمال أفريقيا</div>
              <div className="text-[10px] font-mono text-primary-foreground/60">
                NAB · CREDIT CORE
              </div>
            </div>
          </div>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight">
            منصة متكاملة لإدارة <br />
            الائتمان والمخاطر والتحصيل
          </h1>
          <p className="text-sm xl:text-base text-primary-foreground/70 leading-relaxed max-w-md">
            تجربة مصرفية احترافية تجمع تقييم المخاطر، إدارة المحفظة، التحصيل،
            والإجراءات القانونية في واجهة واحدة.
          </p>
          <div className="grid grid-cols-3 gap-3 pt-4">
            {[
              { k: "محفظة", v: "2.4M+" },
              { k: "عملاء", v: "180K" },
              { k: "فروع", v: "240" },
            ].map((s) => (
              <div
                key={s.k}
                className="rounded-lg bg-primary-foreground/10 ring-1 ring-primary-foreground/15 p-3"
              >
                <div className="text-xl font-bold font-mono">{s.v}</div>
                <div className="text-[11px] text-primary-foreground/70 mt-0.5">{s.k}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-[11px] text-primary-foreground/60">
          <Shield className="size-3.5" />
          <span>اتصال مشفّر · TLS 1.3 · مصادقة متعددة العوامل</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src={nabLogo.url} alt="NAB" className="size-10 rounded-md bg-white p-0.5 object-contain" />
            <div className="leading-tight">
              <div className="font-bold text-sm">مصرف شمال أفريقيا</div>
              <div className="text-[10px] font-mono text-muted-foreground">NAB · CREDIT CORE</div>
            </div>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              {mode === "signin"
                ? "أدخل بيانات الاعتماد للوصول إلى لوحة التحكم"
                : "أنشئ حساباً للوصول إلى المنصة"}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">الاسم الكامل</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: أحمد العتيبي"
                  required
                  className="w-full h-11 px-4 rounded-md border border-input bg-card focus:border-ring focus:ring-2 focus:ring-ring/20 outline-none transition text-sm"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@bank.sa"
                  required
                  autoComplete="email"
                  className="w-full h-11 pr-10 pl-4 rounded-md border border-input bg-card focus:border-ring focus:ring-2 focus:ring-ring/20 outline-none transition text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">كلمة المرور</label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => toast.info("سيتم التواصل مع إدارة النظام لإعادة التعيين")}
                    className="text-[11px] text-primary hover:underline"
                  >
                    نسيت كلمة المرور؟
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  className="w-full h-11 pr-10 pl-10 rounded-md border border-input bg-card focus:border-ring focus:ring-2 focus:ring-ring/20 outline-none transition text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {mode === "signin" && (
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="size-4 accent-primary"
                />
                تذكّرني على هذا الجهاز
              </label>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-md bg-primary text-primary-foreground font-semibold text-sm shadow-sm hover:opacity-95 active:scale-[0.99] transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {mode === "signin" ? "تسجيل الدخول" : "إنشاء الحساب"}
            </button>
          </form>

          {finalizingOnboarding && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> جاري تجهيز حسابك...
            </div>
          )}

          <div className="my-6 flex items-center gap-3 text-[11px] text-muted-foreground">
            <div className="flex-1 h-px bg-border" />
            <span>أو</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={onGoogle}
            disabled={oauthLoading}
            className="w-full h-11 rounded-md border border-input bg-card hover:bg-accent font-medium text-sm flex items-center justify-center gap-2 transition disabled:opacity-60"
          >
            {oauthLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <svg className="size-4" viewBox="0 0 48 48">
                <path
                  fill="#4285F4"
                  d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
                />
                <path
                  fill="#34A853"
                  d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
                />
                <path
                  fill="#FBBC05"
                  d="M11.69 28.18A13.99 13.99 0 0 1 10.96 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
                />
                <path
                  fill="#EA4335"
                  d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.07 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7C13.42 14.62 18.27 10.75 24 10.75z"
                />
              </svg>
            )}
            متابعة باستخدام Google
          </button>

          <p className="mt-7 text-center text-xs text-muted-foreground">
            {mode === "signin" ? (
              <>
                لا تملك حساباً؟{" "}
                <button
                  onClick={() => setMode("signup")}
                  className="text-primary font-medium hover:underline"
                >
                  إنشاء حساب جديد
                </button>
              </>
            ) : (
              <>
                لديك حساب؟{" "}
                <button
                  onClick={() => setMode("signin")}
                  className="text-primary font-medium hover:underline"
                >
                  تسجيل الدخول
                </button>
              </>
            )}
          </p>

          <p className="mt-6 text-center text-[10px] text-muted-foreground">
            بدخولك إلى المنصة فإنك توافق على{" "}
            <Link to="/" className="underline">شروط الاستخدام</Link> وسياسة الخصوصية.
          </p>
        </div>
      </div>
    </div>
  );
}

function getSafeRedirect(redirect?: string): AuthRedirectTarget {
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
    return "/dashboard";
  }
  const pathname = redirect.split(/[?#]/)[0];
  if (pathname === "/" || pathname.startsWith("/auth") || pathname.startsWith("/onboarding")) {
    return "/dashboard";
  }
  return AUTH_REDIRECT_TARGETS.has(pathname as AuthRedirectTarget)
    ? (pathname as AuthRedirectTarget)
    : "/dashboard";
}
