// 傳俾 server 嘅語言代碼：跟用戶喺選單揀嘅語言，再加上瀏覽器嘅地區（例如 zh-HK、en-HK、en-GB）
// location.ts、App.tsx 都用緊 getBrowserLanguage()，所以地址同 Gemini 分析會自動跟住轉語言
import { getApiLang, getBrowserRegion } from '../i18n';

export function getBrowserLanguage(): string {
  return getApiLang();
}

export { getBrowserRegion };
