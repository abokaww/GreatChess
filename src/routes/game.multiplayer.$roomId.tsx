import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ChessGame } from "@/components/ChessGame";
import { useAuth } from "@/hooks/use-auth";
import { fetchSavedGamesForUser, loadLatestOngoingGame } from "@/lib/game-repository";
import { getRoom, isRoomReady, joinRoom, type RoomRecord } from "@/lib/rooms";
import type { StoredGame } from "@/lib/game-storage";
import { Loader2, Users, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

type RoomSearch = { hc?: "white" | "black" };

export const Route = createFileRoute("/game/multiplayer/$roomId")({
  validateSearch: (search: Record<string, unknown>): RoomSearch => ({
    hc: search.hc === "black" ? "black" : search.hc === "white" ? "white" : undefined,
  }),
  component: GameMultiplayer,
});

function GameMultiplayer() {
  const { roomId } = Route.useParams();
  const { hc: hostColorFromLink } = Route.useSearch();
  const { user, reloadProfile } = useAuth();
  const navigate = useNavigate();
  const [playerColor, setPlayerColor] = useState<"white" | "black" | null>(null);
  const [whiteUserId, setWhiteUserId] = useState<string | null>(null);
  const [blackUserId, setBlackUserId] = useState<string | null>(null);
  const [roomFull, setRoomFull] = useState(false);
  const [roomMissing, setRoomMissing] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [resumeGame, setResumeGame] = useState<StoredGame | null>(null);
  const [roomState, setRoomState] = useState<RoomRecord | null>(null);
  const [opponentReady, setOpponentReady] = useState(false);

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

  const applyRoomPlayers = useCallback((room: RoomRecord) => {
    setWhiteUserId(room.white_player_id);
    setBlackUserId(room.black_player_id);
    setRoomState(room);
    setOpponentReady(isRoomReady(room));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      setConnecting(true);
      setJoinError(null);

      const joined = await joinRoom(roomId, currentUserId);
      if (cancelled) return;

      if (!joined.ok) {
        if (joined.reason === "full") setRoomFull(true);
        else if (joined.reason === "not_found") setRoomMissing(true);
        else setJoinError(joined.message ?? "Не удалось войти в комнату");
        setConnecting(false);
        return;
      }

      setPlayerColor(joined.color);
      applyRoomPlayers(joined.room);

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
  }, [roomId, currentUserId, user?.id, applyRoomPlayers]);

  // Ожидание второго игрока: опрос комнаты
  useEffect(() => {
    if (!playerColor || opponentReady) return;

    const poll = async () => {
      const room = await getRoom(roomId);
      if (!room) return;
      applyRoomPlayers(room);
    };

    const interval = setInterval(() => void poll(), 2000);
    void poll();
    return () => clearInterval(interval);
  }, [roomId, playerColor, opponentReady, applyRoomPlayers]);

  const copyInvite = () => {
    const url = new URL(`/game/multiplayer/${roomId}`, window.location.origin);
    if (roomState?.host_color) url.searchParams.set("hc", roomState.host_color);
    else if (hostColorFromLink) url.searchParams.set("hc", hostColorFromLink);
    navigator.clipboard.writeText(url.toString());
    toast.success("Ссылка скопирована!");
  };

  if (roomMissing) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="container mx-auto px-4 py-16 text-center">
          <div className="glass mx-auto max-w-md rounded-2xl p-8">
            <h1 className="text-xl font-semibold">Комната не найдена</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Сначала создайте комнату на главной («Играть с другом» → онлайн), затем отправьте ссылку.
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
              В этой комнате уже играют двое. Попросите друга создать новую комнату.
            </p>
            <Button className="mt-6" onClick={() => navigate({ to: "/" })}>
              На главную
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (joinError) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="container mx-auto px-4 py-16 text-center">
          <div className="glass mx-auto max-w-md rounded-2xl p-8">
            <h1 className="text-xl font-semibold">Ошибка подключения</h1>
            <p className="mt-2 text-sm text-muted-foreground">{joinError}</p>
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

  const isHost = roomState?.host_id === currentUserId;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Онлайн · комната {roomId}</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Вы играете {playerColor === "white" ? "белыми" : "чёрными"}.
          {isHost ? " Отправьте ссылку другу — ходы по очереди." : " Ходы по очереди."}
        </p>

        {!opponentReady && (
          <div className="glass mb-6 flex flex-col items-center gap-3 rounded-2xl p-6 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <p className="font-medium">Ожидаем соперника…</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Как только друг откроет ссылку, партия начнётся. Белые ходят первыми.
              </p>
            </div>
            {isHost && (
              <Button variant="secondary" onClick={copyInvite}>
                <Link2 className="mr-2 h-4 w-4" />
                Копировать ссылку
              </Button>
            )}
          </div>
        )}

        <ChessGame
          mode="multiplayer"
          roomId={roomId}
          playerColor={playerColor}
          whiteUserId={whiteUserId}
          blackUserId={blackUserId}
          currentUserId={currentUserId}
          onEloApplied={reloadProfile}
          resumeGame={resumeGame}
          multiplayerReady={opponentReady}
        />
      </main>
    </div>
  );
}
