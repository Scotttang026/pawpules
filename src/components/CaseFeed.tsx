import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StrayReport, AnimalType, UrgencyLevel, CaseStatus } from '../types';
import { statusLabel, animalLabel } from '../utils/caseLabels';
import { getApiLang } from '../i18n';
import { Search, Sparkles, MapPin, Clock, ShieldAlert, ChevronRight } from 'lucide-react';

interface CaseFeedProps {
  reports: StrayReport[];
  onSelectReport: (report: StrayReport) => void;
  onNavigateToMap: (coords: { lat: number; lng: number }) => void;
}

// emoji 唔使翻譯，留喺 code
const ANIMAL_EMOJI: Record<AnimalType, string> = {
  cat: '🐱',
  dog: '🐶',
  bird: '🕊️',
  other: '🐾',
};

const ANIMAL_FILTERS: AnimalType[] = ['cat', 'dog', 'bird'];
const URGENCY_FILTERS = ['all', 'P0', 'P1', 'P2'] as const;
const STATUS_FILTERS = ['all', 'pending', 'in_progress', 'rescued', 'closed'] as const;

const STATUS_BADGE_CLASS: Record<CaseStatus, string> = {
  pending: 'bg-stone-100 text-stone-700 border-stone-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  rescued: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  closed: 'bg-stone-200 text-stone-800 border-stone-300',
};

function formatTime(value: string | number | Date): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '--:--'
    : d.toLocaleTimeString(getApiLang(), { hour: '2-digit', minute: '2-digit' });
}

