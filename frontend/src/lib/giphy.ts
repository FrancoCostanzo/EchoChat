/* ─────────────────────────────────────────────────────────
   Giphy client — GIFs + Stickers.

   One integration powers both tabs of the picker: Giphy exposes a
   /gifs/* endpoint family and a parallel /stickers/* family that
   returns transparent, sticker-style animations.

   The API key is read from VITE_GIPHY_API_KEY. Giphy retired its public
   demo keys, so the GIF tab stays disabled until a (free) key is set —
   grab one at https://developers.giphy.com. The Sticker tab needs no key
   (it uses OpenMoji), so stickers always work out of the box.
   ───────────────────────────────────────────────────────── */

export type GiphyKind = 'gif' | 'sticker';

export interface GiphyResult {
  id: string;
  kind: GiphyKind;
  source: 'giphy';
  url: string;
  preview: string;
  width: number;
  height: number;
  alt: string;
}

interface GiphyRendition {
  url?: string;
  width?: string | number;
  height?: string | number;
}

interface GiphyApiItem {
  id: string;
  title?: string;
  images?: Record<string, GiphyRendition>;
}

interface GiphyApiListResponse {
  data?: GiphyApiItem[];
}

interface GiphyQueryOptions {
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

const API_KEY = import.meta.env.VITE_GIPHY_API_KEY || '';
const BASE = 'https://api.giphy.com/v1';
const RATING = import.meta.env.VITE_GIPHY_RATING || 'pg-13';

// Whether a Giphy key is configured. Public demo keys were retired by Giphy,
// so the GIF tab needs the deployer's own (free) key to work.
export const GIPHY_ENABLED = Boolean(API_KEY);

// `kind` maps to the Giphy endpoint family: 'gif' → /gifs, 'sticker' → /stickers.
function endpointFor(kind: GiphyKind): string {
  return kind === 'sticker' ? 'stickers' : 'gifs';
}

/**
 * Normalise a Giphy result object to the compact shape we render in the
 * grid and persist in the message metadata. We keep two renditions:
 *  - preview: small, fixed-height, used inside the picker grid
 *  - full:    downsized rendition sent in the message (kept lightweight)
 */
function normalize(item: GiphyApiItem, kind: GiphyKind): GiphyResult {
  const img = item.images || {};
  const preview = img.fixed_height_small || img.fixed_height || img.preview_gif || {};
  // Prefer a downsized animation for the message so timelines stay light.
  const full =
    img.downsized_medium || img.downsized || img.fixed_height || img.original || {};
  const width = Number(full.width) || Number(preview.width) || 0;
  const height = Number(full.height) || Number(preview.height) || 0;
  return {
    id: item.id,
    kind,
    source: 'giphy',
    url: full.url || '',
    preview: preview.url || full.url || '',
    width,
    height,
    alt: item.title || (kind === 'sticker' ? 'Sticker' : 'GIF'),
  };
}

async function request(
  path: string,
  params: Record<string, string | number | undefined>,
  signal: AbortSignal | undefined,
): Promise<GiphyApiListResponse> {
  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('rating', RATING);
  url.searchParams.set('bundle', 'messaging_non_clips');
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`Giphy ${res.status}`);
  return res.json();
}

/** Trending GIFs or stickers. */
export async function giphyTrending(
  kind: GiphyKind,
  { limit = 24, offset = 0, signal }: GiphyQueryOptions = {},
): Promise<GiphyResult[]> {
  const json = await request(`${endpointFor(kind)}/trending`, { limit, offset }, signal);
  return (json.data || []).map((it) => normalize(it, kind)).filter((x) => x.url && x.preview);
}

/** Search GIFs or stickers. */
export async function giphySearch(
  kind: GiphyKind,
  query: string | null | undefined,
  { limit = 24, offset = 0, signal }: GiphyQueryOptions = {},
): Promise<GiphyResult[]> {
  const q = (query || '').trim();
  if (!q) return giphyTrending(kind, { limit, offset, signal });
  const json = await request(`${endpointFor(kind)}/search`, { q, limit, offset }, signal);
  return (json.data || []).map((it) => normalize(it, kind)).filter((x) => x.url && x.preview);
}

export const GIPHY_ATTRIBUTION = 'Powered by GIPHY';
