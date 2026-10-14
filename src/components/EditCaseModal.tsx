import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Loader2, Search, MapPin, Pencil, AlertCircle, RotateCcw } from 'lucide-react';
import type { AnimalType, CaseTag, LocationCoords, StrayReport } from '../types';
import AddressAutocomplete from './AddressAutocomplete';
import type { ResolvedAddress } from '../services/places';
import { geocodeAddressQuery } from '../utils/location';
import { getBrowserLanguage } from '../utils/locale';
import { compressImage, uploadAnimalPhoto, PhotoError } from '../utils/imageCompressor';
import { MAX_CASE_PHOTOS, MAX_STORED_PHOTOS, getCasePhotos } from '../utils/casePhotos';
import { CASE_TAGS, tagLabel, applyTagLine, stripTagLine, animalLabel } from '../utils/caseLabels';
import { editCase } from '../services/caseService';
import { getEditState } from '../utils/caseEdit';

interface PendingPhoto {
  id: string;
  blob: Blob;
  dataUrl: string;
}

let seq = 0;
const nextId = () => `e${Date.now().toString(36)}-${seq++}`;

const SERVER_CODES = new Set([
  'unauthenticated', 'not_owner', 'case_accepted', 'case_locked',
  'edit_expired', 'edit_used', 'bad_photos', 'bad_input', 'not_found',
]);

const inputClass =
  'w-full px-3 py-2.5 text-sm bg-white border border-stone-200 rounded-lg placeholder:text-stone-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10';

// animal-reports/{caseId}/{0-9}.jpg → 0–9；舊格式／唔啱格式回傳 null
const pathIndex = (p: string): number | null => {
  const m = /\/([0-9])\.jpg$/.exec(p);
  return m ? Number(m[1]) : null;
};

// 「我的案件」卡片用：顯示「修改」掣，或者點解唔可以改
export const EditCaseAction: React.FC<{ report: StrayReport; onEdit: (r: StrayReport) => void }> = ({
  report,
  onEdit,
}) => {
  const { t } = useTranslation();
  const state = getEditState(report);
  if (state !== 'editable') {
    return <p className="text-2xs text-stone-400">{t(`editCase.states.${state}`)}</p>;
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onEdit(report);
      }}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-medium cursor-pointer"
    >
      <Pencil className="w-3.5 h-3.5 text-brand-500" />
      {t('editCase.button')}
    </button>
  );
};

interface Props {
  report: StrayReport;
  onClose: () => void;
  onSaved: (messageKey: string) => void;
}

