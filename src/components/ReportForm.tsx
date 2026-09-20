import React, { useState, useRef } from 'react';
import { AnimalType, LocationCoords, StrayReport } from '../types';
import { PRESET_LOCATIONS, reverseGeocodeCoords, geocodeAddressQuery } from '../utils/location';
import { Camera, Upload, MapPin, LocateFixed, Search, Sparkles, AlertCircle, Check, Loader2 } from 'lucide-react';

interface ReportFormProps {
  onSubmitReport: (newReport: StrayReport) => void;
  onAnalysisStart?: () => void;
}

// Preset demo images to let users quickly test the app without having to find a stray animal photo
const DEMO_PRESETS = [
  {
    name: '受傷小貓 (橘白貓)',
    animalType: 'cat' as AnimalType,
    url: 'https://images.unsplash.com/photo-1548802673-380ab8ebc7b7?auto=format&fit=crop&w=800&q=80',
    description: '後巷角落發現一隻幼貓，左前腿不敢著地，眼睛有黃色膿狀分泌物，一直發抖。',
    presetLoc: PRESET_LOCATIONS[0], // 旺角
  },
  {
    name: '路旁傷犬 (黑唐狗)',
    animalType: 'dog' as AnimalType,
    url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80',
    description: '單車徑邊草叢躺著一隻黑色中型唐狗，後腿有擦傷血痕，無法自行站起，呼吸急促。',
    presetLoc: PRESET_LOCATIONS[1], // 沙田
  },
  {
    name: '走失大狗 (金毛尋回犬)',
    animalType: 'dog' as AnimalType,
    url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80',
    description: '公車站旁有一隻戴項圈的金毛犬徘徊，無明顯外傷，但顯得焦慮口渴，需協尋主人。',
    presetLoc: PRESET_LOCATIONS[2], // 元朗
  },
];

