import React, { useState } from 'react';
import { X, ArrowRight, Link as LinkIcon, BookOpen, AlertCircle } from 'lucide-react';
import { decodeExercise } from '../utils/codec';
import { DictationExercise } from '../types';
import { SAMPLE_EXERCISES } from './HomeView';

interface DirectLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: DictationExercise) => void;
}

export const DirectLinkModal: React.FC<DirectLinkModalProps> = ({
  isOpen,
  onClose,
  onSelectExercise,
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleOpenFromInput = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const clean = inputUrl.trim();
    if (!clean) {
      setError('Vui lòng dán link hoặc mã bài tập.');
      return;
    }

    // Check if it contains #/practice/<encoded> or raw encoded
    let encodedData = clean;
    const practiceMatch = clean.match(/#\/?practice\/(.+)$/);
    if (practiceMatch && practiceMatch[1]) {
      encodedData = practiceMatch[1].split('?')[0].trim();
    } else {
      const hashIndex = clean.indexOf('#');
      if (hashIndex !== -1) {
        encodedData = clean.slice(hashIndex + 1).replace(/^\/?practice\//, '').split('?')[0].trim();
      }
    }

    const decoded = decodeExercise(encodedData);
    if (decoded && decoded.sentences.length > 0) {
      onSelectExercise(decoded);
      onClose();
    } else {
      setError('Link bài tập không hợp lệ hoặc dữ liệu bị hỏng.');
    }
  };

  return (
    <div id="direct-link-modal-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div id="direct-link-modal" className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <LinkIcon className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-base">Nhập link bài tập</h3>
          </div>
          <button
            id="btn-close-link-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <form onSubmit={handleOpenFromInput} className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Dán link bài tập giáo viên gửi
            </label>
            <input
              id="input-practice-link"
              type="text"
              value={inputUrl}
              onChange={(e) => {
                setInputUrl(e.target.value);
                setError('');
              }}
              placeholder="https://minhchauenglish.github.io/english-dictation/#/practice/..."
              className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              autoFocus
            />

            {error && (
              <div className="flex items-center space-x-2 text-rose-600 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              id="btn-submit-link"
              type="submit"
              className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>Mở bài tập</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Sample Choice */}
          <div className="pt-4 border-t border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Hoặc làm bài mẫu có sẵn
            </p>
            <div className="space-y-2">
              {SAMPLE_EXERCISES.map((sample, i) => (
                <button
                  key={i}
                  id={`btn-modal-sample-${i}`}
                  onClick={() => {
                    onSelectExercise(sample);
                    onClose();
                  }}
                  className="w-full p-2.5 text-left rounded-lg bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <span className="text-xs font-semibold text-slate-800 group-hover:text-indigo-700">
                    {sample.title} ({sample.sentences.length} câu)
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
