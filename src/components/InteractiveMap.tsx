import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StrayReport, NGOOrganization, UrgencyLevel, CaseTag } from '../types';
import { getGoogleMapsDirectionsUrl } from '../utils/location';
import {
  ANIMAL_FILTERS, AnimalFilter, matchesAnimalFilter, animalFilterLabel, CASE_TAGS, tagLabel, matchesTagFilter,
  statusLabel,
} from '../utils/caseLabels';
import L from 'leaflet';
import { ChevronLeft, ChevronRight, ExternalLink, Sparkles, X } from 'lucide-react';
import { AnimalIcon, animalIconSvg } from './AnimalIcons';
import { careIconSvg } from './BrandIcons';

interface InteractiveMapProps {
  reports: StrayReport[];
  ngos?: NGOOrganization[];
  selectedReportId?: string;
  onSelectReport: (report: StrayReport) => void;
  centerCoords?: { lat: number; lng: number };
}

// Leaflet 嘅 bindPopup() 唔會自動 escape HTML（同 React 唔同）。
// 所有插入 popup 嘅動態內容（包括翻譯文字）都要先經呢個函式處理，防止儲存型 XSS。
function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const URGENCY_BTN: Record<UrgencyLevel, { active: string; idle: string; weight: string }> = {
  P0: { active: 'bg-rose-600 text-white', idle: 'text-rose-700 hover:bg-rose-50', weight: 'font-bold' },
  P1: { active: 'bg-amber-500 text-white', idle: 'text-amber-700 hover:bg-amber-50', weight: 'font-bold' },
  P2: { active: 'bg-emerald-600 text-white', idle: 'text-emerald-700 hover:bg-emerald-50', weight: 'font-medium' },
};
const URGENCY_LEVELS: UrgencyLevel[] = ['P0', 'P1', 'P2'];

// 同一地點（座標四捨五入到小數後 5 位，約 1 米）嘅個案合併成一個 marker
const locationKey = (r: StrayReport) => `${r.location.lat.toFixed(5)},${r.location.lng.toFixed(5)}`;

