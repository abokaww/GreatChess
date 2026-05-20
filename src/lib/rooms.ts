import { supabase } from "@/integrations/supabase/client";

export type Room = {
  id: string;
  code: string;
  name: string;
  host_id: string;
  guest_id: string | null;
  host_color: "white" | "black";
  status: "waiting" | "playing" | "finished";
  game_state: { fen: string; pgn: string };
  current_turn: "white" | "black" | null;
  created_at?: string;
  updated_at?: string;
};

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createRoom(
  name: string,
  hostColor: "white" | "black",
): Promise<{ ok: true; room: Room } | { ok: false; error: string }> {
  const u = await supabase.auth.getUser();
  const userId = u.data.user?.id;
  if (!userId) return { ok: false, error: "Не авторизованы" };

  const trimmedName = (name || "").trim().slice(0, 80) || "Партия с другом";

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `room-${Date.now()}`;
    const { data, error } = await supabase
      .from("rooms")
      .insert({
        id,
        code,
        name: trimmedName,
        host_id: userId,
        guest_id: null,
        host_color: hostColor,
        status: "waiting",
        game_state: { fen: START_FEN, pgn: "" },
        current_turn: "white",
      })
      .select()
      .single();

    if (error) {
      if ((error as any).code === "23505") continue;
      return { ok: false, error: error.message ?? "Не удалось создать комнату" };
    }

    return { ok: true, room: data as Room };
  }

  return { ok: false, error: "Не удалось сгенерировать уникальный код" };
}

export async function getRoomById(roomId: string): Promise<Room | null> {
  const { data, error } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (error) return null;
  return data as Room | null;
}

export async function joinRoomById(
  roomId: string,
): Promise<{ ok: true; room: Room } | { ok: false; reason: string; message?: string }> {
  const u = await supabase.auth.getUser();
  const userId = u.data.user?.id;
  if (!userId) return { ok: false, reason: "auth", message: "Не авторизованы" };

  const existing = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
  const room = existing.data as Room | null;
  if (!room) return { ok: false, reason: "not_found", message: "Комната не найдена" };

  if (room.host_id === userId) return { ok: true, room };

  if (room.guest_id && room.guest_id !== userId) {
    return { ok: false, reason: "full", message: "Комната уже занята другим игроком" };
  }

  if (room.guest_id === userId) return { ok: true, room };

  const { data: updated, error } = await supabase
    .from("rooms")
    .update({ guest_id: userId, status: "playing" })
    .eq("id", room.id)
    .is("guest_id", null)
    .select()
    .maybeSingle();

  if (error) return { ok: false, reason: "error", message: error.message };
  if (!updated) return { ok: false, reason: "full", message: "Комната уже занята" };

  return { ok: true, room: updated as Room };
}

export function subscribeToRoom(id: string, callback: (room: Room | null) => void) {
  const ch = supabase
    .channel(`public:rooms:${id}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "rooms", filter: `id=eq.${id}` },
      (payload) => {
        callback(payload.new as Room);
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void (async () => {
          const res = await supabase.from("rooms").select("*").eq("id", id).maybeSingle();
          callback(res.data as Room | null);
        })();
      }
    });

  return () => {
    try {
      supabase.removeChannel(ch);
    } catch (e) {
      // ignore
    }
  };
}

export async function updateGameState(id: string, state: any, turn: "white" | "black" | null) {
  await supabase.from("rooms").update({ game_state: state, current_turn: turn }).eq("id", id);
}
