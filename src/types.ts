export type CategoryType =
  | 'all'
  | 'emotions'
  | 'work'
  | 'travel'
  | 'weather'
  | 'food'
  | 'health'
  | 'family'
  | 'daily routine'
  | 'shopping'
  | 'greetings'
  | 'study'
  | 'society'
  | 'nature'
  | 'money'
  | 'technology';

export interface WordCard {
  id: string;
  word: string;
  tamilMeaning: string;
  partOfSpeech: string;
  phonetic?: string;
  englishDefinition: string;
  englishSentence: string;
  tamilSentence: string;
  category: CategoryType | string;
  colorTheme?: string;
  /** 0-100 hardness score computed live from corpus rarity + morphology. */
  difficulty?: number;
  synonyms?: string[];
  antonyms?: string[];
  audioUrl?: string;
  source?: string;
  dictionarySource?: string;
}

export interface UserProgress {
  streak: number;
  lastActiveDate: string;
  savedWordIds: string[];
  viewedWordIds: string[];
  learnedWordIds: string[];
  dailyGoal: number;
  todayLearnedCount: number;
  history: { date: string; count: number }[];
}

export type TabType = 'feed' | 'saved' | 'stats';

export interface CategoryMeta {
  id: CategoryType;
  labelEn: string;
  labelTa: string;
  icon: string;
  gradient: string;
  cardBg: string;
}