// 最緊急排先，同級就最新排先；marker 用第一宗嘅顏色同 icon
function sortByPriority(a: StrayReport, b: StrayReport): number {
  const byUrgency = URGENCY_LEVELS.indexOf(a.urgency) - URGENCY_LEVELS.indexOf(b.urgency);
  return byUrgency || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ reports, ngos = [], onSelectReport, centerCoords }) => {
  const { t } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [filterAnimal, setFilterAnimal] = useState<AnimalFilter>('all');
  const [filterUrgency, setFilterUrgency] = useState<'all' | UrgencyLevel>('all');
  const [filterTags, setFilterTags] = useState<CaseTag[]>([]);
  const [showNGOs, setShowNGOs] = useState(true);
  const [activeReport, setActiveReport] = useState<StrayReport | null>(null);
  // 撳咗多宗個案嘅 marker 時，顯示呢個地點嘅個案列表
  const [activeGroup, setActiveGroup] = useState<StrayReport[] | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    let resizeTimer1: ReturnType<typeof setTimeout> | undefined;
    let resizeTimer2: ReturnType<typeof setTimeout> | undefined;

    if (!mapInstanceRef.current) {
      const defaultCenter: [number, number] = centerCoords ? [centerCoords.lat, centerCoords.lng] : [22.33, 114.17];

      const map = L.map(mapContainerRef.current, { center: defaultCenter, zoom: 12, scrollWheelZoom: true, zoomControl: false });
      // 縮放掣放左下角：左上有篩選列、右下會彈出個案資料卡，兩邊都會遮住佢
      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;

      // 保存 timer id，組件提早卸載時清走，避免對已移除嘅 map 呼叫 invalidateSize()
      resizeTimer1 = setTimeout(() => map.invalidateSize(), 150);
      resizeTimer2 = setTimeout(() => map.invalidateSize(), 500);
    }

    return () => {
      if (resizeTimer1) clearTimeout(resizeTimer1);
      if (resizeTimer2) clearTimeout(resizeTimer2);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current && centerCoords) {
      mapInstanceRef.current.setView([centerCoords.lat, centerCoords.lng], 14, { animate: true });
    }
  }, [centerCoords]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    const filteredReports = reports.filter((r) => {
      if (!matchesAnimalFilter(r.animalType, filterAnimal)) return false;
      if (filterUrgency !== 'all' && r.urgency !== filterUrgency) return false;
      if (!matchesTagFilter(r.tags, filterTags)) return false;
      return true;
    });

    const groups = new Map<string, StrayReport[]>();
    filteredReports.forEach((r) => {
      const key = locationKey(r);
      groups.set(key, [...(groups.get(key) ?? []), r]);
    });

    groups.forEach((unsorted) => {
      const group = [...unsorted].sort(sortByPriority);
      const report = group[0];
      const count = group.length;
      const isP0 = report.urgency === 'P0';
      const isP1 = report.urgency === 'P1';
      const bgCol = isP0 ? '#e11d48' : isP1 ? '#f59e0b' : '#10b981';
      const pulseAnimation = isP0 ? 'animation: pulse 1.5s infinite;' : '';
      // 動物 icon 係寫死嘅 SVG（animalType 只用嚟揀圖），urgency 亦都會 escape，唔涉及用戶輸入
      const iconSvg = animalIconSvg(report.animalType, { className: 'w-6 h-6', active: true });

      const customIcon = L.divIcon({
        className: 'custom-case-pin',
        html: `
          <div style="
            position: relative; width: 40px; height: 40px; background: ${bgCol};
            border: 2px solid white; border-radius: 50%; display: flex;
            align-items: center; justify-content: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3); cursor: pointer; ${pulseAnimation}
          ">
            <span style="
              width: 30px; height: 30px; border-radius: 50%; background: white;
              display: flex; align-items: center; justify-content: center; color: #1c1917;
            ">${iconSvg}</span>
            <span style="
              position: absolute; bottom: -6px; right: -6px; background: #1c1917;
              color: white; font-size: 10px; font-weight: 800; padding: 1px 4px;
              border-radius: 9999px; border: 1px solid white;
            ">${escapeHtml(report.urgency)}</span>
            ${count > 1 ? `<span style="
              position: absolute; top: -7px; right: -7px; min-width: 20px; height: 20px; padding: 0 5px;
              background: #dc2626; color: white; font-size: 11px; font-weight: 800; line-height: 16px;
              text-align: center; border-radius: 9999px; border: 2px solid white; box-sizing: border-box;
            ">${count}</span>` : ''}
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([report.location.lat, report.location.lng], { icon: customIcon });
      marker.on('click', () => {
        if (count > 1) {
          // 多宗個案：先列出嚟俾用戶揀，唔直接開詳情
          setActiveReport(null);
          setActiveGroup(group);
          return;
        }
        setActiveGroup(null);
        setActiveReport(report);
        onSelectReport(report);
      });
      markersLayer.addLayer(marker);
    });

    if (showNGOs && ngos.length > 0) {
      const hotlineLabel = escapeHtml(t('map.popupHotline'));
      const navigateLabel = escapeHtml(t('map.navigate'));

      ngos.forEach((ngo) => {
        const ngoIcon = L.divIcon({
          className: 'custom-ngo-pin',
          html: `
            <div style="
              width: 34px; height: 34px; background: white; border: 2px solid #0284c7;
              border-radius: 50%; display: flex; align-items: center; justify-content: center;
              box-shadow: 0 3px 8px rgba(0,0,0,0.25); cursor: pointer;
            ">${careIconSvg(26)}</div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const ngoMarker = L.marker([ngo.lat, ngo.lng], { icon: ngoIcon });

        ngoMarker.bindPopup(`
          <div style="font-family: sans-serif; min-width: 200px;">
            <div style="font-weight: bold; font-size: 13px; color: #0f172a; margin-bottom: 2px;">
              ${escapeHtml(ngo.name)}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
              ${escapeHtml(ngo.englishName)}
            </div>
            <div style="font-size: 11px; color: #334155; margin-bottom: 4px;">
              📍 ${escapeHtml(ngo.address)}
            </div>
            <div style="font-size: 11px; color: #dc2626; font-weight: 600; margin-bottom: 8px;">
              📞 ${hotlineLabel}${escapeHtml(ngo.hotline)}
            </div>
            <a href="https://www.google.com/maps/search/?api=1&query=${Number(ngo.lat)},${Number(ngo.lng)}"
               target="_blank" rel="noopener noreferrer"
               style="display: inline-block; font-size: 11px; background: #f1f5f9; color: #0284c7; padding: 4px 8px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              ${navigateLabel} ↗
            </a>
          </div>
        `);

        markersLayer.addLayer(ngoMarker);
      });
    }
    // t 喺依賴入面：轉語言時重新畫 popup
  }, [reports, ngos, filterAnimal, filterUrgency, filterTags, showNGOs, onSelectReport, t]);

  // aiAnalysis.apparentInjuries 冇被 rules 驗證結構，非陣列直接 [0] 會拖垮地圖
  const safeActiveInjuries = Array.isArray(activeReport?.aiAnalysis?.apparentInjuries)
    ? activeReport!.aiAnalysis!.apparentInjuries
    : [];

  const animalBtn = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
      active ? 'bg-brand-500 text-white' : 'text-stone-700 hover:bg-stone-100'
    }`;

  return (
    <div className="relative w-full h-[650px] rounded-3xl overflow-hidden border border-stone-200 shadow-sm bg-stone-100" id="interactive-map-container">
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/95 backdrop-blur border border-stone-200 shadow-md pointer-events-auto flex-wrap">
          <div className="flex items-center gap-1 border-r border-stone-200 pr-1.5 mr-0.5 flex-wrap">
            <button onClick={() => setFilterAnimal('all')} className={animalBtn(filterAnimal === 'all')}>
              {t('map.allSpecies')}
            </button>
            {ANIMAL_FILTERS.map((type) => (
              <button key={type} onClick={() => setFilterAnimal(type)} className={animalBtn(filterAnimal === type)}>
                <AnimalIcon type={type} active={filterAnimal === type} className="w-5 h-5 -my-1" />
                {animalFilterLabel(type)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setFilterUrgency('all')}
              className={`px-2 py-1 text-xs font-medium rounded-lg whitespace-nowrap ${
                filterUrgency === 'all' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {t('map.allLevels')}
            </button>
            {URGENCY_LEVELS.map((lvl) => {
              const s = URGENCY_BTN[lvl];
              return (
                <button
                  key={lvl}
                  onClick={() => setFilterUrgency(lvl)}
                  className={`px-2 py-1 text-xs rounded-lg whitespace-nowrap ${s.weight} ${filterUrgency === lvl ? s.active : s.idle}`}
                >
                  {t(`map.urgencyShort.${lvl}`)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-1.5 rounded-2xl bg-white/95 backdrop-blur border border-stone-200 shadow-md pointer-events-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-bold text-stone-800 cursor-pointer px-2">
            <input
              type="checkbox"
              checked={showNGOs}
              onChange={(e) => setShowNGOs(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
            />
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
              {t('map.showNgos')}
            </span>
          </label>
        </div>

        {/* 標籤篩選另起一行（basis-full），可以揀多個，要全部符合先顯示 */}
        <div className="basis-full flex">
          <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-white/95 backdrop-blur border border-stone-200 shadow-md pointer-events-auto flex-wrap">
            <span className="px-1.5 text-2xs font-semibold text-stone-400">{t('map.tagFilter')}</span>
            {CASE_TAGS.map((tag) => {
              const active = filterTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() =>
                    setFilterTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]))
                  }
                  aria-pressed={active}
                  className={`px-2 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                    active ? 'bg-brand-500 text-white' : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  #{tagLabel(tag)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {reports.length === 0 && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur px-4 py-2.5 rounded-2xl border border-stone-200 shadow-lg text-xs text-stone-700 font-medium flex items-center gap-2 pointer-events-auto">
          <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
          <span>{t('map.empty')}</span>
        </div>
      )}

      <div ref={mapContainerRef} className="w-full h-full" />

      {!activeReport && activeGroup && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[1000] bg-white/95 backdrop-blur rounded-2xl border border-stone-200 shadow-xl p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-stone-900">{t('map.casesHere', { n: activeGroup.length })}</p>
              <p className="text-2xs text-stone-500 truncate">📍 {activeGroup[0].location.address}</p>
            </div>
            <button
              onClick={() => setActiveGroup(null)}
              aria-label={t('map.close')}
              className="text-stone-400 hover:text-stone-600 p-1 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <ul className="max-h-64 overflow-y-auto divide-y divide-stone-100 -mx-1">
            {activeGroup.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveReport(r);
                    onSelectReport(r);
                  }}
                  className="w-full flex items-center gap-3 px-1 py-2 text-left hover:bg-stone-50 rounded-lg transition-colors cursor-pointer"
                >
                  <img
                    src={r.photoUrl}
                    alt={t('map.photoAlt')}
                    className="w-10 h-10 rounded-lg object-cover shrink-0 border border-stone-200 bg-stone-100"
                    referrerPolicy="no-referrer"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-2xs font-bold px-1.5 py-0.5 rounded-full text-white shrink-0 ${
                          r.urgency === 'P0' ? 'bg-rose-600' : r.urgency === 'P1' ? 'bg-amber-500' : 'bg-emerald-600'
                        }`}
                      >
                        {r.urgency}
                      </span>
                      <span className="text-xs font-semibold text-stone-800 truncate">{r.title}</span>
                    </div>
                    <p className="text-2xs text-stone-500 truncate mt-0.5">
                      {statusLabel(r.status)} · {r.description}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeReport && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[1000] bg-white/95 backdrop-blur rounded-2xl border border-stone-200 shadow-xl p-4 transition-all">
          {activeGroup && (
            <button
              type="button"
              onClick={() => setActiveReport(null)}
              className="inline-flex items-center gap-0.5 text-2xs font-medium text-stone-500 hover:text-stone-800 mb-2 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {t('map.backToList')}
            </button>
          )}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full text-white shrink-0 ${
                  activeReport.urgency === 'P0' ? 'bg-rose-600 animate-pulse' : activeReport.urgency === 'P1' ? 'bg-amber-500' : 'bg-emerald-600'
                }`}
              >
                {activeReport.urgency}
              </span>
              <span className="text-xs font-bold text-stone-800 truncate">{activeReport.title}</span>
            </div>
            <button
              onClick={() => {
                setActiveReport(null);
                setActiveGroup(null);
              }}
              aria-label={t('map.close')}
              className="text-stone-400 hover:text-stone-600 p-1 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-3 mb-3">
            <img
              src={activeReport.photoUrl}
              alt={t('map.photoAlt')}
              className="w-16 h-16 rounded-xl object-cover shrink-0 border border-stone-200"
              referrerPolicy="no-referrer"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
            />
            <div className="text-xs text-stone-600 overflow-hidden">
              <p className="font-semibold text-stone-900 truncate mb-1">📍 {activeReport.location.address}</p>
              <p className="line-clamp-2 text-stone-500 mb-1">{activeReport.description}</p>
              {safeActiveInjuries.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-brand-700 font-medium">
                  <Sparkles className="w-3 h-3 text-brand-600 shrink-0" />
                  <span className="truncate">AI: {safeActiveInjuries[0]}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
            <a
              href={getGoogleMapsDirectionsUrl(activeReport.location.lat, activeReport.location.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              {t('map.navigate')}
            </a>
            <button
              type="button"
              onClick={() => onSelectReport(activeReport)}
              className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              {t('map.viewFull')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
