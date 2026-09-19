import { CategoryMeta } from './types';

/**
 * Brand palette — a blue -> pink/magenta gradient inspired by Instagram's
 * aesthetic, replacing the usual orange/purple mix.
 */
export const BRAND = {
  blue: '#3B82F6',
  blueDeep: '#2563EB',
  pink: '#EC4899',
  pinkBright: '#FF4F9A',
  ink: '#1A1A2E',
  muted: '#6B7280',
  surface: '#FAFAFA',
  surfaceAlt: '#F8F7FF',
  border: '#ECE9F6',
};

/** Shared gradient used for accents, active states and progress bars. */
export const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND.blue} 0%, #8B5CF6 45%, ${BRAND.pink} 100%)`;

/** Human-readable label for a category id (falls back to the raw value). */
export function getCategoryLabel(categoryId: string): string {
  const bucket = CATEGORIES.find((c) => c.id === categoryId);
  return bucket ? bucket.labelEn : categoryId;
}

/**
 * Purely presentational metadata for the topic chips.
 *
 * No English vocabulary is declared here — every word is discovered live at
 * request time by the server (see src/server/wordSource.ts). Only the subject
 * of each bucket lives in this file.
 */
export const CATEGORIES: CategoryMeta[] = [
  { id: 'all', labelEn: 'All Words', labelTa: 'அனைத்தும்', icon: 'Sparkles', gradient: '', cardBg: '' },
  { id: 'emotions', labelEn: 'Emotions', labelTa: 'உணர்வுகள்', icon: 'Smile', gradient: '', cardBg: '' },
  { id: 'work', labelEn: 'Work', labelTa: 'பணி', icon: 'Briefcase', gradient: '', cardBg: '' },
  { id: 'travel', labelEn: 'Travel', labelTa: 'பயணம்', icon: 'Plane', gradient: '', cardBg: '' },
  { id: 'weather', labelEn: 'Weather', labelTa: 'வானிலை', icon: 'CloudRain', gradient: '', cardBg: '' },
  { id: 'food', labelEn: 'Food', labelTa: 'உணவு', icon: 'Utensils', gradient: '', cardBg: '' },
  { id: 'health', labelEn: 'Health', labelTa: 'உடல்நலம்', icon: 'Activity', gradient: '', cardBg: '' },
  { id: 'family', labelEn: 'Family', labelTa: 'குடும்பம்', icon: 'Users', gradient: '', cardBg: '' },
  { id: 'daily routine', labelEn: 'Routine', labelTa: 'அன்றாடம்', icon: 'Clock', gradient: '', cardBg: '' },
  { id: 'shopping', labelEn: 'Shopping', labelTa: 'வாங்குதல்', icon: 'ShoppingBag', gradient: '', cardBg: '' },
  { id: 'greetings', labelEn: 'Greetings', labelTa: 'வாழ்த்துகள்', icon: 'Hand', gradient: '', cardBg: '' },
  { id: 'study', labelEn: 'Study', labelTa: 'கல்வி', icon: 'GraduationCap', gradient: '', cardBg: '' },
  { id: 'society', labelEn: 'Society', labelTa: 'சமூகம்', icon: 'Globe', gradient: '', cardBg: '' },
  { id: 'nature', labelEn: 'Nature', labelTa: 'இயற்கை', icon: 'Leaf', gradient: '', cardBg: '' },
  { id: 'money', labelEn: 'Money', labelTa: 'பணம்', icon: 'Coins', gradient: '', cardBg: '' },
  { id: 'technology', labelEn: 'Tech', labelTa: 'தொழில்நுட்பம்', icon: 'Cpu', gradient: '', cardBg: '' },
];