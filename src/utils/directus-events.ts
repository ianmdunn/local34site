import { getDirectusToken } from '~/utils/directus';
import { getPathWithBase } from '~/utils/permalinks';

const DIRECTUS_URL = (import.meta.env.PUBLIC_DIRECTUS_URL || '').replace(/\/$/, '');
const IMAGE_PROXY_URL = (import.meta.env.PUBLIC_DIRECTUS_IMAGE_PROXY_URL || '').replace(/\/$/, '');
const EVENTS_COLLECTION = (import.meta.env.PUBLIC_DIRECTUS_EVENTS_COLLECTION || 'events').trim();
const EVENTS_TITLE_FIELD = (import.meta.env.PUBLIC_DIRECTUS_EVENTS_TITLE_FIELD || 'title').trim();
const EVENTS_COLLECTION_CANDIDATES = [EVENTS_COLLECTION, 'events', 'upcoming_events', 'action_events', 'actions_events'];
const REQUEST_TIMEOUT_MS = 7000;

interface DirectusEventsResponse {
  data: Record<string, unknown>[];
}

export interface ActionEventItem {
  slug: string;
  title: string;
  month: string;
  day: string;
  sortDate?: string;
  meta: string[];
  address: string;
  desc: string;
  details: string[];
  rsvpLabel?: string;
  mobilizeUrl?: string;
  eventUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  jotformId?: string;
  jotformEmbedUrl?: string;
  cancelled?: boolean;
  cancellationMessage?: string;
}

const toStringValue = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => toStringValue(item)).filter(Boolean);
  if (typeof value !== 'string') return [];
  const text = value.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((item) => toStringValue(item)).filter(Boolean);
  } catch {
    // Fall through to newline split.
  }
  return text
    .split('\n')
    .map((part) => part.trim())
    .filter(Boolean);
};

const parseBoolean = (value: unknown): boolean => value === true || value === 1 || value === '1' || value === 'true';
const hasValue = (value: unknown): boolean => value !== null && value !== undefined && String(value).trim() !== '';
const MOBILIZE_URL_RE = /^https?:\/\/(www\.)?mobilize\.us\/.+/i;
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

const normalizeMobilizeUrl = (value: unknown): string => {
  const raw = toStringValue(value);
  if (!raw) return '';
  if (MOBILIZE_URL_RE.test(raw)) return raw;
  const idMatch = raw.match(/\d+/);
  if (!idMatch) return '';
  return `https://www.mobilize.us/nokings/event/${idMatch[0]}/`;
};

const getAssetUrlFromId = (id: string): string => {
  if (!id) return '';
  if (IMAGE_PROXY_URL) return `${IMAGE_PROXY_URL}?id=${encodeURIComponent(id)}`;
  return DIRECTUS_URL ? `${DIRECTUS_URL}/assets/${id}` : '';
};

