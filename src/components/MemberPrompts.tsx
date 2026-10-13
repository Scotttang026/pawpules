import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, MailWarning, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { MemberProfile } from '../types';
import { MemberProfileFields } from './MemberProfileFields';
import { EMPTY_PROFILE, memberErrorKeyOf, saveMemberProfile, type MemberUiErrorKey } from '../services/memberService';

type VerifyMsgKey = 'member.verify.sent' | 'member.verify.stillUnverified' | 'login.errors.tooMany' | 'member.errors.generic';

const laterKey = (uid: string) => `pawpulse-profile-later-${uid}`;

function readSession(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeSession(key: string) {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    /* 私隱模式寫唔到都冇所謂 */
  }
}

interface Props {
  suspended?: boolean; // 登入視窗開緊時唔好彈（註冊途中資料未存好）
}

export const MemberPrompts: React.FC<Props> = ({ suspended }) => {
  const { t } = useTranslation();
  const { user, loading, profile, profileLoading, emailVerified, sendVerification, reloadUser } = useAuth();
  const uid = user?.uid ?? '';

  const [profileLater, setProfileLater] = useState(false);
  const [verifyDismissed, setVerifyDismissed] = useState(false);
  const [form, setForm] = useState<MemberProfile>(EMPTY_PROFILE);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<MemberUiErrorKey | null>(null);
  const [verifyMsgKey, setVerifyMsgKey] = useState<VerifyMsgKey | null>(null);

  // 換帳戶就重新判斷
  useEffect(() => {
    setProfileLater(uid ? readSession(laterKey(uid)) : false);
    setVerifyDismissed(false);
    setVerifyMsgKey(null);
    setErrorKey(null);
    setForm(EMPTY_PROFILE);
  }, [uid]);

  const showProfile = !!user && !loading && !profileLoading && !profile && !profileLater && !suspended;
  const showVerify = !!user && !emailVerified && !!profile && !verifyDismissed && !suspended;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorKey(null);
    try {
      await saveMemberProfile(form); // 成功後 Firestore 即時更新，視窗自動消失
    } catch (err) {
      setErrorKey(memberErrorKeyOf(err));
    } finally {
      setBusy(false);
    }
  };

  const handleLater = () => {
    if (uid) writeSession(laterKey(uid));
    setProfileLater(true);
  };

  const handleResend = async () => {
    setBusy(true);
    try {
      await sendVerification();
      setVerifyMsgKey('member.verify.sent');
    } catch (err) {
      setVerifyMsgKey((err as { code?: string })?.code === 'auth/too-many-requests' ? 'login.errors.tooMany' : 'member.errors.generic');
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    setBusy(true);
    try {
      const ok = await reloadUser();
      if (!ok) setVerifyMsgKey('member.verify.stillUnverified');
    } catch {
      setVerifyMsgKey('member.errors.generic');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <form
            onSubmit={handleSave}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
            className="w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-stone-200 p-6 space-y-4"
          >
            <div>
              <h2 id="profile-modal-title" className="text-base font-bold text-stone-900">{t('member.profileModal.title')}</h2>
              <p className="text-xs text-stone-500 mt-1">{t('member.profileModal.body')}</p>
            </div>
            {errorKey && (
              <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {t(errorKey)}
              </p>
            )}
            <MemberProfileFields idPrefix="profile" value={form} onChange={setForm} disabled={busy} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleLater}
                disabled={busy}
                className="flex-1 px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-50 text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                {t('member.profileModal.later')}
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('member.profileModal.submit')}
              </button>
            </div>
          </form>
        </div>
      )}

      {showVerify && (
        // 手機要避開底部 tab bar（4rem）
        <div className="fixed z-40 left-3 right-3 md:left-auto md:right-4 md:w-96 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 bg-white border border-amber-200 shadow-lg rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <MailWarning className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="flex-1 text-xs text-stone-700">{t('member.verify.body')}</p>
            <button onClick={() => setVerifyDismissed(true)} aria-label={t('member.verify.dismiss')} className="text-stone-400 hover:text-stone-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          {verifyMsgKey && <p className="text-2xs text-stone-500">{t(verifyMsgKey)}</p>}
          <div className="flex gap-2">
            <button onClick={handleResend} disabled={busy}
              className="flex-1 px-3 py-2 rounded-lg border border-stone-300 hover:bg-stone-50 text-xs font-medium cursor-pointer disabled:opacity-50">
              {t('member.verify.resend')}
            </button>
            <button onClick={handleRefresh} disabled={busy}
              className="flex-1 px-3 py-2 rounded-lg bg-stone-900 hover:bg-black text-white text-xs font-semibold cursor-pointer disabled:opacity-50">
              {t('member.verify.refresh')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
