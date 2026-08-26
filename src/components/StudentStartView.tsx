import React, { useState, useEffect } from 'react';
import { User, Headphones, ArrowRight, ArrowLeft, Volume2, Sparkles, ShieldCheck, Users } from 'lucide-react';
import { DictationExercise } from '../types';
import { clientStorage } from '../utils/storage';

interface StudentStartViewProps {
  exercise: DictationExercise;
  onStart: (studentName: string) => void;
  onBackToHome: () => void;
}

export const StudentStartView: React.FC<StudentStartViewProps> = ({
  exercise,
  onStart,
  onBackToHome,
}) => {
  const [name, setName] = useState('');
  const [classNameTag, setClassNameTag] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = clientStorage.getStudentName();
    if (saved) setName(saved);

    try {
      let c = new URLSearchParams(window.location.search).get('c') || new URLSearchParams(window.location.search).get('class');
      if (!c && window.location.hash.includes('?')) {
        const hashQuery = window.location.hash.split('?')[1];
        c = new URLSearchParams(hashQuery).get('c') || new URLSearchParams(hashQuery).get('class');
      }
      if (c) {
        setClassNameTag(decodeURIComponent(c));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Vui lòng nhập tên của em để bắt đầu.');
      return;
    }
    clientStorage.setStudentName(cleanName);
    onStart(cleanName);
  };

  return (
    <div id="student-start-view" className="min-h-screen bg-gradient-to-b from-indigo-50/60 via-white to-slate-100 flex flex-col justify-between text-slate-800 p-4">
      {/* Top bar */}
      <div className="w-full max-w-lg mx-auto flex items-center justify-between pt-2">
        <button
          id="btn-start-back"
          onClick={onBackToHome}
          className="inline-flex items-center space-x-1 text-slate-500 hover:text-slate-800 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Về trang chủ</span>
        </button>
        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100/80 px-2.5 py-0.5 rounded-full">
          English Dictation
        </span>
      </div>

      {/* Main card */}
      <div className="w-full max-w-md mx-auto my-auto bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md shadow-indigo-200">
          <Headphones className="w-8 h-8" />
        </div>

        {/* Title & Class tag */}
        <div className="space-y-2">
          {classNameTag && (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-extrabold text-xs border border-indigo-100 mb-1">
              <Users className="w-3.5 h-3.5" />
              <span>Dành cho lớp: {classNameTag}</span>
            </div>
          )}

          <h2 id="student-exercise-title" className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {exercise.title}
          </h2>
          <div className="flex items-center justify-center flex-wrap gap-2 text-xs text-slate-500">
            <span className={`px-2.5 py-1 rounded-full font-bold ${exercise.exerciseMode === 'TEST' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-indigo-100 text-indigo-800'}`}>
              {exercise.exerciseMode === 'TEST' ? '⏱️ Chế độ Kiểm tra' : '📖 Chế độ Luyện tập'}
            </span>
            <span className="bg-slate-100 px-2.5 py-1 rounded-full font-semibold text-slate-700">
              {exercise.sentences.length} câu nghe
            </span>
            <span className="bg-slate-100 px-2.5 py-1 rounded-full font-semibold text-slate-700">
              {exercise.voiceMode === 'NATURAL'
                ? '✨ Giọng Tự nhiên'
                : exercise.voiceMode === 'UK' || exercise.voiceAccent === 'UK'
                ? '🇬🇧 Anh-Anh'
                : '🇺🇸 Anh-Mỹ'}{' '}
              ({exercise.playbackSpeed || 0.95}x)
            </span>
            <span className="bg-slate-100 px-2.5 py-1 rounded-full font-semibold text-slate-700">
              {exercise.listenLimit === 0 ? 'Nghe tự do' : `Tối đa ${exercise.listenLimit} lượt/câu`}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
              Tên của em:
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-5 h-5" />
              </div>
              <input
                id="input-student-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="Nhập họ và tên..."
                className="w-full pl-11 pr-4 py-3.5 text-base sm:text-lg rounded-2xl border-2 border-slate-200 focus:border-indigo-600 focus:outline-none font-semibold text-slate-900 transition-colors"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-rose-600 text-xs font-semibold mt-1.5 pl-1">
                {error}
              </p>
            )}
          </div>

          <button
            id="btn-start-dictation"
            type="submit"
            className="w-full min-h-[54px] py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-lg shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>BẮT ĐẦU</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Không cần tài khoản • Làm bài trực tiếp trên điện thoại</span>
        </div>
      </div>

      <div className="w-full text-center py-2 text-[11px] text-slate-400">
        Hãy chuẩn bị tai nghe để có trải nghiệm nghe tốt nhất 🎧
      </div>
    </div>
  );
};
