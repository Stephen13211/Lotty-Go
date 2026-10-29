import type { Session } from "@supabase/supabase-js";
import React, { createContext, useContext, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabase";

export type Role = "rider" | "driver";
type Ctx = {
  session: Session | null; role: Role | null; loading: boolean; configured: boolean;
  setRole: (r: Role) => Promise<void>;
  signIn: (e: string, p: string) => Promise<void>;
  signUp: (e: string, p: string, name: string, r: Role) => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRoleState] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setRoleState((data.session?.user?.user_metadata?.role as Role) ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s); setRoleState((s?.user?.user_metadata?.role as Role) ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const setRole = async (r: Role) => {
    setRoleState(r);
    if (session?.user) await supabase.auth.updateUser({ data: { role: r } });
  };
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };
  const signUp = async (email: string, password: string, full_name: string, r: Role) => {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name, role: r } } });
    if (error) throw error;
  };
  const signOut = async () => { await supabase.auth.signOut(); setRoleState(null); };

  return <AuthContext.Provider value={{ session, role, loading, configured: isSupabaseConfigured, setRole, signIn, signUp, signOut }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}

