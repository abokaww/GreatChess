import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Brain, Loader2, Sparkles, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { fetchGmAnalysis, GeminiOverloadError } from "@/lib/gemini-coach";
import {
  AI_COACH_MESSAGES,
  checkAiCoachAccess,
  incrementAiRequestCount,
} from "@/lib/ai-limits";

type Props = {
  pgn: string;
  moveHistory: string[];
  gameOver: boolean;
};

export function GameCoachPanel({ pgn, moveHistory, gameOver }: Props) {
  const { user, profile, reloadProfile } = useAuth();
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [panelMessage, setPanelMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gameOver) {
      setAnalysis(null);
      setPanelMessage(null);
      setLoading(false);
    }
  }, [gameOver]);

  const handleAnalyze = async () => {
    setPanelMessage(null);
    setAnalysis(null);

    const access = checkAiCoachAccess(!!user, profile);
    if (!access.allowed) {
      setPanelMessage(
        access.reason === "guest" ? AI_COACH_MESSAGES.guest : AI_COACH_MESSAGES.limit,
      );
      return;
    }

    if (!user?.id) return;

    setLoading(true);
    try {
      const text = await fetchGmAnalysis(pgn);
      await incrementAiRequestCount(user.id);
      await reloadProfile();
      setAnalysis(text);
    } catch (e) {
      if (e instanceof GeminiOverloadError) {
        setPanelMessage(e.message);
      } else {
        setPanelMessage(
          e instanceof Error ? e.message : "Не удалось получить разбор. Попробуйте позже.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const showAnalysis = Boolean(analysis);

  return (
    <div className="flex min-h-[320px] flex-col gap-4">
      <div className="glass flex-1 rounded-2xl p-4">
        {showAnalysis ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Разбор ИИ-Коуча
            </div>
            <div style={{ maxHeight: 'calc(100vh - 240px)' }} className="overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground pb-4">
              {analysis}
            </div>
          </div>
        ) : (
          <>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              История ходов
            </h3>
            {moveHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ходы появятся по ходу партии.</p>
            ) : (
              <ol style={{ maxHeight: 'calc(100vh - 320px)' }} className="space-y-1 overflow-y-auto text-sm font-mono pb-2">
                {Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => {
                  const w = moveHistory[i * 2];
                  const b = moveHistory[i * 2 + 1];
                  return (
                    <li key={i} className="text-foreground/90">
                      <span className="text-muted-foreground">{i + 1}.</span> {w}
                      {b ? ` ${b}` : ""}
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </div>

      <div className="glass rounded-2xl p-4">
        {!gameOver && !showAnalysis && (
          <p className="text-center text-sm text-muted-foreground">
            После окончания партии здесь появится кнопка разбора.
          </p>
        )}

        {gameOver && !showAnalysis && !loading && (
          <>
            {panelMessage && (
              <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-relaxed text-foreground">
                {panelMessage}
                {panelMessage === AI_COACH_MESSAGES.limit && (
                  <Link
                    to="/pro"
                    className="mt-3 flex items-center justify-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    <Crown className="h-3.5 w-3.5" />
                    GreatChess Plus
                  </Link>
                )}
              </div>
            )}
            <Button
              onClick={handleAnalyze}
              className="w-full bg-gradient-primary text-primary-foreground shadow-glow"
            >
              <Brain className="mr-2 h-4 w-4" />
              Разбор партии
            </Button>
          </>
        )}

        {gameOver && loading && (
          <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm">ИИ-Коуч анализирует партию…</p>
          </div>
        )}

        {!gameOver && panelMessage && !loading && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-relaxed text-foreground">
            {panelMessage}
            {panelMessage === AI_COACH_MESSAGES.limit && (
              <Link
                to="/pro"
                className="mt-3 flex items-center justify-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <Crown className="h-3.5 w-3.5" />
                GreatChess Plus
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
