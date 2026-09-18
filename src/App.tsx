/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { WordCard, CategoryType, TabType, UserProgress } from './types';
import { DEFAULT_STARTER_CARDS, CATEGORY_TOPIC_WORDS } from './constants';
import { lookupDictionaryWord } from './utils/dictionaryApi';
import { 
  getInitialProgress, 
  saveProgress, 
  getCachedCustomCards, 
  saveCachedCustomCards,
  getSeenWordIds,
  addSeenWordIds
} from './utils/storage';
import { FeedView } from './components/FeedView';
import { SavedWordsView } from './components/SavedWordsView';
import { ProgressStatsView } from './components/ProgressStatsView';
import { BottomNavigation } from './components/BottomNavigation';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [isFetchingRealtime, setIsFetchingRealtime] = useState(false);
  const [cards, setCards] = useState<WordCard[]>(() => {
    const cached = getCachedCustomCards();
    if (cached && cached.length > 0) return cached;
    return DEFAULT_STARTER_CARDS;
  });

  const [progress, setProgress] = useState<UserProgress>(getInitialProgress);

  // Sync progress to localStorage
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  // Real-time batch fetching function from Gemini Flash backend with browser Free Dictionary fallback
  const fetchRealtimeBatch = async (category: string = 'all', count: number = 3, prepend: boolean = false): Promise<WordCard[]> => {
    setIsFetchingRealtime(true);
    try {
      const seen = getSeenWordIds();
      const res = await fetch('/api/realtime-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          count,
          excludeWords: seen,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.words) && data.words.length > 0) {
          const freshWords: WordCard[] = data.words;
          addSeenWordIds(freshWords.map(w => w.id));

          setCards(prev => {
            const existingIds = new Set(prev.map(c => c.id.toLowerCase()));
            const nonDuplicateWords = freshWords.filter(nw => !existingIds.has(nw.id.toLowerCase()));
            if (nonDuplicateWords.length === 0) return prev;

            const updated = prepend ? [...nonDuplicateWords, ...prev] : [...prev, ...nonDuplicateWords];
            saveCachedCustomCards(updated);
            return updated;
          });

          return freshWords;
        }
      }
      
      // Fallback for static hosts (e.g. Vercel without serverless) or offline API
      return await fetchClientSideSeedBatch(category, count, prepend);
    } catch (err) {
      console.warn('Backend unavailable, falling back to client-side Free Dictionary lookup:', err);
      return await fetchClientSideSeedBatch(category, count, prepend);
    } finally {
      setIsFetchingRealtime(false);
    }
  };

  // Client-side dictionary batch loader
  const fetchClientSideSeedBatch = async (category: string, count: number, prepend: boolean): Promise<WordCard[]> => {
    try {
      const seedPool = (category !== 'all' && CATEGORY_TOPIC_WORDS[category])
        ? CATEGORY_TOPIC_WORDS[category]
        : Object.values(CATEGORY_TOPIC_WORDS).flat();

      const seen = getSeenWordIds();
      const existingIds = new Set(cards.map(c => c.id.toLowerCase()));
      const available = seedPool.filter(w => !seen.includes(w.toLowerCase()) && !existingIds.has(w.toLowerCase()));
      const wordsToFetch = (available.length >= count ? available : seedPool)
        .sort(() => 0.5 - Math.random())
        .slice(0, count);

      const fetchedCards: WordCard[] = [];
      for (const w of wordsToFetch) {
        const card = await lookupDictionaryWord(w, category !== 'all' ? category : 'daily routine');
        if (card) fetchedCards.push(card);
      }

      if (fetchedCards.length > 0) {
        addSeenWordIds(fetchedCards.map(w => w.id));
        setCards(prev => {
          const prevIds = new Set(prev.map(c => c.id.toLowerCase()));
          const nonDup = fetchedCards.filter(c => !prevIds.has(c.id.toLowerCase()));
          if (nonDup.length === 0) return prev;
          const updated = prepend ? [...nonDup, ...prev] : [...prev, ...nonDup];
          saveCachedCustomCards(updated);
          return updated;
        });
        return fetchedCards;
      }
    } catch (clientErr) {
      console.warn('Client fallback fetch error:', clientErr);
    }
    return [];
  };

  // On initial mount, ensure we have cards
  useEffect(() => {
    if (cards.length === 0) {
      setCards(DEFAULT_STARTER_CARDS);
    }
  }, []);

  // Toggle Save / Bookmark
  const handleToggleSave = (wordId: string) => {
    setProgress(prev => {
      const isSaved = prev.savedWordIds.includes(wordId);
      const newSaved = isSaved
        ? prev.savedWordIds.filter(id => id !== wordId)
        : [...prev.savedWordIds, wordId];
      return {
        ...prev,
        savedWordIds: newSaved,
      };
    });
  };

  // Toggle Learned / Mastered
  const handleToggleLearned = (wordId: string) => {
    setProgress(prev => {
      const isLearned = prev.learnedWordIds.includes(wordId);
      const newLearned = isLearned
        ? prev.learnedWordIds.filter(id => id !== wordId)
        : [...prev.learnedWordIds, wordId];

      const newTodayCount = !isLearned ? prev.todayLearnedCount + 1 : prev.todayLearnedCount;

      return {
        ...prev,
        learnedWordIds: newLearned,
        todayLearnedCount: newTodayCount,
      };
    });
  };

  // Track word viewing
  const handleRecordWordViewed = (wordId: string) => {
    setProgress(prev => {
      if (prev.viewedWordIds.includes(wordId)) return prev;
      return {
        ...prev,
        viewedWordIds: [...prev.viewedWordIds, wordId],
      };
    });
  };

  // Add newly fetched dynamic card from Dictionary API
  const handleAddNewDynamicCard = (newCard: WordCard, prepend: boolean = true) => {
    setCards(prev => {
      const filtered = prev.filter(c => c.id.toLowerCase() !== newCard.id.toLowerCase());
      const updated = prepend ? [newCard, ...filtered] : [...filtered, newCard];
      // Save new card to local cached custom cards
      saveCachedCustomCards(updated);
      return updated;
    });
  };

  // Update daily goal from stats tab
  const handleUpdateDailyGoal = (newGoal: number) => {
    setProgress(prev => ({
      ...prev,
      dailyGoal: newGoal,
    }));
  };

  // Reset progress confirmation
  const handleResetProgress = () => {
    const fresh = getInitialProgress();
    setProgress(fresh);
  };

  // Jump from Saved tab directly to Feed
  const handleOpenInFeed = (card: WordCard) => {
    setSelectedCategory('all');
    setActiveTab('feed');
  };

  const savedCards = cards.filter(c => progress.savedWordIds.includes(c.id));

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-stone-950 text-stone-100 overflow-hidden font-sans">
      {/* Main Content View Container */}
      <main className="flex-1 w-full h-full relative overflow-hidden">
        {activeTab === 'feed' && (
          <FeedView
            cards={cards}
            progress={progress}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onToggleSave={handleToggleSave}
            onToggleLearned={handleToggleLearned}
            onRecordWordViewed={handleRecordWordViewed}
            onAddNewDynamicCard={handleAddNewDynamicCard}
            onFetchRealtime={fetchRealtimeBatch}
            isFetchingRealtime={isFetchingRealtime}
          />
        )}

        {activeTab === 'saved' && (
          <SavedWordsView
            savedCards={savedCards}
            onRemoveSave={handleToggleSave}
            onOpenInFeed={handleOpenInFeed}
          />
        )}

        {activeTab === 'stats' && (
          <ProgressStatsView
            progress={progress}
            allCards={cards}
            onUpdateDailyGoal={handleUpdateDailyGoal}
            onResetProgress={handleResetProgress}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        savedCount={progress.savedWordIds.length}
        streak={progress.streak}
      />
    </div>
  );
}
