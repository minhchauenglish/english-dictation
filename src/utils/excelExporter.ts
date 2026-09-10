import * as XLSX from 'xlsx';
import { HomeworkHistoryItem } from '../types';

/**
 * Formats ISO date string to DD/MM/YYYY for Excel export
 */
export function formatExportDate(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return isoString;
  }
}

/**
 * Formats ISO date string to HH:mm for Excel export
 */
export function formatExportTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '';
  }
}

/**
 * Formats exercise mode to Vietnamese label
 */
export function formatExerciseMode(mode?: string): string {
  if (mode === 'TEST') return 'Kiểm tra';
  return 'Luyện tập';
}

export interface ExportExcelResult {
  success: boolean;
  count: number;
  message?: string;
  workbook?: XLSX.WorkBook;
}

/**
 * Constructs a SheetJS Workbook from a list of HomeworkHistoryItem records.
 * Returns null if the list is empty.
 */
export function createHomeworkLinksWorkbook(
  historyItems: HomeworkHistoryItem[]
): XLSX.WorkBook | null {
  if (!historyItems || historyItems.length === 0) {
    return null;
  }

  // 1. Column headers as requested
  const header = [
    'Ngày giao',
    'Giờ giao',
    'Lớp',
    'Tên bài tập',
    'Chủ đề',
    'Chế độ',
    'Link bài tập',
  ];

  // 2. Each history item is exactly one row
  const rows = historyItems.map((item) => {
    const dateStr = formatExportDate(item.date);
    const timeStr = formatExportTime(item.date);
    const className = item.className || 'General';
    const title = item.exerciseTitle || '';
    const topic = item.topic || title;
    const mode = formatExerciseMode(item.exerciseMode);
    const link = item.generatedLink || '';

    return [dateStr, timeStr, className, title, topic, mode, link];
  });

  const wsData = [header, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  // 3. Set custom column widths for readability in Excel
  worksheet['!cols'] = [
    { wch: 14 }, // Ngày giao
    { wch: 10 }, // Giờ giao
    { wch: 14 }, // Lớp
    { wch: 32 }, // Tên bài tập
    { wch: 25 }, // Chủ đề
    { wch: 14 }, // Chế độ
    { wch: 65 }, // Link bài tập
  ];

  // 4. Configure clickable hyperlink for Link column while preserving plain text URL
  rows.forEach((row, idx) => {
    const cellRef = XLSX.utils.encode_cell({ r: idx + 1, c: 6 });
    const cell = worksheet[cellRef];
    const linkUrl = row[6];
    if (cell && linkUrl && typeof linkUrl === 'string' && linkUrl.startsWith('http')) {
      cell.l = { Target: linkUrl, Tooltip: linkUrl };
    }
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dictation Links');

  return workbook;
}

/**
 * Triggers download of the Excel file English_Dictation_Links.xlsx in the browser.
 * Returns ExportExcelResult with status and message.
 */
export function exportHomeworkLinksToExcel(
  historyItems: HomeworkHistoryItem[],
  fileName = 'English_Dictation_Links.xlsx'
): ExportExcelResult {
  if (!historyItems || historyItems.length === 0) {
    return {
      success: false,
      count: 0,
      message: 'Chưa có link bài tập nào để xuất.',
    };
  }

  const workbook = createHomeworkLinksWorkbook(historyItems);
  if (!workbook) {
    return {
      success: false,
      count: 0,
      message: 'Chưa có link bài tập nào để xuất.',
    };
  }

  // Trigger file download in browser
  try {
    XLSX.writeFile(workbook, fileName);
    return {
      success: true,
      count: historyItems.length,
      workbook,
    };
  } catch (error) {
    console.error('Failed to export Excel file:', error);
    return {
      success: false,
      count: 0,
      message: 'Không thể tạo file Excel, vui lòng thử lại.',
    };
  }
}
