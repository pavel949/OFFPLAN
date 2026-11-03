/**
 * Canonical taxonomies for the catalogue. Single source of truth for validation,
 * filters and admin/partner forms. Keep in sync with data/seed/projects.json
 * (enforced by lib/schema.test.ts).
 */

export const REC_LABELS = ["BUY", "WATCH", "AVOID"] as const;

export const SEGMENTS = [
  "offplan-new",
  "condo",
  "villa-entry",
  "villa-mid",
  "villa-lux",
  "branded",
  "completed",
] as const;

export const PROPERTY_TYPES = ["condo", "villa", "house"] as const;

/** Construction status key. */
export const STATUS_KEYS = ["offplan", "building", "ready"] as const;

/** Distance to beach: beachfront, ≤500m, ≤1km, inland. */
export const BEACH_KEYS = ["bf", "500", "1k", "inl"] as const;

/** Ownership: freehold, leasehold, both. */
export const OWNERSHIP_KEYS = ["fh", "lh", "both"] as const;

export const MANAGEMENT_KEYS = ["pro", "hotel", "self"] as const;

export const FOCUS_KEYS = ["STR", "LTR", "lifestyle", "growth", "mixed"] as const;

/** Risk tier: 1 low · 2 medium · 3 high (matches Risk tab and platform_settings). */
export const RISK_MIN = 1;
export const RISK_MAX = 3;

/** Composite rating scale. */
export const RATING_MIN = 0;
export const RATING_MAX = 10;

export const ZONES = [
  "Bang Tao",
  "Cape Panwa",
  "Cape Yamu",
  "Chalong",
  "Cherngtalay",
  "Kamala",
  "Karon",
  "Kata",
  "Kathu",
  "Koh Kaew",
  "Laguna",
  "Layan",
  "Mai Khao",
  "NW Coast",
  "Nai Harn",
  "Nai Yang",
  "Natai",
  "Patong",
  "Phuket Town",
  "Rawai",
  "Si Sunthon",
  "Surin",
  "Thalang",
] as const;

export type Zone = (typeof ZONES)[number];
