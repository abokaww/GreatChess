import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ChessGame } from "@/components/ChessGame";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/game/$id")({
  component: GameMulti,
});

function GameMulti() {
  const { id } = Route.useParams();
  const [color, setColor] = useState<"white" | "black" | null>(null);

  if (!color) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="container mx-auto px-4 py-16">
          <div className="glass shadow-elegant mx-auto max-w-md rounded-2xl p-8 text-center">
            <h1 className="mb-2 text-2xl font-semibold">Комната #{id}</h1>
            <p className="mb-6 text-sm text-muted-foreground">Выбери сторону, чтобы начать партию.</p>
            <div className="flex gap-3">
              <Button className="flex-1 bg-white text-black hover:bg-white/90" onClick={() => setColor("white")}>
                Играть белыми
              </Button>
              <Button className="flex-1 bg-black text-white hover:bg-black/80 border border-border" onClick={() => setColor("black")}>
                Играть чёрными
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Поделись ссылкой с другом — он выберет другую сторону.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Комната #{id}</h1>
        <ChessGame mode="multi" roomId={id} playerColor={color} />
      </main>
    </div>
  );
}