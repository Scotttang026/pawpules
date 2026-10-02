import React, { useState } from 'react';
import { NGOOrganization, StrayReport, AnimalType } from '../types';
import { getGoogleMapsDirectionsUrl } from '../utils/location';
import { useAuth } from '../contexts/AuthContext';
import { Phone, MessageCircle, Navigation, Send, CheckCircle2, ShieldAlert, Clock, Building, Award } from 'lucide-react';

interface NGOMatchFeedbackProps {
  report: StrayReport;
  matchedNGOs: NGOOrganization[];
  onDispatchToNGO?: (ngoId: string, ngoName: string) => Promise<void>;
}

// ⚠️ 新增：統一嘅動物類型標籤函式，取代原本散落各處、只判斷
// cat/dog 兩種嘅不完整三元／二元運算式（原本 bird 同 other 會被
// 誤標為「狗」）。
function getAnimalTypeLabel(type: AnimalType): string {
  switch (type) {
    case 'cat':
      return '貓';
    case 'dog':
      return '狗';
    case 'bird':
      return '鳥';
    default:
      return '動物';
  }
}

export const NGOMatchFeedback: React.FC<NGOMatchFeedbackProps> = ({
  report,
  matchedNGOs,
  onDispatchToNGO,
}) => {
  const { isAdmin } = useAuth();
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [dispatchedSuccessId, setDispatchedSuccessId] = useState<string | null>(
    report.dispatchedToNGO?.ngoId || null
  );

  const handleDispatch = async (ngo: NGOOrganization) => {
  if (!onDispatchToNGO || dispatchedSuccessId === ngo.id) return;
    setDispatchingId(ngo.id);
    try {
      await onDispatchToNGO(ngo.id, ngo.name);
      setDispatchedSuccessId(ngo.id);
    } catch (err) {
      console.error('Failed to notify NGO:', err);
          alert(err instanceof Error && err.message ? err.message : '通知 NGO 失敗，請稍後再試或直接致電機構熱線。');
    } finally {
      setDispatchingId(null);
    }
  };

  // ⚠️ 私隱保護：由於案件詳情對任何訪客公開可讀（firestore.rules
  // 設定 allow read: if true），WhatsApp 分享連結嘅內容會直接出現
  // 喺頁面 DOM／href 屬性入面，任何人檢視原始碼都睇得到，完全繞過
  // CaseDetailModal 已經做嘅畫面遮蔽。因此呢裡獨立再做一次防護：
  // 只有管理員先會將報案人真實電話帶入訊息內容，非管理員嘅訊息
  // 改用案件追蹤連結取代，確保救援協調資訊唔會連帶洩漏個人聯絡方式。
  //
  // 已知取捨：報案人本人喺提交成功後嘅即時檢視畫面（App.tsx 嘅
  // justSubmittedReport 流程）亦會經過呢個組件，若佢並非已登入
  // 管理員，佢自己嘅電話喺呢個訊息預覽入面同樣會被遮蔽。呢個屬於
  // 刻意嘅保守設計（因為冇辦法可靠地驗證匿名提交者嘅身份），使用者
  // 本身已經知道自己電話，可自行手動聯絡 NGO，唔影響實際救援流程。
  const buildWhatsAppMessage = (): string => {
    const animalLabel = getAnimalTypeLabel(report.animalType);
    const trackingUrl = `${window.location.origin}/?caseId=${encodeURIComponent(report.id)}`;

        const contactLine = isAdmin
      ? `通報人電話: ${report.reporterPhone}`
      : `案件追蹤連結: ${trackingUrl}`;

    return [
      '【PawPulse 流浪動物通報求助】',
      `個案編號: ${report.id}`,
      `動物: ${animalLabel}${report.customAnimalName ? ` (${report.customAnimalName})` : ''}`,
      `緊急度: ${report.urgency}`,
      `地點: ${report.location.address}`,
      contactLine,
    ].join('\n');
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden" id="ngo-match-feedback">
      {/* Header */}
      <div className="bg-stone-50 border-b border-stone-200 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="font-bold text-sm text-stone-900">
                自動媒合鄰近 NGO 機構 ({matchedNGOs.length} 間推薦)
              </h3>
              <p className="text-xs text-stone-500">
                依據動物物種（{getAnimalTypeLabel(report.animalType)}）、
                緊急等級（{report.urgency}）及地理直線/行車距離智慧配對
              </p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full font-semibold border border-amber-200">
            即時算距
          </span>
        </div>
      </div>

      {/* NGO List */}
      <div className="p-5 space-y-4">
        {matchedNGOs.length === 0 && (
          <div className="p-6 text-center text-stone-400 text-xs">
            暫無自動媒合的 NGO 機構，請直接使用下方緊急熱線聯絡。
          </div>
        )}

        {matchedNGOs.map((ngo, index) => {
          const isTopMatch = index === 0;
          const isDispatched = dispatchedSuccessId === ngo.id;
          const isSubmitting = dispatchingId === ngo.id;

          return (
            <div
              key={ngo.id}
              className={`rounded-xl border p-4 transition-all ${
                isTopMatch
                  ? 'border-amber-300 bg-amber-50/40 shadow-xs ring-1 ring-amber-200'
                  : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
              id={`ngo-card-${ngo.id}`}
            >
              {/* Card top row */}
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-bold text-sm text-stone-900">{ngo.name}</h4>
                    {isTopMatch && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500 text-white">
                        <Award className="w-3 h-3" />
                        最佳匹配首選
                      </span>
                    )}
                    {ngo.hasEmergencyRescue && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                        24h 緊急出車
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500">{ngo.englishName}</p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full inline-block">
                    匹配度 {ngo.matchScore ?? 95}%
                  </div>
                  <div className="text-xs text-stone-600 mt-1 font-medium">
                    距離約 <span className="font-bold text-stone-900">{ngo.distanceKm} km</span>
                    <span className="text-stone-400 mx-1">·</span>
                    車程約 {ngo.driveTimeMins} 分鐘
                  </div>
                </div>
              </div>

              <p className="text-xs text-stone-600 mb-2">
                <span className="font-medium text-stone-700">基地地址：</span>
                {ngo.address}
              </p>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {ngo.specialties.map((spec, sIdx) => (
                  <span
                    key={sIdx}
                    className="text-[11px] px-2 py-0.5 bg-stone-100 text-stone-700 rounded-md border border-stone-200/60"
                  >
                    {spec}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-stone-500 mb-3.5">
                <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>服務時間：{ngo.operatingHours}</span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stone-200/80">
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={`tel:${ngo.hotline.replace(/[^\d+]/g, '')}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs"
                    id={`btn-call-${ngo.id}`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    致電 {ngo.hotline}
                  </a>

                  {ngo.whatsapp && (
                    <a
                      href={`https://wa.me/${ngo.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                        buildWhatsAppMessage()
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 transition-colors"
                      id={`btn-whatsapp-${ngo.id}`}
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                      WhatsApp 求助
                    </a>
                  )}

                  <a
                    href={getGoogleMapsDirectionsUrl(ngo.lat, ngo.lng, report.location.lat, report.location.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors"
                    title="在 Google Maps 查看路線"
                  >
                    <Navigation className="w-3.5 h-3.5 text-stone-600" />
                    導航路線
                  </a>
                </div>

                <div>
                  {isDispatched ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {isAdmin ? '已向機構送交通報 (已接案)' : '已通知機構，等候救援隊確認接案'}
                    </div>
                  ) : onDispatchToNGO ? (
                    <button
                      type="button"
                      onClick={() => handleDispatch(ngo)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-xs"
                      id={`btn-dispatch-${ngo.id}`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isSubmitting ? '派送中...' : '送交通報 + AI 報告'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-amber-500/10 border-t border-amber-200/60 p-3.5 px-5 flex items-center justify-between text-xs text-amber-900">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
          <span>若動物目前正處於嚴重生命威脅（如大出血、呼吸停止），請立即直接撥打上方熱線進行緊急口頭回報。</span>
        </div>
      </div>
    </div>
  );
};
