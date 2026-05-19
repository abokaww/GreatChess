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
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [humanColor, setHumanColor] = useState<"white" | "black">(playerColor);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalDestinations, setLegalDestinations] = useState<string[]>([]);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const remoteUpdateRef = useRef(false);
  const eloAppliedRef = useRef(false);
  const finishedRef = useRef(false);
  const [fenHistory, setFenHistory] = useState<string[]>([gameRef.current.fen()]);
  const [replayIndex, setReplayIndex] = useState<number>(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    try {
      const v = localStorage.getItem("gc:sound");
      setSoundEnabled(v === "1");
    } catch {
      setSoundEnabled(false);
    }
  }, [soundEnabled]);

  const syncMoveHistory = useCallback(() => {
    setMoveHistory(gameRef.current.history());
  }, []);

  useEffect(() => {
    // compute FEN history whenever moves change
    try {
      const ch = new Chess();
      const fens: string[] = [ch.fen()];
      const hist = gameRef.current.history();
      for (const san of hist) {
        ch.move(san);
        fens.push(ch.fen());
      }
      setFenHistory(fens);
      setReplayIndex(fens.length - 1);
    } catch {
      setFenHistory([gameRef.current.fen()]);
      setReplayIndex(0);
    }
  }, [moveHistory]);

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

  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
    setLegalDestinations([]);
  }, []);

  const playMoveSound = useCallback(() => {
    if (!soundEnabled) return;
    if (typeof window === "undefined") return;
    try {
      const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      // Two-oscillator percussive tone with filter for a warmer "wood" feel
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc1.type = "triangle";
      osc2.type = "sine";
      osc1.frequency.value = 220;
      osc2.frequency.value = 440;

      filter.type = "lowpass";
      filter.frequency.value = 1200;

      gain.gain.value = 0.0001;

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      // quick percussive envelope
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.28);
      osc2.stop(now + 0.28);

      // close context when done
      setTimeout(() => {
        try {
          ctx.close();
        } catch {}
      }, 400);
    } catch {
      // ignore unsupported playback
    }
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
      setEndDialogOpen(true);
      setEndDialogOpen(true);

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
        clearSelection();
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
    const aiColor = humanColor === "white" ? "black" : "white";
    const turnColor = g.turn() === "w" ? "white" : "black";
    if (turnColor !== aiColor) return; // only move when it's AI's turn
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
    playMoveSound();
    const over = getEndState();
    if (over) {
      void finishGame(over);
      return;
    }
    updateStatus();
    if (mode === "ai" && !g.isGameOver()) {
      // schedule next AI move only if after the move it's still AI's turn
      const nextTurn = g.turn() === "w" ? "white" : "black";
      if (nextTurn === aiColor) setTimeout(aiMove, 800);
    }
  }, [getEndState, finishGame, updateStatus, mode, syncLocalOrientation, syncMoveHistory, playMoveSound, humanColor]);

  useEffect(() => {
    if (mode !== "ai") return;
    // If human chose black, AI (white) should move first
    if (moveHistory.length === 0) {
      const g = gameRef.current;
      const aiColor = humanColor === "white" ? "black" : "white";
      const currentTurn = g.turn() === "w" ? "white" : "black";
      if (currentTurn === aiColor) setTimeout(aiMove, 400);
    }
  }, [mode, humanColor, aiMove, moveHistory]);

  const onSquareClick = useCallback(
    (square: string) => {
      if (gameOver) return;
      const g = gameRef.current;
      const turnColor = g.turn() === "w" ? "white" : "black";

      if (mode === "multiplayer" && turnColor !== playerColor) {
        toast.error("Сейчас ход соперника");
        return;
      }

      if (mode === "ai" && turnColor !== humanColor) {
        toast.error("Сейчас ход соперника");
        return;
      }

      const piece = g.get(square);
      const isOwnPiece = piece?.color === g.turn();
      if (selectedSquare && legalDestinations.includes(square)) {
        const move = g.move({ from: selectedSquare, to: square, promotion: "q" });
        if (!move) {
          clearSelection();
          return;
        }

        const newFen = g.fen();
        setFen(newFen);
        syncMoveHistory();
        syncLocalOrientation();
        clearSelection();
        playMoveSound();

        const over = getEndState();
        if (over) {
          void finishGame(over);
        } else {
          updateStatus();
          if (mode === "ai") setTimeout(aiMove, 800);
          if (mode === "multiplayer") broadcastFen(newFen);
        }
        return;
      }

      if (isOwnPiece) {
        const moves = g.moves({ square, verbose: true });
        setSelectedSquare(square);
        setLegalDestinations(moves.map((m) => m.to));
        return;
      }

      clearSelection();
    },
    [mode, playerColor, selectedSquare, legalDestinations, gameOver, syncLocalOrientation, getEndState, finishGame, updateStatus, aiMove, broadcastFen, clearSelection, playMoveSound, syncMoveHistory],
  );

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
    if (mode === "ai") {
      const turnColor = g.turn() === "w" ? "white" : "black";
      if (turnColor !== humanColor) {
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
      clearSelection();
      playMoveSound();

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
    setEndDialogOpen(false);
    setMoveHistory([]);
    setFenHistory([startFen]);
    setReplayIndex(0);
    setStatus("Ход белых");
    eloAppliedRef.current = false;
    finishedRef.current = false;
    if (mode === "local") setBoardOrientation("white");
    else if (mode === "multiplayer") setBoardOrientation(playerColor);
    if (mode === "multiplayer") broadcastFen(startFen);
  };

  const resign = () => {
    if (gameOver) return;
    const g = gameRef.current;
    const currentTurn = g.turn() === "w" ? "white" : "black";
    const result = currentTurn === "white" ? "0-1" : "1-0";
    void finishGame({ result, reason: "Сдача" });
  };

  const copyInvite = () => {
    if (!roomId) return;
    const url = `${window.location.origin}/game/multiplayer/${roomId}`;
    navigator.clipboard.writeText(url);
    toast.success("Ссылка скопирована!");
  };

  const orientation =
    mode === "local"
      ? boardOrientation
      : mode === "multiplayer"
      ? playerColor
      : mode === "ai"
      ? humanColor
      : "white";

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, any> = {};
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: "rgba(59, 130, 246, 0.24)",
      };
    }
    legalDestinations.forEach((square) => {
      styles[square] = {
        backgroundColor: "rgba(59, 130, 246, 0.22)",
        boxShadow: "inset 0 0 0 1px rgba(59, 130, 246, 0.8)",
      };
    });
    return styles;
  }, [legalDestinations, selectedSquare]);

  const options = useMemo(
    () => ({
      position: fen,
      onPieceDrop,
      onSquareClick,
      customSquareStyles,
      boardOrientation: orientation,
      animationDurationInMs: 200,
      darkSquareStyle: { backgroundColor: "oklch(0.32 0.04 200)" },
      lightSquareStyle: { backgroundColor: "oklch(0.85 0.02 100)" },
      boardStyle: { borderRadius: "12px", boxShadow: "var(--shadow-elegant)" },
      id: `great-chess-${mode}-${roomId ?? "solo"}`,
    }),
    [fen, orientation, mode, roomId, customSquareStyles, onPieceDrop, onSquareClick],
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
              {mode === "ai" && moveHistory.length === 0 && (
                <div className="ml-4 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={humanColor === "white" ? "secondary" : "ghost"}
                    onClick={() => setHumanColor("white")}
                  >
                    Я — белыми
                  </Button>
                  <Button
                    size="sm"
                    variant={humanColor === "black" ? "secondary" : "ghost"}
                    onClick={() => setHumanColor("black")}
                  >
                    Я — чёрными
                  </Button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {mode === "multiplayer" && roomId && (
                <Button variant="ghost" size="sm" onClick={copyInvite}>
                  <Copy className="mr-1 h-3 w-3" /> Пригласить
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => {
                const v = !soundEnabled;
                setSoundEnabled(v);
                try { localStorage.setItem("gc:sound", v ? "1" : "0"); } catch {}
              }}>
                {soundEnabled ? "Звук: вкл" : "Звук: выкл"}
              </Button>
              <Button variant="ghost" size="sm" onClick={resign} disabled={!!gameOver}>
                <Flag className="mr-1 h-3 w-3" /> Сдаться
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="mr-1 h-3 w-3" /> Заново
              </Button>
              {gameOver && fenHistory.length > 0 && (
                <div className="ml-2 flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => {
                    setReplayIndex(0);
                    setFen(fenHistory[0]);
                  }}>
                    ««
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    const next = Math.max(0, replayIndex - 1);
                    setReplayIndex(next);
                    setFen(fenHistory[next]);
                  }}>
                    «
                  </Button>
                  <div className="text-sm text-muted-foreground px-2">{replayIndex}/{fenHistory.length - 1}</div>
                  <Button size="sm" variant="ghost" onClick={() => {
                    const next = Math.min(fenHistory.length - 1, replayIndex + 1);
                    setReplayIndex(next);
                    setFen(fenHistory[next]);
                  }}>
                    »
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    setReplayIndex(fenHistory.length - 1);
                    setFen(fenHistory[fenHistory.length - 1]);
                  }}>
                    »»
                  </Button>
                </div>
              )}
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

      <Dialog open={endDialogOpen} onOpenChange={(o) => setEndDialogOpen(o)}>
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
            <Button variant="outline" className="flex-1" onClick={() => setEndDialogOpen(false)}>
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
