import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Flame, Target, Loader2, RefreshCw } from 'lucide-react';
import { WordCard, CategoryType, UserProgress } from '../types';
import { CATEGORIES } from '../constants';
import { WordCardView } from './WordCardView';

interface FeedViewProps {
  cards: WordCard[];
  progress: UserProgress;
  selectedCategory: CategoryType;
  onSelectCategory: (category: CategoryType) => void;
  onToggleSave: (wordId: string) => void;
  onToggleLearned: (wordId: string) => void;
  onRecordWordViewed: (wordId: string) => void;
  /** Called automatically when the learner nears the end of the feed. */
  onNeedMore: () => void;
  isLoadingWords: boolean;
  loadError: string | null;
  onRetry: () => void;
}

export const FeedView: React.FC<FeedViewProps> = ({
  cards,
  progress,
  selectedCategory,
  onSelectCategory,
  onToggleSave,
  onToggleLearned,
  onRecordWordViewed,
  onNeedMore,
  isLoadingWords,
  loadError,
  onRetry,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showToast, setShowToast] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeIndexRef = useRef(0);

  // Words always belong to the selected topic, so no client-side filtering is
  // needed — the server only ever returns the requested category.
  const visibleCards = cards;

  const setIndex = useCallback((index: number) => {
    activeIndexRef.current = index;
    setActiveIndex(index);
  }, []);

  // Record the word the learner is currently looking at.
  useEffect(() => {
    const card = visibleCards[activeIndex];
    if (card) onRecordWordViewed(card.id);
  }, [activeIndex, visibleCards, onRecordWordViewed]);

  // Reset scroll to the top whenever the topic changes.
  useEffect(() => {
    setIndex(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [selectedCategory, setIndex]);

  /**
   * Automatic real-time fetching: when the learner scrolls within two cards
   * of the end, the next batch is requested in the background. There is no
   * fetch button — scrolling alone pulls the next words.
   */
  useEffect(() => {
    if (visibleCards.length === 0) return;
    if (activeIndex >= visibleCards.length - 2) {
      onNeedMore();
    }
  }, [activeIndex, visibleCards.length, onNeedMore]);

  // Floating "generating" toast while a batch is in flight.
  useEffect(() => {
    if (!isLoadingWords) {
      setShowToast(false);
      return;
    }
    const timer = window.setTimeout(() => setShowToast(true), 700);
    return () => window.clearTimeout(timer);
  }, [isLoadingWords]);

  // Insta-style scroll: derive the active card from the scroll position so
  // swiping/scrolling alone moves between words — no Next button needed.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || el.clientHeight === 0) return;
    const index = Math.round(el.scrollTop / el.clientHeight);
    const clamped = Math.max(0, Math.min(index, visibleCards.length - 1));
    if (clamped !== activeIndexRef.current) {
      setIndex(clamped);
    }
  }, [visibleCards.length, setIndex]);

  const goalPercent = Math.min(
    100,
    Math.round((progress.todayLearnedCount / Math.max(1, progress.dailyGoal)) * 100)
  );

  return (
    <div className="reels-shell flex flex-col w-full h-[100dvh] max-h-[100dvh] overflow-hidden">
      {/* ---- Header: streak, daily goal, topic chips (fixed, feed slides under) ---- */}
      <header className="shrink-0 relative z-20 px-4 pt-3 pb-1 bg-[#F8F7FF]/95 backdrop-blur">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3 mb-2">
          {/* Streak badge — gradient accent */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-bold shadow-md shadow-[#EC4899]/25"
            style={{ backgroundImage: 'linear-gradient(135deg, #3B82F6 0%, #EC4899 100%)' }}
          >
            <Flame className="w-4 h-4" strokeWidth={2} fill="currentColor" />
            <span>{progress.streak} day streak</span>
          </div>

          {/* Daily goal with gradient progress bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#ECE9F6] min-w-[132px]">
            <Target className="w-3.5 h-3.5 text-[#EC4899]" strokeWidth={2} />
            <div className="flex-1">
              <div className="h-1.5 rounded-full bg-[#F1EEFA] overflow-hidden">
                <div
                  className="h-full brand-gradient rounded-full transition-all duration-500"
                  style={{ width: `${goalPercent}%` }}
                />
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#1A1A2E] tabular-nums">
              {progress.todayLearnedCount}/{progress.dailyGoal}
            </span>
          </div>
        </div>

        {/* Topic chips */}
        <div className="max-w-md mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                id={`filter-cat-${cat.id}`}
                onClick={() => onSelectCategory(cat.id)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex-shrink-0 active:scale-95 ${
                  isSelected
                    ? 'brand-gradient text-white shadow-md shadow-[#EC4899]/25'
                    : 'bg-white text-[#6B7280] border border-[#ECE9F6] hover:text-[#2563EB]'
                }`}
              >
                {cat.labelEn}
              </button>
            );
          })}
        </div>
      </header>

      {/* ---- Reels stage: swipe vertically, one word per full screen ---- */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="feed-scroll no-scrollbar relative w-full min-h-0 flex-1"
      >
        {visibleCards.length > 0 ? (
          visibleCards.map((card, index) => (
            <section
              key={card.id}
              data-index={index}
              className="feed-page w-full flex flex-col items-center justify-center px-0"
            >
              <WordCardView
                card={card}
                isSaved={progress.savedWordIds.includes(card.id)}
                isLearned={progress.learnedWordIds.includes(card.id)}
                onToggleSave={onToggleSave}
                onToggleLearned={onToggleLearned}
              />
            </section>
          ))
        ) : loadError ? (
            <div className="feed-page w-full flex flex-col items-center justify-center text-center p-8 gap-4">
              <div className="w-16 h-16 rounded-full brand-gradient-soft flex items-center justify-center">
                <RefreshCw className="w-7 h-7 text-[#EC4899]" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1A1A2E]">Couldn&apos;t load words</h3>
                <p className="text-sm text-[#6B7280] mt-1 max-w-xs">{loadError}</p>
              </div>
              <button
                onClick={onRetry}
                className="brand-gradient px-6 py-2.5 rounded-full text-white text-sm font-semibold shadow-lg shadow-[#EC4899]/25 active:scale-95 transition-transform"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="feed-page w-full flex flex-col items-center justify-center text-center p-8 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#EC4899]" strokeWidth={1.75} />
              <p className="text-sm font-medium text-[#6B7280]">
                Finding hard words in real time…
              </p>
            </div>
          )}

          {/* Inline loader page pinned after the last word while fetching more */}
          {visibleCards.length > 0 && isLoadingWords && (
            <div className="feed-page w-full flex items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#EC4899]" strokeWidth={2} />
              <span className="text-xs font-semibold text-[#6B7280]">
                Fetching more real-time words…
              </span>
            </div>
          )}
      </div>

      {/* ---- Floating page indicator (does not steal feed height) ---- */}
      {visibleCards.length > 0 && (
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-20 z-30 flex items-center justify-center">
          <span className="text-[11px] font-medium text-[#6B7280] bg-white/85 backdrop-blur px-3 py-1 rounded-full border border-[#ECE9F6] shadow-sm">
            Word <strong className="text-[#1A1A2E]">{activeIndex + 1}</strong> of{' '}
            {visibleCards.length}
          </span>
        </div>
      )}

      {/* Loading toast */}
      {showToast && isLoadingWords && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 brand-gradient text-white px-4 py-2 rounded-full text-xs font-semibold shadow-xl shadow-[#EC4899]/30 flex items-center gap-2 animate-float-up">
          <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
          <span>Fetching more real-time words…</span>
        </div>
      )}
    </div>
  );
};