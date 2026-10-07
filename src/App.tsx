import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { StrayReport, CaseStatus, NGOOrganization } from './types';
import { Sidebar, AppTab } from './components/Sidebar';
import { ReportForm } from './components/ReportForm';
import { AIAnalysisCard } from './components/AIAnalysisCard';
import { NGOMatchFeedback } from './components/NGOMatchFeedback';
import { InteractiveMap } from './components/InteractiveMap';
import { CaseFeed } from './components/CaseFeed';
import { NGODirectory } from './components/NGODirectory';
import { AdminDashboard } from './components/AdminDashboard';
import { CaseDetailModal } from './components/CaseDetailModal';
import { EmergencyGuideModal } from './components/EmergencyGuideModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import {
  subscribeToCases,
  createCaseInFirestore,
  updateCaseStatusInFirestore,
  deleteCaseInFirestore,
  subscribeToNGOs,
  createNGOInFirestore,
  deleteNGOInFirestore,
  updateNGOCapacity,
  rankFirestoreNGOs,
  docToReport,
  CASE_COLLECTION,
} from './services/caseService';
import { getEmergencyContact, getEmergencyHint, telHref } from './config/emergency';
import { apiFetch } from './services/api';
import { getBrowserLanguage } from './utils/locale';
import {
  MapPin,
  CheckCircle2,
  PhoneCall,
  Mail,
  AlertTriangle,
  Plus,
  X,
} from 'lucide-react';

const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '');

