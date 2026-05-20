import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { loadSavedGames, removeSavedGame, StoredGame } from "@/lib/game-storage";
import { ArrowRight, Trash2, Clock3, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/matches")({
  component: Matches,
});

function Matches() {
  const navigate = useNavigate();
  const [games, setGames] = useState<StoredGame[]>([]);

  useEffect(() => {
    setGames(loadSavedGames());
  }, []);

  const handleDelete = (id: string) => {
    removeSavedGame(id);
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
          </div>
          <Button variant="outline" onClick={() => navigate({ to: "/" })}>
            На главную
          </Button>
        </div>

        {games.length === 0 ? (
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
                      {game.mode === "ai" ? "ИИ" : "Локальная"}
                      {game.finished ? " · Завершено" : " · В процессе"}
                    </div>
                    <h2 className="mt-1 text-xl font-semibold">{game.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Последний ход: {new Date(game.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => navigate({ to: `/match/${game.id}` })}>
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
