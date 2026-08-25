import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  CheckCircle2,
  Copy,
  Check,
  QrCode as QrIcon,
  Headphones,
  X,
  Share2,
  Download,
  ArrowRight,
} from 'lucide-react';
import { DictationExercise } from '../types';
import { buildShareUrl } from '../utils/codec';

interface ShareModalProps {
  exercise: DictationExercise;
  onClose: () => void;
  onPreviewPractice: (exercise: DictationExercise) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  exercise,
  onClose,
  onPreviewPractice,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const shareUrl = buildShareUrl(exercise);

  // Generate QR Code locally
  useEffect(() => {
    QRCode.toDataURL(shareUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#1e1b4b',
        light: '#ffffff',
      },
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('QR generation error:', err);
      });
  }, [shareUrl]);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('textarea');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${exercise.title.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div id="share-modal-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div id="share-modal-card" className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <h3 className="font-extrabold text-emerald-900 text-lg">
              ✅ BÀI ĐÃ SẴN SÀNG
            </h3>
          </div>
          <button
            id="btn-close-share-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-emerald-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Title & Info */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left">
            <h4 className="text-base font-extrabold text-slate-900 mb-1">
              {exercise.title}
            </h4>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="bg-white px-2 py-1 rounded-md border border-slate-200 font-semibold">
                📝 {exercise.sentences.length} câu
              </span>
              <span className="bg-white px-2 py-1 rounded-md border border-slate-200 font-semibold">
                🗣️ {exercise.voiceMode === 'NATURAL' ? '✨ Giọng Tự nhiên' : exercise.voiceMode === 'CUSTOM' ? `🎙️ ${exercise.preferredVoiceName || 'Tùy chỉnh'}` : `Giọng ${exercise.voiceAccent}`} ({exercise.playbackSpeed || 0.9}x)
              </span>
              <span className="bg-white px-2 py-1 rounded-md border border-slate-200 font-semibold">
                🎯 {exercise.checkMode === 'EASY' ? 'Chế độ Dễ' : 'Chính xác'}
              </span>
              <span className="bg-white px-2 py-1 rounded-md border border-slate-200 font-semibold">
                🔁 {exercise.listenLimit === 0 ? 'Nghe không giới hạn' : `Nghe tối đa ${exercise.listenLimit} lần`}
              </span>
            </div>
          </div>

          {/* Share Link Input with Copy */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
              Link bài tập (đã mã hóa dữ liệu vào link)
            </label>
            <div className="flex items-center space-x-2">
              <input
                id="input-share-url"
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2.5 text-xs bg-slate-100 border border-slate-300 rounded-xl text-slate-600 select-all font-mono truncate"
              />
              <button
                id="btn-copy-share-link"
                onClick={handleCopy}
                className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'ĐÃ CHÉP' : 'SAO CHÉP'}</span>
              </button>
            </div>
          </div>

          {/* QR Code Section */}
          {showQr && (
            <div id="qr-code-container" className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center space-y-3 animate-in fade-in">
              <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code bài tập" className="w-52 h-52 object-contain" />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center text-slate-400 text-xs">
                    Đang tạo mã QR...
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 text-center max-w-xs">
                Học sinh dùng camera điện thoại hoặc Zalo để quét và làm bài ngay lập tức
              </p>
              <button
                id="btn-download-qr"
                onClick={handleDownloadQr}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải ảnh mã QR</span>
              </button>
            </div>
          )}

          {/* Three Primary Required Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200">
            <button
              id="btn-share-copy"
              onClick={handleCopy}
              className="w-full min-h-[48px] py-3 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              <span>🔗 SAO CHÉP LINK</span>
            </button>

            <button
              id="btn-share-toggle-qr"
              onClick={() => setShowQr(!showQr)}
              className={`w-full min-h-[48px] py-3 px-3 rounded-xl border font-bold text-xs sm:text-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                showQr
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
              }`}
            >
              <QrIcon className="w-4 h-4 text-indigo-600" />
              <span>▦ {showQr ? 'ẨN QR' : 'HIỆN QR'}</span>
            </button>

            <button
              id="btn-share-preview"
              onClick={() => onPreviewPractice(exercise)}
              className="w-full min-h-[48px] py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Headphones className="w-4 h-4" />
              <span>🎧 XEM THỬ BÀI</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
