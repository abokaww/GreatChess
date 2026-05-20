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

export async function createRoom(
  roomId: string,
  hostId: string,
  hostColor: RoomColor,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("rooms").upsert({
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
  | { ok: false; reason: "not_found" | "full" }
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

  const guestColor: RoomColor = room.host_color === "white" ? "black" : "white";

  if (guestColor === "white") {
    if (room.white_player_id && room.white_player_id !== playerId) {
      return { ok: false, reason: "full" };
    }
    if (!room.white_player_id) {
      const { error } = await supabase
        .from("rooms")
        .update({ white_player_id: playerId, status: "active" })
        .eq("id", roomId)
        .is("white_player_id", null);
      if (error) return { ok: false, reason: "full" };
    }
  } else {
    if (room.black_player_id && room.black_player_id !== playerId) {
      return { ok: false, reason: "full" };
    }
    if (!room.black_player_id) {
      const { error } = await supabase
        .from("rooms")
        .update({ black_player_id: playerId, status: "active" })
        .eq("id", roomId)
        .is("black_player_id", null);
      if (error) return { ok: false, reason: "full" };
    }
  }

  const updated = await getRoom(roomId);
  if (!updated) return { ok: false, reason: "not_found" };

  const whiteTaken = updated.white_player_id && updated.white_player_id !== playerId;
  const blackTaken = updated.black_player_id && updated.black_player_id !== playerId;
  if (whiteTaken && blackTaken) return { ok: false, reason: "full" };

  const myColor: RoomColor =
    updated.white_player_id === playerId
      ? "white"
      : updated.black_player_id === playerId
        ? "black"
        : guestColor;

  return {
    ok: true,
    color: myColor,
    whiteUserId: updated.white_player_id,
    blackUserId: updated.black_player_id,
    room: updated,
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
