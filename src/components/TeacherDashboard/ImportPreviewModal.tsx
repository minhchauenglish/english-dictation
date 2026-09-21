import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Check,
  AlertTriangle,
  Edit3,
  Trash2,
  Plus,
  Layers,
  CheckCircle2,
  ArrowLeft,
  BookOpen,
  Info,
  Sparkles,
  School,
  Save,
  Calendar,
} from 'lucide-react';
import {
  ImportedLesson,
  ImportFileResult,
  DuplicateResolution,
  LessonContentType,
} from '../../types/import';
import { TeacherClass, SavedDictationItem } from '../../types';
import { clientStorage } from '../../utils/storage';
import { convertImportedLessonToDictation } from '../../utils/wordParser';
import { evaluateLessonDuplicates } from '../../utils/duplicateDetector';

interface ImportPreviewModalProps {
  fileResults: ImportFileResult[];
  onBackToUpload: () => void;
  onClose: () => void;
  onImportComplete: (count: number, classes: string[]) => void;
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
  fileResults,
  onBackToUpload,
  onClose,
  onImportComplete,
}) => {
  // Existing library to detect duplicates
  const existingLibrary = useMemo(() => clientStorage.getSavedDictations(), []);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>(() =>
    clientStorage.getTeacherClasses()
  );

  // Class assignment state - tracked by classId
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(() => {
    const matchedIds = new Set<string>();
    fileResults.forEach((f) => {
      if (f.detectedClass) {
        const found = teacherClasses.find(
          (c) =>
            c.name.trim().toLowerCase() === f.detectedClass?.trim().toLowerCase()
        );
        if (found) matchedIds.add(found.id);
      }
    });
    return Array.from(matchedIds);
  });

  // Flatten and initialize lessons with class-aware duplicate detection
  const [lessons, setLessons] = useState<ImportedLesson[]>(() => {
    const all: ImportedLesson[] = [];
    fileResults.forEach((file) => {
      file.lessons.forEach((l) => {
        all.push({ ...l });
      });
    });

    const initialClassIds: string[] = [];
    fileResults.forEach((f) => {
      if (f.detectedClass) {
        const found = teacherClasses.find(
          (c) =>
            c.name.trim().toLowerCase() === f.detectedClass?.trim().toLowerCase()
        );
        if (found && !initialClassIds.includes(found.id)) {
          initialClassIds.push(found.id);
        }
      }
    });

    return evaluateLessonDuplicates(all, existingLibrary, {
      targetClassIds: initialClassIds,
      teacherClasses,
    });
  });

  // Automatically update duplicate status when class assignment selection changes
  useEffect(() => {
    setLessons((prev) =>
      evaluateLessonDuplicates(prev, existingLibrary, {
        targetClassIds: selectedClassIds,
        teacherClasses,
      })
    );
  }, [selectedClassIds, teacherClasses, existingLibrary]);

  // Selected file filter tab
  const [activeFileFilter, setActiveFileFilter] = useState<string>('ALL');

  // Currently editing lesson (for the inline editor drawer/modal)
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    lessonNumber: string;
    title: string;
    type: LessonContentType;
    wordsText: string;
    sentencesText: string;
    paragraphText: string;
    translationText: string;
  } | null>(null);

  // Current daily schedule assignments mapping (classId -> dictationId)
  const currentDailyAssignments = useMemo(() => clientStorage.getClassAssignments(), []);

  // Per-class schedule assignment mapping: classId -> importedLesson.id | 'KEEP'
  const [classScheduleMapping, setClassScheduleMapping] = useState<Record<string, string>>({});

  const [assignToDailySchedule, setAssignToDailySchedule] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessData, setImportSuccessData] = useState<{
    count: number;
    classes: string[];
    dailyAssignments: { className: string; lessonTitle: string }[];
  } | null>(null);

  // Detected classes from files for display
  const detectedClassesFromWord = useMemo(() => {
    const set = new Set<string>();
    fileResults.forEach((f) => {
      if (f.detectedClass) set.add(f.detectedClass.trim());
    });
    return Array.from(set);
  }, [fileResults]);

  // Filtered lessons for view
  const visibleLessons = useMemo(() => {
    if (activeFileFilter === 'ALL') return lessons;
    return lessons.filter((l) => l.fileId === activeFileFilter);
  }, [lessons, activeFileFilter]);

  // Valid lessons for import & schedule assignment (excluding duplicates marked SKIP)
  const validLessonsForSchedule = useMemo(
    () =>
      lessons.filter(
        (l) => l.selected && !l.validationError && l.duplicateResolution !== 'SKIP'
      ),
    [lessons]
  );

  // Selection counts (excluding skipped items)
  const selectedCount = useMemo(
    () => validLessonsForSchedule.length,
    [validLessonsForSchedule]
  );
  const allSelected = visibleLessons.length > 0 && visibleLessons.every((l) => l.selected);

  // Toggle selection for a single lesson
  const toggleSelectLesson = (id: string) => {
    setLessons((prev) =>
      prev.map((l) => (l.id === id ? { ...l, selected: !l.selected } : l))
    );
  };

  // Toggle select all in visible view
  const handleToggleSelectAll = () => {
    const nextVal = !allSelected;
    setLessons((prev) =>
      prev.map((l) => {
        if (activeFileFilter === 'ALL' || l.fileId === activeFileFilter) {
          return { ...l, selected: nextVal };
        }
        return l;
      })
    );
  };

  // Delete a lesson from import list
  const handleDeleteLesson = (id: string) => {
    setLessons((prev) => prev.filter((l) => l.id !== id));
    if (editingLessonId === id) {
      setEditingLessonId(null);
      setEditForm(null);
    }
  };

  // Change duplicate resolution
  const handleResolutionChange = (id: string, res: DuplicateResolution) => {
    setLessons((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              duplicateResolution: res,
              selected: res === 'SKIP' ? false : l.selected,
            }
          : l
      )
    );
  };

  // Open inline editor
  const handleStartEdit = (l: ImportedLesson) => {
    setEditingLessonId(l.id);
    setEditForm({
      lessonNumber: l.lessonNumber,
      title: l.title,
      type: l.type,
      wordsText: l.words.join('\n'),
      sentencesText: l.sentences.join('\n'),
      paragraphText: l.paragraph || '',
      translationText: l.translation || '',
    });
  };

  // Save edit form
  const handleSaveEdit = () => {
    if (!editingLessonId || !editForm) return;

    const newWords = editForm.wordsText
      .split('\n')
      .map((w) => w.trim())
      .filter(Boolean);

    const newSentences = editForm.sentencesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    setLessons((prev) =>
      prev.map((l) => {
        if (l.id !== editingLessonId) return l;

        const hasContent =
          newWords.length > 0 ||
          newSentences.length > 0 ||
          editForm.paragraphText.trim().length > 0;

        return {
          ...l,
          lessonNumber: editForm.lessonNumber.trim(),
          title: editForm.title.trim() || `Lesson ${editForm.lessonNumber}`,
          type: editForm.type,
          words: newWords,
          sentences: newSentences,
          paragraph: editForm.paragraphText.trim() || undefined,
          translation: editForm.translationText.trim() || undefined,
          validationError: hasContent ? undefined : 'Lesson has no content.',
          selected: hasContent,
        };
      })
    );

    setEditingLessonId(null);
    setEditForm(null);
  };

  // Add detected class to teacherClasses list
  const handleAddDetectedClass = (className: string) => {
    const existing = teacherClasses.find(
      (c) => c.name.trim().toLowerCase() === className.trim().toLowerCase()
    );
    if (existing) {
      setSelectedClassIds((prev) =>
        prev.includes(existing.id) ? prev : [...prev, existing.id]
      );
      return;
    }
    const added = clientStorage.addClass(className);
    if (added) {
      setTeacherClasses((prev) => [...prev, added]);
      setSelectedClassIds((prev) =>
        prev.includes(added.id) ? prev : [...prev, added.id]
      );
    }
  };

  // Toggle class selection
  const handleToggleClass = (classId: string) => {
    setSelectedClassIds((prev) => {
      const isRemoving = prev.includes(classId);
      const next = isRemoving
        ? prev.filter((id) => id !== classId)
        : [...prev, classId];

      // If adding a class and schedule assignment is active, ensure it has a default mapping
      if (!isRemoving && assignToDailySchedule) {
        if (validLessonsForSchedule.length > 0) {
          setClassScheduleMapping((m) => {
            if (m[classId]) return m;
            const idx = next.length - 1;
            return {
              ...m,
              [classId]: validLessonsForSchedule[idx % validLessonsForSchedule.length].id,
            };
          });
        }
      }

      return next;
    });
  };

  // Quick action: Assign first valid lesson to all selected classes
  const handleQuickAssignFirstToAll = () => {
    if (validLessonsForSchedule.length === 0) return;
    const firstLessonId = validLessonsForSchedule[0].id;
    setClassScheduleMapping((prev) => {
      const updated = { ...prev };
      selectedClassIds.forEach((classId) => {
        updated[classId] = firstLessonId;
      });
      return updated;
    });
  };

  // Quick action: Spread valid lessons 1-to-1 across selected classes
  const handleQuickAssignSpread = () => {
    if (validLessonsForSchedule.length === 0) return;
    setClassScheduleMapping((prev) => {
      const updated = { ...prev };
      selectedClassIds.forEach((classId, idx) => {
        updated[classId] =
          validLessonsForSchedule[idx % validLessonsForSchedule.length].id;
      });
      return updated;
    });
  };

  // Quick action: Keep current schedule for all selected classes
  const handleQuickAssignKeepAll = () => {
    setClassScheduleMapping((prev) => {
      const updated = { ...prev };
      selectedClassIds.forEach((classId) => {
        updated[classId] = 'KEEP';
      });
      return updated;
    });
  };

  // Execute Batch Import
  const handleExecuteImport = () => {
    const validToImport = lessons.filter(
      (l) => l.selected && !l.validationError && l.duplicateResolution !== 'SKIP'
    );

    if (validToImport.length === 0) return;

    setIsImporting(true);

    setTimeout(() => {
      const itemsToSave: {
        item: Omit<SavedDictationItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
        action: 'ADD' | 'REPLACE';
        replaceTargetId?: string;
      }[] = [];

      // Danh sách các đối tượng TeacherClass được chọn
      const selectedClassesList = teacherClasses.filter((c) =>
        selectedClassIds.includes(c.id)
      );

      // Logic gán nhãn classLevel:
      // 1. Khi chọn đúng 1 lớp: classLevel = tên lớp đó (e.g. "1A" hoặc "Grade 3A")
      // 2. Khi chọn nhiều lớp: KHÔNG lưu chuỗi ghép "1A, 1B, 1C".
      //    - Nếu các lớp cùng gradeLevel (e.g. cùng "Grade 3" hoặc cùng "KID 1"), classLevel = gradeLevel đó.
      //    - Nếu không cùng gradeLevel, để undefined để parser lấy detectedGrade/detectedClass của bài hoặc "General".
      // 3. Khi không chọn lớp: undefined (hệ thống tự lấy detectedClass / detectedGrade / General).
      // Đồng thời, lưu mảng classIds: string[] (mã ID các lớp đã chọn) vào lesson item.
      let assignedClassLabel: string | undefined = undefined;
      if (selectedClassesList.length === 1) {
        assignedClassLabel = selectedClassesList[0].name.trim();
      } else if (selectedClassesList.length > 1) {
        const distinctGrades: string[] = [];
        selectedClassesList.forEach((c) => {
          const g = c.gradeLevel?.trim();
          if (g && !distinctGrades.includes(g)) {
            distinctGrades.push(g);
          }
        });
        if (distinctGrades.length === 1) {
          assignedClassLabel = distinctGrades[0];
        } else {
          assignedClassLabel = undefined;
        }
      }

      validToImport.forEach((lesson) => {
        const dictationData = convertImportedLessonToDictation(
          lesson,
          assignedClassLabel
        );

        const itemPayload = {
          title: dictationData.title,
          classLevel: dictationData.classLevel,
          classIds: selectedClassIds.length > 0 ? [...selectedClassIds] : undefined,
          topic: dictationData.topic,
          passage: dictationData.passage,
          exercise: dictationData.exercise,
          group: dictationData.group,
          grade: dictationData.grade,
          unit: dictationData.unit,
          unitTitle: dictationData.unitTitle,
          lessonNumber: dictationData.lessonNumber,
        };

        if (lesson.duplicateResolution === 'REPLACE' && lesson.duplicateExistingId) {
          itemsToSave.push({
            action: 'REPLACE',
            replaceTargetId: lesson.duplicateExistingId,
            item: itemPayload,
          });
        } else {
          itemsToSave.push({
            action: 'ADD',
            item: itemPayload,
          });
        }
      });

      // Batch save to localStorage
      const savedItems = clientStorage.batchSaveDictations(itemsToSave);

      // Map imported lesson id -> newly saved/replaced dictation item id
      const lessonIdToSavedId = new Map<string, string>();
      validToImport.forEach((lesson, index) => {
        if (savedItems[index]) {
          lessonIdToSavedId.set(lesson.id, savedItems[index].id);
        }
      });

      // Gán vào lịch hôm nay theo từng classId đã chọn (nếu được bật)
      const dailyAssignedList: { className: string; lessonTitle: string }[] = [];

      if (assignToDailySchedule && selectedClassIds.length > 0) {
        selectedClassIds.forEach((classId) => {
          const targetCls = teacherClasses.find((c) => c.id === classId);
          if (targetCls) {
            const chosenLessonId = classScheduleMapping[classId];
            // Chỉ cập nhật nếu người dùng chọn 1 bài học cụ thể (không chọn KEEP và không để trống)
            if (chosenLessonId && chosenLessonId !== 'KEEP') {
              const realSavedDictId = lessonIdToSavedId.get(chosenLessonId);
              if (realSavedDictId) {
                clientStorage.setClassAssignment(classId, realSavedDictId);
                const assignedLesson = validToImport.find((l) => l.id === chosenLessonId);
                if (assignedLesson) {
                  dailyAssignedList.push({
                    className: targetCls.name,
                    lessonTitle: assignedLesson.title,
                  });
                }
              }
            }
          }
        });
      }

      setIsImporting(false);
      setImportSuccessData({
        count: savedItems.length,
        classes: selectedClassesList.map((c) => c.name),
        dailyAssignments: dailyAssignedList,
      });
    }, 450);
  };

  // Render Success Screen
  if (importSuccessData) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl border border-slate-200 animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-4 shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
            ✓ Import Thành Công!
          </h3>

          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            Đã lưu thành công <strong className="text-emerald-700 font-extrabold">{importSuccessData.count} bài học</strong> vào Thư viện bài tập Dictation.
          </p>

          {importSuccessData.classes.length > 0 && (
            <div className="mb-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-left">
              <span className="font-extrabold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                <School className="w-4 h-4 text-indigo-600" />
                Lớp học có thể sử dụng trọn bộ ({importSuccessData.count} bài):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {importSuccessData.classes.map((cls) => (
                  <span
                    key={cls}
                    className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-bold border border-indigo-100"
                  >
                    {cls}
                  </span>
                ))}
              </div>
            </div>
          )}

          {importSuccessData.dailyAssignments.length > 0 && (
            <div className="mb-5 p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-100 text-xs text-left">
              <span className="font-extrabold text-indigo-900 block mb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Lịch bài tập hôm nay đã được cập nhật:
              </span>
              <div className="space-y-1.5">
                {importSuccessData.dailyAssignments.map((da) => (
                  <div
                    key={da.className}
                    className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-indigo-100/60 shadow-2xs"
                  >
                    <span className="font-extrabold text-indigo-900 shrink-0">
                      Lớp {da.className}:
                    </span>
                    <span className="font-medium text-slate-700 truncate text-2xs" title={da.lessonTitle}>
                      {da.lessonTitle}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => onImportComplete(importSuccessData.count, importSuccessData.classes)}
            className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-extrabold text-sm shadow-md transition-all cursor-pointer"
          >
            Hoàn tất & Xem thư viện
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      id="modal-word-import-preview"
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onBackToUpload}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Quay lại chọn file"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Xem trước & Chỉnh sửa bài học từ Word
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs font-bold">
                  {lessons.length} bài tìm thấy
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Kiểm tra nội dung, chọn lớp áp dụng và nhập hàng loạt vào thư viện
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

        {/* Top Filter & Bulk Selection Bar */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          {/* File Filter Tabs if multiple files */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setActiveFileFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl font-extrabold transition-colors cursor-pointer ${
                activeFileFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Tất cả ({lessons.length})
            </button>
            {fileResults.map((f) => (
              <button
                key={f.fileId}
                type="button"
                onClick={() => setActiveFileFilter(f.fileId)}
                className={`px-3 py-1.5 rounded-xl font-bold truncate max-w-[180px] transition-colors cursor-pointer ${
                  activeFileFilter === f.fileId
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
                title={f.fileName}
              >
                {f.fileName} ({f.lessons.length})
              </button>
            ))}
          </div>

          {/* Check All & Count */}
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center space-x-1"
            >
              <span>{allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả bài'}</span>
            </button>
            <span className="text-xs font-extrabold text-slate-700 px-2.5 py-1 bg-white border border-slate-200 rounded-lg">
              Đã chọn: <span className="text-indigo-600">{selectedCount}</span>/{lessons.length}
            </span>
          </div>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/40">
          {/* File Audit / Diagnostic Summary Banner */}
          {fileResults.some((f) => f.auditWarning || (f.totalUnitsDetected && f.totalUnitsDetected > 1)) && (
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl text-xs space-y-1.5">
              {fileResults.map((f) => (
                <div key={f.fileId} className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-indigo-900">{f.fileName}:</span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-700 font-bold">
                    {f.lessons.length} bài
                  </span>
                  {f.totalUnitsDetected !== undefined && f.totalUnitsDetected > 1 && (
                    <span className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-slate-700 font-semibold">
                      {f.totalUnitsDetected} Units (Bài {f.firstLessonNumber} → {f.lastLessonNumber})
                    </span>
                  )}
                  {f.auditWarning && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                      {f.auditWarning}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {visibleLessons.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
              <p className="text-sm font-bold text-slate-700">
                Không có bài học nào trong danh sách này
              </p>
            </div>
          ) : (
            visibleLessons.map((item) => (
              <div
                key={item.id}
                id={`preview-lesson-${item.id}`}
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  item.selected
                    ? 'bg-white border-indigo-200 shadow-sm'
                    : 'bg-slate-100/70 border-slate-200 opacity-65'
                }`}
              >
                {/* Header Row: Checkbox, Lesson Title, Type, Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  <div className="flex items-start sm:items-center space-x-3 flex-1">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggleSelectLesson(item.id)}
                      className="w-4 h-4 mt-0.5 sm:mt-0 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />

                    <div>
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-black text-xs">
                          Lesson {item.lessonNumber}
                        </span>
                        <h4 className="font-black text-slate-900 text-sm sm:text-base">
                          {item.title}
                        </h4>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold uppercase tracking-wider">
                          {item.type.replace(/_/g, ' ')}
                        </span>
                        {item.detectedClass && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                            Lớp: {item.detectedClass}
                          </span>
                        )}
                        {item.translation && (
                          <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 text-xs font-semibold">
                            🇻🇳 Có bản dịch
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
                        {item.type === 'WORDS' && (
                          <span>{item.words.length} từ vựng</span>
                        )}
                        {item.type === 'SENTENCES' && (
                          <span>{item.sentences.length} câu</span>
                        )}
                        {item.type === 'WORDS_AND_SENTENCES' && (
                          <span>
                            {item.words.length} từ • {item.sentences.length} câu
                          </span>
                        )}
                        {item.type === 'PARAGRAPH' && (
                          <span>1 đoạn văn ({item.sentences.length} câu)</span>
                        )}
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-400 truncate max-w-[160px]">
                          {item.fileName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Edit & Delete */}
                  <div className="flex items-center space-x-1.5 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(item)}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-indigo-600 border border-indigo-200 text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Sửa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLesson(item.id)}
                      className="p-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 text-xs transition-colors cursor-pointer"
                      title="Xóa bài này khỏi danh sách import"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Validation Error Alert if any */}
                {item.validationError && (
                  <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-bold flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{item.validationError}</span>
                  </div>
                )}

                {/* Duplicate Warning & Resolution Options */}
                {item.isDuplicate && (
                  <div className="mt-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    <div className="flex items-center space-x-1.5 font-bold mb-2.5 text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>⚠ Bài này đã tồn tại trong cùng khối/Unit.</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 bg-amber-100/70 p-3 rounded-xl text-xs mb-3 border border-amber-200/70 font-medium">
                      {/* Bài đang import */}
                      <div className="space-y-1 bg-white/70 p-2.5 rounded-lg border border-amber-200/50">
                        <div className="text-[11px] font-black uppercase tracking-wider text-amber-900 border-b border-amber-200/60 pb-1 mb-1.5">
                          Bài đang import:
                        </div>
                        <div>
                          <span className="text-amber-800 font-semibold">Lớp:</span>{' '}
                          <span className="font-bold text-slate-900">
                            {item.detectedGroup || item.detectedClass || (item.detectedGrade ? `Lớp ${item.detectedGrade}` : 'Chung')}
                          </span>
                        </div>
                        <div>
                          <span className="text-amber-800 font-semibold">Unit:</span>{' '}
                          <span className="font-bold text-slate-900">
                            {item.unitNumber || item.detectedUnit || '–'}
                          </span>
                        </div>
                        <div>
                          <span className="text-amber-800 font-semibold">Lesson:</span>{' '}
                          <span className="font-bold text-slate-900">
                            {item.lessonNumber || '–'}
                          </span>
                        </div>
                        <div>
                          <span className="text-amber-800 font-semibold">Tên bài:</span>{' '}
                          <span className="font-bold text-slate-900">
                            {item.title}
                          </span>
                        </div>
                      </div>

                      {/* Bài đã có */}
                      <div className="space-y-1 bg-white/70 p-2.5 rounded-lg border border-amber-200/50">
                        <div className="text-[11px] font-black uppercase tracking-wider text-amber-900 border-b border-amber-200/60 pb-1 mb-1.5">
                          Bài đã có:
                        </div>
                        <div>
                          <span className="text-amber-800 font-semibold">Lớp:</span>{' '}
                          <span className="font-bold text-slate-900">
                            {item.duplicateExistingGroup || 'Chung'}
                          </span>
                        </div>
                        <div>
                          <span className="text-amber-800 font-semibold">Unit:</span>{' '}
                          <span className="font-bold text-slate-900">
                            {item.duplicateExistingUnit || '–'}
                          </span>
                        </div>
                        <div>
                          <span className="text-amber-800 font-semibold">Lesson:</span>{' '}
                          <span className="font-bold text-slate-900">
                            {item.duplicateExistingLesson || '–'}
                          </span>
                        </div>
                        <div>
                          <span className="text-amber-800 font-semibold">Tên bài:</span>{' '}
                          <span className="font-bold text-slate-900">
                            {item.duplicateExistingTitle || item.title}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-2 pl-1 font-medium">
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name={`dup_res_${item.id}`}
                          value="IMPORT_ANYWAY"
                          checked={item.duplicateResolution === 'IMPORT_ANYWAY'}
                          onChange={() => handleResolutionChange(item.id, 'IMPORT_ANYWAY')}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Import anyway (Thêm bài mới)</span>
                      </label>

                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name={`dup_res_${item.id}`}
                          value="SKIP"
                          checked={item.duplicateResolution === 'SKIP'}
                          onChange={() => handleResolutionChange(item.id, 'SKIP')}
                          className="text-slate-600 focus:ring-slate-500"
                        />
                        <span>Skip duplicate (Bỏ qua bài này)</span>
                      </label>

                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name={`dup_res_${item.id}`}
                          value="REPLACE"
                          checked={item.duplicateResolution === 'REPLACE'}
                          onChange={() => handleResolutionChange(item.id, 'REPLACE')}
                          className="text-amber-600 focus:ring-amber-500"
                        />
                        <span>Replace existing lesson (Ghi đè bài cũ)</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Content preview snippet */}
                <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 font-mono bg-slate-50/60 p-2.5 rounded-xl">
                  {item.words.length > 0 && (
                    <div className="mb-1">
                      <strong className="font-sans text-slate-700">Words ({item.words.length}):</strong>{' '}
                      {item.words.slice(0, 8).join(', ')}
                      {item.words.length > 8 && '...'}
                    </div>
                  )}
                  {item.sentences.length > 0 && (
                    <div>
                      <strong className="font-sans text-slate-700">Sentences:</strong>{' '}
                      {item.sentences.slice(0, 2).join(' / ')}
                      {item.sentences.length > 2 && ` (+${item.sentences.length - 2} câu khác)`}
                    </div>
                  )}
                  {item.paragraph && item.sentences.length === 0 && (
                    <div className="line-clamp-2 italic">{item.paragraph}</div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* ASSIGN TO CLASS SECTION */}
          <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-white border border-indigo-100 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <School className="w-5 h-5 text-indigo-600" />
                <h4 className="font-black text-slate-900 text-sm sm:text-base">
                  CHỌN LỚP ÁP DỤNG (ASSIGN TO CLASS)
                </h4>
              </div>
              <span className="text-xs text-slate-500">
                (Tùy chọn • có thể lưu vào Thư viện chung)
              </span>
            </div>

            {/* Detected from Word label if any */}
            {detectedClassesFromWord.length > 0 && (
              <div className="mb-3 text-xs bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Đã nhận diện từ file Word:{' '}
                    <strong className="font-extrabold text-emerald-900">{detectedClassesFromWord.join(', ')}</strong>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {detectedClassesFromWord.map((dc) => {
                    const exists = teacherClasses.some(
                      (c) => c.name.trim().toLowerCase() === dc.trim().toLowerCase()
                    );
                    if (exists) return null;
                    return (
                      <button
                        key={dc}
                        type="button"
                        onClick={() => handleAddDetectedClass(dc)}
                        className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-2xs font-extrabold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Thêm lớp "{dc}" vào hệ thống</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Classes Checkbox Grid */}
            <p className="text-xs text-slate-500 mb-2.5">
              Chọn một hoặc nhiều lớp trong hệ thống để gắn nhãn bài học:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {teacherClasses.map((cls) => {
                const isChecked = selectedClassIds.includes(cls.id);
                return (
                  <label
                    key={cls.id}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center space-x-2 cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-indigo-50 text-indigo-900 border-indigo-300 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleClass(cls.id)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="truncate">{cls.name}</span>
                  </label>
                );
              })}
            </div>

            {/* Assign to Daily Schedule option */}
            {selectedClassIds.length > 0 && (
              <div className="mt-4 pt-3.5 border-t border-slate-100">
                <div className="flex items-center space-x-2 text-xs">
                  <input
                    type="checkbox"
                    id="chk-assign-schedule"
                    checked={assignToDailySchedule}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAssignToDailySchedule(checked);
                      if (checked) {
                        // Ensure all selected classes have an initial assignment
                        setClassScheduleMapping((prev) => {
                          const updated = { ...prev };
                          selectedClassIds.forEach((classId, idx) => {
                            if (!updated[classId]) {
                              if (validLessonsForSchedule.length === 1) {
                                updated[classId] = validLessonsForSchedule[0].id;
                              } else if (validLessonsForSchedule.length > 1) {
                                updated[classId] =
                                  validLessonsForSchedule[idx % validLessonsForSchedule.length].id;
                              }
                            }
                          });
                          return updated;
                        });
                      }
                    }}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label
                    htmlFor="chk-assign-schedule"
                    className="font-bold text-slate-800 cursor-pointer"
                  >
                    Đồng thời thiết lập bài tập hôm nay cho các lớp được chọn (trong tab 📅 Lịch giao bài)
                  </label>
                </div>

                {assignToDailySchedule && (
                  <div className="mt-3 p-3.5 bg-slate-50 border border-indigo-100/70 rounded-2xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                          Chọn bài tập hôm nay cho từng lớp:
                        </span>
                        <span className="text-2xs text-slate-500 block mt-0.5">
                          Mỗi lớp nhận 1 bài học làm bài tập hôm nay. Toàn bộ {validLessonsForSchedule.length} bài vẫn được lưu sẵn trong Thư viện để các lớp dùng bất cứ lúc nào.
                        </span>
                      </div>

                      {/* Quick Assign Buttons */}
                      {validLessonsForSchedule.length > 1 && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={handleQuickAssignFirstToAll}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-2xs font-bold transition-colors cursor-pointer shadow-2xs"
                            title="Gán cùng bài 1 làm bài hôm nay cho tất cả các lớp"
                          >
                            Bài 1 cho tất cả
                          </button>
                          <button
                            type="button"
                            onClick={handleQuickAssignSpread}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-2xs font-bold transition-colors cursor-pointer shadow-2xs"
                            title="Phân bổ lần lượt: Lớp 1 làm Bài 1, Lớp 2 làm Bài 2..."
                          >
                            Phân bổ 1-1
                          </button>
                          <button
                            type="button"
                            onClick={handleQuickAssignKeepAll}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-2xs font-bold transition-colors cursor-pointer shadow-2xs"
                            title="Không ghi đè lịch hiện tại của các lớp"
                          >
                            Giữ lịch hiện tại
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Class rows */}
                    <div className="space-y-2">
                      {selectedClassIds.map((classId) => {
                        const targetCls = teacherClasses.find((c) => c.id === classId);
                        if (!targetCls) return null;

                        const chosenLessonId = classScheduleMapping[targetCls.id] || '';
                        const currentDictId = currentDailyAssignments[targetCls.id];
                        const currentDict = existingLibrary.find((x) => x.id === currentDictId);

                        return (
                          <div
                            key={targetCls.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-[130px]">
                              <span className="font-extrabold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 text-xs">
                                Lớp {targetCls.name}
                              </span>
                              {currentDict && (
                                <span
                                  className="text-2xs text-slate-400 truncate max-w-[140px]"
                                  title={`Hiện đang gán: ${currentDict.title}`}
                                >
                                  (Hiện: {currentDict.title})
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-1 max-w-md">
                              <select
                                value={chosenLessonId}
                                onChange={(e) =>
                                  setClassScheduleMapping((prev) => ({
                                    ...prev,
                                    [targetCls.id]: e.target.value,
                                  }))
                                }
                                className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                              >
                                <option value="KEEP">-- Giữ nguyên lịch hiện tại (Không đổi) --</option>
                                {validLessonsForSchedule.map((vl) => (
                                  <option key={vl.id} value={vl.id}>
                                    Lesson {vl.lessonNumber}: {vl.title}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Sẽ thêm <strong>{selectedCount} bài học</strong> vào Thư viện Dictation
            {selectedClassIds.length > 0 && ` cho ${selectedClassIds.length} lớp`}.
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              Hủy
            </button>

            <button
              id="btn-confirm-import-lessons"
              type="button"
              disabled={selectedCount === 0 || isImporting}
              onClick={handleExecuteImport}
              className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm text-white shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                selectedCount === 0 || isImporting
                  ? 'bg-indigo-300 cursor-not-allowed shadow-none'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
              }`}
            >
              {isImporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Đang nhập bài học...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Import {selectedCount} bài học</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* INLINE EDIT LESSON MODAL */}
      {editingLessonId && editForm && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
              <h4 className="font-extrabold text-slate-900 text-base">
                Chỉnh sửa bài học trước khi import
              </h4>
              <button
                type="button"
                onClick={() => {
                  setEditingLessonId(null);
                  setEditForm(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="font-bold text-slate-700 block mb-1">
                    Lesson No.
                  </label>
                  <input
                    type="text"
                    value={editForm.lessonNumber}
                    onChange={(e) =>
                      setEditForm({ ...editForm, lessonNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">
                    Tiêu đề (Title)
                  </label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm({ ...editForm, title: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Loại nội dung (Type)
                </label>
                <select
                  value={editForm.type}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      type: e.target.value as LessonContentType,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="WORDS">WORDS (Từ vựng)</option>
                  <option value="SENTENCES">SENTENCES (Các câu)</option>
                  <option value="WORDS_AND_SENTENCES">
                    WORDS AND SENTENCES (Cả từ và câu)
                  </option>
                  <option value="PARAGRAPH">PARAGRAPH (Đoạn văn)</option>
                </select>
              </div>

              {(editForm.type === 'WORDS' ||
                editForm.type === 'WORDS_AND_SENTENCES') && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Từ vựng (WORDS - mỗi từ 1 dòng):
                  </label>
                  <textarea
                    rows={4}
                    value={editForm.wordsText}
                    onChange={(e) =>
                      setEditForm({ ...editForm, wordsText: e.target.value })
                    }
                    placeholder="hello&#10;goodbye&#10;apple"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {(editForm.type === 'SENTENCES' ||
                editForm.type === 'WORDS_AND_SENTENCES') && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Các câu (SENTENCES - mỗi câu 1 dòng):
                  </label>
                  <textarea
                    rows={4}
                    value={editForm.sentencesText}
                    onChange={(e) =>
                      setEditForm({ ...editForm, sentencesText: e.target.value })
                    }
                    placeholder="This is my school.&#10;My teacher is nice."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {editForm.type === 'PARAGRAPH' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Đoạn văn (PARAGRAPH):
                  </label>
                  <textarea
                    rows={5}
                    value={editForm.paragraphText}
                    onChange={(e) =>
                      setEditForm({ ...editForm, paragraphText: e.target.value })
                    }
                    placeholder="I have a pet. My pet is a dog. It is very cute."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Translation Field (Optional) */}
              <div>
                <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>Bản dịch tiếng Việt (TRANSLATION - tùy chọn):</span>
                  <span className="text-2xs font-normal text-slate-400">Đánh số 1. 2. hoặc cả đoạn văn</span>
                </label>
                <textarea
                  rows={3}
                  value={editForm.translationText}
                  onChange={(e) =>
                    setEditForm({ ...editForm, translationText: e.target.value })
                  }
                  placeholder="1. Xin chào các bạn.&#10;2. Đây là trường học của tôi."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditingLessonId(null);
                  setEditForm(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu thay đổi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
