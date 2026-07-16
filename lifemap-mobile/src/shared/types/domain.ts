import type { Timestamp } from 'firebase/firestore';

/**
 * Domain model for LifeMap AI. Mirrors the Firestore schema; the Cloud
 * Functions in ../../../functions are the authoritative writers for
 * server-derived fields (extraction results, rollups, timeline projections).
 */

// ─── Geo ─────────────────────────────────────────────────────────────────────

/** Stored as { lat, lng } in Firestore — human order, hard to misread. */
export type Coordinates = { lat: number; lng: number };

/**
 * GeoJSON (and every Mapbox API) is **[lng, lat]** — the reverse of how humans
 * say it. Always convert through this helper; a swapped pair puts pins in the
 * ocean and there is no type error to save you.
 */
export function toGeoJSONPosition(c: Coordinates): [number, number] {
  return [c.lng, c.lat];
}

/** ISO 3166-1 alpha-2, uppercase ("MA", "JP"). */
export type CountryCode = string;

// ─── Places ──────────────────────────────────────────────────────────────────

export const PLACE_KINDS = [
  'restaurant',
  'hotel',
  'airbnb',
  'beach',
  'attraction',
  'viewpoint',
  'bar',
  'cafe',
  'trail',
  'other',
] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export type PlaceStatus = 'saved' | 'planned' | 'visited';

export type Place = {
  id: string;
  ownerId: string;
  name: string;
  kind: PlaceKind;
  status: PlaceStatus;
  coordinates: Coordinates;
  country: CountryCode;
  city: string | null;
  tags: string[];
  notes?: string;
  rating?: number; // 1–5
  sourceReelId?: string | null;
  sharedSpaceId?: string | null;
  aiConfidence?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// ─── Reels ───────────────────────────────────────────────────────────────────

export type ReelPlatform = 'instagram' | 'tiktok' | 'youtube' | 'unknown';

/**
 * Lifecycle: client creates `pending` → function moves it through
 * `extracting` → `needs_review` (or `failed`) → `commitReelPlaces` marks it
 * `ready`. The client may only ever create; every transition is server-side.
 */
export type ReelStatus =
  | 'pending'
  | 'extracting'
  | 'needs_review'
  | 'ready'
  | 'failed';

export type ExtractedPlace = {
  name: string;
  kind: PlaceKind;
  coordinates: Coordinates | null;
  country: CountryCode | null;
  city: string | null;
  confidence: number;
  reasoning?: string;
};

export type Reel = {
  id: string;
  ownerId: string;
  url: string;
  platform: ReelPlatform;
  status: ReelStatus;
  errorMessage?: string;
  extraction?: {
    places: ExtractedPlace[];
    summary: string | null;
  };
  thumbnailUrl?: string | null;
  title?: string | null;
  authorHandle?: string | null;
  placeIds?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// ─── Memories ────────────────────────────────────────────────────────────────

export type Mood = 'amazing' | 'happy' | 'calm' | 'tired' | 'sad';

export const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 'amazing', emoji: '🤩', label: 'Amazing' },
  { value: 'happy', emoji: '😊', label: 'Happy' },
  { value: 'calm', emoji: '😌', label: 'Calm' },
  { value: 'tired', emoji: '😮‍💨', label: 'Tired' },
  { value: 'sad', emoji: '😢', label: 'Sad' },
];

export type MemoryMedia = {
  /** Storage path users/{uid}/memories/{memoryId}/{file} */
  storagePath: string;
  downloadUrl: string;
  type: 'photo' | 'video' | 'audio';
  width?: number;
  height?: number;
  durationMs?: number;
};

export type Memory = {
  id: string;
  ownerId: string;
  title: string;
  note?: string;
  media: MemoryMedia[];
  mood?: Mood;
  rating?: number; // 1–5
  coordinates?: Coordinates | null;
  country?: CountryCode | null;
  city?: string | null;
  placeId?: string | null;
  sharedSpaceId?: string | null;
  occurredAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// ─── Passports ───────────────────────────────────────────────────────────────

export type FoodEntry = {
  id: string;
  ownerId: string;
  restaurantName: string;
  dish?: string;
  rating: number; // 1–5
  priceLevel?: 1 | 2 | 3 | 4;
  notes?: string;
  photoUrl?: string | null;
  coordinates?: Coordinates | null;
  country?: CountryCode | null;
  city?: string | null;
  placeId?: string | null;
  sharedSpaceId?: string | null;
  visitedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type StayKind = 'hotel' | 'airbnb' | 'hostel' | 'other';

export type StayEntry = {
  id: string;
  ownerId: string;
  name: string;
  kind: StayKind;
  rating: number; // 1–5
  review?: string;
  pricePerNight?: number;
  currency?: string;
  photoUrl?: string | null;
  coordinates?: Coordinates | null;
  country?: CountryCode | null;
  city?: string | null;
  placeId?: string | null;
  sharedSpaceId?: string | null;
  checkIn: Timestamp;
  checkOut?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Run = {
  id: string;
  ownerId: string;
  distanceMeters: number;
  durationSec: number;
  /** Encoded polyline of the route, if tracked. */
  polyline?: string | null;
  startCoordinates?: Coordinates | null;
  country?: CountryCode | null;
  city?: string | null;
  source: 'manual' | 'tracked' | 'strava';
  startedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// ─── Trips / goals / timeline ────────────────────────────────────────────────

export type Trip = {
  id: string;
  ownerId: string;
  title: string;
  country: CountryCode;
  city?: string | null;
  startDate: Timestamp;
  endDate?: Timestamp | null;
  placeIds: string[];
  sharedSpaceId?: string | null;
  coverPhotoUrl?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Goal = {
  id: string;
  ownerId: string;
  title: string;
  done: boolean;
  targetDate?: Timestamp | null;
  sharedSpaceId?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type TimelineEntryKind =
  | 'trip'
  | 'memory'
  | 'run'
  | 'food'
  | 'stay'
  | 'goal'
  | 'milestone';

/** Server-maintained projection — read-only on the client. */
export type TimelineEntry = {
  id: string;
  ownerId: string;
  kind: TimelineEntryKind;
  refId: string;
  title: string;
  subtitle?: string | null;
  country?: CountryCode | null;
  occurredAt: Timestamp;
};

// ─── Rollups (server-maintained, read-only) ──────────────────────────────────

export type CountryStatus = 'visited' | 'planned' | 'saved' | 'none';

export type CountryEntry = {
  status: CountryStatus;
  placeCount: number;
  memoryCount: number;
  reelCount: number;
  runCount: number;
};

export type CountryRollup = {
  ownerId: string;
  countries: Record<CountryCode, CountryEntry>;
  updatedAt: Timestamp;
};

// ─── Users & couple mode ─────────────────────────────────────────────────────

export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  photoUrl?: string | null;
  homeCountry?: CountryCode | null;
  sharedSpaceIds: string[];
  createdAt: Timestamp;
};

export type SharedSpace = {
  id: string;
  ownerId: string;
  name: string;
  memberIds: string[];
  inviteCode?: string;
  createdAt: Timestamp;
};

export type BucketListItem = {
  id: string;
  sharedSpaceId: string;
  createdBy: string;
  title: string;
  done: boolean;
  country?: CountryCode | null;
  createdAt: Timestamp;
};
