import React from 'react';
import { AIAnalysisResult } from '../types';
import { Sparkles, AlertTriangle, ShieldCheck, Wrench, HeartHandshake, AlertCircle, Activity } from 'lucide-react';

interface AIAnalysisCardProps {
  analysis: AIAnalysisResult;
  compact?: boolean;
}

export const AIAnalysisCard: React.FC<AIAnalysisCardProps> = ({ analysis, compact = false }) => {
  const getUrgencyConfig = (level: string) => {
    switch (level) {
      case 'P0':
        return {
          label: 'P0 - 極度危急',
          subLabel: '生命危險／疑似嚴重車禍／休克／需即刻急診救助',
          badgeClass: 'bg-rose-600 text-white animate-pulse',
          bgClass: 'bg-rose-50 border-rose-200',
          textColor: 'text-rose-900',
        };
      case 'P1':
        return {
          label: 'P1 - 需醫療關注',
          subLabel: '骨折／開放外傷／幼貓幼犬／嚴重感染虛弱',
          badgeClass: 'bg-amber-500 text-white',
          bgClass: 'bg-amber-50 border-amber-200',
          textColor: 'text-amber-900',
        };
      default:
        return {
          label: 'P2 - 情況穩定',
          subLabel: '無立即危險／親人走失／需收容安置與晶片掃描',
          badgeClass: 'bg-emerald-600 text-white',
          bgClass: 'bg-emerald-50 border-emerald-200',
          textColor: 'text-emerald-900',
        };
    }
  };

  const urgency = getUrgencyConfig(analysis.urgencyLevel);

  if (compact) {
    return (
      <div className={`rounded-xl p-3 border ${urgency.bgClass}`} id="ai-analysis-compact">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>AI 診斷簡報</span>
          </div>
          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${urgency.badgeClass}`}>
            {urgency.label}
          </span>
        </div>
        <p className="text-xs text-stone-700 mb-1">
          <strong className="text-stone-900">{analysis.identifiedSpecies}</strong> ({analysis.estimatedBreed})
        </p>
        <p className="text-xs text-stone-600 line-clamp-2">
          {analysis.urgencyReason}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden" id="ai-analysis-card">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-wide flex items-center gap-2">
              Google Gemini 多模態 AI 傷病判斷報告
              <span className="text-xs font-normal text-stone-400">
                (信心度 {Math.round(analysis.confidenceScore * 100)}%)
              </span>
            </h3>
            <p className="text-xs text-stone-300">
              分析時間：{new Date(analysis.analyzedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        <div className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide shadow-sm ${urgency.badgeClass}`}>
          {urgency.label}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Identified Animal Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3 border-b border-stone-100">
          <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/60">
            <span className="text-xs font-medium text-stone-500 block mb-0.5">辨識物種</span>
            <span className="text-sm font-bold text-stone-900">{analysis.identifiedSpecies}</span>
          </div>
          <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/60">
            <span className="text-xs font-medium text-stone-500 block mb-0.5">推測品種與毛色</span>
            <span className="text-sm font-semibold text-stone-800">{analysis.estimatedBreed}</span>
          </div>
        </div>

        {/* Appearance description */}
        {analysis.appearanceDescription && (
          <div className="text-xs text-stone-600 bg-stone-50/70 p-3 rounded-xl border border-stone-200/50">
            <strong className="text-stone-800">體態特徵：</strong>
            {analysis.appearanceDescription}
          </div>
        )}

        {/* Urgency justification */}
        <div className={`p-3.5 rounded-xl border ${urgency.bgClass}`}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-stone-900 mb-0.5">緊急度評定原因</p>
              <p className="text-xs text-stone-700 leading-relaxed">{analysis.urgencyReason}</p>
            </div>
          </div>
        </div>

        {/* Apparent Injuries */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900 mb-2">
            <Activity className="w-4 h-4 text-rose-600" />
            <span>初步檢測傷病／異常跡象 ({analysis.apparentInjuries.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {analysis.apparentInjuries.map((injury, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs text-stone-800 bg-rose-50/60 border border-rose-100 px-3 py-2 rounded-lg"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>{injury}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Equipment Needed for Rescuers */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900 mb-2">
            <Wrench className="w-4 h-4 text-blue-600" />
            <span>建議 NGO 救助隊準備裝備</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {analysis.rescueEquipment.map((eq, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 text-xs font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded-lg"
              >
                ✓ {eq}
              </span>
            ))}
          </div>
        </div>

        {/* Citizen Field First-Aid Advice */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 mb-2">
            <HeartHandshake className="w-4 h-4 text-emerald-700" />
            <span>通報市民現場應急守則 (等待救援期間)</span>
          </div>
          <ul className="space-y-1.5">
            {analysis.firstAidAdvice.map((advice, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-emerald-900/90 leading-relaxed">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{advice}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Handling Precautions */}
        {analysis.handlingPrecautions && analysis.handlingPrecautions.length > 0 && (
          <div className="text-xs text-amber-800 bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="block text-amber-900 mb-0.5">安全禁忌與防護提示：</strong>
              {analysis.handlingPrecautions.join('；')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
