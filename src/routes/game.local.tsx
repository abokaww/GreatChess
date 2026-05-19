import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { ChessGame } from "@/components/ChessGame";

export const Route = createFileRoute("/game/local")({
  component: GameLocal,
});

function GameLocal() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Локальная игра</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Играйте по очереди на одном устройстве — доска переворачивается после каждого хода.
        </p>
        <ChessGame mode="local" />
      </main>
    </div>
  );
}
