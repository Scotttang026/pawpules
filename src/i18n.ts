// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { LOCALES, DEFAULT_LANG, type AppLang } from './locales';

export type { AppLang } from './locales';

// ===== 加新語言唔使改呢個檔案，去 src/locales/index.ts 加就得 =====

// 語言清單由 locales/index.ts 自動產生
export const SUPPORTED_LANGUAGES = (Object.keys(LOCALES) as AppLang[]).map((code) => ({
  code,
  name: LOCALES[code].name,
}));

const resources = Object.fromEntries(
  Object.entries(LOCALES).map(([code, l]) => [code, { translation: l.translation }])
);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    fallbackLng: DEFAULT_LANG,
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
  return SUPPORTED_LANGUAGES.find((x) => x.code === l)?.code ?? DEFAULT_LANG;
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

// 所有 /api request 自動加 Accept-Language（跟用戶揀嘅介面語言），
// server 嘅錯誤訊息、地址、AI 回覆就會用返同一個語言；已經自己設定咗就唔覆蓋
function installApiLangHeader() {
  if (typeof window === 'undefined') return;
  const w = window as typeof window & { __pawpulseLangFetch?: boolean };
  if (w.__pawpulseLangFetch) return;
  w.__pawpulseLangFetch = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : null;
    const isApi = !!url && (url.startsWith('/api') || url.startsWith(`${window.location.origin}/api`));
    if (!isApi) return originalFetch(input, init);
    const headers = new Headers(init?.headers);
    if (!headers.has('Accept-Language')) headers.set('Accept-Language', getApiLang());
    return originalFetch(input, { ...init, headers });
  };
}
installApiLangHeader();

// 同步 <html lang>，等螢幕閱讀器同瀏覽器知道而家用緊咩語言
function syncHtmlLang() {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = getApiLang();
  }
}

function syncDocumentMeta() {
  if (typeof document === 'undefined') return;
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
