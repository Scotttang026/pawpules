import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Clock, Building2, ChevronRight, Plus, Loader2, MapPin, AlertTriangle } from 'lucide-react';
import type { StrayReport, CaseStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToMyCaseIds } from '../services/caseService';
import { statusLabel, urgencyLabel, animalLabel } from '../utils/caseLabels';
import { getApiLang } from '../i18n';

interface MyCasesProps {
  reports: StrayReport[];
  onSelectReport: (report: StrayReport) => void;
  onNewReport: () => void;
}

const STATUS_BADGE_CLASS: Record<CaseStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-sky-100 text-sky-800',
  rescued: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-stone-200 text-stone-700',
};

const URGENCY_BADGE_CLASS: Record<string, string> = {
  P0: 'bg-rose-600 text-white',
  P1: 'bg-orange-100 text-orange-800',
  P2: 'bg-stone-100 text-stone-700',
};

// createdAt 可能係 ISO 字串、數字或者 Firestore Timestamp，全部兼容
function toMillis(value: unknown): number {
  if (typeof value === 'string' || typeof value === 'number') {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
}

function formatTime(value: unknown): string {
  const ms = toMillis(value);
  if (!ms) return '--';
  try {
    return new Intl.DateTimeFormat(getApiLang(), { dateStyle: 'medium', timeStyle: 'short' }).format(ms);
  } catch {
    return new Date(ms).toLocaleString();
  }
}

export default function MyCases({ reports, onSelectReport, onNewReport }: MyCasesProps) {
  // 一定要 call useTranslation，轉語言時 statusLabel() 等先會即刻更新
  const { t } = useTranslation();
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [caseIds, setCaseIds] = useState<string[] | null>(null); // null = 載入中
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setCaseIds(null);
    setLoadFailed(false);
    if (!uid) return;
    const unsubscribe = subscribeToMyCaseIds(
      uid,
      (ids) => setCaseIds(ids),
      () => {
        setLoadFailed(true);
        setCaseIds([]);
      },
    );
    return unsubscribe;
  }, [uid]);

  // 用公開案件列表配對 ID；案件被刪咗就自動唔顯示
  const myReports = useMemo(() => {
    if (!caseIds || caseIds.length === 0) return [];
    const idSet = new Set(caseIds);
    return reports
      .filter((r) => idSet.has(r.id))
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  }, [reports, caseIds]);

  if (!uid) return null;

  if (caseIds === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-stone-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t('myCases.loading')}
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        {t('myCases.loadFailed')}
      </div>
    );
  }

  if (myReports.length === 0) {
    return (
      <div className="flex flex-col items-center text-center gap-3 rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-14">
        <ClipboardList className="w-10 h-10 text-stone-300" />
        <h3 className="text-base font-bold text-stone-800">{t('myCases.emptyTitle')}</h3>
        <p className="max-w-sm text-sm text-stone-500">{t('myCases.emptyBody')}</p>
        <button
          type="button"
          onClick={onNewReport}
          className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-stone-950 hover:bg-brand-600 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t('myCases.newReport')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-stone-600">{t('myCases.count', { n: myReports.length })}</p>
        <button
          type="button"
          onClick={onNewReport}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-bold text-stone-950 hover:bg-brand-600 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t('myCases.newReport')}
        </button>
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {myReports.map((report) => {
          const accepted = report.acceptedBy;
          return (
            <li key={report.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onSelectReport(report)}
                className="flex w-full min-w-0 gap-3 rounded-2xl border border-stone-200 bg-white p-3 text-left shadow-xs hover:border-brand-300 hover:shadow-sm transition cursor-pointer"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                  {report.photoUrl && (
                    <img
                      src={report.photoUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE_CLASS[report.status] ?? 'bg-stone-100 text-stone-700'}`}>
                      {statusLabel(report.status)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${URGENCY_BADGE_CLASS[report.urgency] ?? 'bg-stone-100 text-stone-700'}`}>
                      {urgencyLabel(report.urgency)}
                    </span>
                    <span className="text-[11px] text-stone-500">
                      {animalLabel(report.animalType, report.customAnimalName)}
                    </span>
                  </div>

                  <p className="truncate text-sm font-bold text-stone-900">{report.title}</p>

                  {report.location?.address && (
                    <p className="flex items-center gap-1 truncate text-xs text-stone-500">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{report.location.address}</span>
                    </p>
                  )}

                  <p className="flex items-center gap-1 text-xs text-stone-500">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    {t('myCases.reportedAt', { time: formatTime(report.createdAt) })}
                  </p>

                  <p className={`flex items-center gap-1 text-xs font-semibold ${accepted ? 'text-emerald-700' : 'text-amber-700'}`}>
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {accepted
                        ? t('myCases.acceptedBy', { ngo: accepted.ngoName, interpolation: { escapeValue: false } })
                        : t('myCases.waiting')}
                    </span>
                  </p>
                </div>

                <span className="flex shrink-0 items-center gap-0.5 self-center text-xs font-semibold text-brand-700">
                  <span className="hidden sm:inline">{t('myCases.viewDetails')}</span>
                  <ChevronRight className="w-4 h-4" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
