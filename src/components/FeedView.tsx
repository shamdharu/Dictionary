import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronUp, 
  ChevronDown, 
  Flame, 
  Target, 
  RotateCcw, 
  Sparkles, 
  Loader2, 
  Filter, 
  Volume2,
  Shuffle,
  Zap,
  BookOpen,
  Search
} from 'lucide-react';
import { WordCard, CategoryType, UserProgress } from '../types';
import { CATEGORIES } from '../data/wordsData';
import { WordCardView } from './WordCardView';
import { DictionaryLookupModal } from './DictionaryLookupModal';
import { lookupDictionaryWord } from '../utils/dictionaryApi';
import { speakEnglish } from '../utils/speech';

interface FeedViewProps {
  cards: WordCard[];
  progress: UserProgress;
  selectedCategory: CategoryType;
  onSelectCategory: (category: CategoryType) => void;
  onToggleSave: (wordId: string) => void;
  onToggleLearned: (wordId: string) => void;
  onRecordWordViewed: (wordId: string) => void;
  onAddNewDynamicCard: (card: WordCard) => void;
  onFetchRealtime?: (category: string, count: number, prepend?: boolean) => Promise<WordCard[]>;
  isFetchingRealtime?: boolean;
}

export const FeedView: React.FC<FeedViewProps> = ({
  cards,
  progress,
  selectedCategory,
  onSelectCategory,
  onToggleSave,
  onToggleLearned,
  onRecordWordViewed,
  onAddNewDynamicCard,
  onFetchRealtime,
  isFetchingRealtime = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0); // 1 = down/next, -1 = up/prev
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isDictionaryModalOpen, setIsDictionaryModalOpen] = useState(false);

  // Filter cards by category if selected
  const filteredCards = selectedCategory === 'all'
    ? cards
    : cards.filter(c => c.category.toLowerCase() === selectedCategory.toLowerCase());

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);
  const isScrollingRef = useRef(false);

  // Record viewed word whenever index changes
  useEffect(() => {
    if (filteredCards[currentIndex]) {
      onRecordWordViewed(filteredCards[currentIndex].id);
    }
  }, [currentIndex, filteredCards]);

  // Reset index when category changes and auto-fetch if category has few words
  useEffect(() => {
    setCurrentIndex(0);
    if (onFetchRealtime && filteredCards.length < 3 && !isFetchingRealtime) {
      onFetchRealtime(selectedCategory, 4, false);
    }
  }, [selectedCategory]);

  // Primary Real-time AI Generation Handler (Instant Fresh Words via Gemini Flash)
  const handleGenerateFreshRealtime = useCallback(async () => {
    if (onFetchRealtime && !isFetchingRealtime) {
      setIsLoadingNext(true);
      setFetchError(null);
      try {
        const fresh = await onFetchRealtime(selectedCategory, 3, true);
        if (fresh && fresh.length > 0) {
          setDirection(-1);
          setCurrentIndex(0);
        }
      } catch (err: any) {
        console.warn('Realtime generate failed:', err);
      } finally {
        setIsLoadingNext(false);
      }
      return;
    }

    // Fallback if onFetchRealtime not available
    fetchNextApiWord();
  }, [onFetchRealtime, selectedCategory, isFetchingRealtime]);

  // Fetch dynamic word from API without relying on hardcoded word list
  const fetchNextApiWord = useCallback(async () => {
    setIsLoadingNext(true);
    setFetchError(null);

    if (onFetchRealtime) {
      try {
        const fresh = await onFetchRealtime(selectedCategory, 3, false);
        if (fresh && fresh.length > 0) {
          setDirection(1);
          setCurrentIndex(prev => prev + 1);
          return;
        }
      } catch (err) {
        console.warn('Realtime batch failed, trying direct dictionary lookup');
      }
    }

    // Dynamic topic-driven vocabulary fallback
    const dynamicTopics = [
      'resilience', 'empathy', 'eloquent', 'mindfulness', 'tenacity',
      'ephemeral', 'serendipity', 'benevolent', 'perseverance', 'pragmatic'
    ];
    const existingIds = new Set(cards.map(c => c.id.toLowerCase()));
    const unselectedWord = dynamicTopics.find(w => !existingIds.has(w)) || 'compassion';

    try {
      const newCard = await lookupDictionaryWord(unselectedWord, selectedCategory);
      if (newCard) {
        onAddNewDynamicCard(newCard);
        setDirection(1);
        setCurrentIndex(prev => prev + 1);
      }
    } catch (err: any) {
      console.warn('Dynamic fetch fallback:', err);
    } finally {
      setIsLoadingNext(false);
    }
  }, [cards, onAddNewDynamicCard, onFetchRealtime, selectedCategory]);

  // Auto pre-fetch next real-time batch when near end
  useEffect(() => {
    if (currentIndex >= filteredCards.length - 2 && onFetchRealtime && !isFetchingRealtime && !isLoadingNext) {
      onFetchRealtime(selectedCategory, 4, false);
    }
  }, [currentIndex, filteredCards.length, onFetchRealtime, isFetchingRealtime, isLoadingNext, selectedCategory]);

  const handleNext = useCallback(() => {
    if (isScrollingRef.current) return;
    isScrollingRef.current = true;
    setTimeout(() => { isScrollingRef.current = false; }, 350);

    if (currentIndex < filteredCards.length - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
    } else {
      // Reached the end of current list, fetch new real-time words!
      if (onFetchRealtime && !isFetchingRealtime) {
        setIsLoadingNext(true);
        onFetchRealtime(selectedCategory, 4, false).then(fresh => {
          setIsLoadingNext(false);
          if (fresh && fresh.length > 0) {
            setDirection(1);
            setCurrentIndex(prev => prev + 1);
          }
        }).catch(() => {
          setIsLoadingNext(false);
          fetchNextApiWord();
        });
      } else {
        fetchNextApiWord();
      }
    }
  }, [currentIndex, filteredCards.length, onFetchRealtime, isFetchingRealtime, selectedCategory, fetchNextApiWord]);

  const handlePrev = useCallback(() => {
    if (isScrollingRef.current) return;
    isScrollingRef.current = true;
    setTimeout(() => { isScrollingRef.current = false; }, 350);

    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  // Touch Swipe Handlers for mobile reels gesture
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchEndY.current = null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndY.current = e.touches[0].clientY;
  };

  const onTouchEnd = () => {
    if (touchStartY.current === null || touchEndY.current === null) return;
    const distance = touchStartY.current - touchEndY.current;
    const minSwipeDistance = 45; // threshold in px

    if (distance > minSwipeDistance) {
      // Swiped Up -> Go to Next Word
      handleNext();
    } else if (distance < -minSwipeDistance) {
      // Swiped Down -> Go to Previous Word
      handlePrev();
    }
    touchStartY.current = null;
    touchEndY.current = null;
  };

  // Mouse wheel scroll handler with debouncing
  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) < 30) return;
    if (e.deltaY > 0) {
      handleNext();
    } else {
      handlePrev();
    }
  };

  // Keyboard navigation (ArrowUp, ArrowDown, Space, J, K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((document.activeElement?.tagName || '').toLowerCase())) {
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'j' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  const currentCard = filteredCards[currentIndex];

  // Motion animation variants for the reel transition
  const cardVariants = {
    enter: (dir: number) => ({
      y: dir > 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 0.94,
    }),
    center: {
      y: '0%',
      opacity: 1,
      scale: 1,
      transition: {
        y: { type: 'spring' as const, stiffness: 350, damping: 32 },
        opacity: { duration: 0.25 },
        scale: { duration: 0.25 },
      },
    },
    exit: (dir: number) => ({
      y: dir > 0 ? '-100%' : '100%',
      opacity: 0,
      scale: 0.94,
      transition: {
        y: { type: 'spring' as const, stiffness: 350, damping: 32 },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 },
      },
    }),
  };

  return (
    <div 
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onWheel={handleWheel}
      className="relative w-full h-full flex flex-col overflow-hidden bg-stone-950"
    >
      {/* TOP BAR: Streak, Daily Goal, and Category Filter Bar */}
      <div className="z-30 w-full bg-stone-950/80 backdrop-blur-md border-b border-stone-800/80 px-4 pt-3 pb-2.5">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3 mb-2">
          {/* Daily Streak Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            <Flame className="w-4 h-4 text-orange-500 fill-orange-500 animate-bounce" />
            <span>{progress.streak} Day Streak</span>
          </div>

          {/* Daily Goal Counter */}
          <div className="flex items-center gap-1.5 text-xs text-stone-300 bg-stone-900 px-3 py-1 rounded-full border border-stone-800">
            <Target className="w-3.5 h-3.5 text-emerald-400" />
            <span>Today: <strong className="text-white">{progress.todayLearnedCount}</strong>/{progress.dailyGoal}</span>
          </div>

          {/* Dynamic Real-time AI Word Fetch Button */}
          <div className="flex items-center gap-1.5">
            <button
              id="btn-open-dictionary-lookup"
              onClick={() => setIsDictionaryModalOpen(true)}
              title="Search any word via Free Dictionary API"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-stone-900 hover:bg-stone-850 text-stone-200 border border-stone-700/80 transition-all shadow-sm active:scale-95"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-medium">Dict API</span>
            </button>

            <button
              id="btn-shuffle-dynamic-word"
              onClick={handleGenerateFreshRealtime}
              disabled={isLoadingNext || isFetchingRealtime}
              title="Generate completely new, unrepeated words in real-time with Gemini AI"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-purple-500/20 hover:from-amber-500/30 hover:to-purple-500/30 text-amber-200 border border-amber-500/40 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {isLoadingNext || isFetchingRealtime ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              )}
              <span className="font-medium">Real-time</span>
            </button>
          </div>
        </div>

        {/* Categories Horizontal Scroll Pills */}
        <div className="max-w-md mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                id={`filter-cat-${cat.id}`}
                onClick={() => onSelectCategory(cat.id)}
                className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 flex-shrink-0 ${
                  isSelected
                    ? 'bg-amber-400 text-stone-950 font-bold shadow-md shadow-amber-400/20'
                    : 'bg-stone-900/90 text-stone-400 hover:text-stone-200 hover:bg-stone-800 border border-stone-800'
                }`}
              >
                {cat.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* REEL CONTAINER: One full card per screen with vertical animated transition */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          {currentCard ? (
            <motion.div
              key={currentCard.id}
              custom={direction}
              variants={cardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-0 w-full h-full"
            >
              <WordCardView
                card={currentCard}
                isSaved={progress.savedWordIds.includes(currentCard.id)}
                isLearned={progress.learnedWordIds.includes(currentCard.id)}
                onToggleSave={onToggleSave}
                onToggleLearned={onToggleLearned}
                onNext={handleNext}
              />
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <p className="text-stone-300 font-medium">Fetching vocabulary definitions...</p>
            </div>
          )}
        </AnimatePresence>

        {/* Desktop Side Navigation Buttons (Up & Down Chevrons) */}
        <div className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 flex-col gap-3 z-30">
          <button
            id="btn-desktop-prev"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="p-3 rounded-full bg-stone-900/80 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700/80 backdrop-blur-md shadow-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="Previous Word (Up Arrow)"
          >
            <ChevronUp className="w-6 h-6" />
          </button>
          <button
            id="btn-desktop-next"
            onClick={handleNext}
            className="p-3 rounded-full bg-stone-900/80 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700/80 backdrop-blur-md shadow-lg transition-all"
            title="Next Word (Down Arrow)"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Floating toast message if fetch is in progress */}
      {(isLoadingNext || isFetchingRealtime) && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 px-4 py-1.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-950" />
          <span>⚡ Generating fresh real-time daily words & Tamil examples...</span>
        </div>
      )}

      {/* Card Index & Progress indicator dots */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900/70 backdrop-blur-md border border-stone-800 text-[11px] text-stone-400">
        <span>Word <strong>{currentIndex + 1}</strong> of {filteredCards.length}</span>
      </div>

      {/* Free Dictionary API Real-time Lookup Modal */}
      <DictionaryLookupModal
        isOpen={isDictionaryModalOpen}
        onClose={() => setIsDictionaryModalOpen(false)}
        onAddWordToFeed={(newCard, jumpToIt) => {
          onAddNewDynamicCard(newCard);
          if (jumpToIt) {
            setDirection(-1);
            setCurrentIndex(0);
          }
        }}
      />
    </div>
  );
};
