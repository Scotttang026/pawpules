import React, { useState, useEffect } from 'react';
import { StrayReport, CaseStatus } from './types';
import { SAMPLE_CASES } from './data/sampleCases';
import { Navbar } from './components/Navbar';
import { ReportForm } from './components/ReportForm';
import { AIAnalysisCard } from './components/AIAnalysisCard';
import { NGOMatchFeedback } from './components/NGOMatchFeedback';
import { InteractiveMap } from './components/InteractiveMap';
import { CaseFeed } from './components/CaseFeed';
import { NGODirectory } from './components/NGODirectory';
import { CaseDetailModal } from './components/CaseDetailModal';
import { EmergencyGuideModal } from './components/EmergencyGuideModal';
import { Sparkles, MapPin, CheckCircle2, ArrowRight, ShieldAlert, HeartHandshake, PhoneCall } from 'lucide-react';

const STORAGE_KEY = 'pawpulse_reports_v1';

export default function App() {
  const [reports, setReports] = useState<StrayReport[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load local reports:', e);
    }
    return SAMPLE_CASES;
  });

  const [currentTab, setCurrentTab] = useState<'report' | 'map' | 'cases' | 'ngos'>('report');
  const [selectedReportForModal, setSelectedReportForModal] = useState<StrayReport | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [justSubmittedReport, setJustSubmittedReport] = useState<StrayReport | null>(null);

  // Sync reports to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
    } catch (e) {
      console.warn('Failed to save reports:', e);
    }
  }, [reports]);

  // Urgent count (P0)
  const urgentCount = reports.filter((r) => r.urgency === 'P0' && r.status !== 'rescued').length;

  // Handler: when user creates new report
  const handleCreateReport = (newReport: StrayReport) => {
    setReports((prev) => [newReport, ...prev]);
    setJustSubmittedReport(newReport);
  };

  // Handler: volunteer updates case status
  const handleUpdateStatus = (reportId: string, newStatus: CaseStatus) => {
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
    );
    if (selectedReportForModal && selectedReportForModal.id === reportId) {
      setSelectedReportForModal((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    if (justSubmittedReport && justSubmittedReport.id === reportId) {
      setJustSubmittedReport((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  // Handler: dispatch report to NGO
  const handleDispatchToNGO = async (ngoId: string, ngoName: string) => {
    const targetReport = selectedReportForModal || justSubmittedReport;
    if (!targetReport) return;

    try {
      const res = await fetch('/api/ngo/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: targetReport.id,
          ngoId,
          ngoName,
          reporterName: targetReport.reporterName,
          reporterPhone: targetReport.reporterPhone,
          urgency: targetReport.urgency,
          location: targetReport.location,
        }),
      });

      if (res.ok) {
        const receipt = await res.json();
        const dispatchPayload = {
          ngoId,
          ngoName,
          dispatchedAt: receipt.dispatchedAt,
          status: 'acknowledged' as const,
        };

        setReports((prev) =>
          prev.map((r) =>
            r.id === targetReport.id
              ? { ...r, status: 'in_progress', dispatchedToNGO: dispatchPayload }
              : r
          )
        );

        if (selectedReportForModal && selectedReportForModal.id === targetReport.id) {
          setSelectedReportForModal((prev) =>
            prev ? { ...prev, status: 'in_progress', dispatchedToNGO: dispatchPayload } : null
          );
        }
        if (justSubmittedReport && justSubmittedReport.id === targetReport.id) {
          setJustSubmittedReport((prev) =>
            prev ? { ...prev, status: 'in_progress', dispatchedToNGO: dispatchPayload } : null
          );
        }
      }
    } catch (err) {
      console.error('Dispatch error:', err);
    }
  };

  // Navigate to map from feed
  const handleNavigateToMap = (coords: { lat: number; lng: number }) => {
    setMapCenter(coords);
    setCurrentTab('map');
  };

  return (
    <div className="min-h-screen bg-orange-50/80 text-stone-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'report') {
            // keep or reset as needed
          }
        }}
        onOpenGuide={() => setShowGuideModal(true)}
        urgentCount={urgentCount}
      />

      {/* Main App Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* P0 Urgent Alert Banner if there are active P0 cases */}
        {urgentCount > 0 && currentTab !== 'cases' && (
          <div className="mb-6 p-3.5 px-4 rounded-2xl bg-rose-600 text-white shadow-md flex items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
              <span className="font-bold tracking-wide">
                目前有 {urgentCount} 宗 P0 極度危急傷病動物通報，急需救助隊馳援！
              </span>
            </div>
            <button
              onClick={() => setCurrentTab('cases')}
              className="px-3 py-1 rounded-xl bg-white text-rose-700 font-bold hover:bg-rose-50 transition-colors shrink-0 text-xs"
            >
              檢視危急個案 →
            </button>
          </div>
        )}

        {/* Tab 1: REPORT VIEW */}
        {currentTab === 'report' && (
          <div className="space-y-6">
            {justSubmittedReport ? (
              /* Success & Live AI/NGO Feedback View */
              <div className="space-y-6" id="report-success-view">
                <div className="bg-emerald-500/10 border border-emerald-300 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base sm:text-lg text-emerald-950">
                        通報成功！個案編號：{justSubmittedReport.id}
                      </h3>
                      <p className="text-xs text-emerald-900 mt-0.5">
                        Gemini 多模態 AI 已完成傷病評估，並已自動匹配鄰近合適 NGO 救助隊。
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleNavigateToMap(justSubmittedReport.location)}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 text-white hover:bg-stone-800 text-xs font-bold transition-colors shadow-xs"
                    >
                      <MapPin className="w-4 h-4 text-rose-400" />
                      在地圖查看位置
                    </button>
                    <button
                      onClick={() => setJustSubmittedReport(null)}
                      className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-bold transition-colors shadow-2xs"
                    >
                      通報新個案
                    </button>
                  </div>
                </div>

                {/* AI Analysis Diagnostic Display */}
                {justSubmittedReport.aiAnalysis && (
                  <AIAnalysisCard analysis={justSubmittedReport.aiAnalysis} />
                )}

                {/* Matched NGO Organizations & Emergency Contact Feedback */}
                <NGOMatchFeedback
                  report={justSubmittedReport}
                  matchedNGOs={justSubmittedReport.matchedNGOs || []}
                  onDispatchToNGO={handleDispatchToNGO}
                />
              </div>
            ) : (
              /* Report Input Form */
              <div className="max-w-3xl mx-auto">
                <ReportForm onSubmitReport={handleCreateReport} />
              </div>
            )}
          </div>
        )}

        {/* Tab 2: MAP VIEW */}
        {currentTab === 'map' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-stone-900">
                  全港流浪動物救援即時地圖
                </h2>
                <p className="text-xs text-stone-500">
                  即時標註待救援貓狗個案（紅：P0危急／橙：P1醫療／綠：P2穩定）與 NGO 庇護站位置
                </p>
              </div>

              <button
                onClick={() => setCurrentTab('report')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 text-white font-bold text-xs shadow-xs hover:bg-amber-600 transition-colors"
              >
                + 即時通報新個案
              </button>
            </div>

            <InteractiveMap
              reports={reports}
              selectedReportId={selectedReportForModal?.id}
              onSelectReport={(report) => setSelectedReportForModal(report)}
              centerCoords={mapCenter}
            />
          </div>
        )}

        {/* Tab 3: CASES FEED */}
        {currentTab === 'cases' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-stone-900">
                  通報個案動態與救援進度 ({reports.length} 宗)
                </h2>
                <p className="text-xs text-stone-500">
                  市民通報、AI 診斷要點、配對機構與志工出勤狀態即時匯整
                </p>
              </div>

              <button
                onClick={() => setCurrentTab('report')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 text-white font-bold text-xs shadow-xs hover:bg-amber-600 transition-colors"
              >
                + 我要通報
              </button>
            </div>

            <CaseFeed
              reports={reports}
              onSelectReport={(report) => setSelectedReportForModal(report)}
              onNavigateToMap={handleNavigateToMap}
            />
          </div>
        )}

        {/* Tab 4: NGO DIRECTORY */}
        {currentTab === 'ngos' && <NGODirectory />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-stone-500 space-y-2">
          <div className="flex items-center justify-center gap-2 text-stone-700 font-bold">
            <span>PawPulse 流浪動物即時通報與救助媒合系統</span>
            <span>·</span>
            <span>Google Gemini 多模態 AI 驅動</span>
          </div>
          <p className="max-w-xl mx-auto text-stone-400">
            旨在加快市民即時通報流浪／受傷動物反應速度，自動媒合鄰近合適 NGO，降低義工盲目搜尋時間。若遇嚴重緊急動物車禍危難，請同時直接撥打熱線電話。
          </p>
        </div>
      </footer>

      {/* Case Detail Inspection Modal */}
      {selectedReportForModal && (
        <CaseDetailModal
          report={selectedReportForModal}
          onClose={() => setSelectedReportForModal(null)}
          onUpdateStatus={handleUpdateStatus}
          onDispatchToNGO={handleDispatchToNGO}
        />
      )}

      {/* Citizen Emergency Guide Modal */}
      {showGuideModal && (
        <EmergencyGuideModal onClose={() => setShowGuideModal(false)} />
      )}
    </div>
  );
}
