import React, { useEffect, useRef, useState } from 'react';
import { StrayReport, NGOOrganization, UrgencyLevel, AnimalType } from '../types';
import { getGoogleMapsDirectionsUrl } from '../utils/location';
import L from 'leaflet';
import { MapPin, ExternalLink, Sparkles } from 'lucide-react';

interface InteractiveMapProps {
  reports: StrayReport[];
  ngos?: NGOOrganization[];
  selectedReportId?: string;
  onSelectReport: (report: StrayReport) => void;
  centerCoords?: { lat: number; lng: number };
}

// ⚠️ 新增:Leaflet 嘅 bindPopup() 唔會自動 escape HTML,同 React 完全
// 唔同,直接插入未經處理嘅字串構成真實嘅儲存型 XSS 風險。所有插入
// popup HTML 嘅動態內容(NGO 名稱、地址等)必須先經呢個函式處理。
function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAnimalEmoji(type: AnimalType): string {
  switch (type) {
    case 'cat': return '🐱';
    case 'dog': return '🐶';
    case 'bird': return '🕊️';
    default: return '🐾';
  }
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  reports,
  ngos = [],
  onSelectReport,
  centerCoords,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [filterAnimal, setFilterAnimal] = useState<'all' | AnimalType>('all');
  const [filterUrgency, setFilterUrgency] = useState<'all' | UrgencyLevel>('all');
  const [showNGOs, setShowNGOs] = useState(true);
  const [activeReport, setActiveReport] = useState<StrayReport | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    let resizeTimer1: ReturnType<typeof setTimeout> | undefined;
    let resizeTimer2: ReturnType<typeof setTimeout> | undefined;

    if (!mapInstanceRef.current) {
      const defaultCenter: [number, number] = centerCoords
        ? [centerCoords.lat, centerCoords.lng]
        : [22.33, 114.17];

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 12,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;
      mapInstanceRef.current = map;

      // ⚠️ 已改為保存 timer id,喺 cleanup 清理,避免組件提早卸載
      // 時對已移除嘅 map 實例呼叫 invalidateSize() 產生錯誤。
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
      if (filterAnimal !== 'all' && r.animalType !== filterAnimal) return false;
      if (filterUrgency !== 'all' && r.urgency !== filterUrgency) return false;
      return true;
    });

    filteredReports.forEach((report) => {
      const isP0 = report.urgency === 'P0';
      const isP1 = report.urgency === 'P1';
      const bgCol = isP0 ? '#e11d48' : isP1 ? '#f59e0b' : '#10b981';
      const pulseAnimation = isP0 ? 'animation: pulse 1.5s infinite;' : '';

      // 注意:此處插入嘅 emoji 同 urgency 都係來自受控 enum(前者由
      // getAnimalEmoji() 映射固定字元、後者已被 firestore.rules 限制
      // 只可以係 P0/P1/P2),唔涉及使用者自由輸入內容,安全。
      const customIcon = L.divIcon({
        className: 'custom-case-pin',
        html: `
          <div style="
            position: relative; width: 38px; height: 38px; background: ${bgCol};
            border: 3px solid white; border-radius: 50%; display: flex;
            align-items: center; justify-content: center; color: white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3); font-size: 16px;
            font-weight: bold; cursor: pointer; ${pulseAnimation}
          ">
            <span>${getAnimalEmoji(report.animalType)}</span>
            <span style="
              position: absolute; bottom: -6px; right: -6px; background: #1c1917;
              color: white; font-size: 10px; font-weight: 800; padding: 1px 4px;
              border-radius: 9999px; border: 1px solid white;
            ">${report.urgency}</span>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const marker = L.marker([report.location.lat, report.location.lng], { icon: customIcon });
      marker.on('click', () => {
        setActiveReport(report);
        onSelectReport(report);
      });
      markersLayer.addLayer(marker);
    });

    if (showNGOs && ngos && ngos.length > 0) {
      ngos.forEach((ngo) => {
        const ngoIcon = L.divIcon({
          className: 'custom-ngo-pin',
          html: `
            <div style="
              width: 32px; height: 32px; background: #0284c7; border: 2px solid white;
              border-radius: 8px; display: flex; align-items: center; justify-content: center;
              color: white; box-shadow: 0 3px 8px rgba(0,0,0,0.25); font-size: 14px; cursor: pointer;
            ">🏥</div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const ngoMarker = L.marker([ngo.lat, ngo.lng], { icon: ngoIcon });

        // ⚠️ 關鍵修正:原本直接將 ngo.name/englishName/address/hotline
        // 插入 bindPopup() 嘅 HTML 字串,完全冇經過任何 escape。Leaflet
        // 唔似 React 會自動處理,呢啲全部係管理員可自行輸入嘅欄位,
        // 一旦帳號被盜或未來開放第三方登記,就可以構成儲存型 XSS,
        // 攻擊面係所有打開地圖嘅訪客。依家統一經 escapeHtml() 處理。
        const safeName = escapeHtml(ngo.name);
        const safeEnglishName = escapeHtml(ngo.englishName);
        const safeAddress = escapeHtml(ngo.address);
        const safeHotline = escapeHtml(ngo.hotline);

        ngoMarker.bindPopup(`
          <div style="font-family: sans-serif; min-width: 200px;">
            <div style="font-weight: bold; font-size: 13px; color: #0f172a; margin-bottom: 2px;">
              ${safeName}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
              ${safeEnglishName}
            </div>
            <div style="font-size: 11px; color: #334155; margin-bottom: 4px;">
              📍 ${safeAddress}
            </div>
            <div style="font-size: 11px; color: #dc2626; font-weight: 600; margin-bottom: 8px;">
              📞 救助專線：${safeHotline}
            </div>
            <a href="https://www.google.com/maps/search/?api=1&query=${ngo.lat},${ngo.lng}"
               target="_blank" rel="noopener noreferrer"
               style="display: inline-block; font-size: 11px; background: #f1f5f9; color: #0284c7; padding: 4px 8px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              在 Google 地圖導航 ↗
            </a>
          </div>
        `);

        markersLayer.addLayer(ngoMarker);
      });
    }
  }, [reports, ngos, filterAnimal, filterUrgency, showNGOs, onSelectReport]);

  // ⚠️ 防禦性處理:同上一輪 AIAnalysisCard.tsx 一致嘅風險——
  // aiAnalysis.apparentInjuries 冇被 firestore.rules 驗證內部結構,
  // 直接 [0] 存取一個非陣列值會拋錯拖垮地圖畫面。
  const safeActiveInjuries = Array.isArray(activeReport?.aiAnalysis?.apparentInjuries)
    ? activeReport!.aiAnalysis!.apparentInjuries
    : [];

  return (
    <div className="relative w-full h-[650px] rounded-3xl overflow-hidden border border-stone-200 shadow-sm bg-stone-100" id="interactive-map-container">
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/95 backdrop-blur border border-stone-200 shadow-md pointer-events-auto flex-wrap">
          <div className="flex items-center gap-1 border-r border-stone-200 pr-1.5 mr-0.5">
            <button onClick={() => setFilterAnimal('all')} className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${filterAnimal === 'all' ? 'bg-brand-500 text-white' : 'text-stone-700 hover:bg-stone-100'}`}>全部物種</button>
            <button onClick={() => setFilterAnimal('cat')} className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${filterAnimal === 'cat' ? 'bg-brand-500 text-white' : 'text-stone-700 hover:bg-stone-100'}`}>🐱 貓咪</button>
            <button onClick={() => setFilterAnimal('dog')} className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${filterAnimal === 'dog' ? 'bg-brand-500 text-white' : 'text-stone-700 hover:bg-stone-100'}`}>🐶 犬隻</button>
            {/* ⚠️ 已補上 bird 篩選 */}
            <button onClick={() => setFilterAnimal('bird')} className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${filterAnimal === 'bird' ? 'bg-brand-500 text-white' : 'text-stone-700 hover:bg-stone-100'}`}>🕊️ 雀鳥</button>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => setFilterUrgency('all')} className={`px-2 py-1 text-xs font-medium rounded-lg ${filterUrgency === 'all' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>所有等級</button>
            <button onClick={() => setFilterUrgency('P0')} className={`px-2 py-1 text-xs font-bold rounded-lg ${filterUrgency === 'P0' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-50'}`}>P0 危急</button>
            <button onClick={() => setFilterUrgency('P1')} className={`px-2 py-1 text-xs font-bold rounded-lg ${filterUrgency === 'P1' ? 'bg-amber-500 text-white' : 'text-amber-700 hover:bg-amber-50'}`}>P1 醫療</button>
            <button onClick={() => setFilterUrgency('P2')} className={`px-2 py-1 text-xs font-medium rounded-lg ${filterUrgency === 'P2' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'}`}>P2 穩定</button>
          </div>
        </div>

        <div className="p-1.5 rounded-2xl bg-white/95 backdrop-blur border border-stone-200 shadow-md pointer-events-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-bold text-stone-800 cursor-pointer px-2">
            <input type="checkbox" checked={showNGOs} onChange={(e) => setShowNGOs(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
              顯示救助機構 (NGO)
            </span>
          </label>
        </div>
      </div>

      {reports.length === 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur px-4 py-2.5 rounded-2xl border border-stone-200 shadow-lg text-xs text-stone-700 font-medium flex items-center gap-2 pointer-events-auto">
          <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
          <span>目前 Firestore 資料庫中尚無待救援個案標記</span>
        </div>
      )}

      <div ref={mapContainerRef} className="w-full h-full" />

      {activeReport && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[1000] bg-white/95 backdrop-blur rounded-2xl border border-stone-200 shadow-xl p-4 transition-all">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${activeReport.urgency === 'P0' ? 'bg-rose-600 animate-pulse' : activeReport.urgency === 'P1' ? 'bg-amber-500' : 'bg-emerald-600'}`}>
                {activeReport.urgency}
              </span>
              <span className="text-xs font-bold text-stone-800">{activeReport.title}</span>
            </div>
            <button onClick={() => setActiveReport(null)} className="text-stone-400 hover:text-stone-600 text-xs font-bold p-1">✕</button>
          </div>

          <div className="flex gap-3 mb-3">
            <img
              src={activeReport.photoUrl}
              alt="個案照片"
              className="w-16 h-16 rounded-xl object-cover shrink-0 border border-stone-200"
              referrerPolicy="no-referrer"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
            />
            <div className="text-xs text-stone-600 overflow-hidden">
              <p className="font-semibold text-stone-900 truncate mb-1">📍 {activeReport.location.address}</p>
              <p className="line-clamp-2 text-stone-500 mb-1">{activeReport.description}</p>
              {safeActiveInjuries.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-brand-700 font-medium">
                  <Sparkles className="w-3 h-3 text-brand-600" />
                  <span>AI: {safeActiveInjuries[0]}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
            <a href={getGoogleMapsDirectionsUrl(activeReport.location.lat, activeReport.location.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 font-medium">
              <ExternalLink className="w-3.5 h-3.5" />
              在 Google 地圖導航
            </a>
            <button type="button" onClick={() => onSelectReport(activeReport)} className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors">
              檢視完整診斷 ＆ 媒合
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
