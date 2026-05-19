import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  rating: number;
  coach_last_used: string | null;
  is_pro: boolean;
  is_guest?: boolean;
};

const GUEST_KEY = "gc_guest_profile";

function getGuestProfile(): Profile {
  if (typeof window === "undefined") {
    return {
      id: "guest",
      email: null,
      full_name: "Казахстанский Гроссмейстер (Гость)",
      avatar_url: null,
      city: "Алматы",
      rating: 1200,
      coach_last_used: null,
      is_pro: false,
      is_guest: true,
    };
  }
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (raw) return JSON.parse(raw) as Profile;
  } catch {}
  const guest: Profile = {
    id: "guest",
    email: null,
    full_name: "Казахстанский Гроссмейстер (Гость)",
    avatar_url: null,
    city: "Алматы",
    rating: 1200,
    coach_last_used: null,
    is_pro: false,
    is_guest: true,
  };
  localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
  return guest;
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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadProfile(data.session.user.id);
      else setProfile(getGuestProfile());
      setLoading(false);
    }).catch(() => {
      setProfile(getGuestProfile());
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(id: string) {
    const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (data) setProfile(data as Profile);
    else setProfile(getGuestProfile());
  }

  return { session, user, profile, loading, reloadProfile: () => user && loadProfile(user.id) };
}