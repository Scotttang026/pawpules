import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, Mail, AlertCircle } from 'lucide-react';
import type { ContactCategory, StrayReport } from '../types';
import { contactAdmin } from '../services/caseService';
import { getEditState } from '../utils/caseEdit';

export const CONTACT_CATEGORIES: ContactCategory[] = ['update', 'delete', 'photo', 'status', 'other'];
const MAX_MESSAGE = 1000;

const SERVER_CODES = new Set(['unauthenticated', 'not_owner', 'not_found', 'bad_input', 'too_many']);

const inputClass =
  'w-full px-3 py-2.5 text-sm bg-white border border-stone-200 rounded-lg placeholder:text-stone-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10';

// 「我的案件」卡片用：自己改唔到嘅時候先出呢粒掣
export const ContactAdminAction: React.FC<{ report: StrayReport; onContact: (r: StrayReport) => void }> = ({
  report,
  onContact,
}) => {
  const { t } = useTranslation();
  if (getEditState(report) === 'editable') return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onContact(report);
      }}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-medium cursor-pointer"
    >
      <Mail className="w-3.5 h-3.5 text-brand-500" />
      {t('contactAdmin.button')}
    </button>
  );
};

interface Props {
  report: StrayReport;
  onClose: () => void;
  onDone: (messageKey: string) => void;
}

const ContactAdminModal: React.FC<Props> = ({ report, onClose, onDone }) => {
  const { t } = useTranslation();
  const [category, setCategory] = useState<ContactCategory | ''>('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorKey(null);
    if (!category) {
      setErrorKey('contactAdmin.errors.noCategory');
      return;
    }
    if (!message.trim()) {
      setErrorKey('contactAdmin.errors.noMessage');
      return;
    }
    setBusy(true);
    try {
      await contactAdmin(report.id, category, message.trim());
      onDone('contactAdmin.sent');
    } catch (err: any) {
      const code = String(err?.message ?? '');
      setErrorKey(SERVER_CODES.has(code) ? `contactAdmin.errors.${code}` : 'contactAdmin.errors.generic');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-stone-900">{t('contactAdmin.title')}</h3>
            <p className="text-xs text-stone-500 mt-1 truncate">{report.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t('contactAdmin.cancel')}
            className="p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-stone-700 text-xs leading-relaxed">
          {t('contactAdmin.hint')}
        </p>

        <div>
          <label htmlFor="contact-category" className="block text-xs font-medium text-stone-700 mb-1.5">
            {t('contactAdmin.categoryLabel')}
          </label>
          <select
            id="contact-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ContactCategory | '')}
            className={inputClass}
          >
            <option value="" disabled>
              {t('contactAdmin.categoryPlaceholder')}
            </option>
            {CONTACT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`contactAdmin.categories.${c}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="contact-message" className="block text-xs font-medium text-stone-700 mb-1.5">
            {t('contactAdmin.messageLabel')}
          </label>
          <textarea
            id="contact-message"
            rows={5}
            value={message}
            maxLength={MAX_MESSAGE}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t(category ? `contactAdmin.placeholders.${category}` : 'contactAdmin.placeholders.other')}
            className={`${inputClass} resize-y`}
          />
          <p className="text-right text-2xs text-stone-400 mt-1">
            {message.length} / {MAX_MESSAGE}
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
            {t('contactAdmin.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="px-5 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {t('contactAdmin.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactAdminModal;
