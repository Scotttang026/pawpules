import React, { useId } from 'react';

interface BrandIconProps {
  className?: string;
}

/** Google Gemini 標誌（四角星），用喺 AI 分析相關位置 */
export const GeminiIcon: React.FC<BrandIconProps> = ({ className = 'w-4 h-4' }) => {
  // 同一頁可能有幾個 icon，gradient id 要唯一
  const gradientId = `gemini-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4285F4" />
          <stop offset="0.5" stopColor="#9B72CB" />
          <stop offset="1" stopColor="#D96570" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"
      />
    </svg>
  );
};

// 雙手捧心嘅圖形（React 元件同 Leaflet HTML 字串共用，全部寫死，冇用戶輸入）
const CARE_HEART = 'M32 41C21 33.5 18.5 27.5 20.5 23.5C22.8 19 29.5 19 32 24C34.5 19 41.2 19 43.5 23.5C45.5 27.5 43 33.5 32 41Z';
const CARE_HEART_TRANSFORM = 'translate(0 -2) translate(32 30) scale(1.15) translate(-32 -30)';
const CARE_STROKES = [
  'M32 9v4M22.5 11l1.8 3.4M41.5 11l-1.8 3.4M14.5 17l3 2M49.5 17l-3 2',
  'M27 60V53L20.5 46.5C17.5 43.5 16 39.5 15.5 35L14.5 26.5C14.3 24.8 16.8 24.3 17.4 26L20 34.5',
  'M20.5 38L18.8 35.5C17.6 33.7 19.7 32 21.2 33.4L27 39.5V44',
  'M37 60V53L43.5 46.5C46.5 43.5 48 39.5 48.5 35L49.5 26.5C49.7 24.8 47.2 24.3 46.6 26L44 34.5',
  'M43.5 38L45.2 35.5C46.4 33.7 44.3 32 42.8 33.4L37 39.5V44',
];

/** 雙手捧心（救助機構），用喺 NGO 相關位置 */
export const CareIcon: React.FC<BrandIconProps> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 64 64"
    className={className}
    fill="none"
    stroke="#1c1917"
    strokeWidth={4}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="32" cy="32" r="29" />
    <path transform={CARE_HEART_TRANSFORM} d={CARE_HEART} fill="#E0412B" stroke="none" />
    {CARE_STROKES.map((d) => (
      <path key={d} d={d} />
    ))}
  </svg>
);

/** 同 CareIcon 一樣，輸出 SVG 字串俾 Leaflet divIcon 用 */
export function careIconSvg(size: number): string {
  return `<svg viewBox="0 0 64 64" width="${Number(size)}" height="${Number(size)}" fill="none" stroke="#1c1917"
    stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="32" cy="32" r="29"/>
    <path transform="${CARE_HEART_TRANSFORM}" d="${CARE_HEART}" fill="#E0412B" stroke="none"/>
    ${CARE_STROKES.map((d) => `<path d="${d}"/>`).join('')}
  </svg>`;
}
