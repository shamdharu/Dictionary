import React, { useState } from 'react';
import { 
  Bookmark, 
  Trash2, 
  Volume2, 
  Search, 
  BookOpen, 
  ExternalLink, 
  Sparkles, 
  ArrowRight,
  Layers,
  RotateCw
} from 'lucide-react';
import { WordCard } from '../types';
import { speakEnglish } from '../utils/speech';

interface SavedWordsViewProps {
  savedCards: WordCard[];
  onRemoveSave: (wordId: string) => void;
  onOpenInFeed: (card: WordCard) => void;
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

  // Filter saved words
  const filtered = savedCards.filter((card) => {
    const matchesCategory = selectedCategory === 'all' || card.category.toLowerCase() === selectedCategory.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = !query || 
      card.word.toLowerCase().includes(query) || 
      card.tamilMeaning.toLowerCase().includes(query) ||
      card.englishSentence.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  // Unique categories in saved
  const categories = ['all', ...Array.from(new Set(savedCards.map(c => c.category)))];

  const handleNextFlashcard = () => {
    setIsFlipped(false);
    setFlashcardIndex(prev => (prev + 1) % filtered.length);
  };

  return (
    <div className="w-full h-full overflow-y-auto p-4 sm:p-6 max-w-2xl mx-auto pb-24 text-stone-100">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Bookmark className="w-6 h-6 text-rose-400 fill-rose-400" />
            <span>Saved Words</span>
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            சேமிக்கப்பட்ட சொற்கள் ({savedCards.length} words bookmarked for revision)
          </p>
        </div>

        {savedCards.length > 0 && (
          <button
            id="btn-toggle-flashcards"
            onClick={() => {
              setIsFlashcardMode(!isFlashcardMode);
              setIsFlipped(false);
              setFlashcardIndex(0);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              isFlashcardMode 
                ? 'bg-amber-400 text-stone-950 border-amber-300 shadow-md' 
                : 'bg-stone-800 text-stone-200 border-stone-700 hover:bg-stone-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isFlashcardMode ? 'Show List' : 'Flashcard Mode'}</span>
          </button>
        )}
      </div>

      {savedCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-stone-900/60 rounded-2xl border border-stone-800 my-8">
          <Bookmark className="w-12 h-12 text-stone-600 mb-3" />
          <h3 className="text-lg font-semibold text-stone-200">No saved words yet</h3>
          <p className="text-sm text-stone-400 mt-1 max-w-xs">
            While scrolling through the vocabulary feed, tap the bookmark icon on any card to save it for revision.
          </p>
        </div>
      ) : isFlashcardMode ? (
        /* FLASHCARD REVIEW MODE */
        <div className="flex flex-col items-center gap-4 my-4">
          <div className="text-xs text-stone-400 font-medium">
            Card {flashcardIndex + 1} of {filtered.length} (Tap card to flip)
          </div>

          {filtered[flashcardIndex] && (
            <div
              id="flashcard-container"
              onClick={() => setIsFlipped(!isFlipped)}
              className="w-full max-w-sm h-80 rounded-3xl p-6 bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 border border-stone-700 shadow-2xl flex flex-col justify-between cursor-pointer transition-all duration-300 hover:border-amber-500/50"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="px-2.5 py-1 rounded-full bg-white/10 text-stone-300 font-medium uppercase tracking-wider">
                  {filtered[flashcardIndex].category}
                </span>
                <span className="text-stone-400 flex items-center gap-1">
                  <RotateCw className="w-3 h-3" />
                  Flip
                </span>
              </div>

              <div className="text-center my-auto flex flex-col items-center gap-3">
                {!isFlipped ? (
                  <>
                    <h3 className="text-4xl font-extrabold text-white tracking-tight">
                      {filtered[flashcardIndex].word}
                    </h3>
                    <span className="text-xs font-mono text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded">
                      {filtered[flashcardIndex].partOfSpeech}
                    </span>
                    <p className="text-xs text-stone-400 italic">Tap to reveal Tamil meaning & sentence</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-amber-300">
                      {filtered[flashcardIndex].tamilMeaning}
                    </p>
                    <p className="text-xs text-stone-300 px-3 py-2 bg-stone-800/80 rounded-xl border border-stone-700/60 leading-relaxed">
                      "{filtered[flashcardIndex].englishSentence}"
                    </p>
                    <p className="text-xs text-teal-300 leading-relaxed">
                      "{filtered[flashcardIndex].tamilSentence}"
                    </p>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-800">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    speakEnglish(filtered[flashcardIndex].word);
                  }}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
                  title="Pronounce"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextFlashcard();
                  }}
                  className="px-4 py-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow"
                >
                  <span>Next Card</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="flex flex-col gap-4">
          {/* Search bar and Category filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by English word or Tamil meaning..."
                className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-9 pr-4 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-400/80 transition-colors"
              />
            </div>
          </div>

          {/* Categories Pill Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-rose-500 text-white font-semibold shadow-sm'
                    : 'bg-stone-900 text-stone-400 hover:text-white border border-stone-800'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {/* Cards List */}
          <div className="grid grid-cols-1 gap-3">
            {filtered.map((card) => (
              <div
                key={card.id}
                id={`saved-card-${card.id}`}
                className="group relative bg-stone-900/80 hover:bg-stone-900 p-4 rounded-2xl border border-stone-800 hover:border-stone-700 transition-all duration-200 flex flex-col gap-2.5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xl font-bold text-white tracking-tight">
                        {card.word}
                      </h4>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        {card.partOfSpeech}
                      </span>
                      <button
                        onClick={() => speakEnglish(card.word)}
                        className="p-1 rounded-full text-stone-400 hover:text-amber-400 hover:bg-stone-800 transition-colors"
                        title="Listen"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-base font-semibold text-amber-300 mt-1">
                      {card.tamilMeaning}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onOpenInFeed(card)}
                      className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors"
                      title="Open in Feed"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onRemoveSave(card.id)}
                      className="p-2 rounded-lg bg-stone-800/80 hover:bg-rose-950/60 text-stone-400 hover:text-rose-400 transition-colors"
                      title="Remove Bookmark"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Example sentence bilingual snippet */}
                <div className="bg-stone-950/60 p-3 rounded-xl border border-stone-800/80 text-xs flex flex-col gap-1">
                  <p className="text-stone-200 font-medium">"{card.englishSentence}"</p>
                  <p className="text-teal-400 font-normal">"{card.tamilSentence}"</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
