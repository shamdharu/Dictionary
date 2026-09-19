/**
 * Canonical topic registry for the real-time word engine.
 *
 * `lookup` is the seed phrase handed to Datamuse (which returns semantically
 * related words) — it is NOT a list of words to display. No vocabulary is
 * hardcoded anywhere in this app; only the subjects are.
 */
export interface TopicBucket {
  id: string;
  labelEn: string;
  labelTa: string;
  lookup: string;
}

export const CATEGORY_TOPICS: TopicBucket[] = [
  { id: 'all', labelEn: 'All Words', labelTa: 'அனைத்தும்', lookup: 'everyday life' },
  { id: 'emotions', labelEn: 'Emotions', labelTa: 'உணர்வுகள்', lookup: 'emotion' },
  { id: 'work', labelEn: 'Work & Office', labelTa: 'பணி & அலுவலகம்', lookup: 'employment' },
  { id: 'travel', labelEn: 'Travel', labelTa: 'பயணம்', lookup: 'travel' },
  { id: 'weather', labelEn: 'Weather', labelTa: 'வானிலை', lookup: 'weather' },
  { id: 'food', labelEn: 'Food & Dining', labelTa: 'உணவு', lookup: 'food' },
  { id: 'health', labelEn: 'Health', labelTa: 'உடல்நலம்', lookup: 'health' },
  { id: 'family', labelEn: 'Family', labelTa: 'குடும்பம்', lookup: 'family' },
  { id: 'daily routine', labelEn: 'Daily Routine', labelTa: 'அன்றாட பழக்கம்', lookup: 'daily routine' },
  { id: 'shopping', labelEn: 'Shopping', labelTa: 'வாங்குதல்', lookup: 'shopping' },
  { id: 'greetings', labelEn: 'Greetings', labelTa: 'வாழ்த்துகள்', lookup: 'greeting' },
  { id: 'study', labelEn: 'Study & Ideas', labelTa: 'கல்வி', lookup: 'learning' },
  { id: 'society', labelEn: 'Society', labelTa: 'சமூகம்', lookup: 'society' },
  { id: 'nature', labelEn: 'Nature', labelTa: 'இயற்கை', lookup: 'nature' },
  { id: 'money', labelEn: 'Money & Finance', labelTa: 'பணம்', lookup: 'finance' },
  { id: 'technology', labelEn: 'Technology', labelTa: 'தொழில்நுட்பம்', lookup: 'technology' },
];

/** Datamuse seed phrase for a category id (falls back to the id itself). */
export function resolveLookupTopic(categoryId: string): string {
  const bucket = CATEGORY_TOPICS.find((c) => c.id === categoryId);
  return bucket ? bucket.lookup : categoryId || 'everyday life';
}

/** All seed phrases, used to backfill when one topic's pool runs dry. */
export function allLookupTopics(): Record<string, string> {
  return CATEGORY_TOPICS.reduce<Record<string, string>>((acc, bucket) => {
    acc[bucket.id] = bucket.lookup;
    return acc;
  }, {});
}