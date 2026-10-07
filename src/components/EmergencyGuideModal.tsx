import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, ShieldAlert, CheckCircle2, AlertTriangle, Phone } from 'lucide-react';
import { getEmergencyContact, telHref } from '../config/emergency';

interface EmergencyGuideModalProps {
  onClose: () => void;
}

const DO_ITEMS = ['watch', 'warm', 'report', 'water'] as const;
const DONT_ITEMS = ['move', 'feed', 'meds', 'crowd'] as const;

export const EmergencyGuideModal: React.FC<EmergencyGuideModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  // 熱線統一由 emergency.ts 管理，只會顯示核實過嘅號碼
  const emergency = getEmergencyContact();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto" id="emergency-guide-modal">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between gap-3 p-5 bg-rose-600 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldAlert className="w-6 h-6 text-rose-200 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-bold text-base sm:text-lg">{t('guide.title')}</h2>
              <p className="text-xs text-rose-100">{t('guide.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('guide.close')}
            className="w-8 h-8 rounded-full bg-rose-700 hover:bg-rose-800 text-white flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-xs text-stone-700 leading-relaxed">
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm text-rose-900 mb-1">{t('guide.safetyTitle')}</h3>
              <p className="text-rose-800">{t('guide.safetyBody')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2.5">
              <h4 className="font-bold text-sm text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {t('guide.doTitle')}
              </h4>
              <ul className="space-y-2 text-emerald-950">
                {DO_ITEMS.map((k) => (
                  <li key={k}>
                    • <strong>{t(`guide.do.${k}.title`)}</strong>
                    {t(`guide.do.${k}.body`)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-2.5">
              <h4 className="font-bold text-sm text-stone-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                {t('guide.dontTitle')}
              </h4>
              <ul className="space-y-2 text-stone-700">
                {DONT_ITEMS.map((k) => (
                  <li key={k}>
                    • <strong>{t(`guide.dont.${k}.title`)}</strong>
                    {t(`guide.dont.${k}.body`)}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-brand-50 rounded-2xl p-4 border border-brand-200 text-xs">
            <h4 className="font-bold text-brand-900 mb-2 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-brand-700" />
              {t('guide.hotlineTitle')}
            </h4>
            {emergency ? (
              <div className="bg-white p-2.5 rounded-xl border border-brand-200/80 text-brand-950 font-medium sm:max-w-xs">
                <span>{emergency.name}</span>
                <a href={telHref(emergency.phone)} className="text-rose-600 font-bold block text-sm">
                  {emergency.phone}
                </a>
              </div>
            ) : (
              <p className="text-brand-900">{t('guide.hotlineNone')}</p>
            )}
          </div>
        </div>

        <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 text-white font-bold text-xs hover:bg-stone-800 transition-colors"
          >
            {t('guide.ack')}
          </button>
        </div>
      </div>
    </div>
  );
};
