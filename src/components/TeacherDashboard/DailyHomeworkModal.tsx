import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Rocket,
  Copy,
  Check,
  MessageSquare,
  Sparkles,
  ExternalLink,
  Calendar,
  Layers,
  CheckCircle2,
  Share2,
  BookOpen,
} from 'lucide-react';
import {
  TeacherClass,
  SavedDictationItem,
  DictationExercise,
  HomeworkHistoryItem,
} from '../../types';
import { buildShareUrl } from '../../utils/codec';
import { clientStorage } from '../../utils/storage';
import {
  formatDailyZaloMessage,
  formatBatchAllZaloMessages,
} from '../../utils/homeworkMessage';

interface DailyHomeworkModalProps {
  onClose: () => void;
  onPreviewExercise?: (exercise: DictationExercise) => void;
}

interface DispatchedClassItem {
  classId: string;
  className: string;
  exerciseTitle: string;
  topic?: string;
  classLevel?: string;
  sentenceCount: number;
  exercise: DictationExercise;
  link: string;
  zaloMessage: string;
}

export const DailyHomeworkModal: React.FC<DailyHomeworkModalProps> = ({
  onClose,
  onPreviewExercise,
}) => {
  const [classes] = useState<TeacherClass[]>(() => clientStorage.getTeacherClasses());
  const [library] = useState<SavedDictationItem[]>(() => clientStorage.getSavedDictations());
  const [assignments] = useState<Record<string, string>>(() => clientStorage.getClassAssignments());

  const [copiedAllMessages, setCopiedAllMessages] = useState(false);
  const [copiedAllLinks, setCopiedAllLinks] = useState(false);
  const [copiedClassId, setCopiedClassId] = useState<string | null>(null);
  const [copiedMsgClassId, setCopiedMsgClassId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Today formatted string
  const todayFormatted = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, []);

  // Compute all dispatched items
  const dispatchedItems = useMemo<DispatchedClassItem[]>(() => {
    const items: DispatchedClassItem[] = [];

    classes.forEach((cls) => {
      const dictId = assignments[cls.id];
      if (!dictId) return;

      const libItem = library.find((x) => x.id === dictId);
      if (!libItem) return;

      const baseLink = buildShareUrl(libItem.exercise);
      const link = `${baseLink}?c=${encodeURIComponent(cls.name)}`;
      const zaloMessage = formatDailyZaloMessage({
        className: cls.name,
        exerciseTitle: libItem.title,
        link,
      });

      items.push({
        classId: cls.id,
        className: cls.name,
        exerciseTitle: libItem.title,
        topic: libItem.topic,
        classLevel: libItem.classLevel,
        sentenceCount: libItem.exercise.sentences.length,
        exercise: libItem.exercise,
        link,
        zaloMessage,
      });
    });

    return items;
  }, [classes, library, assignments]);

  // Automatically save to Homework History on mount / generation
  useEffect(() => {
    if (dispatchedItems.length === 0) return;

    const historyItems: HomeworkHistoryItem[] = dispatchedItems.map((item) => ({
      id: `hw_${item.classId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toISOString(),
      className: item.className,
      exerciseTitle: item.exerciseTitle,
      classLevel: item.classLevel,
      topic: item.topic,
      sentenceCount: item.sentenceCount,
      exerciseMode: item.exercise.exerciseMode || 'PRACTICE',
      generatedLink: item.link,
      status: 'Đã giao',
    }));

    clientStorage.addHomeworkHistoryItems(historyItems);
  }, [dispatchedItems]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1-Click Copy All Zalo Messages
  const handleCopyAllZaloMessages = () => {
    if (dispatchedItems.length === 0) return;
    const combined = formatBatchAllZaloMessages(
      dispatchedItems.map((item) => ({
        className: item.className,
        exerciseTitle: item.exerciseTitle,
        link: item.link,
      }))
    );
    navigator.clipboard.writeText(combined);
    setCopiedAllMessages(true);
    showToast(`✅ Đã sao chép toàn bộ tin nhắn Zalo cho ${dispatchedItems.length} lớp!`);
    setTimeout(() => setCopiedAllMessages(false), 2500);
  };

  // 1-Click Copy All Links
  const handleCopyAllLinks = () => {
    if (dispatchedItems.length === 0) return;
    const text = dispatchedItems
      .map((it) => `🏫 Lớp ${it.className} (${it.exerciseTitle}):\n${it.link}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopiedAllLinks(true);
    showToast(`✅ Đã sao chép danh sách link bài tập của ${dispatchedItems.length} lớp!`);
    setTimeout(() => setCopiedAllLinks(false), 2500);
  };

  // Copy Single Link
  const handleCopySingleLink = (item: DispatchedClassItem) => {
    navigator.clipboard.writeText(item.link);
    setCopiedClassId(item.classId);
    showToast(`Đã sao chép link lớp ${item.className}`);
    setTimeout(() => setCopiedClassId(null), 2000);
  };

  // Copy Single Zalo Message
  const handleCopySingleZalo = (item: DispatchedClassItem) => {
    navigator.clipboard.writeText(item.zaloMessage);
    setCopiedMsgClassId(item.classId);
    showToast(`Đã sao chép tin nhắn Zalo lớp ${item.className}`);
    setTimeout(() => setCopiedMsgClassId(null), 2000);
  };

  return (
    <div
      id="modal-daily-homework-dispatch"
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in"
    >
      {/* Toast popup */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-60 px-5 py-3 bg-slate-900 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-2xl flex items-center space-x-2 border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-slate-900 text-white flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-black shadow-md">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg sm:text-xl font-black text-white leading-tight">
                  Giao bài Dictation hôm nay
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-extrabold">
                  {todayFormatted}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Đã tạo link riêng và lưu vào lịch sử cho {dispatchedItems.length} lớp học
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Sticky Quick Action Bar */}
        <div className="p-4 bg-emerald-50/70 border-b border-emerald-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2 text-xs font-extrabold text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Sẵn sàng gửi tin nhắn cho <strong>{dispatchedItems.length} lớp</strong> (Không cần tạo thủ công)
            </span>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Primary Action: Copy All Zalo Messages */}
            <button
              id="btn-copy-all-zalo-messages"
              type="button"
              onClick={handleCopyAllZaloMessages}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-black shadow-md shadow-emerald-600/30 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              {copiedAllMessages ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>ĐÃ CHÉP TẤT CẢ ZALO!</span>
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4 text-white" />
                  <span>📱 COPY TẤT CẢ TIN NHẮN ZALO</span>
                </>
              )}
            </button>

            {/* Secondary Action: Copy All Links */}
            <button
              id="btn-copy-all-links"
              type="button"
              onClick={handleCopyAllLinks}
              className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              {copiedAllLinks ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Đã chép link</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy tất cả link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Content: List of Class Dispatches */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50">
          {dispatchedItems.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
              <p className="text-sm font-bold text-slate-700 mb-1">
                Chưa có lớp nào được gán bài hôm nay
              </p>
              <p className="text-xs text-slate-500 mb-3">
                Vui lòng vào tab "📅 Lịch giao bài" để chọn bài cho các lớp trước khi bấm Giao bài.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl"
              >
                Về lịch giao bài
              </button>
            </div>
          ) : (
            dispatchedItems.map((item, index) => (
              <div
                key={item.classId}
                id={`dispatch-item-${item.classId}`}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col gap-3.5"
              >
                {/* Header: Class Badge + Exercise Title + Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-white text-xs font-black flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="px-3 py-1 rounded-xl bg-indigo-600 text-white font-black text-xs sm:text-sm shadow-xs">
                      🏫 {item.className}
                    </span>
                    <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                      {item.exerciseTitle}
                    </span>
                    {item.topic && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                        {item.topic}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                      {item.sentenceCount} câu
                    </span>
                  </div>

                  {onPreviewExercise && (
                    <button
                      type="button"
                      onClick={() => onPreviewExercise(item.exercise)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Làm thử</span>
                    </button>
                  )}
                </div>

                {/* Grid 2-col: Link box + Zalo Message Box */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
                  {/* Left: Link Box */}
                  <div className="lg:col-span-5 flex flex-col justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 gap-2">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                        🔗 Link bài tập riêng cho {item.className}:
                      </span>
                      <input
                        type="text"
                        readOnly
                        value={item.link}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="w-full mt-1 px-2.5 py-1.5 text-xs font-mono text-slate-700 bg-white border border-slate-200 rounded-lg select-all focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopySingleLink(item)}
                      className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      {copiedClassId === item.classId ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-extrabold">Đã chép link</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Sao chép Link</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Right: Formatted Zalo Message Box */}
                  <div className="lg:col-span-7 flex flex-col justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/80 gap-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                          📱 Mẫu tin nhắn Zalo gửi phụ huynh {item.className}:
                        </span>
                      </div>
                      <pre className="mt-1 p-2.5 rounded-lg bg-white border border-emerald-100 text-xs font-sans text-slate-800 whitespace-pre-wrap leading-relaxed select-all">
                        {item.zaloMessage}
                      </pre>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopySingleZalo(item)}
                      className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      {copiedMsgClassId === item.classId ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span className="font-extrabold">Đã chép tin nhắn Zalo!</span>
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-3.5 h-3.5 text-white" />
                          <span>SAO CHÉP TIN NHẮN ZALO LỚP NÀY</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            💡 Gợi ý: Bấm <strong>"COPY TẤT CẢ TIN NHẮN ZALO"</strong> để lấy nội dung gửi nhanh vào các nhóm Zalo lớp.
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm cursor-pointer"
          >
            Đóng bảng giao bài
          </button>
        </div>
      </div>
    </div>
  );
};