const getEventImageUrl = (item: Record<string, unknown>): string => {
  const directUrlCandidates = [
    toStringValue(item.image_url),
    toStringValue(item.event_image_url),
    toStringValue(item.featured_image_url),
    toStringValue(item.banner_image_url),
    toStringValue(item.photo_url),
  ].filter(Boolean);
  if (directUrlCandidates.length) return directUrlCandidates[0];

  const objectCandidates = [
    item.image,
    item.event_image,
    item.featured_image,
    item.banner_image,
    item.photo,
  ];

  for (const candidate of objectCandidates) {
    if (!candidate) continue;
    if (typeof candidate === 'string') {
      if (/^https?:\/\//i.test(candidate)) return candidate;
      if (UUID_RE.test(candidate)) return getAssetUrlFromId(candidate);
      continue;
    }
    if (typeof candidate === 'object') {
      const objectValue = candidate as Record<string, unknown>;
      const id = toStringValue(objectValue.id);
      if (id) return getAssetUrlFromId(id);
      const url = toStringValue(objectValue.url);
      if (url) return url;
      const directus = toStringValue(objectValue.directus_files_id);
      if (UUID_RE.test(directus)) return getAssetUrlFromId(directus);
    }
  }

  return '';
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const humanizeSlug = (value: string): string =>
  value
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatMonthDay = (dateInput: unknown): { month: string; day: string } => {
  const dateText = toStringValue(dateInput);
  const date = dateText ? new Date(dateText) : null;
  if (!date || Number.isNaN(date.getTime())) return { month: 'TBD', day: '--' };
  return {
    month: date.toLocaleString('en-US', { month: 'short' }),
    day: String(date.getDate()),
  };
};

const getEventDate = (item: Record<string, unknown>): Date | null => {
  const dateText =
    toStringValue(item.date) ||
    toStringValue(item.start_at) ||
    toStringValue(item.start_date) ||
    toStringValue(item.event_date) ||
    toStringValue(item.date_created);
  if (!dateText) return null;
  const parsed = new Date(dateText);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

function mapEvent(item: Record<string, unknown>): ActionEventItem | null {
  const descriptionText = toStringValue(item.description) || toStringValue(item.desc);
  const titleFromDescription =
    descriptionText.match(/([A-Z][^.!?]*meeting)/i)?.[1]?.trim().replace(/\s+/g, ' ') || '';
  const configuredTitle =
    EVENTS_TITLE_FIELD && EVENTS_TITLE_FIELD !== 'title' ? toStringValue(item[EVENTS_TITLE_FIELD]) : '';
  const title =
    configuredTitle ||
    toStringValue(item.title) ||
    toStringValue(item.event_name) ||
    toStringValue(item.display_title) ||
    toStringValue(item.card_title) ||
    toStringValue(item.name) ||
    toStringValue(item.event_title) ||
    titleFromDescription ||
    humanizeSlug(toStringValue(item.slug));
  if (!title) return null;

  const { month, day } = formatMonthDay(item.date ?? item.start_at ?? item.start_date ?? item.date_created);
  const timeLabel = toStringValue(item.time) || toStringValue(item.start_time);
  const zoomLink = toStringValue(item.zoom_link) || toStringValue(item.meeting_link);

  const meta = [
    timeLabel,
    toStringValue(item.location),
    toStringValue(item.venue),
    toStringValue(item.platform),
    zoomLink ? 'Zoom meeting' : '',
  ].filter(Boolean);
  const details = toStringArray(item.details);

  const jotformEmbedUrl = toStringValue(item.jotform_embed_url) || toStringValue(item.rsvp_embed_url);
  const jotformId = toStringValue(item.jotform_id);
  const slug = toStringValue(item.slug) || slugify(title);
  const eventUrl =
    toStringValue(item.event_url) ||
    toStringValue(item.url) ||
    toStringValue(item.link) ||
    `${getPathWithBase('/actions')}#event-${slug}`;
  const imageUrl = getEventImageUrl(item);
  const imageAlt = toStringValue(item.image_alt) || `${title} event image`;
  const mobilizeUrl =
    normalizeMobilizeUrl(item.mobilize_url) ||
    normalizeMobilizeUrl(item.mobilize_event_url) ||
    normalizeMobilizeUrl(item.mobilize_event_id) ||
    normalizeMobilizeUrl(item.mobilize_id);

  const address =
    toStringValue(item.address) || (zoomLink ? 'Online (Zoom)' : '');

  return {
    slug,
    title,
    month,
    day,
    sortDate:
      toStringValue(item.date) ||
      toStringValue(item.start_at) ||
      toStringValue(item.start_date) ||
      toStringValue(item.event_date) ||
      undefined,
    meta,
    address,
    desc: descriptionText,
    details,
    rsvpLabel: toStringValue(item.rsvp_label) || "I'll Be There",
    mobilizeUrl: mobilizeUrl || undefined,
    eventUrl: eventUrl || undefined,
    imageUrl: imageUrl || undefined,
    imageAlt: imageAlt || undefined,
    jotformId: jotformId || undefined,
    jotformEmbedUrl: jotformEmbedUrl || undefined,
    cancelled: parseBoolean(item.cancelled),
    cancellationMessage: toStringValue(item.cancellation_message) || undefined,
  };
}

export async function fetchUpcomingActionEvents(limit = 3): Promise<ActionEventItem[]> {
  if (!DIRECTUS_URL || !EVENTS_COLLECTION) return [];

  const token = await getDirectusToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const uniqueCollections = Array.from(new Set(EVENTS_COLLECTION_CANDIDATES.filter(Boolean)));
  const now = Date.now();

  for (const collection of uniqueCollections) {
    try {
      const params = new URLSearchParams({
        limit: '25',
        fields: '*',
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const response = await fetch(`${DIRECTUS_URL}/items/${collection}?${params}`, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) continue;

      const json = (await response.json()) as DirectusEventsResponse;
      const rows = Array.isArray(json.data) ? json.data : [];
      if (!rows.length) continue;

      const mapped = rows
        .filter((row) => {
          const status = toStringValue(row.status).toLowerCase();
          return !status || ['published', 'active', 'live', 'scheduled'].includes(status);
        })
        .filter((row) => {
          const eventDate = getEventDate(row);
          return !eventDate || eventDate.getTime() >= now - 12 * 60 * 60 * 1000;
        })
        .sort((a, b) => {
          const aDate = getEventDate(a);
          const bDate = getEventDate(b);
          if (aDate && bDate) return aDate.getTime() - bDate.getTime();
          if (aDate) return -1;
          if (bDate) return 1;
          return 0;
        })
        .map(mapEvent)
        .filter((item): item is ActionEventItem => !!item)
        .filter(
          (item) =>
            hasValue(item.title) &&
            (hasValue(item.mobilizeUrl) || hasValue(item.jotformEmbedUrl) || hasValue(item.jotformId) || hasValue(item.desc))
        );

      if (mapped.length) return mapped.slice(0, limit);
    } catch {
      // Try next collection candidate.
    }
  }

  return [];
}
