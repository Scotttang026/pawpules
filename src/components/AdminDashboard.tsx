import React, { useState } from 'react';
import { StrayReport, NGOOrganization, CaseStatus, AnimalType, NGOCapacityStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { monitoring, SystemLogEvent } from '../utils/monitoring';
import {
  ShieldCheck,
  Building2,
  Trash2,
  Plus,
  Clock,
  Terminal,
  RefreshCw,
  LogOut,
  LogIn,
  AlertTriangle,
  Mail,
  Activity,
  Sliders,
  X,
} from 'lucide-react';
import { fetchCaseContact, ReporterContactInfo } from '../services/caseService';
import AddressAutocomplete from './AddressAutocomplete';

interface AdminDashboardProps {
  reports: StrayReport[];
  ngos: NGOOrganization[];
  onUpdateCaseStatus: (caseId: string, status: CaseStatus) => void;
  onDeleteCase: (caseId: string) => void;
  onUpdateNGOCapacity: (ngoId: string, capacity: NGOCapacityStatus) => void;
  onCreateNGO: (ngo: NGOOrganization) => void;
  onDeleteNGO: (ngoId: string) => void;
}

const ANIMAL_TYPE_OPTIONS: { value: AnimalType; label: string }[] = [
  { value: 'cat', label: '貓' },
  { value: 'dog', label: '狗' },
  { value: 'bird', label: '雀鳥' },
  { value: 'other', label: '其他' },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  reports,
  ngos,
  onUpdateCaseStatus,
  onDeleteCase,
  onUpdateNGOCapacity,
  onCreateNGO,
  onDeleteNGO,
}) => {
  const { user, isAdmin, signInWithGoogle, signOut, simulateAdminMode } = useAuth();
  const isDevMode = import.meta.env.DEV === true;

  const [activeTab, setActiveTab] = useState<'cases' | 'ngos' | 'logs'>('cases');
  const [logs, setLogs] = useState<SystemLogEvent[]>(monitoring.getRecentLogs());

  const [showAddNGOModal, setShowAddNGOModal] = useState(false);
  const [newNGOName, setNewNGOName] = useState('');
  const [newNGOEnglishName, setNewNGOEnglishName] = useState('');
  const [newNGOHotline, setNewNGOHotline] = useState('');
  const [newNGOWhatsapp, setNewNGOWhatsapp] = useState('');
  const [newNGOAddress, setNewNGOAddress] = useState('');
  const [newNGODistrict, setNewNGODistrict] = useState('');
  const [newNGOLat, setNewNGOLat] = useState('');
  const [newNGOLng, setNewNGOLng] = useState('');
  const [newNGOOperatingHours, setNewNGOOperatingHours] = useState('24 小時急救出勤');
  const [newNGO24h, setNewNGO24h] = useState(true);
  const [newNGOSpecialties, setNewNGOSpecialties] = useState('流浪貓狗急救, 骨折外傷, 誘捕安置');
  const [newNGOAcceptedAnimals, setNewNGOAcceptedAnimals] = useState<AnimalType[]>(['cat', 'dog']);

  const handleRefreshLogs = () => {
    setLogs(monitoring.getRecentLogs());
  };

  const toggleAcceptedAnimal = (type: AnimalType) => {
    setNewNGOAcceptedAnimals((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const resetNGOForm = () => {
    setNewNGOName('');
    setNewNGOEnglishName('');
    setNewNGOHotline('');
    setNewNGOWhatsapp('');
    setNewNGOAddress('');
    setNewNGODistrict('');
    setNewNGOLat('');
    setNewNGOLng('');
    setNewNGOOperatingHours('24 小時急救出勤');
    setNewNGO24h(true);
    setNewNGOSpecialties('流浪貓狗急救, 骨折外傷, 誘捕安置');
    setNewNGOAcceptedAnimals(['cat', 'dog']);
  };

  const handleSaveNewNGO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNGOName.trim() || !newNGOHotline.trim()) {
      alert('請填寫機構名稱與急救熱線電話');
      return;
    }

    const ngoId = `ngo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const parsedLat = parseFloat(newNGOLat);
    const parsedLng = parseFloat(newNGOLng);
    if (
      !Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90 ||
      !Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180
    ) {
      alert('請喺地址欄揀一個建議地址，或者手動填寫正確經緯度');
      return;
    }

    const newOrg: NGOOrganization = {
      id: ngoId,
      name: newNGOName.trim(),
      englishName: newNGOEnglishName.trim() || newNGOName.trim(),
      hotline: newNGOHotline.trim(),
      whatsapp: newNGOWhatsapp.replace(/\D/g, '') || undefined,
      address: newNGOAddress.trim(),
      district: newNGODistrict.trim() || '待確認地區',
      lat: parsedLat,
      lng: parsedLng,
      acceptedAnimals: newNGOAcceptedAnimals.length > 0 ? newNGOAcceptedAnimals : ['cat', 'dog', 'other'],
      specialties: newNGOSpecialties
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      operatingHours: newNGOOperatingHours.trim(),
      hasEmergencyRescue: newNGO24h,
      capacityStatus: 'available',
    };

    onCreateNGO(newOrg);
    setShowAddNGOModal(false);
    resetNGOForm();
  };

  const [revealedContacts, setRevealedContacts] = useState<Record<string, ReporterContactInfo | null>>({});
  const [loadingContactId, setLoadingContactId] = useState<string | null>(null);

  // ⚠️ 修正：原本用 `if (revealedContacts[caseId]) return;` 做快取判斷，
  // 但如果 fetchCaseContact 回傳 null（真係冇 contact 文件，例如舊測試
  // 資料），revealedContacts[caseId] 會被設成 null（falsy），下次撳按鈕
  // 會被當做「未讀取過」而重複觸發 fetch。改用 `caseId in revealedContacts`
  // 嚟分辨「未曾 fetch」同「fetch 完確認冇資料」兩種狀態。
  const handleRevealContact = async (caseId: string) => {
    if (caseId in revealedContacts) return;
    setLoadingContactId(caseId);
    const data = await fetchCaseContact(caseId);
    setRevealedContacts((prev) => ({ ...prev, [caseId]: data }));
    setLoadingContactId(null);
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4" id="admin-login-gate">
        <div className="w-16 h-16 rounded-2xl bg-stone-900 text-brand-400 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-stone-900">管理員後台需要登入</h2>
        <p className="text-xs text-stone-500 leading-relaxed">
          請使用已授權的 Google 帳號登入，以存取案件審核與 NGO 管理功能。
        </p>
        <button
          onClick={signInWithGoogle}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-stone-950 text-xs font-bold transition-colors shadow-xs cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          以 Google 帳號登入
        </button>

        {isDevMode && (
          <div className="pt-4 border-t border-stone-200 mt-4">
            <p className="text-2xs text-stone-400 mb-2">[開發模式限定] 冇 Google 帳號時可快速模擬</p>
            <button
              onClick={() => simulateAdminMode(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 text-2xs font-bold transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              模擬管理員登入（僅開發環境生效）
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4" id="admin-access-denied">
        <AlertTriangle className="w-10 h-10 text-brand-500 mx-auto" />
        <h2 className="text-lg font-bold text-stone-900">存取被拒</h2>
        <p className="text-xs text-stone-500 leading-relaxed">
          帳號 <strong className="text-stone-700">{user.email}</strong> 已登入，但尚未獲授權存取管理員後台。
          如需權限，請聯絡系統管理員將您的帳號加入 <code className="text-2xs">adminuser</code> 名冊。
        </p>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          登出並切換帳號
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="admin-dashboard-view">
      <div className="bg-stone-900 text-white rounded-3xl p-6 shadow-xl border border-stone-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">PawPulse 管理員與救助隊調度後台</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-500 text-stone-950">
                Super Admin
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              直接維護 Firestore 雲端資料庫（個案審核、實體 NGO 機構註冊、日誌監控）。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-stone-200">{user.displayName || user.email}</p>
              <p className="text-2xs text-stone-400">{user.email}</p>
            </div>
            {user.photoURL && (
              <img src={user.photoURL} alt="avatar" className="w-9 h-9 rounded-full border border-stone-700" referrerPolicy="no-referrer" />
            )}
            <button
              onClick={signOut}
              className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-stone-700 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              登出
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
        <button
          onClick={() => setActiveTab('cases')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'cases' ? 'bg-stone-900 text-white shadow-xs' : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          case 資料表審核 ({reports.length})
        </button>
        <button
          onClick={() => setActiveTab('ngos')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'ngos' ? 'bg-stone-900 text-white shadow-xs' : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          ngodatail 資料表維護 ({ngos.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('logs');
            handleRefreshLogs();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'logs' ? 'bg-stone-900 text-white shadow-xs' : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          系統日誌與監控
        </button>
      </div>

      {activeTab === 'cases' && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
            <span className="text-xs font-bold text-stone-700">Firestore `case` 資料表 (即時同步)</span>
            <span className="text-2xs text-stone-500 font-mono">Collection: case / 共 {reports.length} 宗</span>
          </div>

          {reports.length === 0 ? (
            <div className="p-12 text-center text-stone-500 space-y-2">
              <p className="text-sm font-bold text-stone-800">目前雲端資料庫中無任何通報個案</p>
              <p className="text-xs text-stone-400">市民透過「我要通報」送出後，資料將自動存入 Firestore 並實時呈現在此。</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {reports.map((c) => {
                const hasFetchedContact = c.id in revealedContacts;
                const fetchedContact = revealedContacts[c.id];

                return (
                  <div key={c.id} className="p-4 hover:bg-stone-50/80 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <img
                        src={c.photoUrl}
                        alt={c.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                        }}
                        className="w-14 h-14 rounded-xl object-cover bg-stone-100 border border-stone-200 shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-stone-900">{c.title}</span>
                          <span className={`px-2 py-0.5 rounded-full text-2xs font-bold text-white ${
                            c.urgency === 'P0' ? 'bg-rose-600' : c.urgency === 'P1' ? 'bg-amber-500' : 'bg-emerald-600'
                          }`}>
                            {c.urgency}
                          </span>
                          <span className="text-2xs text-stone-500 font-mono">ID: {c.id}</span>
                        </div>

                        <p className="text-xs text-stone-600 line-clamp-1 mt-0.5">{c.description}</p>
                        <div className="flex items-center gap-3 text-2xs text-stone-500 mt-1 flex-wrap">
                          {hasFetchedContact ? (
                            fetchedContact ? (
                              <>
                                <span>
                                  通報人: {fetchedContact.reporterName || '未提供'} ({fetchedContact.reporterPhone || '無電話'})
                                </span>
                                {fetchedContact.reporterEmail && (
                                  <span className="flex items-center gap-1 text-blue-600">
                                    <Mail className="w-3 h-3" />
                                    {fetchedContact.reporterEmail}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-stone-400">⚠ 未能讀取聯絡資料（資料不存在或讀取被拒）</span>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRevealContact(c.id)}
                              disabled={loadingContactId === c.id}
                              className="text-2xs text-brand-700 font-bold underline hover:text-brand-800 cursor-pointer disabled:opacity-50"
                            >
                              {loadingContactId === c.id ? '載入中...' : '👁 查看報案人聯絡資料'}
                            </button>
                          )}
                          <span>地點: {c.location.address}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                      <select
                        value={c.status}
                        onChange={(e) => onUpdateCaseStatus(c.id, e.target.value as CaseStatus)}
                        className="px-2.5 py-1.5 rounded-xl text-xs bg-stone-50 border border-stone-300 font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      >
                        <option value="pending">待處理 (Pending)</option>
                        <option value="in_progress">救援前往中 (In Progress)</option>
                        <option value="rescued">已成功救助 (Rescued)</option>
                        <option value="closed">結案 (Closed)</option>
                      </select>

                      <button
                        onClick={() => {
                          if (confirm(`確認從 Firestore 永久刪除個案 #${c.id}？`)) {
                            onDeleteCase(c.id);
                          }
                        }}
                        className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors border border-rose-200 cursor-pointer"
                        title="刪除個案"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'ngos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-stone-200">
            <div>
              <h3 className="font-bold text-sm text-stone-900">Firestore 合作 NGO 救助機構名冊</h3>
              <p className="text-2xs text-stone-500">所有 NGO 資料均永久存於雲端資料庫，可隨時新增或調度</p>
            </div>
            <button
              onClick={() => setShowAddNGOModal(true)}
              className="px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-stone-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              新增 NGO 機構
            </button>
          </div>

          {ngos.length === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center text-stone-500 space-y-3">
              <Building2 className="w-10 h-10 text-stone-300 mx-auto" />
              <p className="text-sm font-bold text-stone-800">目前 Firestore 資料庫中尚未登記任何 NGO 機構</p>
              <p className="text-xs text-stone-400">點擊上方「新增 NGO 機構」將合作組織登記至 Firestore 雲端資料庫。</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ngos.map((ngo) => (
                <div key={ngo.id} className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-stone-900">{ngo.name}</h4>
                      <p className="text-2xs text-stone-500">{ngo.englishName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-2xs font-bold ${
                        ngo.capacityStatus === 'busy' ? 'bg-amber-100 text-amber-800'
                          : ngo.capacityStatus === 'full' ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {ngo.capacityStatus === 'busy' ? '救援繁重' : ngo.capacityStatus === 'full' ? '暫停收案' : '正常接案'}
                      </span>
                      <button
                        onClick={() => {
                          if (confirm(`確認從 Firestore 刪除 NGO「${ngo.name}」？`)) {
                            onDeleteNGO(ngo.id);
                          }
                        }}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                        title="刪除機構"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-stone-600 space-y-1">
                    <p>📍 {ngo.address} ({ngo.district})</p>
                    <p>📞 熱線: {ngo.hotline}</p>
                    <p><Clock className="w-3 h-3 inline mr-1" />營業: {ngo.operatingHours}</p>
                    <p>🐾 接受: {(ngo.acceptedAnimals || []).map((a) => ANIMAL_TYPE_OPTIONS.find((o) => o.value === a)?.label || a).join('、') || '未設定'}</p>
                  </div>

                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                    <span className="text-2xs font-bold text-stone-500">調整接案狀態：</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onUpdateNGOCapacity(ngo.id, 'available')}
                        className={`px-2.5 py-1 rounded-lg text-2xs font-bold transition-colors cursor-pointer ${
                          ngo.capacityStatus === 'available' || !ngo.capacityStatus ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        正常接案
                      </button>
                      <button
                        onClick={() => onUpdateNGOCapacity(ngo.id, 'busy')}
                        className={`px-2.5 py-1 rounded-lg text-2xs font-bold transition-colors cursor-pointer ${
                          ngo.capacityStatus === 'busy' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        繁重
                      </button>
                      <button
                        onClick={() => onUpdateNGOCapacity(ngo.id, 'full')}
                        className={`px-2.5 py-1 rounded-lg text-2xs font-bold transition-colors cursor-pointer ${
                          ngo.capacityStatus === 'full' ? 'bg-rose-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        暫停收案
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-stone-950 text-stone-200 rounded-3xl p-5 border border-stone-800 shadow-xl space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-stone-100">實時系統日誌 (Structured Logs)</span>
            </div>
            <button
              onClick={handleRefreshLogs}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-2xs text-stone-300 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              重新整理
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 text-2xs pr-1">
            {logs.length === 0 ? (
              <p className="text-stone-500 py-4 text-center">暫無日誌記錄</p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-2.5 rounded-xl border ${
                    log.level === 'error' ? 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                      : log.level === 'warn' ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                      : 'bg-stone-900 border-stone-800 text-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-2xs text-stone-400 mb-1">
                    <span className="font-bold uppercase tracking-wider text-brand-400">[{log.category}]</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="font-sans font-medium">{log.message}</p>
                  {log.details && (
                    <pre className="mt-1.5 p-2 rounded-lg bg-black/40 text-stone-300 text-3xs overflow-x-auto whitespace-pre-wrap">
                      {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showAddNGOModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-stone-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-base text-stone-900">新增合作 NGO 機構至 Firestore</h3>
              </div>
              <button onClick={() => setShowAddNGOModal(false)} className="text-stone-400 hover:text-stone-600 font-bold">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewNGO} className="space-y-3.5 text-xs text-stone-700">
              <div>
                <label className="block font-bold mb-1">機構中文全名 *</label>
                <input type="text" value={newNGOName} onChange={(e) => setNewNGOName(e.target.value)} placeholder="例如：毛守救援 (PGRS)" className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" required />
              </div>

              <div>
                <label className="block font-bold mb-1">機構英文名稱</label>
                <input type="text" value={newNGOEnglishName} onChange={(e) => setNewNGOEnglishName(e.target.value)} placeholder="例如：Paws Guardian Rescue Shelter" className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">急救專線熱線 *</label>
                  <input type="tel" value={newNGOHotline} onChange={(e) => setNewNGOHotline(e.target.value)} placeholder="例如 +852 2711 1000" className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" required />
                </div>
                <div>
                  <label className="block font-bold mb-1">WhatsApp（連國家區號）</label>
                  <input type="tel" value={newNGOWhatsapp} onChange={(e) => setNewNGOWhatsapp(e.target.value)} placeholder="例如 85291234567" className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">機構地址 / 救助中心 *</label>
                <AddressAutocomplete
                  value={newNGOAddress}
                  onChange={setNewNGOAddress}
                  onSelect={(p) => {
                    setNewNGOAddress(p.address);
                    setNewNGOLat(String(p.lat));
                    setNewNGOLng(String(p.lng));
                    setNewNGODistrict(p.district || '');
                  }}
                  onEnter={() => {}}
                  bias={null}
                  placeholder="輸入機構地址，揀建議地址會自動填經緯度"
                />
                <p className="text-2xs text-stone-400 mt-1">揀咗建議地址之後，下面嘅分區同經緯度會自動填好。</p>
              </div>


              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold mb-1">分區</label>
                  <input type="text" value={newNGODistrict} onChange={(e) => setNewNGODistrict(e.target.value)} placeholder="例如：油尖旺區" className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block font-bold mb-1">緯度 (Lat)</label>
                  <input type="text" value={newNGOLat} onChange={(e) => setNewNGOLat(e.target.value)} placeholder="自動填寫" className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block font-bold mb-1">經度 (Lng)</label>
                  <input type="text" value={newNGOLng} onChange={(e) => setNewNGOLng(e.target.value)} placeholder="自動填寫" className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1.5">接受救助動物類型</label>
                <div className="flex flex-wrap gap-3">
                  {ANIMAL_TYPE_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newNGOAcceptedAnimals.includes(opt.value)}
                        onChange={() => toggleAcceptedAnimal(opt.value)}
                        className="rounded text-brand-600 focus:ring-brand-500"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">專長項目 (以逗號分隔)</label>
                <input type="text" value={newNGOSpecialties} onChange={(e) => setNewNGOSpecialties(e.target.value)} placeholder="24h緊急出車, 唐狗急救, 誘捕籠" className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="ngo-24h-cb" checked={newNGO24h} onChange={(e) => setNewNGO24h(e.target.checked)} className="rounded text-brand-600 focus:ring-brand-500" />
                <label htmlFor="ngo-24h-cb" className="font-bold cursor-pointer">具備 24 小時緊急救援車與夜間執勤</label>
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setShowAddNGOModal(false)} className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold">取消</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-stone-950 font-bold shadow-xs cursor-pointer">儲存並發布至 Firestore</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
