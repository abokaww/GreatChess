import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, Medal, Award, ArrowLeft, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/leaderboard")({
  component: Leaderboard,
});

type LeaderRow = {
  username: string;
  elo: number;
};

function PlaceIcon({ i }: { i: number }) {
  if (i === 0) return <Trophy className="h-5 w-5" style={{ color: "#FFD700" }} />;
  if (i === 1) return <Medal className="h-5 w-5" style={{ color: "#C0C0C0" }} />;
  if (i === 2) return <Award className="h-5 w-5" style={{ color: "#CD7F32" }} />;
  return <span className="font-mono text-sm text-muted-foreground">{i + 1}</span>;
}

function Leaderboard() {
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: qErr } = await supabase
        .from("profiles")
        .select("username, elo")
        .not("username", "is", null)
        .neq("username", "")
        .order("elo", { ascending: false })
        .limit(100);

      if (cancelled) return;
      if (qErr) {
        setError(qErr.message);
        setRows([]);
      } else {
        setRows(
          (data ?? []).map((row: any) => ({
            username: String(row.username ?? "Игрок"),
            elo: typeof row.elo === "number" ? row.elo : 1000,
          })) as LeaderRow[],
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-10">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> На главную
        </Link>
        <div className="mb-8 flex items-center gap-3">
          <Trophy className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Рейтинг игроков</h1>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </p>
        )}

        {!loading && !error && (
          <div className="glass shadow-elegant overflow-hidden rounded-2xl">
            <div className="grid grid-cols-[60px_1fr_120px_100px] gap-2 border-b border-border/50 bg-secondary/30 px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground">
              <div>Место</div>
              <div>Игрок</div>
              <div>Город</div>
              <div className="text-right">ELO</div>
            </div>
            {rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Пока нет игроков в рейтинге. Сыграйте онлайн-партию, чтобы попасть в таблицу.
              </p>
            ) : (
              <ul className="divide-y divide-border/50">
                {rows.map((r, i) => (
                  <li
                    key={`${r.username}-${i}`}
                    className="grid grid-cols-[60px_1fr_120px_100px] items-center gap-2 px-5 py-4 transition hover:bg-secondary/30"
                  >
                    <div className="flex items-center justify-center">
                      <PlaceIcon i={i} />
                    </div>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">
                        {r.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex min-w-0 items-center gap-2 truncate font-medium">
                        {r.username}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">—</div>
                    <div className="text-gradient text-right text-xl font-bold tabular-nums">{r.elo}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
