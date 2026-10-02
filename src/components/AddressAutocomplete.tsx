import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import {
  fetchAddressSuggestions,
  resolveAddress,
  newSessionToken,
  type AddressSuggestion,
  type ResolvedAddress,
} from '../services/places';

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSelect: (place: ResolvedAddress) => void;
  /** 冇揀建議、直接撳 Enter 時觸發（例如沿用舊有「定位」搜尋） */
  onEnter?: () => void;
  bias?: { lat: number; lng: number } | null;
  placeholder?: string;
  disabled?: boolean;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onEnter,
  bias,
  placeholder = '輸入地址、大廈或地標，例如：旺角朗豪坊',
  disabled,
}: Props) {
  const [query, setQuery] = useState(''); // 只喺用戶真正打完字先更新（避開輸入法組字）
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const composingRef = useRef(false);
  const sessionRef = useRef(newSessionToken());
  const blurTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(blurTimer.current), []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchAddressSuggestions(q, sessionRef.current, ctrl.signal, bias ?? undefined);
        setSuggestions(list);
        setActiveIndex(-1);
        setOpen(list.length > 0);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setSuggestions([]);
        setError('地址建議暫時無法載入，你仍可直接輸入地址再撳「定位」。');
        setOpen(true);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleSelect = async (s: AddressSuggestion) => {
    setOpen(false);
    setSuggestions([]);
    onChange(s.secondaryText ? `${s.mainText}，${s.secondaryText}` : s.mainText);
    setLoading(true);
    setError(null);
    try {
      const place = await resolveAddress(s.placeId, sessionRef.current);
      const label =
        place.name && !place.address.includes(place.name)
          ? `${place.name}（${place.address}）`
          : place.address || s.mainText;
      onChange(label);
      onSelect({ ...place, address: label });
    } catch {
      setError('未能取得此地址嘅座標，請再揀一次或撳「定位」。');
      setOpen(true);
    } finally {
      setLoading(false);
      sessionRef.current = newSessionToken(); // 一次選擇完結，開新 session（Google 計費用）
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (composingRef.current || e.nativeEvent.isComposing) return;

    const hasList = open && suggestions.length > 0;
    if (e.key === 'ArrowDown' && hasList) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && hasList) {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault(); // 永遠唔好俾 Enter 送出成張表單
      if (hasList && activeIndex >= 0) {
        handleSelect(suggestions[activeIndex]);
      } else {
        setOpen(false);
        onEnter?.();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative w-full">
      <MapPin className="w-4 h-4 text-rose-500 absolute left-3 top-3 pointer-events-none" />
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="address-suggestion-list"
        aria-autocomplete="list"
        autoComplete="off"
        enterKeyHint="search"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={200}
        className="w-full pl-9 pr-9 py-2.5 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
        onChange={(e) => {
          onChange(e.target.value);
          if (!composingRef.current) setQuery(e.target.value);
        }}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={(e) => {
          composingRef.current = false;
          setQuery(e.currentTarget.value);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 150);
        }}
      />

      {loading && (
        <Loader2 className="w-4 h-4 text-stone-400 animate-spin absolute right-3 top-3" />
      )}

      {open && (suggestions.length > 0 || error) && (
        <ul
          id="address-suggestion-list"
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-stone-200 bg-white shadow-lg"
        >
          {error && <li className="px-4 py-3 text-xs text-rose-600">{error}</li>}
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              role="option"
              aria-selected={i === activeIndex}
              className={`cursor-pointer px-4 py-2.5 ${i === activeIndex ? 'bg-amber-50' : 'hover:bg-stone-50'}`}
              onMouseDown={(e) => e.preventDefault()} // 防止 input 先 blur 令清單消失
              onClick={() => handleSelect(s)}
            >
              <div className="text-xs font-bold text-stone-900">{s.mainText}</div>
              {s.secondaryText && <div className="text-2xs text-stone-500">{s.secondaryText}</div>}
            </li>
          ))}
          {suggestions.length > 0 && (
            <li className="px-4 py-1.5 text-right text-3xs text-stone-400">資料來源：Google</li>
          )}
        </ul>
      )}
    </div>
  );
}
