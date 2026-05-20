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

/** Слот гостя занят другим игроком (не хостом и не нами). */
function isGuestSlotTakenByOther(room: RoomRecord, guestSlotColor: RoomColor, playerId: string): boolean {
  const occupant = slotPlayerId(room, guestSlotColor);
  if (!occupant) return false;
  if (occupant === playerId) return false;
  if (occupant === room.host_id) return false;
  return true;
}

export async function createRoom(
  roomId: string,
  hostId: string,
  hostColor: RoomColor,
): Promise<{ ok: true } | { ok: false; error: string }> {
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

  if (typeof window !== "undefined") {
    sessionStorage.setItem(
      `gc:room-meta:${roomId}`,
      JSON.stringify({ hostId, hostColor }),
    );
  }

  return { ok: true };
}

export function getRoomMetaFromSession(roomId: string): { hostId: string; hostColor: RoomColor } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`gc:room-meta:${roomId}`);
    if (!raw) return null;
    return JSON.parse(raw) as { hostId: string; hostColor: RoomColor };
  } catch {
    return null;
  }
}

export async function getRoom(roomId: string): Promise<RoomRecord | null> {
  const { data, error } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (error || !data) return null;
  return data as RoomRecord;
}

async function claimGuestSlot(
  roomId: string,
  myColor: RoomColor,
  playerId: string,
): Promise<RoomRecord | null> {
  const patch =
    myColor === "white"
      ? { white_player_id: playerId, status: "active" as const }
      : { black_player_id: playerId, status: "active" as const };

  const { error } = await supabase.from("rooms").update(patch).eq("id", roomId);
  if (error) {
    console.error("claimGuestSlot:", error.message);
    return null;
  }
  return getRoom(roomId);
}

export async function joinRoom(
  roomId: string,
  playerId: string,
): Promise<
  | { ok: true; color: RoomColor; whiteUserId: string | null; blackUserId: string | null; room: RoomRecord }
  | { ok: false; reason: "not_found" | "full" | "error"; message?: string }
> {
  let room = await getRoom(roomId);

  if (!room) {
    const meta = getRoomMetaFromSession(roomId);
    if (!meta) return { ok: false, reason: "not_found" };

    const isHost = meta.hostId === playerId;
    return {
      ok: true,
      color: isHost ? meta.hostColor : guestColor(meta.hostColor),
      whiteUserId: meta.hostColor === "white" ? meta.hostId : null,
      blackUserId: meta.hostColor === "black" ? meta.hostId : null,
      room: {
        id: roomId,
        host_id: meta.hostId,
        host_color: meta.hostColor,
        white_player_id: meta.hostColor === "white" ? meta.hostId : null,
        black_player_id: meta.hostColor === "black" ? meta.hostId : null,
        fen: START_FEN,
        pgn: "",
        status: "waiting",
      },
    };
  }

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

  if (isGuestSlotTakenByOther(room, myColor, playerId)) {
    return { ok: false, reason: "full" };
  }

  const currentSlot = slotPlayerId(room, myColor);
  if (currentSlot === playerId) {
    return {
      ok: true,
      color: myColor,
      whiteUserId: room.white_player_id,
      blackUserId: room.black_player_id,
      room,
    };
  }

  const updated = await claimGuestSlot(roomId, myColor, playerId);
  if (!updated) {
    room = await getRoom(roomId);
    if (!room) return { ok: false, reason: "not_found" };
    if (isGuestSlotTakenByOther(room, myColor, playerId)) {
      return { ok: false, reason: "full" };
    }
    const slot = slotPlayerId(room, myColor);
    if (slot === playerId) {
      return {
        ok: true,
        color: myColor,
        whiteUserId: room.white_player_id,
        blackUserId: room.black_player_id,
        room,
      };
    }
    return { ok: false, reason: "error", message: "Не удалось занять место в комнате" };
  }

  return {
    ok: true,
    color: myColor,
    whiteUserId: updated.white_player_id,
    blackUserId: updated.black_player_id,
    room: updated,
  };
}

export function isRoomReady(room: RoomRecord): boolean {
  const white = room.white_player_id;
  const black = room.black_player_id;
  if (!white || !black) return false;
  if (white === black) return false;
  return true;
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
