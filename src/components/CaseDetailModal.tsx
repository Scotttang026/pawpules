import React, { useState } from 'react';
import { StrayReport, CaseStatus } from '../types';
import { AIAnalysisCard } from './AIAnalysisCard';
import { NGOMatchFeedback } from './NGOMatchFeedback';
import { getGoogleMapsDirectionsUrl } from '../utils/location';
import { X, MapPin, Phone, User, Clock, CheckCircle2, Navigation, AlertTriangle, Activity } from 'lucide-react';

interface CaseDetailModalProps {
  report: StrayReport;
  onClose: () => void;
  onUpdateStatus: (reportId: string, newStatus: CaseStatus) => void;
  onDispatchToNGO: (ngoId: string, ngoName: string) => Promise<void>;
}

export const CaseDetailModal: React.FC<CaseDetailModalProps> = ({
  report,
  onClose,
  onUpdateStatus,
  onDispatchToNGO,
}) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'ngos'>('ai');

  const statusOptions: { status: CaseStatus; label: string; color: string }[] = [
    { status: 'pending', label: '待處理', color: 'bg-stone-100 text-stone-700' },
    { status: 'analyzed', label: 'AI已診斷', color: 'bg-amber-100 text-amber-800' },
    { status: 'in_progress', label: '救援中 / 義工出動', color: 'bg-blue-100 text-blue-800' },
    { status: 'rescued', label: '已成功救助安置', color: 'bg-emerald-100 text-emerald-800' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto" id="case-detail-modal">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2.5">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                report.urgency === 'P0'
                  ? 'bg-rose-600 animate-pulse'
                  : report.urgency === 'P1'
                  ? 'bg-amber-500'
                  : 'bg-emerald-600'
              }`}
            >
              {report.urgency} 案件
            </span>
            <h2 className="font-bold text-base sm:text-lg text-stone-900 truncate">
              {report.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-700 flex items-center justify-center transition-colors text-xs font-bold"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top Overview: Photo + Case Meta */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            <div className="md:col-span-5">
              <div className="aspect-4/3 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shadow-xs">
                <img
                  src={report.photoUrl}
                  alt={report.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <div className="md:col-span-7 space-y-3">
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80 space-y-2.5 text-xs text-stone-700">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-stone-900 block">通報精確地點：</span>
                    <span>{report.location.address}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap pt-2 border-t border-stone-200/60">
                  <div className="flex items-center gap-1.5 text-stone-600">
                    <User className="w-3.5 h-3.5 text-stone-400" />
                    <span>通報人：<strong>{report.reporterName}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-stone-600">
                    <Phone className="w-3.5 h-3.5 text-stone-400" />
                    <a href={`tel:${report.reporterPhone}`} className="text-blue-600 font-bold hover:underline">
                      {report.reporterPhone}
                    </a>
                  </div>
                  <div className="flex items-center gap-1.5 text-stone-500">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    <span>{new Date(report.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-200/60">
                  <span className="font-bold text-stone-900 block mb-1">市民狀況說明：</span>
                  <p className="text-stone-600 leading-relaxed bg-white p-2.5 rounded-xl border border-stone-200/60">
                    {report.description}
                  </p>
                </div>
              </div>

              {/* Status Updater for Volunteers / Rescuers */}
              <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200">
                <span className="text-xs font-bold text-amber-900 block mb-2">
                  🛠️ 救援進度追蹤 (義工／機構協作)：
                </span>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.status}
                      type="button"
                      onClick={() => onUpdateStatus(report.id, opt.status)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        report.status === opt.status
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-300'
                          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sub-tab Navigation */}
          <div className="flex items-center gap-2 border-b border-stone-200">
            <button
              onClick={() => setActiveTab('ai')}
              className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'ai'
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              🧠 Google Gemini AI 傷病分析報告
            </button>
            <button
              onClick={() => setActiveTab('ngos')}
              className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'ngos'
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              🏥 媒合 NGO 與通報回饋 ({report.matchedNGOs?.length || 0})
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'ai' && (
            <div>
              {report.aiAnalysis ? (
                <AIAnalysisCard analysis={report.aiAnalysis} />
              ) : (
                <div className="p-6 text-center text-stone-500 bg-stone-50 rounded-2xl border">
                  尚未完成 AI 分析
                </div>
              )}
            </div>
          )}

          {activeTab === 'ngos' && (
            <div>
              <NGOMatchFeedback
                report={report}
                matchedNGOs={report.matchedNGOs || []}
                onDispatchToNGO={onDispatchToNGO}
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          <a
            href={getGoogleMapsDirectionsUrl(report.location.lat, report.location.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-700 bg-white hover:bg-stone-100 px-3 py-2 rounded-xl border border-stone-300 transition-colors shadow-2xs"
          >
            <Navigation className="w-4 h-4 text-rose-600" />
            開啟 Google Maps 現場導航
          </a>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-xs transition-colors"
          >
            關閉檢視
          </button>
        </div>
      </div>
    </div>
  );
};
