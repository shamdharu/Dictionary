import React, { useState } from 'react';
import {
  Bookmark,
  Trash2,
  Volume2,
  Search,
  ExternalLink,
  Layers,
  RotateCw,
  ArrowRight,
} from 'lucide-react';
import { WordCard } from '../types';
import { getCategoryLabel } from '../constants';
import { speakEnglish } from '../utils/speech';

interface SavedWordsViewProps {
  savedCards: WordCard[];
  onRemoveSave: (wordId: string) => void;
  onOpenInFeed: () => void;
}

export const SavedWordsView: React.FC<SavedWordsViewProps> = ({
  savedCards,
  onRemoveSave,
  onOpenInFeed,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isFlashcardMode, setIsFlashcardMode] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const filtered = savedCards.filter((card) => {
    const matchesCategory =
      selectedCategory === 'all' || card.category.toLowerCase() === selectedCategory.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !query ||
      card.word.toLowerCase().includes(query) ||
      card.tamilMeaning.toLowerCase().includes(query) ||
      card.englishSentence.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  const categories = ['all', ...Array.from(new Set(savedCards.map((c) => c.category)))];

  const nextFlashcard = () => {
    if (filtered.length === 0) return;
    setIsFlipped(false);
    setFlashcardIndex((prev) => (prev + 1) % filtered.length);
  };

  const activeFlashcard = filtered.length > 0 ? filtered[flashcardIndex % filtered.length] : null;

  return (
    <div className="w-full h-full overflow-y-auto no-scrollbar p-4 sm:p-6 max-w-2xl mx-auto pb-28 text-[#1A1A2E]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-extrabold flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full brand-gradient text-white">
              <Bookmark className="w-4 h-4" strokeWidth={1.75} fill="currentColor" />
            </span>
            <span className="brand-gradient-text">Saved Words</span>
          </h2>
          <p className="text-xs text-[#6B7280] mt-1">
            சேமிக்கப்பட்ட சொற்கள் · {savedCards.length} word{savedCards.length === 1 ? '' : 's'}
          </p>
        </div>

        {savedCards.length > 0 && (
          <button
            id="btn-toggle-flashcards"
            onClick={() => {
              setIsFlashcardMode((prev) => !prev);
              setIsFlipped(false);
              setFlashcardIndex(0);
            }}
            className={`px-3.5 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
              isFlashcardMode
                ? 'brand-gradient text-white shadow-md shadow-[#EC4899]/25'
                : 'bg-white text-[#6B7280] border border-[#ECE9F6]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>{isFlashcardMode ? 'List' : 'Flashcards'}</span>
          </button>
        )}
      </div>

      {savedCards.length === 0 ? (
        /* ---- Empty state ---- */
        <div className="flex flex-col items-center justify-center p-10 text-center bg-white rounded-[20px] border border-[#ECE9F6] my-8">
          <div className="w-16 h-16 rounded-full brand-gradient-soft flex items-center justify-center mb-4">
            <Bookmark className="w-7 h-7 text-[#EC4899]" strokeWidth={1.75} />
          </div>
          <h3 className="text-lg font-bold">No saved words yet</h3>
          <p className="text-sm text-[#6B7280] mt-1 max-w-xs">
            While scrolling the feed, tap the bookmark icon or double-tap a card to save it here for
            revision.
          </p>
          <button
            onClick={onOpenInFeed}
            className="mt-5 brand-gradient px-5 py-2.5 rounded-full text-white text-sm font-semibold flex items-center gap-1.5 shadow-lg shadow-[#EC4899]/25 active:scale-95 transition-transform"
          >
            <span>Go to feed</span>
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      ) : (
        <>
          {/* ---- Flashcard mode ---- */}
          {isFlashcardMode ? (
            activeFlashcard ? (
              <div className="flex flex-col items-center">
                <div
                  onClick={() => setIsFlipped((prev) => !prev)}
                  className="w-full aspect-[3/4] max-w-sm rounded-[24px] bg-white border border-[#ECE9F6] shadow-lg shadow-[#EC4899]/10 flex flex-col items-center justify-center p-6 text-center cursor-pointer select-none relative overflow-hidden"
                >
                  <div className="absolute top-3 right-3 text-[10px] font-semibold text-[#6B7280] bg-[#F8F7FF] px-2 py-1 rounded-full">
                    {flashcardIndex + 1} / {filtered.length}
                  </div>

                  {!isFlipped ? (
                    <>
                      <span className="text-xs font-semibold text-[#EC4899] uppercase tracking-wide mb-2">
                        {getCategoryLabel(activeFlashcard.category)}
                      </span>
                      <h3 className="text-3xl font-extrabold text-[#1A1A2E]">
                        {activeFlashcard.word}
                      </h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          speakEnglish(activeFlashcard.word);
                        }}
                        className="mt-4 w-10 h-10 rounded-full brand-gradient-soft flex items-center justify-center active:scale-95 transition-transform"
                      >
                        <Volume2 className="w-5 h-5 text-[#EC4899]" strokeWidth={1.75} />
                      </button>
                      <p className="text-xs text-[#6B7280] mt-6">Tap card to reveal meaning</p>
                    </>
                  ) : (
                    <>
                      <h4 className="text-2xl font-extrabold brand-gradient-text">
                        {activeFlashcard.tamilMeaning}
                      </h4>
                      <div className="w-10 h-px bg-[#ECE9F6] my-4" />
                      <p className="text-sm text-[#1A1A2E] font-medium">
                        {activeFlashcard.englishSentence}
                      </p>
                      <p className="text-sm text-[#6B7280] mt-2">
                        {activeFlashcard.tamilSentence}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-6">
                  <button
                    onClick={() => {
                      setIsFlipped(false);
                      setFlashcardIndex((prev) =>
                        prev === 0 ? filtered.length - 1 : prev - 1
                      );
                    }}
                    className="px-4 py-2 rounded-full bg-white border border-[#ECE9F6] text-xs font-semibold text-[#6B7280] active:scale-95 transition-transform"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setIsFlipped((prev) => !prev)}
                    className="w-10 h-10 rounded-full bg-white border border-[#ECE9F6] flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <RotateCw className="w-4 h-4 text-[#6B7280]" strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={nextFlashcard}
                    className="px-4 py-2 rounded-full brand-gradient text-xs font-semibold text-white shadow-md shadow-[#EC4899]/25 active:scale-95 transition-transform"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-[#6B7280] mt-8">
                No words match your filters.
              </p>
            )
          ) : (
            <>
              {/* ---- Search bar ---- */}
              <div className="flex items-center gap-2 bg-white rounded-full border border-[#ECE9F6] px-4 py-2.5 mb-3">
                <Search className="w-4 h-4 text-[#6B7280]" strokeWidth={1.75} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search saved words..."
                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-[#B7B4C7]"
                />
              </div>

              {/* ---- Category filter chips ---- */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                      selectedCategory === cat
                        ? 'brand-gradient text-white shadow-sm shadow-[#EC4899]/25'
                        : 'bg-white text-[#6B7280] border border-[#ECE9F6]'
                    }`}
                  >
                    {cat === 'all' ? 'All' : getCategoryLabel(cat)}
                  </button>
                ))}
              </div>

              {/* ---- Word list ---- */}
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-[#6B7280] mt-8">
                  No words match your search.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {filtered.map((card) => (
                    <div
                      key={card.id}
                      className="bg-white rounded-[18px] border border-[#ECE9F6] p-4 flex items-start justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-[#1A1A2E]">{card.word}</h4>
                          <button
                            onClick={() => speakEnglish(card.word)}
                            className="w-6 h-6 rounded-full brand-gradient-soft flex items-center justify-center active:scale-95 transition-transform"
                          >
                            <Volume2 className="w-3.5 h-3.5 text-[#EC4899]" strokeWidth={1.75} />
                          </button>
                        </div>
                        <p className="text-sm font-semibold brand-gradient-text mt-0.5">
                          {card.tamilMeaning}
                        </p>
                        <p className="text-xs text-[#6B7280] mt-1.5 line-clamp-2">
                          {card.englishSentence}
                        </p>
                        <span className="inline-block mt-2 text-[10px] font-semibold text-[#6B7280] bg-[#F8F7FF] px-2 py-0.5 rounded-full">
                          {getCategoryLabel(card.category)}
                        </span>
                      </div>

                      <button
                        onClick={() => onRemoveSave(card.id)}
                        className="w-8 h-8 flex-shrink-0 rounded-full bg-[#F8F7FF] flex items-center justify-center active:scale-95 transition-transform"
                      >
                        <Trash2 className="w-4 h-4 text-[#6B7280]" strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={onOpenInFeed}
                className="w-full mt-5 py-2.5 rounded-full border border-[#ECE9F6] text-xs font-semibold text-[#6B7280] flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Back to feed</span>
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
};