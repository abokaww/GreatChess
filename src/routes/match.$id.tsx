import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { ChessGame } from "@/components/ChessGame";
import { getGameById } from "@/lib/game-repository";
import type { StoredGame } from "@/lib/game-storage";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/match/$id")({
  component: MatchResume,
});

function MatchResume() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [savedGame, setSavedGame] = useState<StoredGame | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const game = await getGameById(id, user?.id ?? null);
      if (cancelled) return;

      if (!game) {
        toast.error("Сохранённая партия не найдена");
        navigate({ to: "/matches" });
        return;
      }

      if (game.mode === "multiplayer" && game.roomId) {
        navigate({
          to: "/game/multiplayer/$roomId",
          params: { roomId: game.roomId },
        });
        return;
      }

      setSavedGame(game);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, navigate, user?.id]);

  if (!savedGame) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="container mx-auto px-4 py-16 text-center">
          <p className="text-lg text-muted-foreground">Загрузка партии...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wider text-muted-foreground">Продолжить партию</p>
            <h1 className="text-3xl font-semibold">{savedGame.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Последний ход: {new Date(savedGame.updatedAt).toLocaleString()}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate({ to: "/matches" })}>
            Назад к списку
          </Button>
        </div>

        <ChessGame mode={savedGame.mode} resumeGame={savedGame} />
      </main>
    </div>
  );
}
