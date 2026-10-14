// src/locales/index.ts
// ===== 加新語言只需要：1. 新增 xx.json（複製 en.json 再翻譯） 2. 喺下面加兩行 =====
import zh from './zh.json';
import en from './en.json';
// import ja from './ja.json';

// 中文係標準：其他語言必須有齊 zh.json 所有 key，少一個 lint 就會報錯
export type Translation = typeof zh;

export const LOCALES = {
  zh: { name: '中文', translation: zh },
  en: { name: 'English', translation: en },
  // ja: { name: '日本語', translation: ja },
} satisfies Record<string, { name: string; translation: Translation }>;

export type AppLang = keyof typeof LOCALES;
export const DEFAULT_LANG: AppLang = 'zh';

// 'zh-HK,zh;q=0.9' → 'zh'；'en-GB' → 'en'；唔支援嘅語言 → 'zh'
export function toAppLang(raw: unknown): AppLang {
  const code = String(raw ?? '').split(',')[0].trim().split('-')[0].toLowerCase();
  return Object.prototype.hasOwnProperty.call(LOCALES, code) ? (code as AppLang) : DEFAULT_LANG;
}
