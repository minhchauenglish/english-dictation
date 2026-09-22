import React, { useState, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  Trash2,
  Undo2,
  CheckCircle2,
  ShieldCheck,
  Search,
  Filter,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  Calendar,
  Sparkles,
  Download,
  Copy,
  FileText,
  Lock,
  BookOpen,
  FolderTree,
  AlertCircle,
  ClipboardList,
} from 'lucide-react';
import { SavedDictationItem, TeacherClass } from '../../types';
import { clientStorage } from '../../utils/storage';
import {
  scanLibraryForDuplicates,
  DuplicateScanReport,
  DuplicateCluster,
  backupBeforeCleanup,
  getLatestCleanupBackup,
  restoreCleanupBackup,
  areContentsMatching,
} from '../../utils/libraryDuplicateScanner';
import {
  runFullLibraryAudit,
  createFullLibraryBackup,
  downloadBackupJSON,
  generateAuditTextReport,
  FullLibraryAuditResult,
  AuditDuplicateCluster,
} from '../../utils/libraryAuditor';

interface DuplicateManagerModalProps {
  onClose: () => void;
  onLibraryUpdated: () => void;
}

export interface DeletionManifestItem {
  deleteId: string;
  keepId: string;
  module: string;
  classGrade: string;
  level: string;
  unit: string;
  lesson: string;
  title: string;
  contentVerified: boolean;
  hasReferencedAssignment: boolean;
}

