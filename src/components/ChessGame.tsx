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
import { getSavedGame, loadLatestSavedGame, loadVisualPreferences, removeSavedGame, saveGame, StoredGame } from "@/lib/game-storage";
import { getBoardTheme } from "@/lib/visual-themes";
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
  resumeGame?: StoredGame | null;
};

export function ChessGame({
  mode,
  roomId,
  playerColor = "white",
  whiteUserId,
  blackUserId,
  currentUserId,
  onEloApplied,
  resumeGame = null,
}: Props) {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [status, setStatus] = useState("Ход белых");
  const [gameOver, setGameOver] = useState<GameOverState | null>(null);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [humanColor, setHumanColor] = useState<"white" | "black">(playerColor);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalDestinations, setLegalDestinations] = useState<string[]>([]);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [boardThemeKey, setBoardThemeKey] = useState<string>("default");
  const [pieceThemeKey, setPieceThemeKey] = useState<string>("default");
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [gameId, setGameId] = useState<string>(() => {
    if (typeof window !== "undefined" && typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `game-${Date.now()}`;
  });
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const remoteUpdateRef = useRef(false);
  const eloAppliedRef = useRef(false);
  const finishedRef = useRef(false);
  const [fenHistory, setFenHistory] = useState<string[]>([gameRef.current.fen()]);
  const [replayIndex, setReplayIndex] = useState<number>(0);

  useEffect(() => setMounted(true), []);

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

  const loadThemeSettings = useCallback(() => {
    const preferences = loadVisualPreferences();
    setBoardThemeKey(preferences.boardTheme);
    setPieceThemeKey(preferences.pieceTheme);
  }, []);

  const currentBoardTheme = getBoardTheme(boardThemeKey);

  const saveCurrentGame = useCallback(
    (finished = false) => {
      if (typeof window === "undefined") return;
      if (mode !== "ai" && mode !== "local") return;
      saveGame({
        id: gameId,
        mode,
        title: mode === "ai" ? `ИИ: ${humanColor === "white" ? "белыми" : "чёрными"}` : "Локальная игра",
        updatedAt: Date.now(),
        fen: gameRef.current.fen(),
        pgn: gameRef.current.pgn(),
        humanColor: mode === "ai" ? humanColor : undefined,
        playerColor: mode === "local" ? playerColor : undefined,
        boardTheme: boardThemeKey,
        pieceTheme: pieceThemeKey,
        finished,
      });
    },
    [boardThemeKey, humanColor, mode, gameId, pieceThemeKey, playerColor],
  );

  const clearSavedGame = useCallback(() => {
    if (typeof window === "undefined") return;
    if (mode !== "ai" && mode !== "local") return;
    removeSavedGame(gameId);
  }, [gameId, mode]);

  useEffect(() => {
    if (mode === "ai" || mode === "local") {
      const saved = resumeGame?.id ? resumeGame : loadLatestSavedGame(mode);
      if (saved && !saved.finished) {
        const loaded = new Chess();
        loaded.loadPgn(saved.pgn);
        gameRef.current = loaded;
        setFen(saved.fen);
        setHumanColor(saved.humanColor ?? playerColor);
        setBoardThemeKey(saved.boardTheme ?? "default");
        setPieceThemeKey(saved.pieceTheme ?? "default");
        setGameId(saved.id);
        setStatus(loaded.turn() === "w" ? "Ход белых" : "Ход чёрных");
        setMoveHistory(loaded.history());
        return;
      }
    }

    loadThemeSettings();
  }, [loadThemeSettings, mode, playerColor, resumeGame]);

  useEffect(() => {
    if (!gameOver && (mode === "ai" || mode === "local")) {
      saveCurrentGame(false);
    }
  }, [gameOver, moveHistory, mode, saveCurrentGame]);

  useEffect(() => {
    if (gameOver && (mode === "ai" || mode === "local")) {
      saveCurrentGame(true);
    }
  }, [gameOver, mode, saveCurrentGame]);

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
  }, [getEndState, finishGame, updateStatus, mode, syncLocalOrientation, syncMoveHistory, humanColor]);

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
    [mode, playerColor, selectedSquare, legalDestinations, gameOver, syncLocalOrientation, getEndState, finishGame, updateStatus, aiMove, broadcastFen, clearSelection, syncMoveHistory],
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
      darkSquareStyle: currentBoardTheme.dark,
      lightSquareStyle: currentBoardTheme.light,
      boardStyle: currentBoardTheme.boardStyle,
      id: `great-chess-${mode}-${roomId ?? "solo"}`,
    }),
    [fen, orientation, mode, roomId, customSquareStyles, onPieceDrop, onSquareClick, currentBoardTheme],
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
