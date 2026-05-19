import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AICoach } from "./AICoach";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, RotateCcw, Users, Bot, Copy, Flag } from "lucide-react";
import { toast } from "sonner";

type Mode = "ai" | "multi";

export function ChessGame({ mode, roomId, playerColor = "white" }: {
  mode: Mode;
  roomId?: string;
  playerColor?: "white" | "black";
}) {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [status, setStatus] = useState("");
  const [gameOver, setGameOver] = useState<{ result: string; reason: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => setMounted(true), []);

  // Multiplayer realtime
  useEffect(() => {
    if (mode !== "multi" || !roomId) return;
    const ch = supabase.channel(`game:${roomId}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "move" }, ({ payload }) => {
      try {
        gameRef.current.move(payload.move);
        setFen(gameRef.current.fen());
        checkGameEnd();
      } catch {}
    });
    ch.subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [mode, roomId]);

  const aiMove = () => {
    const g = gameRef.current;
    if (g.isGameOver()) return;
    const moves = g.moves();
    if (!moves.length) return;
    // simple eval: prefer captures + checks
    const verbose = g.moves({ verbose: true });
    const scored = verbose.map((m) => {
      let s = Math.random();
      if (m.captured) s += 5;
      if (m.san.includes("+")) s += 2;
      if (m.san.includes("#")) s += 100;
      return { m, s };
    }).sort((a, b) => b.s - a.s);
    const choice = scored[0].m;
    g.move(choice.san);
    setFen(g.fen());
    checkGameEnd();
  };

  const checkGameEnd = () => {
    const g = gameRef.current;
    if (g.isCheckmate()) {
      const winner = g.turn() === "w" ? "Чёрные" : "Белые";
      setGameOver({ result: g.turn() === "w" ? "0-1" : "1-0", reason: `Мат! Победили ${winner.toLowerCase()}` });
    } else if (g.isStalemate()) setGameOver({ result: "1/2-1/2", reason: "Пат — ничья" });
    else if (g.isDraw()) setGameOver({ result: "1/2-1/2", reason: "Ничья" });
    else if (g.inCheck()) setStatus("Шах!");
    else setStatus(g.turn() === "w" ? "Ход белых" : "Ход чёрных");
  };

  useEffect(checkGameEnd, []);

  const onPieceDrop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    if (!targetSquare) return false;
    const g = gameRef.current;
    if (mode === "multi") {
      const myTurn = (g.turn() === "w" ? "white" : "black") === playerColor;
      if (!myTurn) { toast.error("Сейчас ход соперника"); return false; }
    }
    try {
      const move = g.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      if (!move) return false;
      setFen(g.fen());
      checkGameEnd();
      if (mode === "ai" && !g.isGameOver()) {
        setTimeout(aiMove, 800);
      }
      if (mode === "multi" && channelRef.current) {
        channelRef.current.send({ type: "broadcast", event: "move", payload: { move: move.san } });
      }
      return true;
    } catch {
      return false;
    }
  };

  const reset = () => {
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setGameOver(null);
    setStatus("Ход белых");
  };

  const resign = () => {
    if (gameOver) return;
    const youAreWhite = playerColor === "white";
    setGameOver({
      result: youAreWhite ? "0-1" : "1-0",
      reason: "Сдача",
    });
  };

  const copyInvite = () => {
    const url = `${window.location.origin}/game/${roomId}`;
    navigator.clipboard.writeText(url);
    toast.success("Ссылка-приглашение скопирована!");
  };

  const options = useMemo(() => ({
    position: fen,
    onPieceDrop,
    boardOrientation: playerColor,
    animationDurationInMs: 200,
    darkSquareStyle: { backgroundColor: "oklch(0.32 0.04 200)" },
    lightSquareStyle: { backgroundColor: "oklch(0.85 0.02 100)" },
    boardStyle: { borderRadius: "12px", boxShadow: "var(--shadow-elegant)" },
    id: "great-chess",
  }), [fen, playerColor]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="glass flex items-center justify-between rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            {mode === "ai" ? <Bot className="h-4 w-4 text-primary" /> : <Users className="h-4 w-4 text-primary" />}
            <span className="font-medium">{mode === "ai" ? "Игра против ИИ" : "Мультиплеер"}</span>
            <span className="text-muted-foreground">· {status}</span>
          </div>
          <div className="flex gap-2">
            {mode === "multi" && roomId && (
              <Button variant="ghost" size="sm" onClick={copyInvite}><Copy className="mr-1 h-3 w-3" /> Пригласить</Button>
            )}
            <Button variant="ghost" size="sm" onClick={resign} disabled={!!gameOver}>
              <Flag className="mr-1 h-3 w-3" /> Сдаться
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="mr-1 h-3 w-3" /> Заново</Button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[min(92vw,640px)]">
          {mounted ? <Chessboard options={options} /> : <div className="aspect-square animate-pulse rounded-xl bg-muted/30" />}
        </div>
      </div>
      <aside className="space-y-4">
        {gameOver ? (
          <AICoach
            pgn={gameRef.current.pgn()}
            result={gameOver.result}
            reason={gameOver.reason}
            playerColor={playerColor}
          />
        ) : (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            <p>Сделай ход — после окончания партии тебе будет доступен разбор от ИИ-Коуча.</p>
          </div>
        )}
      </aside>

      <Dialog open={!!gameOver} onOpenChange={(o) => !o && setGameOver(null)}>
        <DialogContent className="glass border-border/50 sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary shadow-glow">
              <Trophy className="h-6 w-6 text-primary-foreground" />
            </div>
            <DialogTitle className="text-center text-2xl">Партия окончена</DialogTitle>
            <DialogDescription className="text-center text-base text-foreground">
              {gameOver?.reason}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setGameOver(null)}>Закрыть</Button>
            <Button className="flex-1 bg-gradient-primary text-primary-foreground" onClick={reset}>
              <RotateCcw className="mr-2 h-4 w-4" /> Новая партия
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}