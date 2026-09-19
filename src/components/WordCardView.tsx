import React, { useState, useRef, useCallback } from 'react';
import {
  Volume2,
  Bookmark,
  CheckCircle2,
  Share2,
  Sparkles,
  Languages,
  Check,
  Gauge,
  Heart,
} from 'lucide-react';
import { WordCard } from '../types';
import { speakEnglish, playAudioOrSpeak } from '../utils/speech';

interface WordCardViewProps {
  card: WordCard;
  isSaved: boolean;
  isLearned: boolean;
  onToggleSave: (wordId: string) => void;
  onToggleLearned: (wordId: string) => void;
}

/** Positions for the sparkle particles thrown out by the double-tap burst. */
const SPARKLES = [
  { dx: '-58px', dy: '-44px', delay: '0ms', size: 14 },
  { dx: '62px', dy: '-38px', delay: '40ms', size: 11 },
  { dx: '-46px', dy: '52px', delay: '80ms', size: 12 },
  { dx: '52px', dy: '46px', delay: '20ms', size: 15 },
  { dx: '0px', dy: '-72px', delay: '60ms', size: 10 },
  { dx: '-70px', dy: '6px', delay: '100ms', size: 10 },
  { dx: '72px', dy: '4px', delay: '30ms', size: 13 },
  { dx: '4px', dy: '70px', delay: '90ms', size: 11 },
];

/** Renders the 0-100 hardness score as a short, human label. */
function difficultyLabel(score?: number): { text: string; level: string } | null {
  if (typeof score !== 'number') return null;
  if (score >= 78) return { text: 'Expert', level: 'expert' };
  if (score >= 58) return { text: 'Advanced', level: 'advanced' };
  if (score >= 38) return { text: 'Intermediate', level: 'intermediate' };
  return { text: 'Building', level: 'building' };
}

