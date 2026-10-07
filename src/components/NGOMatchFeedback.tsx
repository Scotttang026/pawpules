import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NGOOrganization, StrayReport } from '../types';
import { getGoogleMapsDirectionsUrl } from '../utils/location';
import { animalLabel } from '../utils/caseLabels';
import { useAuth } from '../contexts/AuthContext';
import { Phone, MessageCircle, Navigation, Send, CheckCircle2, ShieldAlert, Clock, Building, Award } from 'lucide-react';

interface NGOMatchFeedbackProps {
  report: StrayReport;
  matchedNGOs: NGOOrganization[];
  onDispatchToNGO?: (ngoId: string, ngoName: string) => Promise<void>;
}

// WhatsApp 訊息係俾 NGO 睇，固定用 NGO 慣用語言，唔跟用戶介面語言
const NGO_MESSAGE_LANG = 'zh';

// 訊息係純文字（WhatsApp），唔需要 HTML escape，否則地址入面嘅 "&"、"/" 會變亂碼
const NO_ESCAPE = { interpolation: { escapeValue: false } } as const;

export const NGOMatchFeedback: React.FC<NGOMatchFeedbackProps> = ({ report, matchedNGOs, onDispatchToNGO }) => {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [dispatchedSuccessId, setDispatchedSuccessId] = useState<string | null>(report.dispatchedToNGO?.ngoId || null);

  const handleDispatch = async (ngo: NGOOrganization) => {
    if (!onDispatchToNGO || dispatchedSuccessId === ngo.id) return;
    setDispatchingId(ngo.id);
    try {
      await onDispatchToNGO(ngo.id, ngo.name);
      setDispatchedSuccessId(ngo.id);
    } catch (err) {
      console.error('Failed to notify NGO:', err);
      // App.tsx 拋出嘅錯誤已經係翻譯好嘅文字
      alert(err instanceof Error && err.message ? err.message : t('app.dispatchFailed'));
    } finally {
      setDispatchingId(null);
    }
  };

  // ⚠️ 私隱保護：案件公開可讀，WhatsApp 連結內容會出現喺頁面 DOM。
  // 只有管理員先會帶入報案人電話，其他人一律改用案件追蹤連結。
  const buildWhatsAppMessage = (): string => {
    const tMsg = i18n.getFixedT(NGO_MESSAGE_LANG);
    const animalName = tMsg(`ngoMatch.whatsapp.animalNames.${report.animalType}`, {
      defaultValue: tMsg('ngoMatch.whatsapp.animalNames.other'),
    });
    const animal = report.customAnimalName ? `${animalName} (${report.customAnimalName})` : animalName;
    const trackingUrl = `${window.location.origin}/?caseId=${encodeURIComponent(report.id)}`;

    const contactLine = isAdmin
      ? tMsg('ngoMatch.whatsapp.phone', { phone: report.reporterPhone, ...NO_ESCAPE })
      : tMsg('ngoMatch.whatsapp.tracking', { url: trackingUrl, ...NO_ESCAPE });

    return [
      tMsg('ngoMatch.whatsapp.header'),
      tMsg('ngoMatch.whatsapp.caseId', { id: report.id, ...NO_ESCAPE }),
      tMsg('ngoMatch.whatsapp.animal', { animal, ...NO_ESCAPE }),
      tMsg('ngoMatch.whatsapp.urgency', { urgency: report.urgency, ...NO_ESCAPE }),
      tMsg('ngoMatch.whatsapp.location', { address: report.location.address, ...NO_ESCAPE }),
      contactLine,
    ].join('\n');
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden" id="ngo-match-feedback">
      <div className="bg-stone-50 border-b border-stone-200 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Building className="w-5 h-5 text-brand-600 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-stone-900">{t('ngoMatch.headerTitle', { n: matchedNGOs.length })}</h3>
              <p className="text-xs text-stone-500">
                {t('ngoMatch.headerSub', { animal: animalLabel(report.animalType), urgency: report.urgency })}
              </p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 bg-brand-100 text-brand-800 rounded-full font-semibold border border-brand-200 shrink-0">
            {t('ngoMatch.liveDistance')}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {matchedNGOs.length === 0 && <div className="p-6 text-center text-stone-400 text-xs">{t('ngoMatch.empty')}</div>}

        {matchedNGOs.map((ngo, index) => {
          const isTopMatch = index === 0;
          const isDispatched = dispatchedSuccessId === ngo.id;
          const isSubmitting = dispatchingId === ngo.id;
          const hasScore = typeof ngo.matchScore === 'number' && Number.isFinite(ngo.matchScore);
          const hasDistance = typeof ngo.distanceKm === 'number' && Number.isFinite(ngo.distanceKm);
          const hasDrive = typeof ngo.driveTimeMins === 'number' && Number.isFinite(ngo.driveTimeMins);

          return (
            <div
              key={ngo.id}
              className={`rounded-xl border p-4 transition-all ${
                isTopMatch ? 'border-brand-300 bg-brand-50/40 shadow-xs ring-1 ring-brand-200' : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
              id={`ngo-card-${ngo.id}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2.5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-bold text-sm text-stone-900">{ngo.name}</h4>
                    {isTopMatch && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-brand-500 text-white">
                        <Award className="w-3 h-3" />
                        {t('ngoMatch.topMatch')}
                      </span>
                    )}
                    {ngo.hasEmergencyRescue && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                        {t('ngoMatch.emergency24h')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500">{ngo.englishName}</p>
                </div>

                <div className="sm:text-right shrink-0">
                  {hasScore && (
                    <div className="text-xs font-bold text-brand-700 bg-brand-100/80 px-2 py-0.5 rounded-full inline-block">
                      {t('ngoMatch.matchScore', { pct: ngo.matchScore })}
                    </div>
                  )}
                  {(hasDistance || hasDrive) && (
                    <div className="text-xs text-stone-600 mt-1 font-medium">
                      {hasDistance && t('ngoMatch.distance', { km: ngo.distanceKm })}
                      {hasDistance && hasDrive && <span className="text-stone-400 mx-1">·</span>}
                      {hasDrive && t('ngoMatch.driveTime', { mins: ngo.driveTimeMins })}
                    </div>
                  )}
                </div>
              </div>

              <p className="text-xs text-stone-600 mb-2">
                <span className="font-medium text-stone-700">{t('ngoMatch.baseAddress')}</span>
                {ngo.address}
              </p>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {(ngo.specialties || []).map((spec, sIdx) => (
                  <span key={sIdx} className="text-[11px] px-2 py-0.5 bg-stone-100 text-stone-700 rounded-md border border-stone-200/60">
                    {spec}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-stone-500 mb-3.5">
                <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>{t('ngoMatch.hours', { hours: ngo.operatingHours })}</span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stone-200/80">
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={`tel:${ngo.hotline.replace(/[^\d+]/g, '')}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs"
                    id={`btn-call-${ngo.id}`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {t('ngoMatch.call', { phone: ngo.hotline })}
                  </a>

                  {ngo.whatsapp && (
                    <a
                      href={`https://wa.me/${ngo.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(buildWhatsAppMessage())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 transition-colors"
                      id={`btn-whatsapp-${ngo.id}`}
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                      {t('ngoMatch.whatsappHelp')}
                    </a>
                  )}

                  <a
                    href={getGoogleMapsDirectionsUrl(ngo.lat, ngo.lng, report.location.lat, report.location.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors"
                    title={t('ngoMatch.routeTitle')}
                  >
                    <Navigation className="w-3.5 h-3.5 text-stone-600" />
                    {t('ngoMatch.route')}
                  </a>
                </div>

                <div>
                  {isDispatched ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      {isAdmin ? t('ngoMatch.dispatchedAdmin') : t('ngoMatch.dispatchedPublic')}
                    </div>
                  ) : onDispatchToNGO ? (
                    <button
                      type="button"
                      onClick={() => handleDispatch(ngo)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-xs"
                      id={`btn-dispatch-${ngo.id}`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isSubmitting ? t('ngoMatch.dispatching') : t('ngoMatch.dispatch')}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-brand-500/10 border-t border-brand-200/60 p-3.5 px-5 flex items-center text-xs text-brand-900">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-brand-700 shrink-0" />
          <span>{t('ngoMatch.lifeThreat')}</span>
        </div>
      </div>
    </div>
  );
};
