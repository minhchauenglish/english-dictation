import React, { useState, useRef } from 'react';
import {
  X,
  FileText,
  UploadCloud,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileUp,
  HelpCircle,
  Copy,
  Check,
  ArrowRight,
  Layers,
  Download,
} from 'lucide-react';
import { ImportFileResult } from '../../types/import';
import { extractTextFromDocx, parseWordContent, FORMAT_ERROR_GUIDE_TEXT } from '../../utils/wordParser';
import { downloadWordTemplate, SAMPLE_WORD_DOCX_CONTENT } from '../../utils/templateDownloader';
import { ImportPreviewModal } from './ImportPreviewModal';

interface WordImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (count: number, classes: string[]) => void;
}

interface UploadedFileItem {
  file: File;
  id: string;
  status: 'PARSING' | 'SUCCESS' | 'ERROR';
  result?: ImportFileResult;
  errorMessage?: string;
}

export const WordImportModal: React.FC<WordImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [fileList, setFileList] = useState<UploadedFileItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showSampleGuide, setShowSampleGuide] = useState(false);
  const [copiedSample, setCopiedSample] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [step, setStep] = useState<'UPLOAD' | 'PREVIEW'>('UPLOAD');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Process incoming files
  const processFiles = async (files: FileList | File[]) => {
    setGlobalError(null);
    const newItems: UploadedFileItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Format validation: must be .docx
      const isDocx =
        file.name.toLowerCase().endsWith('.docx') ||
        file.type ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      if (!isDocx) {
        setGlobalError('Chỉ hỗ trợ file định dạng .docx (Microsoft Word).');
        continue;
      }

      const fileId = `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      newItems.push({
        file,
        id: fileId,
        status: 'PARSING',
      });
    }

    if (newItems.length === 0) return;

    // Append to list in PARSING state
    setFileList((prev) => [...prev, ...newItems]);

    // Parse each file asynchronously
    for (const item of newItems) {
      try {
        const rawText = await extractTextFromDocx(item.file);
        const result = parseWordContent(rawText, item.file.name, item.id);
        result.fileSize = item.file.size;

        setFileList((prev) =>
          prev.map((f) => {
            if (f.id !== item.id) return f;
            if (result.lessons.length === 0) {
              return {
                ...f,
                status: 'ERROR',
                result,
                errorMessage: FORMAT_ERROR_GUIDE_TEXT,
              };
            }
            return {
              ...f,
              status: 'SUCCESS',
              result,
            };
          })
        );
      } catch (err: unknown) {
        console.error('Word file parsing error:', err);
        setFileList((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'ERROR',
                  errorMessage:
                    'Không thể đọc nội dung file Word này. Vui lòng kiểm tra file và thử lại.',
                }
              : f
          )
        );
      }
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      // Reset input value so same file can be re-selected if needed
      e.target.value = '';
    }
  };

  // Remove a file from list
  const handleRemoveFile = (id: string) => {
    setFileList((prev) => prev.filter((f) => f.id !== id));
  };

  // Clear all files
  const handleClearAll = () => {
    setFileList([]);
    setGlobalError(null);
  };

  // Copy sample format
  const handleCopySample = () => {
    navigator.clipboard.writeText(SAMPLE_WORD_DOCX_CONTENT);
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  };

  // Download template docx file
  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      await downloadWordTemplate();
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  // Aggregates
  const totalLessonsFound = fileList.reduce(
    (acc, f) => acc + (f.result ? f.result.lessons.length : 0),
    0
  );
  const successfulFiles = fileList
    .filter((f) => f.status === 'SUCCESS' && f.result && f.result.lessons.length > 0)
    .map((f) => f.result as ImportFileResult);

  const isAnyParsing = fileList.some((f) => f.status === 'PARSING');

  // Handle transition to preview
  const handleProceedToPreview = () => {
    if (successfulFiles.length === 0) return;
    setStep('PREVIEW');
  };

  // If in Preview step, show ImportPreviewModal
  if (step === 'PREVIEW') {
    return (
      <ImportPreviewModal
        fileResults={successfulFiles}
        onBackToUpload={() => setStep('UPLOAD')}
        onClose={onClose}
        onImportComplete={(count, classes) => {
          onImportSuccess(count, classes);
          onClose();
        }}
      />
    );
  }

  return (
    <div
      id="modal-word-import"
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 md:p-6 overflow-y-auto"
    >
      <div className="bg-white w-full max-w-2xl lg:max-w-3xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 text-indigo-300 flex items-center justify-center shrink-0">
              <FileUp className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                Nhập bài học từ file Word (.docx)
              </h3>
              <p className="text-xs text-slate-300">
                Tự động tách nhiều bài, nhận diện Lesson / Unit / Bài, từ vựng và câu
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Global Error Banner */}
          {globalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{globalError}</span>
              </div>
              <button
                type="button"
                onClick={() => setGlobalError(null)}
                className="text-rose-400 hover:text-rose-700 font-black cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Drag and Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-3xl p-5 sm:p-8 text-center transition-all flex flex-col items-center justify-center ${
              isDragOver
                ? 'border-indigo-600 bg-indigo-50/60 scale-[0.99]'
                : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div className="w-14 h-14 rounded-2xl bg-indigo-100/70 text-indigo-600 flex items-center justify-center mb-3 shadow-inner">
              <UploadCloud className="w-7 h-7" />
            </div>

            <p className="font-extrabold text-slate-800 text-sm sm:text-base mb-1">
              Kéo & thả file Word (.docx) vào đây
            </p>
            <p className="text-xs text-slate-500 mb-4">hoặc bấm chọn file</p>

            {/* Action Buttons: Choose File & Download Template */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 w-full">
              <button
                id="btn-choose-word-files"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center space-x-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Chọn file từ máy tính</span>
              </button>

              <button
                id="btn-download-word-template"
                type="button"
                onClick={handleDownloadTemplate}
                disabled={isDownloadingTemplate}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-indigo-50/70 text-indigo-700 border border-indigo-200 hover:border-indigo-300 font-extrabold text-xs sm:text-sm shadow-2xs transition-all flex items-center space-x-2 cursor-pointer"
                title="Tải file mẫu chuẩn Microsoft Word .docx về máy"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                <span>📥 Download Word Template</span>
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-3">
              Định dạng hỗ trợ: <strong className="text-slate-600">.docx</strong> (hỗ trợ chọn nhiều file cùng lúc)
            </p>
          </div>

          {/* Uploaded Files List */}
          {fileList.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>
                    Danh sách file đã chọn ({fileList.length}) • Tổng: {totalLessonsFound} bài
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  Xóa tất cả
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {fileList.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white border border-slate-200 rounded-2xl text-xs shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 truncate">
                            {item.file.name}
                          </p>
                          <div className="flex items-center space-x-2 mt-0.5 text-slate-500">
                            <span>{(item.file.size / 1024).toFixed(1)} KB</span>

                            {item.status === 'PARSING' && (
                              <span className="text-indigo-600 flex items-center space-x-1 font-semibold">
                                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                                <span>Đang đọc file...</span>
                              </span>
                            )}

                            {item.status === 'SUCCESS' && item.result && (
                              <span className="text-emerald-700 font-bold flex items-center space-x-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>
                                  Tìm thấy {item.result.lessons.length} bài học
                                  {item.result.detectedClass && ` (Lớp ${item.result.detectedClass})`}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveFile(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Xóa file khỏi danh sách"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Format Error Box with Guidance and Action Buttons */}
                    {item.status === 'ERROR' && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 space-y-2">
                        <div className="flex items-center space-x-1.5 font-bold text-rose-800">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Không tìm thấy bài học trong file.</span>
                        </div>

                        <div className="text-2xs text-slate-700 bg-white/90 p-2.5 rounded-lg border border-rose-200/60 leading-relaxed font-mono whitespace-pre-line">
                          Vui lòng kiểm tra file Word có ít nhất cấu trúc:
                          {'\n'}LESSON: 1 (hoặc UNIT 1 / BÀI 1)
                          {'\n'}TITLE: Tên bài (hoặc viết ngay cạnh: LESSON 1: TÊN BÀI)
                          {'\n'}CONTENT:
                          {'\n'}Nội dung từ vựng hoặc câu
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setShowSampleGuide(true)}
                            className="text-2xs font-bold text-indigo-700 hover:text-indigo-900 underline flex items-center gap-1 cursor-pointer"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Xem hướng dẫn format (View Word Format Guide)</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleDownloadTemplate}
                            className="text-2xs font-extrabold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>📥 Tải file mẫu .docx</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample Format Guide Accordion */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between py-1">
              <button
                type="button"
                onClick={() => setShowSampleGuide(!showSampleGuide)}
                className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-indigo-500" />
                <span>Xem định dạng chuẩn của file Word hỗ trợ</span>
                <span className="text-indigo-600 ml-1">
                  {showSampleGuide ? '▲ Ẩn mẫu' : '▼ Xem mẫu'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>📥 Tải file mẫu</span>
              </button>
            </div>

            {showSampleGuide && (
              <div className="mt-2.5 p-3.5 bg-slate-900 rounded-2xl text-slate-300 text-xs font-mono relative">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <span className="text-slate-400 text-2xs uppercase tracking-wider font-sans font-bold">
                    Cấu trúc văn bản mẫu trong file Word:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopySample}
                      className="flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-2xs transition-colors cursor-pointer"
                    >
                      {copiedSample ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Đã chép!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Sao chép mẫu</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="flex items-center space-x-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-2xs transition-colors cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Tải .docx</span>
                    </button>
                  </div>
                </div>
                <pre className="max-h-48 overflow-y-auto text-2xs leading-relaxed text-indigo-200 whitespace-pre-wrap">
                  {SAMPLE_WORD_DOCX_CONTENT}
                </pre>
                <div className="mt-2 text-2xs text-slate-400 font-sans border-t border-slate-800 pt-2 space-y-1">
                  <div>
                    💡 Hỗ trợ các thẻ: <code>LESSON:</code>, <code>UNIT:</code>, <code>BÀI:</code>, <code>TITLE:</code>, <code>TYPE:</code> (WORDS, SENTENCES, PARAGRAPH, WORDS AND SENTENCES), <code>CONTENT:</code>, <code>WORDS:</code>, <code>SENTENCES:</code>
                  </div>
                  <div>
                    💡 Hỗ trợ viết tiêu đề cùng dòng: <code>LESSON 1: MY FAMILY</code> hoặc <code>BÀI 1 - GIA ĐÌNH</code>.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Bar */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium truncate">
            {totalLessonsFound > 0 ? (
              <span>
                Đã nhận diện <strong className="text-indigo-600">{totalLessonsFound} bài học</strong> sẵn sàng nhập.
              </span>
            ) : (
              <span>Chọn file .docx để bắt đầu.</span>
            )}
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              Hủy
            </button>

            <button
              id="btn-goto-preview"
              type="button"
              disabled={successfulFiles.length === 0 || isAnyParsing}
              onClick={handleProceedToPreview}
              className={`px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm text-white shadow-md transition-all flex items-center space-x-1.5 cursor-pointer ${
                successfulFiles.length === 0 || isAnyParsing
                  ? 'bg-indigo-300 cursor-not-allowed shadow-none'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
              }`}
            >
              <span>Xem trước ({totalLessonsFound} bài)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
