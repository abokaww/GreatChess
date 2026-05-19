import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ChessGame } from "@/components/ChessGame";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/game/multiplayer/$roomId")({
  component: GameMultiplayer,
});

type PresenceMeta = {
  userId: string;
  joinedAt: number;
};

function GameMultiplayer() {
  const { roomId } = Route.useParams();
  const { user, reloadProfile } = useAuth();
  const navigate = useNavigate();
  const [playerColor, setPlayerColor] = useState<"white" | "black" | null>(null);
  const [whiteUserId, setWhiteUserId] = useState<string | null>(null);
  const [blackUserId, setBlackUserId] = useState<string | null>(null);
  const [roomFull, setRoomFull] = useState(false);
  const [connecting, setConnecting] = useState(true);

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
    const ch = supabase.channel(`room:${roomId}:lobby`, {
      config: { presence: { key: currentUserId } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<PresenceMeta>();
      const players = Object.values(state)
        .flat()
        .sort((a, b) => a.joinedAt - b.joinedAt);

      if (players.length > 2) {
        setRoomFull(true);
        setConnecting(false);
        return;
      }

      const white = players[0]?.userId ?? null;
      const black = players[1]?.userId ?? null;
      setWhiteUserId(white);
      setBlackUserId(black);

      const myIndex = players.findIndex((p) => p.userId === currentUserId);
      if (myIndex === 0) setPlayerColor("white");
      else if (myIndex === 1) setPlayerColor("black");
      else if (players.length < 2) setPlayerColor("white");
      setConnecting(false);
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          userId: currentUserId,
          joinedAt: Date.now(),
        } as PresenceMeta);
      }
    });

    return () => {
      supabase.removeChannel(ch);
    };
  }, [roomId, currentUserId]);

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
          {playerColor === "white" ? " Отправьте ссылку другу." : " Ожидайте ход или сделайте свой."}
        </p>
        <ChessGame
          mode="multiplayer"
          roomId={roomId}
          playerColor={playerColor}
          whiteUserId={whiteUserId}
          blackUserId={blackUserId}
          currentUserId={currentUserId}
          onEloApplied={reloadProfile}
        />
      </main>
    </div>
  );
}
