import i18n from '../i18n';
import { getBrowserRegion } from '../utils/locale';

export interface EmergencyContact {
  name: string;
  phone: string;
}

// ⚠️ 只加入你親自核實過嘅號碼，唔好估。打錯緊急熱線比冇熱線更危險。
// nameKey 對應 locales/*.json 入面嘅翻譯
const CONTACTS: Record<string, { nameKey: string; phone: string }> = {
  HK: { nameKey: 'emergency.hkSpca', phone: '2711 1000' },
};

export function getRegionCode(): string | null {
  return getBrowserRegion();
}

export function getEmergencyContact(): EmergencyContact | null {
  const region = getRegionCode();
  const c = region ? CONTACTS[region] : undefined;
  return c ? { name: i18n.t(c.nameKey), phone: c.phone } : null;
}

export function getEmergencyHint(): string {
  const c = getEmergencyContact();
  return c ? i18n.t('emergency.callContact', { name: c.name, phone: c.phone }) : i18n.t('emergency.contactLocal');
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
