import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Users,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { TeacherClass, SavedDictationItem } from '../../types';
import { clientStorage } from '../../utils/storage';

interface ClassManagementTabProps {
  onQuickAssignForClass?: (className: string) => void;
}

const QUICK_CLASS_SUGGESTIONS = [
  'Grade 3A',
  'Grade 3B',
  'Grade 4A',
  'Grade 4B',
  'Grade 5A',
  'Grade 5B',
  'KID 1A',
  'KID 2A',
  'Starters 1',
  'Movers 1',
  'Flyers 1',
  'Teen 1',
];

export const ClassManagementTab: React.FC<ClassManagementTabProps> = ({
  onQuickAssignForClass,
}) => {
  const [classes, setClasses] = useState<TeacherClass[]>(() =>
    clientStorage.getTeacherClasses()
  );
  const [newClassName, setNewClassName] = useState('');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Add new class
  const handleAddClass = (nameToAdd?: string) => {
    const name = (nameToAdd || newClassName).trim();
    if (!name) return;

    const added = clientStorage.addClass(name);
    if (!added) {
      setErrorMessage(`Lớp "${name}" đã tồn tại trong danh sách.`);
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    setClasses(clientStorage.getTeacherClasses());
    setNewClassName('');
    setErrorMessage('');
  };

  // Start editing
  const startEdit = (cls: TeacherClass) => {
    setEditingClassId(cls.id);
    setEditingName(cls.name);
    setDeletingId(null);
  };

  // Save edit
  const handleSaveRename = (id: string) => {
    if (!editingName.trim()) return;
    const ok = clientStorage.renameClass(id, editingName.trim());
    if (ok) {
      setClasses(clientStorage.getTeacherClasses());
      setEditingClassId(null);
      setEditingName('');
    }
  };

  // Delete class
  const handleDelete = (id: string) => {
    clientStorage.deleteClass(id);
    setClasses(clientStorage.getTeacherClasses());
    setDeletingId(null);
  };

  return (
    <div id="class-management-tab" className="flex flex-col gap-6">
      {/* Top Add Class Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">
              Thêm lớp học mới
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Quản lý danh sách các lớp để tạo link giao bài tập theo lớp nhanh chóng
            </p>
          </div>
        </div>

        {/* Add Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddClass();
          }}
          className="flex flex-col sm:flex-row items-stretch gap-2.5"
        >
          <input
            id="input-new-class-name"
            type="text"
            value={newClassName}
            onChange={(e) => {
              setNewClassName(e.target.value);
              if (errorMessage) setErrorMessage('');
            }}
            placeholder="Nhập tên lớp học (vd: Grade 3A, KID1A, Teen 1)..."
            className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder-slate-400"
          />
          <button
            id="btn-add-class"
            type="submit"
            disabled={!newClassName.trim()}
            className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm lớp</span>
          </button>
        </form>

        {errorMessage && (
          <p className="text-xs text-rose-600 font-semibold">{errorMessage}</p>
        )}

        {/* Quick Suggestion Chips */}
        <div className="pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap text-xs">
          <span className="text-slate-400 font-medium text-[11px]">Gợi ý nhanh:</span>
          {QUICK_CLASS_SUGGESTIONS.filter(
            (s) => !classes.some((c) => c.name.toLowerCase() === s.toLowerCase())
          )
            .slice(0, 6)
            .map((sugg) => (
              <button
                key={sugg}
                type="button"
                onClick={() => handleAddClass(sugg)}
                className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
              >
                + {sugg}
              </button>
            ))}
        </div>
      </div>

      {/* Classes List */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Danh sách lớp học hiện tại ({classes.length} lớp)</span>
          </h4>
        </div>

        {classes.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-white border border-slate-200 text-slate-500 text-xs font-medium">
            Chưa có lớp học nào. Hãy nhập tên lớp ở trên để thêm vào danh sách.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {classes.map((cls) => {
              const isEditing = editingClassId === cls.id;
              const isDeleting = deletingId === cls.id;

              return (
                <div
                  key={cls.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm flex flex-col justify-between gap-3 transition-all"
                >
                  {/* Name or Edit Field */}
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(cls.id);
                          if (e.key === 'Escape') setEditingClassId(null);
                        }}
                        autoFocus
                        className="flex-1 px-3 py-1.5 rounded-xl border-2 border-indigo-500 text-sm font-bold text-slate-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(cls.id)}
                        className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                        title="Lưu tên lớp"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingClassId(null)}
                        className="p-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                        title="Hủy"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 font-extrabold text-xs flex items-center justify-center">
                          🏫
                        </span>
                        <span className="font-bold text-slate-900 text-sm sm:text-base">
                          {cls.name}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => startEdit(cls)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                          title="Đổi tên lớp"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(cls.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Xóa lớp"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Delete Confirmation Box */}
                  {isDeleting && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs flex items-center justify-between gap-1">
                      <span className="text-rose-800 font-bold">Xóa lớp này?</span>
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(cls.id)}
                          className="px-2 py-0.5 bg-rose-600 text-white rounded font-bold cursor-pointer"
                        >
                          Xóa
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-bold cursor-pointer"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
