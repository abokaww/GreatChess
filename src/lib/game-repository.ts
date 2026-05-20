import { supabase } from "@/integrations/supabase/client";
import type { StoredGame } from "@/lib/game-storage";
import {
  loadSavedGames as loadLocalGames,
  saveGame as saveLocalGame,
  removeSavedGame as removeLocalGame,
} from "@/lib/game-storage";

type DbGameRow = {
  id: string;
  user_id: string;
  mode: StoredGame["mode"];
  title: string;
  room_id: string | null;
  fen: string;
  pgn: string;
  human_color: "white" | "black" | null;
  player_color: "white" | "black" | null;
  board_theme: string;
  piece_theme: string;
  finished: boolean;
  updated_at: string;
};

function rowToStored(row: DbGameRow): StoredGame {
  return {
    id: row.id,
    mode: row.mode,
    title: row.title,
    roomId: row.room_id ?? undefined,
    updatedAt: new Date(row.updated_at).getTime(),
    fen: row.fen,
    pgn: row.pgn,
    humanColor: row.human_color ?? undefined,
    playerColor: row.player_color ?? undefined,
    boardTheme: row.board_theme,
    pieceTheme: row.piece_theme,
    finished: row.finished,
  };
}

function storedToRow(game: StoredGame, userId: string): Omit<DbGameRow, "user_id" | "updated_at"> & {
  user_id: string;
  updated_at: string;
} {
  return {
    id: game.id,
    user_id: userId,
    mode: game.mode,
    title: game.title,
    room_id: game.roomId ?? null,
    fen: game.fen,
    pgn: game.pgn,
    human_color: game.humanColor ?? null,
    player_color: game.playerColor ?? null,
    board_theme: game.boardTheme,
    piece_theme: game.pieceTheme,
    finished: game.finished,
    updated_at: new Date(game.updatedAt).toISOString(),
  };
}

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function mergeGames(local: StoredGame[], remote: StoredGame[]): StoredGame[] {
  const merged = new Map<string, StoredGame>();
  for (const item of [...local, ...remote]) {
    const existing = merged.get(item.id);
    if (!existing || item.updatedAt > existing.updatedAt) {
      merged.set(item.id, item);
    }
  }
  return Array.from(merged.values());
}

export async function fetchSavedGamesForUser(userId: string): Promise<StoredGame[]> {
  const { data, error } = await supabase
    .from("saved_games")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error || !data) return loadLocalGames();

  const remote = (data as DbGameRow[]).map(rowToStored);
  const local = loadLocalGames();
  const merged = mergeGames(local, remote);

  if (typeof window !== "undefined") {
    window.localStorage.setItem("gc:ongoing-games", JSON.stringify(merged));
  }

  return merged.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function persistGame(game: StoredGame, userId: string | null | undefined): Promise<void> {
  if (!userId || userId.startsWith("guest")) {
    saveLocalGame(game);
    return;
  }

  const id = isUuid(game.id) ? game.id : crypto.randomUUID();
  const normalized = { ...game, id };
  saveLocalGame(normalized);
  const payload = storedToRow(normalized, userId);

  if (!game.finished) {
    const { data: ongoing } = await supabase
      .from("saved_games")
      .select("id")
      .eq("user_id", userId)
      .eq("mode", game.mode)
      .eq("finished", false);

    const staleIds = (ongoing ?? [])
      .map((row) => row.id as string)
      .filter((existingId) => existingId !== id);

    if (staleIds.length) {
      await supabase.from("saved_games").delete().in("id", staleIds);
    }
  }

  await supabase.from("saved_games").upsert(payload, { onConflict: "id" });
}

export async function deleteGameForUser(id: string, userId: string | null | undefined): Promise<void> {
  removeLocalGame(id);
  if (!userId || userId.startsWith("guest")) return;
  await supabase.from("saved_games").delete().eq("id", id).eq("user_id", userId);
}

export async function getGameById(id: string, userId: string | null | undefined): Promise<StoredGame | null> {
  if (userId && !userId.startsWith("guest")) {
    const { data } = await supabase
      .from("saved_games")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (data) return rowToStored(data as DbGameRow);
  }
  return loadLocalGames().find((g) => g.id === id) ?? null;
}

export async function syncLocalGamesToCloud(userId: string): Promise<void> {
  const local = loadLocalGames();
  for (const game of local) {
    await persistGame(game, userId);
  }
}

export async function loadLatestOngoingGame(
  mode: StoredGame["mode"],
  userId: string | null | undefined,
): Promise<StoredGame | null> {
  const games = userId && !userId.startsWith("guest")
    ? await fetchSavedGamesForUser(userId)
    : loadLocalGames();
  const ongoing = games.filter((g) => g.mode === mode && !g.finished);
  if (!ongoing.length) return null;
  return ongoing.sort((a, b) => b.updatedAt - a.updatedAt)[0];
}
