import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Trophy, Crown, Medal, Award, ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/leaderboard")({
  component: Leaderboard,
});

type Row = { name: string; city: string; rating: number; is_pro?: boolean };

const ALL: Row[] = [
  { name: "Алишер К.", city: "Алматы", rating: 2100, is_pro: true },
  { name: "Данияр С.", city: "Астана", rating: 1950, is_pro: true },
  { name: "Аружан М.", city: "Алматы", rating: 1920 },
  { name: "Серик Т.", city: "Шымкент", rating: 1810, is_pro: true },
  { name: "Мадияр Б.", city: "Астана", rating: 1760 },
  { name: "Бауржан Н.", city: "Шымкент", rating: 1690 },
];

const TABS = ["Все города", "Алматы", "Астана", "Шымкент"] as const;
type Tab = typeof TABS[number];

function getRows(tab: Tab): Row[] {
  if (tab === "Все города") {
    return [
      { name: "Алишер К.", city: "Алматы", rating: 2100, is_pro: true },
      { name: "Данияр С.", city: "Астана", rating: 1950, is_pro: true },
      { name: "Аружан М.", city: "Алматы", rating: 1920 },
      { name: "Серик Т.", city: "Шымкент", rating: 1810, is_pro: true },
    ];
  }
  return ALL.filter((r) => r.city === tab).sort((a, b) => b.rating - a.rating);
}

function PlaceIcon({ i }: { i: number }) {
  if (i === 0) return <Trophy className="h-5 w-5" style={{ color: "#FFD700" }} />;
  if (i === 1) return <Medal className="h-5 w-5" style={{ color: "#C0C0C0" }} />;
  if (i === 2) return <Award className="h-5 w-5" style={{ color: "#CD7F32" }} />;
  return <span className="font-mono text-sm text-muted-foreground">{i + 1}</span>;
}

function Leaderboard() {
  const [tab, setTab] = useState<Tab>("Все города");
  const rows = getRows(tab);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-10">
        <Link
          to="/game/ai"
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Вернуться к игре
        </Link>
        <div className="mb-8 flex items-center gap-3">
          <Trophy className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Рейтинг игроков Казахстана</h1>
        </div>
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${tab === c ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="glass shadow-elegant overflow-hidden rounded-2xl">
          <div className="grid grid-cols-[60px_1fr_120px_100px] gap-2 border-b border-border/50 bg-secondary/30 px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground">
            <div>Место</div>
            <div>Игрок</div>
            <div>Город</div>
            <div className="text-right">ELO</div>
          </div>
          <ul className="divide-y divide-border/50">
            {rows.map((r, i) => (
              <li
                key={r.name}
                className="grid grid-cols-[60px_1fr_120px_100px] items-center gap-2 px-5 py-4 transition hover:bg-secondary/30"
              >
                <div className="flex items-center justify-center"><PlaceIcon i={i} /></div>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">
                    {r.name.charAt(0)}
                  </div>
                  <div className="flex items-center gap-2 truncate font-medium">
                    {r.name}
                    {r.is_pro && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">
                        <Crown className="h-2.5 w-2.5" /> PRO
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">{r.city}</div>
                <div className="text-gradient text-right text-xl font-bold tabular-nums">{r.rating}</div>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}