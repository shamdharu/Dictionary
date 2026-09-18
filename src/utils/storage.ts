import { UserProgress } from '../types';

const PROGRESS_STORAGE_KEY = 'tamil_vocab_scroll_progress';
const CACHED_CARDS_KEY = 'tamil_vocab_scroll_cached_cards';
const SEEN_WORDS_KEY = 'tamil_vocab_scroll_seen_words';

export function getTodayString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

export function getInitialProgress(): UserProgress {
  const today = getTodayString();
  const defaultProgress: UserProgress = {
    streak: 1,
    lastActiveDate: today,
    savedWordIds: ['grateful', 'delicious', 'deadline'],
    viewedWordIds: ['grateful'],
    learnedWordIds: [],
    dailyGoal: 10,
    todayLearnedCount: 1,
    history: [{ date: today, count: 1 }],
  };

  if (typeof window === 'undefined') return defaultProgress;

  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(defaultProgress));
      return defaultProgress;
    }

    const parsed: UserProgress = JSON.parse(raw);
    
    // Check and update streak based on last active date
    if (parsed.lastActiveDate !== today) {
      const lastDate = new Date(parsed.lastActiveDate);
      const currentDate = new Date(today);
      const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        parsed.streak = (parsed.streak || 0) + 1;
      } else if (diffDays > 1) {
        parsed.streak = 1;
      }

      parsed.lastActiveDate = today;
      parsed.todayLearnedCount = 0; // Reset daily count on new calendar day
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(parsed));
    }

    return parsed;
  } catch (err) {
    console.error('Error reading progress from localStorage', err);
    return defaultProgress;
  }
}

export function saveProgress(progress: UserProgress): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch (err) {
    console.error('Error writing progress to localStorage', err);
  }
}

export function getCachedCustomCards(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CACHED_CARDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCachedCustomCards(cards: any[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHED_CARDS_KEY, JSON.stringify(cards));
  } catch (err) {
    console.warn('Error saving cached custom cards', err);
  }
}

export function getSeenWordIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SEEN_WORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addSeenWordIds(wordIds: string[]): void {
  if (typeof window === 'undefined' || !wordIds.length) return;
  try {
    const current = getSeenWordIds();
    const set = new Set(current.map(id => id.toLowerCase()));
    wordIds.forEach(id => set.add(id.toLowerCase()));
    // Keep last 300 to avoid unbounded growth while guaranteeing uniqueness
    const updated = Array.from(set).slice(-300);
    localStorage.setItem(SEEN_WORDS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Error saving seen words', err);
  }
}
