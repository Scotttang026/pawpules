import { getBrowserLanguage } from '../utils/locale'; // ⚠️ 換成你 locale.ts 實際 export 嘅函數名

export interface EmergencyContact {
  name: string;
  phone: string;
}

// ⚠️ 只加入你親自核實過嘅號碼，唔好估。打錯緊急熱線比冇熱線更危險。
const CONTACTS: Record<string, EmergencyContact> = {
  HK: { name: 'SPCA 24 小時熱線', phone: '2711 1000' },
};

export function getRegionCode(): string | null {
  try {
    return new Intl.Locale(getBrowserLanguage()).region ?? null;
  } catch {
    return null;
  }
}

export function getEmergencyContact(): EmergencyContact | null {
  const region = getRegionCode();
  return region ? CONTACTS[region] ?? null : null;
}

export function getEmergencyHint(): string {
  const c = getEmergencyContact();
  return c ? `請直接致電 ${c.name} ${c.phone}` : '請直接聯絡當地動物救援機構或警方';
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
