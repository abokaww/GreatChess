import { GoogleGenerativeAI } from "@google/generative-ai";

/** Локальная игра — оба игрока; ИИ / мультиплеер — только указанная сторона. */
export type CoachAnalysisScope =
  | { kind: "both" }
  | { kind: "player"; color: "white" | "black" };

function colorLabelRu(color: "white" | "black"): string {
  return color === "white" ? "белых" : "чёрных";
}

function scopeInstruction(scope: CoachAnalysisScope): string {
  if (scope.kind === "both") {
    return "Проанализируй партию целиком: разбирай ошибки и сильные стороны обоих игроков.";
  }
  const side = colorLabelRu(scope.color);
  return (
    `Проанализируй ТОЛЬКО игру ${side}. ` +
    `Ходы соперника упоминай лишь как контекст (что противник сделал), ` +
    `но критику, рекомендации, работу над ошибками и итоговую оценку давай исключительно для ${side}. ` +
    `Не анализируй и не оценивай игру соперника.`
  );
}

const SYSTEM_PROMPT = (pgn: string, scope: CoachAnalysisScope) =>
  `Ты профессиональный шахматный ИИ-тренер. Проанализируй эту партию по PGN: ${pgn}.
${scopeInstruction(scope)}
Ответ должен быть СТРОГО НА РУССКОМ ЯЗЫКЕ, в понятной, дружелюбной форме и разбит на блоки.
Требования к тону и формату (строго соблюдай):
- Избегай длинной шахматной нотации и строк вида "e4 e5..." — объясняй ходами понятными словами, например: "Ход 12: конь на f3 напал на пешку, что привело к...".
- Для ключевого момента приведи: номер хода (например "ход 12 белые"), короткое объяснение почему это важно и как можно было лучше сыграть (пример правильной идеи).
- В блоке "Работа над ошибками" дай конкретные рекомендации простыми фразами (без сокращений), при необходимости приведи 1–2 примера альтернативных ходов и обоснуй их.
- В блоке "Общий вердикт" сформулируй 3 пункта, над чем работать (например: защита короля, тактическая зоркость, план в миттельшпиле).
- В конце добавь строку "Оценка: X/10" (1–10).
- Если обсуждаешь комбинацию, опиши её словами, а не через SAN/PGN. Приводи небольшие фразы типа: "после хода ... у вас открылся проход к королю".

Отдавай предпочтение ясному, человеческому объяснению над техническими абзацами.`;

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

export async function fetchGmAnalysis(
  pgn: string,
  scope: CoachAnalysisScope = { kind: "both" },
): Promise<string> {
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
    const result = await model.generateContent(SYSTEM_PROMPT(pgn, scope));
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
