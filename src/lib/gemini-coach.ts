import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = (pgn: string) =>
  `Ты профессиональный шахматный ИИ-тренер. Проанализируй эту партию по PGN: ${pgn}. Твой ответ должен быть СТРОГО НА РУССКОМ ЯЗЫКЕ и разбит на следующие блоки:
1. Ключевой момент: Найди главный переломный момент партии (зевок или лучший ход) и объясни, почему он стал решающим при победе или поражении.
2. Работа над ошибками: Понятным языком объясни, как нужно было сыграть в этой ситуации и как исправить эту ошибку в будущем.
3. Общий вердикт: Напиши, над какими стратегическими аспектами (дебют, миттельшпиль, тактика, защита короля) игроку нужно поработать.
4. Оценка игры: В самом конце поставь четкую оценку качеству игры от 1 до 10 в формате 'Оценка: X/10'.`;

export class GeminiOverloadError extends Error {
  constructor() {
    super("ИИ-Коуч временно перегружен запросами. Пожалуйста, попробуйте сделать разбор через пару минут!");
    this.name = "GeminiOverloadError";
  }
}

function isOverloadError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; statusCode?: number; message?: string; cause?: unknown };
  const status = e.status ?? e.statusCode;
  if (status === 503) return true;
  const msg = String(e.message ?? "").toLowerCase();
  if (msg.includes("503") || msg.includes("overloaded") || msg.includes("unavailable")) return true;
  if (e.cause) return isOverloadError(e.cause);
  return false;
}

export async function fetchGmAnalysis(pgn: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Не задан VITE_GEMINI_API_KEY в .env");
  }
  if (!pgn.trim()) {
    throw new Error("PGN партии пуст");
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(SYSTEM_PROMPT(pgn));
    const text = result.response.text();
    if (!text?.trim()) {
      throw new Error("Пустой ответ от Gemini");
    }
    return text.trim();
  } catch (error) {
    if (isOverloadError(error)) {
      throw new GeminiOverloadError();
    }
    throw error;
  }
}
