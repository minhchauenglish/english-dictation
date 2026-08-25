import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { DictationExercise, SentenceSubmissionResult, WordDiffItem } from '../types';
import { audioPlayer } from '../utils/audioPlayer';
import { compareSentenceAnswers } from '../utils/textComparison';

interface StudentPracticeViewProps {
  exercise: DictationExercise;
  studentName: string;
  onFinishAll: (results: SentenceSubmissionResult[]) => void;
  onExit: () => void;
}

export const StudentPracticeView: React.FC<StudentPracticeViewProps> = ({
  exercise,
  studentName,
  onFinishAll,
  onExit,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [typedAnswer, setTypedAnswer] = useState<string>('');
  const [replaysUsed, setReplaysUsed] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isChecked, setIsChecked] = useState<boolean>(false);
  const [currentCheckResult, setCurrentCheckResult] = useState<{
    isCorrect: boolean;
    sentenceAccuracy: number;
    wordDiffs: WordDiffItem[];
    wrongWords: string[];
  } | null>(null);

  const [collectedResults, setCollectedResults] = useState<SentenceSubmissionResult[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  const currentSentence = exercise.sentences[currentIndex];
  const totalSentences = exercise.sentences.length;
  const listenLimit = exercise.listenLimit ?? 3; // 0 = unlimited, 1, 2, 3
  const isLimitReached = listenLimit > 0 && replaysUsed >= listenLimit;

  // Auto-play audio when a new sentence loads
  useEffect(() => {
    setTypedAnswer('');
    setIsChecked(false);
    setCurrentCheckResult(null);
    setReplaysUsed(0);

    // Give a short delay then play speech
    const timer = setTimeout(() => {
      handlePlayAudio();
    }, 400);

    return () => {
      clearTimeout(timer);
      audioPlayer.stop();
    };
  }, [currentIndex]);

  // Focus input when moving to a new sentence
  useEffect(() => {
    if (!isChecked && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex, isChecked]);

  const handlePlayAudio = () => {
    if (!currentSentence || (listenLimit > 0 && replaysUsed >= listenLimit)) {
      return;
    }

    setIsPlaying(true);
    setReplaysUsed((prev) => prev + 1);

    audioPlayer.play({
      text: currentSentence.text,
      accent: exercise.voiceAccent,
      speed: exercise.playbackSpeed,
      onStart: () => setIsPlaying(true),
      onEnd: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  };

  const handleCheckAnswer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isChecked || !currentSentence) return;

    // Check sentence locally
    const diff = compareSentenceAnswers(
      currentSentence.text,
      typedAnswer,
      exercise.checkMode
    );

    setCurrentCheckResult(diff);
    setIsChecked(true);

    const submissionItem: SentenceSubmissionResult = {
      sentenceOrder: currentIndex + 1,
      targetSentence: currentSentence.text,
      studentAnswer: typedAnswer.trim(),
      isCorrect: diff.isCorrect,
      sentenceAccuracy: diff.sentenceAccuracy,
      wordDiffs: diff.wordDiffs,
      replaysUsed,
    };

    setCollectedResults((prev) => [...prev, submissionItem]);
  };

  const handleNext = () => {
    if (currentIndex + 1 < totalSentences) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Completed all sentences
      onFinishAll(collectedResults);
    }
  };

  // Render Word-Level Visual Diff for Student's Answer
  const renderStudentDiffBadge = (diff: WordDiffItem, index: number) => {
    if (diff.type === 'correct') {
      return (
        <span
          key={index}
          className="inline-block px-2.5 py-1 m-1 rounded-lg font-bold text-emerald-800 bg-emerald-100 border border-emerald-300"
        >
          ✓ {diff.studentWord || diff.correctWord}
        </span>
      );
    }

    if (diff.type === 'incorrect') {
      return (
        <span
          key={index}
          className="inline-block px-2.5 py-1 m-1 rounded-lg font-bold text-rose-800 bg-rose-100 border border-rose-300 line-through decoration-2"
          title={diff.explanation}
        >
          ✕ {diff.studentWord}
        </span>
      );
    }

    if (diff.type === 'extra') {
      return (
        <span
          key={index}
          className="inline-block px-2.5 py-1 m-1 rounded-lg font-bold text-amber-800 bg-amber-100 border border-amber-300"
          title="Từ thừa"
        >
          − {diff.studentWord}
        </span>
      );
    }

    if (diff.type === 'missing') {
      return (
        <span
          key={index}
          className="inline-block px-2.5 py-1 m-1 rounded-lg font-bold text-rose-700 bg-rose-50 border border-dashed border-rose-400"
          title={`Thiếu: ${diff.correctWord}`}
        >
          [thiếu: {diff.correctWord}]
        </span>
      );
    }

    return null;
  };

  const progressPercent = Math.round(((currentIndex + 1) / totalSentences) * 100);

  return (
    <div id="student-practice-view" className="min-h-screen bg-slate-100 text-slate-800 flex flex-col justify-between p-3 sm:p-5">
      {/* Top Header & Progress */}
      <header className="w-full max-w-2xl mx-auto space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-slate-900 text-base sm:text-lg truncate max-w-[200px] sm:max-w-md">
              {exercise.title}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Học sinh: <span className="font-bold text-slate-700">{studentName}</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-sm sm:text-base font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
              Câu {currentIndex + 1} / {totalSentences}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-indigo-600 h-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Center Interactive Practice Area */}
      <main className="w-full max-w-2xl mx-auto my-auto py-4 space-y-5">
        {/* Audio Listen Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 text-center space-y-4">
          {/* Big Audio Button */}
          <button
            id="btn-play-audio"
            onClick={handlePlayAudio}
            disabled={isLimitReached && !isPlaying}
            className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full mx-auto flex flex-col items-center justify-center space-y-1 transition-all shadow-md active:scale-95 cursor-pointer ${
              isPlaying
                ? 'bg-amber-500 text-white ring-8 ring-amber-100 animate-pulse'
                : isLimitReached
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white ring-8 ring-indigo-50 hover:ring-indigo-100'
            }`}
          >
            <Volume2 className={`w-10 h-10 sm:w-12 sm:h-12 ${isPlaying ? 'animate-bounce' : ''}`} />
            <span className="font-extrabold text-sm sm:text-base uppercase tracking-wider">
              {isPlaying ? 'Đang đọc' : 'NGHE'}
            </span>
          </button>

          {/* Listen Limit Counter */}
          <p id="listen-limit-counter" className="text-xs sm:text-sm font-semibold text-slate-500">
            {listenLimit === 0 ? (
              <span className="text-emerald-600">Lượt nghe: {replaysUsed} (Không giới hạn)</span>
            ) : (
              <span>
                Lượt nghe: <span className="font-bold text-slate-800">{replaysUsed}</span> / {listenLimit}
                {isLimitReached && <span className="text-rose-600 font-bold ml-1.5">(Đã hết lượt nghe)</span>}
              </span>
            )}
          </p>
        </div>

        {/* Input & Check Card */}
        {!isChecked ? (
          <form onSubmit={handleCheckAnswer} className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div>
              <label htmlFor="input-dictation-answer" className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-2">
                Gõ câu em nghe được:
              </label>
              <input
                id="input-dictation-answer"
                ref={inputRef}
                type="text"
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                placeholder="Gõ câu em nghe được..."
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full px-4 py-4 text-lg sm:text-xl rounded-2xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none font-semibold text-slate-900 leading-relaxed placeholder:text-slate-400 placeholder:font-normal"
              />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                id="btn-replay-audio"
                onClick={handlePlayAudio}
                disabled={isLimitReached}
                className="min-h-[48px] py-3.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 font-bold text-base transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <RotateCcw className="w-5 h-5 text-indigo-600" />
                <span>NGHE LẠI</span>
              </button>

              <button
                type="submit"
                id="btn-check-answer"
                className="min-h-[48px] py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.99]"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>KIỂM TRA</span>
              </button>
            </div>
          </form>
        ) : (
          /* Feedback Card */
          <div id="feedback-card" className="bg-white rounded-3xl p-5 sm:p-6 shadow-md border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            {/* Feedback Banner */}
            {currentCheckResult?.isCorrect ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center space-x-3 text-emerald-900">
                <span className="text-2xl">⭐</span>
                <div>
                  <h4 className="font-extrabold text-base sm:text-lg text-emerald-800">
                    Tuyệt vời! Chính xác!
                  </h4>
                  <p className="text-xs text-emerald-700 font-medium">
                    Em đã nghe và gõ đúng 100% câu này.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center space-x-3 text-amber-900">
                <span className="text-2xl">💪</span>
                <div>
                  <h4 className="font-extrabold text-base sm:text-lg text-amber-800">
                    Gần đúng rồi! Em xem lại những từ được đánh dấu nhé.
                  </h4>
                  <p className="text-xs text-amber-700 font-medium">
                    Độ chính xác câu này: {currentCheckResult?.sentenceAccuracy}%
                  </p>
                </div>
              </div>
            )}

            {/* CÂU CỦA EM */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                CÂU CỦA EM:
              </label>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm sm:text-base leading-relaxed flex flex-wrap items-center">
                {currentCheckResult?.wordDiffs && currentCheckResult.wordDiffs.length > 0 ? (
                  currentCheckResult.wordDiffs.map((diff, i) => renderStudentDiffBadge(diff, i))
                ) : (
                  <span className="text-slate-400 italic font-normal">Chưa nhập câu trả lời</span>
                )}
              </div>
            </div>

            {/* CÂU ĐÚNG */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-extrabold text-indigo-600 uppercase tracking-wider">
                CÂU ĐÚNG:
              </label>
              <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-base sm:text-lg font-bold text-indigo-950 leading-relaxed flex items-center justify-between gap-2">
                <span>{currentSentence?.text}</span>
                <button
                  type="button"
                  title="Nghe lại câu đúng"
                  onClick={() => {
                    audioPlayer.play({
                      text: currentSentence?.text || '',
                      accent: exercise.voiceAccent,
                      speed: exercise.playbackSpeed,
                    });
                  }}
                  className="w-9 h-9 rounded-xl bg-white hover:bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 shadow-sm border border-indigo-200 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Next Button */}
            <button
              id="btn-next-sentence"
              onClick={handleNext}
              className="w-full min-h-[52px] py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.99]"
            >
              <span>{currentIndex + 1 < totalSentences ? 'TIẾP THEO' : 'XEM KẾT QUẢ'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </main>

      {/* Footer info */}
      <footer className="w-full max-w-2xl mx-auto flex items-center justify-between text-xs text-slate-400 pt-2">
        <button
          id="btn-quit-practice"
          onClick={onExit}
          className="text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
        >
          Dừng bài tập
        </button>
        <span>Chế độ kiểm tra: {exercise.checkMode === 'EASY' ? 'DỄ' : 'CHÍNH XÁC'}</span>
      </footer>
    </div>
  );
};
