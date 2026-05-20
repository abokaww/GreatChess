import { supabase } from "@/integrations/supabase/client";
import type { StoredGame } from "@/lib/game-storage";
import {
  loadSavedGames as loadLocalGames,
  saveGame as saveLocalGame,
  removeSavedGame as removeLocalGame,
  storageKeyForUser,
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

function storedToRow(game: StoredGame, userId: string) {
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

function deletedIdsKey(userId: string): string {
  return `gc:deleted-ids:${userId}`;
}

function getDeletedIds(userId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(deletedIdsKey(userId));
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(list);
  } catch {
    return new Set();
  }
}

function markDeletedId(userId: string, id: string) {
  if (typeof window === "undefined") return;
  const set = getDeletedIds(userId);
  set.add(id);
  localStorage.setItem(deletedIdsKey(userId), JSON.stringify([...set]));
}

function unmarkDeletedId(userId: string, id: string) {
  if (typeof window === "undefined") return;
  const set = getDeletedIds(userId);
  set.delete(id);
  localStorage.setItem(deletedIdsKey(userId), JSON.stringify([...set]));
}

function cacheGamesForUser(userId: string, games: StoredGame[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKeyForUser(userId), JSON.stringify(games));
}

/** Источник правды для авторизованного пользователя — только Supabase (по user_id / почте). */
export async function fetchSavedGamesForUser(userId: string): Promise<StoredGame[]> {
  const deleted = getDeletedIds(userId);

  const { data, error } = await supabase
    .from("saved_games")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("fetchSavedGamesForUser:", error.message);
    const local = loadLocalGames(userId).filter((g) => !deleted.has(g.id));
    return local.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  const remote = (data as DbGameRow[])
    .map(rowToStored)
    .filter((g) => !deleted.has(g.id));

  cacheGamesForUser(userId, remote);
  return remote;
}

export async function persistGame(game: StoredGame, userId: string | null | undefined): Promise<void> {
  if (!userId || userId.startsWith("guest")) {
    saveLocalGame(game, null);
    return;
  }

  if (getDeletedIds(userId).has(game.id)) return;

  const id = isUuid(game.id) ? game.id : crypto.randomUUID();
  const normalized = { ...game, id };
  saveLocalGame(normalized, userId);

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
      await supabase.from("saved_games").delete().in("id", staleIds).eq("user_id", userId);
    }
  }

  const { error } = await supabase.from("saved_games").upsert(payload, { onConflict: "id" });
  if (error) console.error("persistGame:", error.message);
}

export async function deleteGameForUser(
  id: string,
  userId: string | null | undefined,
): Promise<{ ok: boolean; error?: string }> {
  removeLocalGame(id, userId);

  if (!userId || userId.startsWith("guest")) {
    return { ok: true };
  }

  markDeletedId(userId, id);

  const { error } = await supabase.from("saved_games").delete().eq("id", id).eq("user_id", userId);

  if (error) {
    console.error("deleteGameForUser:", error.message);
    return { ok: false, error: error.message };
  }

  unmarkDeletedId(userId, id);

  const remaining = loadLocalGames(userId).filter((g) => g.id !== id);
  cacheGamesForUser(userId, remaining);

  return { ok: true };
}

export async function getGameById(id: string, userId: string | null | undefined): Promise<StoredGame | null> {
  if (getDeletedIds(userId ?? "").has(id)) return null;

  if (userId && !userId.startsWith("guest")) {
    const { data, error } = await supabase
      .from("saved_games")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data) return rowToStored(data as DbGameRow);
  }

  return loadLocalGames(userId).find((g) => g.id === id) ?? null;
}

/** Один раз переносит гостевые партии в аккаунт после первого входа. */
export async function migrateGuestGamesOnce(userId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const flag = `gc:guest-migrated:${userId}`;
  if (localStorage.getItem(flag)) return;

  const guestGames = loadLocalGames(null);
  for (const game of guestGames) {
    await persistGame(game, userId);
  }

  localStorage.removeItem("gc:ongoing-games:guest");
  localStorage.setItem(flag, "1");
}

export async function loadLatestOngoingGame(
  mode: StoredGame["mode"],
  userId: string | null | undefined,
): Promise<StoredGame | null> {
  const games =
    userId && !userId.startsWith("guest")
      ? await fetchSavedGamesForUser(userId)
      : loadLocalGames(null);
  const ongoing = games.filter((g) => g.mode === mode && !g.finished);
  if (!ongoing.length) return null;
  return ongoing.sort((a, b) => b.updatedAt - a.updatedAt)[0];
}
