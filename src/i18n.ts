// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import zh from './locales/zh.json';
import en from './locales/en.json';

// 中文係標準：其他語言必須有齊 zh.json 所有 key，少一個 lint 就會報錯
type Translation = typeof zh;

// ===== 加新語言只需要改呢度 =====
// 1. 喺 SUPPORTED_LANGUAGES 加一行
// 2. 新增 locales/xx.json（複製 en.json 再翻譯）
// 3. 喺下面 resources 加 xx: { translation: xx satisfies Translation }
export const SUPPORTED_LANGUAGES = [
  { code: 'zh', name: '中文' },
  { code: 'en', name: 'English' },
  // { code: 'ja', name: '日本語' },
  // { code: 'ko', name: '한국어' },
] as const;

export type AppLang = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const resources = {
  zh: { translation: zh satisfies Translation },
  en: { translation: en satisfies Translation },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    fallbackLng: 'zh',
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    detection: {
      // 先睇用戶之前揀過嘅語言，冇就跟瀏覽器
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'pawpulse-lang',
      // zh-HK、zh-TW → zh；en-GB → en；ja-JP → ja
      convertDetectedLanguage: (lng: string) => lng.split('-')[0],
    },
  });

// 而家用緊嘅 UI 語言，例如 'zh'、'en'
export function getAppLang(): AppLang {
  const l = i18n.resolvedLanguage;
  return (SUPPORTED_LANGUAGES.find((x) => x.code === l)?.code ?? 'zh') as AppLang;
}

// 用戶身處嘅地區（由瀏覽器設定估計，例如 HK、JP、GB），同揀咩語言無關
export function getBrowserRegion(): string | null {
  if (typeof navigator === 'undefined') return null;
  const candidates = [...(navigator.languages ?? []), navigator.language];
  for (const tag of candidates) {
    try {
      const region = new Intl.Locale(tag).region;
      if (region) return region.toUpperCase();
    } catch {
      // 格式唔啱就試下一個
    }
  }
  return null;
}

// 傳俾 server（Google 地圖、Gemini）同埋格式化日期用嘅語言代碼：
// 用戶揀嘅語言 + 身處地區，例如 zh-HK、en-HK、en-GB、ja-JP
export function getApiLang(): string {
  const lang = getAppLang();
  const region = getBrowserRegion();
  if (lang === 'zh') {
    // 中文一律用繁體：台灣、澳門用返自己地區，其他地方用 zh-HK
    return region === 'TW' || region === 'MO' ? `zh-${region}` : 'zh-HK';
  }
  return region ? `${lang}-${region}` : lang;
}

// 同步 <html lang>，等螢幕閱讀器同瀏覽器知道而家用緊咩語言
function syncHtmlLang() {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = getApiLang();
  }
}

function syncDocumentMeta() {
  document.title = i18n.t('meta.title');
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', i18n.t('meta.description'));
}
i18n.on('languageChanged', syncDocumentMeta);
if (i18n.isInitialized) syncDocumentMeta();
else i18n.on('initialized', syncDocumentMeta);

syncHtmlLang();
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
