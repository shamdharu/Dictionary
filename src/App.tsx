/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { WordCard, CategoryType, TabType, UserProgress } from './types';
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
    return getCachedCustomCards();
  });

  const [progress, setProgress] = useState<UserProgress>(getInitialProgress);

  // Sync progress to localStorage
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  // Real-time batch fetching function from Gemini Flash backend
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
    } catch (err) {
      console.warn('Real-time batch fetch error:', err);
    } finally {
      setIsFetchingRealtime(false);
    }
    return [];
  };

  // On initial mount, only fetch fresh real-time words if cards collection is empty
  useEffect(() => {
    if (cards.length === 0) {
      fetchRealtimeBatch('all', 3, true);
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
