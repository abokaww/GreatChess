import { supabase } from "@/integrations/supabase/client";

export type Room = {
  id: string;
  code: string;
  name: string;
  host_id: string;
  guest_id: string | null;
  status: "waiting" | "playing" | "finished";
  game_state: any;
  current_turn: "white" | "black" | null;
  created_at?: string;
  updated_at?: string;
};

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createRoom(name: string): Promise<{ ok: true; room: Room } | { ok: false; error: string }> {
  const u = await supabase.auth.getUser();
  const userId = u.data.user?.id;
  if (!userId) return { ok: false, error: "Not authenticated" };

  const trimmedName = (name || "").trim().slice(0, 80) || "Партия с другом";

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `room-${Date.now()}`;
    const { data, error } = await supabase
      .from("rooms")
      .insert({ id, code, name: trimmedName, host_id: userId, guest_id: null, status: "waiting", game_state: {}, current_turn: null })
      .select()
      .single();

    if (error) {
      // unique violation on code — try again
      if ((error as any).code === "23505") continue;
      return { ok: false, error: error.message ?? "Failed to create room" };
    }

    return { ok: true, room: data as Room };
  }

  return { ok: false, error: "Failed to generate unique room code" };
}

export async function joinRoom(codeInput: string): Promise<{ ok: true; room: Room } | { ok: false; reason: string; message?: string }> {
  const code = (codeInput || "").trim().toUpperCase();
  if (code.length !== 6) return { ok: false, reason: "not_found", message: "Введите код комнаты" };

  const u = await supabase.auth.getUser();
  const userId = u.data.user?.id;
  if (!userId) return { ok: false, reason: "auth", message: "Не авторизованы" };

  const existing = await supabase.from("rooms").select("*").eq("code", code).maybeSingle();
  const room = existing.data as Room | null;
  if (!room) return { ok: false, reason: "not_found", message: "Комната с таким кодом не найдена" };

  if (room.host_id === userId) return { ok: false, reason: "own_room", message: "Это ваша комната — нажмите «Войти в игру»" };

  // Allow re-joining if the guest is the same user.
  // Consider the room occupied only if guest_id exists and it's not the current user.
  if (room.guest_id && room.guest_id !== userId) {
    return { ok: false, reason: "full", message: "Комната уже занята другим игроком" };
  }

  if (room.guest_id === userId) {
    return { ok: true, room };
  }

  // Try to atomically set guest_id if it's still empty
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
      // on subscribe, fetch initial value
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

