import { getBrowserLanguage } from './locale';

export interface PresetLocation {
  name: string;
  district: string;
  lat: number;
  lng: number;
  sampleAddress: string;
}

// 只作表單初始值（未確認前唔會被送出），唔再代表服務範圍
export const PRESET_LOCATIONS: PresetLocation[] = [
  { name: '旺角 (亞皆老街)', district: '油尖旺區', lat: 22.3193, lng: 114.1694, sampleAddress: '九龍旺角亞皆老街45號後巷' },
  { name: '沙田 (城門河單車徑)', district: '沙田區', lat: 22.3857, lng: 114.1915, sampleAddress: '新界沙田大涌橋路近城門河畔' },
  { name: '元朗 (錦田高埔村)', district: '元朗區', lat: 22.4435, lng: 114.0682, sampleAddress: '新界元朗錦田高埔村公車站旁' },
  { name: '灣仔 (軒尼詩道)', district: '灣仔區', lat: 22.2783, lng: 114.1747, sampleAddress: '香港島灣仔軒尼詩道138號後巷' },
  { name: '荃灣 (西樓角路)', district: '荃灣區', lat: 22.3732, lng: 114.1178, sampleAddress: '新界荃灣西樓角路綠楊坊旁花槽' },
  { name: '觀塘 (裕民坊)', district: '觀塘區', lat: 22.3142, lng: 114.2251, sampleAddress: '九龍觀塘裕民坊凱匯平台公園周邊' },
  { name: '中環 (半山扶梯旁)', district: '中西區', lat: 22.2829, lng: 114.1528, sampleAddress: '香港島中環荷李活道與閣麟街交界' },
  { name: '西貢 (西貢碼頭海傍)', district: '西貢區', lat: 22.3814, lng: 114.2744, sampleAddress: '新界西貢惠民路西貢海濱長廊邊' },
];

// 網頁版留空 = 同網域；將來手機 app 會填 Cloud Run 網址
const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '');

function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Google Maps 導航深層連結（全球通用，唔涉及 API 呼叫）
export function getGoogleMapsDirectionsUrl(destLat: number, destLng: number, originLat?: number, originLng?: number): string {
  if (!isValidCoordinate(destLat, destLng)) {
    return 'https://www.google.com/maps';
  }

  const destination = `${destLat},${destLng}`;
  const hasOrigin =
    originLat !== undefined && originLng !== undefined && isValidCoordinate(originLat, originLng);

  if (hasOrigin) {
    const origin = `${originLat},${originLng}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
}

/**
 * 座標 → 地址 + 區名（跟瀏覽器語言）。經伺服器 /api/reverse-geocode（Google 優先，fallback Nominatim）。
 * 呢個 function 唔會 throw。
 */
export async function reverseGeocodeCoords(lat: number, lng: number): Promise<{ address: string; district?: string }> {
  if (!isValidCoordinate(lat, lng)) {
    return { address: '無效座標', district: '待確認地區' };
  }

  try {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng), lang: getBrowserLanguage() });
    const res = await fetchWithTimeout(`${API_BASE}/api/reverse-geocode?${params}`, {}, 8000);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.address === 'string') {
        return { address: data.address, district: data.district || '待確認地區' };
      }
    }
  } catch (err) {
    console.warn('Reverse geocode 請求失敗或逾時:', err);
  }

  return {
    address: `經緯度座標 (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    district: '待確認地區',
  };
}

/**
 * 地址文字 → 座標 + 區名（跟瀏覽器語言）。經伺服器 /api/geocode。
 */
export async function geocodeAddressQuery(
  query: string
): Promise<{ lat: number; lng: number; address: string; district?: string } | null> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return null;

  try {
    const params = new URLSearchParams({ address: cleanQuery, lang: getBrowserLanguage() });
    const res = await fetchWithTimeout(`${API_BASE}/api/geocode?${params}`, {}, 8000);
    if (res.ok) {
      const data = await res.json();
      if (data && isValidCoordinate(data.lat, data.lng)) {
        return {
          lat: data.lat,
          lng: data.lng,
          address: data.formattedAddress || data.address || cleanQuery,
          district: typeof data.district === 'string' ? data.district : undefined,
        };
      }
    }
  } catch (err) {
    console.warn('Address geocode 請求失敗或逾時:', err);
  }
  return null;
}

// Haversine 距離（公里）
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return Number.POSITIVE_INFINITY;
  }

  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
