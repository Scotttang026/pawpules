import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ArrowLeft, Loader2, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// 儲翻譯 key 而唔係文字，中途轉語言即刻跟住轉
type LoginErrorKey =
  | 'login.errors.invalid'
  | 'login.errors.tooMany'
  | 'login.errors.network'
  | 'login.errors.invalidEmail'
  | 'login.errors.popupBlocked'
  | 'login.errors.generic';

function errorKeyOf(err: unknown): LoginErrorKey | null {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null; // 用戶自己閂咗 Google 視窗，唔使提示
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'login.errors.invalid'; // 唔分「冇呢個帳戶」定「密碼錯」，防止有人試探邊個 email 有註冊
    case 'auth/too-many-requests':
      return 'login.errors.tooMany';
    case 'auth/network-request-failed':
      return 'login.errors.network';
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return 'login.errors.invalidEmail';
    case 'auth/popup-blocked':
      return 'login.errors.popupBlocked';
    default:
      return 'login.errors.generic';
  }
}

interface LoginModalProps {
  onClose: () => void;
  onSuccess: () => void; // 登入成功；App 會等身份讀完再跳去對應頁面
}

export const LoginModal: React.FC<LoginModalProps> = ({ onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { signInWithGoogle, signInWithEmail, sendResetEmail } = useAuth();

  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<LoginErrorKey | null>(null);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const signIn = async (action: () => Promise<void>) => {
    setBusy(true);
    setErrorKey(null);
    try {
      await action();
      onSuccess();
      onClose();
    } catch (err) {
      console.warn('Sign in failed:', (err as { code?: string })?.code);
      setErrorKey(errorKeyOf(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    signIn(() => signInWithEmail(email, password));
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorKey(null);
    try {
      await sendResetEmail(email);
      setResetSent(true);
    } catch (err) {
      // 唔話俾人知個 email 有冇註冊：冇呢個帳戶都顯示「已寄出」
      if ((err as { code?: string })?.code === 'auth/user-not-found') setResetSent(true);
      else setErrorKey(errorKeyOf(err));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: 'login' | 'reset') => {
    setMode(next);
    setErrorKey(null);
    setResetSent(false);
  };

  const inputClass =
    'w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-stone-200 p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="login-modal-title" className="text-base font-bold text-stone-900">
              {mode === 'login' ? t('login.title') : t('login.resetTitle')}
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              {mode === 'login' ? t('login.subtitle') : t('login.resetBody')}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label={t('login.close')}
            className="text-stone-400 hover:text-stone-700 cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorKey && (
          <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {t(errorKey)}
          </p>
        )}

        {mode === 'login' ? (
          <>
            <button
              type="button"
              onClick={() => signIn(signInWithGoogle)}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-50 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <span className="w-5 h-5 rounded-full bg-stone-900 text-white text-2xs font-bold flex items-center justify-center">G</span>
              {t('login.google')}
            </button>

            <div className="flex items-center gap-3 text-2xs text-stone-400">
              <span className="flex-1 h-px bg-stone-200" />
              {t('login.or')}
              <span className="flex-1 h-px bg-stone-200" />
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-3">
              <div>
                <label htmlFor="login-email" className="block text-xs font-medium text-stone-700 mb-1">{t('login.email')}</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-xs font-medium text-stone-700 mb-1">{t('login.password')}</label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                {t('login.submit')}
              </button>
            </form>

            <button
              type="button"
              onClick={() => switchMode('reset')}
              className="w-full text-center text-xs text-brand-700 hover:underline cursor-pointer"
            >
              {t('login.forgot')}
            </button>
          </>
        ) : (
          <>
            {resetSent ? (
              <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                {t('login.resetSent')}
              </p>
            ) : (
              <form onSubmit={handleReset} className="space-y-3">
                <div>
                  <label htmlFor="reset-email" className="block text-xs font-medium text-stone-700 mb-1">{t('login.email')}</label>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('login.resetSubmit')}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => switchMode('login')}
              className="w-full inline-flex items-center justify-center gap-1 text-xs text-stone-600 hover:text-stone-900 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('login.back')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