const animalPillClass = (active: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
    active ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
  }`;

export const CaseFeed: React.FC<CaseFeedProps> = ({ reports, onSelectReport, onNavigateToMap }) => {
  const { t } = useTranslation(); // 轉語言時令 statusLabel()/animalLabel() 即刻更新
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnimal, setSelectedAnimal] = useState<'all' | AnimalType>('all');
  const [selectedUrgency, setSelectedUrgency] = useState<'all' | UrgencyLevel>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | CaseStatus>('all');

  const filteredReports = reports.filter((report) => {
    if (selectedAnimal !== 'all' && report.animalType !== selectedAnimal) return false;
    if (selectedUrgency !== 'all' && report.urgency !== selectedUrgency) return false;
    if (selectedStatus !== 'all' && report.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = report.title.toLowerCase().includes(q);
      const matchAddr = report.location.address.toLowerCase().includes(q);
      const matchDesc = report.description.toLowerCase().includes(q);
      const matchBreed = report.aiAnalysis?.estimatedBreed?.toLowerCase().includes(q);
      if (!matchTitle && !matchAddr && !matchDesc && !matchBreed) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4" id="case-feed-container">
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('caseFeed.searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              id="case-search-input"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button onClick={() => setSelectedAnimal('all')} className={animalPillClass(selectedAnimal === 'all')}>
              {t('caseFeed.allCount', { n: reports.length })}
            </button>
            {ANIMAL_FILTERS.map((type) => (
              <button key={type} onClick={() => setSelectedAnimal(type)} className={animalPillClass(selectedAnimal === type)}>
                {ANIMAL_EMOJI[type]} {animalLabel(type)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs text-stone-600">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-stone-400">{t('caseFeed.urgencyFilter')}</span>
            {URGENCY_FILTERS.map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedUrgency(lvl)}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                  selectedUrgency === lvl
                    ? lvl === 'P0'
                      ? 'bg-rose-600 text-white font-bold'
                      : lvl === 'P1'
                      ? 'bg-brand-500 text-white font-bold'
                      : 'bg-stone-900 text-white font-bold'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {lvl === 'all' ? t('caseFeed.all') : lvl}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-stone-400">{t('caseFeed.statusFilter')}</span>
            {STATUS_FILTERS.map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                  selectedStatus === st ? 'bg-stone-900 text-white font-bold' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {st === 'all' ? t('caseFeed.all') : statusLabel(st)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center text-stone-500 shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-stone-800">{t('caseFeed.emptyTitle')}</h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">{t('caseFeed.emptyBody')}</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-stone-500">
          <ShieldAlert className="w-8 h-8 text-stone-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-700">{t('caseFeed.noMatchTitle')}</p>
          <p className="text-xs text-stone-400 mt-1">{t('caseFeed.noMatchBody')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReports.map((report) => {
            const isP0 = report.urgency === 'P0';
            const badgeClass = STATUS_BADGE_CLASS[report.status] ?? STATUS_BADGE_CLASS.pending;
            // firestore.rules 冇驗證 aiAnalysis 內部結構，非陣列直接 .join() 會拖垮成個列表
            const safeInjuries = Array.isArray(report.aiAnalysis?.apparentInjuries)
              ? report.aiAnalysis!.apparentInjuries
              : [];
            const topNgo = report.matchedNGOs?.[0];

            return (
              <div
                key={report.id}
                className={`bg-white rounded-2xl border transition-all hover:shadow-md cursor-pointer overflow-hidden flex flex-col justify-between ${
                  isP0 ? 'border-rose-300 ring-1 ring-rose-200' : 'border-stone-200 hover:border-stone-300'
                }`}
                onClick={() => onSelectReport(report)}
                id={`case-card-${report.id}`}
              >
                <div>
                  <div className="relative aspect-16/9 overflow-hidden bg-stone-100">
                    <img
                      src={report.photoUrl}
                      alt={report.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                    />

                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-xs ${
                          report.urgency === 'P0' ? 'bg-rose-600 animate-pulse' : report.urgency === 'P1' ? 'bg-amber-500' : 'bg-emerald-600'
                        }`}
                      >
                        {report.urgency}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badgeClass}`}>
                        {statusLabel(report.status)}
                      </span>
                    </div>

                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur text-white text-[11px] px-2 py-0.5 rounded-md">
                      {ANIMAL_EMOJI[report.animalType] ?? '🐾'} {animalLabel(report.animalType, report.customAnimalName)}
                    </div>
                  </div>

                  <div className="p-4 space-y-2.5">
                    <div>
                      <h3 className="font-bold text-sm text-stone-900 line-clamp-1">{report.title}</h3>
                      <div className="flex items-center gap-1 text-xs text-stone-500 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="truncate">{report.location.address}</span>
                      </div>
                    </div>

                    <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">{report.description}</p>

                    {report.aiAnalysis && (
                      <div className="bg-stone-50 rounded-xl p-2.5 border border-stone-200/70 text-xs">
                        <div className="flex items-center gap-1 font-bold text-stone-800 mb-1">
                          <Sparkles className="w-3 h-3 text-brand-600" />
                          <span>
                            {t('caseFeed.aiBreed', { breed: report.aiAnalysis.estimatedBreed || t('caseFeed.unknown') })}
                          </span>
                        </div>
                        {safeInjuries.length > 0 && (
                          <div className="text-[11px] text-stone-600 line-clamp-1">
                            ⚠️ {safeInjuries.join(t('aiCard.listSeparator'))}
                          </div>
                        )}
                      </div>
                    )}

                    {topNgo && (
                      <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
                        <span>
                          {t('caseFeed.topMatch')}
                          <strong className="text-stone-800">{topNgo.name}</strong>
                        </span>
                        <span className="text-brand-700 font-semibold">
                          {Number.isFinite(topNgo.distanceKm)
                            ? t('caseFeed.distance', { km: topNgo.distanceKm })
                            : t('caseFeed.distanceUnknown')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-4 py-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs">
                  <span className="text-stone-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(report.createdAt)}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToMap(report.location);
                      }}
                      className="px-2 py-1 text-stone-600 hover:text-stone-900 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 font-medium"
                    >
                      {t('caseFeed.viewOnMap')}
                    </button>
                    <span className="text-brand-600 font-bold flex items-center gap-0.5">
                      {t('caseFeed.details')} <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
