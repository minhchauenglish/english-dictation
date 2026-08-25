import React, { useState } from 'react';
import { Headphones, PenTool, Sparkles, ArrowRight, Play, Link as LinkIcon } from 'lucide-react';
import { DictationExercise } from '../types';

interface HomeViewProps {
  onStartCreate: () => void;
  onOpenPracticeWithExercise: (exercise: DictationExercise) => void;
  onOpenLinkModal: () => void;
}

export const SAMPLE_EXERCISES: DictationExercise[] = [
  {
    title: 'Daily Routines',
    sentences: [
      { id: 's1', order: 1, text: "I get up at six o'clock every morning." },
      { id: 's2', order: 2, text: 'I have breakfast with my family.' },
      { id: 's3', order: 3, text: 'I go to school by bus.' },
      { id: 's4', order: 4, text: 'I like English very much.' },
      { id: 's5', order: 5, text: 'I do my homework in the evening.' },
    ],
    voiceMode: 'NATURAL',
    voiceAccent: 'US',
    playbackSpeed: 0.95,
    listenLimit: 3,
    checkMode: 'EASY',
    exerciseMode: 'PRACTICE',
  },
  {
    title: 'My Cute Pets & Animals',
    sentences: [
      { id: 'p1', order: 1, text: 'I have a little brown dog.' },
      { id: 'p2', order: 2, text: 'He likes running in the green garden.' },
      { id: 'p3', order: 3, text: 'We play with a small yellow ball.' },
      { id: 'p4', order: 4, text: 'My dog sleeps under the chair.' },
    ],
    voiceMode: 'UK',
    voiceAccent: 'UK',
    playbackSpeed: 0.95,
    listenLimit: 3,
    checkMode: 'EASY',
    exerciseMode: 'PRACTICE',
  },
];

export const HomeView: React.FC<HomeViewProps> = ({
  onStartCreate,
  onOpenPracticeWithExercise,
  onOpenLinkModal,
}) => {
  const [showSamples, setShowSamples] = useState(false);

  return (
    <div id="home-view" className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col justify-between text-slate-800">
      {/* Top Simple Brand Bar */}
      <header id="home-header-bar" className="w-full py-5 px-6 max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm font-bold text-lg">
            ED
          </div>
          <span className="font-extrabold text-slate-900 tracking-tight text-lg">
            English Dictation
          </span>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200/60">
          100% Client-Side
        </span>
      </header>

      {/* Hero Core */}
      <main id="home-main-content" className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-3xl mx-auto w-full text-center">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Luyện chính tả tiếng Anh không cần đăng nhập</span>
        </div>

        <h1 id="home-main-title" className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight uppercase mb-4 leading-tight">
          ENGLISH DICTATION
        </h1>

        <p id="home-subtitle" className="text-base sm:text-xl text-slate-600 font-medium mb-10 max-w-xl mx-auto">
          Nghe – Gõ – Kiểm tra – Tiến bộ mỗi ngày
        </p>

        {/* TWO PRIMARY ACTION BUTTONS */}
        <div id="home-primary-actions" className="w-full max-w-md flex flex-col gap-4">
          <button
            id="btn-home-practice"
            onClick={onOpenLinkModal}
            className="w-full min-h-[58px] py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg sm:text-xl shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-center space-x-3 cursor-pointer"
          >
            <Headphones className="w-6 h-6 shrink-0" />
            <span>🎧 LÀM BÀI</span>
          </button>

          <button
            id="btn-home-create"
            onClick={onStartCreate}
            className="w-full min-h-[58px] py-4 px-6 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-300 hover:border-slate-400 font-bold text-lg sm:text-xl shadow-sm transition-all active:scale-[0.99] flex items-center justify-center space-x-3 cursor-pointer"
          >
            <PenTool className="w-6 h-6 text-indigo-600 shrink-0" />
            <span>👩‍🏫 TẠO BÀI DICTATION</span>
          </button>
        </div>

        {/* Sample Practice Quick Access */}
        <div id="home-sample-section" className="mt-8 pt-6 border-t border-slate-200/80 w-full max-w-md">
          <button
            id="btn-toggle-samples"
            onClick={() => setShowSamples(!showSamples)}
            className="text-xs font-semibold text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{showSamples ? 'Ẩn bài mẫu thử nghiệm' : 'Hoặc thử ngay bài mẫu có sẵn'}</span>
          </button>

          {showSamples && (
            <div id="home-sample-list" className="mt-3 flex flex-col gap-2">
              {SAMPLE_EXERCISES.map((sample, idx) => (
                <button
                  key={idx}
                  id={`btn-sample-${idx}`}
                  onClick={() => onOpenPracticeWithExercise(sample)}
                  className="w-full p-3 text-left rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <p className="font-semibold text-sm text-slate-800 group-hover:text-indigo-700">
                      {sample.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {sample.sentences.length} câu • Giọng {sample.voiceAccent} • {sample.checkMode === 'EASY' ? 'Chế độ Dễ' : 'Chính xác'}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer id="home-footer" className="w-full py-4 text-center text-xs text-slate-500">
        Hoạt động hoàn toàn trên trình duyệt • Không lưu trữ trên máy chủ • Không cần tài khoản
      </footer>
    </div>
  );
};
