import React from 'react';
import { useTranslation } from 'react-i18next';
import type { MemberProfile } from '../types';
import { MEMBER_INPUT_CLASS, NAME_MAX, USERNAME_MAX } from '../services/memberService';

interface Props {
  idPrefix: string;
  value: MemberProfile;
  onChange: (next: MemberProfile) => void;
  disabled?: boolean;
  usernameLocked?: boolean; // 冷卻期內鎖住帳戶名
  usernameNote?: React.ReactNode; // 帳戶名下面額外顯示（警告 / 下次可改日期）
}

export const MemberProfileFields: React.FC<Props> = ({
  idPrefix, value, onChange, disabled, usernameLocked, usernameNote,
}) => {
  const { t, i18n } = useTranslation();
  const set = (k: 'firstName' | 'lastName' | 'username') => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });

  const lastField = (
    <div key="last">
      <label htmlFor={`${idPrefix}-last`} className="block text-xs font-medium text-stone-700 mb-1">{t('member.lastName')}</label>
      <input id={`${idPrefix}-last`} autoComplete="family-name" required maxLength={NAME_MAX}
        value={value.lastName} onChange={set('lastName')} disabled={disabled} className={MEMBER_INPUT_CLASS} />
    </div>
  );
  const firstField = (
    <div key="first">
      <label htmlFor={`${idPrefix}-first`} className="block text-xs font-medium text-stone-700 mb-1">{t('member.firstName')}</label>
      <input id={`${idPrefix}-first`} autoComplete="given-name" required maxLength={NAME_MAX}
        value={value.firstName} onChange={set('firstName')} disabled={disabled} className={MEMBER_INPUT_CLASS} />
    </div>
  );
  // 中文先姓後名，英文先名後姓
  const nameFields = (i18n.language || 'zh').startsWith('zh') ? [lastField, firstField] : [firstField, lastField];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">{nameFields}</div>
      <div>
        <label htmlFor={`${idPrefix}-username`} className="block text-xs font-medium text-stone-700 mb-1">{t('member.username')}</label>
        <input id={`${idPrefix}-username`} autoComplete="username" required maxLength={USERNAME_MAX}
          value={value.username} onChange={set('username')}
          disabled={disabled || usernameLocked} className={MEMBER_INPUT_CLASS} />
        <p className="text-2xs text-stone-400 mt-1">{t('member.usernameHint')}</p>
        {usernameNote}
      </div>
    </div>
  );
};
