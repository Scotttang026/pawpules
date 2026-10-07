import React from 'react';

/**
 * PawPulse 自家動物 icon。
 * 統一規格：32×32 viewBox、2px 圓角線條（跟 currentColor）、圓點眼，
 * 耳仔／面珠等點綴用 `active` 切換：揀咗用品牌橙色，未揀用淺暖灰。
 */
interface AnimalIconProps {
  className?: string;
  active?: boolean;
}

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const accentClass = (active?: boolean) =>
  `${active ? 'fill-brand-400' : 'fill-stone-200'} transition-colors`;

const blushClass = (active?: boolean) =>
  `${active ? 'fill-brand-300' : 'fill-stone-200'} transition-colors`;

export const CatIcon: React.FC<AnimalIconProps> = ({ className = 'w-10 h-10', active }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    {/* 耳仔內側 */}
    <path d="M8.9 7.4 L11.6 9.5 L9.2 11.4 Z" className={accentClass(active)} />
    <path d="M23.1 7.4 L20.4 9.5 L22.8 11.4 Z" className={accentClass(active)} />
    {/* 面珠 */}
    <ellipse cx="10.4" cy="20.2" rx="1.6" ry="1" className={blushClass(active)} />
    <ellipse cx="21.6" cy="20.2" rx="1.6" ry="1" className={blushClass(active)} />
    {/* 頭 */}
    <path
      {...strokeProps}
      d="M6 16.5C6 11.8 7 7.3 8 4.6L13 8.6C14.6 8.1 17.4 8.1 19 8.6L24 4.6C25 7.3 26 11.8 26 16.5C26 22.8 21.5 27 16 27C10.5 27 6 22.8 6 16.5Z"
    />
    {/* 眼 */}
    <circle cx="12" cy="16" r="1.5" fill="currentColor" />
    <circle cx="20" cy="16" r="1.5" fill="currentColor" />
    {/* 鼻同口 */}
    <path d="M14.9 19.2H17.1L16 20.5Z" fill="currentColor" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
    <path {...strokeProps} strokeWidth={1.6} d="M16 20.6C16 21.9 14.5 22.4 13.7 21.6M16 20.6C16 21.9 17.5 22.4 18.3 21.6" />
    {/* 鬚 */}
    <path {...strokeProps} strokeWidth={1.4} d="M2.8 18.2L7.2 19M2.8 21.8L7.2 21M29.2 18.2L24.8 19M29.2 21.8L24.8 21" />
  </svg>
);

export const DogIcon: React.FC<AnimalIconProps> = ({ className = 'w-10 h-10', active }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    {/* 面珠 */}
    <ellipse cx="11.2" cy="20.4" rx="1.5" ry="0.95" className={blushClass(active)} />
    <ellipse cx="20.8" cy="20.4" rx="1.5" ry="0.95" className={blushClass(active)} />
    {/* 頭 */}
    <path
      {...strokeProps}
      d="M10 9C11.5 7.2 13.6 6.4 16 6.4C18.4 6.4 20.5 7.2 22 9C23.3 10.6 24 13 24 16C24 22.4 20.4 27 16 27C11.6 27 8 22.4 8 16C8 13 8.7 10.6 10 9Z"
    />
    {/* 垂耳 */}
    <path
      {...strokeProps}
      d="M11.4 8.1C8.6 6.6 5.2 7.6 4.7 10.8C4.2 13.8 5.2 18 7.4 19.5C8.9 20.5 9.9 18.9 9.5 16.6C9.1 14.4 9.6 10.8 11.4 8.1Z"
      className={accentClass(active)}
      fill={undefined}
    />
    <path
      {...strokeProps}
      d="M20.6 8.1C23.4 6.6 26.8 7.6 27.3 10.8C27.8 13.8 26.8 18 24.6 19.5C23.1 20.5 22.1 18.9 22.5 16.6C22.9 14.4 22.4 10.8 20.6 8.1Z"
      className={accentClass(active)}
      fill={undefined}
    />
    {/* 眼 */}
    <circle cx="13.2" cy="15.4" r="1.5" fill="currentColor" />
    <circle cx="18.8" cy="15.4" r="1.5" fill="currentColor" />
    {/* 鼻 */}
    <path d="M14.1 19.1C14.1 18.2 17.9 18.2 17.9 19.1C17.9 20.1 16.9 20.9 16 20.9C15.1 20.9 14.1 20.1 14.1 19.1Z" fill="currentColor" />
    {/* 口同脷 */}
    <path d="M15 22.6C15 24.3 17 24.3 17 22.6Z" className={accentClass(active)} />
    <path {...strokeProps} strokeWidth={1.6} d="M16 20.9V22.1M16 22.1C15.4 23 13.9 23.1 13.3 22.2M16 22.1C16.6 23 18.1 23.1 18.7 22.2" />
  </svg>
);

export const BirdIcon: React.FC<AnimalIconProps> = ({ className = 'w-10 h-10', active }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    {/* 面珠 */}
    <ellipse cx="21.2" cy="17.4" rx="1.3" ry="0.8" className={blushClass(active)} />
    {/* 身 */}
    <path
      {...strokeProps}
      d="M24 16C24 21.5 20 25.6 14.5 25.6C9.6 25.6 6 22.4 6 18C6 12.6 10 8.2 15.4 8.2C20.2 8.2 24 11.6 24 16Z"
    />
    {/* 頭頂毛 */}
    <path {...strokeProps} d="M14.6 8.3C14.1 6.7 14.9 5.3 16.4 4.9" />
    {/* 翼：葉形，尖端向尾 */}
    <path {...strokeProps} d="M16.8 17C13.6 16.2 10.4 18.4 9.2 22.2C12.8 23 16.4 21.2 16.8 17Z" className={accentClass(active)} fill={undefined} />
    {/* 尾 */}
    <path {...strokeProps} d="M6.4 19.6L2.8 21.2L6.9 22.6" />
    {/* 嘴 */}
    <path {...strokeProps} d="M23.8 13.6L28.2 15.4L23.9 17.2Z" className={accentClass(active)} fill={undefined} />
    {/* 眼 */}
    <circle cx="19.2" cy="13.6" r="1.5" fill="currentColor" />
    {/* 腳 */}
    <path {...strokeProps} d="M13 25.6V28M17.2 25.2V27.6M12 28H14M16.2 27.6H18.2" />
  </svg>
);
