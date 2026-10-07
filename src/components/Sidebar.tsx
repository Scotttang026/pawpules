import React from 'react';
import { PawPrint, MapPin, LayoutList, Building2, ShieldCheck, ShieldAlert, HeartPulse, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export type AppTab = 'report' | 'map' | 'cases' | 'ngos' | 'admin';

interface SidebarProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onOpenGuide: () => void;
  urgentCount: number;
}

export const NAV_ITEMS: { tab: AppTab; label: string; icon: React.ElementType }[] = [
  { tab: 'report', label: '通報', icon: HeartPulse },
  { tab: 'map', label: '地圖', icon: MapPin },
  { tab: 'cases', label: '個案', icon: LayoutList },
  { tab: 'ngos', label: '機構', icon: Building2 },
  { tab: 'admin', label: '後台', icon: ShieldCheck },
];

const Badge: React.FC<{ count: number }> = ({ count }) => (
  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-3xs font-bold flex items-center justify-center ring-2 ring-stone-100">
    {count > 99 ? '99+' : count}
  </span>
);

/**
 * 左邊 icon menu（桌面）＋底部 tab bar（手機）。
 * 只負責導航，唔處理任何權限判斷；後台頁面自己會再檢查 isAdmin。
 */
export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, onOpenGuide, urgentCount }) => {
  const { user, isAdmin, signInWithGoogle, signOut } = useAuth();

  const handleAuthClick = () => {
    if (user) {
      signOut().catch((err) => console.warn('登出失敗：', err));
    } else {
      signInWithGoogle().catch((err) => console.warn('登入失敗：', err));
    }
  };

  return (
    <>
      {/* 桌面：左邊 rail */}
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
          {NAV_ITEMS.map(({ tab, label, icon: Icon }) => {
            const active = currentTab === tab;
            return (
              <button
                key={tab}
                id={`nav-${tab}-tab`}
                onClick={() => onSelectTab(tab)}
                aria-current={active ? 'page' : undefined}
                className={`group w-16 py-2 rounded-xl flex flex-col items-center gap-1 text-stone-900 transition-colors cursor-pointer ${
                  active ? 'bg-brand-50' : 'hover:bg-stone-200/60'
                }`}
              >
                <span className="relative">
                  <Icon className={`w-5 h-5 ${active ? 'text-brand-500' : ''}`} strokeWidth={active ? 2.2 : 1.8} />
                  {tab === 'cases' && urgentCount > 0 && <Badge count={urgentCount} />}
                  {tab === 'admin' && isAdmin && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-stone-100" title="管理員權限生效中" />
                  )}
                </span>
                <span className={`text-2xs ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-2">
          <button
            id="nav-guide-btn"
            onClick={onOpenGuide}
            className="w-16 py-2 rounded-xl flex flex-col items-center gap-1 text-stone-900 hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <ShieldAlert className="w-5 h-5" strokeWidth={1.8} />
            <span className="text-2xs font-medium">應急</span>
          </button>

          <button
            onClick={handleAuthClick}
            title={user ? `${user.email ?? ''}（按此登出）` : '用 Google 登入'}
            className="w-16 py-2 rounded-xl flex flex-col items-center gap-1 text-stone-900 hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-7 h-7 rounded-full object-cover" />
            ) : user ? (
              <span className="w-7 h-7 rounded-full bg-stone-900 text-white text-xs font-bold flex items-center justify-center">
                {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
              </span>
            ) : (
              <LogIn className="w-5 h-5" strokeWidth={1.8} />
            )}
            <span className="text-2xs font-medium flex items-center gap-0.5">
              {user ? <><LogOut className="w-3 h-3" />登出</> : '登入'}
            </span>
          </button>
        </div>
      </aside>

      {/* 手機：底部 tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-stone-200 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-6">
          {NAV_ITEMS.map(({ tab, label, icon: Icon }) => {
            const active = currentTab === tab;
            return (
              <button
                key={tab}
                onClick={() => onSelectTab(tab)}
                aria-current={active ? 'page' : undefined}
                className="py-2 flex flex-col items-center gap-0.5 text-stone-900 cursor-pointer"
              >
                <span className="relative">
                  <Icon className={`w-5 h-5 ${active ? 'text-brand-500' : ''}`} strokeWidth={active ? 2.2 : 1.8} />
                  {tab === 'cases' && urgentCount > 0 && <Badge count={urgentCount} />}
                </span>
                <span className={`text-2xs ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
              </button>
            );
          })}
          <button onClick={onOpenGuide} className="py-2 flex flex-col items-center gap-0.5 text-rose-600 cursor-pointer">
            <ShieldAlert className="w-5 h-5" strokeWidth={1.8} />
            <span className="text-2xs font-medium">應急</span>
          </button>
        </div>
      </nav>
    </>
  );
};
