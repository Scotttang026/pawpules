const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '');

export interface AddressSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export interface ResolvedAddress {
  placeId: string;
  address: string;
  name: string;
  lat: number;
  lng: number;
}

export function newSessionToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export async function fetchAddressSuggestions(
  input: string,
  sessionToken: string,
  signal: AbortSignal,
  bias?: { lat: number; lng: number }
): Promise<AddressSuggestion[]> {
  const res = await fetch(`${API_BASE}/api/places/autocomplete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, sessionToken, ...(bias ?? {}) }),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.suggestions) ? data.suggestions : [];
}

export async function resolveAddress(placeId: string, sessionToken: string): Promise<ResolvedAddress> {
  const url = `${API_BASE}/api/places/details/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
