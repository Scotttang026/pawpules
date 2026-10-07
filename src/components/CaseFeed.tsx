import React, { useState } from 'react';
import { StrayReport, AnimalType, UrgencyLevel, CaseStatus } from '../types';
import { Search, Sparkles, MapPin, Clock, ShieldAlert, ChevronRight } from 'lucide-react';

interface CaseFeedProps {
  reports: StrayReport[];
  onSelectReport: (report: StrayReport) => void;
  onNavigateToMap: (coords: { lat: number; lng: number }) => void;
}

// 統一動物標籤/emoji,對應 types.ts 已擴充嘅 AnimalType('bird' 已加入)
function getAnimalMeta(type: AnimalType): { label: string; emoji: string } {
  switch (type) {
    case 'cat': return { label: '貓咪', emoji: '🐱' };
    case 'dog': return { label: '犬隻', emoji: '🐶' };
    case 'bird': return { label: '雀鳥', emoji: '🕊️' };
    default: return { label: '其他', emoji: '🐾' };
  }
}

export const CaseFeed: React.FC<CaseFeedProps> = ({
  reports,
  onSelectReport,
  onNavigateToMap,
}) => {
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

  // ⚠️ 已修正:原本用 'analyzed'／'dispatched' 呢兩個已經被移除嘅
  // CaseStatus 值,依家統一對齊 types.ts 實際嘅四個合法狀態
  // ('pending'/'in_progress'/'rescued'/'closed')
  const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
      case 'in_progress':
        return { label: '救援前往中', class: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'rescued':
        return { label: '已成功救助', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'closed':
        return { label: '已結案', class: 'bg-stone-200 text-stone-800 border-stone-300' };
      default:
        return { label: '待處理', class: 'bg-stone-100 text-stone-700 border-stone-200' };
    }
  };

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
              placeholder="搜尋地點（如：旺角、沙田）、品種、或傷勢描述..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              id="case-search-input"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedAnimal('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedAnimal === 'all' ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              全部 ({reports.length})
            </button>
            <button
              onClick={() => setSelectedAnimal('cat')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedAnimal === 'cat' ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              🐱 貓咪
            </button>
            <button
              onClick={() => setSelectedAnimal('dog')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedAnimal === 'dog' ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              🐶 犬隻
            </button>
            {/* ⚠️ 已補上 bird 篩選,對應 types.ts 已擴充嘅 AnimalType */}
            <button
              onClick={() => setSelectedAnimal('bird')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedAnimal === 'bird' ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              🕊️ 雀鳥
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs text-stone-600">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-stone-400">緊急等級：</span>
            {(['all', 'P0', 'P1', 'P2'] as const).map((lvl) => (
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
                {lvl === 'all' ? '全部' : lvl}
              </button>
            ))}
          </div>

          {/* ⚠️ 已改用實際四個合法 CaseStatus 值,取代原本包含
              'analyzed' 且漏咗 'pending'／'closed' 嘅錯誤清單 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-stone-400">狀態：</span>
            {(['all', 'pending', 'in_progress', 'rescued', 'closed'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                  selectedStatus === st
                    ? 'bg-stone-900 text-white font-bold'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {st === 'all'
                  ? '全部'
                  : st === 'pending'
                  ? '待處理'
                  : st === 'in_progress'
                  ? '救援中'
                  : st === 'rescued'
                  ? '已獲救'
                  : '已結案'}
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
          <h3 className="text-base font-bold text-stone-800">目前雲端資料庫暫無任何通報個案</h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
            所有個案資料與相片直接自 Firebase Firestore 與 Cloud Storage 即時抓取。一旦有熱心市民通報，將立即實時同步呈現在此動態牆。
          </p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-stone-500">
          <ShieldAlert className="w-8 h-8 text-stone-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-700">沒有符合搜尋篩選條件的個案</p>
          <p className="text-xs text-stone-400 mt-1">您可以嘗試調整篩選器或重設搜尋關鍵字</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReports.map((report) => {
            const statusCfg = getStatusBadge(report.status);
            const isP0 = report.urgency === 'P0';
            const animalMeta = getAnimalMeta(report.animalType);

            // ⚠️ 防禦性處理:同 AIAnalysisCard.tsx 一致嘅風險——
            // firestore.rules 只驗證 aiAnalysis is map,冇驗證內部
            // apparentInjuries 是否真係陣列,直接 .join() 一個非陣列
            // 值會拋出錯誤拖垮整個動態牆列表渲染。
            const safeInjuries = Array.isArray(report.aiAnalysis?.apparentInjuries)
              ? report.aiAnalysis!.apparentInjuries
              : [];

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
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusCfg.class}`}>
                        {statusCfg.label}
                      </span>
                    </div>

                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur text-white text-[11px] px-2 py-0.5 rounded-md">
                      {animalMeta.emoji} {animalMeta.label}
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
                          <span>AI 診斷：{report.aiAnalysis.estimatedBreed || '未知'}</span>
                        </div>
                        {safeInjuries.length > 0 && (
                          <div className="text-[11px] text-stone-600 line-clamp-1">
                            ⚠️ {safeInjuries.join('；')}
                          </div>
                        )}
                      </div>
                    )}

                    {report.matchedNGOs && report.matchedNGOs.length > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
                        <span>媒合首選：<strong className="text-stone-800">{report.matchedNGOs[0].name}</strong></span>
                        <span className="text-brand-700 font-semibold">
                          約 {Number.isFinite(report.matchedNGOs[0].distanceKm) ? `${report.matchedNGOs[0].distanceKm} km` : '未知距離'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-4 py-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs">
                  <span className="text-stone-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                      在地圖檢視
                    </button>
                    <span className="text-brand-600 font-bold flex items-center gap-0.5">
                      詳情 <ChevronRight className="w-3.5 h-3.5" />
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
