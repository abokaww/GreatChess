export type GameMode = "ai" | "local" | "multiplayer";

export type StoredGame = {
  id: string;
  mode: GameMode;
  title: string;
  updatedAt: number;
  fen: string;
  pgn: string;
  roomId?: string;
  humanColor?: "white" | "black";
  playerColor?: "white" | "black";
  boardTheme: string;
  pieceTheme: string;
  finished: boolean;
};

const STORAGE_KEY = "gc:ongoing-games";
const VISUAL_KEY = "gc:visual-preferences";

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function loadSavedGames(): StoredGame[] {
  if (typeof window === "undefined") return [];
  const saved = safeParse<StoredGame[]>(window.localStorage.getItem(STORAGE_KEY));
  if (!Array.isArray(saved)) return [];

  const merged = new Map<string, StoredGame>();
  for (const item of saved) {
    if (!item || typeof item.id !== "string") continue;
    const existing = merged.get(item.id);
    if (!existing || item.updatedAt > existing.updatedAt) {
      merged.set(item.id, item);
    }
  }

  return Array.from(merged.values());
}

export function loadLatestSavedGame(mode: GameMode): StoredGame | null {
  const games = loadSavedGames().filter((item) => item.mode === mode && !item.finished);
  if (!games.length) return null;
  return games.sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

export function loadOngoingGame(mode: GameMode): StoredGame | null {
  const games = loadSavedGames().filter((item) => item.mode === mode && !item.finished);
  if (!games.length) return null;
  return games.sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

export function getSavedGame(id: string): StoredGame | null {
  return loadSavedGames().find((item) => item.id === id) ?? null;
}

export function saveGame(game: StoredGame) {
  if (typeof window === "undefined") return;
  const games = loadSavedGames().filter(
    (item) =>
      item.id !== game.id &&
      !(item.mode === game.mode && !item.finished && !game.finished),
  );
  games.push(game);

  const merged = new Map<string, StoredGame>();
  for (const item of games) {
    const existing = merged.get(item.id);
    if (!existing || item.updatedAt >= existing.updatedAt) {
      merged.set(item.id, item);
    }
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(merged.values())));
}

export function removeSavedGame(id: string) {
  if (typeof window === "undefined") return;
  const games = loadSavedGames().filter((item) => item.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
}

export type VisualPreferences = {
  boardTheme: string;
  pieceTheme: string;
};

export function loadVisualPreferences(): VisualPreferences {
  if (typeof window === "undefined") {
    return { boardTheme: "default", pieceTheme: "default" };
  }
  const saved = safeParse<VisualPreferences>(window.localStorage.getItem(VISUAL_KEY));
  return {
    boardTheme: saved?.boardTheme ?? "default",
    pieceTheme: saved?.pieceTheme ?? "default",
  };
}

export function saveVisualPreferences(preferences: VisualPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VISUAL_KEY, JSON.stringify(preferences));
}
