import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { StrayReport, CaseStatus, NGOOrganization } from './types';
import { Navbar } from './components/Navbar';
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
  fetchCaseContact,
  CASE_COLLECTION,
} from './services/caseService';
import {
  MapPin,
  CheckCircle2,
  PhoneCall,
  Mail,
  AlertTriangle,
} from 'lucide-react';

function AppContent() {
  const { isAdmin } = useAuth();
  const [reports, setReports] = useState<StrayReport[]>([]);
  const [ngos, setNgos] = useState<NGOOrganization[]>([]);
  const [currentTab, setCurrentTab] = useState<'report' | 'map' | 'cases' | 'ngos' | 'admin'>('report');
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

        if (snap.exists()) {
          const data = snap.data() as any;
          setSelectedReportForModal({
            id: snap.id,
            title: data.title || `通報 #${snap.id.slice(0, 6)}`,
            animalType: data.animalType || 'other',
            customAnimalName: data.customAnimalName,
            photoUrl: data.photoUrl || '',
            storagePath: data.storagePath || '',
            location: data.location || { lat: 22.3193, lng: 114.1694, address: '未提供地址' },
            description: data.description || '',
            reporterName: '',
            reporterPhone: '',
            reporterEmail: '',
            createdByUid: undefined,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
            status: data.status || 'pending',
            urgency: data.urgency || 'P1',
            geminiResponse: data.geminiResponse || data.aiAnalysis || null,
            aiAnalysis: data.aiAnalysis || data.geminiResponse || null,
            matchedNGOs: data.matchedNGOs,
            dispatchedToNGO: data.dispatchedToNGO,
          });
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

      setReports((prev) => [newReport, ...prev.filter((r) => r.id !== newReport.id)]);
      setJustSubmittedReport(newReport);

      if (newReport.reporterEmail) {
        try {
          const emailRes = await fetch('/api/cases/send-confirmation-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              caseId: newReport.id,
              reporterEmail: newReport.reporterEmail,
              reporterName: newReport.reporterName,
              animalType: newReport.animalType,
              urgency: newReport.urgency,
              location: newReport.location,
            }),
          });

          if (emailRes.ok) {
            setEmailConfirmationBanner({
              caseId: newReport.id,
              email: newReport.reporterEmail,
            });
          } else {
            console.warn('Confirmation email API returned non-OK status:', emailRes.status);
          }
        } catch (emailError) {
          console.warn('Confirmation email request failed:', emailError);
        }
      }

      return true;
    } catch (e) {
      console.error('Failed to create case in Firestore:', e);
      setSubmitErrorBanner(
        '通報提交失敗，個案尚未成功儲存。請檢查網絡連線後重試；如情況危急，請直接致電 SPCA 24 小時熱線 2711 1000。'
      );
      return false;
    }
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

  const handleDispatchToNGO = async (ngoId: string, ngoName: string) => {
    const targetReport = selectedReportForModal || justSubmittedReport;
    if (!targetReport) return;

    // ⚠️ 核心修正：審核舊案件時（selectedReportForModal 嚟自 subscribeToCases()），
    // reporterName / reporterPhone 已經喺私隱分層後被強制清空為空字串。
    // 若唔補救，寄去 /api/ngo/notify 嘅通知會帶住空白電話，令 NGO 完全
    // 攞唔到報案人嘅真正聯絡方法。因此如果偵測到電話為空且目前使用者係
    // admin，先向 /case/{caseId}/private/contact 補抓真實資料。
    // （justSubmittedReport 路徑本身已經帶住真實電話，呢個 fetch 唔會觸發。）
    let reporterName = targetReport.reporterName;
    let reporterPhone = targetReport.reporterPhone;

    if (isAdmin && !reporterPhone) {
      const contact = await fetchCaseContact(targetReport.id);
      if (contact) {
        reporterName = contact.reporterName || reporterName;
        reporterPhone = contact.reporterPhone || reporterPhone;
      }
    }

    try {
      const res = await fetch('/api/ngo/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: targetReport.id,
          ngoId,
          ngoName,
          reporterName,
          reporterPhone,
          urgency: targetReport.urgency,
          location: targetReport.location,
        }),
      });

      if (!res.ok) {
        alert('通知 NGO 失敗，請稍後再試或直接致電 NGO 熱線。');
        return;
      }

      const receipt = await res.json();
      const dispatchPayload = {
        ngoId,
        ngoName,
        dispatchedAt: receipt.dispatchedAt,
        status: 'acknowledged' as const,
        simulated: !!receipt.simulated,
      };

      if (isAdmin) {
        setReports((prev) =>
          prev.map((r) =>
            r.id === targetReport.id
              ? { ...r, status: 'in_progress', dispatchedToNGO: dispatchPayload }
              : r
          )
        );
        if (selectedReportForModal?.id === targetReport.id) {
          setSelectedReportForModal((prev) =>
            prev ? { ...prev, status: 'in_progress', dispatchedToNGO: dispatchPayload } : null
          );
        }
        if (justSubmittedReport?.id === targetReport.id) {
          setJustSubmittedReport((prev) =>
            prev ? { ...prev, status: 'in_progress', dispatchedToNGO: dispatchPayload } : null
          );
        }

        try {
          await updateCaseStatusInFirestore(targetReport.id, 'in_progress', dispatchPayload);
        } catch (persistErr) {
          console.error('Failed to persist dispatch status:', persistErr);
        }
      }
    } catch (err) {
      console.error('Dispatch error:', err);
      alert('通知 NGO 時發生錯誤，請稍後再試。');
    }
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

  return (
    <div className="min-h-screen bg-orange-50/80 text-stone-900 flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenGuide={() => setShowGuideModal(true)}
        urgentCount={urgentCount}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {submitErrorBanner && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-600 text-white shadow-md flex items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{submitErrorBanner}</span>
            </div>
            <button onClick={() => setSubmitErrorBanner(null)} className="text-white font-bold px-2 py-1 cursor-pointer">✕</button>
          </div>
        )}

        {emailConfirmationBanner && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-600 text-white shadow-md flex items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2.5">
              <Mail className="w-5 h-5 text-emerald-200 shrink-0" />
              <span>
                <strong>通報立案成功！</strong> 個案編號 <code>#{emailConfirmationBanner.caseId}</code> 已同步寄發確認信與進度追蹤連結至 <strong>{emailConfirmationBanner.email}</strong>。
              </span>
            </div>
            <button onClick={() => setEmailConfirmationBanner(null)} className="text-white hover:text-emerald-200 font-bold px-2 py-1 cursor-pointer">✕</button>
          </div>
        )}

        {urgentCount > 0 && currentTab !== 'cases' && (
          <div className="mb-6 p-3.5 px-4 rounded-2xl bg-rose-600 text-white shadow-md flex items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
              <span className="font-bold tracking-wide">
                目前有 {urgentCount} 宗 P0 極度危急傷病動物通報，急需救助隊馳援！
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a href="tel:27111000" className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-rose-800 hover:bg-rose-900 text-white font-bold text-xs">
                <PhoneCall className="w-3.5 h-3.5 text-rose-300" />
                SPCA 24h 熱線
              </a>
              <button onClick={() => setCurrentTab('cases')} className="px-3 py-1 rounded-xl bg-white text-rose-700 font-bold hover:bg-rose-50 transition-colors shrink-0 text-xs cursor-pointer">
                檢視危急個案 →
              </button>
            </div>
          </div>
        )}

        {currentTab === 'report' && (
          <div className="space-y-6">
            {justSubmittedReport ? (
              <div className="space-y-6" id="report-success-view">
                <div className="bg-emerald-500/10 border border-emerald-300 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base sm:text-lg text-emerald-950">
                        通報成功並存入雲端！個案編號：{justSubmittedReport.id}
                      </h3>
                      <p className="text-xs text-emerald-900 mt-0.5">
                        照片已妥善儲存至 Cloud Storage，Gemini 多模態 AI 已完成傷病評估，並已自動匹配鄰近合適 NGO 救助隊。
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button onClick={() => handleNavigateToMap(justSubmittedReport.location)} className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 text-white hover:bg-stone-800 text-xs font-bold transition-colors shadow-xs cursor-pointer">
                      <MapPin className="w-4 h-4 text-rose-400" />
                      在地圖查看位置
                    </button>
                    <button onClick={() => setJustSubmittedReport(null)} className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-bold transition-colors shadow-2xs cursor-pointer">
                      通報新個案
                    </button>
                  </div>
                </div>

                {justSubmittedReport.aiAnalysis ? (
                  <AIAnalysisCard analysis={justSubmittedReport.aiAnalysis} />
                ) : (
                  <div className="bg-stone-50 border border-stone-200 rounded-3xl p-5 text-center text-stone-500 space-y-1">
                    <p className="text-sm font-bold text-stone-700">Gemini 沒有回應</p>
                    <p className="text-xs text-stone-400">未能取得 AI 傷病分析報告，個案已妥善存立並直接匹配周邊救助隊。</p>
                  </div>
                )}

                <NGOMatchFeedback
                  report={justSubmittedReport}
                  matchedNGOs={justSubmittedReport.matchedNGOs || []}
                  onDispatchToNGO={handleDispatchToNGO}
                />
              </div>
            ) : (
              <div className="max-w-3xl mx-auto">
                <ReportForm ngos={ngos} onSubmitReport={handleCreateReport} />
              </div>
            )}
          </div>
        )}

        {currentTab === 'map' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-stone-900">全港流浪動物救援即時地圖 (Firestore 實時同步)</h2>
                <p className="text-xs text-stone-500">即時標註待救援貓狗個案（紅：P0危急／橙：P1醫療／綠：P2穩定）與 NGO 庇護站位置</p>
              </div>
              <button onClick={() => setCurrentTab('report')} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 text-white font-bold text-xs shadow-xs hover:bg-amber-600 transition-colors cursor-pointer">
                + 即時通報新個案
              </button>
            </div>
            <InteractiveMap
              reports={reports}
              ngos={ngos}
              selectedReportId={selectedReportForModal?.id}
              onSelectReport={(report) => setSelectedReportForModal(report)}
              centerCoords={mapCenter}
            />
          </div>
        )}

        {currentTab === 'cases' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-stone-900">通報個案動態與救援進度 ({reports.length} 宗 · 實時雲端共享)</h2>
                <p className="text-xs text-stone-500">全體市民與救援機構共享動態牆，任何新通報與狀態變更將即時同步</p>
              </div>
              <button onClick={() => setCurrentTab('report')} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 text-white font-bold text-xs shadow-xs hover:bg-amber-600 transition-colors cursor-pointer">
                + 我要通報
              </button>
            </div>
            <CaseFeed reports={reports} onSelectReport={(report) => setSelectedReportForModal(report)} onNavigateToMap={handleNavigateToMap} />
          </div>
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

      <footer className="bg-white border-t border-stone-200 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-stone-500 space-y-2">
          <div className="flex items-center justify-center gap-2 text-stone-700 font-bold">
            <span>PawPulse 流浪動物即時通報與救助媒合系統</span>
            <span>·</span>
            <span>Firebase 雲端持久化 × Google Gemini 多模態 AI</span>
          </div>
          <p className="max-w-xl mx-auto text-stone-400">
            依照香港《個人資料（私隱）條例》保護通報者私隱。若遇嚴重緊急車禍或瀕危動物，請同時致電 SPCA 24 小時熱線 2711 1000。
          </p>
        </div>
      </footer>

      {selectedReportForModal && (
        <CaseDetailModal
          report={selectedReportForModal}
          onClose={() => setSelectedReportForModal(null)}
          onUpdateStatus={isAdmin ? handleUpdateStatus : undefined}
          onDispatchToNGO={handleDispatchToNGO}
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
