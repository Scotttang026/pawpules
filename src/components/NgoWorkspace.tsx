// src/components/NgoWorkspace.tsx
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, MapPin, Clock, Handshake, Loader2, ChevronRight, AlertTriangle } from 'lucide-react';
import type { StrayReport, CaseStatus, NGOOrganization } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { statusLabel, animalLabel } from '../utils/caseLabels';
import { getApiLang } from '../i18n';

type WorkTab = 'open' | 'mine' | 'others';

/** NGO 可以揀嘅進度（唔可以改返做待處理） */
export const NGO_STATUSES: CaseStatus[] = ['in_progress', 'rescued', 'closed'];

const URGENCY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
const URGENCY_BADGE: Record<string, string> = {
  P0: 'bg-rose-600 text-white animate-pulse',
  P1: 'bg-brand-500 text-white',
  P2: 'bg-emerald-600 text-white',
};

function isFinished(r: StrayReport): boolean {
  return r.status === 'rescued' || r.status === 'closed';
}

function formatTime(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '--:--'
    : d.toLocaleString(getApiLang(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface NgoWorkspaceProps {
  reports: StrayReport[];
  ngos: NGOOrganization[];
  onSelectReport: (report: StrayReport) => void;
  onAcceptCase: (caseId: string) => Promise<void>;
  onUpdateStatus: (caseId: string, status: CaseStatus) => void | Promise<void>;
}

export const NgoWorkspace: React.FC<NgoWorkspaceProps> = ({
  reports,
  ngos,
  onSelectReport,
  onAcceptCase,
  onUpdateStatus,
}) => {
  const { t } = useTranslation(); // 轉語言時 statusLabel()/animalLabel() 即刻更新
  const { ngoId } = useAuth();
  const [tab, setTab] = useState<WorkTab>('open');
  const [busyId, setBusyId] = useState<string | null>(null);

  const org = ngos.find((n) => n.id === ngoId);

  const groups = useMemo(() => {
    const open = reports
      .filter((r) => !r.acceptedBy && !isFinished(r))
      .sort((a, b) => (URGENCY_RANK[a.urgency] ?? 9) - (URGENCY_RANK[b.urgency] ?? 9));
    const mine = reports.filter((r) => !!ngoId && r.acceptedBy?.ngoId === ngoId);
    const others = reports.filter((r) => !!r.acceptedBy && r.acceptedBy.ngoId !== ngoId);
    return { open, mine, others };
  }, [reports, ngoId]);

  const handleAccept = async (caseId: string) => {
    setBusyId(caseId);
    try {
      await onAcceptCase(caseId);
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { key: WorkTab; label: string }[] = [
    { key: 'open', label: t('ngoWorkspace.tabOpen', { n: groups.open.length }) },
    { key: 'mine', label: t('ngoWorkspace.tabMine', { n: groups.mine.length }) },
    { key: 'others', label: t('ngoWorkspace.tabOthers', { n: groups.others.length }) },
  ];
  const emptyText: Record<WorkTab, string> = {
    open: t('ngoWorkspace.emptyOpen'),
    mine: t('ngoWorkspace.emptyMine'),
    others: t('ngoWorkspace.emptyOthers'),
  };
  const list = groups[tab];

  return (
    <div className="space-y-5">
      {/* 所屬機構 */}
      {org ? (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-stone-200 bg-stone-50">
          <span className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-2xs text-stone-500">{t('ngoWorkspace.orgLabel')}</p>
            <p className="font-semibold text-stone-900 truncate">{org.name}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-900 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {t('ngoWorkspace.orgMissing')}
        </div>
      )}

      {/* 分頁 */}
      <div className="flex gap-2 border-b border-stone-200 overflow-x-auto">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              tab === key ? 'border-brand-600 text-brand-600' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="py-16 text-center text-sm text-stone-400">{emptyText[tab]}</p>
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {list.map((r) => (
            <li key={r.id} className="rounded-2xl border border-stone-200 bg-white p-4 flex gap-4">
              {r.photoUrl ? (
                <img
                  src={r.photoUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                  className="w-20 h-20 rounded-xl object-cover shrink-0 bg-stone-100"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-stone-100 shrink-0" />
              )}

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-2xs font-bold ${URGENCY_BADGE[r.urgency] ?? 'bg-stone-500 text-white'}`}>
                    {r.urgency}
                  </span>
                  <span className="text-2xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 font-medium">
                    {statusLabel(r.status)}
                  </span>
                  <span className="text-2xs text-stone-500">{animalLabel(r.animalType, r.customAnimalName)}</span>
                </div>

                <button
                  onClick={() => onSelectReport(r)}
                  className="w-full text-left group cursor-pointer"
                  title={t('ngoWorkspace.viewDetails')}
                >
                  <p className="font-semibold text-sm text-stone-900 truncate group-hover:underline flex items-center gap-1">
                    <span className="truncate">{r.title}</span>
                    <ChevronRight className="w-4 h-4 shrink-0 text-stone-400" />
                  </p>
                  <p className="text-2xs text-stone-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{r.location.address}</span>
                  </p>
                  <p className="text-2xs text-stone-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 shrink-0" />
                    {formatTime(r.createdAt)}
                  </p>
                </button>

                {tab === 'open' && (
                  <button
                    onClick={() => handleAccept(r.id)}
                    disabled={busyId !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-stone-950 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {busyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Handshake className="w-3.5 h-3.5" />}
                    {busyId === r.id ? t('ngoWorkspace.accepting') : t('ngoWorkspace.accept')}
                  </button>
                )}

                {tab === 'mine' && (
                  <div className="flex flex-wrap gap-1.5" aria-label={t('ngoWorkspace.updateStatus')}>
                    {NGO_STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => onUpdateStatus(r.id, s)}
                        disabled={r.status === s}
                        className={`px-2.5 py-1 rounded-lg text-2xs font-bold border transition-colors cursor-pointer ${
                          r.status === s
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        {statusLabel(s)}
                      </button>
                    ))}
                  </div>
                )}

                {tab === 'others' && r.acceptedBy && (
                  <p className="text-2xs text-stone-500">{t('ngoWorkspace.acceptedBy', { name: r.acceptedBy.ngoName })}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
