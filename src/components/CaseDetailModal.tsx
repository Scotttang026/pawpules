import React, { useState, useEffect } from 'react';
import { StrayReport, CaseStatus } from '../types';
import { AIAnalysisCard } from './AIAnalysisCard';
import { NGOMatchFeedback } from './NGOMatchFeedback';
import { getGoogleMapsDirectionsUrl } from '../utils/location';
import { useAuth } from '../contexts/AuthContext';
import { fetchCaseContact, ReporterContactInfo } from '../services/caseService';
import {
  X,
  MapPin,
  Phone,
  User,
  Clock,
  Navigation,
  Mail,
  Copy,
  Check,
  ShieldCheck,
  Trash2,
  Lock,
} from 'lucide-react';

interface CaseDetailModalProps {
  report: StrayReport;
  onClose: () => void;
  onUpdateStatus?: (reportId: string, newStatus: CaseStatus) => void;
  onDispatchToNGO: (ngoId: string, ngoName: string) => Promise<void>;
  onDeleteCase?: (reportId: string) => void;
}

export const CaseDetailModal: React.FC<CaseDetailModalProps> = ({
  report,
  onClose,
  onUpdateStatus,
  onDispatchToNGO,
  onDeleteCase,
}) => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'ai' | 'ngos'>('ai');
  const [copiedLink, setCopiedLink] = useState(false);

  const [contactInfo, setContactInfo] = useState<ReporterContactInfo | null>(null);
  const [loadingContact, setLoadingContact] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setContactInfo(null);
      return;
    }
    let cancelled = false;
    setLoadingContact(true);
    fetchCaseContact(report.id)
      .then((data) => {
        if (!cancelled) setContactInfo(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingContact(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, report.id]);

  const enrichedReport: StrayReport = {
    ...report,
    reporterName: contactInfo?.reporterName || report.reporterName,
    reporterPhone: contactInfo?.reporterPhone || report.reporterPhone,
    reporterEmail: contactInfo?.reporterEmail || report.reporterEmail,
  };

  const statusOptions: { status: CaseStatus; label: string; color: string }[] = [
    { status: 'pending', label: '待處理', color: 'bg-stone-100 text-stone-700' },
    { status: 'in_progress', label: '救援前往中 / 接案', color: 'bg-blue-100 text-blue-800' },
    { status: 'rescued', label: '已成功救助安置', color: 'bg-emerald-100 text-emerald-800' },
    { status: 'closed', label: '已結案', color: 'bg-stone-200 text-stone-800' },
  ];

  const currentStatusLabel =
    statusOptions.find((opt) => opt.status === report.status)?.label || report.status;

  const handleCopyTrackingLink = () => {
    const url = `${window.location.origin}/?caseId=${encodeURIComponent(report.id)}`;
    try {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
      alert(`請手動複製連結：${url}`);
    }
  };

  const canManageStatus = isAdmin && typeof onUpdateStatus === 'function';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto" id="case-detail-modal">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2.5 truncate">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold text-white shrink-0 ${
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
            <span className="text-2xs font-mono text-stone-500 bg-stone-200/80 px-2 py-0.5 rounded shrink-0">
              #{report.id}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyTrackingLink}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 flex items-center gap-1.5 transition-colors text-2xs font-bold"
              title="複製案件專屬追蹤連結"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedLink ? '已複製連結' : '分享追蹤連結'}</span>
            </button>

            {isAdmin && onDeleteCase && (
              <button
                onClick={() => {
                  if (confirm(`管理員確認：確定要永久刪除個案 #${report.id}？`)) {
                    onDeleteCase(report.id);
                    onClose();
                  }
                }}
                className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors"
                title="管理員刪除個案"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-700 flex items-center justify-center transition-colors text-xs font-bold"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
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
              {report.storagePath && (
                <p className="text-3xs text-stone-500 font-mono mt-1.5 truncate px-1" title={report.storagePath}>
                  ☁️ Storage: <span className="text-amber-800">{report.storagePath}</span>
                </p>
              )}
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

                <div className="flex items-center gap-4 flex-wrap pt-2 border-t border-stone-200/60 text-2xs">
                  {isAdmin ? (
                    <>
                      <div className="flex items-center gap-1.5 text-stone-600">
                        <User className="w-3.5 h-3.5 text-stone-400" />
                        <span>
                          通報人：
                          <strong>{loadingContact ? '載入中...' : (contactInfo?.reporterName || '熱心市民')}</strong>
                        </span>
                      </div>

                      {contactInfo?.reporterPhone && contactInfo.reporterPhone !== '未填寫' && contactInfo.reporterPhone !== '未提供 (匿名)' && (
                        <div className="flex items-center gap-1.5 text-stone-600">
                          <Phone className="w-3.5 h-3.5 text-stone-400" />
                          <a href={`tel:${contactInfo.reporterPhone}`} className="text-blue-600 font-bold hover:underline">
                            {contactInfo.reporterPhone}
                          </a>
                        </div>
                      )}

                      {contactInfo?.reporterEmail && (
                        <div className="flex items-center gap-1.5 text-stone-600">
                          <Mail className="w-3.5 h-3.5 text-stone-400" />
                          <span className="text-stone-700">{contactInfo.reporterEmail}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 text-stone-400" title="報案人聯絡資料已受保護，僅供管理員查看">
                      <Lock className="w-3 h-3" />
                      <span>通報人聯絡資料已受保護（僅供救援協調團隊查看）</span>
                    </div>
                  )}

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

              <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    救援進度狀態 (Firestore 即時共享)：
                  </span>
                  {canManageStatus && (
                    <span className="text-2xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                      管理員可任意變更
                    </span>
                  )}
                </div>

                {canManageStatus ? (
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((opt) => (
                      <button
                        key={opt.status}
                        type="button"
                        onClick={() => onUpdateStatus!(report.id, opt.status)}
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
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-700">
                    {currentStatusLabel}
                    <span className="text-2xs text-stone-400 font-normal">（僅管理員可變更狀態）</span>
                  </div>
                )}
              </div>
            </div>
          </div>

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

          {activeTab === 'ai' && (
            <div>
              {report.aiAnalysis ? (
                <AIAnalysisCard analysis={report.aiAnalysis} />
              ) : (
                <div className="p-8 text-center text-stone-500 bg-stone-50 rounded-2xl border border-stone-200 space-y-1.5">
                  <p className="text-sm font-bold text-stone-700">Gemini 沒有回應</p>
                  <p className="text-xs text-stone-400">未能取得 AI 傷勢分析報告，請依照現場實際狀況進行救助。</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ngos' && (
            <div>
              <NGOMatchFeedback
                report={enrichedReport}
                matchedNGOs={report.matchedNGOs || []}
                onDispatchToNGO={onDispatchToNGO}
              />
            </div>
          )}
        </div>

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
