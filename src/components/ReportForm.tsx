import React, { useState, useRef, useEffect } from 'react';
import { AnimalType, LocationCoords, StrayReport, NGOOrganization } from '../types';
import { PRESET_LOCATIONS, geocodeAddressQuery, reverseGeocodeCoords } from '../utils/location';
import AddressAutocomplete from './AddressAutocomplete';
import type { ResolvedAddress } from '../services/places';
import { compressImage, uploadAnimalPhoto } from '../utils/imageCompressor';
import { rankFirestoreNGOs } from '../services/caseService';
import { useAuth } from '../contexts/AuthContext';
import {
  Camera,
  Upload,
  MapPin,
  LocateFixed,
  Search,
  Sparkles,
  Check,
  Loader2,
  Shield,
  Mail,
  RefreshCw,
  PhoneCall,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { getEmergencyContact } from '../config/emergency';

interface ReportFormProps {
  ngos: NGOOrganization[];
  // 回傳 Promise<boolean>：true 代表 Firestore 寫入成功
  // AI 分析同確認信統一由 App.tsx 喺寫入成功後呼叫 server 執行
  onSubmitReport: (newReport: StrayReport) => Promise<boolean>;
  onAnalysisStart?: () => void;
}

export const ReportForm: React.FC<ReportFormProps> = ({
  ngos,
  onSubmitReport,
  onAnalysisStart,
}) => {
  const { user } = useAuth();
  const [animalType, setAnimalType] = useState<AnimalType>('cat');
  const [customAnimalName, setCustomAnimalName] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [description, setDescription] = useState('');

  // Reporter details & Anti-abuse
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [reporterName, setReporterName] = useState(user?.displayName || '');
  const [reporterPhone, setReporterPhone] = useState('');
  const [reporterEmail, setReporterEmail] = useState(user?.email || '');

  // Anti-abuse Captcha（只擋最基本嘅機械人，真正防濫用要靠 App Check / reCAPTCHA）
  const [captchaCode, setCaptchaCode] = useState('');
  const [userCaptchaInput, setUserCaptchaInput] = useState('');
  // 私隱同意必須由用戶主動勾選（唔可以預設已勾選）
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const refreshCaptcha = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaCode(code);
    setUserCaptchaInput('');
  };

  useEffect(() => {
    refreshCaptcha();
  }, []);

  // Update email if user signs in
  useEffect(() => {
    if (user?.email) {
      setReporterEmail(user.email);
    }
    if (user?.displayName) {
      setReporterName(user.displayName);
    }
  }, [user]);

  // Location state（預設值只係佔位，市民必須主動確認位置先可以送出）
  const [location, setLocation] = useState<LocationCoords>({
    lat: PRESET_LOCATIONS[0].lat,
    lng: PRESET_LOCATIONS[0].lng,
    address: PRESET_LOCATIONS[0].sampleAddress,
    district: PRESET_LOCATIONS[0].district,
  });
  const [manualAddressInput, setManualAddressInput] = useState('');
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);

  const [statusMessage, setStatusMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setStatusMessage('正在智慧壓縮圖片尺寸...');
      const { blob, dataUrl } = await compressImage(file, 1280, 1280, 0.82);
      setPhotoPreview(dataUrl);
      setPhotoBlob(blob);
      setStatusMessage('✓ 現場圖片已壓縮完成，準備上傳至 Cloud Storage');
    } catch (err: any) {
      alert(err.message || '圖片處理失敗');
      setStatusMessage('');
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('您的裝置或瀏覽器不支援地理定位');
      return;
    }

    setIsGeolocating(true);
    setStatusMessage('正在透過 GPS 定位目前位置...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const { address, district } = await reverseGeocodeCoords(latitude, longitude);
          setLocation({ lat: latitude, lng: longitude, address, district: district || '待確認地區' });
          setManualAddressInput(address);
          setLocationConfirmed(true);
          setStatusMessage('✓ GPS 定位成功');
        } catch (err) {
          console.warn('Reverse geocode failed:', err);
          setStatusMessage('已取得 GPS 座標，但未能轉換成地址，請手動輸入地址');
        } finally {
          setIsGeolocating(false);
        }
      },
      (err) => {
        setIsGeolocating(false);
        setStatusMessage(
          err.code === err.PERMISSION_DENIED
            ? '你未允許定位權限，請手動輸入地址'
            : 'GPS 定位失敗，請手動輸入地址'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleSearchManualAddress = async () => {
    const query = manualAddressInput.trim();
    if (!query) return;

    setIsSearchingAddress(true);
    setStatusMessage('正在搜尋地址座標...');
    try {
      const result = await geocodeAddressQuery(query);
      if (result) {
        setLocation({
          lat: result.lat,
          lng: result.lng,
          address: result.address,
          district: result.district || '待確認地區',
        });
        setLocationConfirmed(true);
        setStatusMessage('✓ 已找到地址位置');
      } else {
        setStatusMessage('搵唔到呢個地址嘅位置，請喺建議清單揀一個地址，或者撳「取得 GPS 定位」。');
      }
    } catch (err) {
      console.warn('Geocode failed:', err);
      setStatusMessage('地址搜尋暫時無法使用，請稍後再試，或者撳「取得 GPS 定位」。');
    } finally {
      setIsSearchingAddress(false);
    }
  };

  // 市民喺自動完成清單揀咗地址
  const handleSelectPlace = (p: ResolvedAddress) => {
    setLocation({ lat: p.lat, lng: p.lng, address: p.address, district: p.district || '待確認地區' });
    setManualAddressInput(p.address);
    setLocationConfirmed(true);
    setStatusMessage('✓ 已找到地址位置');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!photoBlob && !photoPreview) {
      alert('請先上傳或拍攝動物現場照片');
      return;
    }

    if (!description.trim()) {
      alert('請填寫現場動物狀況描述');
      return;
    }

    if (!locationConfirmed) {
      alert('請先確認發現位置：撳「取得 GPS 定位」，或者喺地址欄揀一個建議地址。');
      return;
    }

    const phone = reporterPhone.trim();
    if (!isAnonymous && phone && !/^\+?[0-9 ()-]{6,30}$/.test(phone)) {
      alert('電話格式不正確，請只輸入數字，可以加國家區號，例如 +852 9123 4567');
      return;
    }

    if (userCaptchaInput.trim().toUpperCase() !== captchaCode.toUpperCase()) {
      alert('防濫用驗證碼不正確，請重新輸入以保障通報真實性。');
      refreshCaptcha();
      return;
    }

    if (!agreedPrivacy) {
      alert('請先閱讀並勾選同意《個人資料（私隱）條例》通報者聲明及 AI 獸醫分診免責條款。');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('🚀 正在準備通報資料...');
    if (onAnalysisStart) onAnalysisStart();

    try {
      // Case ID 加入隨機尾碼，避免同一毫秒內多筆提交撞 ID
      const reportId = `PW-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;

      let finalPhotoUrl = photoPreview;
      let finalStoragePath = `animal-reports/${reportId}.jpg`;

      if (photoBlob) {
        setStatusMessage('☁️ 正在上傳照片至 Cloud Storage 物件儲存...');
        const uploadResult = await uploadAnimalPhoto(photoBlob, reportId, photoPreview);
        finalPhotoUrl = uploadResult.downloadUrl;
        finalStoragePath = uploadResult.storagePath;
      }

      // firestore.rules 限制 photoUrl 長度上限 2048；如果仲係 base64 dataURL 代表上傳未完成
      if (finalPhotoUrl.length > 2048) {
        throw new Error('照片連結過長，可能係上傳步驟未完成，請重新選擇照片再試一次。');
      }

      // AI 分析改由 server 喺案件建立後執行（見 App.tsx），前端唔可以自訂緊急度
      const urgency = 'P1' as const;
      const matchedNGOs = rankFirestoreNGOs(ngos, location.lat, location.lng, animalType, urgency);

      const effectiveReporterName = isAnonymous ? '' : reporterName.trim();
      const effectiveReporterPhone = isAnonymous ? '' : phone;
      const effectiveReporterEmail = reporterEmail.trim();

      const newReport: StrayReport = {
        id: reportId,
        title: `${location.district || '待確認地區'} - ${
          animalType === 'cat' ? '流浪貓' : animalType === 'dog' ? '流浪狗' : animalType === 'bird' ? '雀鳥' : '動物'
        }通報`,
        animalType,
        customAnimalName: customAnimalName.trim() || undefined,
        photoUrl: finalPhotoUrl,
        storagePath: finalStoragePath,
        location,
        description: description.trim(),
        reporterName: effectiveReporterName,
        reporterPhone: effectiveReporterPhone,
        reporterEmail: effectiveReporterEmail || undefined,
        createdByUid: user?.uid || 'anonymous',
        createdAt: new Date().toISOString(),
        status: 'pending',
        urgency,
        geminiResponse: null,
        aiAnalysis: null,
        matchedNGOs: matchedNGOs.slice(0, 3),
      };

      // 先確認 Firestore 寫入成功；AI 分析同確認信由 App.tsx 喺成功後先觸發
      setStatusMessage('☁️ 正在儲存案件，並由 Gemini AI 分析傷勢...');
      const saveSuccess = await onSubmitReport(newReport);

      if (!saveSuccess) {
        setSubmitError('案件儲存失敗，請稍後再試一次。');
        return;
      }
    } catch (err: any) {
      console.error('Submit report error:', err);
      setSubmitError(err?.message || '通報送出時發生問題，請檢查後重試。');
    } finally {
      setIsSubmitting(false);
      setStatusMessage('');
      refreshCaptcha();
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 sm:p-8" id="report-form-container">
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          個案即時通報 (P0 核心流程)
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
          通報流浪／受傷動物個案
        </h2>
        <p className="text-sm text-stone-600 mt-1">
          拍攝現場照片並標記位置，Gemini 多模態 AI 將即時評估傷勢緊急程度，照片將自動壓縮上傳至 Cloud Storage 物件儲存，並即時媒合 Firestore 合作 NGO 機構。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Animal Category */}
        <div className="rounded-2xl border-2 border-stone-200 bg-stone-50/60 p-4 sm:p-5 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-stone-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                1
              </span>
              <h3 className="text-sm font-bold text-stone-900">動物類別確認</h3>
            </div>
            <span className="text-2xs font-medium text-stone-600 bg-white px-2.5 py-0.5 rounded-full border border-stone-200">
              有助加速 NGO 派遣專業隊伍
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            <button
              type="button"
              onClick={() => setAnimalType('cat')}
              className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                animalType === 'cat'
                  ? 'border-amber-500 bg-amber-50/80 text-amber-950 font-bold shadow-xs'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
              }`}
            >
              <span className="text-2xl">🐱</span>
              <span className="text-xs">流浪貓咪 (Cat)</span>
            </button>

            <button
              type="button"
              onClick={() => setAnimalType('dog')}
              className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                animalType === 'dog'
                  ? 'border-amber-500 bg-amber-50/80 text-amber-950 font-bold shadow-xs'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
              }`}
            >
              <span className="text-2xl">🐶</span>
              <span className="text-xs">流浪狗隻 (Dog)</span>
            </button>

            <button
              type="button"
              onClick={() => setAnimalType('other')}
              className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                animalType === 'other'
                  ? 'border-amber-500 bg-amber-50/80 text-amber-950 font-bold shadow-xs'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
              }`}
            >
              <span className="text-2xl">🕊️</span>
              <span className="text-xs">其他／鳥類 (Other)</span>
            </button>
          </div>

          {animalType === 'other' && (
            <div>
              <input
                type="text"
                value={customAnimalName}
                onChange={(e) => setCustomAnimalName(e.target.value)}
                placeholder="請備註物種名稱（例如：白鴿、八哥、刺蝟、天竺鼠）"
                className="w-full p-2.5 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}
        </div>

        {/* Section 2: Photo Upload & Compression */}
        <div className="rounded-2xl border-2 border-stone-200 bg-stone-50/60 p-4 sm:p-5 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-stone-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                2
              </span>
              <h3 className="text-sm font-bold text-stone-900">
                現場動物照片 (自動壓縮 + Cloud Storage 儲存)
              </h3>
            </div>
            <span className="text-2xs font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
              必須提供
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="w-full sm:w-48 h-40 rounded-2xl overflow-hidden bg-stone-200 border-2 border-stone-300/80 shrink-0 relative group shadow-2xs">
              {photoPreview ? (
                <img src={photoPreview} alt="現場照片預覽" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 gap-1.5 p-3 text-center">
                  <Camera className="w-8 h-8" />
                  <span className="text-2xs font-medium">請選擇照片或拍照</span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2.5 w-full">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,.heic,.heif"
                className="hidden"
                id="file-upload-input"
              />

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  選擇手機／電腦照片
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-bold flex items-center gap-2 transition-colors shadow-2xs cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-stone-600" />
                  拍照上傳
                </button>
              </div>

              <p className="text-2xs text-stone-500 leading-relaxed">
                📌 提示：請拍攝動物受傷部位或整體身形。照片將先進行前端 Canvas 智慧壓縮以節省您的手機數據流量，並由 Firebase Cloud Storage 永久託管。
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Location */}
        <div className="rounded-2xl border-2 border-stone-200 bg-stone-50/60 p-4 sm:p-5 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-stone-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                3
              </span>
              <h3 className="text-sm font-bold text-stone-900">
                發現位置標註 (自動比對鄰近救助隊)
              </h3>
            </div>
            <button
              type="button"
              onClick={handleGetCurrentLocation}
              disabled={isGeolocating}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-2xs font-bold transition-colors cursor-pointer"
            >
              {isGeolocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
              取得 GPS 定位
            </button>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <AddressAutocomplete
                value={manualAddressInput}
                onChange={setManualAddressInput}
                onSelect={handleSelectPlace}
                onEnter={handleSearchManualAddress}
                bias={locationConfirmed ? { lat: location.lat, lng: location.lng } : null}
                placeholder="輸入地址或地標，例如：旺角朗豪坊、Shibuya Station、Times Square"
              />
            </div>
            <button
              type="button"
              onClick={handleSearchManualAddress}
              disabled={isSearchingAddress}
              className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
            >
              {isSearchingAddress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              定位
            </button>
          </div>
          {locationConfirmed ? (
            <div className="p-3 bg-white border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-stone-800 truncate">
                  已設定位置：<strong>{location.address}</strong>
                  {location.district && <span className="text-stone-500">（{location.district}）</span>}
                </span>
              </div>
              <span className="text-2xs text-stone-500 shrink-0 ml-2 font-mono">
                ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})
              </span>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>尚未確認位置：請撳「取得 GPS 定位」，或者喺上面地址欄輸入並揀一個建議地址。</span>
            </div>
          )}
        </div>

        {/* Section 4: Notes and Reporter details */}
        <div className="rounded-2xl border-2 border-stone-200 bg-stone-50/60 p-4 sm:p-5 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-stone-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                4
              </span>
              <h3 className="text-sm font-bold text-stone-900">
                現場狀況描述與通報者聯絡信箱
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-2xs text-stone-700 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                匿名通報 (隱藏稱呼與電話)
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                現場狀況描述／傷病觀察 *
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例如：貓咪縮在花槽，左腳不敢著地；或狗隻疑似被車擦撞倒地，呼吸急促..."
                className="w-full p-3 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                required
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5 flex items-center justify-between">
                  <span>
                    電子郵件 <span className="text-rose-600">*</span> (接收立案確認信與 CASE ID 追蹤進度)
                  </span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={reporterEmail}
                    onChange={(e) => setReporterEmail(e.target.value)}
                    placeholder="例如：user@example.com"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                    required
                  />
                </div>
              </div>

              {!isAnonymous && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      聯絡電話 (NGO聯絡)
                    </label>
                    <input
                      type="tel"
                      value={reporterPhone}
                      onChange={(e) => setReporterPhone(e.target.value)}
                      placeholder="+852 9123 4567"
                      className="w-full p-2.5 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">稱呼 (選填)</label>
                    <input
                      type="text"
                      value={reporterName}
                      onChange={(e) => setReporterName(e.target.value)}
                      placeholder="陳先生"
                      className="w-full p-2.5 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 5: Anti-Abuse & Privacy Statement */}
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-xs font-bold text-stone-900">防濫用機制 (Anti-Spam Verification)</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-2xs text-stone-600">請輸入右方驗證碼：</span>
              <div className="px-3 py-1 bg-stone-900 text-amber-300 font-mono font-bold tracking-widest text-sm rounded-lg shadow-inner select-none">
                {captchaCode}
              </div>
              <button
                type="button"
                onClick={refreshCaptcha}
                className="p-1 rounded-lg hover:bg-stone-200 text-stone-500 transition-colors cursor-pointer"
                title="更換驗證碼"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <input
                type="text"
                maxLength={4}
                value={userCaptchaInput}
                onChange={(e) => setUserCaptchaInput(e.target.value.toUpperCase())}
                placeholder="4位代碼"
                className="w-20 p-1.5 text-xs uppercase font-mono font-bold text-center bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
          </div>

          <div className="pt-2 border-t border-stone-200/80 flex items-start gap-2">
            <input
              type="checkbox"
              id="privacy-consent"
              checked={agreedPrivacy}
              onChange={(e) => setAgreedPrivacy(e.target.checked)}
              className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
              required
            />
            <label htmlFor="privacy-consent" className="text-2xs text-stone-600 leading-relaxed cursor-pointer">
              本人同意提供上述資料，並明瞭：動物相片、發現位置及狀況描述會<strong>公開顯示</strong>於地圖及個案列表；
              稱呼、電話及電郵<strong>不會公開</strong>，只供管理員及受委託救援機構聯絡之用；相片及描述會交由 Google Gemini AI 作初步分析。同時理解{' '}
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="text-amber-700 font-bold underline hover:text-amber-800 cursor-pointer"
              >
                AI 傷病分診免責聲明與個人資料收集聲明 (PICS)
              </button>
              。
            </label>
          </div>
        </div>

        {/* Submission error */}
        {submitError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Live Status indicator if processing */}
        {statusMessage && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center gap-2">
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
            ) : (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          id="btn-submit-report"
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600 hover:opacity-95 text-white font-bold text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>正在上傳照片及儲存案件，AI 將自動分析傷勢...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>立即送出通報 ＋ 啟動 AI 智能判斷與 NGO 媒合</span>
            </>
          )}
        </button>
      </form>

      {/* PICS & AI Disclaimer Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-stone-200 space-y-4 max-h-[85vh] overflow-y-auto text-xs text-stone-700">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-sm text-stone-900">法律私隱與 AI 獸醫免責聲明</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="text-stone-400 hover:text-stone-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 leading-relaxed">
              <div>
                <h4 className="font-bold text-stone-900 mb-1">1. 收集個人資料聲明 (PICS)</h4>
                <p>
                  我們依照閣下所在地適用的個人資料保護法例（例如香港《個人資料（私隱）條例》、歐盟 GDPR）處理閣下的資料。
                  稱呼、電話及電郵只用於本平台及受委託動物福利機構聯絡閣下、確認動物位置及跟進救援進度，不會公開，亦不會出售或用於商業推廣。
                  動物相片、位置及描述會公開顯示，以便救援人員及義工協助；請避免拍攝人面、車牌或住宅門牌。相片及描述會傳送至 Google Gemini 作 AI 分析。
                  如需查閱或刪除閣下的資料，請聯絡平台管理員。
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 mb-1">2. AI 傷病判斷免責條款</h4>
                <p>
                  PawPulse 採用的 Google Gemini 多模態 AI 分析系統，旨在協助市民與搜救隊進行初步急診分診（P0/P1/P2）與裝備準備建議，<strong>絕非註冊獸醫之正式醫學診斷</strong>。
                </p>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
                <h4 className="font-bold mb-1 flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4 text-rose-600" />
                  極度危急 (P0) 個案指引
                </h4>
                <p className="text-2xs leading-relaxed">
                  若動物出現大出血、被車撞昏迷、肢體嚴重骨折或呼吸困難，請勿等待應用程式回覆，
                  {(() => {
                    const c = getEmergencyContact();
                    return c
                      ? <>建議直接致電 {c.name} <strong>{c.phone}</strong> 尋求即時救助。</>
                      : <>請直接聯絡當地動物救援機構、獸醫診所或警方。</>;
                  })()}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPrivacyModal(false)}
              className="w-full py-2.5 rounded-xl bg-stone-900 text-white font-bold text-xs cursor-pointer"
            >
              我已理解並關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
