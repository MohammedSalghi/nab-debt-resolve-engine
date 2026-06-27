import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "admin"
  | "credit_risk_officer"
  | "collection_officer"
  | "legal_officer"
  | "branch_manager"
  | "executive";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "مدير النظام",
  credit_risk_officer: "ضابط مخاطر الائتمان",
  collection_officer: "موظف تحصيل",
  legal_officer: "ضابط قانوني",
  branch_manager: "مدير فرع",
  executive: "إدارة عليا",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: "صلاحيات كاملة على النظام والمستخدمين",
  credit_risk_officer: "تقييم المخاطر الائتمانية ومراقبة المحفظة",
  collection_officer: "إدارة عمليات التحصيل ومتابعة المتعثرين",
  legal_officer: "إدارة القضايا والإجراءات القانونية",
  branch_manager: "متابعة أداء الفرع والموظفين والمحفظة",
  executive: "تقارير تنفيذية ومؤشرات الأداء العامة",
};

export type Profile = {
  id: string;
  full_name: string | null;
  job_title: string | null;
  department: string | null;
  avatar_url: string | null;
  onboarded: boolean;
};

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Priority for "primary" display role
const ROLE_PRIORITY: AppRole[] = [
  "admin",
  "executive",
  "branch_manager",
  "credit_risk_officer",
  "legal_officer",
  "collection_officer",
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);

  const ensureProfile = async (currentUser: User): Promise<Profile | null> => {
    const { data: existing } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (existing) return existing as Profile;

    const fullName =
      typeof currentUser.user_metadata?.full_name === "string"
        ? currentUser.user_metadata.full_name
        : typeof currentUser.user_metadata?.name === "string"
          ? currentUser.user_metadata.name
          : currentUser.email?.split("@")[0] ?? null;

    const avatarUrl =
      typeof currentUser.user_metadata?.avatar_url === "string"
        ? currentUser.user_metadata.avatar_url
        : null;

    const { data: created, error } = await supabase
      .from("profiles")
      .insert({
        id: currentUser.id,
        full_name: fullName,
        avatar_url: avatarUrl,
        onboarded: false,
      })
      .select("*")
      .maybeSingle();

    if (error) return null;
    return (created as Profile | null) ?? null;
  };

  const loadUserData = async (currentUser: User) => {
    const [prof, { data: roleRows }] = await Promise.all([
      ensureProfile(currentUser),
      supabase.from("user_roles").select("role").eq("user_id", currentUser.id),
    ]);
    setProfile(prof);
    setRoles(((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role));
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session?.user) {
      await loadUserData(data.session.user);
    } else {
      setProfile(null);
      setRoles([]);
    }
  };

  useEffect(() => {
    let active = true;
    // Register listener FIRST so we don't miss the initial event
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      setSession(newSession);
      if (newSession?.user) {
        setLoading(true);
        // Defer to avoid recursive Supabase calls inside the callback
        setTimeout(() => {
          if (!active) return;
          loadUserData(newSession.user).finally(() => {
            if (active) setLoading(false);
          });
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
        setLoading(false);
      }
    });

    // Then hydrate current session
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadUserData(data.session.user);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const primaryRole =
    ROLE_PRIORITY.find((r) => roles.includes(r)) ?? roles[0] ?? null;

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        loading,
        session,
        user: session?.user ?? null,
        profile,
        roles,
        primaryRole,
        refresh,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
