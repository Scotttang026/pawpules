// src/components/PhotoGallery.tsx
// 案件詳情嘅相片 gallery：手機用手指左右碌（scroll-snap），桌面用箭咀同縮圖
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import type { CasePhoto } from '../types';

// 案件標題係純文字，唔需要 HTML escape
const NO_ESCAPE = { interpolation: { escapeValue: false } } as const;

interface PhotoGalleryProps {
  photos: CasePhoto[];
  title: string;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({ photos, title }) => {
  const { t } = useTranslation();
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const total = photos.length;
  const photoKey = photos.map((p) => p.url).join('|');

  // 換咗案件就返去第 1 張
  useEffect(() => {
    setIndex(0);
    trackRef.current?.scrollTo({ left: 0 });
  }, [photoKey]);

  const goTo = (i: number) => {
    const track = trackRef.current;
    if (!track || total === 0) return;
    const next = Math.max(0, Math.min(total - 1, i));
    track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' });
  };

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== index) setIndex(i);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(index + 1);
    }
  };

  if (total === 0) {
    return (
      <div className="aspect-4/3 rounded-2xl bg-stone-100 border border-stone-200 flex flex-col items-center justify-center gap-1.5 text-stone-400">
        <ImageOff className="w-7 h-7" />
        <span className="text-xs">{t('caseModal.gallery.noPhoto')}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shadow-xs">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          tabIndex={total > 1 ? 0 : -1}
          className="flex h-full overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus:outline-none"
        >
          {photos.map((p, i) => (
            <img
              key={`${i}-${p.url}`}
              src={p.url}
              alt={t('caseModal.gallery.photoAlt', { title, n: i + 1, ...NO_ESCAPE })}
              loading={i === 0 ? 'eager' : 'lazy'}
              draggable={false}
              referrerPolicy="no-referrer"
              className="w-full h-full shrink-0 snap-center object-cover"
            />
          ))}
        </div>

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label={t('caseModal.gallery.prev')}
              className={`absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center text-stone-800 cursor-pointer ${
                index === 0 ? 'invisible' : ''
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label={t('caseModal.gallery.next')}
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center text-stone-800 cursor-pointer ${
                index >= total - 1 ? 'invisible' : ''
              }`}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-2xs font-medium">
              {t('caseModal.gallery.counter', { n: index + 1, total })}
            </span>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={`thumb-${i}-${p.url}`}
              type="button"
              onClick={() => goTo(i)}
              aria-label={t('caseModal.gallery.goTo', { n: i + 1 })}
              aria-current={i === index ? 'true' : undefined}
              className={`w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 transition cursor-pointer ${
                i === index ? 'border-brand-500' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <img src={p.url} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
