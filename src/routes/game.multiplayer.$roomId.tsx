import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ChessGame } from "@/components/ChessGame";
import { useAuth } from "@/hooks/use-auth";
import { lovable } from "@/integrations/auth/index";
import { fetchSavedGamesForUser } from "@/lib/game-repository";
import {
  getPlayerColor,
  getRoomById,
  getWhiteBlackUserIds,
  isRoomReady,
  type RoomRecord,
} from "@/lib/rooms";
import type { StoredGame } from "@/lib/game-storage";
import { Loader2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/game/multiplayer/$roomId")({
  component: GameMultiplayerRoom,
});

function GameMultiplayerRoom() {
  const { roomId } = Route.useParams();
  const { user, reloadProfile } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomRecord | null>(null);
  const [playerColor, setPlayerColor] = useState<"white" | "black" | null>(null);
  const [resumeGame, setResumeGame] = useState<StoredGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyRoom = useCallback(
    (r: RoomRecord) => {
      setRoom(r);
      if (user) {
        const color = getPlayerColor(r, user.id);
        setPlayerColor(color);
      }
    },
    [user],
  );

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      const r = await getRoomById(roomId);
      if (cancelled) return;

      if (!r) {
        setError("Комната не найдена");
        setLoading(false);
        return;
      }

      const color = getPlayerColor(r, user.id);
      if (!color) {
        setError("Вы не участник этой комнаты");
        setLoading(false);
        return;
      }

      applyRoom(r);
      setPlayerColor(color);

      const games = await fetchSavedGamesForUser(user.id);
      const match = games.find((g) => g.roomId === roomId && !g.finished) ?? null;
      if (match) {
        setResumeGame(match);
      } else if (r.pgn && r.fen !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") {
        setResumeGame({
          id: crypto.randomUUID(),
          mode: "multiplayer",
          title: `Онлайн: ${r.name}`,
          roomId: r.id,
          updatedAt: Date.now(),
          fen: r.fen,
          pgn: r.pgn,
          playerColor: color,
          boardTheme: "default",
          pieceTheme: "default",
          finished: false,
        });
      }

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [roomId, user, applyRoom]);

  useEffect(() => {
    if (!user || !room || isRoomReady(room)) return;

    const poll = setInterval(async () => {
      const fresh = await getRoomById(roomId);
      if (fresh) applyRoom(fresh);
    }, 2000);

    return () => clearInterval(poll);
  }, [roomId, user, room, applyRoom]);

  if (!user) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="container mx-auto max-w-md px-4 py-16 text-center">
          <div className="glass rounded-2xl p-8">
            <p className="text-muted-foreground">Войдите через Google для онлайн-игры.</p>
            <Button
              className="mt-4"
              onClick={() =>
                void lovable.auth.signInWithOAuth("google", {
                  redirect_uri: window.location.origin + `/game/multiplayer/${roomId}`,
                })
              }
            >
              <Crown className="mr-2 h-4 w-4" />
              Войти
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="container mx-auto flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (error || !room || !playerColor) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="container mx-auto max-w-md px-4 py-16 text-center">
          <div className="glass rounded-2xl p-8">
            <p className="text-muted-foreground">{error ?? "Ошибка загрузки"}</p>
            <Button className="mt-4" onClick={() => navigate({ to: "/game/multiplayer" })}>
              К онлайн-меню
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const { whiteUserId, blackUserId } = getWhiteBlackUserIds(room);
  const opponentReady = isRoomReady(room);
  const isHost = room.host_user_id === user.id;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold">{room.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Код: <span className="font-mono font-semibold tracking-wider">{room.code}</span>
          {" · "}
          Вы {playerColor === "white" ? "белыми" : "чёрными"}
        </p>

        {!opponentReady && (
          <div className="glass mt-4 rounded-2xl p-4 text-sm text-muted-foreground">
            {isHost ? (
              <>
                Ожидаем соперника. Друг должен войти через Google → «Войти по коду» →{" "}
                <span className="font-mono font-semibold text-foreground">{room.code}</span>
              </>
            ) : (
              "Ожидаем начала партии…"
            )}
          </div>
        )}

        <div className="mt-6">
          <ChessGame
            mode="multiplayer"
            roomId={room.id}
            roomName={room.name}
            roomHostUserId={room.host_user_id}
            roomGuestUserId={room.guest_user_id}
            roomHostColor={room.host_color}
            playerColor={playerColor}
            whiteUserId={whiteUserId}
            blackUserId={blackUserId}
            currentUserId={user.id}
            onEloApplied={reloadProfile}
            resumeGame={resumeGame}
            multiplayerReady={opponentReady}
          />
        </div>
      </main>
    </div>
  );
}
