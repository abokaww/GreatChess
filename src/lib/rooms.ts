import { supabase } from "@/integrations/supabase/client";

export type RoomColor = "white" | "black";

export type RoomRecord = {
  id: string;
  host_id: string;
  host_color: RoomColor;
  white_player_id: string | null;
  black_player_id: string | null;
  fen: string;
  pgn: string;
  status: "waiting" | "active" | "finished";
};

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function guestColor(hostColor: RoomColor): RoomColor {
  return hostColor === "white" ? "black" : "white";
}

function slotPlayerId(room: RoomRecord, color: RoomColor): string | null {
  return color === "white" ? room.white_player_id : room.black_player_id;
}

export async function createRoom(
  roomId: string,
  hostId: string,
  hostColor: RoomColor,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Полный сброс комнаты, чтобы не остались старые игроки в слотах
  await supabase.from("rooms").delete().eq("id", roomId);

  const { error } = await supabase.from("rooms").insert({
    id: roomId,
    host_id: hostId,
    host_color: hostColor,
    white_player_id: hostColor === "white" ? hostId : null,
    black_player_id: hostColor === "black" ? hostId : null,
    fen: START_FEN,
    pgn: "",
    status: "waiting",
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getRoom(roomId: string): Promise<RoomRecord | null> {
  const { data, error } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (error || !data) return null;
  return data as RoomRecord;
}

export async function joinRoom(
  roomId: string,
  playerId: string,
): Promise<
  | { ok: true; color: RoomColor; whiteUserId: string | null; blackUserId: string | null; room: RoomRecord }
  | { ok: false; reason: "not_found" | "full" | "error"; message?: string }
> {
  const room = await getRoom(roomId);
  if (!room) return { ok: false, reason: "not_found" };

  if (room.host_id === playerId) {
    return {
      ok: true,
      color: room.host_color,
      whiteUserId: room.white_player_id,
      blackUserId: room.black_player_id,
      room,
    };
  }

  const myColor = guestColor(room.host_color);
  const mySlot = slotPlayerId(room, myColor);

  if (mySlot && mySlot !== playerId) {
    return { ok: false, reason: "full" };
  }

  if (mySlot === playerId) {
    return {
      ok: true,
      color: myColor,
      whiteUserId: room.white_player_id,
      blackUserId: room.black_player_id,
      room,
    };
  }

  const patch =
    myColor === "white"
      ? { white_player_id: playerId, status: "active" as const }
      : { black_player_id: playerId, status: "active" as const };

  const { error } = await supabase.from("rooms").update(patch).eq("id", roomId);

  if (error) {
    const retry = await getRoom(roomId);
    if (!retry) return { ok: false, reason: "not_found" };
    const retrySlot = slotPlayerId(retry, myColor);
    if (retrySlot === playerId) {
      return {
        ok: true,
        color: myColor,
        whiteUserId: retry.white_player_id,
        blackUserId: retry.black_player_id,
        room: retry,
      };
    }
    if (retrySlot && retrySlot !== playerId) {
      return { ok: false, reason: "full" };
    }
    return { ok: false, reason: "error", message: error.message };
  }

  const updated = await getRoom(roomId);
  if (!updated) return { ok: false, reason: "not_found" };

  return {
    ok: true,
    color: myColor,
    whiteUserId: updated.white_player_id,
    blackUserId: updated.black_player_id,
    room: updated,
  };
}

export function isRoomReady(room: RoomRecord): boolean {
  return Boolean(room.white_player_id && room.black_player_id);
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
