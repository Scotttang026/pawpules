// src/components/LanguageSwitcher.tsx
import React from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';

export const LanguageSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t, i18n } = useTranslation();

  return (
    <label className={`flex flex-col items-center gap-0.5 text-stone-700 cursor-pointer ${className}`}>
      <Globe className="w-4 h-4" aria-hidden="true" />
      <select
        value={i18n.resolvedLanguage ?? 'zh'}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        aria-label={t('nav.language')}
        className="text-2xs font-bold bg-transparent text-stone-700 cursor-pointer focus:outline-none text-center"
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
};
