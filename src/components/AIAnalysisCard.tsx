import React from 'react';
import { useTranslation } from 'react-i18next';
import { AIAnalysisResult } from '../types';
import { getApiLang } from '../i18n';
import { Sparkles, AlertTriangle, ShieldCheck, Wrench, HeartHandshake, AlertCircle, Activity } from 'lucide-react';

interface AIAnalysisCardProps {
  analysis: AIAnalysisResult;
  compact?: boolean;
}

const URGENCY_STYLE = {
  P0: { badgeClass: 'bg-rose-600 text-white animate-pulse', bgClass: 'bg-rose-50 border-rose-200' },
  P1: { badgeClass: 'bg-brand-500 text-white', bgClass: 'bg-brand-50 border-brand-200' },
  P2: { badgeClass: 'bg-emerald-600 text-white', bgClass: 'bg-emerald-50 border-emerald-200' },
} as const;

type Level = keyof typeof URGENCY_STYLE;

// firestore.rules 冇驗證 aiAnalysis 內部結構，非陣列一律當空陣列，避免 crash
const asList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

export const AIAnalysisCard: React.FC<AIAnalysisCardProps> = ({ analysis, compact = false }) => {
  const { t } = useTranslation();

  const level: Level =
    analysis.urgencyLevel === 'P0' || analysis.urgencyLevel === 'P1' ? analysis.urgencyLevel : 'P2';
  const style = URGENCY_STYLE[level];
  const urgencyLabel = t(`aiCard.urgency.${level}.label`);

  const safeInjuries = asList(analysis.apparentInjuries);
  const safeEquipment = asList(analysis.rescueEquipment);
  const safeFirstAid = asList(analysis.firstAidAdvice);
  const safePrecautions = asList(analysis.handlingPrecautions);
  const hasConfidence = typeof analysis.confidenceScore === 'number' && Number.isFinite(analysis.confidenceScore);

  const analyzedTimeLabel = (() => {
    const d = new Date(analysis.analyzedAt);
    return Number.isNaN(d.getTime())
      ? t('aiCard.unknownTime')
      : d.toLocaleTimeString(getApiLang(), { hour: '2-digit', minute: '2-digit' });
  })();

  const reason = analysis.urgencyReason || t('aiCard.noReason');

  if (compact) {
    return (
      <div className={`rounded-xl p-3 border ${style.bgClass}`} id="ai-analysis-compact">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <span>{t('aiCard.compactTitle')}</span>
          </div>
          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${style.badgeClass}`}>{urgencyLabel}</span>
        </div>
        <p className="text-xs text-stone-700 mb-1">
          <strong className="text-stone-900">{analysis.identifiedSpecies || t('aiCard.unknownSpecies')}</strong>
          {analysis.estimatedBreed ? ` (${analysis.estimatedBreed})` : ''}
        </p>
        <p className="text-xs text-stone-600 line-clamp-2">{reason}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden" id="ai-analysis-card">
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-white px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center border border-brand-500/30 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm tracking-wide flex items-center gap-2 flex-wrap">
              {t('aiCard.title')}
              {hasConfidence && (
                <span className="text-xs font-normal text-stone-400">
                  {t('aiCard.confidence', { pct: Math.round(analysis.confidenceScore * 100) })}
                </span>
              )}
            </h3>
            <p className="text-xs text-stone-300">{t('aiCard.analyzedAt', { time: analyzedTimeLabel })}</p>
          </div>
        </div>

        <div className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide shadow-sm shrink-0 ${style.badgeClass}`}>
          {urgencyLabel}
        </div>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-2xs text-stone-500">{t(`aiCard.urgency.${level}.sub`)}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3 border-b border-stone-100">
          <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/60">
            <span className="text-xs font-medium text-stone-500 block mb-0.5">{t('aiCard.species')}</span>
            <span className="text-sm font-bold text-stone-900">{analysis.identifiedSpecies || t('aiCard.unknown')}</span>
          </div>
          <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/60">
            <span className="text-xs font-medium text-stone-500 block mb-0.5">{t('aiCard.breed')}</span>
            <span className="text-sm font-semibold text-stone-800">{analysis.estimatedBreed || t('aiCard.unknown')}</span>
          </div>
        </div>

        {analysis.appearanceDescription && (
          <div className="text-xs text-stone-600 bg-stone-50/70 p-3 rounded-xl border border-stone-200/50">
            <strong className="text-stone-800">{t('aiCard.appearance')}</strong>
            {analysis.appearanceDescription}
          </div>
        )}

        <div className={`p-3.5 rounded-xl border ${style.bgClass}`}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-stone-900 mb-0.5">{t('aiCard.reasonTitle')}</p>
              <p className="text-xs text-stone-700 leading-relaxed">{reason}</p>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900 mb-2">
            <Activity className="w-4 h-4 text-rose-600" />
            <span>{t('aiCard.injuries', { n: safeInjuries.length })}</span>
          </div>
          {safeInjuries.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {safeInjuries.map((injury, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-stone-800 bg-rose-50/60 border border-rose-100 px-3 py-2 rounded-lg">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  <span>{injury}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-400">{t('aiCard.noInjuries')}</p>
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900 mb-2">
            <Wrench className="w-4 h-4 text-blue-600" />
            <span>{t('aiCard.equipment')}</span>
          </div>
          {safeEquipment.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {safeEquipment.map((eq, idx) => (
                <span key={idx} className="px-2.5 py-1 text-xs font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded-lg">
                  ✓ {eq}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-400">{t('aiCard.noEquipment')}</p>
          )}
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 mb-2">
            <HeartHandshake className="w-4 h-4 text-emerald-700" />
            <span>{t('aiCard.firstAid')}</span>
          </div>
          {safeFirstAid.length > 0 ? (
            <ul className="space-y-1.5">
              {safeFirstAid.map((advice, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-emerald-900/90 leading-relaxed">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{advice}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-emerald-700/70">{t('aiCard.noFirstAid')}</p>
          )}
        </div>

        {safePrecautions.length > 0 && (
          <div className="text-xs text-brand-800 bg-brand-50/80 border border-brand-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="block text-brand-900 mb-0.5">{t('aiCard.precautions')}</strong>
              {safePrecautions.join(t('aiCard.listSeparator'))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
