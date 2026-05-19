import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { Crown, LogOut, Home, Bot, Trophy, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

function displayNameFromUser(user: User): string {
  const meta = user.user_metadata ?? {};
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    null;
  return name ?? user.email ?? "Игрок";
}

export function AppHeader() {
  const { profile } = useAuth();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthUser(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const displayName = authUser ? displayNameFromUser(authUser) : "Гость";
  const elo = profile?.elo ?? 1000;

  return (
    <header className="sticky top-0 z-40 glass border-b border-border/50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <Crown className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-gradient">GreatChess</span>
        </Link>
        <nav className="hidden items-center gap-1 text-sm md:flex">
          {[
            { to: "/", label: "Главная", icon: Home },
            { to: "/game/ai", label: "Играть с ИИ", icon: Bot },
            { to: "/leaderboard", label: "Рейтинг", icon: Trophy },
            { to: "/pro", label: "PRO Тариф", icon: Sparkles },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: l.to === "/" }}
              activeProps={{ className: "bg-primary/15 text-primary" }}
              inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition"
            >
              <l.icon className="h-3.5 w-3.5" />
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium leading-tight">{displayName}</div>
            <div className="text-xs text-muted-foreground">{elo} ELO</div>
          </div>
          {authUser ? (
            <>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-full border border-border" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <Button variant="ghost" size="icon" onClick={signOut} title="Выйти">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