export const ReportForm: React.FC<ReportFormProps> = ({ onSubmitReport, onAnalysisStart }) => {
  const [animalType, setAnimalType] = useState<AnimalType>('cat');
  const [customAnimalName, setCustomAnimalName] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string>(DEMO_PRESETS[0].url);
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [description, setDescription] = useState(DEMO_PRESETS[0].description);
  const [reporterName, setReporterName] = useState('熱心市民');
  const [reporterPhone, setReporterPhone] = useState('9123 4567');

  // Location state
  const [location, setLocation] = useState<LocationCoords>({
    lat: PRESET_LOCATIONS[0].lat,
    lng: PRESET_LOCATIONS[0].lng,
    address: PRESET_LOCATIONS[0].sampleAddress,
    district: PRESET_LOCATIONS[0].district,
  });
  const [manualAddressInput, setManualAddressInput] = useState(PRESET_LOCATIONS[0].sampleAddress);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // Submission / AI analysis state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle local file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPhotoPreview(result);
      setPhotoBase64(result);
    };
    reader.readAsDataURL(file);
  };

  // Select demo preset
  const handleSelectPreset = (preset: (typeof DEMO_PRESETS)[0]) => {
    setAnimalType(preset.animalType);
    setPhotoPreview(preset.url);
    setPhotoBase64(''); // Remote URL
    setDescription(preset.description);
    setLocation({
      lat: preset.presetLoc.lat,
      lng: preset.presetLoc.lng,
      address: preset.presetLoc.sampleAddress,
      district: preset.presetLoc.district,
    });
    setManualAddressInput(preset.presetLoc.sampleAddress);
  };

  // Browser GPS auto-locate
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('您的瀏覽器不支援地理定位');
      return;
    }

    setIsGeolocating(true);
    setStatusMessage('正在透過 GPS 定位目前位置...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const geocoded = await reverseGeocodeCoords(lat, lng);

        setLocation({
          lat,
          lng,
          address: geocoded.address,
          district: geocoded.district,
        });
        setManualAddressInput(geocoded.address);
        setIsGeolocating(false);
        setStatusMessage('✓ 已成功取得當前 GPS 位置');
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setIsGeolocating(false);
        setStatusMessage('無法取得 GPS 定位，請由下方選取或手動輸入地址');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Search manual address
  const handleSearchAddress = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualAddressInput.trim()) return;

    setIsSearchingAddress(true);
    setStatusMessage('正在搜尋地址座標...');

    const result = await geocodeAddressQuery(manualAddressInput.trim());
    if (result) {
      setLocation({
        lat: result.lat,
        lng: result.lng,
        address: result.address,
        district: '定位搜尋點',
      });
      setStatusMessage('✓ 已找到地址位置');
    } else {
      setStatusMessage('未能解析精確經緯度，已直接保存地址名稱');
      setLocation((prev) => ({
        ...prev,
        address: manualAddressInput.trim(),
      }));
    }
    setIsSearchingAddress(false);
  };

  // Choose preset quick location
  const handleSelectPresetLocation = (preset: (typeof PRESET_LOCATIONS)[0]) => {
    setLocation({
      lat: preset.lat,
      lng: preset.lng,
      address: preset.sampleAddress,
      district: preset.district,
    });
    setManualAddressInput(preset.sampleAddress);
  };

  // Convert image URL to base64 if needed
  const getBase64FromUrl = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch {
      return '';
    }
  };

  // Submit report
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoPreview) {
      alert('請先上傳動物照片或選擇示範圖片');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('🚀 正在由 Google Gemini 多模態 AI 分析動物傷病與危急程度...');
    if (onAnalysisStart) onAnalysisStart();

    try {
      let finalBase64 = photoBase64;
      if (!finalBase64 && photoPreview.startsWith('http')) {
        finalBase64 = await getBase64FromUrl(photoPreview);
      }

      // Call AI analysis backend
      let aiResult = null;
      try {
        const aiResponse = await fetch('/api/ai/analyze-stray', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: finalBase64 || '',
            animalTypeHint: animalType,
            description,
          }),
        });

        if (aiResponse.ok) {
          aiResult = await aiResponse.json();
        }
      } catch (aiErr) {
        console.warn('AI analysis call failed, proceeding with fallback:', aiErr);
      }

      const reportId = `PW-${Date.now().toString(36).toUpperCase()}`;
      const urgency = aiResult?.urgencyLevel || 'P1';

      // Match NGOs for this report
      const matchedRes = await fetch(
        `/api/ngos?lat=${location.lat}&lng=${location.lng}&animalType=${animalType}&urgency=${urgency}`
      );
      const matchedNGOs = matchedRes.ok ? await matchedRes.json() : [];

      const newReport: StrayReport = {
        id: reportId,
        title: `${location.district || '市區'} - ${animalType === 'cat' ? '流浪貓' : animalType === 'dog' ? '流浪狗' : '動物'}通報`,
        animalType,
        customAnimalName: customAnimalName.trim() || undefined,
        photoUrl: photoPreview,
        location,
        description: description.trim(),
        reporterName: reporterName.trim() || '熱心市民',
        reporterPhone: reporterPhone.trim() || '未填寫',
        createdAt: new Date().toISOString(),
        status: 'analyzed',
        urgency,
        aiAnalysis: aiResult,
        matchedNGOs: matchedNGOs.slice(0, 3),
      };

      onSubmitReport(newReport);
    } catch (err: any) {
      console.error('Submit report error:', err);
      alert('通報送出時發生問題，請檢查後重試。');
    } finally {
      setIsSubmitting(false);
      setStatusMessage('');
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
          上傳現場照片與位置，Gemini 多模態 AI 將即時評估傷勢緊急程度，並立即自動媒合最近合適 NGO 機構。
        </p>
      </div>

      {/* Quick Demo Cases Selector */}
      <div className="mb-6 p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80">
        <span className="text-xs font-bold text-amber-900 block mb-2">
          💡 快速體驗：點選載入典型測試情境
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {DEMO_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-amber-200/70 hover:border-amber-400 text-left transition-colors shadow-2xs group"
            >
              <img
                src={preset.url}
                alt={preset.name}
                className="w-10 h-10 rounded-lg object-cover group-hover:scale-105 transition-transform"
                referrerPolicy="no-referrer"
              />
              <div className="overflow-hidden">
                <span className="text-xs font-bold text-stone-800 block truncate">{preset.name}</span>
                <span className="text-[11px] text-stone-500 block truncate">{preset.presetLoc.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Section 1: Animal Category */}
        <div className="rounded-2xl border-2 border-stone-200 bg-stone-50/60 p-4 sm:p-5 shadow-xs space-y-3.5" id="section-animal-type">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-stone-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                1
              </span>
              <h3 className="text-sm font-bold text-stone-900">
                救助動物種類
              </h3>
            </div>
            <span className="text-[11px] font-medium text-stone-600 bg-white px-2.5 py-0.5 rounded-full border border-stone-200">
              現階段以貓、狗為主
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { type: 'cat' as AnimalType, label: '貓咪 (Cat)', emoji: '🐱' },
              { type: 'dog' as AnimalType, label: '犬隻 (Dog)', emoji: '🐶' },
              { type: 'other' as AnimalType, label: '其他物種', emoji: '🐾' },
            ].map((item) => (
              <button
                key={item.type}
                type="button"
                id={`animal-type-${item.type}`}
                onClick={() => setAnimalType(item.type)}
                className={`py-3 px-4 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  animalType === item.type
                    ? 'border-amber-500 bg-amber-500 text-white font-bold shadow-sm ring-2 ring-amber-300'
                    : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50 hover:border-stone-400 font-medium'
                }`}
              >
                <span className="text-2xl">{item.emoji}</span>
                <span className="text-xs">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Photo Upload & Preview */}
        <div className="rounded-2xl border-2 border-stone-200 bg-stone-50/60 p-4 sm:p-5 shadow-xs space-y-3.5" id="section-photo-upload">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-stone-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                2
              </span>
              <h3 className="text-sm font-bold text-stone-900">
                現場照片
              </h3>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-300">
              <Sparkles className="w-3 h-3 text-amber-600" />
              AI 傷勢診斷核心依據
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Photo preview */}
            <div className="md:col-span-5">
              <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-white border-2 border-dashed border-stone-300 flex items-center justify-center group shadow-2xs">
                {photoPreview ? (
                  <>
                    <img
                      src={photoPreview}
                      alt="動物照片"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-white text-stone-900 rounded-lg text-xs font-bold shadow-md hover:bg-stone-50"
                      >
                        更換照片
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4">
                    <Camera className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                    <p className="text-xs text-stone-500 font-medium">請拍攝或上傳清晰動物照片</p>
                  </div>
                )}
              </div>
            </div>

            {/* Upload buttons & instructions */}
            <div className="md:col-span-7 space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
                id="photo-upload-input"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  id="btn-select-file"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-bold transition-colors shadow-2xs"
                >
                  <Upload className="w-4 h-4 text-stone-600" />
                  上傳手機相簿照片
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.setAttribute('capture', 'environment');
                    fileInputRef.current?.click();
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-bold transition-colors shadow-2xs"
                >
                  <Camera className="w-4 h-4 text-amber-600" />
                  即時拍照
                </button>
              </div>

              <div className="text-xs text-stone-600 bg-white p-3 rounded-xl border border-stone-200 leading-relaxed shadow-2xs">
                <strong className="text-stone-800">拍攝指引：</strong>
                請盡量拍攝動物全身、患處（如有外傷、骨折、皮膚病）及周遭環境，以協助 Gemini AI 判讀 P0 / P1 緊急程度。
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Geolocation */}
        <div className="rounded-2xl border-2 border-stone-200 bg-stone-50/60 p-4 sm:p-5 shadow-xs space-y-3.5" id="section-geolocation">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-stone-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                3
              </span>
              <h3 className="text-sm font-bold text-stone-900">
                地理定位
              </h3>
            </div>
            <button
              type="button"
              onClick={handleGetCurrentLocation}
              disabled={isGeolocating}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-white hover:bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
              id="btn-get-current-location"
            >
              <LocateFixed className={`w-3.5 h-3.5 text-amber-600 ${isGeolocating ? 'animate-spin' : ''}`} />
              {isGeolocating ? '定位中...' : '使用當前 GPS 定位'}
            </button>
          </div>

          {/* Address input with search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MapPin className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                value={manualAddressInput}
                onChange={(e) => setManualAddressInput(e.target.value)}
                placeholder="輸入精確地址、街名或鄰近地標..."
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                id="input-address"
              />
            </div>
            <button
              type="button"
              onClick={() => handleSearchAddress()}
              disabled={isSearchingAddress}
              className="px-4 py-2 text-xs font-bold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl transition-colors shrink-0 flex items-center gap-1 shadow-2xs"
            >
              <Search className="w-3.5 h-3.5" />
              {isSearchingAddress ? '搜尋中' : '地標定位'}
            </button>
          </div>

          {/* Quick district selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs text-stone-600">
            <span className="text-[11px] font-semibold text-stone-400 shrink-0">快速選取地區：</span>
            {PRESET_LOCATIONS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPresetLocation(preset)}
                className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap border transition-colors ${
                  location.address === preset.sampleAddress
                    ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold shadow-2xs'
                    : 'bg-white border-stone-200 hover:bg-stone-100 text-stone-700'
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>

          {/* Selected Location Pill */}
          <div className="p-2.5 rounded-xl bg-white border border-stone-200 flex items-center justify-between text-xs shadow-2xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="text-stone-800 font-medium truncate">
                已設定地點：<strong className="text-stone-900">{location.address}</strong>
              </span>
            </div>
            <span className="text-[11px] text-stone-500 shrink-0 ml-2 font-mono">
              ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})
            </span>
          </div>
        </div>

        {/* Section 4: Notes and Reporter details */}
        <div className="rounded-2xl border-2 border-stone-200 bg-stone-50/60 p-4 sm:p-5 shadow-xs space-y-3.5" id="section-details-contact">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-stone-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                4
              </span>
              <h3 className="text-sm font-bold text-stone-900">
                現場狀況描述與通報人資料
              </h3>
            </div>
            <span className="text-[11px] font-medium text-stone-600 bg-white px-2.5 py-0.5 rounded-full border border-stone-200">
              供 NGO 救助隊評估裝備與出動聯繫
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                現場狀況描述／傷病觀察
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例如：貓咪縮在花槽，左腳不敢著地；或狗隻疑似被車擦撞倒地，呼吸急促..."
                className="w-full p-3 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                id="input-description"
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  通報人聯絡電話 <span className="text-rose-600">*</span> (方便 NGO 義工現場聯繫)
                </label>
                <input
                  type="tel"
                  value={reporterPhone}
                  onChange={(e) => setReporterPhone(e.target.value)}
                  placeholder="例如：9123 4567"
                  className="w-full p-2.5 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  id="input-phone"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  通報人稱呼 (選填)
                </label>
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="例如：陳先生 / 李小姐"
                  className="w-full p-2.5 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  id="input-reporter-name"
                />
              </div>
            </div>
          </div>
        </div>

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
              <span>AI 多模態分析傷勢與媒合中，請稍候...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>立即送出通報 ＋ 啟動 AI 智能判斷與 NGO 媒合</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
