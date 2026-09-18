import React, { useState } from 'react';
import { 
  Search, 
  X, 
  Volume2, 
  Sparkles, 
  BookOpen, 
  ArrowRight, 
  Check, 
  Loader2, 
  Languages, 
  ExternalLink 
} from 'lucide-react';
import { WordCard } from '../types';
import { lookupDictionaryWord } from '../utils/dictionaryApi';
import { playAudioOrSpeak } from '../utils/speech';

interface DictionaryLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWordToFeed: (card: WordCard, jumpToIt?: boolean) => void;
}

const POPULAR_SUGGESTIONS = [
  'apocalyptic',
  'serendipity',
  'resilience',
  'eloquent',
  'wanderlust',
  'compassion',
  'ephemeral',
  'procrastinate',
];

export const DictionaryLookupModal: React.FC<DictionaryLookupModalProps> = ({
  isOpen,
  onClose,
  onAddWordToFeed,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultCard, setResultCard] = useState<WordCard | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [added, setAdded] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (termToSearch?: string) => {
    const term = (termToSearch || searchTerm).trim();
    if (!term) return;

    setIsLoading(true);
    setError(null);
    setResultCard(null);
    setAdded(false);

    try {
      const card = await lookupDictionaryWord(term);
      if (card) {
        setResultCard(card);
      } else {
        setError(`"${term}" was not found in Free Dictionary API or could not be loaded. Try another common English word.`);
      }
    } catch (err: any) {
      setError(err.message || 'Lookup failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!resultCard) return;
    setIsPlayingAudio(true);
    playAudioOrSpeak(resultCard.word, resultCard.audioUrl, () => setIsPlayingAudio(false));
  };

  const handleAddAndClose = (jump: boolean = true) => {
    if (!resultCard) return;
    onAddWordToFeed(resultCard, jump);
    setAdded(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div 
        id="dictionary-lookup-dialog"
        className="w-full max-w-lg bg-stone-900 border border-stone-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 bg-stone-950/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Free Dictionary API Lookup</h2>
              <p className="text-[11px] text-stone-400">api.dictionaryapi.dev + Tamil Translation</p>
            </div>
          </div>
          <button
            id="btn-close-dictionary-modal"
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input and Suggestions */}
        <div className="p-5 border-b border-stone-800 flex flex-col gap-3">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="relative flex items-center"
          >
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 pointer-events-none" />
            <input
              id="input-dictionary-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type any English word (e.g. apocalyptic)..."
              autoFocus
              className="w-full bg-stone-950 border border-stone-700 focus:border-amber-400 rounded-xl pl-10 pr-24 py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all"
            />
            <button
              id="btn-submit-dictionary-search"
              type="submit"
              disabled={isLoading || !searchTerm.trim()}
              className="absolute right-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
            </button>
          </form>

          {/* Quick Word Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Try:</span>
            {POPULAR_SUGGESTIONS.map((word) => (
              <button
                key={word}
                type="button"
                onClick={() => {
                  setSearchTerm(word);
                  handleSearch(word);
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-amber-300 border border-stone-700/60 transition-colors"
              >
                {word}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area: Result or Loader or Error */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-stone-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-stone-200">Querying Free Dictionary API...</p>
                <p className="text-xs text-stone-500 mt-0.5">Fetching definitions, phonetics, audio, and Tamil translations</p>
              </div>
            </div>
          )}

          {error && !isLoading && (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs text-center">
              {error}
            </div>
          )}

          {resultCard && !isLoading && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              {/* Word Title and Badges */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                      {resultCard.word}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {resultCard.partOfSpeech}
                    </span>
                    {resultCard.phonetic && (
                      <span className="font-mono text-xs text-stone-400 bg-stone-800 px-2 py-0.5 rounded border border-stone-700">
                        {resultCard.phonetic}
                      </span>
                    )}
                  </div>

                  {/* Tamil Meaning */}
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-[11px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                      பொருள்
                    </span>
                    <p className="text-lg sm:text-xl font-bold text-amber-300">
                      {resultCard.tamilMeaning}
                    </p>
                  </div>
                </div>

                {/* Pronunciation Audio Button */}
                <button
                  id="btn-play-lookup-audio"
                  onClick={handlePlayAudio}
                  title="Play pronunciation"
                  className={`p-3 rounded-full border transition-all ${
                    isPlayingAudio
                      ? 'bg-amber-500 text-stone-950 scale-105 border-amber-400 shadow-md shadow-amber-500/30'
                      : 'bg-stone-800 text-stone-200 hover:bg-stone-700 hover:text-white border-stone-700'
                  }`}
                >
                  <Volume2 className={`w-5 h-5 ${isPlayingAudio ? 'animate-pulse' : ''}`} />
                </button>
              </div>

              {/* English Definition */}
              {resultCard.englishDefinition && (
                <div className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-800 text-stone-300 text-xs sm:text-sm leading-relaxed">
                  <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-stone-500" />
                    Dictionary Definition
                  </div>
                  <p>{resultCard.englishDefinition}</p>
                </div>
              )}

              {/* Example with Tamil Translation */}
              <div className="p-3.5 rounded-xl bg-stone-950/80 border border-emerald-900/40 text-xs sm:text-sm space-y-2">
                <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-emerald-400" />
                  Example in Context
                </div>
                <p className="text-stone-200 italic">"{resultCard.englishSentence}"</p>
                {resultCard.tamilSentence && (
                  <p className="text-emerald-300 text-xs border-t border-stone-800 pt-1.5">
                    தமிழ்: "{resultCard.tamilSentence}"
                  </p>
                )}
              </div>

              {/* Synonyms & Antonyms */}
              {((resultCard.synonyms && resultCard.synonyms.length > 0) || 
                (resultCard.antonyms && resultCard.antonyms.length > 0)) && (
                <div className="flex flex-col gap-2 pt-1">
                  {resultCard.synonyms && resultCard.synonyms.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                      <span className="text-stone-500 font-semibold text-[10px] uppercase">Synonyms:</span>
                      {resultCard.synonyms.map((s, idx) => (
                        <span key={idx} className="bg-stone-800 px-2 py-0.5 rounded text-stone-300 border border-stone-700/50">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {resultCard.antonyms && resultCard.antonyms.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                      <span className="text-rose-400/80 font-semibold text-[10px] uppercase">Antonyms:</span>
                      {resultCard.antonyms.map((a, idx) => (
                        <span key={idx} className="bg-rose-950/40 px-2 py-0.5 rounded text-rose-300 border border-rose-800/40">
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* API Attribution link */}
              <div className="text-[11px] text-stone-500 flex items-center justify-between pt-1">
                <span>Source: Free Dictionary API (api.dictionaryapi.dev)</span>
                {resultCard.audioUrl && (
                  <span className="text-emerald-400 font-medium">✓ Native audio included</span>
                )}
              </div>
            </div>
          )}

          {!resultCard && !isLoading && !error && (
            <div className="py-10 text-center text-stone-500 text-xs space-y-1">
              <p>Type any word above or pick a sample word to query the Free Dictionary API.</p>
              <p className="text-stone-600">Definitions, phonetics, audio, and Tamil translations will appear here instantly.</p>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        {resultCard && (
          <div className="p-4 border-t border-stone-800 bg-stone-950 flex items-center justify-end gap-2">
            <button
              id="btn-add-word-to-feed"
              onClick={() => handleAddAndClose(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20"
            >
              {added ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Added!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Add to Vocabulary Feed</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
