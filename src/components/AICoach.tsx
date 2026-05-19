import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, Lock, Clock, Crown, Brain } from "lucide-react";
import { Chess } from "chess.js";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const LOCAL_KEY = "gc_coach_last_used";

export type CoachInput = {
  pgn: string;
  result: string; // "1-0" | "0-1" | "1/2-1/2"
  reason?: string; // "Мат", "Сдача", "Пат", ...
  playerColor?: "white" | "black";
};

function pieceValues(fen: string) {
  const counts: Record<string, number> = {};
  const placement = fen.split(" ")[0];
  for (const ch of placement) {
    if (/[a-zA-Z]/.test(ch)) counts[ch] = (counts[ch] ?? 0) + 1;
  }
  const v = (p: string) => ({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }[p.toLowerCase()] ?? 0);
  let white = 0;
  let black = 0;
  for (const [p, n] of Object.entries(counts)) {
    if (p === p.toUpperCase()) white += v(p) * n;
    else black += v(p) * n;
  }
  return { white, black };
}

function generateDeepAnalysis({ pgn, result, reason, playerColor = "white" }: CoachInput): string[] {
  const chess = new Chess();
  try { chess.loadPgn(pgn); } catch {}
  const history = chess.history({ verbose: true });
  const moves = history.length;
  const checkmate = chess.isCheckmate();
  const stalemate = chess.isStalemate();
  const { white, black } = pieceValues(chess.fen());
  const diff = white - black;
  const playerWon =
    (result === "1-0" && playerColor === "white") ||
    (result === "0-1" && playerColor === "black");
  const draw = result === "1/2-1/2";

  const captures = history.filter((m) => m.captured).length;
  const castled = history.some((m) => m.san === "O-O" || m.san === "O-O-O");
  const earlyQueen = history
    .slice(0, 8)
    .some((m) => m.piece === "q" && m.color === (playerColor === "white" ? "w" : "b"));
  const f7Weakness = history.some(
    (m) => (m.to === "f7" || m.to === "f2") && m.captured,
  );

  const tips: string[] = [];

  // Вердикт
  if (checkmate) {
    tips.push(
      playerWon
        ? `🏆 Победа матом за ${moves} ходов. Финальная комбинация была точной — вы рассчитали угрозы королю соперника.`
        : `♚ Мат на ${moves}-м ходу. Финальная комбинация соперника была опасной${
            f7Weakness ? " — обратите внимание на поле f7/f2, классическая слабость в дебюте" : ""
          }. Защита короля требует приоритета.`,
    );
  } else if (stalemate) {
    tips.push(`⚖️ Пат на ${moves}-м ходу. Ничья — но в позиции с материалом ${white}:${black} можно было играть на победу.`);
  } else if (draw) {
    tips.push(`🤝 Ничья за ${moves} ходов. Партия была равной, но точная игра в эндшпиле могла принести перевес.`);
  } else if (reason === "Сдача") {
    tips.push(
      playerWon
        ? `🏆 Соперник сдался на ${moves}-м ходу при материале ${white}:${black}. Уверенная игра!`
        : `⚑ Вы сдались на ${moves}-м ходу. Материал был ${white}:${black} — иногда упорная защита спасает партию.`,
    );
  }

  // Длина партии
  if (moves < 20) {
    tips.push(
      `⚡ Партия короткая (${moves} ходов). Вы применили агрессивный дебют, но в быстрых партиях легко зевнуть тактику — играйте внимательнее в первые 10 ходов.`,
    );
  } else if (moves > 60) {
    tips.push(
      `🧠 Длинная партия (${moves} ходов) — отличная выносливость. Работайте над техникой эндшпиля: активный король и проходные пешки решают.`,
    );
  } else {
    tips.push(`📊 Сбалансированная партия в ${moves} ходов. Хороший темп развития фигур.`);
  }

  // Рокировка
  if (!castled && moves > 12) {
    tips.push(
      `🛡️ Вы не рокировали за ${moves} ходов. Король в центре — главная причина поражений. ИИ рекомендует рокироваться в первые 8–10 ходов.`,
    );
  } else if (castled) {
    tips.push(`✅ Рокировка выполнена — король в безопасности. Грамотный подход к дебюту.`);
  }

  // Ферзь
  if (earlyQueen) {
    tips.push(
      `♛ Ранний выход ферзя — классическая ошибка. Соперник может атаковать его лёгкими фигурами и выигрывать темпы. Развивайте сначала коней и слонов.`,
    );
  }

  // Размены
  if (captures < 4 && moves > 20) {
    tips.push(`🎯 Мало разменов (${captures}) — позиционная игра. Старайтесь искать тактические шансы, особенно в центре.`);
  } else if (captures > 12) {
    tips.push(`⚔️ Много разменов (${captures}) — открытая игра. Считайте материал после каждого размена.`);
  }

  // Материальный вердикт
  const sign = diff > 0 ? "+" : "";
  tips.push(
    `📈 Финальный баланс материала: белые ${white} / чёрные ${black} (${sign}${diff}). ${
      Math.abs(diff) > 3
        ? "Большое преимущество — реализация прошла уверенно."
        : "Близкая по материалу позиция — исход решали тактика и время."
    }`,
  );

  return tips;
}

