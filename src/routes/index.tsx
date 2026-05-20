import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, Users, Trophy, Sparkles, ArrowRight, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { lovable } from "@/integrations/auth/index";
import { AppHeader } from "@/components/AppHeader";
import { ProfileCard } from "@/components/ProfileCard";
import { FriendPlayDialog } from "@/components/FriendPlayDialog";
import { loadSavedGames, StoredGame } from "@/lib/game-storage";
import { deleteGameForUser, fetchSavedGamesForUser } from "@/lib/game-repository";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading, reloadProfile } = useAuth();
  const navigate = useNavigate();
  const [friendOpen, setFriendOpen] = useState(false);
  const [ongoingGames, setOngoingGames] = useState<StoredGame[]>([]);
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningGame, setWarningGame] = useState<StoredGame | null>(null);
  const [warningMode, setWarningMode] = useState<StoredGame["mode"] | null>(null);

  useEffect(() => {
    if (!user) return;
    void reloadProfile();
  }, [user, reloadProfile]);

  useEffect(() => {
    let cancelled = false;
    async function loadOngoing() {
      const games = user?.id
        ? await fetchSavedGamesForUser(user.id)
        : loadSavedGames(null);
      if (!cancelled) {
        setOngoingGames(games.filter((game) => !game.finished));
      }
    }
    void loadOngoing();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleStartNewGame = (mode: StoredGame["mode"], action: () => void) => {
    const ongoingModeGame = ongoingGames.find((game) => game.mode === mode);
    if (ongoingModeGame) {
      setWarningMode(mode);
      setWarningGame(ongoingModeGame);
      setWarningOpen(true);
      return;
    }
    action();
  };

  const closeWarning = () => {
    setWarningOpen(false);
    setWarningGame(null);
    setWarningMode(null);
  };

  const handleContinue = () => {
    if (!warningGame) return;
    closeWarning();
    if (warningGame.mode === "multiplayer" && warningGame.roomId) {
      navigate({
        to: "/game/multiplayer/$roomId",
        params: { roomId: warningGame.roomId },
      });
      return;
    }
    navigate({ to: `/match/${warningGame.id}` });
  };

  const handleSurrender = () => {
    if (!warningGame) return;
    void deleteGameForUser(warningGame.id, user?.id);
    setOngoingGames((current) => current.filter((game) => game.id !== warningGame.id));
    toast.success("Незавершённая партия отмечена как сданная.");
    closeWarning();
  };

  const handleStartFresh = () => {
    if (!warningMode) return;
    if (warningGame) {
      void deleteGameForUser(warningGame.id, user?.id);
      setOngoingGames((current) => current.filter((game) => game.id !== warningGame.id));
    }
    closeWarning();
    if (warningMode === "ai") navigate({ to: "/game/ai" });
    if (warningMode === "local") navigate({ to: "/game/local" });
  };

  const openMultiplayer = () => {
    if (!user) {
      toast.error("Войдите через Google для онлайн-игры");
      void signInGoogle();
      return;
    }
    navigate({ to: "/game/multiplayer" });
  };

  const handleViewMatches = () => {
    closeWarning();
    navigate({ to: "/matches" });
  };

  const signInGoogle = async () => {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) toast.error("Не удалось войти. Попробуйте снова.");
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-12 md:py-20">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
            <span className="text-gradient">GreatChess</span>
            <span className="mt-2 block text-3xl text-muted-foreground md:text-4xl">
              Шахматы нового поколения
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Играй, анализируй партии с ИИ-коучем и прокачивай свой рейтинг.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              onClick={() => handleStartNewGame("ai", () => navigate({ to: "/game/ai" }))}
              className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              <Bot className="mr-2 h-4 w-4" /> Начать партию
            </Button>
            {!user && (
              <Button variant="outline" size="lg" onClick={signInGoogle}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Войти через Google
              </Button>
            )}
          </div>
          <div className="mt-20 grid gap-4 md:grid-cols-3">
            {[
              { icon: Bot, title: "ИИ-соперник", desc: "Мгновенные партии против умного бота" },
              { icon: Sparkles, title: "ИИ-Коуч", desc: "Персональный разбор каждой партии" },
              { icon: Trophy, title: "Рейтинг РК", desc: "Соревнуйся с игроками своего города" },
            ].map((f, i) => (
              <div key={i} className="glass rounded-2xl p-6 text-left transition hover:border-primary/40">
                <f.icon className="mb-3 h-6 w-6 text-primary" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>

        </section>

        <section className="mx-auto mt-16 max-w-5xl">
          <ProfileCard />

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <DashCard
              icon={Bot}
              title="Играть с ИИ"
              desc="Мгновенная партия против бота"
              onClick={() => handleStartNewGame("ai", () => navigate({ to: "/game/ai" }))}
              accent
            />
            <DashCard
              icon={Users}
              title="Играть с другом"
              desc="Локально или онлайн по ссылке"
              onClick={() => setFriendOpen(true)}
            />
            <DashCard
              icon={Sparkles}
              title="Визуал"
              desc="Выбери стиль доски и темы фигур"
              onClick={() => navigate({ to: "/visual" })}
            />
          </div>

          {ongoingGames.length > 0 && (
            <section className="mt-10">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Матчи в процессе</p>
                  <h2 className="text-2xl font-semibold">Продолжи игру позже</h2>
                </div>
                <Button variant="outline" onClick={() => navigate({ to: "/matches" })}>
                  Все матчи
                </Button>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {ongoingGames.map((game) => (
                  <div key={game.id} className="glass rounded-2xl p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">
                          {game.mode === "ai"
                            ? "ИИ"
                            : game.mode === "local"
                            ? "Локальная"
                            : "Онлайн"}
                        </div>
                        <div className="mt-1 text-lg font-semibold">{game.title}</div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          Последний ход: {new Date(game.updatedAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            if (game.mode === "multiplayer" && game.roomId) {
                              navigate({
                                to: "/game/multiplayer/$roomId",
                                params: { roomId: game.roomId },
                              });
                              return;
                            }
                            navigate({ to: `/match/${game.id}` });
                          }}
                        >
                          Продолжить
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <Link to="/pro" className="mt-8 block">
            <div className="glass shadow-elegant flex items-center justify-between rounded-2xl border-primary/30 p-6 transition hover:border-primary">
              <div className="flex items-center gap-3">
                <Crown className="h-6 w-6 text-primary" />
                <div>
                  <div className="font-semibold">Безлимитный ИИ-Коуч в PRO</div>
                  <div className="text-sm text-muted-foreground">
                    Анализ каждой партии 24/7 + кастомные доски
                  </div>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Link>
        </section>
        {loading && null}
      </main>
      <FriendPlayDialog
        open={friendOpen}
        onOpenChange={setFriendOpen}
        onPlayLocal={() => handleStartNewGame("local", () => navigate({ to: "/game/local" }))}
        onPlayMultiplayer={() => handleStartNewGame("multiplayer", openMultiplayer)}
      />
      <Dialog open={warningOpen} onOpenChange={setWarningOpen}>
        <DialogContent className="glass border-border/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Внимание</DialogTitle>
            <DialogDescription>
              У вас уже есть незавершённая партия в этом режиме.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Если вы начнёте новую партию, старая будет завершена.
            </p>
          </div>
          <div className="grid gap-2">
            <Button onClick={handleContinue} className="w-full">
              Доиграть
            </Button>
            <Button variant="outline" onClick={handleSurrender} className="w-full">
              Сдаться
            </Button>
            {warningMode !== "multiplayer" && (
              <Button variant="secondary" onClick={handleStartFresh} className="w-full">
                Начать заново
              </Button>
            )}
            {warningMode === "multiplayer" && (
              <p className="text-center text-xs text-muted-foreground">
                Для онлайн-партии можно продолжить текущую комнату или сдаться и создать новую.
              </p>
            )}
            <Button variant="ghost" onClick={handleViewMatches} className="w-full">
              Посмотреть все матчи
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DashCard({
  icon: Icon,
  title,
  desc,
  onClick,
  accent,
}: {
  icon: typeof Bot;
  title: string;
  desc: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`glass group text-left rounded-2xl p-6 transition hover:-translate-y-1 hover:border-primary/50 ${accent ? "shadow-glow" : ""}`}
    >
      <div
        className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${accent ? "bg-gradient-primary" : "bg-secondary"}`}
      >
        <Icon className={`h-5 w-5 ${accent ? "text-primary-foreground" : "text-foreground"}`} />
      </div>
      <div className="text-lg font-semibold">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
      <div className="mt-4 inline-flex items-center text-sm text-primary opacity-0 transition group-hover:opacity-100">
        Начать <ArrowRight className="ml-1 h-3 w-3" />
      </div>
    </button>
  );
}
