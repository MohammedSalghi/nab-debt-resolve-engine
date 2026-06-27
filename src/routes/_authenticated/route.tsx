import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const ONBOARDING_COMPLETED_KEY = "credit-core:onboarding-completed";

export const Route = createFileRoute("/_authenticated")({
  // Session lives in localStorage; the gate must run on the client only.
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/auth") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/auth",
        search: { redirect: location.pathname },
        replace: true,
      });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { loading, session, profile } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!session) {
      if (pathname === "/auth") return;
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (profile?.onboarded) return;
    if (profile && !profile.onboarded && pathname !== "/onboarding" && !sessionStorage.getItem(ONBOARDING_COMPLETED_KEY)) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [loading, session, profile, pathname, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Outlet />;
}
