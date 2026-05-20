import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { BOARD_THEMES, PIECE_THEMES } from "@/lib/visual-themes";
import { loadVisualPreferences, saveVisualPreferences } from "@/lib/game-storage";

export const Route = createFileRoute("/visual")({
  component: Visual,
});

function Visual() {
  const [boardTheme, setBoardTheme] = useState("default");
  const [pieceTheme, setPieceTheme] = useState("default");

  useEffect(() => {
    const saved = loadVisualPreferences();
    setBoardTheme(saved.boardTheme);
    setPieceTheme(saved.pieceTheme);
  }, []);

  useEffect(() => {
    saveVisualPreferences({ boardTheme, pieceTheme });
  }, [boardTheme, pieceTheme]);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">Визуальные настройки</p>
          <h1 className="text-3xl font-semibold">Тема доски и фигур</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Выберите тему доски и стиль фигур. PRO-темы помечены и доступны только с подпиской.
          </p>
        </div>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="glass rounded-3xl p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Тема доски</h2>
                <p className="text-sm text-muted-foreground">Новая доска будет применена в следующих партиях.</p>
              </div>
            </div>
            <div className="grid gap-3">
              {BOARD_THEMES.map((theme) => (
                <button
                  key={theme.key}
                  type="button"
                  disabled={theme.locked}
                  onClick={() => setBoardTheme(theme.key)}
                  className={`rounded-3xl border p-4 text-left transition ${
                    theme.locked
                      ? "cursor-not-allowed border-border/50 bg-muted text-muted-foreground"
                      : boardTheme === theme.key
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-primary/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold">{theme.name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{theme.description}</div>
                    </div>
                    {theme.locked ? <span className="rounded-full bg-muted px-3 py-1 text-xs uppercase text-muted-foreground">PRO</span> : null}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="glass rounded-3xl p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Тема фигур</h2>
                <p className="text-sm text-muted-foreground">Выберите стиль фигур для следующей партии.</p>
              </div>
            </div>
            <div className="grid gap-3">
              {PIECE_THEMES.map((theme) => (
                <button
                  key={theme.key}
                  type="button"
                  disabled={theme.locked}
                  onClick={() => setPieceTheme(theme.key)}
                  className={`rounded-3xl border p-4 text-left transition ${
                    theme.locked
                      ? "cursor-not-allowed border-border/50 bg-muted text-muted-foreground"
                      : pieceTheme === theme.key
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-primary/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold">{theme.name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{theme.description}</div>
                    </div>
                    {theme.locked ? <span className="rounded-full bg-muted px-3 py-1 text-xs uppercase text-muted-foreground">PRO</span> : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button onClick={() => saveVisualPreferences({ boardTheme, pieceTheme })}>
            Сохранить настройки
          </Button>
          <Button variant="outline" asChild>
            <a href="/">На главную</a>
          </Button>
        </div>
      </main>
    </div>
  );
}