const EditCaseModal: React.FC<Props> = ({ report, onClose, onSaved }) => {
  const { t } = useTranslation();
  const existing = getCasePhotos(report);

  const [animalType, setAnimalType] = useState<AnimalType>(report.animalType);
  const [customAnimalName, setCustomAnimalName] = useState(report.customAnimalName ?? '');
  const [tags, setTags] = useState<CaseTag[]>((report.tags ?? []) as CaseTag[]);
  const [description, setDescription] = useState(report.description);
  const [location, setLocation] = useState<LocationCoords>(report.location);
  const [addressInput, setAddressInput] = useState(report.location.address);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  // 移走咗嘅舊相（只係唔再顯示；Storage 保留）
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [statusKey, setStatusKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  // 上載咗嘅新相：pendingId → path（重試時唔使再上載；Storage 唔准覆蓋）
  const uploadedRef = useRef(new Map<string, string>());
  const fileRef = useRef<HTMLInputElement>(null);

  const kept = existing.filter((p) => !removed.has(p.path));
  const removedList = existing.filter((p) => removed.has(p.path));

  // 已經用咗嘅 Storage 位：所有舊相（包括移走咗嘅）+ 今次已上載嘅新相
  const usedSlots = new Set<number>(
    [...existing.map((p) => p.path), ...uploadedRef.current.values()]
      .map(pathIndex)
      .filter((n): n is number => n !== null)
  );
  const freeSlots = Array.from({ length: MAX_STORED_PHOTOS }, (_, i) => i).filter((i) => !usedSlots.has(i));
  const notYetUploaded = pending.filter((p) => !uploadedRef.current.has(p.id));
  const total = kept.length + pending.length;
  const canAdd = total < MAX_CASE_PHOTOS && notYetUploaded.length < freeSlots.length;
    // 揀咗標籤或者有打字，其中一樣就得（同報案表單一致）
  const hasDescription = tags.length > 0 || !!stripTagLine(description).trim();

  const removeExisting = (path: string) => {
    setRemoved((prev) => new Set(prev).add(path));
  };

  const restoreExisting = (path: string) => {
    if (total >= MAX_CASE_PHOTOS) {
      alert(t('reportForm.photo.limitReached', { max: MAX_CASE_PHOTOS }));
      return;
    }
    setRemoved((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  };

  const toggleTag = (tag: CaseTag) => {
    const next = tags.includes(tag) ? tags.filter((x) => x !== tag) : [...tags, tag];
    setTags(next);
    setDescription((prev) => applyTagLine(prev, next));
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const files: File[] = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (files.length === 0) return;

    const room = Math.min(MAX_CASE_PHOTOS - total, freeSlots.length - notYetUploaded.length);
    if (room <= 0 || files.length > room) {
      alert(t('reportForm.photo.limitReached', { max: MAX_CASE_PHOTOS }));
      if (room <= 0) return;
    }

    setBusy(true);
    setStatusKey('reportForm.progress.compressing');
    const added: PendingPhoto[] = [];
    let failed = 0;
    // HEIC 唔好同時處理，逐張嚟
    for (const file of files.slice(0, room)) {
      try {
        const { blob, dataUrl } = await compressImage(file, 1280, 1280, 0.82);
        added.push({ id: nextId(), blob, dataUrl });
      } catch {
        failed++;
      }
    }
    setPending((prev) => [...prev, ...added]);
    setBusy(false);
    setStatusKey(null);
    if (failed > 0) alert(t('reportForm.errors.photoProcessFailed'));
  };

  const handleSearch = async () => {
    const q = addressInput.trim();
    if (!q) return;
    setSearching(true);
    try {
      const r = await geocodeAddressQuery(q);
      if (r) setLocation({ lat: r.lat, lng: r.lng, address: r.address, district: r.district });
      else alert(t('reportForm.progress.notFound'));
    } catch {
      alert(t('reportForm.progress.searchUnavailable'));
    } finally {
      setSearching(false);
    }
  };

  const handleSelectPlace = (p: ResolvedAddress) => {
    setLocation({ lat: p.lat, lng: p.lng, address: p.address, district: p.district });
    setAddressInput(p.address);
  };

  const handleSave = async () => {
    setErrorKey(null);
    if (total === 0) {
      setErrorKey('editCase.errors.noPhoto');
      return;
    }
    if (!hasDescription) {
      setErrorKey('reportForm.errors.noDescription');
      return;
    }
    if (!window.confirm(t('editCase.confirm'))) return;

    setBusy(true);
    try {
      // 新相逐張上載去空位；個位已經有檔案（例如上次上載咗但未儲存）就試下一個位
      setStatusKey('editCase.uploading');
      const slots = [...freeSlots];
      for (const p of pending) {
        if (uploadedRef.current.has(p.id)) continue;
        for (;;) {
          const slot = slots.shift();
          if (slot === undefined) throw new PhotoError('photo.uploadFailed');
          try {
            const r = await uploadAnimalPhoto(p.blob, report.id, slot, p.dataUrl);
            uploadedRef.current.set(p.id, r.storagePath);
            break;
          } catch (err) {
            if (slots.length === 0) throw err;
            console.warn(`[EditCase] slot ${slot} upload failed, trying next`, err);
          }
        }
      }
      const newPhotoPaths = pending
        .map((p) => uploadedRef.current.get(p.id))
        .filter((x): x is string => !!x);
      const keepPaths = kept.map((p) => p.path).filter((p) => pathIndex(p) !== null);

      setStatusKey('editCase.saving');
      const districtText = location.district || t('reportForm.location.districtPending');
      const result = await editCase(report.id, {
        title: t('reportForm.caseTitle', {
          district: districtText,
          animal: animalLabel(animalType, customAnimalName),
        }),
        animalType,
        customAnimalName: animalType === 'other' ? customAnimalName.trim() : '',
        tags: CASE_TAGS.filter((tag) => tags.includes(tag)),
        description: applyTagLine(description, tags).trim(),
        location,
        keepPaths,
        newPhotoPaths,
        lang: getBrowserLanguage(),
      });
      onSaved(result.noResponse ? 'editCase.savedNoAi' : 'editCase.saved');
    } catch (err: any) {
      if (err instanceof PhotoError) {
        setErrorKey(err.key);
      } else {
        const code = String(err?.message ?? '');
        setErrorKey(SERVER_CODES.has(code) ? `editCase.errors.${code}` : 'editCase.errors.generic');
      }
    } finally {
      setBusy(false);
      setStatusKey(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-stone-900">{t('editCase.title')}</h3>
            <p className="text-xs text-stone-500 mt-1">{t('editCase.hint')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t('editCase.cancel')}
            className="p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 動物 */}
        <div>
          <p className="text-xs font-medium text-stone-700 mb-1.5">{t('reportForm.animal.title')}</p>
          <div className="flex gap-2">
            {(['cat', 'dog', 'other'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setAnimalType(type)}
                aria-pressed={animalType === type}
                className={`px-4 py-2 rounded-lg border text-sm cursor-pointer ${
                  animalType === type ? 'border-brand-500 bg-brand-50 font-semibold' : 'border-stone-200'
                }`}
              >
                {t(`reportForm.animal.${type}`)}
              </button>
            ))}
          </div>
          {animalType === 'other' && (
            <input
              type="text"
              value={customAnimalName}
              onChange={(e) => setCustomAnimalName(e.target.value)}
              placeholder={t('reportForm.animal.customPlaceholder')}
              className={`${inputClass} mt-2`}
            />
          )}
        </div>

        {/* 相片：舊相可以移走（Storage 保留），再加新相；最多同時 5 張，第 1 張係封面 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-stone-700">{t('reportForm.photo.title')}</p>
            <span className="text-2xs text-stone-500">
              {t('reportForm.photo.count', { n: total, max: MAX_CASE_PHOTOS })}
            </span>
          </div>
          <input type="file" ref={fileRef} onChange={handleFiles} accept="image/*,.heic,.heif" multiple className="hidden" />
          <ul className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {kept.map((p, i) => (
              <li key={p.path || p.url} className="relative aspect-square rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
                <img src={p.url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-3xs">
                  {i === 0 ? t('reportForm.photo.cover') : t('editCase.oldPhoto')}
                </span>
                {pathIndex(p.path) !== null && (
                  <button
                    type="button"
                    onClick={() => removeExisting(p.path)}
                    disabled={busy}
                    aria-label={t('reportForm.photo.remove')}
                    className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
            {pending.map((p, i) => (
              <li key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-stone-100 border border-brand-300">
                <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-brand-500 text-white text-3xs">
                  {kept.length === 0 && i === 0 ? t('reportForm.photo.cover') : t('editCase.newPhoto')}
                </span>
                {!uploadedRef.current.has(p.id) && (
                  <button
                    type="button"
                    onClick={() => setPending((prev) => prev.filter((x) => x.id !== p.id))}
                    disabled={busy}
                    aria-label={t('reportForm.photo.remove')}
                    className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy || !canAdd}
                title={!canAdd ? t('reportForm.photo.limitReached', { max: MAX_CASE_PHOTOS }) : undefined}
                className="w-full aspect-square rounded-xl border-2 border-dashed border-stone-300 text-stone-500 flex flex-col items-center justify-center gap-1 hover:bg-stone-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-5 h-5" />
                <span className="text-2xs text-center px-1">
                  {canAdd ? t('editCase.addPhoto') : t('reportForm.photo.limitReached', { max: MAX_CASE_PHOTOS })}
                </span>
              </button>
            </li>
          </ul>

          {/* 移走咗嘅舊相：可以還原 */}
          {removedList.length > 0 && (
            <div className="mt-3">
              <p className="text-2xs text-stone-500 mb-1.5">{t('editCase.removedTitle')}</p>
              <ul className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                {removedList.map((p) => (
                  <li key={p.path} className="relative aspect-square rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                    <img src={p.url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-40 grayscale" />
                    <button
                      type="button"
                      onClick={() => restoreExisting(p.path)}
                      disabled={busy}
                      aria-label={t('editCase.restorePhoto')}
                      title={t('editCase.restorePhoto')}
                      className="absolute inset-0 flex items-center justify-center text-stone-700 hover:bg-white/40 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 位置 */}
        <div>
          <p className="text-xs font-medium text-stone-700 mb-1.5">{t('reportForm.location.title')}</p>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <AddressAutocomplete
                value={addressInput}
                onChange={setAddressInput}
                onSelect={handleSelectPlace}
                onEnter={handleSearch}
                bias={{ lat: location.lat, lng: location.lng }}
                placeholder={t('reportForm.location.placeholder')}
              />
            </div>
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              className="px-4 rounded-lg bg-stone-900 text-white text-sm flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-60"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {t('reportForm.location.locate')}
            </button>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-600 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-brand-500 shrink-0" />
            <span className="truncate">{location.address}</span>
          </p>
        </div>

        {/* 現場狀況 */}
        <div>
          <p className="text-xs font-medium text-stone-700 mb-1.5">{t('reportForm.description.title')}</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {CASE_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={tags.includes(tag)}
                className={`px-3 py-1 rounded-full border text-xs cursor-pointer ${
                  tags.includes(tag) ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-stone-200 text-stone-600'
                }`}
              >
                #{tagLabel(tag)}
              </button>
            ))}
          </div>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('reportForm.description.placeholder')}
            className={`${inputClass} resize-y`}
          />
        </div>

        {errorKey && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{t(errorKey)}</span>
          </div>
        )}
        {statusKey && (
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span>{t(statusKey)}</span>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm cursor-pointer"
          >
            {t('editCase.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="px-5 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('editCase.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditCaseModal;
