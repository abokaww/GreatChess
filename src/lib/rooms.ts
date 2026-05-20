import { supabase } from "@/integrations/supabase/client";

export type RoomColor = "white" | "black";

export type RoomRecord = {
  id: string;
  code: string;
  name: string;
  host_user_id: string;
  guest_user_id: string | null;
  host_color: RoomColor;
  fen: string;
  pgn: string;
  status: "waiting" | "active" | "finished";
};

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function guestColor(hostColor: RoomColor): RoomColor {
  return hostColor === "white" ? "black" : "white";
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function getPlayerColor(room: RoomRecord, userId: string): RoomColor | null {
  if (room.host_user_id === userId) return room.host_color;
  if (room.guest_user_id === userId) return guestColor(room.host_color);
  return null;
}

export function getWhiteBlackUserIds(room: RoomRecord): {
  whiteUserId: string | null;
  blackUserId: string | null;
} {
  if (room.host_color === "white") {
    return {
      whiteUserId: room.host_user_id,
      blackUserId: room.guest_user_id,
    };
  }
  return {
    whiteUserId: room.guest_user_id,
    blackUserId: room.host_user_id,
  };
}

export function isRoomReady(room: RoomRecord): boolean {
  return Boolean(room.guest_user_id && room.guest_user_id !== room.host_user_id);
}

export async function createRoom(
  hostUserId: string,
  name: string,
  hostColor: RoomColor,
): Promise<{ ok: true; room: RoomRecord } | { ok: false; error: string }> {
  const trimmedName = name.trim().slice(0, 40) || "Партия с другом";

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { data, error } = await supabase
      .from("rooms")
      .insert({
        code,
        name: trimmedName,
        host_user_id: hostUserId,
        guest_user_id: null,
        host_color: hostColor,
        fen: START_FEN,
        pgn: "",
        status: "waiting",
      })
      .select()
      .single();

    if (!error && data) {
      return { ok: true, room: data as RoomRecord };
    }
    if (error?.code !== "23505") {
      return { ok: false, error: error?.message ?? "Не удалось создать комнату" };
    }
  }

  return { ok: false, error: "Не удалось сгенерировать уникальный код" };
}

export async function getRoomById(roomId: string): Promise<RoomRecord | null> {
  const { data, error } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (error || !data) return null;
  return data as RoomRecord;
}

export async function joinRoomByCode(
  userId: string,
  rawCode: string,
): Promise<
  | { ok: true; room: RoomRecord; color: RoomColor }
  | { ok: false; reason: "not_found" | "full" | "own_room" | "error"; message?: string }
> {
  const code = rawCode.trim().toUpperCase();
  if (code.length < 4) {
    return { ok: false, reason: "not_found", message: "Введите код комнаты" };
  }

  const existing = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  const room = existing.data as RoomRecord | null;
  if (!room) return { ok: false, reason: "not_found", message: "Комната с таким кодом не найдена" };

  if (room.host_user_id === userId) {
    return { ok: false, reason: "own_room", message: "Это ваша комната — нажмите «Войти в игру»" };
  }

  if (room.guest_user_id === userId) {
    return { ok: true, room, color: guestColor(room.host_color) };
  }

  if (room.guest_user_id) {
    return { ok: false, reason: "full", message: "Комната уже занята другим игроком" };
  }

  const { data: updated, error } = await supabase
    .from("rooms")
    .update({ guest_user_id: userId, status: "active" })
    .eq("id", room.id)
    .is("guest_user_id", null)
    .select()
    .maybeSingle();

  if (error) {
    return { ok: false, reason: "error", message: error.message };
  }

  if (!updated) {
    return { ok: false, reason: "full", message: "Комната уже занята" };
  }

  return {
    ok: true,
    room: updated as RoomRecord,
    color: guestColor(room.host_color),
  };
}

export async function updateRoomPosition(
  roomId: string,
  fen: string,
  pgn: string,
  status: RoomRecord["status"] = "active",
): Promise<void> {
  await supabase.from("rooms").update({ fen, pgn, status }).eq("id", roomId);
}

export async function finishRoom(roomId: string, fen: string, pgn: string): Promise<void> {
  await supabase.from("rooms").update({ fen, pgn, status: "finished" }).eq("id", roomId);
}