export const WordCardView: React.FC<WordCardViewProps> = ({
  card,
  isSaved,
  isLearned,
  onToggleSave,
  onToggleLearned,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPlayingSentence, setIsPlayingSentence] = useState(false);
  const [copied, setCopied] = useState(false);
  const [burst, setBurst] = useState<{ id: number; label: string } | null>(null);

  const lastTapRef = useRef(0);
  const burstTimerRef = useRef<number | null>(null);

  /** Shows the Instagram-style heart burst overlay. */
  const triggerBurst = useCallback((label: string) => {
    setBurst({ id: Date.now(), label });
    if (burstTimerRef.current !== null) {
      window.clearTimeout(burstTimerRef.current);
    }
    burstTimerRef.current = window.setTimeout(() => setBurst(null), 900);
  }, []);

  const handlePlayWordAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlayingAudio(true);
    playAudioOrSpeak(card.word, card.audioUrl, () => setIsPlayingAudio(false));
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
        window.setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.warn('Clipboard write failed', err);
      }
    }
  };

  /**
   * Double-tapping the card saves the word and fires the heart burst, matching
   * the familiar "double tap to like" gesture. It is idempotent — tapping again
   * re-animates instead of un-saving.
   */
  const handleCardTap = useCallback(() => {
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current < 320;
    lastTapRef.current = isDoubleTap ? 0 : now;

    if (!isDoubleTap) return;
    if (!isSaved) onToggleSave(card.id);
    triggerBurst('Saved');
  }, [card.id, isSaved, onToggleSave, triggerBurst]);

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const willSave = !isSaved;
    onToggleSave(card.id);
    triggerBurst(willSave ? 'Saved' : 'Removed');
  };

  const handleLearnedClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const willLearn = !isLearned;
    onToggleLearned(card.id);
    triggerBurst(willLearn ? 'Learned' : 'Reviewing');
  };

  const highlightWordInSentence = (sentence: string, targetWord: string) => {
    if (!sentence) return '';
    const regex = new RegExp(`\\b(${targetWord}\\w*)\\b`, 'gi');
    const parts = sentence.split(regex);
    return (
      <>
        {parts.map((part, index) => {
          if (part.toLowerCase().startsWith(targetWord.toLowerCase().slice(0, 4))) {
            return (
              <span key={index} className="brand-gradient-text font-bold">
                {part}
              </span>
            );
          }
          return part;
        })}
      </>
    );
  };

  const difficulty = difficultyLabel(card.difficulty);

  return (
    <div className="relative w-full h-full max-w-lg mx-auto flex flex-col px-4 sm:px-6 pt-2 pb-16 select-none overflow-hidden">
      {/* Soft blue-pink wash behind the card */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(440px,100%)] h-[300px] rounded-full blur-3xl opacity-[0.18] -z-10 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(135deg, #3B82F6 0%, #EC4899 100%)' }}
      />

      {/* THE WORD CARD */}
      <div
        id={`word-card-${card.id}`}
        onClick={handleCardTap}
        className="gradient-ring gradient-glow relative flex-1 min-h-0 flex flex-col rounded-[20px] bg-white overflow-hidden"
      >
        {/* ---- Double-tap burst overlay (Instagram-style) ---- */}
        {burst && (
          <div
            key={burst.id}
            className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
          >
            <div className="relative flex items-center justify-center">
              <div
                className="animate-burst flex items-center justify-center w-24 h-24 rounded-full shadow-2xl"
                style={{ backgroundImage: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 45%, #EC4899 100%)' }}
              >
                <Heart className="w-11 h-11 text-white fill-white" strokeWidth={1.5} />
              </div>

              {SPARKLES.map((s, i) => (
                <span
                  key={i}
                  className="animate-sparkle absolute"
                  style={
                    {
                      '--dx': s.dx,
                      '--dy': s.dy,
                      animationDelay: s.delay,
                    } as React.CSSProperties
                  }
                >
                  <Sparkles
                    style={{ width: s.size, height: s.size }}
                    className="text-[#EC4899] fill-[#EC4899]"
                    strokeWidth={1.5}
                  />
                </span>
              ))}

              <span className="animate-burst absolute -bottom-12 whitespace-nowrap text-xs font-bold tracking-wide uppercase brand-gradient-text">
                {burst.label}
              </span>
            </div>
          </div>
        )}

        {/* ---- Card body scrolls internally if taller than the reel page ---- */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-5 sm:p-6 flex flex-col gap-4">
          {/* Header: category, part of speech, difficulty */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider brand-gradient-soft text-[#2563EB] border border-[#DCE7FF]">
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
              {card.category}
            </span>

            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#F8F7FF] text-[#6B7280] border border-[#ECE9F6] capitalize">
              {card.partOfSpeech}
            </span>

            {difficulty && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white"
                style={{ backgroundImage: 'linear-gradient(135deg, #3B82F6 0%, #EC4899 100%)' }}
                title={`Hardness score ${card.difficulty}/100`}
              >
                <Gauge className="w-3.5 h-3.5" strokeWidth={1.75} />
                {difficulty.text}
              </span>
            )}
          </div>

          {/* The English word */}
          <div className="mt-1">
            <div className="flex items-start gap-3">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#1A1A2E] leading-tight">
                {card.word}
              </h1>
              <button
                id={`btn-pronounce-${card.id}`}
                onClick={handlePlayWordAudio}
                title="Hear pronunciation"
                className={`mt-1 p-2.5 rounded-full transition-all duration-200 border ${
                  isPlayingAudio
                    ? 'brand-gradient text-white border-transparent scale-110'
                    : 'bg-[#FAFAFA] text-[#6B7280] border-[#ECE9F6] hover:text-[#2563EB]'
                }`}
              >
                <Volume2 className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            {card.phonetic && (
              <p className="mt-1 text-sm font-mono text-[#6B7280]">{card.phonetic}</p>
            )}

            {/* Tamil meaning — the visual pop */}
            <div className="mt-3 flex items-baseline gap-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#EC4899] bg-[#FFF0F7] px-2 py-0.5 rounded">
                பொருள்
              </span>
              <p className="text-2xl sm:text-[28px] font-bold text-[#EC4899] leading-snug">
                {card.tamilMeaning}
              </p>
            </div>
          </div>

          {/* Definition */}
          {card.englishDefinition && (
            <div className="border-l-2 border-[#ECE9F6] pl-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Meaning
              </span>
              <p className="text-[15px] text-[#4B5563] leading-relaxed mt-0.5">
                {card.englishDefinition}
              </p>
            </div>
          )}

          {/* Bilingual example */}
          <div className="rounded-[16px] bg-[#F8F7FF] border border-[#ECE9F6] p-4">
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                <Languages className="w-3.5 h-3.5" strokeWidth={1.75} />
                In context
              </span>
              <button
                id={`btn-sentence-audio-${card.id}`}
                onClick={handlePlaySentenceAudio}
                title="Listen to the sentence"
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-white text-[#6B7280] border border-[#ECE9F6] hover:text-[#2563EB] transition-colors"
              >
                <Volume2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                Listen
              </button>
            </div>

            <p className="text-[15px] text-[#6B7280] leading-relaxed">
              “{highlightWordInSentence(card.englishSentence, card.word)}”
            </p>

            {card.tamilSentence && (
              <>
                <div className="h-px w-full bg-[#ECE9F6] my-3" />
                <p className="text-sm text-[#6B7280] leading-relaxed">{card.tamilSentence}</p>
              </>
            )}
          </div>

          {/* Synonyms */}
          {card.synonyms && card.synonyms.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Similar
              </span>
              {card.synonyms.slice(0, 3).map((syn, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2.5 py-1 rounded-full bg-[#F8F7FF] text-[#4B5563] border border-[#ECE9F6]"
                >
                  {syn}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ---- Action bar ---- */}
        <div className="shrink-0 border-t border-[#ECE9F6] bg-white/95 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Save / Bookmark */}
            <button
              id={`btn-bookmark-${card.id}`}
              onClick={handleSaveClick}
              title={isSaved ? 'Remove bookmark' : 'Save word'}
              className={`p-2.5 rounded-full border transition-all duration-200 active:scale-90 ${
                isSaved
                  ? 'brand-gradient text-white border-transparent scale-105'
                  : 'bg-[#FAFAFA] text-[#6B7280] border-[#ECE9F6] hover:text-[#EC4899]'
              }`}
            >
              <Bookmark
                className="w-5 h-5"
                strokeWidth={1.75}
                fill={isSaved ? 'currentColor' : 'none'}
              />
            </button>

            {/* Learned */}
            <button
              id={`btn-learned-${card.id}`}
              onClick={handleLearnedClick}
              title={isLearned ? 'Mark as still reviewing' : 'Mark as learned'}
              className={`p-2.5 rounded-full border transition-all duration-200 active:scale-90 ${
                isLearned
                  ? 'brand-gradient text-white border-transparent scale-105'
                  : 'bg-[#FAFAFA] text-[#6B7280] border-[#ECE9F6] hover:text-[#2563EB]'
              }`}
            >
              <CheckCircle2
                className="w-5 h-5"
                strokeWidth={1.75}
                fill={isLearned ? 'currentColor' : 'none'}
              />
            </button>

            {/* Share / copy */}
            <button
              id={`btn-share-${card.id}`}
              onClick={handleShare}
              title="Share this word"
              className={`p-2.5 rounded-full border transition-all duration-200 active:scale-90 ${
                copied
                  ? 'brand-gradient text-white border-transparent'
                  : 'bg-[#FAFAFA] text-[#6B7280] border-[#ECE9F6] hover:text-[#2563EB]'
              }`}
            >
              {copied ? (
                <Check className="w-5 h-5" strokeWidth={1.75} />
              ) : (
                <Share2 className="w-5 h-5" strokeWidth={1.75} />
              )}
            </button>
          </div>

        </div>
      </div>

      <p className="shrink-0 text-center text-[11px] text-[#6B7280] pt-2">
        Scroll for the next word · double-tap the card to save
      </p>
    </div>
  );
};