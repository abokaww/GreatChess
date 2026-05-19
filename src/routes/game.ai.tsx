import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { ChessGame } from "@/components/ChessGame";

export const Route = createFileRoute("/game/ai")({
  component: GameAI,
});

function GameAI() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Партия против ИИ</h1>
        <ChessGame mode="ai" />
      </main>
    </div>
  );
}