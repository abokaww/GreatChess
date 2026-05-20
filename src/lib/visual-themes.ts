import type { CSSProperties } from "react";

export type BoardTheme = {
  key: string;
  name: string;
  description: string;
  locked: boolean;
  dark: CSSProperties;
  light: CSSProperties;
  boardStyle: CSSProperties;
};

export type PieceTheme = {
  key: string;
  name: string;
  description: string;
  locked: boolean;
};

export const BOARD_THEMES: BoardTheme[] = [
  {
    key: "default",
    name: "Стандарт",
    description: "Классическая доска в зелёно-бежевых цветах.",
    locked: false,
    dark: { backgroundColor: "oklch(0.32 0.04 200)" },
    light: { backgroundColor: "oklch(0.85 0.02 100)" },
    boardStyle: { borderRadius: "12px", boxShadow: "var(--shadow-elegant)" },
  },
  {
    key: "ocean",
    name: "Океан",
    description: "Глубокие синие поля для спокойной игры.",
    locked: true,
    dark: { backgroundColor: "#1d3c63" },
    light: { backgroundColor: "#d0e7ff" },
    boardStyle: { borderRadius: "14px", boxShadow: "0 10px 45px rgba(16, 81, 146, 0.28)" },
  },
  {
    key: "forest",
    name: "Лес",
    description: "Тёплые зелёные оттенки для приятной атмосферы.",
    locked: true,
    dark: { backgroundColor: "#2d4a2b" },
    light: { backgroundColor: "#dfe8d4" },
    boardStyle: { borderRadius: "14px", boxShadow: "0 10px 45px rgba(20, 60, 35, 0.28)" },
  },
  {
    key: "midnight",
    name: "Полночь",
    description: "Контрастная чёрно-серая доска для стильной партии.",
    locked: true,
    dark: { backgroundColor: "#0f172a" },
    light: { backgroundColor: "#64748b" },
    boardStyle: { borderRadius: "14px", boxShadow: "0 10px 45px rgba(15, 23, 42, 0.38)" },
  },
  {
    key: "sunset",
    name: "Закат",
    description: "Тёплые желтые и оранжевые оттенки настроения.",
    locked: true,
    dark: { backgroundColor: "#a45116" },
    light: { backgroundColor: "#ffedd5" },
    boardStyle: { borderRadius: "14px", boxShadow: "0 10px 45px rgba(170, 79, 20, 0.28)" },
  },
  {
    key: "marble",
    name: "Мрамор",
    description: "Элегантная светлая доска со стильным бликом.",
    locked: true,
    dark: { backgroundColor: "#4a4a4a" },
    light: { backgroundColor: "#f5f5f5" },
    boardStyle: { borderRadius: "18px", boxShadow: "0 10px 45px rgba(0, 0, 0, 0.12)" },
  },
  {
    key: "desert",
    name: "Пустыня",
    description: "Бежево-коричневые клетки для тёплого глазу фона.",
    locked: true,
    dark: { backgroundColor: "#8b5e3c" },
    light: { backgroundColor: "#f3e1c0" },
    boardStyle: { borderRadius: "14px", boxShadow: "0 10px 45px rgba(139, 94, 60, 0.24)" },
  },
  {
    key: "glass",
    name: "Стекло",
    description: "Прозрачные поля и минималистичный стиль.",
    locked: true,
    dark: { backgroundColor: "rgba(30, 58, 138, 0.7)" },
    light: { backgroundColor: "rgba(255, 255, 255, 0.65)" },
    boardStyle: { borderRadius: "20px", boxShadow: "0 10px 45px rgba(30, 58, 138, 0.18)" },
  },
  {
    key: "sand",
    name: "Песок",
    description: "Мягкие бежевые оттенки для расслабленной игры.",
    locked: true,
    dark: { backgroundColor: "#b38b6d" },
    light: { backgroundColor: "#f8f1e7" },
    boardStyle: { borderRadius: "14px", boxShadow: "0 10px 45px rgba(179, 139, 109, 0.22)" },
  },
  {
    key: "violet",
    name: "Сирень",
    description: "Нежные фиолетовые оттенки для утончённой доски.",
    locked: true,
    dark: { backgroundColor: "#4c1d95" },
    light: { backgroundColor: "#ede9fe" },
    boardStyle: { borderRadius: "14px", boxShadow: "0 10px 45px rgba(76, 29, 149, 0.28)" },
  },
];

export const PIECE_THEMES: PieceTheme[] = [
  { key: "default", name: "Классика", description: "Стандартные фигуры для простого и понятного вида.", locked: false },
  { key: "modern", name: "Современные", description: "Минималистичный и ровный визуальный стиль.", locked: true },
  { key: "wood", name: "Дерево", description: "Тёплый деревянный стиль фигур.", locked: true },
  { key: "stone", name: "Камень", description: "Чёткие фигуры с текстурой камня.", locked: true },
  { key: "neon", name: "Неон", description: "Яркие фигуры с подсветкой.", locked: true },
  { key: "gold", name: "Золото", description: "Элегантные золотые фигуры.", locked: true },
  { key: "ice", name: "Лёд", description: "Прозрачные холодные фигуры.", locked: true },
  { key: "shadow", name: "Тень", description: "Контрастные тёмные силуэты.", locked: true },
  { key: "paper", name: "Бумага", description: "Плоские фигурки в стиле скетча.", locked: true },
  { key: "classic", name: "Ретро", description: "Фигуры в стиле старых шахматных наборов.", locked: true },
];

export function getBoardTheme(key: string): BoardTheme {
  return BOARD_THEMES.find((theme) => theme.key === key) ?? BOARD_THEMES[0];
}

export function getPieceTheme(key: string): PieceTheme {
  return PIECE_THEMES.find((theme) => theme.key === key) ?? PIECE_THEMES[0];
}
