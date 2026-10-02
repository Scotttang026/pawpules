// 讀取市民瀏覽器語言（例如 zh-HK、ja-JP、en-GB），用嚟決定地址同區名嘅顯示語言
const LANG_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/;
const DEFAULT_LANG = 'zh-HK';

export function getBrowserLanguage(): string {
  if (typeof navigator === 'undefined') return DEFAULT_LANG;
  const candidates = [...(navigator.languages ?? []), navigator.language];
  const hit = candidates.find((l) => typeof l === 'string' && LANG_RE.test(l));
  return hit || DEFAULT_LANG;
}
