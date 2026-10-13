import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Send, Loader2, X } from 'lucide-react';
import { StrayReport, CaseComment } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToComments, postComment, deleteComment, ApiError } from '../services/caseService';
import { getApiLang } from '../i18n';

const MAX_LEN = 1000;
// 名係用戶自己改嘅純文字，React 會 escape，唔使 i18next 再 escape（否則 & 會變 &amp;）
const NO_ESCAPE = { interpolation: { escapeValue: false } };

const KNOWN_ERRORS = [
  'login_required', 'email_unverified', 'profile_required', 'empty', 'too_long',
  'bad_parent', 'not_found', 'pending_deletion', 'forbidden', 'rate_limited', 'unknown',
] as const;
type CommentError = (typeof KNOWN_ERRORS)[number];

function toErrorCode(err: unknown): CommentError {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'rate_limited';
    const code = err.message as CommentError;
    if (KNOWN_ERRORS.includes(code)) return code;
  }
  return 'unknown';
}

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(getApiLang(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const BADGE = 'text-2xs font-bold px-1.5 py-0.5 rounded-full';

interface CaseCommentsProps {
  report: StrayReport;
}

export default function CaseComments({ report }: CaseCommentsProps) {
  // 要 call useTranslation，轉語言時先會即刻更新
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [comments, setComments] = useState<CaseComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<{ parentId: string; name: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [errorCode, setErrorCode] = useState<CommentError | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadFailed(false);
    setComments([]);
    setText('');
    setReplyTo(null);
    setErrorCode(null);
    const unsubscribe = subscribeToComments(
      report.id,
      (list) => {
        setComments(list);
        setLoading(false);
      },
      () => {
        setLoadFailed(true);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [report.id]);

  // 主留言 + 每個主留言嘅回覆；搵唔到主留言嘅回覆當主留言顯示
  const { topLevel, repliesOf } = useMemo(() => {
    const ids = new Set(comments.map((c) => c.id));
    const map = new Map<string, CaseComment[]>();
    const top: CaseComment[] = [];
    for (const c of comments) {
      if (c.parentId && ids.has(c.parentId)) {
        map.set(c.parentId, [...(map.get(c.parentId) ?? []), c]);
      } else {
        top.push(c);
      }
    }
    return { topLevel: top, repliesOf: map };
  }, [comments]);

  const visibleCount = comments.filter((c) => !c.deleted).length;

  const nameOf = (c: CaseComment) =>
    c.role === 'admin' ? t('comments.adminName') : c.authorName || t('comments.unknownUser');

  const startReply = (c: CaseComment) => {
    const name = nameOf(c);
    setReplyTo({ parentId: c.parentId ?? c.id, name });
    // 回覆「回覆」：同樣掛喺主留言下面，前面加 @名 表示回緊邊個
    if (c.parentId) {
      setText((prev) => (prev.startsWith(`@${name} `) ? prev : `@${name} ${prev}`));
    }
    setErrorCode(null);
    textareaRef.current?.focus();
    textareaRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setErrorCode('empty');
      return;
    }
    if (trimmed.length > MAX_LEN) {
      setErrorCode('too_long');
      return;
    }
    setSending(true);
    setErrorCode(null);
    try {
      await postComment(report.id, trimmed, replyTo?.parentId ?? null);
      setText('');
      setReplyTo(null);
    } catch (err) {
      setErrorCode(toErrorCode(err));
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (c: CaseComment) => {
    if (!window.confirm(t('comments.deleteConfirm'))) return;
    setDeletingId(c.id);
    try {
      await deleteComment(report.id, c.id);
    } catch (err) {
      alert(t(`comments.errors.${toErrorCode(err)}`, { max: MAX_LEN }));
    } finally {
      setDeletingId(null);
    }
  };

  const renderComment = (c: CaseComment, isReply: boolean) => {
    if (c.deleted) {
      return <p className="text-xs italic text-stone-400 py-1 px-3">{t('comments.deleted')}</p>;
    }
    const name = nameOf(c);
    const canDelete = !!user && (c.uid === user.uid || isAdmin);
    return (
      <div className="flex gap-2.5">
        <div
          className={`${isReply ? 'w-7 h-7 text-[11px]' : 'w-8 h-8 text-xs'} shrink-0 rounded-full bg-brand-100 text-brand-800 font-bold flex items-center justify-center`}
          aria-hidden="true"
        >
          {(Array.from(name)[0] ?? '?').toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-stone-100 px-3 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-stone-900 break-all">{name}</span>
              {c.isReporter && <span className={`${BADGE} bg-amber-100 text-amber-800`}>{t('comments.badgeReporter')}</span>}
              {c.role === 'ngo' && <span className={`${BADGE} bg-sky-100 text-sky-800`}>{t('comments.badgeNgo')}</span>}
              {c.role === 'admin' && <span className={`${BADGE} bg-stone-800 text-white`}>{t('comments.badgeAdmin')}</span>}
            </div>
            <p className="mt-0.5 text-sm text-stone-800 whitespace-pre-wrap break-words">{c.text}</p>
          </div>
          <div className="flex items-center gap-3 px-3 mt-1 text-2xs text-stone-500">
            <span>{formatTime(c.createdAt)}</span>
            {user && (
              <button type="button" onClick={() => startReply(c)} className="font-semibold hover:text-stone-800 cursor-pointer">
                {t('comments.reply')}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => handleDelete(c)}
                disabled={deletingId === c.id}
                className="font-semibold hover:text-rose-600 disabled:opacity-50 cursor-pointer"
              >
                {t('comments.delete')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="mt-6 pt-5 border-t border-stone-200" aria-labelledby={`comments-${report.id}`}>
      <h3 id={`comments-${report.id}`} className="flex items-center gap-2 text-sm font-bold text-stone-900 mb-3">
        <MessageCircle className="w-4 h-4 text-brand-600" />
        {t('comments.title')}
        {visibleCount > 0 && (
          <span className="text-xs font-medium text-stone-500">{t('comments.count', { n: visibleCount })}</span>
        )}
      </h3>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 text-stone-400 animate-spin" />
        </div>
      ) : loadFailed ? (
        <p className="text-xs text-rose-600">{t('comments.loadFailed')}</p>
      ) : visibleCount === 0 ? (
        <p className="text-xs text-stone-500">{t('comments.empty')}</p>
      ) : (
        <ul className="space-y-4">
          {topLevel.map((c) => {
            const replies = (repliesOf.get(c.id) ?? []).filter((r) => !r.deleted);
            // 刪咗又冇人回覆嘅主留言就唔顯示
            if (c.deleted && replies.length === 0) return null;
            return (
              <li key={c.id}>
                {renderComment(c, false)}
                {replies.length > 0 && (
                  <ul className="mt-2 ml-10 space-y-2">
                    {replies.map((r) => (
                      <li key={r.id}>{renderComment(r, true)}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {user ? (
        <form onSubmit={handleSubmit} className="mt-4">
          {replyTo && (
            <div className="flex items-center justify-between gap-2 mb-1.5 px-1 text-2xs text-stone-600">
              <span className="truncate">{t('comments.replyingTo', { name: replyTo.name, ...NO_ESCAPE })}</span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label={t('comments.cancelReply')}
                className="p-0.5 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (errorCode) setErrorCode(null);
              }}
              rows={2}
              maxLength={MAX_LEN}
              placeholder={t('comments.placeholder')}
              className="flex-1 min-w-0 resize-y min-h-[44px] rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="shrink-0 inline-flex items-center gap-1.5 h-[44px] px-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span className="hidden sm:inline">{t('comments.send')}</span>
            </button>
          </div>
          <div className="flex justify-between gap-2 mt-1 px-1 text-2xs">
            <span className="text-rose-600">
              {errorCode && t(`comments.errors.${errorCode}`, { max: MAX_LEN })}
            </span>
            <span className="text-stone-400 shrink-0">{text.length}/{MAX_LEN}</span>
          </div>
        </form>
      ) : (
        <p className="mt-4 rounded-xl bg-stone-50 border border-stone-200 px-3 py-2.5 text-xs text-stone-600">
          {t('comments.loginHint')}
        </p>
      )}
    </section>
  );
}
