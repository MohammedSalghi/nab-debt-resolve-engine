import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LayoutDashboard,
  Users,
  Wallet,
  Gauge,
  Briefcase,
  Scale,
  ShieldCheck,
  Loader2,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Settings,
  Building2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import { cn } from "@/lib/utils";
import nabLogo from "@/assets/nab-logo.png.asset.json";
import ebtekarLogo from "@/assets/ebtekar-raqmi-logo.png.asset.json";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [{ title: "البدء — نظام إدارة المخاطر والائتمان البنكي" }],
  }),
  component: OnboardingPage,
});



// Override to match the user's requested 5 roles exactly
const ROLE_CARDS: { role: AppRole; icon: typeof Wallet; title: string; desc: string }[] = [
  {
    role: "credit_risk_officer",
    icon: Wallet,
    title: "مسؤول ائتمان",
    desc: "إدارة طلبات القروض، تحليل الجدارة الائتمانية، واعتماد التسهيلات.",
  },
  {
    role: "credit_risk_officer",
    icon: Gauge,
    title: "مسؤول مخاطر",
    desc: "تقييم درجة المخاطرة، مراقبة المحفظة، والإنذار المبكر.",
  },
  {
    role: "collection_officer",
    icon: Briefcase,
    title: "مسؤول تحصيل",
    desc: "متابعة الأقساط المتأخرة، إدارة الاتصالات والوعود بالدفع.",
  },
  {
    role: "legal_officer",
    icon: Scale,
    title: "إدارة قانونية",
    desc: "إدارة القضايا، التنفيذ، المحاكم، والإجراءات النظامية.",
  },
  {
    role: "admin",
    icon: Settings,
    title: "مدير النظام",
    desc: "صلاحيات كاملة على المستخدمين، الإعدادات، وقواعد العمل.",
  },
];

const TOUR_SLIDES = [
  {
    icon: LayoutDashboard,
    title: "لوحة التحكم التنفيذية",
    body: "مؤشرات أداء حية للمحفظة الائتمانية: إجمالي القروض، نسبة التعثر NPL، نسبة التحصيل، وأداء الفروع.",
    bullets: [
      "8 بطاقات KPI تفاعلية",
      "رسوم بيانية لتوزيع المخاطر وأعمار الديون",
      "تنبيهات إنذار مبكر فورية",
    ],
    accent: "from-[oklch(0.42_0.12_240)] to-[oklch(0.55_0.18_256)]",
  },
  {
    icon: Users,
    title: "إدارة العملاء",
    body: "قاعدة موحدة لبيانات العملاء مع ملفات شاملة، السجل الائتماني، الضمانات، والتواصل.",
    bullets: ["ملف عميل شامل 360°", "تصنيف مخاطر تلقائي", "بحث وفرز متقدم"],
    accent: "from-[oklch(0.30_0.08_250)] to-[oklch(0.45_0.14_245)]",
  },
  {
    icon: Wallet,
    title: "إدارة القروض والائتمان",
    body: "محفظة كاملة من القروض مع تتبع حالة السداد، DPD، وأرصدة الديون لحظياً.",
    bullets: ["متابعة الأقساط والسداد", "مؤشر تأخر DPD ملوّن", "تقارير المحفظة الفورية"],
    accent: "from-[oklch(0.32_0.08_250)] to-[oklch(0.50_0.16_240)]",
  },
  {
    icon: TrendingUp,
    title: "نظام تقييم المخاطر",
    body: "محرّك ذكي لتقييم المخاطر يصنف العملاء إلى 5 فئات وفق معايير البنك المركزي.",
    bullets: ["تصنيف: عادي / مراقبة / دون المستوى / مشكوك / خسارة", "Gauge تفاعلي لدرجة المخاطر", "تحليل عوامل المخاطرة"],
    accent: "from-[oklch(0.28_0.08_245)] to-[oklch(0.48_0.18_30)]",
  },
  {
    icon: AlertTriangle,
    title: "التحصيل والمتابعة",
    body: "لوحة Kanban لإدارة قوائم التحصيل، سجل المكالمات، الزيارات، والوعود بالدفع.",
    bullets: ["تصنيف حسب درجة الخطورة", "سجل أنشطة كامل لكل عميل", "تكامل مع الإدارة القانونية"],
    accent: "from-[oklch(0.30_0.08_250)] to-[oklch(0.55_0.20_25)]",
  },
];

