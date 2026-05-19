import { Link, useNavigate } from "@tanstack/react-router";
import { Crown, LogOut, Home, Bot, Trophy, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

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
          {user && !profile?.is_guest ? (
            <>
              <div className="hidden text-right sm:block">
                <div className="text-sm font-medium leading-tight">{profile?.full_name ?? "Игрок"}</div>
                <div className="text-xs text-muted-foreground">{profile?.rating ?? 1200} ELO</div>
              </div>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-full border border-border" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                  {(profile?.full_name ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
              <Button variant="ghost" size="icon" onClick={signOut} title="Выйти">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="hidden items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground sm:flex">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Гость · {profile?.rating ?? 1200} ELO
            </div>
          )}
        </div>
      </div>
    </header>
  );
}