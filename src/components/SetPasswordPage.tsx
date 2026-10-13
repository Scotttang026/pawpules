import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { verifyPasswordResetCode, confirmPasswordReset, signInWithEmailAndPassword } from 'firebase/auth';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import type { MemberProfile } from '../types';
import { MemberProfileFields } from './MemberProfileFields';
import {
  EMPTY_PROFILE,
  MEMBER_INPUT_CLASS,
  PASSWORD_MIN,
  memberErrorKeyOf,
  saveMemberProfile,
  validateProfile,
  type MemberUiErrorKey,
} from '../services/memberService';

type Phase = 'checking' | 'form' | 'invalid' | 'done';

// 用 replace：返主頁之後撳「上一頁」唔會返嚟呢版
const goHome = () => window.location.replace('/');

/** 設定密碼連結（/set-password?oobCode=...）：設密碼 + 填姓名同帳戶名 */
export const SetPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const { reloadUser } = useAuth();
  const [oobCode] = useState(() => new URLSearchParams(window.location.search).get('oobCode') ?? '');
  const [phase, setPhase] = useState<Phase>('checking');
  const [email, setEmail] = useState('');
  const [form, setForm] = useState<MemberProfile>(EMPTY_PROFILE);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  // 密碼已設好（條連結已用咗）：之後重試只會再存會員資料
  const [passwordDone, setPasswordDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<MemberUiErrorKey | null>(null);

  useEffect(() => {
    if (!oobCode) {
      setPhase('invalid');
      return;
    }
    let cancelled = false;
    // 只係檢查，唔會用咗條連結
    verifyPasswordResetCode(auth, oobCode)
      .then((e) => {
        if (cancelled) return;
        setEmail(e);
        setPhase('form');
      })
      .catch((err) => {
        console.warn('[SetPassword] link check failed:', err?.code);
        if (!cancelled) setPhase('invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bad = validateProfile(form);
    if (bad) {
      setErrorKey(bad);
      return;
    }
    if (!passwordDone) {
      if (password.length < PASSWORD_MIN) {
        setErrorKey('member.errors.weakPassword');
        return;
      }
      if (password !== password2) {
        setErrorKey('member.errors.passwordMismatch');
        return;
      }
    }

    setBusy(true);
    setErrorKey(null);
    try {
      if (!passwordDone) {
        await confirmPasswordReset(auth, oobCode, password);
        setPasswordDone(true);
        await signInWithEmailAndPassword(auth, email, password);
      }
      await saveMemberProfile(form);
      await reloadUser().catch(() => false); // 更新「已驗證」狀態
      setPhase('done');
    } catch (err) {
      console.warn('[SetPassword] failed:', (err as { code?: string })?.code ?? err);
      setErrorKey(memberErrorKeyOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-5">
        <p className="text-sm font-bold text-brand-600">PawPulse</p>

        {phase === 'checking' && (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('member.setup.checking')}
          </div>
        )}

        {phase === 'invalid' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <h1 className="text-base font-bold text-stone-900">{t('member.setup.invalidTitle')}</h1>
                <p className="text-xs text-stone-500 mt-1">{t('member.setup.invalidBody')}</p>
              </div>
            </div>
            <button onClick={goHome} className="w-full px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white text-sm font-semibold cursor-pointer">
              {t('member.setup.goHome')}
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <h1 className="text-base font-bold text-stone-900">{t('member.setup.doneTitle')}</h1>
                <p className="text-xs text-stone-500 mt-1">{t('member.setup.doneBody')}</p>
              </div>
            </div>
            <button onClick={goHome} className="w-full px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white text-sm font-semibold cursor-pointer">
              {t('member.setup.goHome')}
            </button>
          </div>
        )}

        {phase === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h1 className="text-base font-bold text-stone-900">{t('member.setup.title')}</h1>
              <p className="text-xs text-stone-500 mt-1 break-all">{t('member.setup.body', { email })}</p>
            </div>

            {errorKey && (
              <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {t(errorKey)}
              </p>
            )}

            {passwordDone ? (
              <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                {t('member.setup.passwordSet')}
              </p>
            ) : (
              <>
                {/* 隱藏嘅 email 欄：等瀏覽器密碼管理員記得係邊個帳戶 */}
                <input type="email" autoComplete="username" value={email} readOnly hidden />
                <div>
                  <label htmlFor="setup-password" className="block text-xs font-medium text-stone-700 mb-1">{t('member.password')}</label>
                  <input id="setup-password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN}
                    value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} className={MEMBER_INPUT_CLASS} />
                  <p className="text-2xs text-stone-400 mt-1">{t('member.passwordHint')}</p>
                </div>
                <div>
                  <label htmlFor="setup-password2" className="block text-xs font-medium text-stone-700 mb-1">{t('member.confirmPassword')}</label>
                  <input id="setup-password2" type="password" autoComplete="new-password" required
                    value={password2} onChange={(e) => setPassword2(e.target.value)} disabled={busy} className={MEMBER_INPUT_CLASS} />
                </div>
              </>
            )}

            <MemberProfileFields idPrefix="setup" value={form} onChange={setForm} disabled={busy} />

            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('member.setup.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
