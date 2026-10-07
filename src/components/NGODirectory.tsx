import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NGOOrganization, AnimalType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Phone, MessageCircle, Search, Clock, MapPin, ShieldCheck } from 'lucide-react';

type Capacity = 'available' | 'busy' | 'full';

interface NGODirectoryProps {
  ngos: NGOOrganization[];
  onUpdateCapacity?: (ngoId: string, capacity: Capacity) => void;
}

// 後台規定 WhatsApp 要連國家區號（只存數字）。
// 只有 8 位數字嘅舊資料（香港本地號碼）先補 852，其他國家號碼唔會被改錯。
function buildWhatsAppLink(rawNumber: string): string {
  const digits = rawNumber.replace(/\D/g, '');
  const full = digits.length === 8 ? `852${digits}` : digits;
  return `https://wa.me/${full}`;
}

const CAPACITY_BADGE: Record<Capacity, string> = {
  available: 'bg-emerald-100 text-emerald-800',
  busy: 'bg-amber-100 text-amber-800',
  full: 'bg-rose-100 text-rose-800',
};

const CAPACITY_ACTIVE: Record<Capacity, string> = {
  available: 'bg-emerald-600 text-white',
  busy: 'bg-amber-600 text-white',
  full: 'bg-rose-600 text-white',
};

const CAPACITIES: Capacity[] = ['available', 'busy', 'full'];

// 純文字顯示（React 本身會 escape），避免 "&" 變 "&amp;"
const NO_ESCAPE = { interpolation: { escapeValue: false } } as const;

export const NGODirectory: React.FC<NGODirectoryProps> = ({ ngos, onUpdateCapacity }) => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedAnimal, setSelectedAnimal] = useState<'all' | AnimalType>('all');
  const [filter24hOnly, setFilter24hOnly] = useState(false);

  const filteredNGOs = ngos.filter((ngo) => {
    if (filter24hOnly && !ngo.hasEmergencyRescue) return false;
    if (selectedAnimal !== 'all' && !ngo.acceptedAnimals?.includes(selectedAnimal)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const fields = [ngo.name, ngo.englishName, ngo.district, ngo.address, ...(ngo.specialties || [])];
      if (!fields.some((f) => (f || '').toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const animalBtn = (active: boolean) =>
    `px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
      active ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
    }`;

  return (
    <div className="space-y-4" id="ngo-directory-container">
      <div className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mb-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            {t('ngoDir.badge')}
          </div>
          <h2 className="text-xl font-bold text-stone-900">{t('ngoDir.title', { n: filteredNGOs.length })}</h2>
          <p className="text-xs text-stone-500 mt-1">{t('ngoDir.subtitle')}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('ngoDir.searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              id="ngo-search-input"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setSelectedAnimal('all')} className={animalBtn(selectedAnimal === 'all')}>
              {t('ngoDir.allAnimals')}
            </button>
            <button onClick={() => setSelectedAnimal('cat')} className={animalBtn(selectedAnimal === 'cat')}>
              {t('ngoDir.catSpecialty')}
            </button>
            <button onClick={() => setSelectedAnimal('dog')} className={animalBtn(selectedAnimal === 'dog')}>
              {t('ngoDir.dogSpecialty')}
            </button>
            <button
              onClick={() => setFilter24hOnly(!filter24hOnly)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                filter24hOnly ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
              }`}
            >
              {t('ngoDir.only24h')}
            </button>
          </div>
        </div>
      </div>

      {ngos.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center text-stone-500 shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mx-auto">
            <Building2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-stone-800">{t('ngoDir.emptyTitle')}</h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">{t('ngoDir.emptyBody')}</p>
        </div>
      ) : filteredNGOs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-stone-500">
          <p className="text-sm font-semibold text-stone-700">{t('ngoDir.noMatchTitle')}</p>
          <p className="text-xs text-stone-400 mt-1">{t('ngoDir.noMatchBody')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNGOs.map((ngo) => {
            const capacity: Capacity = (ngo.capacityStatus as Capacity) || 'available';
            return (
              <div
                key={ngo.id}
                className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-base text-stone-900">{ngo.name}</h3>
                      <p className="text-2xs text-stone-400 font-medium">{ngo.englishName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {ngo.hasEmergencyRescue && (
                        <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          {t('ngoDir.rescue24h')}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-2xs font-bold ${CAPACITY_BADGE[capacity] ?? CAPACITY_BADGE.available}`}>
                        {t(`capacity.${capacity}`)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-stone-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">
                        {ngo.address} ({ngo.district})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span>{t('ngoDir.hours', { hours: ngo.operatingHours, ...NO_ESCAPE })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="font-bold text-stone-900">{ngo.hotline}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(ngo.specialties || []).map((spec, i) => (
                      <span key={i} className="text-2xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md font-medium">
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                  <a
                    href={`tel:${ngo.hotline.replace(/[^\d+]/g, '')}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {t('ngoDir.call')}
                  </a>
                  {ngo.whatsapp && (
                    <a
                      href={buildWhatsAppLink(ngo.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition-colors flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      WhatsApp
                    </a>
                  )}
                </div>

                {isAdmin && onUpdateCapacity && (
                  <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-2xs space-y-1.5">
                    <span className="font-bold text-stone-700 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-brand-600" />
                      {t('ngoDir.adminCapacity')}
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {CAPACITIES.map((c) => (
                        <button
                          key={c}
                          onClick={() => onUpdateCapacity(ngo.id, c)}
                          className={`py-1 rounded text-center font-bold ${
                            capacity === c ? CAPACITY_ACTIVE[c] : 'bg-white border text-stone-700'
                          }`}
                        >
                          {t(`capacity.short.${c}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
