import React, { useState } from 'react';
import { 
  Flame, 
  Target, 
  Trophy, 
  CheckCircle2, 
  Bookmark, 
  Award, 
  BrainCircuit, 
  Sparkles, 
  RotateCcw,
  BarChart3,
  HelpCircle,
  Check,
  X
} from 'lucide-react';
import { UserProgress, WordCard } from '../types';

interface ProgressStatsViewProps {
  progress: UserProgress;
  allCards: WordCard[];
  onUpdateDailyGoal: (newGoal: number) => void;
  onResetProgress: () => void;
}

export const ProgressStatsView: React.FC<ProgressStatsViewProps> = ({
  progress,
  allCards,
  onUpdateDailyGoal,
  onResetProgress,
}) => {
  // Quiz State
  const [quizActive, setQuizActive] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);

  // Generate 5 random questions based on loaded cards
  const [quizQuestions, setQuizQuestions] = useState<Array<{
    word: string;
    correctTamil: string;
    options: string[];
  }>>([]);

  const startQuiz = () => {
    // Pick 5 random words from allCards
    const shuffled = [...allCards].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(5, shuffled.length));

    const questions = selected.map((card) => {
      // Pick 3 random distractors
      const otherMeanings = allCards
        .filter((c) => c.id !== card.id)
        .map((c) => c.tamilMeaning)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      const options = [card.tamilMeaning, ...otherMeanings].sort(() => 0.5 - Math.random());
      return {
        word: card.word,
        correctTamil: card.tamilMeaning,
        options,
      };
    });

    setQuizQuestions(questions);
    setQuizIndex(0);
    setQuizScore(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setQuizFinished(false);
    setQuizActive(true);
  };

  const handleSelectOption = (opt: string) => {
    if (isAnswerSubmitted) return;
    setSelectedOption(opt);
    setIsAnswerSubmitted(true);
    if (opt === quizQuestions[quizIndex].correctTamil) {
      setQuizScore((prev) => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (quizIndex + 1 < quizQuestions.length) {
      setQuizIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
    } else {
      setQuizFinished(true);
    }
  };

  // Category counts
  const categoryCounts: Record<string, number> = {};
  allCards.forEach((c) => {
    categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
  });

  const dailyGoalPercent = Math.min(100, Math.round((progress.todayLearnedCount / progress.dailyGoal) * 100));

  return (
    <div className="w-full h-full overflow-y-auto p-4 sm:p-6 max-w-2xl mx-auto pb-24 text-stone-100">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
          <BarChart3 className="w-6 h-6 text-amber-400" />
          <span>Learning Progress & Stats</span>
        </h2>
        <p className="text-xs text-stone-400 mt-0.5">
          உங்கள் தமிழ்-ஆங்கில சொல்லகராதி முன்னேற்றம் (Daily Streak & Vocabulary Analytics)
        </p>
      </div>

      {/* METRICS ROW: Streak, Learned, Bookmarked */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {/* Streak */}
        <div className="bg-gradient-to-br from-amber-500/15 via-stone-900 to-stone-900 p-4 rounded-2xl border border-amber-500/30 flex flex-col items-center text-center">
          <Flame className="w-7 h-7 text-orange-500 fill-orange-500 mb-1 animate-pulse" />
          <span className="text-2xl sm:text-3xl font-extrabold text-amber-400">
            {progress.streak}
          </span>
          <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider mt-0.5">
            Day Streak
          </span>
        </div>

        {/* Learned Words */}
        <div className="bg-gradient-to-br from-emerald-500/15 via-stone-900 to-stone-900 p-4 rounded-2xl border border-emerald-500/30 flex flex-col items-center text-center">
          <CheckCircle2 className="w-7 h-7 text-emerald-400 mb-1" />
          <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
            {progress.learnedWordIds.length}
          </span>
          <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider mt-0.5">
            Mastered
          </span>
        </div>

        {/* Bookmarked Words */}
        <div className="bg-gradient-to-br from-rose-500/15 via-stone-900 to-stone-900 p-4 rounded-2xl border border-rose-500/30 flex flex-col items-center text-center">
          <Bookmark className="w-7 h-7 text-rose-400 fill-rose-400 mb-1" />
          <span className="text-2xl sm:text-3xl font-extrabold text-rose-400">
            {progress.savedWordIds.length}
          </span>
          <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider mt-0.5">
            Saved
          </span>
        </div>
      </div>

      {/* TODAY'S GOAL PROGRESS CARD */}
      <div className="bg-stone-900/90 rounded-2xl p-5 border border-stone-800 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Daily Learning Goal</h3>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {dailyGoalPercent}% Achieved
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-stone-800 rounded-full overflow-hidden mb-3">
          <div 
            className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${dailyGoalPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-stone-400">
          <span>{progress.todayLearnedCount} words reviewed today</span>
          <span>Target: {progress.dailyGoal} words/day</span>
        </div>

        {/* Goal Selector Buttons */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-stone-800 text-xs">
          <span className="text-stone-400">Change Goal:</span>
          {[5, 10, 15, 20].map((num) => (
            <button
              key={num}
              onClick={() => onUpdateDailyGoal(num)}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                progress.dailyGoal === num
                  ? 'bg-amber-400 text-stone-950 shadow-sm'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* INTERACTIVE VOCABULARY RETENTION QUIZ */}
      <div className="bg-stone-900/90 rounded-2xl p-5 border border-stone-800 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-base font-bold text-white">Knowledge Check Quiz</h3>
              <p className="text-xs text-stone-400">5 quick questions on Tamil meanings</p>
            </div>
          </div>

          {!quizActive && (
            <button
              id="btn-start-quiz"
              onClick={startQuiz}
              className="px-4 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors shadow-md shadow-purple-600/30 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Start Quiz</span>
            </button>
          )}
        </div>

        {quizActive && !quizFinished && quizQuestions[quizIndex] && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs text-stone-400">
              <span>Question {quizIndex + 1} of {quizQuestions.length}</span>
              <span>Score: {quizScore} / {quizIndex}</span>
            </div>

            <div className="bg-stone-950 p-4 rounded-xl border border-stone-800 text-center">
              <span className="text-xs text-stone-400 uppercase tracking-wider block mb-1">What is the Tamil meaning of:</span>
              <h4 className="text-3xl font-extrabold text-white tracking-tight">{quizQuestions[quizIndex].word}</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {quizQuestions[quizIndex].options.map((option, idx) => {
                const isSelected = selectedOption === option;
                const isCorrect = option === quizQuestions[quizIndex].correctTamil;
                let btnStyle = 'bg-stone-800/80 hover:bg-stone-800 text-stone-200 border-stone-700/80';

                if (isAnswerSubmitted) {
                  if (isCorrect) {
                    btnStyle = 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30';
                  } else if (isSelected) {
                    btnStyle = 'bg-rose-600 text-white border-rose-500';
                  }
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(option)}
                    disabled={isAnswerSubmitted}
                    className={`p-3 rounded-xl border text-sm font-medium text-left transition-all flex items-center justify-between ${btnStyle}`}
                  >
                    <span>{option}</span>
                    {isAnswerSubmitted && isCorrect && <Check className="w-4 h-4 text-white" />}
                    {isAnswerSubmitted && isSelected && !isCorrect && <X className="w-4 h-4 text-white" />}
                  </button>
                );
              })}
            </div>

            {isAnswerSubmitted && (
              <div className="flex justify-end mt-2">
                <button
                  id="btn-quiz-next"
                  onClick={handleNextQuestion}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-colors"
                >
                  {quizIndex + 1 === quizQuestions.length ? 'See Results' : 'Next Question →'}
                </button>
              </div>
            )}
          </div>
        )}

        {quizFinished && (
          <div className="text-center py-6 flex flex-col items-center gap-3">
            <Trophy className="w-12 h-12 text-amber-400 animate-bounce" />
            <h4 className="text-xl font-bold text-white">Quiz Completed!</h4>
            <p className="text-sm text-stone-300">
              You scored <strong className="text-amber-400 text-lg">{quizScore}</strong> out of {quizQuestions.length}!
            </p>
            <p className="text-xs text-stone-400 max-w-xs">
              {quizScore === 5 ? '🎉 Perfect score! Your vocabulary retention is fantastic!' : 'Good effort! Continue scrolling to master more words.'}
            </p>
            <button
              onClick={startQuiz}
              className="mt-2 px-4 py-2 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Quiz</span>
            </button>
          </div>
        )}
      </div>

      {/* CATEGORY BREAKDOWN */}
      <div className="bg-stone-900/90 rounded-2xl p-5 border border-stone-800">
        <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
          <Award className="w-5 h-5 text-emerald-400" />
          <span>Active Vocabulary Categories</span>
        </h3>

        <div className="grid grid-cols-2 gap-2.5">
          {Object.entries(categoryCounts).map(([cat, count]) => (
            <div 
              key={cat}
              className="p-2.5 rounded-xl bg-stone-950/70 border border-stone-800/80 flex items-center justify-between text-xs"
            >
              <span className="font-medium text-stone-300 capitalize">{cat}</span>
              <span className="px-2 py-0.5 rounded-md bg-stone-800 font-mono text-amber-400 font-bold">
                {count} words
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
