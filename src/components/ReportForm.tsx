import React, { useState, useRef, useEffect } from 'react';
import { AnimalType, LocationCoords, StrayReport, NGOOrganization } from '../types';
import { PRESET_LOCATIONS, geocodeAddressQuery, reverseGeocodeCoords } from '../utils/location';
import AddressAutocomplete from './AddressAutocomplete';
import { CatIcon, DogIcon, BirdIcon } from './AnimalIcons';
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
  Check,
  Loader2,
  Mail,
  ArrowRight,
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

const inputClass =
  'w-full px-3 py-2.5 text-sm bg-white border border-stone-200 rounded-lg placeholder:text-stone-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 transition-shadow';

const RequiredTag: React.FC = () => (
  <span className="text-2xs font-medium text-stone-500 px-2 py-0.5 rounded-full border border-stone-200">必填</span>
);

// 冇外框嘅表單分節：標題＋說明，右上角可以放額外操作
const FormSection: React.FC<{
  title: string;
  hint?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, hint, aside, children }) => (
  <section className="py-6 border-b border-stone-200 first:pt-0 last:border-0">
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h3 className="text-[28px] leading-tight font-bold text-stone-900">{title}</h3>
        {hint && <p className="text-xs text-stone-500 mt-1">{hint}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
    {children}
  </section>
);

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
      setStatusMessage('壓縮緊相片…');
      const { blob, dataUrl } = await compressImage(file, 1280, 1280, 0.82);
      setPhotoPreview(dataUrl);
      setPhotoBlob(blob);
      setStatusMessage('✓ 相片已準備好');
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
    setStatusMessage('準備緊資料…');
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
        setStatusMessage('上傳緊相片…');
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
      setStatusMessage('儲存緊個案，AI 分析緊傷勢…');
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

  const animalLabel =
    animalType === 'cat' ? '貓' : animalType === 'dog' ? '狗' : customAnimalName.trim() || '其他／雀鳥';

  const checklist: { label: string; value: string; done: boolean }[] = [
    { label: '動物', value: animalLabel, done: true },
    { label: '相片', value: photoPreview ? '已加入' : '未加入', done: !!photoPreview },
    { label: '位置', value: locationConfirmed ? location.address : '未確認', done: locationConfirmed },
    { label: '現場狀況', value: description.trim() ? '已填寫' : '未填寫', done: !!description.trim() },
    { label: '電郵', value: reporterEmail.trim() || '未填寫', done: !!reporterEmail.trim() },
  ];

  return (
    <div id="report-form-container">
      <form
        onSubmit={handleSubmit}
        className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-8 lg:gap-12 items-start"
      >
        {/* 左欄：表單 */}
        <div>
          <FormSection title="動物" hint="幫 NGO 預備合適嘅人手同工具">
            <div className="grid grid-cols-3 gap-3 max-w-md">
              {([
                ['cat', CatIcon, '貓'],
                ['dog', DogIcon, '狗'],
                ['other', BirdIcon, '其他／雀鳥'],
              ] as const).map(([type, Icon, label]) => {
                const selected = animalType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAnimalType(type)}
                    aria-pressed={selected}
                    className={`group py-4 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                      selected
                        ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                        : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <Icon
                      active={selected}
                      className="w-14 h-14 text-stone-900 transition-transform group-hover:scale-105"
                    />
                    <span className={`text-sm ${selected ? 'font-semibold text-stone-900' : 'text-stone-600'}`}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>

            {animalType === 'other' && (
              <input
                type="text"
                value={customAnimalName}
                onChange={(e) => setCustomAnimalName(e.target.value)}
                placeholder="物種名稱（選填），例如：白鴿、八哥、刺蝟"
                className={`${inputClass} mt-3`}
              />
            )}
          </FormSection>

          <FormSection
            title="相片"
            hint="影受傷位置或者成隻動物，相片會自動壓縮"
            aside={<RequiredTag />}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,.heic,.heif"
              className="hidden"
              id="file-upload-input"
            />
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-28 h-28 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0 flex items-center justify-center text-stone-400 hover:bg-stone-200/60 transition-colors cursor-pointer"
                aria-label="選擇相片"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="現場相片預覽" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-7 h-7 text-brand-400" strokeWidth={1.5} />
                )}
              </button>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-lg bg-stone-900 hover:bg-black text-white text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  {photoPreview ? '換一張相' : '選擇相片'}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-800 text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-brand-500" />
                  影相
                </button>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="位置"
            hint="用嚟配對附近嘅救助隊"
            aside={
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={isGeolocating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-medium transition-colors disabled:opacity-60 cursor-pointer"
              >
                {isGeolocating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" /> : <LocateFixed className="w-3.5 h-3.5 text-brand-500" />}
                用 GPS 定位
              </button>
            }
          >
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <AddressAutocomplete
                  value={manualAddressInput}
                  onChange={setManualAddressInput}
                  onSelect={handleSelectPlace}
                  onEnter={handleSearchManualAddress}
                  bias={locationConfirmed ? { lat: location.lat, lng: location.lng } : null}
                  placeholder="輸入地址或地標，例如：旺角朗豪坊"
                />
              </div>
              <button
                type="button"
                onClick={handleSearchManualAddress}
                disabled={isSearchingAddress}
                className="px-4 rounded-lg bg-stone-900 hover:bg-black text-white text-sm font-medium flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-60 cursor-pointer"
              >
                {isSearchingAddress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                定位
              </button>
            </div>

            {locationConfirmed ? (
              <div className="mt-3 flex items-center gap-2 text-sm min-w-0">
                <MapPin className="w-4 h-4 text-brand-500 shrink-0" />
                <span className="truncate">
                  {location.address}
                  {location.district && <span className="text-stone-500">（{location.district}）</span>}
                </span>
                <span className="ml-auto pl-2 text-2xs text-stone-400 font-mono shrink-0">
                  {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </span>
              </div>
            ) : (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-stone-500">
                <AlertCircle className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                未確認位置：撳「用 GPS 定位」，或者輸入地址再揀一個建議。
              </p>
            )}
          </FormSection>

          <FormSection title="現場狀況" hint="動物喺邊、有咩傷、精神狀態點" aside={<RequiredTag />}>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：貓咪縮喺花槽，左腳唔敢落地；或者狗疑似俾車撞到，呼吸急促…"
              className={`${inputClass} resize-y`}
              required
            />
          </FormSection>

          <FormSection
            title="聯絡資料"
            hint="唔會公開，只供管理員同救援機構聯絡你"
            aside={
              <label className="flex items-center gap-1.5 text-xs text-stone-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded accent-brand-500"
                />
                匿名通報
              </label>
            }
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  電郵 <span className="text-rose-600">*</span>
                  <span className="ml-1.5 font-normal text-stone-400">接收確認信同追蹤連結</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-brand-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={reporterEmail}
                    onChange={(e) => setReporterEmail(e.target.value)}
                    placeholder="user@example.com"
                    className={`${inputClass} pl-9`}
                    required
                  />
                </div>
              </div>

              {!isAnonymous && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">電話（選填）</label>
                    <input
                      type="tel"
                      value={reporterPhone}
                      onChange={(e) => setReporterPhone(e.target.value)}
                      placeholder="+852 9123 4567"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">稱呼（選填）</label>
                    <input
                      type="text"
                      value={reporterName}
                      onChange={(e) => setReporterName(e.target.value)}
                      placeholder="陳先生"
                      className={inputClass}
                    />
                  </div>
                </div>
              )}
            </div>
          </FormSection>
        </div>

        {/* 右欄：摘要＋送出 */}
        <aside className="lg:sticky lg:top-24 rounded-2xl border border-stone-200 bg-stone-50 p-5 space-y-5">
          <div className="hidden lg:flex aspect-[4/3] rounded-xl overflow-hidden bg-stone-200/70 items-center justify-center text-stone-400">
            {photoPreview ? (
              <img src={photoPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-8 h-8 text-brand-400" strokeWidth={1.5} />
            )}
          </div>

          <ul className="space-y-2.5">
            {checklist.map(({ label, value, done }) => (
              <li key={label} className="flex items-center gap-2.5 text-sm">
                {done ? (
                  <span className="w-4 h-4 rounded-full bg-brand-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="w-4 h-4 rounded-full border-[1.5px] border-stone-300 shrink-0" />
                )}
                <span className="text-stone-500 shrink-0">{label}</span>
                <span className={`ml-auto truncate text-right ${done ? 'text-stone-900' : 'text-stone-400'}`}>{value}</span>
              </li>
            ))}
          </ul>

          <div className="pt-4 border-t border-stone-200">
            <label className="block text-xs font-medium text-stone-700 mb-1.5">驗證碼</label>
            <div className="flex items-center gap-2">
              <div className="px-3 py-2 bg-stone-900 text-white font-mono font-bold tracking-widest text-sm rounded-lg select-none">
                {captchaCode}
              </div>
              <button
                type="button"
                onClick={refreshCaptcha}
                className="p-2 rounded-lg hover:bg-stone-200 text-stone-500 transition-colors cursor-pointer"
                title="換一個驗證碼"
              >
                <RefreshCw className="w-4 h-4 text-brand-500" />
              </button>
              <input
                type="text"
                maxLength={4}
                value={userCaptchaInput}
                onChange={(e) => setUserCaptchaInput(e.target.value.toUpperCase())}
                placeholder="輸入 4 位"
                className={`${inputClass} flex-1 min-w-0 uppercase font-mono text-center`}
                required
              />
            </div>
          </div>

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="privacy-consent"
              checked={agreedPrivacy}
              onChange={(e) => setAgreedPrivacy(e.target.checked)}
              className="mt-0.5 rounded accent-brand-500 cursor-pointer"
              required
            />
            <label htmlFor="privacy-consent" className="text-2xs text-stone-500 leading-relaxed cursor-pointer">
              本人同意提供上述資料，並明瞭：動物相片、發現位置及狀況描述會<strong className="text-stone-700">公開顯示</strong>於地圖及個案列表；
              稱呼、電話及電郵<strong className="text-stone-700">不會公開</strong>，只供管理員及受委託救援機構聯絡之用；相片及描述會交由 Google Gemini AI 作初步分析。同時理解{' '}
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="text-stone-900 font-medium underline underline-offset-2 cursor-pointer"
              >
                AI 傷病分診免責聲明與個人資料收集聲明 (PICS)
              </button>
              。
            </label>
          </div>

          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {statusMessage && (
            <div className="p-3 bg-white border border-stone-200 text-stone-700 rounded-lg text-xs flex items-center gap-2">
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            id="btn-submit-report"
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                送出緊…
              </>
            ) : (
              <>
                送出通報
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </aside>
      </form>

      {/* PICS & AI Disclaimer Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-stone-200 space-y-4 max-h-[85vh] overflow-y-auto text-xs text-stone-700">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-600" />
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
