import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StrayReport, CaseStatus, NGOOrganization } from '../types';
import { AIAnalysisCard } from './AIAnalysisCard';
import { NGOMatchFeedback } from './NGOMatchFeedback';
import { getGoogleMapsDirectionsUrl } from '../utils/location';
import { useAuth } from '../contexts/AuthContext';
import { fetchCaseContact, ReporterContactInfo, rankFirestoreNGOs } from '../services/caseService';
import { statusLabel, CASE_STATUSES } from '../utils/caseLabels';
import { getApiLang } from '../i18n';
import { X, MapPin, Phone, User, Clock, Navigation, Mail, Copy, Check, ShieldCheck, Trash2, Lock } from 'lucide-react';

interface CaseDetailModalProps {
  report: StrayReport;
  ngos: NGOOrganization[];
  onClose: () => void;
  onUpdateStatus?: (reportId: string, newStatus: CaseStatus) => void;
  onDispatchToNGO?: (ngoId: string, ngoName: string) => Promise<void>;
  onDeleteCase?: (reportId: string) => void;
}

// 舊版寫入 Firestore 嘅佔位字（係資料，唔係介面文字），見到就當冇電話
const PHONE_PLACEHOLDERS = ['未填寫', '未提供 (匿名)'];

// 網址同案件編號係純文字，唔需要 HTML escape（否則 "/" 會變 "&#x2F;"）
const NO_ESCAPE = { interpolation: { escapeValue: false } } as const;

function formatDateTime(value: string | number | Date): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(getApiLang());
}

