import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "./domain";
import { authPassword, usernameToEmail } from "./bootstrap.functions";

type AuthValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export async function logActivity(action: string, details?: string) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", data.user.id)
    .maybeSingle();
  await supabase.from("activity_logs").insert({
    user_id: data.user.id,
    username: profile?.username ?? null,
    action,
    details: details ?? null,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "SIGNED_OUT") {
        setProfile(null);
      } else if (next?.user) {
        void loadProfile(next.user.id);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const email = usernameToEmail(username);
      let { data, error } = await supabase.auth.signInWithPassword({ email, password: authPassword(password) });
      if (error && username.trim().toLowerCase() === DEFAULT_ADMIN_USERNAME) {
        // Make sure the default account exists, then retry once.
        const setup = await ensureDefaultAdmin();
        if (setup?.error) throw new Error(`Default account setup failed: ${setup.error}`);
        if (setup?.created) {
          ({ data, error } = await supabase.auth.signInWithPassword({ email, password: authPassword(password) }));
        }
      }
      if (error || !data.user) {
        const msg = error?.message ?? "";
        if (/invalid login credentials/i.test(msg)) throw new Error("Invalid username or password");
        throw new Error(msg ? `Sign-in failed: ${msg}` : "Sign-in failed. Please try again.");
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!prof) {
        await supabase.auth.signOut();
        throw new Error("This account has no profile. Contact an administrator.");
      }
      if (prof.status !== "Active") {
        await supabase.auth.signOut();
        throw new Error("This account is inactive. Contact an administrator.");
      }

      await supabase
        .from("profiles")
        .update({ last_login: new Date().toISOString() })
        .eq("id", data.user.id);
      await supabase.from("activity_logs").insert({
        user_id: data.user.id,
        username: prof.username,
        action: "Login",
        details: "Signed in to the system",
      });

      setProfile({ ...(prof as Profile), last_login: new Date().toISOString() });
      setSession(data.session);
    },
    [],
  );

  const signOut = useCallback(async () => {
    await logActivity("Logout", "Signed out of the system");
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    await loadProfile(data.user?.id);
  }, [loadProfile]);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      profile,
      loading,
      isAdmin: profile?.role === "admin",
      signIn,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
