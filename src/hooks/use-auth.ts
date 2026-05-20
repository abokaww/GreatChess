import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { syncLocalGamesToCloud } from "@/lib/game-repository";

export const DEFAULT_ELO = 1000;

export type Profile = {
  id: string;
  username: string | null;
  elo: number;
  ai_requests_count: number;
  last_ai_request_date: string | null;
  is_guest?: boolean;
};

const GUEST_PROFILE: Profile = {
  id: "guest",
  username: null,
  elo: DEFAULT_ELO,
  ai_requests_count: 0,
  last_ai_request_date: null,
  is_guest: true,
};

function createEmptyProfile(id: string): Profile {
  return {
    id,
    username: null,
    elo: DEFAULT_ELO,
    ai_requests_count: 0,
    last_ai_request_date: null,
    is_guest: false,
  };
}

function normalizeProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    username: (row.username as string | null) ?? null,
    elo: typeof row.elo === "number" ? row.elo : DEFAULT_ELO,
    ai_requests_count: typeof row.ai_requests_count === "number" ? row.ai_requests_count : 0,
    last_ai_request_date: (row.last_ai_request_date as string | null) ?? null,
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
        setTimeout(() => {
          void loadProfile(s.user.id);
          void syncLocalGamesToCloud(s.user.id);
        }, 0);
      } else {
        setProfile(GUEST_PROFILE);
      }
    });
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          void loadProfile(data.session.user.id);
          void syncLocalGamesToCloud(data.session.user.id);
        }
        else setProfile(GUEST_PROFILE);
        setLoading(false);
      })
      .catch(() => {
        setProfile(GUEST_PROFILE);
        setLoading(false);
      });
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(id: string) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, elo, ai_requests_count, last_ai_request_date")
      .eq("id", id)
      .maybeSingle();
    if (data) setProfile(normalizeProfile(data as Record<string, unknown>));
    else {
      // ensure there's a profiles row for this user so nicknames persist across logins
      try {
        const { data: inserted } = await supabase
          .from("profiles")
          .insert({ id, username: null, elo: DEFAULT_ELO, ai_requests_count: 0, last_ai_request_date: null })
          .select()
          .maybeSingle();
        if (inserted) setProfile(normalizeProfile(inserted as Record<string, unknown>));
        else setProfile(createEmptyProfile(id));
      } catch {
        setProfile(createEmptyProfile(id));
      }
    }
  }

  async function reloadProfile() {
    if (user) await loadProfile(user.id);
  }

  return { session, user, profile, loading, reloadProfile };
}
