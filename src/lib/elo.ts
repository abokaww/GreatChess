/** Standard chess ELO expected score for player A vs B. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export type EloOutcome = "win" | "loss" | "draw";

export type EloUpdate = {
  newRating: number;
  delta: number;
};

const DEFAULT_K = 32;

/** Compute new rating after a single game (K=32). */
export function computeEloUpdate(
  playerRating: number,
  opponentRating: number,
  outcome: EloOutcome,
  k = DEFAULT_K,
): EloUpdate {
  const score = outcome === "win" ? 1 : outcome === "draw" ? 0.5 : 0;
  const expected = expectedScore(playerRating, opponentRating);
  const delta = Math.round(k * (score - expected));
  return { newRating: playerRating + delta, delta };
}

export type ParsedResult = "1-0" | "0-1" | "1/2-1/2";

export function outcomeForColor(
  result: ParsedResult,
  color: "white" | "black",
): EloOutcome {
  if (result === "1/2-1/2") return "draw";
  if (result === "1-0") return color === "white" ? "win" : "loss";
  return color === "black" ? "win" : "loss";
}
