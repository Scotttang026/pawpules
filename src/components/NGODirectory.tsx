import React, { useState } from 'react';
import { INITIAL_NGOS } from '../data/mockNGOs';
import { NGOOrganization, AnimalType } from '../types';
import { Building2, Phone, MessageCircle, Navigation, Search, CheckCircle2, ShieldAlert, Award } from 'lucide-react';

export const NGODirectory: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedAnimal, setSelectedAnimal] = useState<'all' | AnimalType>('all');
  const [filter24hOnly, setFilter24hOnly] = useState(false);

  const filteredNGOs = INITIAL_NGOS.filter((ngo) => {
    if (filter24hOnly && !ngo.hasEmergencyRescue) return false;
    if (selectedAnimal !== 'all' && !ngo.acceptedAnimals.includes(selectedAnimal)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = ngo.name.toLowerCase().includes(q);
      const matchEn = ngo.englishName.toLowerCase().includes(q);
      const matchDist = ngo.district.toLowerCase().includes(q);
      const matchAddr = ngo.address.toLowerCase().includes(q);
      const matchSpec = ngo.specialties.some((s) => s.toLowerCase().includes(q));
      if (!matchName && !matchEn && !matchDist && !matchAddr && !matchSpec) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4" id="ngo-directory-container">
      {/* Header & Filter */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mb-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            PawPulse 自建 NGO 救助資料庫
          </div>
          <h2 className="text-xl font-bold text-stone-900">
            合作動物救助機構與熱線名錄 ({filteredNGOs.length} 間)
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            資料庫收錄全港具備救援能力之動物保護團體，包含物種專長、24小時急診電話與基地位置。
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋機構名稱、區域（如：元朗、灣仔、沙田）、或專責服務..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              id="ngo-search-input"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedAnimal('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                selectedAnimal === 'all' ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              全部物種
            </button>
            <button
              onClick={() => setSelectedAnimal('cat')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                selectedAnimal === 'cat' ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              🐱 專責貓咪
            </button>
            <button
              onClick={() => setSelectedAnimal('dog')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                selectedAnimal === 'dog' ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              🐶 專責犬隻
            </button>

            <label className="flex items-center gap-1.5 text-xs font-bold text-stone-700 ml-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filter24hOnly}
                onChange={(e) => setFilter24hOnly(e.target.checked)}
                className="rounded text-rose-600 focus:ring-rose-500"
              />
              <span>只顯示 24h 急診出車</span>
            </label>
          </div>
        </div>
      </div>

      {/* Grid of NGOs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredNGOs.map((ngo) => (
          <div
            key={ngo.id}
            className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs hover:border-stone-300 transition-all flex flex-col justify-between"
            id={`ngo-dir-${ngo.id}`}
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-bold text-sm text-stone-900">{ngo.name}</h3>
                  <p className="text-xs text-stone-500">{ngo.englishName}</p>
                </div>
                {ngo.hasEmergencyRescue && (
                  <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                    24h 緊急出動
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-stone-600 mb-3">
                <p>📍 <strong>所在區域：</strong>{ngo.district} · {ngo.address}</p>
                <p>🕒 <strong>營運時間：</strong>{ngo.operatingHours}</p>
                <p>
                  🐾 <strong>救助物種：</strong>
                  {ngo.acceptedAnimals.map((a) => (a === 'cat' ? '貓咪' : a === 'dog' ? '犬隻' : '其他')).join('、')}
                </p>
              </div>

              <div className="flex flex-wrap gap-1 mb-4">
                {ngo.specialties.map((spec, sIdx) => (
                  <span
                    key={sIdx}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200/60"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>

            {/* Direct Contact Bar */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-stone-100">
              <a
                href={`tel:${ngo.hotline.replace(/\s+/g, '')}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-2xs"
              >
                <Phone className="w-3.5 h-3.5" />
                熱線 {ngo.hotline}
              </a>

              <div className="flex items-center gap-2">
                {ngo.whatsapp && (
                  <a
                    href={`https://wa.me/852${ngo.whatsapp.replace(/\s+/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                    WhatsApp
                  </a>
                )}

                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${ngo.lat},${ngo.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5 text-stone-600" />
                  地圖
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
