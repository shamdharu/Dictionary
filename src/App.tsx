/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WordCard, CategoryType, TabType, UserProgress } from './types';
import { requestRealtimeWords } from './utils/wordApi';
import {
  getInitialProgress,
  saveProgress,
  getCachedCards,
  saveCachedCards,
  getSeenWordIds,
  addSeenWordIds,
} from './utils/storage';
import { FeedView } from './components/FeedView';
import { SavedWordsView } from './components/SavedWordsView';
import { ProgressStatsView } from './components/ProgressStatsView';
import { BottomNavigation } from './components/BottomNavigation';

/** How many live words to request per batch. */
const BATCH_SIZE = 4;
/** Start the very first batch a little larger for a smooth first session. */
const INITIAL_BATCH_SIZE = 6;

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [isLoadingWords, setIsLoadingWords] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cards, setCards] = useState<WordCard[]>([]);
  const [progress, setProgress] = useState<UserProgress>(getInitialProgress);

  /** Tracks which category the currently displayed cards belong to. */
  const loadedCategoryRef = useRef<string>('');
  /** Guards against overlapping batches. */
  const inFlightRef = useRef(false);

  // Sync progress to localStorage
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  /**
   * Pulls a fresh batch of live words. Nothing is hardcoded — the server
   * discovers them on demand from public dictionary data.
   */
  const loadWords = useCallback(
    async (category: string, count: number, replace: boolean) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setIsLoadingWords(true);
      setLoadError(null);

      try {
        const excludeWords = replace
          ? []
          : Array.from(
              new Set([...getSeenWordIds(), ...cards.map((c) => c.id.toLowerCase())])
            ).slice(-200);

        const fresh = await requestRealtimeWords({ category, count, excludeWords });

        if (fresh.length === 0) {
          if (replace && cards.length === 0) {
            setLoadError('Could not reach the live vocabulary sources.');
          }
          return;
        }

        addSeenWordIds(fresh.map((w) => w.id));

        setCards((prev) => {
          const next = replace ? fresh : [...prev, ...fresh];
          const deduped: WordCard[] = [];
          const ids = new Set<string>();
          for (const card of next) {
            const key = card.id.toLowerCase();
            if (ids.has(key)) continue;
            ids.add(key);
            deduped.push(card);
          }
          saveCachedCards(category, deduped);
          return deduped;
        });
      } finally {
        inFlightRef.current = false;
        setIsLoadingWords(false);
      }
    },
    [cards]
  );

  // Whenever the topic changes, show its cached words instantly and then make
  // sure there is a live batch ready to scroll into.
  useEffect(() => {
    if (loadedCategoryRef.current === selectedCategory) return;
    loadedCategoryRef.current = selectedCategory;

    const cached = getCachedCards(selectedCategory);
    setCards(cached);

    if (cached.length > 0) {
      // Top up in the background so the feed never stalls.
      void loadWords(selectedCategory, BATCH_SIZE, false);
    } else {
      void loadWords(selectedCategory, INITIAL_BATCH_SIZE, true);
    }
    // Intentionally keyed on the category only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  /** Called by the feed when the learner approaches the end of the list. */
  const handleNeedMore = useCallback(() => {
    if (inFlightRef.current) return;
    void loadWords(selectedCategory, BATCH_SIZE, false);
  }, [loadWords, selectedCategory]);

  const handleRetry = useCallback(() => {
    void loadWords(selectedCategory, INITIAL_BATCH_SIZE, true);
  }, [loadWords, selectedCategory]);

  // Toggle Save / Bookmark
  const handleToggleSave = (wordId: string) => {
    setProgress((prev) => {
      const isSaved = prev.savedWordIds.includes(wordId);
      return {
        ...prev,
        savedWordIds: isSaved
          ? prev.savedWordIds.filter((id) => id !== wordId)
          : [...prev.savedWordIds, wordId],
      };
    });
  };

  // Toggle Learned / Mastered
  const handleToggleLearned = (wordId: string) => {
    setProgress((prev) => {
      const isLearned = prev.learnedWordIds.includes(wordId);
      return {
        ...prev,
        learnedWordIds: isLearned
          ? prev.learnedWordIds.filter((id) => id !== wordId)
          : [...prev.learnedWordIds, wordId],
        todayLearnedCount: isLearned
          ? Math.max(0, prev.todayLearnedCount - 1)
          : prev.todayLearnedCount + 1,
      };
    });
  };

  // Track word viewing
  const handleRecordWordViewed = (wordId: string) => {
    setProgress((prev) => {
      if (prev.viewedWordIds.includes(wordId)) return prev;
      return { ...prev, viewedWordIds: [...prev.viewedWordIds, wordId] };
    });
  };

  const handleUpdateDailyGoal = (newGoal: number) => {
    setProgress((prev) => ({ ...prev, dailyGoal: newGoal }));
  };

  const handleResetProgress = () => {
    setProgress(getInitialProgress());
  };

  const handleOpenInFeed = () => {
    setSelectedCategory('all');
    setActiveTab('feed');
  };

  const savedCards = cards.filter((c) => progress.savedWordIds.includes(c.id));

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-[#F8F7FF] text-[#1A1A2E] overflow-hidden font-sans">
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
            onNeedMore={handleNeedMore}
            isLoadingWords={isLoadingWords}
            loadError={loadError}
            onRetry={handleRetry}
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

      <BottomNavigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        savedCount={progress.savedWordIds.length}
        streak={progress.streak}
      />
    </div>
  );
}
