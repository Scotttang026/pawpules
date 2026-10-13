import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { MemberProfile } from '../types';
import { MemberProfileFields } from './MemberProfileFields';
import { getApiLang } from '../i18n';
import {
  EMPTY_PROFILE,
  USERNAME_COOLDOWN_DAYS,
  memberErrorKeyOf,
  normalizeUsername,
  saveMemberProfile,
  usernameCooldownUntil,
  type MemberUiErrorKey,
} from '../services/memberService';

// 確認視窗係純文字，唔使 HTML escape（否則帳戶名有 & 會變 &amp;）
const NO_ESCAPE = { interpolation: { escapeValue: false } };

interface Props {
  onClose: () => void;
}

export const AccountSettingsModal: React.FC<Props> = ({ onClose }) => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [form, setForm] = useState<MemberProfile>(profile ?? EMPTY_PROFILE);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<MemberUiErrorKey | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  if (!user || !profile) return null;

  const cooldownUntil = usernameCooldownUntil(profile);
  const renaming = normalizeUsername(form.username) !== profile.username;

  const usernameNote = cooldownUntil ? (
    <p className="text-2xs text-stone-500 mt-1">
      {t('member.account.cooldown', { date: new Date(cooldownUntil).toLocaleDateString(getApiLang()) })}
    </p>
  ) : renaming ? (
    <p className="flex items-start gap-1.5 mt-2 text-2xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
      {t('member.account.renameWarning', { days: USERNAME_COOLDOWN_DAYS })}
    </p>
  ) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (renaming) {
      const ok = confirm(
        t('member.account.renameConfirm', {
          from: profile.username,
          to: normalizeUsername(form.username),
          days: USERNAME_COOLDOWN_DAYS,
          ...NO_ESCAPE,
        })
      );
      if (!ok) return;
    }
    setBusy(true);
    setErrorKey(null);
    setSaved(false);
    try {
      await saveMemberProfile(form);
      setSaved(true);
    } catch (err) {
      setErrorKey(memberErrorKeyOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs" onClick={() => !busy && onClose()}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
        className="w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-stone-200 p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="account-modal-title" className="text-base font-bold text-stone-900">{t('member.account.title')}</h2>
            <p className="text-xs text-stone-500 mt-1">{t('member.account.body')}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t('member.close')}
            className="text-stone-400 hover:text-stone-700 cursor-pointer disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs">
          <p className="text-stone-500">{t('member.account.emailLabel')}</p>
          <p className="font-medium text-stone-900 break-all">{user.email}</p>
        </div>

        {errorKey && (
          <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{t(errorKey)}</p>
        )}
        {saved && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <CheckCircle2 className="w-4 h-4" />
            {t('member.account.saved')}
          </p>
        )}

        <MemberProfileFields
          idPrefix="account"
          value={form}
          onChange={(v) => {
            setForm(v);
            setSaved(false);
          }}
          disabled={busy}
          usernameLocked={!!cooldownUntil}
          usernameNote={usernameNote}
        />

        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={busy}
            className="flex-1 px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-50 text-sm font-medium cursor-pointer disabled:opacity-50">
            {t('member.account.cancel')}
          </button>
          <button type="submit" disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('member.account.save')}
          </button>
        </div>
      </form>
    </div>
  );
};
