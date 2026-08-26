import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "manager" | "employee";

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  shift_group: number;
  is_active?: boolean;
  is_approved?: boolean;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (!s?.user) {
        setRoles([]);
        setProfile(null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      const prof = (p as Profile | null) ?? null;
      if (prof && prof.is_active === false) {
        await supabase.auth.signOut();
        if (typeof window !== "undefined") {
          window.location.href = "/auth?disabled=1";
        }
        return;
      }
      if (prof && prof.is_approved === false) {
        await supabase.auth.signOut();
        if (typeof window !== "undefined") {
          window.location.href = "/auth?pending=1";
        }
        return;
      }
      setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
      setProfile(prof);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager") || isAdmin;

  return { session, user, roles, profile, isAdmin, isManager, loading, setProfile };
}
