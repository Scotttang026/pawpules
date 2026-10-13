import { apiFetch } from './api';
import type { MemberProfile } from '../types';

// 帳戶名：中英文、數字同基本符號，2–30 個字；最少要有 1 個字或數字
// ⚠️ 唔准空格、/、< > " '（/ 會整壞 Firestore 文件 ID）
export const USERNAME_RE = /^(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N}_\-.!@#$%&*+=?~^()[\]]{2,30}$/u;
export const USERNAME_MAX = 30;
export const USERNAME_COOLDOWN_DAYS = 30;
const USERNAME_COOLDOWN_MS = USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

/** 冷卻期內就回傳下次可以改嘅時間（毫秒），否則 null */
export function usernameCooldownUntil(p: MemberProfile | null): number | null {
  const last = p?.usernameChangedAt;
  if (typeof last !== 'number') return null;
  const next = last + USERNAME_COOLDOWN_MS;
  return Date.now() < next ? next : null;
}

/** 全形轉半形（ＡＢＣ → ABC），再去頭尾空格 */
export function normalizeUsername(s: string): string {
  return s.normalize('NFKC').trim();
}
export const NAME_MAX = 50;
export const PASSWORD_MIN = 8;
export const EMPTY_PROFILE: MemberProfile = { firstName: '', lastName: '', username: '' };
export const MEMBER_INPUT_CLASS =
  'w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60';

export type MemberErrorKey =
  | 'member.errors.nameRequired'
  | 'member.errors.usernameInvalid'
  | 'member.errors.usernameTaken'
  | 'member.errors.usernameCooldown'
  | 'member.errors.saveFailed'
  | 'member.errors.emailInUse'
  | 'member.errors.weakPassword'
  | 'member.errors.passwordMismatch'
  | 'member.errors.linkExpired'
  | 'member.errors.generic';

export type MemberUiErrorKey =
  | MemberErrorKey
  | 'login.errors.tooMany'
  | 'login.errors.network'
  | 'login.errors.invalidEmail';

export class MemberError extends Error {
  readonly key: MemberErrorKey;
  constructor(key: MemberErrorKey) {
    super(key);
    this.name = 'MemberError';
    this.key = key;
  }
}

export function trimProfile(p: MemberProfile): MemberProfile {
  return { firstName: p.firstName.trim(), lastName: p.lastName.trim(), username: normalizeUsername(p.username) };
}

/** 前端先檢查一次（server 會再檢查） */
export function validateProfile(p: MemberProfile): MemberErrorKey | null {
  const v = trimProfile(p);
  if (!v.firstName || !v.lastName || v.firstName.length > NAME_MAX || v.lastName.length > NAME_MAX) {
    return 'member.errors.nameRequired';
  }
  if (!USERNAME_RE.test(v.username)) return 'member.errors.usernameInvalid';
  return null;
}

const SERVER_CODES: Record<string, MemberErrorKey> = {
  name_required: 'member.errors.nameRequired',
  username_invalid: 'member.errors.usernameInvalid',
  username_taken: 'member.errors.usernameTaken',
  username_cooldown: 'member.errors.usernameCooldown',
};

/** 儲存會員資料；帳戶名重複由 server 用 transaction 擋 */
export async function saveMemberProfile(p: MemberProfile): Promise<void> {
  const bad = validateProfile(p);
  if (bad) throw new MemberError(bad);
  const res = await apiFetch('/api/profile', { method: 'POST', body: JSON.stringify(trimProfile(p)) });
  if (res.ok) return;
  const data = await res.json().catch(() => ({}));
  throw new MemberError(SERVER_CODES[data?.code] ?? 'member.errors.saveFailed');
}

/** Firebase / server 錯誤 → 翻譯 key（儲 key 唔儲文字，轉語言即刻跟住轉） */
export function memberErrorKeyOf(err: unknown): MemberUiErrorKey {
  if (err instanceof MemberError) return err.key;
  switch ((err as { code?: string })?.code) {
    case 'auth/email-already-in-use':
      return 'member.errors.emailInUse';
    case 'auth/weak-password':
      return 'member.errors.weakPassword';
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return 'login.errors.invalidEmail';
    case 'auth/too-many-requests':
      return 'login.errors.tooMany';
    case 'auth/network-request-failed':
      return 'login.errors.network';
    case 'auth/expired-action-code':
    case 'auth/invalid-action-code':
      return 'member.errors.linkExpired';
    default:
      return 'member.errors.generic';
  }
}
