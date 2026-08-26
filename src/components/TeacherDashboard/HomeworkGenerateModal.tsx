import React, { useState, useMemo } from 'react';
import {
  X,
  Send,
  Copy,
  Check,
  CheckSquare,
  Square,
  Sparkles,
  ExternalLink,
  MessageSquare,
  Layers,
  BookOpen,
} from 'lucide-react';
import { DictationExercise, TeacherClass, HomeworkHistoryItem, ExerciseMode } from '../../types';
import { buildShareUrl } from '../../utils/codec';
import { clientStorage } from '../../utils/storage';
import { formatZaloHomeworkMessage } from '../../utils/homeworkMessage';

interface HomeworkGenerateModalProps {
  exercise: DictationExercise;
  classLevel?: string;
  topic?: string;
  onClose: () => void;
  onPreview?: (exercise: DictationExercise) => void;
}

export const HomeworkGenerateModal: React.FC<HomeworkGenerateModalProps> = ({
  exercise,
  classLevel,
  topic,
  onClose,
  onPreview,
}) => {
  const [classes, setClasses] = useState<TeacherClass[]>(() => clientStorage.getTeacherClasses());
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(() => {
    const list = clientStorage.getTeacherClasses();
    // Default select classes that match classLevel or select top 3
    if (classLevel) {
      const matched = list.filter((c) =>
        c.name.toLowerCase().includes(classLevel.toLowerCase().trim())
      );
      if (matched.length > 0) return matched.map((c) => c.id);
    }
    return list.slice(0, 3).map((c) => c.id);
  });

  const [copiedClassId, setCopiedClassId] = useState<string | null>(null);
  const [copiedMsgClassId, setCopiedMsgClassId] = useState<string | null>(null);
  const [copiedAllLinks, setCopiedAllLinks] = useState(false);
  const [copiedAllMessages, setCopiedAllMessages] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  // Base shareable URL for the exercise
  const baseShareUrl = useMemo(() => buildShareUrl(exercise), [exercise]);

  // Selected class objects
  const selectedClasses = useMemo(() => {
    return classes.filter((c) => selectedClassIds.includes(c.id));
  }, [classes, selectedClassIds]);

  // Generate class-specific items and save to homework history when generating
  const generatedLinks = useMemo(() => {
    return selectedClasses.map((cls) => {
      // Create link with class tag
      const link = `${baseShareUrl}?c=${encodeURIComponent(cls.name)}`;
      const zaloMessage = formatZaloHomeworkMessage({
        className: cls.name,
        exerciseTitle: exercise.title,
        topic: topic || undefined,
        classLevel: classLevel || undefined,
        exerciseMode: exercise.exerciseMode || 'PRACTICE',
        sentenceCount: exercise.sentences.length,
        link,
      });

      return {
        classId: cls.id,
        className: cls.name,
        link,
        zaloMessage,
      };
    });
  }, [selectedClasses, baseShareUrl, exercise, topic, classLevel]);

  // Toggle class selection
  const toggleClass = (id: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Select all or deselect all
  const toggleSelectAll = () => {
    if (selectedClassIds.length === classes.length) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(classes.map((c) => c.id));
    }
  };

  // Quick add class inline if teacher needs a new class immediately
  const handleQuickAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    const added = clientStorage.addClass(newClassName.trim());
    if (added) {
      const updated = clientStorage.getTeacherClasses();
      setClasses(updated);
      setSelectedClassIds((prev) => [...prev, added.id]);
      setNewClassName('');
    }
  };

  // Log to history and copy individual link
  const handleCopyLink = (item: (typeof generatedLinks)[0]) => {
    navigator.clipboard.writeText(item.link);
    setCopiedClassId(item.classId);
    setTimeout(() => setCopiedClassId(null), 2000);

    // Save to history
    logHistory([item]);
  };

  // Log to history and copy Zalo message
  const handleCopyZaloMessage = (item: (typeof generatedLinks)[0]) => {
    navigator.clipboard.writeText(item.zaloMessage);
    setCopiedMsgClassId(item.classId);
    setTimeout(() => setCopiedMsgClassId(null), 2000);

    // Save to history
    logHistory([item]);
  };

  // Copy all links formatted
  const handleCopyAllLinks = () => {
    if (generatedLinks.length === 0) return;
    const text = generatedLinks
      .map((g) => `${g.className}:\n${g.link}`)
      .join('\n\n');

    navigator.clipboard.writeText(text);
    setCopiedAllLinks(true);
    setTimeout(() => setCopiedAllLinks(false), 2000);

    logHistory(generatedLinks);
  };

  // Copy all Zalo messages
  const handleCopyAllMessages = () => {
    if (generatedLinks.length === 0) return;
    const text = generatedLinks
      .map((g) => g.zaloMessage)
      .join('\n\n====================\n\n');

    navigator.clipboard.writeText(text);
    setCopiedAllMessages(true);
    setTimeout(() => setCopiedAllMessages(false), 2000);

    logHistory(generatedLinks);
  };

  // Save generated assignments to LocalStorage history
  const logHistory = (items: typeof generatedLinks) => {
    const historyItems: HomeworkHistoryItem[] = items.map((it) => ({
      id: `hw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toISOString(),
      className: it.className,
      exerciseTitle: exercise.title,
      classLevel,
      topic,
      sentenceCount: exercise.sentences.length,
      exerciseMode: exercise.exerciseMode || 'PRACTICE',
      generatedLink: it.link,
    }));
    clientStorage.addHomeworkHistoryItems(historyItems);
  };

  return (
    <div
      id="homework-generate-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="homework-generate-modal-container"
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-indigo-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-white font-bold shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg leading-tight">
                Giao bài tập cho các lớp
              </h3>
              <p className="text-xs text-indigo-100 font-medium">
                Tạo link & lời nhắn Zalo trong tích tắc
              </p>
            </div>
          </div>

          <button
            id="btn-close-homework-modal"
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          {/* Exercise Info Summary Banner */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="font-bold text-slate-900 text-base sm:text-lg">
                  {exercise.title}
                </span>
                {classLevel && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-bold">
                    {classLevel}
                  </span>
                )}
                {topic && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-bold">
                    {topic}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 font-medium">
                {exercise.sentences.length} câu • Giọng {exercise.voiceAccent} ({exercise.playbackSpeed}x) •{' '}
                {exercise.exerciseMode === 'TEST' ? 'Chế độ Kiểm tra' : 'Chế độ Luyện tập'}
              </p>
            </div>

            {onPreview && (
              <button
                type="button"
                onClick={() => onPreview(exercise)}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold shrink-0 self-start sm:self-center transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                <span>Xem trước</span>
              </button>
            )}
          </div>

          {/* Step 1: Select Classes */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>1. Chọn các lớp cần giao bài ({selectedClassIds.length}/{classes.length})</span>
              </label>

              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
              >
                {selectedClassIds.length === classes.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả lớp'}
              </button>
            </div>

            {/* Class Chips / Checkboxes */}
            <div className="flex flex-wrap gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200">
              {classes.map((cls) => {
                const isSelected = selectedClassIds.includes(cls.id);
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => toggleClass(cls.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300'
                        : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>{cls.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Add Class if missing */}
            <form onSubmit={handleQuickAddClass} className="mt-2.5 flex items-center gap-2">
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="+ Thêm nhanh tên lớp (vd: Grade 3C, Starters 1)..."
                className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-medium"
              />
              <button
                type="submit"
                disabled={!newClassName.trim()}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Thêm lớp
              </button>
            </form>
          </div>

          {/* Step 2: Generated Links and Zalo Message Copy */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                <Send className="w-4 h-4 text-emerald-600" />
                <span>2. Danh sách link & lời nhắn giao bài ({generatedLinks.length})</span>
              </label>

              {generatedLinks.length > 0 && (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleCopyAllLinks}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition-colors flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedAllLinks ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedAllLinks ? 'Đã chép tất cả link' : 'COPY ALL LINKS'}</span>
                  </button>
                </div>
              )}
            </div>

            {generatedLinks.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
                Vui lòng chọn ít nhất 1 lớp ở bước trên để tạo link giao bài.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {generatedLinks.map((item) => (
                  <div
                    key={item.classId}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2.5"
                  >
                    {/* Class header & action buttons */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-extrabold text-xs">
                          {item.className}
                        </span>
                        <span className="text-xs text-slate-500 font-medium truncate max-w-[200px]">
                          {exercise.title}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(item)}
                          className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer"
                        >
                          {copiedClassId === item.classId ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">Đã chép link</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                              <span>Sao chép Link</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyZaloMessage(item)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center space-x-1 shadow-sm cursor-pointer"
                        >
                          {copiedMsgClassId === item.classId ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-white" />
                              <span>Đã chép lời nhắn!</span>
                            </>
                          ) : (
                            <>
                              <MessageSquare className="w-3.5 h-3.5 text-white" />
                              <span>COPY LỜI NHẮN (ZALO)</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* URL Input Box */}
                    <input
                      type="text"
                      readOnly
                      value={item.link}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="w-full px-3 py-1.5 text-[11px] font-mono text-slate-600 bg-white border border-slate-200 rounded-xl select-all focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Zalo message preview box */}
          {generatedLinks.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-extrabold uppercase text-emerald-900 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Xem mẫu lời nhắn Zalo ({generatedLinks[0]?.className})</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyZaloMessage(generatedLinks[0])}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                >
                  Sao chép mẫu này
                </button>
              </div>
              <pre className="text-[11px] font-sans text-emerald-950 whitespace-pre-wrap bg-white p-3 rounded-xl border border-emerald-100 leading-relaxed max-h-36 overflow-y-auto">
                {generatedLinks[0]?.zaloMessage}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-500 font-medium hidden sm:block">
            Link đã được tự động lưu vào <span className="font-bold text-slate-700">Lịch sử giao bài</span>
          </p>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
            >
              Đóng
            </button>
            {generatedLinks.length > 0 && (
              <button
                type="button"
                onClick={handleCopyAllMessages}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                {copiedAllMessages ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>ĐÃ SAO CHÉP TẤT CẢ!</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4" />
                    <span>SAO CHÉP TẤT CẢ LỜI NHẮN</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
