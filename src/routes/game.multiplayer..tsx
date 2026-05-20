import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ChessGame } from "@/components/ChessGame";
import { useAuth } from "@/hooks/use-auth";
import { lovable } from "@/integrations/auth/index";
import { fetchSavedGamesForUser } from "@/lib/game-repository";
import { getRoomById, joinRoomById, subscribeToRoom } from "@/lib/rooms";
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
  const [room, setRoom] = useState<any | null>(null);
  const [playerColor, setPlayerColor] = useState<"white" | "black" | null>(null);
  const [resumeGame, setResumeGame] = useState<StoredGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedJoin, setHasAttemptedJoin] = useState(false);

  const applyRoom = useCallback(
    (r: any) => {
      setRoom(r);
      if (user && r) {
        const color = r.host_id === user.id ? "white" : "black";
        setPlayerColor(color);
      }
      if (!resumeGame && r?.game_state?.fen) {
        const color = user && r.host_id === user.id ? "white" : "black";
        setResumeGame({
          id: crypto.randomUUID(),
          mode: "multiplayer",
          title: `Онлайн: ${r.name}`,
          roomId: r.id,
          updatedAt: Date.now(),
          fen: r.game_state.fen,
          pgn: r.game_state.pgn ?? "",
          playerColor: color,
          boardTheme: "default",
          pieceTheme: "default",
          finished: false,
        });
      }
    },
    [resumeGame, user],
  );

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToRoom(roomId, (r) => {
      if (!r) {
        setError("Комната не найдена");
        setLoading(false);
        return;
      }
      if (!user) {
        setLoading(false);
        return;
      }
      if (r.guest_id && r.guest_id !== user.id && r.host_id !== user.id) {
        setError("Эта комната уже занята другим игроком");
        setLoading(false);
        return;
      }
      applyRoom(r);
      setLoading(false);
    });

    return () => {
      try {
        unsub();
      } catch (e) {
        // ignore
      }
    };
  }, [roomId, user, applyRoom]);

  useEffect(() => {
    if (!user || !room || room.host_id === user.id || hasAttemptedJoin) return;
    if (room.guest_id && room.guest_id !== user.id) return;

    setHasAttemptedJoin(true);
    void (async () => {
      const result = await joinRoomById(room.id);
      if (!result.ok) {
        setError(result.message ?? "Не удалось присоединиться к комнате");
        setLoading(false);
        return;
      }
      applyRoom(result.room);
    })();
  }, [room, user, hasAttemptedJoin, applyRoom]);

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

  const whiteUserId = room?.host_id ?? null;
  const blackUserId = room?.guest_id ?? null;
  const opponentReady = room?.status === "playing";
  const isHost = room?.host_id === user.id;
  const inviteLink = `${window.location.origin}/game/multiplayer/${room.id}`;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold">{room.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ссылка: <span className="font-mono font-semibold tracking-wider break-all">{inviteLink}</span>
          {" · "}
          Вы {playerColor === "white" ? "белыми" : "чёрными"}
        </p>

        {!opponentReady && (
          <div className="glass mt-4 rounded-2xl p-4 text-sm text-muted-foreground">
            {isHost ? (
              <>
                Ожидаем соперника. Скопируйте ссылку и отправьте другу:
                <div className="mt-2 rounded-xl bg-muted/40 p-3 font-mono text-sm text-foreground">{inviteLink}</div>
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
            roomHostUserId={room.host_id}
            roomGuestUserId={room.guest_id}
            roomHostColor={room.host_color}
            playerColor={playerColor}
            whiteUserId={whiteUserId}
            blackUserId={blackUserId}
            currentUserId={user.id}
            onEloApplied={reloadProfile}
            resumeGame={resumeGame}
            multiplayerReady={opponentReady}
            currentTurn={room.current_turn}
          />
        </div>
      </main>
    </div>
  );
}