export const CaseDetailModal: React.FC<CaseDetailModalProps> = ({
  report,
  ngos,
  onClose,
  onUpdateStatus,
  onDispatchToNGO,
  onDeleteCase,
}) => {
  const { t } = useTranslation();
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

  const liveMatchedNGOs = useMemo(
    () => rankFirestoreNGOs(ngos, report.location.lat, report.location.lng, report.animalType, report.urgency).slice(0, 3),
    [ngos, report.location.lat, report.location.lng, report.animalType, report.urgency]
  );

  const reporterPhone = contactInfo?.reporterPhone;
  const hasRealPhone = !!reporterPhone && !PHONE_PLACEHOLDERS.includes(reporterPhone);

  const handleCopyTrackingLink = () => {
    const url = `${window.location.origin}/?caseId=${encodeURIComponent(report.id)}`;
    const fallback = () => alert(t('caseModal.copyManually', { url, ...NO_ESCAPE }));

    if (!navigator.clipboard?.writeText) {
      fallback();
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      })
      .catch((err) => {
        console.warn('Clipboard write failed:', err);
        fallback();
      });
  };

  const canManageStatus = isAdmin && typeof onUpdateStatus === 'function';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto" id="case-detail-modal">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between gap-2 p-4 sm:p-5 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold text-white shrink-0 ${
                report.urgency === 'P0' ? 'bg-rose-600 animate-pulse' : report.urgency === 'P1' ? 'bg-brand-500' : 'bg-emerald-600'
              }`}
            >
              {t('caseModal.caseBadge', { level: report.urgency })}
            </span>
            <h2 className="font-bold text-base sm:text-lg text-stone-900 truncate">{report.title}</h2>
            <span className="hidden sm:inline text-2xs font-mono text-stone-500 bg-stone-200/80 px-2 py-0.5 rounded shrink-0">
              #{report.id}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyTrackingLink}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 flex items-center gap-1.5 transition-colors text-2xs font-bold"
              title={t('caseModal.copyLinkTitle')}
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedLink ? t('caseModal.linkCopied') : t('caseModal.shareLink')}</span>
            </button>

            {isAdmin && onDeleteCase && (
              <button
                onClick={() => {
                  if (confirm(t('caseModal.confirmDelete', { id: report.id, ...NO_ESCAPE }))) {
                    onDeleteCase(report.id);
                    onClose();
                  }
                }}
                className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors"
                title={t('caseModal.deleteTitle')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              aria-label={t('caseModal.close')}
              className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-700 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            <div className="md:col-span-5">
              <div className="aspect-4/3 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shadow-xs">
                <img src={report.photoUrl} alt={report.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              {report.storagePath && (
                <p className="text-3xs text-stone-500 font-mono mt-1.5 truncate px-1" title={report.storagePath}>
                  ☁️ Storage: <span className="text-brand-800">{report.storagePath}</span>
                </p>
              )}
            </div>

            <div className="md:col-span-7 space-y-3">
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80 space-y-2.5 text-xs text-stone-700">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-stone-900 block">{t('caseModal.location')}</span>
                    <span>{report.location.address}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap pt-2 border-t border-stone-200/60 text-2xs">
                  {isAdmin ? (
                    <>
                      <div className="flex items-center gap-1.5 text-stone-600">
                        <User className="w-3.5 h-3.5 text-stone-400" />
                        <span>
                          {t('caseModal.reporter')}
                          <strong>
                            {loadingContact ? t('caseModal.loading') : contactInfo?.reporterName || t('caseModal.defaultReporter')}
                          </strong>
                        </span>
                      </div>

                      {hasRealPhone && (
                        <div className="flex items-center gap-1.5 text-stone-600">
                          <Phone className="w-3.5 h-3.5 text-stone-400" />
                          <a href={`tel:${reporterPhone!.replace(/[^\d+]/g, '')}`} className="text-blue-600 font-bold hover:underline">
                            {reporterPhone}
                          </a>
                        </div>
                      )}

                      {contactInfo?.reporterEmail && (
                        <div className="flex items-center gap-1.5 text-stone-600">
                          <Mail className="w-3.5 h-3.5 text-stone-400" />
                          <span className="text-stone-700 break-all">{contactInfo.reporterEmail}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 text-stone-400" title={t('caseModal.contactProtectedTitle')}>
                      <Lock className="w-3 h-3" />
                      <span>{t('caseModal.contactProtected')}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-stone-500">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    <span>{formatDateTime(report.createdAt)}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-200/60">
                  <span className="font-bold text-stone-900 block mb-1">{t('caseModal.description')}</span>
                  <p className="text-stone-600 leading-relaxed bg-white p-2.5 rounded-xl border border-stone-200/60">{report.description}</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-brand-50/60 border border-brand-200">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <span className="text-xs font-bold text-brand-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-brand-600" />
                    {t('caseModal.statusTitle')}
                  </span>
                  {canManageStatus && (
                    <span className="text-2xs bg-brand-200 text-brand-900 px-2 py-0.5 rounded-full font-bold">
                      {t('caseModal.adminCanChange')}
                    </span>
                  )}
                </div>

                {canManageStatus ? (
                  <div className="flex flex-wrap gap-2">
                    {CASE_STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => onUpdateStatus!(report.id, status)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          report.status === status
                            ? 'bg-brand-600 text-white border-brand-600 shadow-xs ring-2 ring-brand-300'
                            : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        {statusLabel(status)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-700 flex-wrap">
                    {statusLabel(report.status)}
                    <span className="text-2xs text-stone-400 font-normal">{t('caseModal.adminOnly')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-stone-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab('ai')}
              className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'ai' ? 'border-brand-600 text-brand-600' : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              {t('caseModal.tabAi')}
            </button>
            <button
              onClick={() => setActiveTab('ngos')}
              className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'ngos' ? 'border-brand-600 text-brand-600' : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              {t('caseModal.tabNgos', { n: liveMatchedNGOs.length })}
            </button>
          </div>

          {activeTab === 'ai' && (
            <div>
              {report.aiAnalysis ? (
                <AIAnalysisCard analysis={report.aiAnalysis} />
              ) : (
                <div className="p-8 text-center text-stone-500 bg-stone-50 rounded-2xl border border-stone-200 space-y-1.5">
                  <p className="text-sm font-bold text-stone-700">{t('caseModal.aiNoResponseTitle')}</p>
                  <p className="text-xs text-stone-400">{t('caseModal.aiNoResponseBody')}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ngos' && (
            <NGOMatchFeedback report={enrichedReport} matchedNGOs={liveMatchedNGOs} onDispatchToNGO={onDispatchToNGO} />
          )}
        </div>

        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-2">
          <a
            href={getGoogleMapsDirectionsUrl(report.location.lat, report.location.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-700 bg-white hover:bg-stone-100 px-3 py-2 rounded-xl border border-stone-300 transition-colors shadow-2xs"
          >
            <Navigation className="w-4 h-4 text-rose-600 shrink-0" />
            {t('caseModal.navigate')}
          </a>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-xs transition-colors shrink-0"
          >
            {t('caseModal.closeView')}
          </button>
        </div>
      </div>
    </div>
  );
};
