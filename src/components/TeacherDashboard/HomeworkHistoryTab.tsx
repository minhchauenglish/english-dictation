import React, { useState, useMemo } from 'react';
import {
  Clock,
  Search,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Calendar,
  AlertCircle,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { HomeworkHistoryItem } from '../../types';
import { clientStorage } from '../../utils/storage';
import { formatDailyZaloMessage, formatZaloHomeworkMessage } from '../../utils/homeworkMessage';

interface HomeworkHistoryTabProps {
  onPreviewUrl?: (url: string) => void;
}

export const HomeworkHistoryTab: React.FC<HomeworkHistoryTabProps> = ({ onPreviewUrl }) => {
  const [history, setHistory] = useState<HomeworkHistoryItem[]>(() =>
    clientStorage.getHomeworkHistory()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Unique classes present in history for filtering
  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    history.forEach((h) => {
      if (h.className) set.add(h.className);
    });
    return Array.from(set);
  }, [history]);

  // Filter history
  const filteredHistory = useMemo(() => {
    return history.filter((h) => {
      // Class filter
      if (selectedClassFilter !== 'ALL' && h.className !== selectedClassFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const dateStr = formatDate(h.date).toLowerCase();
        return (
          h.className.toLowerCase().includes(q) ||
          h.exerciseTitle.toLowerCase().includes(q) ||
          (h.topic && h.topic.toLowerCase().includes(q)) ||
          dateStr.includes(q)
        );
      }
      return true;
    });
  }, [history, searchQuery, selectedClassFilter]);

  // Copy Link
  const handleCopyLink = (item: HomeworkHistoryItem) => {
    navigator.clipboard.writeText(item.generatedLink);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Copy Zalo Message
  const handleCopyZalo = (item: HomeworkHistoryItem) => {
    const msg = formatDailyZaloMessage({
      className: item.className,
      exerciseTitle: item.exerciseTitle,
      link: item.generatedLink,
    });
    navigator.clipboard.writeText(msg);
    setCopiedMsgId(item.id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // Delete individual item
  const handleDelete = (id: string) => {
    clientStorage.deleteHomeworkHistoryItem(id);
    setHistory(clientStorage.getHomeworkHistory());
  };

  // Clear all
  const handleClearAll = () => {
    clientStorage.clearHomeworkHistory();
    setHistory([]);
    setIsClearingAll(false);
  };

  // Format date helper
  function formatDate(isoString: string) {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  }

  function formatTime(isoString: string) {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }

  return (
    <div id="homework-history-tab" className="flex flex-col gap-5">
      {/* Top Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-history"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo ngày (26/08/2026), tên lớp (Grade 3A), hoặc tên bài..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium shadow-xs"
          />
        </div>

        {/* Class Filter Dropdown */}
        {uniqueClasses.length > 0 && (
          <div className="flex items-center space-x-2 shrink-0">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs"
            >
              <option value="ALL">Tất cả lớp ({history.length} lượt)</option>
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Lớp {cls}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Clear history button */}
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => setIsClearingAll(true)}
            className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa lịch sử</span>
          </button>
        )}
      </div>

      {/* Clear Confirmation Modal / Banner */}
      {isClearingAll && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center space-x-2 text-rose-800 text-xs font-bold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Bạn có chắc chắn muốn xóa toàn bộ lịch sử các bài đã giao?</span>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Xác nhận xóa hết
            </button>
            <button
              type="button"
              onClick={() => setIsClearingAll(false)}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* History Table View */}
      {filteredHistory.length === 0 ? (
        <div className="p-10 text-center rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
            <Clock className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-slate-800 text-base mb-1">
            {searchQuery || selectedClassFilter !== 'ALL'
              ? 'Không tìm thấy lượt giao bài phù hợp'
              : 'Chưa có lịch sử giao bài'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Khi bạn bấm <span className="font-bold text-slate-700">"🚀 GIAO BÀI HÔM NAY"</span> hoặc giao bài cho từng lớp, thông tin ngày, link và lời nhắn sẽ tự động được lưu trữ ở đây.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Responsive Table for Desktop & Tablet */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 font-extrabold">📅 Ngày</th>
                  <th className="py-3.5 px-4 font-extrabold">🏫 Lớp</th>
                  <th className="py-3.5 px-4 font-extrabold">📚 Bài tập</th>
                  <th className="py-3.5 px-4 font-extrabold">🔗 Link bài tập</th>
                  <th className="py-3.5 px-4 font-extrabold text-center">Trạng thái</th>
                  <th className="py-3.5 px-4 font-extrabold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700">
                {filteredHistory.map((item) => (
                  <tr
                    key={item.id}
                    id={`history-row-${item.id}`}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Ngày */}
                    <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-800">
                      <div>{formatDate(item.date)}</div>
                      <div className="text-[11px] font-normal text-slate-400">
                        {formatTime(item.date)}
                      </div>
                    </td>

                    {/* Lớp */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-xl bg-indigo-600 text-white font-black text-xs shadow-2xs">
                        {item.className}
                      </span>
                    </td>

                    {/* Bài */}
                    <td className="py-3 px-4 max-w-[220px]">
                      <div className="font-bold text-slate-900 line-clamp-1">
                        {item.exerciseTitle}
                      </div>
                      {item.topic && (
                        <div className="text-[11px] text-slate-500 line-clamp-1">
                          {item.topic}
                        </div>
                      )}
                    </td>

                    {/* Link */}
                    <td className="py-3 px-4 max-w-[240px]">
                      <input
                        type="text"
                        readOnly
                        value={item.generatedLink}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="w-full px-2 py-1 text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-lg select-all focus:outline-none"
                      />
                    </td>

                    {/* Trạng thái */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-extrabold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{item.status || 'Đã giao'}</span>
                      </span>
                    </td>

                    {/* Hành động */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* Copy link */}
                        <button
                          type="button"
                          onClick={() => handleCopyLink(item)}
                          className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer"
                          title="Sao chép Link"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">Đã chép</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                              <span>Chép link</span>
                            </>
                          )}
                        </button>

                        {/* Copy Zalo */}
                        <button
                          type="button"
                          onClick={() => handleCopyZalo(item)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center space-x-1 shadow-2xs cursor-pointer"
                          title="Sao chép tin nhắn Zalo"
                        >
                          {copiedMsgId === item.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-white" />
                              <span>Đã chép!</span>
                            </>
                          ) : (
                            <>
                              <MessageSquare className="w-3.5 h-3.5 text-white" />
                              <span>Zalo</span>
                            </>
                          )}
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          title="Xóa dòng này"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer stats */}
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>
              Hiển thị <strong>{filteredHistory.length}</strong> / {history.length} lượt giao bài
            </span>
            <span>Tự động lưu vào bộ nhớ trình duyệt</span>
          </div>
        </div>
      )}
    </div>
  );
};
