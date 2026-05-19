import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy room URLs → multiplayer route */
export const Route = createFileRoute("/game/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/game/multiplayer/$roomId",
      params: { roomId: params.id },
    });
  },
  component: () => null,
});