function AppContent() {
  const { isAdmin } = useAuth();
  const emergency = getEmergencyContact();
  const [reports, setReports] = useState<StrayReport[]>([]);
  const [ngos, setNgos] = useState<NGOOrganization[]>([]);
  const [currentTab, setCurrentTab] = useState<AppTab>('report');
  const [selectedReportForModal, setSelectedReportForModal] = useState<StrayReport | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [justSubmittedReport, setJustSubmittedReport] = useState<StrayReport | null>(null);
  const [emailConfirmationBanner, setEmailConfirmationBanner] = useState<{ caseId: string; email: string } | null>(null);
  const [submitErrorBanner, setSubmitErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeCases = subscribeToCases(
      (updatedCases) => setReports(updatedCases),
      (err) => console.warn('Real-time cases sync warning:', err)
    );

    const unsubscribeNGOs = subscribeToNGOs(
      (updatedNGOs) => setNgos(updatedNGOs),
      (err) => console.warn('Real-time NGOs sync warning:', err)
    );

    return () => {
      unsubscribeCases();
      unsubscribeNGOs();
    };
  }, []);

  // 追蹤連結：只喺頁面載入時處理一次，開完 modal 即刻清走網址上的 ?caseId=，
  // 避免之後每次 Firestore 同步都將已關閉的 modal 重新彈出。
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const caseId = params.get('caseId');
    if (!caseId) return;

    let cancelled = false;

    (async () => {
      try {
        const snap = await getDoc(doc(db, CASE_COLLECTION, caseId));
        if (cancelled) return;

        const r = snap.exists() ? docToReport(snap.id, snap.data()) : null;
        if (r) {
          setSelectedReportForModal(r);
        } else {
          alert(`找不到案件 #${caseId}，可能已被刪除或連結有誤。`);
        }
      } catch (err) {
        console.warn('Direct case lookup by tracking link failed:', err);
      } finally {
        if (!cancelled) {
          params.delete('caseId');
          const qs = params.toString();
          window.history.replaceState(
            null,
            '',
            window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);


  const urgentCount = reports.filter((r) => r.urgency === 'P0' && r.status !== 'rescued' && r.status !== 'closed').length;

    const handleCreateReport = async (newReport: StrayReport): Promise<boolean> => {
    setSubmitErrorBanner(null);

    try {
      await createCaseInFirestore(newReport);
    } catch (e) {
      console.error('Failed to create case in Firestore:', e);
      setSubmitErrorBanner(`通報提交失敗，個案尚未成功儲存。請檢查網絡連線後重試；如情況危急，${getEmergencyHint()}。`);
      return false;
    }

    // 案件已儲存，再請 server 做 AI 分析；失敗都唔影響報案（維持 P1）
    let finalReport = newReport;
    try {
      const aiRes = await apiFetch(`/api/cases/${encodeURIComponent(newReport.id)}/analyze`, {
        method: 'POST',
        body: JSON.stringify({ lang: getBrowserLanguage() }),
      });
      if (aiRes.ok) {
        const data = await aiRes.json();
        if (data?.analysis && ['P0', 'P1', 'P2'].includes(data.urgency)) {
          finalReport = {
            ...newReport,
            urgency: data.urgency,
            aiAnalysis: data.analysis,
            geminiResponse: data.analysis,
            matchedNGOs: rankFirestoreNGOs(
              ngos, newReport.location.lat, newReport.location.lng, newReport.animalType, data.urgency
            ).slice(0, 3),
          };
        }
      }
    } catch (aiErr) {
      console.warn('AI analysis request failed:', aiErr);
    }

    setReports((prev) => [finalReport, ...prev.filter((r) => r.id !== finalReport.id)]);
    setJustSubmittedReport(finalReport);

    if (newReport.reporterEmail) {
      try {
        const emailRes = await apiFetch('/api/cases/send-confirmation-email', {
          method: 'POST',
          body: JSON.stringify({ caseId: newReport.id }),
        });
        if (emailRes.ok) {
          setEmailConfirmationBanner({ caseId: newReport.id, email: newReport.reporterEmail });
        } else {
          console.warn('Confirmation email API returned non-OK status:', emailRes.status);
        }
      } catch (emailError) {
        console.warn('Confirmation email request failed:', emailError);
      }
    }

    return true;
  };

  const handleUpdateStatus = async (reportId: string, newStatus: CaseStatus) => {
    const previousReports = reports;
    const previousSelected = selectedReportForModal;
    const previousJustSubmitted = justSubmittedReport;

    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r)));
    if (selectedReportForModal?.id === reportId) {
      setSelectedReportForModal((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    if (justSubmittedReport?.id === reportId) {
      setJustSubmittedReport((prev) => (prev ? { ...prev, status: newStatus } : null));
    }

    try {
      await updateCaseStatusInFirestore(reportId, newStatus);
    } catch (e) {
      console.error('Failed to update case status in Firestore:', e);
      setReports(previousReports);
      setSelectedReportForModal(previousSelected);
      setJustSubmittedReport(previousJustSubmitted);
      alert('狀態更新失敗，可能因為權限不足或網絡問題，畫面已還原。');
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    const previousReports = reports;
    const wasModalOpen = selectedReportForModal?.id === caseId;

    setReports((prev) => prev.filter((r) => r.id !== caseId));
    if (wasModalOpen) {
      setSelectedReportForModal(null);
    }

    try {
      await deleteCaseInFirestore(caseId);
    } catch (e) {
      console.error('Failed to delete case in Firestore:', e);
      setReports(previousReports);
      alert('刪除失敗，可能因為權限不足，個案已還原。');
    }
  };

  const handleCreateNGO = async (newNGO: NGOOrganization) => {
    const previousNgos = ngos;
    setNgos((prev) => [...prev, newNGO]);
    try {
      await createNGOInFirestore(newNGO);
    } catch (e) {
      console.error('Failed to save NGO to Firestore:', e);
      setNgos(previousNgos);
      alert('新增 NGO 失敗，可能因為權限不足。');
    }
  };

  const handleDeleteNGO = async (ngoId: string) => {
    const previousNgos = ngos;
    setNgos((prev) => prev.filter((n) => n.id !== ngoId));
    try {
      await deleteNGOInFirestore(ngoId);
    } catch (e) {
      console.error('Failed to delete NGO from Firestore:', e);
      setNgos(previousNgos);
      alert('刪除 NGO 失敗，可能因為權限不足。');
    }
  };

    const handleDispatchToNGO = async (ngoId: string, _ngoName: string) => {
    const targetReport = selectedReportForModal || justSubmittedReport;
    if (!targetReport) return;

    // 聯絡資料、機構名同權限全部由 server 處理，前端只傳案件同機構編號
    const res = await apiFetch('/api/ngo/notify', {
      method: 'POST',
      body: JSON.stringify({ reportId: targetReport.id, ngoId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || '通知 NGO 失敗，請稍後再試或直接致電 NGO 熱線。');
    }

    const receipt = await res.json();
    const newStatus: CaseStatus =
      isAdmin && targetReport.status === 'pending' ? 'in_progress' : targetReport.status;
    const patch = (r: StrayReport): StrayReport =>
      r.id === targetReport.id ? { ...r, status: newStatus, dispatchedToNGO: receipt.dispatchedToNGO } : r;

    setReports((prev) => prev.map(patch));
    setSelectedReportForModal((prev) => (prev ? patch(prev) : null));
    setJustSubmittedReport((prev) => (prev ? patch(prev) : null));
  };

  const handleUpdateNGOCapacity = async (ngoId: string, capacity: 'available' | 'busy' | 'full') => {
    const previousNgos = ngos;
    setNgos((prev) => prev.map((n) => (n.id === ngoId ? { ...n, capacityStatus: capacity } : n)));
    try {
      await updateNGOCapacity(ngoId, capacity);
    } catch (e) {
      console.error('Failed to update NGO capacity in Firestore:', e);
      setNgos(previousNgos);
    }
  };

  const handleNavigateToMap = (coords: { lat: number; lng: number }) => {
    setMapCenter(coords);
    setCurrentTab('map');
  };

  const pageMeta: Record<AppTab, { title: string; subtitle: string }> = {
    report: { title: '我要通報', subtitle: '影相上載，AI 即時評估傷勢並配對附近 NGO' },
    map: { title: '救援地圖', subtitle: '即時顯示待救援個案（P0 危急／P1 醫療／P2 穩定）同 NGO 位置' },
    cases: { title: '個案動態', subtitle: `共 ${reports.length} 宗 · 實時同步` },
    ngos: { title: '合作機構', subtitle: `${ngos.length} 間救助機構及熱線` },
    admin: { title: '後台管理', subtitle: '個案調度、NGO 容量同系統紀錄' },
  };
  const meta = pageMeta[currentTab];

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenGuide={() => setShowGuideModal(true)}
        urgentCount={urgentCount}
      />

      <div className="md:pl-20 md:py-3 md:pr-3 min-h-screen flex flex-col">
        <div className="flex-1 flex flex-col bg-white md:rounded-2xl md:border md:border-stone-200 md:shadow-sm overflow-hidden">
          {/* 頂部標題列 */}
          <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-stone-200">
            <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight truncate">{meta.title}</h1>
                <p className="text-xs text-stone-500 truncate">{meta.subtitle}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {urgentCount > 0 && currentTab !== 'cases' && (
                  <button
                    onClick={() => setCurrentTab('cases')}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    <span className="relative flex w-2 h-2">
                      <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-75" />
                      <span className="relative w-2 h-2 rounded-full bg-rose-600" />
                    </span>
                    <span className="hidden sm:inline">{urgentCount} 宗 P0 危急</span>
                    <span className="sm:hidden">{urgentCount}</span>
                  </button>
                )}
                {emergency && (
                  <a
                    href={telHref(emergency.phone)}
                    className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium hover:bg-stone-50 transition-colors"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-brand-500" />
                    {emergency.name}
                  </a>
                )}
                {currentTab !== 'report' && currentTab !== 'admin' && (
                  <button
                    onClick={() => setCurrentTab('report')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">新通報</span>
                  </button>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
            {submitErrorBanner && (
              <div className="mb-6 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 flex items-start justify-between gap-3 text-sm">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 mt-0.5 text-rose-600 shrink-0" />
                  <span>{submitErrorBanner}</span>
                </div>
                <button onClick={() => setSubmitErrorBanner(null)} className="text-rose-400 hover:text-rose-700 cursor-pointer" aria-label="關閉">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {emailConfirmationBanner && (
              <div className="mb-6 p-4 rounded-xl border border-stone-200 bg-stone-50 flex items-start justify-between gap-3 text-sm">
                <div className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 mt-0.5 text-brand-500 shrink-0" />
                  <span className="text-stone-700">
                    確認信已寄出：個案 <code className="font-mono text-stone-900">#{emailConfirmationBanner.caseId}</code> 嘅追蹤連結已寄去 <strong className="text-stone-900">{emailConfirmationBanner.email}</strong>。
                  </span>
                </div>
                <button onClick={() => setEmailConfirmationBanner(null)} className="text-stone-400 hover:text-stone-700 cursor-pointer" aria-label="關閉">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {currentTab === 'report' && (
              <div className="space-y-6">
                {justSubmittedReport ? (
                  <div className="space-y-6" id="report-success-view">
                    <div className="rounded-2xl border border-stone-200 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-brand-500 text-white flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-base">通報成功 · {justSubmittedReport.id}</h3>
                          <p className="text-xs text-stone-500 mt-0.5">
                            相片已儲存，AI 已完成傷勢評估，並配對咗附近合適嘅 NGO。
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button onClick={() => handleNavigateToMap(justSubmittedReport.location)} className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-stone-900 text-white hover:bg-black text-xs font-medium transition-colors cursor-pointer">
                          <MapPin className="w-4 h-4" />
                          喺地圖睇位置
                        </button>
                        <button onClick={() => setJustSubmittedReport(null)} className="flex-1 sm:flex-initial px-4 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-medium transition-colors cursor-pointer">
                          通報新個案
                        </button>
                      </div>
                    </div>

                    {justSubmittedReport.aiAnalysis ? (
                      <AIAnalysisCard analysis={justSubmittedReport.aiAnalysis} />
                    ) : (
                      <div className="rounded-2xl border border-dashed border-stone-300 p-5 text-center space-y-1">
                        <p className="text-sm font-medium text-stone-700">Gemini 冇回應</p>
                        <p className="text-xs text-stone-400">未能取得 AI 傷勢分析，個案已經儲存，並直接配對附近救助隊。</p>
                      </div>
                    )}

                    <NGOMatchFeedback
                      report={justSubmittedReport}
                      matchedNGOs={justSubmittedReport.matchedNGOs || []}
                      onDispatchToNGO={handleDispatchToNGO}
                    />
                  </div>
                ) : (
                  <div className="max-w-6xl mx-auto">
                    <ReportForm ngos={ngos} onSubmitReport={handleCreateReport} />
                  </div>
                )}
              </div>
            )}

            {currentTab === 'map' && (
              <InteractiveMap
                reports={reports}
                ngos={ngos}
                selectedReportId={selectedReportForModal?.id}
                onSelectReport={(report) => setSelectedReportForModal(report)}
                centerCoords={mapCenter}
              />
            )}

            {currentTab === 'cases' && (
              <CaseFeed reports={reports} onSelectReport={(report) => setSelectedReportForModal(report)} onNavigateToMap={handleNavigateToMap} />
            )}

            {currentTab === 'ngos' && (
              <NGODirectory ngos={ngos} onUpdateCapacity={handleUpdateNGOCapacity} />
            )}

            {currentTab === 'admin' && (
              <AdminDashboard
                reports={reports}
                ngos={ngos}
                onUpdateCaseStatus={handleUpdateStatus}
                onDeleteCase={handleDeleteCase}
                onUpdateNGOCapacity={handleUpdateNGOCapacity}
                onCreateNGO={handleCreateNGO}
                onDeleteNGO={handleDeleteNGO}
              />
            )}
          </main>

          <footer className="border-t border-stone-200 px-4 sm:px-6 lg:px-8 py-4 mb-16 md:mb-0 text-2xs text-stone-400 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span>PawPulse · 流浪動物即時通報與救助媒合</span>
            <span>我哋按適用嘅個人資料保護法例處理通報者資料。若遇嚴重車禍或瀕危動物，{getEmergencyHint()}。</span>
          </footer>
        </div>
      </div>

      {selectedReportForModal && (
        <CaseDetailModal
          report={selectedReportForModal}
          ngos={ngos}
          onClose={() => setSelectedReportForModal(null)}
          onUpdateStatus={isAdmin ? handleUpdateStatus : undefined}
          onDispatchToNGO={isAdmin ? handleDispatchToNGO : undefined}
          onDeleteCase={isAdmin ? handleDeleteCase : undefined}
        />
      )}

      {showGuideModal && <EmergencyGuideModal onClose={() => setShowGuideModal(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
