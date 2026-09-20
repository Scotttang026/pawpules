export interface PresetLocation {
  name: string;
  district: string;
  lat: number;
  lng: number;
  sampleAddress: string;
}

export const PRESET_LOCATIONS: PresetLocation[] = [
  {
    name: '旺角 (亞皆老街)',
    district: '油尖旺區',
    lat: 22.3193,
    lng: 114.1694,
    sampleAddress: '九龍旺角亞皆老街45號後巷',
  },
  {
    name: '沙田 (城門河單車徑)',
    district: '沙田區',
    lat: 22.3857,
    lng: 114.1915,
    sampleAddress: '新界沙田大涌橋路近城門河畔',
  },
  {
    name: '元朗 (錦田高埔村)',
    district: '元朗區',
    lat: 22.4435,
    lng: 114.0682,
    sampleAddress: '新界元朗錦田高埔村公車站旁',
  },
  {
    name: '灣仔 (軒尼詩道)',
    district: '灣仔區',
    lat: 22.2783,
    lng: 114.1747,
    sampleAddress: '香港島灣仔軒尼詩道138號後巷',
  },
  {
    name: '荃灣 (西樓角路)',
    district: '荃灣區',
    lat: 22.3732,
    lng: 114.1178,
    sampleAddress: '新界荃灣西樓角路綠楊坊旁花槽',
  },
  {
    name: '觀塘 (裕民坊)',
    district: '觀塘區',
    lat: 22.3142,
    lng: 114.2251,
    sampleAddress: '九龍觀塘裕民坊凱匯平台公園周邊',
  },
  {
    name: '中環 (半山扶梯旁)',
    district: '中西區',
    lat: 22.2829,
    lng: 114.1528,
    sampleAddress: '香港島中環荷李活道與閣麟街交界',
  },
  {
    name: '西貢 (西貢碼頭海傍)',
    district: '西貢區',
    lat: 22.3814,
    lng: 114.2744,
    sampleAddress: '新界西貢惠民路西貢海濱長廊邊',
  }
];

// Open Google Maps navigation link
export function getGoogleMapsDirectionsUrl(destLat: number, destLng: number, originLat?: number, originLng?: number): string {
  if (originLat && originLng) {
    return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${destLat},${destLng}`;
}

// Simple reverse geocode helper using Nominatim open geocoding
export async function reverseGeocodeCoords(lat: number, lng: number): Promise<{ address: string; district?: string }> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: {
        'Accept-Language': 'zh-HK, zh-TW, zh, en',
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        const district = data.address?.suburb || data.address?.city_district || data.address?.town || '市區';
        return {
          address: data.display_name,
          district,
        };
      }
    }
  } catch (err) {
    console.warn('Geocoding fetch failed, using fallback coordinates text:', err);
  }
  return {
    address: `經緯度座標 (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    district: '待確認地區',
  };
}

// Geocode query string to coordinates
export async function geocodeAddressQuery(query: string): Promise<{ lat: number; lng: number; address: string } | null> {
  try {
    const encoded = encodeURIComponent(query + ', Hong Kong');
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`, {
      headers: {
        'Accept-Language': 'zh-HK, zh-TW, zh, en',
      },
    });
    if (res.ok) {
      const results = await res.json();
      if (results && results.length > 0) {
        return {
          lat: parseFloat(results[0].lat),
          lng: parseFloat(results[0].lon),
          address: results[0].display_name,
        };
      }
    }
  } catch (err) {
    console.warn('Address geocode search failed:', err);
  }
  return null;
}
