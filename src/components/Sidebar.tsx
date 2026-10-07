// src/components/Sidebar.tsx
import React from 'react';
import { PawPrint, MapPin, LayoutList, Building2, ShieldCheck, ShieldAlert, HeartPulse, LogIn, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { User } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { LanguageSwitcher } from './LanguageSwitcher';

export type AppTab = 'report' | 'map' | 'cases' | 'ngos' | 'admin';

interface SidebarProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onOpenGuide: () => void;
  urgentCount: number;
}

// 保持向下相容（如有其他檔案 import 呢個常數）
export const NAV_ITEMS_CONFIG: { tab: AppTab; labelKey: string; icon: React.ElementType }[] = [
  { tab: 'report', labelKey: 'nav.report', icon: HeartPulse },
  { tab: 'map', labelKey: 'nav.map', icon: MapPin },
  { tab: 'cases', labelKey: 'nav.cases', icon: LayoutList },
  { tab: 'ngos', labelKey: 'nav.ngos', icon: Building2 },
  { tab: 'admin', labelKey: 'nav.admin', icon: ShieldCheck },
];

const Badge: React.FC<{ count: number; ringClass?: string }> = ({ count, ringClass = 'ring-stone-100' }) => (
  <span
    className={`absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-3xs font-bold flex items-center justify-center ring-2 ${ringClass}`}
  >
    {count > 99 ? '99+' : count}
  </span>
);

/** 登入狀態頭像：有相用相，冇相用名首字母，未登入顯示 LogIn icon */
const UserAvatar: React.FC<{ user: User | null; size: string }> = ({ user, size }) => {
  if (user?.photoURL) {
    return <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className={`${size} rounded-full object-cover`} />;
  }
  if (user) {
    return (
      <span className={`${size} rounded-full bg-stone-900 text-white text-xs font-bold flex items-center justify-center`}>
        {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
      </span>
    );
  }
  return <LogIn className="w-5 h-5" strokeWidth={1.8} />;
};

/**
 * 桌面：左邊 icon rail。
 * 手機：頂部 header（logo / 語言 / 急救指引 / 登入）＋底部 5 格 tab bar。
 */
export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, onOpenGuide, urgentCount }) => {
  const { user, isAdmin, signInWithGoogle, signOut } = useAuth();
  const { t } = useTranslation();

  const handleAuthClick = () => {
    if (user) {
      signOut().catch((err) => console.warn('Sign out failed:', err));
    } else {
      signInWithGoogle().catch((err) => console.warn('Sign in failed:', err));
    }
  };

  const authTitle = user ? `${user.email ?? ''} (${t('nav.clickToLogout')})` : t('nav.loginWithGoogle');

  return (
    <>
      {/* ───────── 桌面：左邊 rail ───────── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-20 flex-col items-center py-4 bg-stone-100">
        <button
          onClick={() => onSelectTab('report')}
          className="w-12 h-12 rounded-2xl bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors cursor-pointer"
          title="PawPulse"
          id="brand-logo-btn"
        >
          <PawPrint className="w-6 h-6" />
        </button>

        <nav className="mt-8 flex flex-col items-center gap-2">
          {NAV_ITEMS_CONFIG.map(({ tab, labelKey, icon: Icon }) => {
            const active = currentTab === tab;
            return (
              <button
                key={tab}
                id={`nav-${tab}-tab`}
                onClick={() => onSelectTab(tab)}
                aria-current={active ? 'page' : undefined}
                title={t(labelKey)}
                className={`group w-16 py-2 rounded-xl flex flex-col items-center gap-1 text-stone-900 transition-colors cursor-pointer ${
                  active ? 'bg-brand-50' : 'hover:bg-stone-200/60'
                }`}
              >
                <span className="relative">
                  <Icon className={`w-5 h-5 ${active ? 'text-brand-500' : ''}`} strokeWidth={active ? 2.2 : 1.8} />
                  {tab === 'cases' && urgentCount > 0 && <Badge count={urgentCount} />}
                  {tab === 'admin' && isAdmin && (
                    <span
                      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-stone-100"
                      title={t('nav.adminActive')}
                    />
                  )}
                </span>
                <span className={`max-w-full px-1 truncate text-2xs ${active ? 'font-semibold' : 'font-medium'}`}>
                  {t(labelKey)}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-2">
          <LanguageSwitcher className="py-1" />

          <button
            id="nav-guide-btn"
            onClick={onOpenGuide}
            title={t('nav.guide')}
            className="w-16 py-2 rounded-xl flex flex-col items-center gap-1 text-stone-900 hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <ShieldAlert className="w-5 h-5" strokeWidth={1.8} />
            <span className="max-w-full px-1 truncate text-2xs font-medium">{t('nav.guide')}</span>
          </button>

          <button
            onClick={handleAuthClick}
            title={authTitle}
            className="w-16 py-2 rounded-xl flex flex-col items-center gap-1 text-stone-900 hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <UserAvatar user={user} size="w-7 h-7" />
            <span className="max-w-full px-1 truncate text-2xs font-medium flex items-center gap-0.5">
              {user ? (
                <>
                  <LogOut className="w-3 h-3 shrink-0" />
                  {t('nav.logout')}
                </>
              ) : (
                t('nav.login')
              )}
            </span>
          </button>
        </div>
      </aside>

      {/* ───────── 手機：頂部 header ───────── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-b border-stone-200 pt-[env(safe-area-inset-top)]">
        <div className="h-14 px-3 flex items-center gap-2">
          <button
            onClick={() => onSelectTab('report')}
            className="flex items-center gap-2 cursor-pointer"
            aria-label="PawPulse"
          >
            <span className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center">
              <PawPrint className="w-5 h-5" />
            </span>
            <span className="font-bold text-stone-900">PawPulse</span>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <LanguageSwitcher className="px-1" />

            <button
              id="nav-guide-btn-mobile"
              onClick={onOpenGuide}
              aria-label={t('nav.guide')}
              title={t('nav.guide')}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-rose-600 hover:bg-stone-100 cursor-pointer"
            >
              <ShieldAlert className="w-5 h-5" strokeWidth={2} />
            </button>

            <button
              onClick={handleAuthClick}
              aria-label={authTitle}
              title={authTitle}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-stone-900 hover:bg-stone-100 cursor-pointer"
            >
              <UserAvatar user={user} size="w-8 h-8" />
            </button>
          </div>
        </div>
      </header>

      {/* ───────── 手機：底部 tab bar（5 個分頁） ───────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-stone-200 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {NAV_ITEMS_CONFIG.map(({ tab, labelKey, icon: Icon }) => {
            const active = currentTab === tab;
            return (
              <button
                key={tab}
                onClick={() => onSelectTab(tab)}
                aria-current={active ? 'page' : undefined}
                className="h-16 flex flex-col items-center justify-center gap-0.5 text-stone-900 cursor-pointer"
              >
                <span className="relative">
                  <Icon className={`w-5 h-5 ${active ? 'text-brand-500' : ''}`} strokeWidth={active ? 2.2 : 1.8} />
                  {tab === 'cases' && urgentCount > 0 && <Badge count={urgentCount} ringClass="ring-white" />}
                  {tab === 'admin' && isAdmin && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                  )}
                </span>
                <span className={`w-full px-0.5 truncate text-center text-2xs ${active ? 'font-semibold' : 'font-medium'}`}>
                  {t(labelKey)}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
