import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ChessGame } from "@/components/ChessGame";
import { useAuth } from "@/hooks/use-auth";
import { fetchSavedGamesForUser, loadLatestOngoingGame } from "@/lib/game-repository";
import { joinRoom, type RoomRecord } from "@/lib/rooms";
import type { StoredGame } from "@/lib/game-storage";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/game/multiplayer/$roomId")({
  component: GameMultiplayer,
});

function GameMultiplayer() {
  const { roomId } = Route.useParams();
  const { user, reloadProfile } = useAuth();
  const navigate = useNavigate();
  const [playerColor, setPlayerColor] = useState<"white" | "black" | null>(null);
  const [whiteUserId, setWhiteUserId] = useState<string | null>(null);
  const [blackUserId, setBlackUserId] = useState<string | null>(null);
  const [roomFull, setRoomFull] = useState(false);
  const [roomMissing, setRoomMissing] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [resumeGame, setResumeGame] = useState<StoredGame | null>(null);
  const [roomState, setRoomState] = useState<RoomRecord | null>(null);

  const [guestId] = useState(() => {
    if (typeof window === "undefined") return "guest-ssr";
    let gid = sessionStorage.getItem("gc_guest_id");
    if (!gid) {
      gid = crypto.randomUUID();
      sessionStorage.setItem("gc_guest_id", gid);
    }
    return gid;
  });

  const currentUserId = user?.id ?? `guest-${guestId}`;

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      setConnecting(true);
      const joined = await joinRoom(roomId, currentUserId);
      if (cancelled) return;

      if (!joined.ok) {
        if (joined.reason === "full") setRoomFull(true);
        if (joined.reason === "not_found") setRoomMissing(true);
        setConnecting(false);
        return;
      }

      setPlayerColor(joined.color);
      setWhiteUserId(joined.whiteUserId);
      setBlackUserId(joined.blackUserId);
      setRoomState(joined.room);

      let roomMatch = (await loadLatestOngoingGame("multiplayer", user?.id ?? null)) ?? null;
      if (roomMatch?.roomId !== roomId && user?.id) {
        const games = await fetchSavedGamesForUser(user.id);
        roomMatch = games.find((g) => g.roomId === roomId && !g.finished) ?? null;
      } else if (roomMatch?.roomId !== roomId) {
        roomMatch = null;
      }

      if (roomMatch) {
        setResumeGame(roomMatch);
      } else if (
        joined.room.pgn &&
        joined.room.fen !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
      ) {
        setResumeGame({
          id: crypto.randomUUID(),
          mode: "multiplayer",
          title: `Онлайн: ${roomId}`,
          roomId,
          updatedAt: Date.now(),
          fen: joined.room.fen,
          pgn: joined.room.pgn,
          playerColor: joined.color,
          boardTheme: "default",
          pieceTheme: "default",
          finished: false,
        });
      }

      setConnecting(false);
    }

    void connect();
    return () => {
      cancelled = true;
    };
  }, [roomId, currentUserId, user?.id]);

  if (roomMissing) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="container mx-auto px-4 py-16 text-center">
          <div className="glass mx-auto max-w-md rounded-2xl p-8">
            <h1 className="text-xl font-semibold">Комната не найдена</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ссылка устарела или комната ещё не создана. Попросите друга отправить новую ссылку.
            </p>
            <Button className="mt-6" onClick={() => navigate({ to: "/" })}>
              На главную
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (roomFull) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="container mx-auto px-4 py-16 text-center">
          <div className="glass mx-auto max-w-md rounded-2xl p-8">
            <Users className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Комната заполнена</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              В этой комнате уже играют два игрока. Создайте новую игру.
            </p>
            <Button className="mt-6" onClick={() => navigate({ to: "/" })}>
              На главную
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (connecting || !playerColor) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="container mx-auto flex min-h-[50vh] items-center justify-center px-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Онлайн · комната {roomId}</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Вы играете {playerColor === "white" ? "белыми" : "чёрными"}.
          {roomState?.host_id === currentUserId
            ? " Отправьте ссылку другу."
            : " Ожидайте ход или сделайте свой."}
        </p>
        <ChessGame
          mode="multiplayer"
          roomId={roomId}
          playerColor={playerColor}
          whiteUserId={whiteUserId}
          blackUserId={blackUserId}
          currentUserId={currentUserId}
          onEloApplied={reloadProfile}
          resumeGame={resumeGame}
        />
      </main>
    </div>
  );
}
