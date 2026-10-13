import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, Trash2, AlertCircle } from 'lucide-react';
import type { DeleteReason, StrayReport } from '../types';
import { requestCaseDeletion } from '../services/caseService';
import { getBrowserLanguage } from '../utils/locale';

export const DELETE_REASONS: DeleteReason[] = ['duplicate', 'resolved', 'wrong_info', 'privacy', 'mistake', 'other'];
const MAX_NOTE = 500;

const SERVER_CODES = new Set([
  'unauthenticated', 'not_owner', 'not_found', 'case_accepted', 'case_locked', 'already_requested', 'bad_input',
]);

const inputClass =
  'w-full px-3 py-2.5 text-sm bg-white border border-stone-200 rounded-lg placeholder:text-stone-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10';

// 只係決定顯唔顯示掣；真正權限由 server 檢查
export function canRequestDeletion(r: StrayReport): boolean {
  return !r.acceptedBy && r.status === 'pending';
}

// 「我的案件」卡片用
export const DeleteRequestAction: React.FC<{ report: StrayReport; onRequest: (r: StrayReport) => void }> = ({
  report,
  onRequest,
}) => {
  const { t } = useTranslation();
  if (!canRequestDeletion(report)) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onRequest(report);
      }}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-medium cursor-pointer"
    >
      <Trash2 className="w-3.5 h-3.5" />
      {t('deleteRequest.button')}
    </button>
  );
};

interface Props {
  report: StrayReport;
  onClose: () => void;
  onDone: (messageKey: string) => void;
}

const DeleteRequestModal: React.FC<Props> = ({ report, onClose, onDone }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState<DeleteReason | ''>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const isOther = reason === 'other';

  const handleSubmit = async () => {
    setErrorKey(null);
    if (!reason) {
      setErrorKey('deleteRequest.errors.noReason');
      return;
    }
    if (isOther && !note.trim()) {
      setErrorKey('deleteRequest.errors.noNote');
      return;
    }
    setBusy(true);
    try {
      await requestCaseDeletion(report.id, reason, note.trim(), getBrowserLanguage());
      onDone('deleteRequest.sent');
    } catch (err: any) {
      const code = String(err?.message ?? '');
      setErrorKey(SERVER_CODES.has(code) ? `deleteRequest.errors.${code}` : 'deleteRequest.errors.generic');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-stone-900">{t('deleteRequest.title')}</h3>
            <p className="text-xs text-stone-500 mt-1 truncate">{report.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t('deleteRequest.cancel')}
            className="p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
          {t('deleteRequest.hint')}
        </p>

        <div>
          <label htmlFor="delete-reason" className="block text-xs font-medium text-stone-700 mb-1.5">
            {t('deleteRequest.reasonLabel')}
          </label>
          <select
            id="delete-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as DeleteReason | '')}
            className={inputClass}
          >
            <option value="" disabled>
              {t('deleteRequest.reasonPlaceholder')}
            </option>
            {DELETE_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`deleteRequest.reasons.${r}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="delete-note" className="block text-xs font-medium text-stone-700 mb-1.5">
            {isOther ? t('deleteRequest.noteRequired') : t('deleteRequest.noteOptional')}
          </label>
          <textarea
            id="delete-note"
            rows={3}
            value={note}
            maxLength={MAX_NOTE}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('deleteRequest.notePlaceholder')}
            className={`${inputClass} resize-y`}
          />
          <p className="text-right text-2xs text-stone-400 mt-1">
            {note.length} / {MAX_NOTE}
          </p>
        </div>

        {errorKey && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{t(errorKey)}</span>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm cursor-pointer"
          >
            {t('deleteRequest.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {t('deleteRequest.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteRequestModal;
