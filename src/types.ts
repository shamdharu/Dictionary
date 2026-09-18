export type CategoryType = 
  | 'all'
  | 'greetings'
  | 'emotions'
  | 'food'
  | 'work'
  | 'travel'
  | 'weather'
  | 'family'
  | 'daily routine'
  | 'health'
  | 'shopping';

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
