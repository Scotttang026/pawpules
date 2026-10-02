import { getBrowserLanguage } from '../utils/locale';

const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '');

export interface AddressSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export interface ResolvedAddress {
  placeId: string;
  address: string;
  name: string;
  lat: number;
  lng: number;
  district?: string;    // 區名，跟瀏覽器語言（例如「油尖旺區」「新宿区」「Manhattan」）
  countryCode?: string; // ISO 國家代碼（例如 HK、JP、US），暫時唔寫入 Firestore
}

export function newSessionToken(): string {
  // crypto.randomUUID 只喺 https / localhost 有；手機用區域網絡 IP 測試時要後備
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function fetchAddressSuggestions(
  input: string,
  sessionToken: string,
  signal: AbortSignal,
  bias?: { lat: number; lng: number }
): Promise<AddressSuggestion[]> {
  const res = await fetch(`${API_BASE}/api/places/autocomplete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, sessionToken, lang: getBrowserLanguage(), ...(bias ?? {}) }),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.suggestions) ? data.suggestions : [];
}

export async function resolveAddress(placeId: string, sessionToken: string): Promise<ResolvedAddress> {
  const params = new URLSearchParams({ sessionToken, lang: getBrowserLanguage() });
  const res = await fetch(`${API_BASE}/api/places/details/${encodeURIComponent(placeId)}?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
