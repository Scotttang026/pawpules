import React, { useState, useRef, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { AnimalType, LocationCoords, StrayReport, NGOOrganization } from '../types';
import { PRESET_LOCATIONS, geocodeAddressQuery, reverseGeocodeCoords } from '../utils/location';
import AddressAutocomplete from './AddressAutocomplete';
import { CatIcon, DogIcon, BirdIcon } from './AnimalIcons';
import type { ResolvedAddress } from '../services/places';
import { compressImage, uploadAnimalPhoto } from '../utils/imageCompressor';
import { rankFirestoreNGOs } from '../services/caseService';
import { animalLabel } from '../utils/caseLabels';
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

const RequiredTag: React.FC = () => {
  const { t } = useTranslation();
  return (
    <span className="text-2xs font-medium text-stone-500 px-2 py-0.5 rounded-full border border-stone-200">
      {t('reportForm.required')}
    </span>
  );
};

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

export const ReportForm: React.FC<ReportFormProps> = ({ ngos, onSubmitReport, onAnalysisStart }) => {
  const { t } = useTranslation();
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
  // 儲存翻譯 key 而唔係文字，咁中途轉語言都會即刻跟住轉
  const [submitErrorKey, setSubmitErrorKey] = useState<string | null>(null);
  const [statusKey, setStatusKey] = useState<string | null>(null);

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

  // 用戶登入之後自動填電郵同稱呼
  useEffect(() => {
    if (user?.email) setReporterEmail(user.email);
    if (user?.displayName) setReporterName(user.displayName);
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const districtOrPending = (d?: string) => d || t('reportForm.location.districtPending');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setStatusKey('reportForm.progress.compressing');
      const { blob, dataUrl } = await compressImage(file, 1280, 1280, 0.82);
      setPhotoPreview(dataUrl);
      setPhotoBlob(blob);
      setStatusKey('reportForm.progress.photoReady');
    } catch (err: any) {
      console.warn('Image processing failed:', err?.message || err);
      alert(t('reportForm.errors.photoProcessFailed'));
      setStatusKey(null);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert(t('reportForm.errors.noGeolocation'));
      return;
    }

    setIsGeolocating(true);
    setStatusKey('reportForm.progress.gpsLocating');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const { address, district } = await reverseGeocodeCoords(latitude, longitude);
          setLocation({ lat: latitude, lng: longitude, address, district: districtOrPending(district) });
          setManualAddressInput(address);
          setLocationConfirmed(true);
          setStatusKey('reportForm.progress.gpsSuccess');
        } catch (err) {
          console.warn('Reverse geocode failed:', err);
          setStatusKey('reportForm.progress.gpsNoAddress');
        } finally {
          setIsGeolocating(false);
        }
      },
      (err) => {
        setIsGeolocating(false);
        setStatusKey(
          err.code === err.PERMISSION_DENIED ? 'reportForm.progress.gpsDenied' : 'reportForm.progress.gpsFailed'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleSearchManualAddress = async () => {
    const query = manualAddressInput.trim();
    if (!query) return;

    setIsSearchingAddress(true);
    setStatusKey('reportForm.progress.searching');
    try {
      const result = await geocodeAddressQuery(query);
      if (result) {
        setLocation({
          lat: result.lat,
          lng: result.lng,
          address: result.address,
          district: districtOrPending(result.district),
        });
        setLocationConfirmed(true);
        setStatusKey('reportForm.progress.found');
      } else {
        setStatusKey('reportForm.progress.notFound');
      }
    } catch (err) {
      console.warn('Geocode failed:', err);
      setStatusKey('reportForm.progress.searchUnavailable');
    } finally {
      setIsSearchingAddress(false);
    }
  };

  // 市民喺自動完成清單揀咗地址
  const handleSelectPlace = (p: ResolvedAddress) => {
    setLocation({ lat: p.lat, lng: p.lng, address: p.address, district: districtOrPending(p.district) });
    setManualAddressInput(p.address);
    setLocationConfirmed(true);
    setStatusKey('reportForm.progress.found');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitErrorKey(null);

    if (!photoBlob && !photoPreview) {
      alert(t('reportForm.errors.noPhoto'));
      return;
    }

    if (!description.trim()) {
      alert(t('reportForm.errors.noDescription'));
      return;
    }

    if (!locationConfirmed) {
      alert(t('reportForm.errors.noLocation'));
      return;
    }

    const phone = reporterPhone.trim();
    if (!isAnonymous && phone && !/^\+?[0-9 ()-]{6,30}$/.test(phone)) {
      alert(t('reportForm.errors.badPhone'));
      return;
    }

    if (userCaptchaInput.trim().toUpperCase() !== captchaCode.toUpperCase()) {
      alert(t('reportForm.errors.badCaptcha'));
      refreshCaptcha();
      return;
    }

    if (!agreedPrivacy) {
      alert(t('reportForm.errors.noConsent'));
      return;
    }

    setIsSubmitting(true);
    setStatusKey('reportForm.progress.preparing');
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
        setStatusKey('reportForm.progress.uploading');
        const uploadResult = await uploadAnimalPhoto(photoBlob, reportId, photoPreview);
        finalPhotoUrl = uploadResult.downloadUrl;
        finalStoragePath = uploadResult.storagePath;
      }

      // firestore.rules 限制 photoUrl 長度上限 2048；如果仲係 base64 dataURL 代表上傳未完成
      if (finalPhotoUrl.length > 2048) {
        setSubmitErrorKey('reportForm.errors.photoUrlTooLong');
        return;
      }

      // AI 分析改由 server 喺案件建立後執行（見 App.tsx），前端唔可以自訂緊急度
      const urgency = 'P1' as const;
      const matchedNGOs = rankFirestoreNGOs(ngos, location.lat, location.lng, animalType, urgency);

      const effectiveReporterName = isAnonymous ? '' : reporterName.trim();
      const effectiveReporterPhone = isAnonymous ? '' : phone;
      const effectiveReporterEmail = reporterEmail.trim();

      const newReport: StrayReport = {
        id: reportId,
        // 標題用報案人當時揀嘅語言；之後個案列表會改為顯示時即時砌出嚟
        title: t('reportForm.caseTitle', {
          district: districtOrPending(location.district),
          animal: animalLabel(animalType, customAnimalName),
        }),
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
      setStatusKey('reportForm.progress.saving');
      const saveSuccess = await onSubmitReport(newReport);

      if (!saveSuccess) {
        setSubmitErrorKey('reportForm.errors.saveFailed');
        return;
      }
    } catch (err: any) {
      console.error('Submit report error:', err);
      setSubmitErrorKey('reportForm.errors.submitFailed');
    } finally {
      setIsSubmitting(false);
      setStatusKey(null);
      refreshCaptcha();
    }
  };

  // 右欄摘要顯示嘅動物名
  const selectedAnimalText =
    animalType === 'other'
      ? customAnimalName.trim() || t('reportForm.animal.other')
      : t(`reportForm.animal.${animalType}`);

  const checklist: { id: string; label: string; value: string; done: boolean }[] = [
    { id: 'animal', label: t('reportForm.checklist.animal'), value: selectedAnimalText, done: true },
    {
      id: 'photo',
      label: t('reportForm.checklist.photo'),
      value: photoPreview ? t('reportForm.checklist.added') : t('reportForm.checklist.notAdded'),
      done: !!photoPreview,
    },
    {
      id: 'location',
      label: t('reportForm.checklist.location'),
      value: locationConfirmed ? location.address : t('reportForm.checklist.notConfirmed'),
      done: locationConfirmed,
    },
    {
      id: 'description',
      label: t('reportForm.checklist.description'),
      value: description.trim() ? t('reportForm.checklist.filled') : t('reportForm.checklist.notFilled'),
      done: !!description.trim(),
    },
    {
      id: 'email',
      label: t('reportForm.checklist.email'),
      value: reporterEmail.trim() || t('reportForm.checklist.notFilled'),
      done: !!reporterEmail.trim(),
    },
  ];

  const emergencyContact = getEmergencyContact();

  return (
    <div id="report-form-container">
      <form onSubmit={handleSubmit} className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-8 lg:gap-12 items-start">
        {/* 左欄：表單 */}
        <div>
          <FormSection title={t('reportForm.animal.title')} hint={t('reportForm.animal.hint')}>
            <div className="grid grid-cols-3 gap-3 max-w-md">
              {([
                ['cat', CatIcon],
                ['dog', DogIcon],
                ['other', BirdIcon],
              ] as const).map(([type, Icon]) => {
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
                    <Icon active={selected} className="w-14 h-14 text-stone-900 transition-transform group-hover:scale-105" />
                    <span className={`text-sm ${selected ? 'font-semibold text-stone-900' : 'text-stone-600'}`}>
                      {t(`reportForm.animal.${type}`)}
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
                placeholder={t('reportForm.animal.customPlaceholder')}
                className={`${inputClass} mt-3`}
              />
            )}
          </FormSection>

          <FormSection title={t('reportForm.photo.title')} hint={t('reportForm.photo.hint')} aside={<RequiredTag />}>
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
                aria-label={t('reportForm.photo.choose')}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt={t('reportForm.photo.previewAlt')} className="w-full h-full object-cover" />
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
                  {photoPreview ? t('reportForm.photo.change') : t('reportForm.photo.choose')}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-800 text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-brand-500" />
                  {t('reportForm.photo.take')}
                </button>
              </div>
            </div>
          </FormSection>

          <FormSection
            title={t('reportForm.location.title')}
            hint={t('reportForm.location.hint')}
            aside={
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={isGeolocating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-medium transition-colors disabled:opacity-60 cursor-pointer"
              >
                {isGeolocating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />
                ) : (
                  <LocateFixed className="w-3.5 h-3.5 text-brand-500" />
                )}
                {t('reportForm.location.gps')}
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
                  placeholder={t('reportForm.location.placeholder')}
                />
              </div>
              <button
                type="button"
                onClick={handleSearchManualAddress}
                disabled={isSearchingAddress}
                className="px-4 rounded-lg bg-stone-900 hover:bg-black text-white text-sm font-medium flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-60 cursor-pointer"
              >
                {isSearchingAddress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {t('reportForm.location.locate')}
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
                {t('reportForm.location.notConfirmed')}
              </p>
            )}
          </FormSection>

          <FormSection
            title={t('reportForm.description.title')}
            hint={t('reportForm.description.hint')}
            aside={<RequiredTag />}
          >
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('reportForm.description.placeholder')}
              className={`${inputClass} resize-y`}
              required
            />
          </FormSection>

          <FormSection
            title={t('reportForm.contact.title')}
            hint={t('reportForm.contact.hint')}
            aside={
              <label className="flex items-center gap-1.5 text-xs text-stone-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded accent-brand-500"
                />
                {t('reportForm.contact.anonymous')}
              </label>
            }
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  {t('reportForm.contact.email')} <span className="text-rose-600">*</span>
                  <span className="ml-1.5 font-normal text-stone-400">{t('reportForm.contact.emailHint')}</span>
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
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">{t('reportForm.contact.phone')}</label>
                    <input
                      type="tel"
                      value={reporterPhone}
                      onChange={(e) => setReporterPhone(e.target.value)}
                      placeholder={t('reportForm.contact.phonePlaceholder')}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">{t('reportForm.contact.name')}</label>
                    <input
                      type="text"
                      value={reporterName}
                      onChange={(e) => setReporterName(e.target.value)}
                      placeholder={t('reportForm.contact.namePlaceholder')}
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
            {checklist.map(({ id, label, value, done }) => (
              <li key={id} className="flex items-center gap-2.5 text-sm">
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
            <label className="block text-xs font-medium text-stone-700 mb-1.5">{t('reportForm.captcha.label')}</label>
            <div className="flex items-center gap-2">
              <div className="px-3 py-2 bg-stone-900 text-white font-mono font-bold tracking-widest text-sm rounded-lg select-none">
                {captchaCode}
              </div>
              <button
                type="button"
                onClick={refreshCaptcha}
                className="p-2 rounded-lg hover:bg-stone-200 text-stone-500 transition-colors cursor-pointer"
                title={t('reportForm.captcha.refresh')}
                aria-label={t('reportForm.captcha.refresh')}
              >
                <RefreshCw className="w-4 h-4 text-brand-500" />
              </button>
              <input
                type="text"
                maxLength={4}
                value={userCaptchaInput}
                onChange={(e) => setUserCaptchaInput(e.target.value.toUpperCase())}
                placeholder={t('reportForm.captcha.placeholder')}
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
              <Trans
                i18nKey="reportForm.consent"
                components={{
                  b: <strong className="text-stone-700" />,
                  link: (
                    <button
                      type="button"
                      onClick={() => setShowPrivacyModal(true)}
                      className="text-stone-900 font-medium underline underline-offset-2 cursor-pointer"
                    />
                  ),
                }}
              />
            </label>
          </div>

          {submitErrorKey && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{t(submitErrorKey)}</span>
            </div>
          )}

          {statusKey && (
            <div className="p-3 bg-white border border-stone-200 text-stone-700 rounded-lg text-xs flex items-center gap-2">
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span>{t(statusKey)}</span>
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
                {t('reportForm.submitting')}
              </>
            ) : (
              <>
                {t('reportForm.submit')}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </aside>
      </form>

      {/* 私隱聲明及 AI 免責聲明 */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-stone-200 space-y-4 max-h-[85vh] overflow-y-auto text-xs text-stone-700">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-sm text-stone-900">{t('reportForm.modal.title')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                aria-label={t('reportForm.modal.close')}
                className="text-stone-400 hover:text-stone-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 leading-relaxed">
              <div>
                <h4 className="font-bold text-stone-900 mb-1">{t('reportForm.modal.picsTitle')}</h4>
                <p>{t('reportForm.modal.picsBody')}</p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 mb-1">{t('reportForm.modal.aiTitle')}</h4>
                <p>
                  <Trans i18nKey="reportForm.modal.aiBody" components={{ b: <strong /> }} />
                </p>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
                <h4 className="font-bold mb-1 flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4 text-rose-600" />
                  {t('reportForm.modal.p0Title')}
                </h4>
                <p className="text-2xs leading-relaxed">
                  {t('reportForm.modal.p0Intro')}
                  {emergencyContact ? (
                    <Trans
                      i18nKey="reportForm.modal.p0Call"
                      values={{ name: emergencyContact.name, phone: emergencyContact.phone }}
                      components={{ b: <strong /> }}
                    />
                  ) : (
                    t('reportForm.modal.p0Local')
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPrivacyModal(false)}
              className="w-full py-2.5 rounded-xl bg-stone-900 text-white font-bold text-xs cursor-pointer"
            >
              {t('reportForm.modal.understood')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
