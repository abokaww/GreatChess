import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GameCoachPanel } from "@/components/GameCoachPanel";
import { supabase } from "@/integrations/supabase/client";
import { applyOnlineEloForCurrentPlayer } from "@/lib/elo-update";
import type { ParsedResult } from "@/lib/elo";
import { Bot, RotateCcw, Users, Copy, Flag, Trophy } from "lucide-react";
import { toast } from "sonner";

export type GameMode = "ai" | "local" | "multiplayer";

export type GameOverState = {
  result: ParsedResult;
  reason: string;
};

type Props = {
  mode: GameMode;
  roomId?: string;
  playerColor?: "white" | "black";
  whiteUserId?: string | null;
  blackUserId?: string | null;
  currentUserId?: string | null;
  onEloApplied?: () => void;
};

export function ChessGame({
  mode,
  roomId,
  playerColor = "white",
  whiteUserId,
  blackUserId,
  currentUserId,
  onEloApplied,
}: Props) {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [status, setStatus] = useState("Ход белых");
  const [gameOver, setGameOver] = useState<GameOverState | null>(null);
  const [mounted, setMounted] = useState(false);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const remoteUpdateRef = useRef(false);
  const eloAppliedRef = useRef(false);
  const finishedRef = useRef(false);

  useEffect(() => setMounted(true), []);

  const syncMoveHistory = useCallback(() => {
    setMoveHistory(gameRef.current.history());
  }, []);

  const getEndState = useCallback((): GameOverState | null => {
    const g = gameRef.current;
    if (g.isCheckmate()) {
      const winner = g.turn() === "w" ? "чёрные" : "белые";
      const result: ParsedResult = g.turn() === "w" ? "0-1" : "1-0";
      return { result, reason: `Мат! Победили ${winner}` };
    }
    if (g.isStalemate()) return { result: "1/2-1/2", reason: "Пат — ничья" };
    if (g.isDraw()) return { result: "1/2-1/2", reason: "Ничья" };
    return null;
  }, []);

  const updateStatus = useCallback(() => {
    const g = gameRef.current;
    if (g.inCheck()) setStatus("Шах!");
    else setStatus(g.turn() === "w" ? "Ход белых" : "Ход чёрных");
  }, []);

  const syncLocalOrientation = useCallback(() => {
    if (mode !== "local") return;
    setBoardOrientation(gameRef.current.turn() === "w" ? "white" : "black");
  }, [mode]);

  const broadcastFen = useCallback(
    (fenStr: string) => {
      if (mode !== "multiplayer" || !channelRef.current || !currentUserId) return;
      channelRef.current.send({
        type: "broadcast",
        event: "fen",
        payload: { fen: fenStr, by: currentUserId },
      });
    },
    [mode, currentUserId],
  );

  const finishGame = useCallback(
    async (over: GameOverState) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setGameOver(over);

      if (mode === "multiplayer" && !eloAppliedRef.current && currentUserId) {
        eloAppliedRef.current = true;
        const opponentId =
          currentUserId === whiteUserId ? blackUserId : whiteUserId;
        if (opponentId) {
          const res = await applyOnlineEloForCurrentPlayer({
            currentUserId,
            opponentUserId: opponentId,
            playerColor,
            result: over.result,
          });
          if (res.ok) {
            toast.success("Ваш рейтинг ELO обновлён!");
            onEloApplied?.();
          }
        }
      }
    },
    [mode, whiteUserId, blackUserId, currentUserId, playerColor, onEloApplied],
  );

  const applyRemoteFen = useCallback(
    (fenStr: string) => {
      try {
        remoteUpdateRef.current = true;
        gameRef.current.load(fenStr);
        setFen(fenStr);
        syncMoveHistory();
        const over = getEndState();
        if (over) void finishGame(over);
        else updateStatus();
        syncLocalOrientation();
      } catch {
        /* ignore invalid fen */
      } finally {
        remoteUpdateRef.current = false;
      }
    },
    [getEndState, finishGame, updateStatus, syncLocalOrientation, syncMoveHistory],
  );

  useEffect(() => {
    if (mode !== "multiplayer" || !roomId) return;

    const ch = supabase.channel(`room:${roomId}:game`, {
      config: { broadcast: { self: false } },
    });

    ch.on("broadcast", { event: "fen" }, ({ payload }) => {
      const data = payload as { fen?: string; by?: string };
      if (!data.fen || data.by === currentUserId) return;
      applyRemoteFen(data.fen);
    });

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED" && gameRef.current.fen() === fen) {
        ch.send({
          type: "broadcast",
          event: "sync_request",
          payload: { by: currentUserId },
        });
      }
    });

    ch.on("broadcast", { event: "sync_request" }, ({ payload }) => {
      const data = payload as { by?: string };
      if (data.by === currentUserId || playerColor !== "white") return;
      broadcastFen(gameRef.current.fen());
    });

    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [mode, roomId, currentUserId, playerColor, applyRemoteFen, broadcastFen, fen]);

  useEffect(() => {
    if (mode === "multiplayer") {
      setBoardOrientation(playerColor);
    }
  }, [mode, playerColor]);

  const aiMove = useCallback(() => {
    const g = gameRef.current;
    if (g.isGameOver()) return;
    const verbose = g.moves({ verbose: true });
    if (!verbose.length) return;
    const scored = verbose
      .map((m) => {
        let s = Math.random();
        if (m.captured) s += 5;
        if (m.san.includes("+")) s += 2;
        if (m.san.includes("#")) s += 100;
        return { m, s };
      })
      .sort((a, b) => b.s - a.s);
    g.move(scored[0].m.san);
    setFen(g.fen());
    syncMoveHistory();
    syncLocalOrientation();
    const over = getEndState();
    if (over) {
      void finishGame(over);
      return;
    }
    updateStatus();
    if (mode === "ai" && !g.isGameOver()) {
      setTimeout(aiMove, 800);
    }
  }, [getEndState, finishGame, updateStatus, mode, syncLocalOrientation, syncMoveHistory]);

  const onPieceDrop = ({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }) => {
    if (!targetSquare || gameOver) return false;
    const g = gameRef.current;

    if (mode === "multiplayer") {
      const turnColor = g.turn() === "w" ? "white" : "black";
      if (turnColor !== playerColor) {
        toast.error("Сейчас ход соперника");
        return false;
      }
    }

    try {
      const move = g.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      if (!move) return false;
      const newFen = g.fen();
      setFen(newFen);
      syncMoveHistory();
      syncLocalOrientation();

      const over = getEndState();
      if (over) {
        void finishGame(over);
      } else {
        updateStatus();
        if (mode === "ai") setTimeout(aiMove, 800);
        if (mode === "multiplayer") broadcastFen(newFen);
      }
      return true;
    } catch {
      return false;
    }
  };

  const reset = () => {
    gameRef.current = new Chess();
    const startFen = gameRef.current.fen();
    setFen(startFen);
    setGameOver(null);
    setMoveHistory([]);
    setStatus("Ход белых");
    eloAppliedRef.current = false;
    finishedRef.current = false;
    if (mode === "local") setBoardOrientation("white");
    else if (mode === "multiplayer") setBoardOrientation(playerColor);
    if (mode === "multiplayer") broadcastFen(startFen);
  };

  const resign = () => {
    if (gameOver) return;
    const youAreWhite = mode === "local" ? gameRef.current.turn() === "w" : playerColor === "white";
    void finishGame({
      result: youAreWhite ? "0-1" : "1-0",
      reason: "Сдача",
    });
  };

  const copyInvite = () => {
    if (!roomId) return;
    const url = `${window.location.origin}/game/multiplayer/${roomId}`;
    navigator.clipboard.writeText(url);
    toast.success("Ссылка скопирована!");
  };

  const orientation =
    mode === "local" ? boardOrientation : mode === "multiplayer" ? playerColor : "white";

  const options = useMemo(
    () => ({
      position: fen,
      onPieceDrop,
      boardOrientation: orientation,
      animationDurationInMs: 200,
      darkSquareStyle: { backgroundColor: "oklch(0.32 0.04 200)" },
      lightSquareStyle: { backgroundColor: "oklch(0.85 0.02 100)" },
      boardStyle: { borderRadius: "12px", boxShadow: "var(--shadow-elegant)" },
      id: `great-chess-${mode}-${roomId ?? "solo"}`,
    }),
    [fen, orientation, mode, roomId, gameOver],
  );

  const modeLabel =
    mode === "ai" ? "Игра против ИИ" : mode === "local" ? "Локальная игра" : "Онлайн мультиплеер";

  const pgn = gameRef.current.pgn();

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="glass flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              {mode === "ai" ? (
                <Bot className="h-4 w-4 text-primary" />
              ) : (
                <Users className="h-4 w-4 text-primary" />
              )}
              <span className="font-medium">{modeLabel}</span>
              <span className="text-muted-foreground">· {status}</span>
              {mode === "multiplayer" && (
                <span className="text-xs text-muted-foreground">
                  · вы {playerColor === "white" ? "белыми" : "чёрными"}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {mode === "multiplayer" && roomId && (
                <Button variant="ghost" size="sm" onClick={copyInvite}>
                  <Copy className="mr-1 h-3 w-3" /> Пригласить
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={resign} disabled={!!gameOver}>
                <Flag className="mr-1 h-3 w-3" /> Сдаться
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="mr-1 h-3 w-3" /> Заново
              </Button>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[min(92vw,640px)]">
            {mounted ? (
              <Chessboard options={options} />
            ) : (
              <div className="aspect-square animate-pulse rounded-xl bg-muted/30" />
            )}
          </div>
        </div>
        <GameCoachPanel pgn={pgn} moveHistory={moveHistory} gameOver={!!gameOver} />
      </div>

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
            <Button variant="outline" className="flex-1" onClick={() => setGameOver(null)}>
              Закрыть
            </Button>
            <Button className="flex-1" variant="secondary" onClick={reset}>
              <RotateCcw className="mr-2 h-4 w-4" /> Новая
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
