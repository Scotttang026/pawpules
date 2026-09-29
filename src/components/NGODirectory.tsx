import React, { useState } from 'react';
import { NGOOrganization, AnimalType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  Building2,
  Phone,
  MessageCircle,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
} from 'lucide-react';

interface NGODirectoryProps {
  ngos: NGOOrganization[];
  onUpdateCapacity?: (ngoId: string, capacity: 'available' | 'busy' | 'full') => void;
}

export const NGODirectory: React.FC<NGODirectoryProps> = ({ ngos, onUpdateCapacity }) => {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedAnimal, setSelectedAnimal] = useState<'all' | AnimalType>('all');
  const [filter24hOnly, setFilter24hOnly] = useState(false);

  const filteredNGOs = ngos.filter((ngo) => {
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
      <div className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mb-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            PawPulse 合作 NGO 救助資料庫 (Firestore 雲端同步)
          </div>
          <h2 className="text-xl font-bold text-stone-900">
            合作動物救助機構與熱線名錄 ({filteredNGOs.length} 間)
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            資料庫即時收錄香港救助組織，具備即時出勤負載狀態監控與 24 小時急診聯絡。
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
              全部動物
            </button>
            <button
              onClick={() => setSelectedAnimal('cat')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                selectedAnimal === 'cat' ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              貓咪專長
            </button>
            <button
              onClick={() => setSelectedAnimal('dog')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                selectedAnimal === 'dog' ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              犬隻專長
            </button>
            <button
              onClick={() => setFilter24hOnly(!filter24hOnly)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                filter24hOnly
                  ? 'bg-rose-500 text-white border-rose-500'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
              }`}
            >
              🚨 僅顯示 24 小時熱線
            </button>
          </div>
        </div>
      </div>

      {/* NGO Cards Grid */}
      {ngos.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center text-stone-500 shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mx-auto">
            <Building2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-stone-800">目前 Firebase 資料庫尚未登記任何 NGO 機構</h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
            系統全面自 Firestore 實時讀取 NGO 資料。平台管理員可於「後台管理」直接新增並維護真實合作救援機構。
          </p>
        </div>
      ) : filteredNGOs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-stone-500">
          <p className="text-sm font-semibold text-stone-700">沒有符合搜尋篩選條件的機構</p>
          <p className="text-xs text-stone-400 mt-1">您可以嘗試清除搜尋關鍵字</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredNGOs.map((ngo) => (
          <div
            key={ngo.id}
            className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base text-stone-900">{ngo.name}</h3>
                  <p className="text-2xs text-stone-400 font-medium">{ngo.englishName}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {ngo.hasEmergencyRescue && (
                    <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      24h 出車
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-2xs font-bold ${
                    ngo.capacityStatus === 'busy'
                      ? 'bg-amber-100 text-amber-800'
                      : ngo.capacityStatus === 'full'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {ngo.capacityStatus === 'busy' ? '救援繁重' : ngo.capacityStatus === 'full' ? '暫停收案' : '正常接案'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-stone-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span className="truncate">{ngo.address} ({ngo.district})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span>服務時間：{ngo.operatingHours}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="font-bold text-stone-900">{ngo.hotline}</span>
                </div>
              </div>

              {/* Specialties tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ngo.specialties.map((spec, i) => (
                  <span
                    key={i}
                    className="text-2xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md font-medium"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
              <a
                href={`tel:${ngo.hotline}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                致電救助隊
              </a>
              {ngo.whatsapp && (
                <a
                  href={`https://wa.me/${ngo.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition-colors flex items-center gap-1"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
              )}
            </div>

            {/* Admin Capacity Control */}
            {isAdmin && onUpdateCapacity && (
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-2xs space-y-1.5">
                <span className="font-bold text-stone-700 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-amber-600" />
                  管理員調度接案量：
                </span>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => onUpdateCapacity(ngo.id, 'available')}
                    className={`py-1 rounded text-center font-bold ${
                      ngo.capacityStatus === 'available' || !ngo.capacityStatus
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border text-stone-700'
                    }`}
                  >
                    正常
                  </button>
                  <button
                    onClick={() => onUpdateCapacity(ngo.id, 'busy')}
                    className={`py-1 rounded text-center font-bold ${
                      ngo.capacityStatus === 'busy'
                        ? 'bg-amber-600 text-white'
                        : 'bg-white border text-stone-700'
                    }`}
                  >
                    繁重
                  </button>
                  <button
                    onClick={() => onUpdateCapacity(ngo.id, 'full')}
                    className={`py-1 rounded text-center font-bold ${
                      ngo.capacityStatus === 'full'
                        ? 'bg-rose-600 text-white'
                        : 'bg-white border text-stone-700'
                    }`}
                  >
                    暫停
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  );
};
