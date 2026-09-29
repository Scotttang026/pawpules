export interface PresetLocation {
  name: string;
  district: string;
  lat: number;
  lng: number;
  sampleAddress: string;
}

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

// Open Google Maps navigation link（純深層連結，唔涉及 API 呼叫，冇需要金鑰）
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
 * ⚠️ 已改為呼叫伺服器端 /api/reverse-geocode，唔再由瀏覽器直接呼叫
 * Nominatim。伺服器會優先使用 Google Maps Geocoding API（如已設定
 * GOOGLE_MAPS_API_KEY），並自動 fallback 至 Nominatim，同時解決咗
 * 瀏覽器端無法設定 User-Agent 嘅限制。
 */
export async function reverseGeocodeCoords(lat: number, lng: number): Promise<{ address: string; district?: string }> {
  if (!isValidCoordinate(lat, lng)) {
    return { address: '無效座標', district: '待確認地區' };
  }

  try {
    const res = await fetchWithTimeout(
      `/api/reverse-geocode?lat=${lat}&lng=${lng}`,
      {},
      8000
    );
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.address === 'string') {
        return { address: data.address, district: data.district || '市區' };
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
 * ⚠️ 已改為呼叫伺服器端 /api/geocode。
 */
export async function geocodeAddressQuery(query: string): Promise<{ lat: number; lng: number; address: string } | null> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return null;

  try {
    const res = await fetchWithTimeout(
      `/api/geocode?address=${encodeURIComponent(cleanQuery)}`,
      {},
      8000
    );
    if (res.ok) {
      const data = await res.json();
      if (data && isValidCoordinate(data.lat, data.lng)) {
        return { lat: data.lat, lng: data.lng, address: data.address };
      }
    }
  } catch (err) {
    console.warn('Address geocode 請求失敗或逾時:', err);
  }
  return null;
}

// Haversine distance calculator between coordinates in kilometers
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
