import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { loadSavedGames, StoredGame } from "@/lib/game-storage";
import { deleteGameForUser, fetchSavedGamesForUser } from "@/lib/game-repository";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Trash2, Clock3, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/matches")({
  component: Matches,
});

function Matches() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [games, setGames] = useState<StoredGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const list = user?.id
        ? await fetchSavedGamesForUser(user.id)
        : loadSavedGames();
      if (!cancelled) {
        setGames(list.sort((a, b) => b.updatedAt - a.updatedAt));
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleDelete = (id: string) => {
    void deleteGameForUser(id, user?.id);
    setGames((current) => current.filter((game) => game.id !== id));
    toast.success("Сохранение удалено");
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wider text-muted-foreground">Сохранённые партии</p>
            <h1 className="text-3xl font-semibold">Матчи</h1>
            {!user && (
              <p className="mt-1 text-sm text-muted-foreground">
                Войдите через Google, чтобы матчи сохранялись в облаке между устройствами.
              </p>
            )}
          </div>
          <Button variant="outline" onClick={() => navigate({ to: "/" })}>
            На главную
          </Button>
        </div>

        {loading ? (
          <div className="glass rounded-2xl p-8 text-center text-muted-foreground">Загрузка матчей…</div>
        ) : games.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="text-lg font-medium">У вас пока нет сохранённых партий.</p>
            <p className="mt-2 text-sm text-muted-foreground">Начните новую партию, и она автоматически сохранится.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {games.map((game) => (
              <div key={game.id} className="glass rounded-3xl p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      {game.mode === "ai"
                        ? "ИИ"
                        : game.mode === "local"
                        ? "Локальная"
                        : "Онлайн"}
                      {game.finished ? " · Завершено" : " · В процессе"}
                    </div>
                    <h2 className="mt-1 text-xl font-semibold">{game.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Последний ход: {new Date(game.updatedAt).toLocaleString()}
                    </p>
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
                      <ArrowRight className="mr-2 h-4 w-4" /> Открыть
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(game.id)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Удалить
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
