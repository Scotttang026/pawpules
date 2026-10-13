import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import type { StrayReport } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { restoreCase, deleteCaseInFirestore } from '../services/caseService';
import { getApiLang } from '../i18n';

function formatTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '--';
  try {
    return new Intl.DateTimeFormat(getApiLang(), { dateStyle: 'medium', timeStyle: 'short' }).format(ms);
  } catch {
    return new Date(ms).toLocaleString();
  }
}

interface Props {
  report: StrayReport;
  onDeleted: () => void;
}

export default function DeletionRequestBanner({ report, onDeleted }: Props) {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [busy, setBusy] = useState<'restore' | 'delete' | null>(null);

  if (report.status !== 'pending_deletion') return null;
  const req = report.deletionRequest;

  const handleRestore = async () => {
    setBusy('restore');
    try {
      await restoreCase(report.id);
    } catch {
      alert(t('deleteRequest.admin.restoreFailed'));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('deleteRequest.admin.deleteConfirm'))) return;
    setBusy('delete');
    try {
      await deleteCaseInFirestore(report.id);
      onDeleted();
    } catch {
      alert(t('deleteRequest.admin.deleteFailed'));
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-2 text-sm text-rose-900">
      <p className="flex items-center gap-2 font-bold">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        {t('deleteRequest.admin.title')}
      </p>
      {req && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-rose-700">{t('deleteRequest.reasonLabel')}</dt>
          <dd>{t(`deleteRequest.reasons.${req.reason}`)}</dd>
          {req.note && (
            <>
              <dt className="text-rose-700">{t('deleteRequest.admin.note')}</dt>
              <dd className="whitespace-pre-wrap break-words">{req.note}</dd>
            </>
          )}
          <dt className="text-rose-700">{t('deleteRequest.admin.requestedAt')}</dt>
          <dd>{formatTime(req.requestedAt)}</dd>
        </dl>
      )}

      {isAdmin ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={handleDelete}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
          >
            {busy === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {t('deleteRequest.admin.confirmDelete')}
          </button>
          <button
            type="button"
            onClick={handleRestore}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-bold cursor-pointer disabled:opacity-60"
          >
            {busy === 'restore' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            {t('deleteRequest.admin.restore')}
          </button>
        </div>
      ) : (
        <p className="text-xs">{t('deleteRequest.admin.ngoNotice')}</p>
      )}
    </div>
  );
}