export function AICoach(props: CoachInput) {
  const { profile, user, reloadProfile } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const [analysis, setAnalysis] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // tick every second for live countdown
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const lastUsed = useMemo(() => {
    if (profile?.coach_last_used) return new Date(profile.coach_last_used).getTime();
    if (typeof window !== "undefined") {
      const v = localStorage.getItem(LOCAL_KEY);
      return v ? parseInt(v, 10) : 0;
    }
    return 0;
  }, [profile, analysis]);

  const remaining = profile?.is_pro ? 0 : Math.max(0, lastUsed + COOLDOWN_MS - now);
  const blocked = remaining > 0 && !analysis;

  const hh = Math.floor(remaining / 3_600_000);
  const mm = Math.floor((remaining % 3_600_000) / 60_000);
  const ss = Math.floor((remaining % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  const analyze = async () => {
    if (blocked || loading) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1100));
    const tips = generateDeepAnalysis(props);
    setAnalysis(tips);
    if (typeof window !== "undefined") localStorage.setItem(LOCAL_KEY, String(Date.now()));
    if (user && !profile?.is_guest) {
      await supabase.from("profiles").update({ coach_last_used: new Date().toISOString() }).eq("id", user.id);
      reloadProfile();
    }
    setLoading(false);
    toast.success("Разбор от ИИ-Коуча готов!");
  };

  if (analysis) {
    return (
      <div className="glass shadow-elegant rounded-2xl p-6">
        <div className="mb-4 flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Экспертный разбор партии</h3>
        </div>
        <ul className="space-y-3 text-sm leading-relaxed">
          {analysis.map((t, i) => (
            <li key={i} className="flex gap-2 rounded-lg bg-secondary/30 p-3">
              <span className={i === 0 ? "text-foreground" : "text-muted-foreground"}>{t}</span>
            </li>
          ))}
        </ul>
        {!profile?.is_pro && (
          <Link to="/pro" className="mt-4 block">
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm transition hover:border-primary">
              <span className="flex items-center gap-2"><Crown className="h-4 w-4 text-primary" /> Безлимитный анализ — в PRO</span>
              <span className="text-primary">→</span>
            </div>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="glass shadow-elegant rounded-2xl p-6 text-center">
      <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary" />
      <h3 className="mb-2 text-lg font-semibold">ИИ-Коуч готов помочь</h3>
      <p className="mb-5 text-sm text-muted-foreground">
        Получи персональный разбор партии — ключевые моменты, ошибки и советы по улучшению.
      </p>
      {blocked ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
            <div className="mb-2 flex items-center justify-center gap-2 text-destructive">
              <Clock className="h-4 w-4 animate-pulse" />
              <span className="text-xs font-medium uppercase tracking-wider">Лимит исчерпан</span>
            </div>
            <div className="font-mono text-3xl font-bold tabular-nums text-destructive">
              {pad(hh)}:{pad(mm)}:{pad(ss)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">до следующего бесплатного анализа</div>
          </div>
          <Button asChild className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
            <Link to="/pro"><Crown className="mr-2 h-4 w-4" /> Купить PRO для безлимита</Link>
          </Button>
        </div>
      ) : (
        <Button onClick={analyze} disabled={loading} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
          {loading ? "ИИ анализирует партию…" : (<><Brain className="mr-2 h-4 w-4" /> Анализ ИИ-Коуча</>)}
        </Button>
      )}
      {!profile?.is_pro && !blocked && (
        <p className="mt-3 flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" /> Бесплатно: 1 раз в 24 часа
        </p>
      )}
    </div>
  );
}