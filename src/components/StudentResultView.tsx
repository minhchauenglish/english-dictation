import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  RotateCcw,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Volume2,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { DictationExercise, SentenceSubmissionResult, PracticeSessionResult } from '../types';
import { audioPlayer } from '../utils/audioPlayer';

interface StudentResultViewProps {
  exercise: DictationExercise;
  studentName: string;
  sentenceResults: SentenceSubmissionResult[];
  onRetryIncorrect: (incorrectSentences: SentenceSubmissionResult[]) => void;
  onRestartAll: () => void;
  onBackToHome: () => void;
}

export const StudentResultView: React.FC<StudentResultViewProps> = ({
  exercise,
  studentName,
  sentenceResults,
  onRetryIncorrect,
  onRestartAll,
  onBackToHome,
}) => {
  const [copied, setCopied] = useState(false);

  // Compute Overall Score and Accuracy
  const totalSentences = sentenceResults.length;
  const correctSentencesCount = sentenceResults.filter((r) => r.isCorrect).length;

  let totalAccuracySum = 0;
  const wrongWordsSet = new Set<string>();

  sentenceResults.forEach((res) => {
    totalAccuracySum += res.sentenceAccuracy;
    res.wordDiffs.forEach((wd) => {
      if (wd.type === 'incorrect' || wd.type === 'missing') {
        const word = (wd.correctWord || wd.studentWord || '')
          .toLowerCase()
          .replace(/[^a-z0-9']/g, '')
          .trim();
        if (word.length > 0) {
          wrongWordsSet.add(word);
        }
      }
    });
  });

  const overallAccuracy =
    totalSentences > 0 ? Math.round(totalAccuracySum / totalSentences) : 0;
  const score = overallAccuracy;
  const wrongWords = Array.from(wrongWordsSet);
  const incorrectResults = sentenceResults.filter((r) => !r.isCorrect);

  // Fire confetti on high score
  useEffect(() => {
    if (score >= 75) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}
    }
  }, [score]);

  // Generate standard text report for clipboard copy (Zalo/SMS friendly)
  const generateSummaryText = () => {
    const wrongWordsList = wrongWords.length > 0 ? wrongWords.join(', ') : 'Không có (Làm đúng tất cả!)';
    return (
`English Dictation
Học sinh: ${studentName}
Bài: ${exercise.title}
Điểm: ${score}%
Độ chính xác: ${overallAccuracy}% (${correctSentencesCount}/${totalSentences} câu đúng)
Từ cần luyện: ${wrongWordsList}`
    );
  };

  const handleCopyResult = async () => {
    const text = generateSummaryText();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Copy error', err);
    }
  };

  return (
    <div id="student-result-view" className="min-h-screen bg-slate-100 text-slate-800 p-4 sm:p-6 flex flex-col justify-between">
      {/* Top action bar */}
      <header className="w-full max-w-2xl mx-auto flex items-center justify-between">
        <button
          id="btn-result-home"
          onClick={onBackToHome}
          className="inline-flex items-center space-x-1 text-slate-600 hover:text-slate-900 text-xs sm:text-sm font-bold px-3 py-1.5 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Về trang chủ</span>
        </button>
        <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
          Kết quả bài làm
        </span>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-2xl mx-auto my-4 space-y-6">
        {/* Core Result Banner Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 text-center space-y-5">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-amber-50 text-amber-500 mx-auto shadow-inner">
            <Trophy className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <h1 id="result-title-celebration" className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              🎉 HOÀN THÀNH!
            </h1>
            <p className="text-sm sm:text-base font-bold text-slate-700">
              Học sinh: <span className="text-indigo-600">{studentName}</span>
            </p>
            <p className="text-xs text-slate-500 font-medium">
              Bài: {exercise.title}
            </p>
          </div>

          {/* Large Score Display */}
          <div className="py-3">
            <div className="inline-flex items-baseline justify-center space-x-1">
              <span id="final-score-value" className="text-5xl sm:text-7xl font-black text-indigo-600 tracking-tight">
                {score}%
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              {score >= 90
                ? '⭐ Tuyệt đối xuất sắc!'
                : score >= 75
                ? '👏 Làm rất tốt!'
                : score >= 50
                ? '👍 Cố gắng luyện tập thêm nhé!'
                : '💪 Hãy luyện lại các câu chưa đúng!'}
            </p>
          </div>

          {/* Mini Stats Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-left">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Độ chính xác
              </span>
              <span className="text-base sm:text-lg font-black text-slate-900">
                {overallAccuracy}%
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Số câu hoàn thành
              </span>
              <span className="text-base sm:text-lg font-black text-slate-900">
                {correctSentencesCount} / {totalSentences} câu đúng
              </span>
            </div>
          </div>
        </div>

        {/* Card: Words to Practice (TỪ CẦN LUYỆN) */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-3 text-left">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              TỪ CẦN LUYỆN
            </h3>
            <span className="text-xs text-slate-400">
              {wrongWords.length} từ cần chú ý
            </span>
          </div>

          {wrongWords.length > 0 ? (
            <div id="wrong-words-list" className="flex flex-wrap gap-2 pt-1">
              {wrongWords.map((word, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold text-xs sm:text-sm"
                >
                  <span>{word}</span>
                  <button
                    type="button"
                    title={`Nghe phát âm từ ${word}`}
                    onClick={() =>
                      audioPlayer.play({
                        text: word,
                        accent: exercise.voiceAccent,
                        speed: 0.85,
                      })
                    }
                    className="hover:text-rose-900 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Không có từ nào viết sai! Em đã nghe và viết chuẩn 100%.</span>
            </div>
          )}
        </div>

        {/* Detailed Review Breakdown */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4 text-left">
          <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">
            Chi tiết từng câu
          </h3>
          <div className="space-y-3">
            {sentenceResults.map((res, i) => (
              <div
                key={i}
                className={`p-3.5 rounded-2xl border ${
                  res.isCorrect ? 'bg-slate-50 border-slate-200' : 'bg-rose-50/40 border-rose-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className={res.isCorrect ? 'text-slate-700' : 'text-rose-700'}>
                    Câu {res.sentenceOrder}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full ${
                      res.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {res.isCorrect ? '✓ Đúng 100%' : `${res.sentenceAccuracy}%`}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-900">{res.targetSentence}</p>
                {!res.isCorrect && (
                  <p className="text-xs text-slate-500 mt-1">
                    Em gõ: <span className="font-medium text-slate-700">{res.studentAnswer || '(để trống)'}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Required 3 Bottom Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {incorrectResults.length > 0 && (
            <button
              id="btn-retry-incorrect"
              onClick={() => onRetryIncorrect(incorrectResults)}
              className="w-full min-h-[50px] py-3.5 px-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-[0.99]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>🔁 LUYỆN LẠI CÂU SAI ({incorrectResults.length})</span>
            </button>
          )}

          <button
            id="btn-restart-all"
            onClick={onRestartAll}
            className="w-full min-h-[50px] py-3.5 px-3 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-[0.99]"
          >
            <RefreshCw className="w-4 h-4" />
            <span>🔄 LÀM LẠI TOÀN BỘ</span>
          </button>

          <button
            id="btn-copy-final-result"
            onClick={handleCopyResult}
            className={`w-full min-h-[50px] py-3.5 px-3 rounded-2xl font-extrabold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-[0.99] ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'ĐÃ SAO CHÉP' : '📋 SAO CHÉP KẾT QUẢ'}</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center text-xs text-slate-400 py-2">
        Kết quả lưu trên thiết bị của em • Sao chép để gửi cho thầy/cô
      </footer>
    </div>
  );
};
