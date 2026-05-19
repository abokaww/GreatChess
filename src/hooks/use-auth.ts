import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_ELO = 1000;

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
  elo: number;
  wins: number;
  losses: number;
  ai_requests_count: number;
  last_ai_request_date: string | null;
  coach_last_used: string | null;
  is_pro: boolean;
  is_guest?: boolean;
};

const GUEST_KEY = "gc_guest_profile";

function getGuestProfile(): Profile {
  return {
    id: "guest",
    email: null,
    full_name: null,
    username: null,
    avatar_url: null,
    city: null,
    elo: DEFAULT_ELO,
    wins: 0,
    losses: 0,
    ai_requests_count: 0,
    last_ai_request_date: null,
    coach_last_used: null,
    is_pro: false,
    is_guest: true,
  };
}

function normalizeProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    email: (row.email as string | null) ?? null,
    full_name: (row.full_name as string | null) ?? null,
    username: (row.username as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    elo: typeof row.elo === "number" ? row.elo : DEFAULT_ELO,
    wins: typeof row.wins === "number" ? row.wins : 0,
    losses: typeof row.losses === "number" ? row.losses : 0,
    ai_requests_count: typeof row.ai_requests_count === "number" ? row.ai_requests_count : 0,
    last_ai_request_date: (row.last_ai_request_date as string | null) ?? null,
    coach_last_used: (row.coach_last_used as string | null) ?? null,
    is_pro: Boolean(row.is_pro),
    is_guest: false,
  };
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(getGuestProfile());
      }
    });
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) loadProfile(data.session.user.id);
        else setProfile(getGuestProfile());
        setLoading(false);
      })
      .catch(() => {
        setProfile(getGuestProfile());
        setLoading(false);
      });
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(id: string) {
    const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (data) setProfile(normalizeProfile(data as Record<string, unknown>));
    else setProfile(getGuestProfile());
  }

  async function reloadProfile() {
    if (user) await loadProfile(user.id);
  }

  return { session, user, profile, loading, reloadProfile };
}
