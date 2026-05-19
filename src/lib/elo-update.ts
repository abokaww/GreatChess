import { supabase } from "@/integrations/supabase/client";
import { computeEloUpdate, outcomeForColor, type ParsedResult } from "@/lib/elo";

type ProfileRow = {
  id: string;
  elo: number;
  wins: number;
  losses: number;
};

async function fetchProfile(id: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, elo, wins, losses")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as ProfileRow;
}

function isRealUserId(id: string | null | undefined): id is string {
  return !!id && !id.startsWith("guest");
}

/**
 * Each authenticated player updates only their own row (RLS-safe).
 * Call from both clients when an online game ends.
 */
export async function applyOnlineEloForCurrentPlayer(params: {
  currentUserId: string;
  opponentUserId: string;
  playerColor: "white" | "black";
  result: ParsedResult;
}): Promise<{ ok: boolean; error?: string }> {
  const { currentUserId, opponentUserId, playerColor, result } = params;

  if (!isRealUserId(currentUserId) || !isRealUserId(opponentUserId)) {
    return { ok: false, error: "guest_players" };
  }

  const [me, opponent] = await Promise.all([
    fetchProfile(currentUserId),
    fetchProfile(opponentUserId),
  ]);
  if (!me || !opponent) {
    return { ok: false, error: "profile_not_found" };
  }

  const outcome = outcomeForColor(result, playerColor);
  const { newRating } = computeEloUpdate(me.elo, opponent.elo, outcome);

  const { error } = await supabase
    .from("profiles")
    .update({
      elo: newRating,
      wins: me.wins + (outcome === "win" ? 1 : 0),
      losses: me.losses + (outcome === "loss" ? 1 : 0),
    })
    .eq("id", currentUserId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