const TOTAL_STEPS = 4; // welcome | tour | role | done
const PENDING_ONBOARDING_KEY = "credit-core:onboarding-selection";
const ONBOARDING_COMPLETED_KEY = "credit-core:onboarding-completed";

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, profile, refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [tourSlide, setTourSlide] = useState(0);
  const [selectedCard, setSelectedCard] = useState(0); // index into ROLE_CARDS
  const [saving, setSaving] = useState(false);

  const next = () => {
    // On tour step, advance internal slides first
    if (step === 1 && tourSlide < TOUR_SLIDES.length - 1) {
      setTourSlide((s) => s + 1);
      return;
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const back = () => {
    if (step === 1 && tourSlide > 0) {
      setTourSlide((s) => s - 1);
      return;
    }
    setStep((s) => Math.max(s - 1, 0));
  };

  const finish = async () => {
    const role = ROLE_CARDS[selectedCard].role;
    const title = ROLE_CARDS[selectedCard].title;

    if (!user) {
      localStorage.setItem(PENDING_ONBOARDING_KEY, JSON.stringify({ role, title }));
      navigate({ to: "/auth", search: { redirect: "/admin" }, replace: true });
      return;
    }

    setSaving(true);
    try {
      const { error: deleteRoleErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", user.id)
        .neq("role", "admin");
      if (deleteRoleErr) throw deleteRoleErr;

      const { error: roleErr } = await supabase
        .from("user_roles")
        .upsert({ user_id: user.id, role }, { onConflict: "user_id,role" });
      if (roleErr && !roleErr.message.toLowerCase().includes("duplicate")) {
        throw roleErr;
      }

      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          onboarded: true,
          job_title: title,
        })
        .eq("id", user.id);
      if (profErr) throw profErr;

      await refresh();
      sessionStorage.setItem(ONBOARDING_COMPLETED_KEY, "1");
      toast.success("جاهز للانطلاق");
      navigate({ to: "/admin", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر حفظ البيانات");
    } finally {
      setSaving(false);
    }
  };

  const skipToEnd = () => {
    setStep(TOTAL_STEPS - 1);
  };

  // Tour internal progress as fractional contribution to global bar
  const globalProgress =
    step === 0
      ? 1 / TOTAL_STEPS
      : step === 1
        ? (1 + (tourSlide + 1) / TOUR_SLIDES.length) / TOTAL_STEPS
        : (step + 1) / TOTAL_STEPS;

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute -top-40 -right-40 size-[500px] rounded-full blur-3xl pointer-events-none opacity-30"
        style={{ background: "radial-gradient(circle, var(--primary), transparent 70%)" }}
      />
      <div className="absolute -bottom-40 -left-40 size-[500px] rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ background: "radial-gradient(circle, oklch(0.55 0.18 256), transparent 70%)" }}
      />

      {/* Header */}
      <header className="px-6 py-4 border-b border-border/60 bg-card/40 backdrop-blur-xl flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-xl bg-white ring-1 ring-border flex items-center justify-center p-1.5 shadow-sm shrink-0">
            <img src={nabLogo.url} alt="NAB" className="size-full object-contain" />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-base">مصرف شمال أفريقيا</div>
            <div className="text-[10px] font-mono text-muted-foreground mt-0.5">NAB · CREDIT CORE · إعداد أوّلي</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="size-1.5 rounded-full bg-risk-good animate-pulse" />
            الخطوة {step + 1} من {TOTAL_STEPS}
          </div>
          {step < TOTAL_STEPS - 1 && (
            <button onClick={skipToEnd} className="text-xs text-muted-foreground hover:text-foreground transition">
              تخطّي
            </button>
          )}
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-muted/60 relative z-10">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${globalProgress * 100}%`, background: "var(--gradient-primary)" }}
        />
      </div>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-4xl">
          {/* STEP 0: Welcome */}
          {step === 0 && (
            <div className="text-center space-y-6 animate-in fade-in duration-500">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium ring-1 ring-primary/20">
                <Sparkles className="size-3" /> منصة مصرفية ليبية حديثة
              </div>
              <div className="inline-flex size-20 rounded-2xl items-center justify-center mx-auto shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-primary)" }}>
                <ShieldCheck className="size-10 text-primary-foreground" />
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                  مرحباً{profile?.full_name ? `، ${profile.full_name}` : ""}
                </h1>
                <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  أهلاً بك في <strong className="text-foreground">نظام إدارة المخاطر والائتمان البنكي</strong> —
                  منصة مصرفية ليبية حديثة لإدارة المحفظة الائتمانية،
                  تقييم المخاطر، عمليات التحصيل، والإجراءات القانونية في واجهة موحّدة.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-xl mx-auto pt-4">
                {[
                  { icon: Building2, k: "240+", v: "فرع" },
                  { icon: Users, k: "180K", v: "عميل" },
                  { icon: ShieldCheck, k: "ISO 27001", v: "معتمد" },
                ].map((s) => {
                  const I = s.icon;
                  return (
                    <div key={s.v} className="rounded-xl border border-border/60 bg-card/60 backdrop-blur p-3">
                      <I className="size-4 text-primary mb-1.5 mx-auto" />
                      <div className="font-bold font-mono text-sm" lang="en">{s.k}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{s.v}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 1: Tour Slides */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-300" key={tourSlide}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                    جولة سريعة · {tourSlide + 1} / {TOUR_SLIDES.length}
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight mt-1">تعرّف على النظام</h2>
                </div>
                <div className="flex gap-1.5">
                  {TOUR_SLIDES.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setTourSlide(i)}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        i === tourSlide ? "w-8 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/40",
                      )}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-[var(--shadow-elegant)]">
                <div className={cn("h-32 bg-gradient-to-br relative overflow-hidden", TOUR_SLIDES[tourSlide].accent)}>
                  <div className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 30%, white 1px, transparent 1px)",
                      backgroundSize: "32px 32px",
                    }}
                  />
                  <div className="absolute bottom-4 right-6 size-14 rounded-xl bg-white/15 backdrop-blur ring-1 ring-white/20 flex items-center justify-center">
                    {(() => {
                      const I = TOUR_SLIDES[tourSlide].icon;
                      return <I className="size-7 text-white" />;
                    })()}
                  </div>
                </div>

                <div className="p-8 space-y-5">
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight">{TOUR_SLIDES[tourSlide].title}</h3>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-2xl">
                      {TOUR_SLIDES[tourSlide].body}
                    </p>
                  </div>

                  <ul className="grid sm:grid-cols-3 gap-2.5">
                    {TOUR_SLIDES[tourSlide].bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-xs p-3 rounded-lg bg-muted/40 border border-border/50">
                        <Check className="size-3.5 text-risk-good shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Role Selection */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium ring-1 ring-primary/20">
                  <Users className="size-3" /> اختر دورك
                </div>
                <h2 className="text-3xl font-bold tracking-tight mt-4">ما هو دورك في النظام؟</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  سنخصّص واجهة العمل والصلاحيات بحسب طبيعة دورك. يمكن لمدير النظام تعديل ذلك لاحقاً.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ROLE_CARDS.map((card, idx) => {
                  const active = selectedCard === idx;
                  const Icon = card.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedCard(idx)}
                      className={cn(
                        "group relative text-right p-5 rounded-xl border-2 transition-all overflow-hidden",
                        active
                          ? "border-primary bg-primary/5 shadow-[var(--shadow-glow)]"
                          : "border-border bg-card hover:border-primary/40 hover:shadow-sm",
                      )}
                    >
                      {active && (
                        <div className="absolute inset-x-0 top-0 h-1" style={{ background: "var(--gradient-primary)" }} />
                      )}
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className={cn(
                            "size-11 rounded-lg flex items-center justify-center transition-colors",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                          )}
                        >
                          <Icon className="size-5" />
                        </div>
                        <div
                          className={cn(
                            "size-5 rounded-full border-2 flex items-center justify-center transition-all",
                            active ? "border-primary bg-primary" : "border-border",
                          )}
                        >
                          {active && <Check className="size-3 text-primary-foreground" />}
                        </div>
                      </div>
                      <div className="font-bold text-sm">{card.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                        {card.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Done */}
          {step === 3 && (
            <div className="text-center space-y-6 animate-in fade-in duration-500">
              <div className="relative inline-flex size-24 rounded-3xl items-center justify-center mx-auto" style={{ background: "var(--gradient-primary)" }}>
                <div className="absolute inset-0 rounded-3xl animate-ping opacity-30" style={{ background: "var(--gradient-primary)" }} />
                <Check className="size-12 text-primary-foreground relative z-10" strokeWidth={3} />
              </div>
              <div className="space-y-3">
                <h2 className="text-4xl font-bold tracking-tight">كل شيء جاهز</h2>
                <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
                  تم إعداد حسابك بصفة{" "}
                  <strong className="text-foreground">{ROLE_CARDS[selectedCard].title}</strong>.
                  يمكنك الآن الوصول إلى لوحة التحكم وبدء إدارة المحفظة الائتمانية.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl mx-auto pt-4">
                {[
                  { icon: LayoutDashboard, label: "لوحة التحكم" },
                  { icon: Users, label: "العملاء" },
                  { icon: Gauge, label: "المخاطر" },
                  { icon: Briefcase, label: "التحصيل" },
                ].map((q) => {
                  const I = q.icon;
                  return (
                    <div key={q.label} className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border/50 bg-card/60 backdrop-blur">
                      <I className="size-4 text-primary" />
                      <span className="text-[11px] text-muted-foreground">{q.label}</span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={finish}
                disabled={saving}
                className="inline-flex items-center gap-2 px-8 h-12 rounded-lg text-primary-foreground text-sm font-semibold shadow-[var(--shadow-glow)] hover:opacity-95 active:scale-[0.98] transition disabled:opacity-60"
                style={{ background: "var(--gradient-primary)" }}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                ابدأ الاستخدام
                <ArrowLeft className="size-4" />
              </button>
            </div>
          )}

          {/* Footer actions (hidden on done step since CTA is inline) */}
          {step < TOTAL_STEPS - 1 && (
            <div className="mt-10 flex items-center justify-between">
              <button
                onClick={back}
                disabled={(step === 0 && tourSlide === 0) || saving}
                className="px-4 h-10 rounded-md text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center gap-1.5 transition"
              >
                <ArrowRight className="size-4" />
                السابق
              </button>

              <div className="flex items-center gap-1.5">
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === step ? "w-8 bg-primary" : i < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-border",
                    )}
                  />
                ))}
              </div>

              <button
                onClick={next}
                className="px-5 h-10 rounded-md text-primary-foreground text-sm font-semibold flex items-center gap-1.5 hover:opacity-95 active:scale-[0.98] transition shadow-sm"
                style={{ background: "var(--gradient-primary)" }}
              >
                {step === 1 && tourSlide < TOUR_SLIDES.length - 1 ? "التالي" : "متابعة"}
                <ArrowLeft className="size-4" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-border/60 bg-card/40 backdrop-blur relative z-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-muted-foreground font-mono">
        <div>© {new Date().getFullYear()} مصرف شمال أفريقيا · جميع الحقوق محفوظة</div>
        <div className="flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-full bg-white ring-1 ring-border/40 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
            <img src={ebtekarLogo.url} alt="Ebtekar Raqmi" className="h-full w-full object-contain" />
          </div>
          <span>Powered by</span>
          <span className="font-semibold text-foreground/80">Ebtekar Raqmi Co.</span>
        </div>
      </footer>
    </div>
  );
}