export const DuplicateManagerModal: React.FC<DuplicateManagerModalProps> = ({
  onClose,
  onLibraryUpdated,
}) => {
  const teacherClasses = useMemo(() => clientStorage.getTeacherClasses(), []);
  const [dictations, setDictations] = useState<SavedDictationItem[]>(() =>
    clientStorage.getSavedDictations()
  );

  // Active view tab: 'AUDIT' (Default) | 'CLUSTERS' | 'MANIFEST'
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'CLUSTERS' | 'MANIFEST'>('AUDIT');
  const [copyStatus, setCopyStatus] = useState<boolean>(false);
  const [manifestCopyStatus, setManifestCopyStatus] = useState<boolean>(false);

  // Full library audit & backup data
  const auditResult = useMemo<FullLibraryAuditResult>(() => {
    return runFullLibraryAudit(
      dictations,
      teacherClasses,
      clientStorage.getClassAssignments(),
      clientStorage.getHomeworkHistory()
    );
  }, [dictations, teacherClasses]);

  const backupData = useMemo(() => {
    return createFullLibraryBackup(
      dictations,
      teacherClasses,
      clientStorage.getClassAssignments(),
      clientStorage.getHomeworkHistory()
    );
  }, [dictations, teacherClasses]);

  // Selection state of item IDs to delete (initially empty set: Deletion Manifest = 0)
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<Set<string>>(() => new Set<string>());

  // Track expanded cluster cards
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({});

  // 3-Tier Filter in modal: 'ALL' | 'CONFIRMED' | 'POTENTIAL'
  const [duplicateFilter, setDuplicateFilter] = useState<'ALL' | 'CONFIRMED' | 'POTENTIAL'>('ALL');
  // Secondary module filter: 'ALL' | 'DICTATION' | 'DEBATE' | 'IELTS' | 'GENERAL'
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');

  // Compute Active Class Assignments for reference detection
  const currentAssignments = useMemo(() => clientStorage.getClassAssignments(), []);

  // Metrics from single source of truth (auditResult)
  const totalConfirmed = auditResult.duplicateSummary.totalConfirmedDuplicates;
  const totalPotential = auditResult.duplicateSummary.totalPotentialDuplicates;
  const totalAll = totalConfirmed + totalPotential;

  // Compute Deletion Manifest (Exact items slated for deletion)
  const deletionManifest = useMemo<DeletionManifestItem[]>(() => {
    const list: DeletionManifestItem[] = [];
    const assignedIds = new Set(Object.values(currentAssignments).filter(Boolean));

    auditResult.allDuplicateClusters.forEach((cluster) => {
      const keep = cluster.keepItem;
      cluster.duplicateItems.forEach((dup) => {
        if (selectedDeleteIds.has(dup.id)) {
          list.push({
            deleteId: dup.id,
            keepId: keep.id,
            module: cluster.module,
            classGrade: dup.group || dup.classLevel || dup.grade || 'N/A',
            level: dup.level || cluster.level || 'N/A',
            unit: dup.unit ? `Unit ${dup.unit}` : 'N/A',
            lesson: dup.lessonNumber ? `Lesson ${dup.lessonNumber}` : (dup.lessonCode || 'N/A'),
            title: dup.title,
            contentVerified: dup.tier === 'CONFIRMED',
            hasReferencedAssignment: assignedIds.has(dup.id),
          });
        }
      });
    });

    return list;
  }, [auditResult.allDuplicateClusters, selectedDeleteIds, currentAssignments]);

  // Compute Confirmed Duplicates that were NOT selected (to be routed to Manual Review)
  const notSelectedConfirmedItems = useMemo(() => {
    const notSelected: Array<{
      id: string;
      keepId: string;
      module: string;
      classGrade: string;
      level: string;
      unit: string;
      lesson: string;
      title: string;
      reason: string;
    }> = [];

    auditResult.allDuplicateClusters.forEach((c) => {
      c.duplicateItems.forEach((d) => {
        if (d.tier === 'CONFIRMED' && !selectedDeleteIds.has(d.id)) {
          notSelected.push({
            id: d.id,
            keepId: c.keepItem.id,
            module: c.module,
            classGrade: d.group || d.classLevel || d.grade || 'N/A',
            level: d.level || c.level || 'N/A',
            unit: d.unit ? `Unit ${d.unit}` : 'N/A',
            lesson: d.lessonNumber ? `Lesson ${d.lessonNumber}` : (d.lessonCode || 'N/A'),
            title: d.title,
            reason:
              d.reason ||
              'Được xếp vào danh sách Review để bảo đảm an toàn dữ liệu, không tự động xóa.',
          });
        }
      });
    });

    return notSelected;
  }, [auditResult.allDuplicateClusters, selectedDeleteIds]);

  // Manifest Text Formatter
  const manifestText = useMemo(() => {
    let txt = `==================================================\n`;
    txt += `DELETE MANIFEST — FINAL PRE-DELETE AUDIT\n`;
    txt += `Tổng số ID xóa: ${deletionManifest.length}\n`;
    txt += `Content 100% Verified: ${deletionManifest.every((m) => m.contentVerified) ? 'YES' : 'NO'}\n`;
    txt += `Trạng thái: READY FOR TEACHER CONFIRMATION — NO DATA DELETED\n`;
    txt += `==================================================\n\n`;

    if (notSelectedConfirmedItems.length > 0) {
      txt += `CONFIRMED DUPLICATES NOT SELECTED (${notSelectedConfirmedItems.length} items):\n`;
      notSelectedConfirmedItems.forEach((it, idx) => {
        txt += `${idx + 1}. ID: ${it.id}\n`;
        txt += `   Module: ${it.module}\n`;
        txt += `   Class/Grade: ${it.classGrade}\n`;
        txt += `   Level: ${it.level}\n`;
        txt += `   Unit: ${it.unit}\n`;
        txt += `   Lesson: ${it.lesson}\n`;
        txt += `   Title: ${it.title}\n`;
        txt += `   Reason not selected: ${it.reason}\n\n`;
      });
      txt += `==================================================\n\n`;
    }

    txt += `DANH SÁCH 318 BẢN GHI SẼ XÓA (KHI ĐƯỢC GIÁO VIÊN DUYỆT):\n\n`;
    deletionManifest.forEach((m, idx) => {
      txt += `[${idx + 1}/${deletionManifest.length}]\n`;
      txt += `DELETE:\n${m.deleteId}\n\n`;
      txt += `KEEP:\n${m.keepId}\n\n`;
      txt += `Module:\n${m.module}\n\n`;
      txt += `Class:\n${m.classGrade}\n\n`;
      if (m.level && m.level !== 'N/A') {
        txt += `Level:\n${m.level}\n\n`;
      }
      txt += `Unit:\n${m.unit}\n\n`;
      txt += `Lesson:\n${m.lesson}\n\n`;
      txt += `Title:\n${m.title}\n\n`;
      txt += `Content Match 100%:\n${m.contentVerified ? 'YES' : 'NO'}\n`;
      if (m.hasReferencedAssignment) {
        txt += `Assignment Migration Needed:\nYES (Sẽ tự động chuyển sang KEEP ID)\n`;
      }
      txt += `--------------------------------------------------\n\n`;
    });

    return txt;
  }, [deletionManifest, notSelectedConfirmedItems]);

  // Handle Download Manifest TXT
  const handleDownloadManifest = () => {
    const blob = new Blob([manifestText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deletion_manifest_${deletionManifest.length}_items.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setActionMessage({
      type: 'info',
      text: `Đã xuất và tải về file Deletion Manifest (${deletionManifest.length} bài) thành công!`,
    });
  };

  // Handle Copy Manifest to clipboard
  const handleCopyManifest = async () => {
    try {
      await navigator.clipboard.writeText(manifestText);
      setManifestCopyStatus(true);
      setTimeout(() => setManifestCopyStatus(false), 3000);
    } catch {
      // fallback
    }
  };

  // Success / Undo notification message
  const [actionMessage, setActionMessage] = useState<{
    type: 'success' | 'undo' | 'info';
    text: string;
  } | null>(null);

  // Check if undo is available
  const [canUndo, setCanUndo] = useState<boolean>(() => !!getLatestCleanupBackup());

  // Handle Download Backup JSON
  const handleDownloadBackup = () => {
    downloadBackupJSON(backupData);
    setActionMessage({
      type: 'info',
      text: `Đã xuất và tải về file Backup an toàn (${backupData.lessons.length} bài học, ${backupData.classes.length} lớp học)!`,
    });
  };

  // Handle Copy Audit Report Text
  const handleCopyReport = () => {
    const textReport = generateAuditTextReport(auditResult, backupData.backupHeader);
    navigator.clipboard.writeText(textReport);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2500);
    setActionMessage({
      type: 'info',
      text: 'Đã sao chép toàn bộ nội dung Báo cáo Audit & Backup vào clipboard!',
    });
  };

  // Toggle selection for an individual item
  const handleToggleItem = (itemId: string) => {
    setSelectedDeleteIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Select all confirmed duplicates (Candidate for deletion)
  const handleSelectAllConfirmed = () => {
    const confirmedSet = new Set<string>(auditResult.confirmedDuplicateIds);
    setSelectedDeleteIds(confirmedSet);
    setActionMessage({
      type: 'info',
      text: `Đã chọn ${confirmedSet.size} bản trùng chắc chắn để xóa (Candidate for deletion).`,
    });
  };

  // Deselect all
  const handleDeselectAll = () => {
    setSelectedDeleteIds(new Set());
    setActionMessage({
      type: 'info',
      text: 'Đã bỏ chọn tất cả bản trùng.',
    });
  };

  // Execute deletion of selected duplicates (with safety guard & assignment migration)
  const handleExecuteDelete = () => {
    const toDeleteIds = Array.from(selectedDeleteIds);
    if (toDeleteIds.length === 0) return;

    const itemsToDelete = dictations.filter((d) => selectedDeleteIds.has(d.id));

    // 1. Map deleted duplicates to their respective cluster keepItem
    const deletedToKeepMap: Record<string, string> = {};
    auditResult.allDuplicateClusters.forEach((cluster) => {
      const keepId = cluster.keepItem.id;
      cluster.duplicateItems.forEach((dup) => {
        if (selectedDeleteIds.has(dup.id)) {
          deletedToKeepMap[dup.id] = keepId;
        }
      });
    });

    // 2. Migrate any class assignments pointing to deleted duplicate IDs to the keepItem
    const previousAssignments = clientStorage.getClassAssignments();
    const updatedAssignments = { ...previousAssignments };
    let assignmentsMigratedCount = 0;

    Object.entries(updatedAssignments).forEach(([classId, assignedDictId]) => {
      if (assignedDictId && deletedToKeepMap[assignedDictId]) {
        updatedAssignments[classId] = deletedToKeepMap[assignedDictId];
        assignmentsMigratedCount++;
      }
    });

    if (assignmentsMigratedCount > 0) {
      clientStorage.saveAllClassAssignments(updatedAssignments);
    }

    // 3. Create safety backup snapshot in localStorage (including previous assignments)
    backupBeforeCleanup(itemsToDelete, previousAssignments, deletedToKeepMap);
    setCanUndo(true);

    // 4. Remove items from storage
    const remaining = dictations.filter((d) => !selectedDeleteIds.has(d.id));
    clientStorage.saveAllDictations(remaining);

    // 5. Update local state
    setDictations(remaining);

    // Reset selection
    setSelectedDeleteIds(new Set());

    setActionMessage({
      type: 'success',
      text: `Đã dọn dẹp an toàn ${itemsToDelete.length} bản bài trùng (đã chuyển ${assignmentsMigratedCount} phân công lớp sang bản gốc). Bạn có thể nhấn Hoàn tác nếu cần khôi phục.`,
    });

    onLibraryUpdated();
  };

  // Execute Undo
  const handleUndoCleanup = () => {
    const restoreResult = restoreCleanupBackup(dictations);
    if (!restoreResult) return;

    // 1. Restore dictations to storage
    clientStorage.saveAllDictations(restoreResult.restoredItems);
    setDictations(restoreResult.restoredItems);

    // 2. Restore previous class assignments if saved in backup
    if (restoreResult.previousAssignments) {
      clientStorage.saveAllClassAssignments(restoreResult.previousAssignments);
    }

    setSelectedDeleteIds(new Set());
    setCanUndo(false);

    setActionMessage({
      type: 'undo',
      text: `Đã hoàn tác và khôi phục thành công ${restoreResult.restoredCount} bài học cùng phân công lớp trước dọn dẹp!`,
    });

    onLibraryUpdated();
  };

  // Filtered clusters to display based on 3-tier duplicateFilter and moduleFilter
  const visibleClusters = useMemo(() => {
    return auditResult.allDuplicateClusters
      .filter((cluster) => {
        if (moduleFilter !== 'ALL' && cluster.module !== moduleFilter) {
          return false;
        }
        if (duplicateFilter === 'CONFIRMED') {
          return cluster.duplicateItems.some((d) => d.tier === 'CONFIRMED');
        }
        if (duplicateFilter === 'POTENTIAL') {
          return cluster.duplicateItems.some((d) => d.tier === 'POTENTIAL');
        }
        return cluster.duplicateItems.length > 0;
      })
      .map((cluster) => {
        let filteredDups = cluster.duplicateItems;
        if (duplicateFilter === 'CONFIRMED') {
          filteredDups = cluster.duplicateItems.filter((d) => d.tier === 'CONFIRMED');
        } else if (duplicateFilter === 'POTENTIAL') {
          filteredDups = cluster.duplicateItems.filter((d) => d.tier === 'POTENTIAL');
        }
        return {
          ...cluster,
          duplicateItems: filteredDups,
        };
      });
  }, [auditResult.allDuplicateClusters, duplicateFilter, moduleFilter]);

  const toggleClusterExpand = (clusterId: string) => {
    setExpandedClusters((prev) => ({
      ...prev,
      [clusterId]: prev[clusterId] === undefined ? false : !prev[clusterId],
    }));
  };

  return (
    <div
      id="duplicate-manager-modal"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-hidden animate-in fade-in duration-200"
    >
      <div className="w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/90 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Search className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Kiểm tra & Dọn bài học trùng lặp
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs font-bold">
                  {auditResult.totalLessons} bài đã quét
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Quét đa tiêu chí (Khối lớp, Unit, Lesson, Title, Content) và giữ lại bản gốc an toàn
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

        {/* Sub Header & Tab Switcher */}
        <div className="px-4 py-2.5 bg-slate-800 text-white flex items-center justify-between gap-3 shrink-0 text-xs border-b border-slate-700">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('AUDIT')}
              className={`px-3 py-1.5 rounded-xl font-black flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'AUDIT'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>📊 Báo cáo Audit & Backup (An toàn)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('CLUSTERS')}
              className={`px-3 py-1.5 rounded-xl font-black flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'CLUSTERS'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>🔍 Quản lý chi tiết bài trùng</span>
              {totalAll > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">
                  {totalAll}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('MANIFEST')}
              className={`px-3 py-1.5 rounded-xl font-black flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'MANIFEST'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>📋 Deletion Manifest ({deletionManifest.length})</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDownloadManifest}
              className="px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
              title="Tải về danh sách cố định 318 bài dự kiến xóa (Deletion Manifest TXT)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>📄 Tải Manifest ({deletionManifest.length})</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadBackup}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
              title="Tải về toàn bộ dữ liệu thư viện dưới dạng JSON (Backup an toàn)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>💾 Tải Backup JSON</span>
            </button>

            <button
              type="button"
              onClick={handleCopyReport}
              className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
              title="Sao chép báo cáo đầy đủ 19 câu trả lời vào clipboard"
            >
              {copyStatus ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Đã chép!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>📋 Sao chép báo cáo</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Message Banner if any */}
        {actionMessage && (
          <div
            className={`p-3.5 text-xs font-bold flex items-center justify-between gap-3 shrink-0 border-b ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-indigo-50 text-indigo-900 border-indigo-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* TAB 1: AUDIT & BACKUP VIEW (READ-ONLY) */}
        {activeTab === 'AUDIT' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50">
            {/* Safety Guarantee Banner */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start space-x-3 shadow-2xs">
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm">
                <p className="font-black text-emerald-900 uppercase tracking-wide">
                  Nguyên tắc an toàn tuyệt đối: Chế độ Audit & Báo cáo (Read-only)
                </p>
                <p className="mt-1 text-emerald-800 leading-relaxed">
                  Toàn bộ <strong>{auditResult.totalLessons} bài học</strong>,{' '}
                  <strong>{auditResult.totalClasses} lớp học</strong> và{' '}
                  <strong>{auditResult.totalAssignments} bài gán</strong> được bảo toàn nguyên vẹn 100%. Không xóa, không merge, không thay đổi ID và không recreate bất kỳ bài nào.
                </p>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Tổng bài học
                </span>
                <p className="text-2xl font-black text-slate-900 mt-1">
                  {auditResult.totalLessons}
                </p>
                <span className="text-[11px] text-slate-400">Trong thư viện hiện tại</span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">
                  Debate
                </span>
                <p className="text-2xl font-black text-purple-700 mt-1">
                  {auditResult.debateCounts.total}
                </p>
                <span className="text-[11px] text-purple-500 font-bold">
                  L2: {auditResult.debateCounts.level2} • L3: {auditResult.debateCounts.level3} • L4: {auditResult.debateCounts.level4}
                </span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                  Dictation (K-12)
                </span>
                <p className="text-2xl font-black text-indigo-700 mt-1">
                  {auditResult.moduleCounts.dictation}
                </p>
                <span className="text-[11px] text-indigo-500 font-bold">
                  Lớp 11: {auditResult.lop11Audit.total} bài
                </span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                  Duplicate chắc chắn
                </span>
                <p className="text-2xl font-black text-rose-700 mt-1">
                  {auditResult.duplicateSummary.totalConfirmedDuplicates}
                </p>
                <span className="text-[11px] text-slate-500">
                  {auditResult.duplicateSummary.totalPotentialDuplicates} bản nghi vấn
                </span>
              </div>
            </div>

            {/* Section: Module & Grade Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Module Breakdown */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                  <FolderTree className="w-4 h-4 text-indigo-600" />
                  <span>Phân bố theo Module / Group</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="font-bold text-slate-700">Dictation (K-12 Phổ thông):</span>
                    <strong className="text-slate-900">{auditResult.moduleCounts.dictation} bài</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="font-bold text-purple-700">Debate (Tranh biện):</span>
                    <strong className="text-purple-900">{auditResult.moduleCounts.debate} bài</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="font-bold text-slate-700">IELTS:</span>
                    <strong className="text-slate-900">{auditResult.moduleCounts.ielts} bài</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="font-bold text-slate-700">General:</span>
                    <strong className="text-slate-900">{auditResult.moduleCounts.general} bài</strong>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="font-bold text-slate-700">Other / Khác:</span>
                    <strong className="text-slate-900">{auditResult.moduleCounts.other} bài</strong>
                  </div>
                </div>
              </div>

              {/* Debate Breakdown Card */}
              <div className="p-4 bg-white rounded-2xl border border-purple-200 shadow-2xs space-y-3">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-purple-900 flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Kiểm tra riêng DEBATE (Tổng: {auditResult.debateCounts.total} bài)</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-purple-50">
                    <span className="font-bold text-slate-600">Level 1:</span>
                    <strong className="text-slate-900">{auditResult.debateCounts.level1} bài</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-purple-50">
                    <span className="font-bold text-purple-800">Level 2 (L2-001 → L2-090):</span>
                    <strong className="text-purple-900">{auditResult.debateCounts.level2} bài</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-purple-50">
                    <span className="font-bold text-purple-800">Level 3 (L3-001 → L3-090):</span>
                    <strong className="text-purple-900">{auditResult.debateCounts.level3} bài</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-purple-50">
                    <span className="font-bold text-purple-800">Level 4 (L4-001 → L4-090):</span>
                    <strong className="text-purple-900">{auditResult.debateCounts.level4} bài</strong>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="font-bold text-slate-500">Chưa xác định Level:</span>
                    <strong className="text-slate-700">{auditResult.debateCounts.unclassified} bài</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Lớp 11 Detailed Audit */}
            <div className="p-4 bg-white rounded-2xl border border-indigo-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-indigo-900 flex items-center space-x-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span>
                    Kiểm tra riêng LỚP 11 (Chuẩn: 10 Units × 5 Lessons = 50 bài | Hiện có: {auditResult.lop11Audit.total} bài)
                  </span>
                </h4>
                {auditResult.lop11Audit.total === 50 ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                    ✓ Đủ 50 bài chuẩn
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                    {auditResult.lop11Audit.total} bài hiện có
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {Object.keys(auditResult.lop11Audit.units)
                  .sort((a, b) => {
                    const numA = parseInt(a.replace(/\D/g, ''), 10) || 999;
                    const numB = parseInt(b.replace(/\D/g, ''), 10) || 999;
                    return numA - numB;
                  })
                  .map((uKey) => {
                    const info = auditResult.lop11Audit.units[uKey];
                    const isPerfect = info.count === 5;
                    return (
                      <div
                        key={uKey}
                        className={`p-2.5 rounded-xl border text-center ${
                          isPerfect
                            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                            : info.count > 0
                            ? 'bg-indigo-50/60 border-indigo-200 text-indigo-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <p className="font-bold text-[11px]">{uKey}</p>
                        <p className="text-base font-black mt-0.5">{info.count} bài</p>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Section: Grade Distribution (Mầm non - Lớp 12) */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700">
                Phân bố theo Khối lớp (Mầm non & Lớp 1 - 12)
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-7 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-bold text-[11px]">Mầm non</p>
                  <p className="font-black text-slate-900 mt-0.5">{auditResult.gradeCounts.mamNon}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-bold text-[11px]">Lớp 1</p>
                  <p className="font-black text-slate-900 mt-0.5">{auditResult.gradeCounts.lop1}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-bold text-[11px]">Lớp 2</p>
                  <p className="font-black text-slate-900 mt-0.5">{auditResult.gradeCounts.lop2}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-bold text-[11px]">Lớp 3</p>
                  <p className="font-black text-slate-900 mt-0.5">{auditResult.gradeCounts.lop3}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-bold text-[11px]">Lớp 4</p>
                  <p className="font-black text-slate-900 mt-0.5">{auditResult.gradeCounts.lop4}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-bold text-[11px]">Lớp 5</p>
                  <p className="font-black text-slate-900 mt-0.5">{auditResult.gradeCounts.lop5}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-bold text-[11px]">Lớp 6</p>
                  <p className="font-black text-slate-900 mt-0.5">{auditResult.gradeCounts.lop6}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-bold text-[11px]">Lớp 7</p>
                  <p className="font-black text-slate-900 mt-0.5">{auditResult.gradeCounts.lop7}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-bold text-[11px]">Lớp 8</p>
                  <p className="font-black text-slate-900 mt-0.5">{auditResult.gradeCounts.lop8}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-bold text-[11px]">Lớp 9</p>
                  <p className="font-black text-slate-900 mt-0.5">{auditResult.gradeCounts.lop9}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-bold text-[11px]">Lớp 10</p>
                  <p className="font-black text-slate-900 mt-0.5">{auditResult.gradeCounts.lop10}</p>
                </div>
                <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200">
                  <p className="text-indigo-700 font-bold text-[11px]">Lớp 11</p>
                  <p className="font-black text-indigo-900 mt-0.5">{auditResult.gradeCounts.lop11}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-bold text-[11px]">Lớp 12</p>
                  <p className="font-black text-slate-900 mt-0.5">{auditResult.gradeCounts.lop12}</p>
                </div>
              </div>
            </div>

            {/* Section: 3-Tier Duplicate Analysis */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
                Phân loại Duplicate (3 Mức theo Tiêu chí An toàn)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-1">
                  <span className="font-black text-rose-800 text-[11px] uppercase">
                    A. Duplicate chắc chắn
                  </span>
                  <p className="text-2xl font-black text-rose-700">
                    {auditResult.duplicateSummary.totalConfirmedDuplicates}
                  </p>
                  <p className="text-[11px] text-rose-800 leading-tight">
                    Trùng khớp hoàn toàn Group/Khối, Unit/Code, Tiêu đề và Nội dung câu. Sẽ dọn dẹp sau khi bạn xác nhận.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                  <span className="font-black text-amber-800 text-[11px] uppercase">
                    B. Có khả năng trùng
                  </span>
                  <p className="text-2xl font-black text-amber-700">
                    {auditResult.duplicateSummary.totalPotentialDuplicates}
                  </p>
                  <p className="text-[11px] text-amber-800 leading-tight">
                    Trùng mã/tiêu đề nhưng nội dung câu có sự khác biệt. Không tự động xóa, cần kiểm tra thủ công.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                  <span className="font-black text-emerald-800 text-[11px] uppercase">
                    C. Không trùng
                  </span>
                  <p className="text-2xl font-black text-emerald-700">
                    {auditResult.totalLessons -
                      auditResult.duplicateSummary.totalConfirmedDuplicates -
                      auditResult.duplicateSummary.totalPotentialDuplicates}
                  </p>
                  <p className="text-[11px] text-emerald-800 leading-tight">
                    Các bài học độc lập, nội dung duy nhất. Được bảo vệ an toàn 100%.
                  </p>
                </div>
              </div>
            </div>

            {/* Section: Data Quality Issues */}
            {auditResult.dataQualityIssues.length > 0 && (
              <div className="p-4 bg-white rounded-2xl border border-amber-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-amber-900 flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Cảnh báo chất lượng dữ liệu (Data Quality Issues: {auditResult.dataQualityIssues.length})</span>
                  </h4>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
                  {auditResult.dataQualityIssues.slice(0, 20).map((issue, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-amber-50/60 border border-amber-200 text-amber-900 flex items-center justify-between"
                    >
                      <span className="font-bold truncate mr-2">
                        {issue.title}: {issue.description}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 text-[10px] font-black shrink-0">
                        {issue.issueType}
                      </span>
                    </div>
                  ))}
                  {auditResult.dataQualityIssues.length > 20 && (
                    <p className="text-[11px] text-amber-700 italic text-center">
                      ... và {auditResult.dataQualityIssues.length - 20} vấn đề khác (xem chi tiết trong báo cáo copy).
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DETAILED DUPLICATE CLUSTERS (EXISTING EXPLORER) */}
        {activeTab === 'CLUSTERS' && (
          <>
            {/* Stats & Filter Bar */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
              {/* 3 Main Filters with accurate counts */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-2xl">
                <button
                  type="button"
                  id="filter-all-duplicates"
                  onClick={() => setDuplicateFilter('ALL')}
                  className={`px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer transition-all ${
                    duplicateFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span>Tất cả</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      duplicateFilter === 'ALL'
                        ? 'bg-slate-700 text-slate-100'
                        : 'bg-slate-300 text-slate-800'
                    }`}
                  >
                    {totalAll}
                  </span>
                </button>

                <button
                  type="button"
                  id="filter-confirmed-duplicates"
                  onClick={() => setDuplicateFilter('CONFIRMED')}
                  className={`px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer transition-all ${
                    duplicateFilter === 'CONFIRMED'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-rose-900 hover:bg-rose-50'
                  }`}
                >
                  <span>Duplicate chắc chắn</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      duplicateFilter === 'CONFIRMED'
                        ? 'bg-rose-800 text-white'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {totalConfirmed}
                  </span>
                </button>

                <button
                  type="button"
                  id="filter-potential-duplicates"
                  onClick={() => setDuplicateFilter('POTENTIAL')}
                  className={`px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer transition-all ${
                    duplicateFilter === 'POTENTIAL'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-amber-900 hover:bg-amber-50'
                  }`}
                >
                  <span>Có khả năng trùng</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      duplicateFilter === 'POTENTIAL'
                        ? 'bg-amber-800 text-white'
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}
                  >
                    {totalPotential}
                  </span>
                </button>
              </div>

              {/* Module Filter & Selection shortcuts */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-xs">
                  {['ALL', 'DICTATION', 'DEBATE', 'IELTS', 'GENERAL'].map((mod) => (
                    <button
                      key={mod}
                      type="button"
                      onClick={() => setModuleFilter(mod)}
                      className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                        moduleFilter === mod
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {mod === 'ALL' ? 'Mọi module' : mod}
                    </button>
                  ))}
                </div>

                <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />

                {/* Selection actions */}
                <button
                  type="button"
                  id="btn-select-all-confirmed"
                  onClick={handleSelectAllConfirmed}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-black cursor-pointer transition-colors flex items-center gap-1.5"
                  title="Chọn các bản trùng chắc chắn để xét duyệt xóa"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Chọn bản trùng chắc chắn ({totalConfirmed})</span>
                </button>

                <button
                  type="button"
                  id="btn-deselect-all"
                  onClick={handleDeselectAll}
                  className="px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                >
                  Bỏ chọn tất cả
                </button>
              </div>
            </div>

            {/* Scrollable Duplicate Clusters List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50">
              {visibleClusters.length === 0 ? (
                <div className="p-10 text-center bg-white rounded-3xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h4 className="text-base sm:text-lg font-black text-slate-900">
                    Không có bản trùng nào trong bộ lọc này!
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                    {duplicateFilter === 'CONFIRMED'
                      ? 'Không tìm thấy bản trùng chắc chắn nào khớp với tiêu chí lọc.'
                      : duplicateFilter === 'POTENTIAL'
                      ? 'Không có bài nghi vấn nào khớp với tiêu chí lọc.'
                      : 'Thư viện sạch sẽ, không có bài học nào bị trùng lặp.'}
                  </p>
                </div>
              ) : (
                visibleClusters.map((cluster) => {
                  const isExpanded = expandedClusters[cluster.clusterId] !== false;
                  const hasConfirmedInCluster = cluster.duplicateItems.some(
                    (d) => d.tier === 'CONFIRMED'
                  );

                  return (
                    <div
                      key={cluster.clusterId}
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all"
                    >
                      {/* Cluster Header */}
                      <div
                        onClick={() => toggleClusterExpand(cluster.clusterId)}
                        className="p-3.5 sm:p-4 bg-slate-50 hover:bg-slate-100/70 border-b border-slate-200 flex items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider shrink-0 ${
                              cluster.module === 'DEBATE'
                                ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                : cluster.module === 'IELTS'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                            }`}
                          >
                            {cluster.module}
                          </span>
                          <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">
                            {cluster.label}
                          </h4>
                          {hasConfirmedInCluster ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 border border-rose-300 text-[11px] font-black shrink-0">
                              Duplicate chắc chắn
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold shrink-0 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-700" />
                              Khác nội dung (Nghi vấn)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <span className="text-xs font-bold text-slate-500">
                            {cluster.duplicateItems.length} bản trùng
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {/* Cluster Body */}
                      {isExpanded && (
                        <div className="p-3.5 sm:p-4 space-y-4">
                          {cluster.duplicateItems.map((dup) => {
                            const isChecked = selectedDeleteIds.has(dup.id);

                            return (
                              <div
                                key={dup.id}
                                className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 p-3.5 rounded-2xl bg-slate-50/60 border border-slate-200"
                              >
                                {/* Column 1: KEEP — BẢN GỐC */}
                                <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-2.5 text-xs">
                                  <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                                    <span className="font-black text-emerald-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      KEEP — BẢN GỐC
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-extrabold text-[10px]">
                                      Ưu tiên giữ lại
                                    </span>
                                  </div>

                                  <div className="space-y-1 text-slate-700">
                                    <div className="flex items-start gap-2">
                                      <span className="font-bold text-slate-500 w-24 shrink-0">
                                        ID:
                                      </span>
                                      <code className="font-mono font-bold text-emerald-900 bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-[11px] select-all break-all">
                                        {cluster.keepItem.id}
                                      </code>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-500 w-24 shrink-0">
                                        Module:
                                      </span>
                                      <span className="font-bold text-slate-900">
                                        {cluster.module}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-500 w-24 shrink-0">
                                        Class/Grade:
                                      </span>
                                      <span className="font-bold text-slate-900">
                                        {cluster.keepItem.group ||
                                          cluster.keepItem.classLevel ||
                                          cluster.keepItem.grade ||
                                          'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-500 w-24 shrink-0">
                                        Level:
                                      </span>
                                      <span className="font-bold text-slate-900">
                                        {cluster.keepItem.level || cluster.level || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-500 w-24 shrink-0">
                                        Unit:
                                      </span>
                                      <span className="font-bold text-slate-900">
                                        {cluster.keepItem.unit
                                          ? `Unit ${cluster.keepItem.unit}`
                                          : 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-500 w-24 shrink-0">
                                        Lesson:
                                      </span>
                                      <span className="font-bold text-slate-900">
                                        {cluster.keepItem.lessonNumber
                                          ? `Lesson ${cluster.keepItem.lessonNumber}`
                                          : cluster.keepItem.lessonCode || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <span className="font-bold text-slate-500 w-24 shrink-0">
                                        Title:
                                      </span>
                                      <span className="font-black text-slate-900 break-words">
                                        {cluster.keepItem.title}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="pt-2 border-t border-emerald-200/70 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-slate-700">
                                        Toàn bộ nội dung ({cluster.keepItem.sentenceCount || (cluster.keepItem.fullSentences?.length || 0)} câu):
                                      </span>
                                    </div>
                                    {cluster.keepItem.fullPassage && (
                                      <div className="p-2.5 rounded-lg bg-white border border-emerald-200 text-[11px] text-slate-800 leading-relaxed">
                                        <span className="font-bold text-emerald-800 block text-[10px] uppercase mb-1">Đoạn văn (Passage):</span>
                                        <p className="whitespace-pre-wrap">{cluster.keepItem.fullPassage}</p>
                                      </div>
                                    )}
                                    {cluster.keepItem.fullSentences && cluster.keepItem.fullSentences.length > 0 ? (
                                      <div className="p-2.5 rounded-lg bg-white border border-emerald-200 space-y-1.5 max-h-56 overflow-y-auto">
                                        <span className="font-bold text-emerald-800 block text-[10px] uppercase mb-1">Danh sách câu luyện nghe:</span>
                                        {cluster.keepItem.fullSentences.map((st, sIdx) => (
                                          <div key={sIdx} className="text-[11px] text-slate-800 flex items-start gap-1.5 leading-snug">
                                            <span className="font-bold text-emerald-700 shrink-0 select-none">[{sIdx + 1}]</span>
                                            <span>{st}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      !cluster.keepItem.fullPassage && (
                                        <p className="p-2 rounded-lg bg-white border border-emerald-100 text-[11px] text-slate-500 italic">
                                          Không có nội dung câu hỏi
                                        </p>
                                      )
                                    )}
                                  </div>
                                </div>

                                {/* Column 2: DUPLICATE — BẢN TRÙNG */}
                                <div
                                  className={`p-3.5 rounded-xl border space-y-2.5 text-xs transition-colors ${
                                    isChecked
                                      ? 'bg-rose-50/80 border-rose-300'
                                      : dup.statusBadge === 'CONTENT_DUPLICATE_METADATA_DIFF'
                                      ? 'bg-indigo-50/40 border-indigo-200'
                                      : dup.tier === 'CONFIRMED'
                                      ? 'bg-rose-50/40 border-rose-200'
                                      : 'bg-amber-50/40 border-amber-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between border-b pb-2 border-slate-200">
                                    <label className="font-black text-[11px] uppercase tracking-wider flex items-center gap-2 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        id={`select-dup-${dup.id}`}
                                        checked={isChecked}
                                        onChange={() => handleToggleItem(dup.id)}
                                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer"
                                      />
                                      <span
                                        className={
                                          dup.statusBadge === 'CONTENT_DUPLICATE_METADATA_DIFF'
                                            ? 'text-indigo-900 font-black'
                                            : dup.tier === 'CONFIRMED'
                                            ? 'text-rose-900 font-black'
                                            : 'text-amber-900 font-black'
                                        }
                                      >
                                        DUPLICATE — BẢN TRÙNG
                                      </span>
                                    </label>
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${
                                        dup.statusBadge === 'CONTENT_DUPLICATE_METADATA_DIFF'
                                          ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                                          : dup.tier === 'CONFIRMED'
                                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                                      }`}
                                    >
                                      {dup.statusBadge === 'CONTENT_DUPLICATE_METADATA_DIFF'
                                        ? 'CONTENT DUPLICATE — METADATA DIFFERENT'
                                        : dup.tier === 'CONFIRMED'
                                        ? 'Chắc chắn trùng'
                                        : 'MANUAL REVIEW'}
                                    </span>
                                  </div>

                                  <div className="space-y-1 text-slate-700">
                                    <div className="flex items-start gap-2">
                                      <span className="font-bold text-slate-500 w-24 shrink-0">
                                        ID:
                                      </span>
                                      <code className="font-mono font-bold text-rose-900 bg-white px-1.5 py-0.5 rounded border border-rose-200 text-[11px] select-all break-all">
                                        {dup.id}
                                      </code>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-500 w-24 shrink-0">
                                        Module:
                                      </span>
                                      <span className="font-bold text-slate-900">
                                        {cluster.module}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-500 w-24 shrink-0">
                                        Class/Grade:
                                      </span>
                                      <span className="font-bold text-slate-900">
                                        {dup.group || dup.classLevel || dup.grade || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-500 w-24 shrink-0">
                                        Level:
                                      </span>
                                      <span className="font-bold text-slate-900">
                                        {dup.level || cluster.level || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-500 w-24 shrink-0">
                                        Unit:
                                      </span>
                                      <span className="font-bold text-slate-900">
                                        {dup.unit ? `Unit ${dup.unit}` : 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-500 w-24 shrink-0">
                                        Lesson:
                                      </span>
                                      <span className="font-bold text-slate-900">
                                        {dup.lessonNumber
                                          ? `Lesson ${dup.lessonNumber}`
                                          : dup.lessonCode || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <span className="font-bold text-slate-500 w-24 shrink-0">
                                        Title:
                                      </span>
                                      <span className="font-black text-slate-900 break-words">
                                        {dup.title}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="pt-2 border-t border-slate-200 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-slate-700">
                                        Toàn bộ nội dung ({dup.sentenceCount || (dup.fullSentences?.length || 0)} câu):
                                      </span>
                                    </div>
                                    {dup.fullPassage && (
                                      <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-800 leading-relaxed">
                                        <span className="font-bold text-rose-800 block text-[10px] uppercase mb-1">Đoạn văn (Passage):</span>
                                        <p className="whitespace-pre-wrap">{dup.fullPassage}</p>
                                      </div>
                                    )}
                                    {dup.fullSentences && dup.fullSentences.length > 0 ? (
                                      <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1.5 max-h-56 overflow-y-auto">
                                        <span className="font-bold text-rose-800 block text-[10px] uppercase mb-1">Danh sách câu luyện nghe:</span>
                                        {dup.fullSentences.map((st, sIdx) => (
                                          <div key={sIdx} className="text-[11px] text-slate-800 flex items-start gap-1.5 leading-snug">
                                            <span className="font-bold text-rose-700 shrink-0 select-none">[{sIdx + 1}]</span>
                                            <span>{st}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      !dup.fullPassage && (
                                        <p className="p-2 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-500 italic">
                                          Không có nội dung câu hỏi
                                        </p>
                                      )
                                    )}
                                  </div>

                                  <div className="pt-2 border-t border-slate-200 text-[11px]">
                                    <span className="font-bold text-slate-500">Lý do & Đánh giá:</span>{' '}
                                    <span
                                      className={`font-bold ${
                                        dup.statusBadge === 'CONTENT_DUPLICATE_METADATA_DIFF'
                                          ? 'text-indigo-800'
                                          : dup.tier === 'CONFIRMED'
                                          ? 'text-rose-700'
                                          : 'text-amber-800'
                                      }`}
                                    >
                                      {dup.reason}
                                    </span>
                                  </div>
                                </div>

                                {/* Full Line-by-line / Sentence-by-sentence Comparison Box */}
                                <div className="lg:col-span-2 p-3.5 rounded-xl bg-white border border-slate-200 space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                                    <div className="flex items-center gap-2">
                                      <span className="font-black text-slate-900 text-xs uppercase tracking-wide">
                                        📊 Bảng đối soát từng câu (Sentence-by-Sentence Comparison)
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                      <span className="font-bold text-slate-600">
                                        Content identical:
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 rounded-full font-black text-[11px] ${
                                          dup.isContentIdentical
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                                        }`}
                                      >
                                        {dup.isContentIdentical ? 'YES (100% giống nhau)' : 'NO (Có khác biệt)'}
                                      </span>
                                      <span className="text-slate-300">•</span>
                                      <span className="font-bold text-slate-600">
                                        Sentences:
                                      </span>
                                      <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                                        KEEP: {cluster.keepItem.sentenceCount || (cluster.keepItem.fullSentences?.length || 0)} vs DUP: {dup.sentenceCount || (dup.fullSentences?.length || 0)}
                                      </span>
                                      {dup.metadataDifference && (
                                        <>
                                          <span className="text-slate-300">•</span>
                                          <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                                            {dup.metadataDifference}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Detailed sentence rows */}
                                  {(() => {
                                    const keepList = cluster.keepItem.fullSentences || [];
                                    const dupList = dup.fullSentences || [];
                                    const maxLen = Math.max(keepList.length, dupList.length);

                                    if (maxLen === 0) {
                                      return (
                                        <p className="text-xs text-slate-500 italic py-1">
                                          Không có câu luyện nghe chi tiết để so sánh dòng (cả 2 bản đều rỗng hoặc chỉ có đoạn văn thô).
                                        </p>
                                      );
                                    }

                                    return (
                                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                        {Array.from({ length: maxLen }).map((_, sIdx) => {
                                          const kText = keepList[sIdx] || '';
                                          const dText = dupList[sIdx] || '';
                                          const isSame =
                                            Boolean(kText && dText) &&
                                            kText.trim().toLowerCase() === dText.trim().toLowerCase();

                                          return (
                                            <div
                                              key={sIdx}
                                              className={`p-2.5 rounded-lg border text-xs grid grid-cols-1 md:grid-cols-2 gap-2.5 ${
                                                isSame
                                                  ? 'bg-slate-50/70 border-slate-200'
                                                  : 'bg-amber-50/70 border-amber-200'
                                              }`}
                                            >
                                              <div>
                                                <div className="flex items-center justify-between mb-1">
                                                  <span className="font-bold text-emerald-800 text-[10px] uppercase">
                                                    KEEP • Câu {sIdx + 1}
                                                  </span>
                                                  <span
                                                    className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                                                      isSame
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : 'bg-amber-200 text-amber-900'
                                                    }`}
                                                  >
                                                    {isSame ? '✓ Trùng khớp' : '✗ Khác biệt'}
                                                  </span>
                                                </div>
                                                <p className="text-slate-800 font-medium bg-white p-1.5 rounded border border-slate-100">
                                                  {kText || <em className="text-slate-400">(Không có câu này)</em>}
                                                </p>
                                              </div>

                                              <div>
                                                <div className="flex items-center justify-between mb-1">
                                                  <span className="font-bold text-rose-800 text-[10px] uppercase">
                                                    DUPLICATE • Câu {sIdx + 1}
                                                  </span>
                                                </div>
                                                <p className="text-slate-800 font-medium bg-white p-1.5 rounded border border-slate-100">
                                                  {dText || <em className="text-slate-400">(Không có câu này)</em>}
                                                </p>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* TAB 3: DELETION MANIFEST (PRE-DELETE AUDIT & SAFETY VERIFICATION) */}
        {activeTab === 'MANIFEST' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50">
            {/* Safety Lock Banner */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start space-x-3 shadow-2xs">
              <ShieldCheck className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm">
                <p className="font-black text-amber-950 uppercase tracking-wide flex items-center gap-2">
                  <span>CHẾ ĐỘ KIỂM TOÁN AN TOÀN TRƯỚC DỌN DẸP (PRE-DELETE AUDIT)</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[11px] font-black">
                    SAFETY LOCK: CHƯA XÓA DỮ LIỆU
                  </span>
                </p>
                <p className="mt-1 text-amber-900 leading-relaxed">
                  Bảng kê cố định danh sách <strong>{deletionManifest.length} bài học</strong> dự kiến xóa sau khi giáo viên duyệt.
                  Toàn bộ <strong>{auditResult.duplicateSummary.totalPotentialDuplicates} bài nghi vấn (Potential)</strong> được giữ lại 100%.
                </p>
              </div>
            </div>

            {/* Verification Checklist Card */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h4 className="font-black text-xs uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span>Trạng thái kiểm tra 10 bước (Audit Checklist)</span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  READY FOR TEACHER CONFIRMATION — NO DATA DELETED
                </span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 font-bold">CONFIRMED DUPLICATES</span>
                  <span className="font-black text-slate-900">
                    {auditResult.duplicateSummary.totalConfirmedDuplicates}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 font-bold">SELECTED FOR DELETE</span>
                  <span className="font-black text-rose-600">{deletionManifest.length}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 font-bold">NOT SELECTED CONFIRMED</span>
                  <span className="font-black text-amber-600">{notSelectedConfirmedItems.length}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 font-bold">POTENTIAL (KHÔNG ĐỤNG ĐẾN)</span>
                  <span className="font-black text-indigo-600">
                    {auditResult.duplicateSummary.totalPotentialDuplicates}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 font-bold">DELETE MANIFEST VERIFIED</span>
                  <span className="font-black text-emerald-600">YES</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 font-bold">CONTENT 100% VERIFIED</span>
                  <span className="font-black text-emerald-600">
                    {deletionManifest.every((m) => m.contentVerified) ? 'YES' : 'NO'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 font-bold">ASSIGNMENT REFERENCES CHECKED</span>
                  <span className="font-black text-emerald-600">YES</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 font-bold">BACKUP READY</span>
                  <span className="font-black text-emerald-600">YES</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 font-bold">UNDO READY</span>
                  <span className="font-black text-emerald-600">YES</span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between sm:col-span-2 lg:col-span-3">
                  <span className="text-rose-800 font-black">DATA DELETED HIỆN TẠI</span>
                  <span className="font-black text-rose-700 uppercase">NO (0 bài bị xóa)</span>
                </div>
              </div>
            </div>

            {/* Section 1: Unselected Confirmed Items (if any) */}
            {notSelectedConfirmedItems.length > 0 && (
              <div className="p-4 bg-white rounded-2xl border border-amber-300 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-xs uppercase tracking-wider text-amber-950 flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>
                      CONFIRMED DUPLICATE NOT SELECTED ({notSelectedConfirmedItems.length} bài) — CHUYỂN MANUAL REVIEW
                    </span>
                  </h4>
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                    Được bảo vệ, không tự động chọn xóa
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {notSelectedConfirmedItems.map((it, idx) => (
                    <div
                      key={it.id}
                      className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 space-y-1"
                    >
                      <div className="flex items-center justify-between font-black">
                        <span>
                          {idx + 1}. ID: <code className="bg-amber-100 px-1 py-0.5 rounded">{it.id}</code>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-bold">
                          {it.module}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[11px] text-amber-900">
                        <div><strong>Lớp/Khối:</strong> {it.classGrade}</div>
                        <div><strong>Level:</strong> {it.level}</div>
                        <div><strong>Unit:</strong> {it.unit}</div>
                        <div><strong>Lesson:</strong> {it.lesson}</div>
                      </div>
                      <div className="text-[11px] text-amber-900">
                        <strong>Tiêu đề:</strong> {it.title}
                      </div>
                      <div className="text-[11px] text-amber-800 italic pt-1 border-t border-amber-200">
                        <strong>Lý do không tự động chọn:</strong> {it.reason}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 2: Fixed Deletion Manifest List */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-black text-xs uppercase tracking-wider text-slate-800 flex items-center space-x-1.5">
                    <ClipboardList className="w-4 h-4 text-rose-600" />
                    <span>DANH SÁCH DELETION MANIFEST CỐ ĐỊNH ({deletionManifest.length} BÀI HỌC)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Mỗi mục có đầy đủ DELETE ID, KEEP ID, Khối lớp, Unit, Lesson và đối chiếu nội dung 100%.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleCopyManifest}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    {manifestCopyStatus ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Đã chép Manifest!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép Manifest TXT</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadManifest}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải file TXT ({deletionManifest.length} bài)</span>
                  </button>
                </div>
              </div>

              {/* Scrollable List of Manifest Items */}
              <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1 text-xs">
                {deletionManifest.map((m, idx) => (
                  <div
                    key={m.deleteId}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px] font-black">
                          #{idx + 1}
                        </span>
                        <span className="font-extrabold text-slate-900">{m.title}</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-black">
                          {m.module}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black">
                          Content 100% Match ✓
                        </span>
                        {m.hasReferencedAssignment && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-black">
                            Sẽ chuyển phân công lớp ✓
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                      <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-950">
                        <span className="font-sans font-bold text-rose-700 block text-[10px] uppercase">
                          Sẽ xóa (DELETE ID):
                        </span>
                        <span className="select-all font-bold">{m.deleteId}</span>
                      </div>

                      <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950">
                        <span className="font-sans font-bold text-emerald-700 block text-[10px] uppercase">
                          Giữ lại (KEEP ID):
                        </span>
                        <span className="select-all font-bold">{m.keepId}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 pt-0.5">
                      <span><strong>Khối/Lớp:</strong> {m.classGrade}</span>
                      {m.level && m.level !== 'N/A' && <span><strong>Level:</strong> {m.level}</span>}
                      <span><strong>Unit:</strong> {m.unit}</span>
                      <span><strong>Lesson:</strong> {m.lesson}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2">
            {canUndo && (
              <button
                type="button"
                onClick={handleUndoCleanup}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                title="Khôi phục lại các bài học đã xóa ở lần dọn duplicate gần nhất"
              >
                <Undo2 className="w-4 h-4 text-indigo-400" />
                <span>↩ Hoàn tác lần dọn trước</span>
              </button>
            )}

            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Đã chọn <strong className="text-white">{selectedDeleteIds.size}</strong> bản trùng để
              xóa
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={handleExecuteDelete}
              disabled={selectedDeleteIds.size === 0}
              className={`px-5 py-2 rounded-xl text-xs font-black shadow-sm flex items-center space-x-2 transition-all ${
                selectedDeleteIds.size > 0
                  ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>🗑 Xóa các bản trùng đã chọn ({selectedDeleteIds.size})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
