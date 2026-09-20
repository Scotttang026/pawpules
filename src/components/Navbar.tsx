import React from 'react';
import { PawPrint, MapPin, ListFilter, Building2, ShieldAlert, HeartPulse } from 'lucide-react';

interface NavbarProps {
  currentTab: 'report' | 'map' | 'cases' | 'ngos';
  onSelectTab: (tab: 'report' | 'map' | 'cases' | 'ngos') => void;
  onOpenGuide: () => void;
  urgentCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenGuide,
  urgentCount,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSelectTab('report')}
              className="flex items-center gap-2.5 text-left focus:outline-none group"
              id="brand-logo-btn"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                <PawPrint className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xl text-stone-900 tracking-tight font-mono">
                    PawPulse
                  </span>
                  <span className="text-xs bg-rose-100 text-rose-700 font-semibold px-2 py-0.5 rounded-full border border-rose-200">
                    P0 救援速報
                  </span>
                </div>
                <p className="text-xs text-stone-500 hidden sm:block">
                  流浪動物即時通報 × AI 智能傷病判斷 × 鄰近 NGO 媒合
                </p>
              </div>
            </button>
          </div>

          {/* Nav Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              id="nav-report-tab"
              onClick={() => onSelectTab('report')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'report'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              <HeartPulse className="w-4 h-4" />
              <span>我要通報</span>
            </button>

            <button
              id="nav-map-tab"
              onClick={() => onSelectTab('map')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'map'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>救援地圖</span>
            </button>

            <button
              id="nav-cases-tab"
              onClick={() => onSelectTab('cases')}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'cases'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              <ListFilter className="w-4 h-4" />
              <span>個案總覽</span>
              {urgentCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-rose-500 text-white rounded-full font-bold">
                  {urgentCount}
                </span>
              )}
            </button>

            <button
              id="nav-ngos-tab"
              onClick={() => onSelectTab('ngos')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'ngos'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span className="hidden md:inline">合作機構</span>
              <span className="md:hidden">NGO</span>
            </button>

            {/* Emergency Guide button */}
            <button
              id="nav-guide-btn"
              onClick={onOpenGuide}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors ml-1"
            >
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span className="hidden sm:inline">現場應急</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
