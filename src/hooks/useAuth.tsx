import { useEffect, useState, useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "manager" | "employee";

// ---- Режим предпросмотра роли (только для администраторов) ----
export type RolePreview = "manager" | "employee1" | "employee2" | null;

const PREVIEW_KEY = "role_preview";
const previewListeners = new Set<() => void>();

function getPreviewSnapshot(): RolePreview {
  try {
    const v = window.localStorage.getItem(PREVIEW_KEY);
    return v === "manager" || v === "employee1" || v === "employee2" ? v : null;
  } catch {
    return null;
  }
}

function subscribePreview(cb: () => void) {
  previewListeners.add(cb);
  return () => {
    previewListeners.delete(cb);
  };
}

export function setRolePreview(value: RolePreview) {
  try {
    if (value) window.localStorage.setItem(PREVIEW_KEY, value);
    else window.localStorage.removeItem(PREVIEW_KEY);
  } catch {
    // ignore
  }
  previewListeners.forEach((l) => l());
}

export const rolePreviewLabels: Record<Exclude<RolePreview, null>, string> = {
  manager: "Руководитель",
  employee1: "Сотрудник группы 1",
  employee2: "Сотрудник группы 2",
};

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  shift_group: number;
  avatar_url?: string | null;
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

  const preview = useSyncExternalStore(subscribePreview, getPreviewSnapshot, () => null);

  const realIsAdmin = roles.includes("admin");
  const activePreview: RolePreview = realIsAdmin ? preview : null;

  const effectiveRoles: AppRole[] = activePreview
    ? activePreview === "manager"
      ? ["manager"]
      : ["employee"]
    : roles;
  const effectiveProfile: Profile | null =
    profile && activePreview && activePreview !== "manager"
      ? { ...profile, shift_group: activePreview === "employee1" ? 1 : 2 }
      : profile;

  const isAdmin = effectiveRoles.includes("admin");
  const isManager = effectiveRoles.includes("manager") || isAdmin;

  const refreshProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (data) setProfile(data as Profile);
  };

  return {
    session,
    user,
    roles: effectiveRoles,
    profile: effectiveProfile,
    isAdmin,
    isManager,
    loading,
    setProfile,
    refreshProfile,
    realIsAdmin,
    rolePreview: activePreview,
  };
}
