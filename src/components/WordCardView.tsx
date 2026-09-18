import React, { useState } from 'react';
import { 
  Volume2, 
  Bookmark, 
  CheckCircle2, 
  Share2, 
  Sparkles, 
  BookOpen, 
  ArrowDown, 
  Check, 
  Languages,
  Layers,
  Zap
} from 'lucide-react';
import { WordCard } from '../types';
import { speakEnglish } from '../utils/speech';

interface WordCardViewProps {
  card: WordCard;
  isSaved: boolean;
  isLearned: boolean;
  onToggleSave: (wordId: string) => void;
  onToggleLearned: (wordId: string) => void;
  onNext?: () => void;
}

export const WordCardView: React.FC<WordCardViewProps> = ({
  card,
  isSaved,
  isLearned,
  onToggleSave,
  onToggleLearned,
  onNext,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPlayingSentence, setIsPlayingSentence] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSynonyms, setShowSynonyms] = useState(false);

  const handlePlayWordAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlayingAudio(true);
    speakEnglish(card.word, () => setIsPlayingAudio(false));
  };

  const handlePlaySentenceAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlayingSentence(true);
    speakEnglish(card.englishSentence, () => setIsPlayingSentence(false));
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareText = `📚 English Word: ${card.word} (${card.partOfSpeech})
✨ பொருள் (Tamil): ${card.tamilMeaning}
📖 Example: "${card.englishSentence}"
🇮🇳 தமிழ்: "${card.tamilSentence}"
Learned via Tamil-English Vocabulary Scroll!`;

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.warn('Clipboard write failed', err);
      }
    }
  };

  // Helper to highlight the target word inside the example sentence
  const highlightWordInSentence = (sentence: string, targetWord: string) => {
    if (!sentence) return '';
    const regex = new RegExp(`\\b(${targetWord}\\w*)\\b`, 'gi');
    const parts = sentence.split(regex);
    return (
      <>
        {parts.map((part, index) => {
          if (part.toLowerCase().startsWith(targetWord.toLowerCase().slice(0, 4))) {
            return (
              <span key={index} className="text-amber-300 font-bold underline decoration-amber-400/60 decoration-2 underline-offset-4">
                {part}
              </span>
            );
          }
          return part;
        })}
      </>
    );
  };

  return (
    <div 
      id={`word-card-${card.id}`}
      className="relative w-full h-full max-w-lg mx-auto flex flex-col justify-between p-5 sm:p-7 select-none overflow-hidden"
    >
      {/* Dynamic atmospheric background glow */}
      <div className="absolute inset-0 bg-radial from-amber-500/10 via-stone-900/50 to-stone-950 -z-10 pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-rose-500/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* TOP HEADER: Category Pill & Badges */}
      <div className="flex items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-white/10 text-stone-200 border border-white/15 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {card.category}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {card.partOfSpeech}
          </span>
          {card.source === 'gemini-realtime' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm animate-pulse">
              <Zap className="w-3 h-3 text-purple-400 fill-purple-400" />
              <span>Real-time AI</span>
            </span>
          )}
        </div>

        {card.phonetic && (
          <span className="text-xs tracking-wide text-stone-400 font-mono bg-stone-800/60 px-2.5 py-1 rounded-md border border-stone-700/50">
            {card.phonetic}
          </span>
        )}
      </div>

      {/* MAIN CENTER CONTENT: Word, Tamil Meaning, Definition, Bilingual Context */}
      <div className="my-auto py-4 flex flex-col gap-4">
        {/* Main English Word and Quick Audio */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white drop-shadow-sm font-sans">
              {card.word}
            </h1>
            <button
              id={`btn-pronounce-${card.id}`}
              onClick={handlePlayWordAudio}
              title="Pronounce English Word"
              className={`p-3 rounded-full transition-all duration-200 border ${
                isPlayingAudio 
                  ? 'bg-amber-500 text-stone-950 scale-110 shadow-lg shadow-amber-500/30 border-amber-400' 
                  : 'bg-white/10 text-stone-200 hover:bg-white/20 hover:text-white border-white/15'
              }`}
            >
              <Volume2 className={`w-5 h-5 ${isPlayingAudio ? 'animate-pulse' : ''}`} />
            </button>
          </div>

          {/* Tamil Meaning (பொருள்) in prominent, elegant typography */}
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/90 font-mono bg-amber-400/10 px-2 py-0.5 rounded">
              பொருள்
            </span>
            <p className="text-2xl sm:text-3xl font-bold text-amber-300 drop-shadow leading-snug">
              {card.tamilMeaning}
            </p>
          </div>
        </div>

        {/* English Definition */}
        {card.englishDefinition && (
          <div className="bg-stone-900/60 backdrop-blur-sm p-3.5 rounded-xl border border-stone-800 text-stone-300 text-sm leading-relaxed">
            <p className="text-stone-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-stone-400" />
              English Meaning
            </p>
            <p>{card.englishDefinition}</p>
          </div>
        )}

        {/* Dual-language Example Sentence Card */}
        <div className="relative rounded-2xl bg-gradient-to-b from-stone-900/90 to-stone-900/60 backdrop-blur-md p-4 sm:p-5 border border-stone-700/60 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              <Languages className="w-4 h-4 text-emerald-400" />
              Example in Context
            </div>
            <button
              id={`btn-sentence-audio-${card.id}`}
              onClick={handlePlaySentenceAudio}
              title="Listen to full sentence"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 transition-colors"
            >
              <Volume2 className={`w-3.5 h-3.5 ${isPlayingSentence ? 'text-amber-400 animate-pulse' : ''}`} />
              <span>Listen</span>
            </button>
          </div>

          {/* English Context Sentence */}
          <p className="text-base sm:text-lg text-stone-100 font-medium leading-relaxed mb-3">
            "{highlightWordInSentence(card.englishSentence, card.word)}"
          </p>

          {/* Divider */}
          <div className="h-px w-full bg-stone-800 my-2.5" />

          {/* Tamil Context Sentence */}
          <div>
            <span className="text-xs font-semibold text-teal-400/90 tracking-wide font-mono block mb-1">
              தமிழ் வடிவம் (Tamil Translation):
            </span>
            <p className="text-stone-200 text-sm sm:text-base font-normal leading-relaxed">
              "{card.tamilSentence}"
            </p>
          </div>
        </div>

        {/* Synonyms preview if available */}
        {card.synonyms && card.synonyms.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs text-stone-400">
            <span className="font-semibold text-stone-500 uppercase tracking-wider">Similar Words:</span>
            {card.synonyms.map((syn, idx) => (
              <span key={idx} className="bg-stone-800/80 px-2 py-0.5 rounded text-stone-300 border border-stone-700/50">
                {syn}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT SIDE FLOATING ACTION BAR (TikTok / Reels Style) */}
      <div className="absolute right-4 bottom-24 flex flex-col items-center gap-4 z-20">
        {/* Bookmark / Save */}
        <button
          id={`btn-bookmark-${card.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave(card.id);
          }}
          className="group flex flex-col items-center gap-1"
          title={isSaved ? 'Remove Bookmark' : 'Save / Bookmark Word'}
        >
          <div className={`p-3 rounded-full transition-all duration-200 border backdrop-blur-md ${
            isSaved
              ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/40 scale-110'
              : 'bg-stone-900/80 text-stone-300 hover:text-white hover:bg-stone-800 border-stone-700/70'
          }`}>
            <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
          </div>
          <span className="text-[11px] font-medium text-stone-300 drop-shadow">
            {isSaved ? 'Saved' : 'Save'}
          </span>
        </button>

        {/* Mark as Learned */}
        <button
          id={`btn-learned-${card.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLearned(card.id);
          }}
          className="group flex flex-col items-center gap-1"
          title={isLearned ? 'Mark as reviewing' : 'Mark as learned'}
        >
          <div className={`p-3 rounded-full transition-all duration-200 border backdrop-blur-md ${
            isLearned
              ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/40 scale-110'
              : 'bg-stone-900/80 text-stone-300 hover:text-white hover:bg-stone-800 border-stone-700/70'
          }`}>
            <CheckCircle2 className={`w-5 h-5 ${isLearned ? 'fill-emerald-950' : ''}`} />
          </div>
          <span className="text-[11px] font-medium text-stone-300 drop-shadow">
            {isLearned ? 'Learned' : 'Done'}
          </span>
        </button>

        {/* Share / Copy */}
        <button
          id={`btn-share-${card.id}`}
          onClick={handleShare}
          className="group flex flex-col items-center gap-1"
          title="Share or Copy Word"
        >
          <div className={`p-3 rounded-full transition-all duration-200 border backdrop-blur-md ${
            copied
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-stone-900/80 text-stone-300 hover:text-white hover:bg-stone-800 border-stone-700/70'
          }`}>
            {copied ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
          </div>
          <span className="text-[11px] font-medium text-stone-300 drop-shadow">
            {copied ? 'Copied!' : 'Share'}
          </span>
        </button>
      </div>

      {/* BOTTOM FOOTER: Gesture cue / Next button */}
      <div className="pt-2 flex items-center justify-between text-xs text-stone-400">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Swipe up or click below for next word</span>
        </div>

        {onNext && (
          <button
            id={`btn-next-inline-${card.id}`}
            onClick={onNext}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors font-medium text-xs"
          >
            <span>Next (அடுத்த சொல்)</span>
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
