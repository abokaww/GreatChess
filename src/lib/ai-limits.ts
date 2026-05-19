import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/hooks/use-auth";

const DAILY_LIMIT = 2;

export type AiCoachBlockReason = "guest" | "limit";

export type AiCoachAccess =
  | { allowed: true }
  | { allowed: false; reason: AiCoachBlockReason };

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Проверка: можно ли запустить разбор (гость / лимит / PRO). */
export function checkAiCoachAccess(
  isLoggedIn: boolean,
  profile: Profile | null | undefined,
): AiCoachAccess {
  if (!isLoggedIn || profile?.is_guest) {
    return { allowed: false, reason: "guest" };
  }
  const today = todayDateString();
  const lastDate = profile.last_ai_request_date?.slice(0, 10) ?? null;
  const count = lastDate === today ? (profile.ai_requests_count ?? 0) : 0;

  if (count >= DAILY_LIMIT) {
    return { allowed: false, reason: "limit" };
  }
  return { allowed: true };
}

/** Увеличить счётчик после успешного запроса к Gemini. */
export async function incrementAiRequestCount(userId: string): Promise<void> {
  const today = todayDateString();

  const { data } = await supabase
    .from("profiles")
    .select("ai_requests_count, last_ai_request_date")
    .eq("id", userId)
    .maybeSingle();

  const lastDate = data?.last_ai_request_date?.slice(0, 10) ?? null;
  const current = lastDate === today ? (data?.ai_requests_count ?? 0) : 0;

  await supabase
    .from("profiles")
    .update({
      ai_requests_count: current + 1,
      last_ai_request_date: today,
    })
    .eq("id", userId);
}

export const AI_COACH_MESSAGES = {
  guest: "Для использования ИИ-Коуча необходимо войти в аккаунт!",
  limit:
    "Вы исчерпали лимит бесплатных разборов (2 в сутки). Для безлимитного доступа оформите подписку GreatChess Plus!",
} as const;
