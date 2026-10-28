import React, { useState, useEffect } from 'react';
import {
  Package,
  Layers,
  Wifi,
  WifiOff,
  Database,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Folder,
  ShieldCheck,
  FileCode,
} from 'lucide-react';
import { AppSettings, KualPackageInfo, KualInstallResult } from '../types';

export interface KualInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageInfo: KualPackageInfo | null;
  settings: AppSettings;
  kindleConnected: boolean | null;
  onCheckConnection: () => Promise<void>;
  onInstall: (preserveDb: boolean) => Promise<KualInstallResult>;
}

export const KualInstallModal: React.FC<KualInstallModalProps> = ({
  isOpen,
  onClose,
  packageInfo,
  settings,
  kindleConnected,
  onCheckConnection,
  onInstall,
}) => {
  const [preserveDb, setPreserveDb] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<KualInstallResult | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  const [checkingConn, setCheckingConn] = useState(false);

  // Sync state when new package info arrives or modal opens
  useEffect(() => {
    if (isOpen && packageInfo) {
      setPreserveDb(packageInfo.has_database);
      setInstallResult(null);
      setInstallError(null);
      setInstalling(false);
    }
  }, [isOpen, packageInfo]);

  if (!isOpen || !packageInfo) return null;

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleInstall = async () => {
    if (installing) return;
    setInstalling(true);
    setInstallError(null);
    setInstallResult(null);
    try {
      const res = await onInstall(preserveDb);
      setInstallResult(res);
    } catch (err: any) {
      setInstallError(String(err));
    } finally {
      setInstalling(false);
    }
  };

  const handleRecheck = async () => {
    setCheckingConn(true);
    try {
      await onCheckConnection();
    } finally {
      setCheckingConn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-lg rounded-2xl bg-[#0c1512] border border-[#509475]/40 p-6 text-[#C1C497] font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#509475]/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#509475]/20 border border-[#509475]/30 flex items-center justify-center text-[#509475]">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#F7E8B2]">Cài Đặt KUAL Extension (.zip)</h2>
              <p className="text-[10px] text-[#53685B]">Không dây qua Wi-Fi SFTP/SSH sang Kindle PW3</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={installing}
            className="p-1 rounded-lg text-[#53685B] hover:text-[#C1C497] hover:bg-[#509475]/15 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* State 1: Success Screen */}
        {installResult ? (
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-xl bg-emerald-950/25 border border-emerald-500/30 text-emerald-300">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="font-semibold text-sm text-[#F7E8B2]">Cài đặt thành công 100%!</span>
              </div>
              <p className="text-xs text-[#C1C497] mb-3">{installResult.message}</p>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-emerald-500/20 text-[#81B8A8]">
                <div>
                  <span className="text-[#53685B]">Thời gian: </span>
                  <span className="text-[#F7E8B2]">{(installResult.duration_ms / 1000).toFixed(2)}s</span>
                </div>
                <div>
                  <span className="text-[#53685B]">Tệp giải nén: </span>
                  <span className="text-[#F7E8B2]">{installResult.files_extracted}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[#53685B]">Đích đến: </span>
                  <span className="text-[#F7E8B2]">{installResult.target_dir}</span>
                </div>
                {installResult.preserved_db && (
                  <div className="col-span-2 text-emerald-400 flex items-center gap-1.5 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Đã bảo toàn nguyên vẹn cơ sở dữ liệu SQLite cũ.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#111c18] border border-[#509475]/25 text-[11px] text-[#81B8A8]">
              💡 <span className="text-[#F7E8B2]">Khởi chạy:</span> Mở menu <strong className="text-emerald-400">KUAL</strong> trên Kindle PW3 để thấy extension mới và khởi chạy ngay lập tức.
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-[#509475] hover:bg-[#63b07a] text-[#0c1512] font-semibold transition-colors cursor-pointer"
              >
                Hoàn Tất & Đóng
              </button>
            </div>
          </div>
        ) : installError ? (
          /* State 2: Error Screen */
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-xl bg-rose-950/25 border border-rose-500/30 text-rose-300">
              <div className="flex items-center gap-2 mb-2 text-rose-400">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="font-semibold text-sm">Cài đặt không thành công</span>
              </div>
              <p className="text-xs break-all bg-black/40 p-2.5 rounded-lg border border-rose-500/20 text-rose-200 font-mono mb-3">
                {installError}
              </p>
              <div className="text-[11px] text-[#81B8A8] space-y-1">
                <div className="font-semibold text-[#F7E8B2]">Các bước kiểm tra nhanh:</div>
                <div>1. Đảm bảo màn hình Kindle luôn sáng (không bị khóa/ngủ).</div>
                <div>2. Đã kích hoạt SSH Server trong KOReader (Port {settings.kindle_port}).</div>
                <div>3. Máy tính và Kindle cùng kết nối chung một mạng Wi-Fi.</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[#509475]/30 text-[#81B8A8] hover:text-[#F7E8B2] hover:border-[#509475] transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={handleInstall}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#509475] hover:bg-[#63b07a] text-[#0c1512] font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử Lại</span>
              </button>
            </div>
          </div>
        ) : (
          /* State 3: Normal Preview & Configuration */
          <div className="mt-4 space-y-3.5">
            {/* Package Info Card */}
            <div className="p-3.5 rounded-xl bg-[#111c18] border border-[#509475]/25 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#F7E8B2]">{packageInfo.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#509475]/20 text-[#81B8A8] border border-[#509475]/30">
                    v{packageInfo.version}
                  </span>
                </div>
                <span className="text-[10px] text-[#53685B]">{formatBytes(packageInfo.total_size_bytes)}</span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#81B8A8]">
                <span>Tác giả: <strong className="text-[#C1C497] font-normal">{packageInfo.author}</strong></span>
                <span className="text-[10px] text-[#53685B]">{packageInfo.id}</span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-[#C1C497] bg-[#0c1512] px-2.5 py-1.5 rounded-lg border border-[#509475]/15">
                <Folder className="w-3.5 h-3.5 text-[#509475] shrink-0" />
                <span className="text-[#53685B]">Đích đến:</span>
                <span className="text-[#F7E8B2] font-semibold">/mnt/us/extensions/{packageInfo.folder_name}</span>
              </div>

              {packageInfo.description && (
                <p className="text-[11px] text-[#81B8A8] italic">{packageInfo.description}</p>
              )}

              {/* Badges */}
              <div className="flex items-center gap-2 pt-1 border-t border-[#509475]/15">
                {packageInfo.has_binary && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
                    <FileCode className="w-3 h-3" /> Binary E-Ink (bin/)
                  </span>
                )}
                {packageInfo.has_database && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-950/40 text-amber-400 border border-amber-500/30">
                    <Database className="w-3 h-3" /> SQLite Database (.db)
                  </span>
                )}
                <span className="text-[10px] text-[#53685B] ml-auto">{packageInfo.file_count} tệp</span>
              </div>
            </div>

            {/* Database Preservation Checkbox */}
            {packageInfo.has_database && (
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#111c18] border border-[#509475]/25 cursor-pointer hover:border-[#509475]/50 transition-colors">
                <input
                  type="checkbox"
                  checked={preserveDb}
                  onChange={(e) => setPreserveDb(e.target.checked)}
                  disabled={installing}
                  className="mt-0.5 accent-[#509475]"
                />
                <div>
                  <div className="font-semibold text-[#F7E8B2] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Bảo toàn cơ sở dữ liệu SQLite cũ</span>
                  </div>
                  <div className="text-[10px] text-[#81B8A8] mt-0.5 leading-relaxed">
                    Tự động sao lưu database hiện có trên Kindle sang <code className="text-[#F7E8B2]">/tmp</code> trước khi ghi đè, và khôi phục lại sau khi giải nén xong để giữ nguyên tiến độ.
                  </div>
                </div>
              </label>
            )}

            {/* Kindle Connection Status Bar */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#111c18] border border-[#509475]/20">
              <div className="flex items-center gap-2">
                {kindleConnected === true ? (
                  <Wifi className="w-4 h-4 text-emerald-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-rose-400" />
                )}
                <div>
                  <div className="text-[11px] font-semibold text-[#F7E8B2]">
                    Kindle: {settings.kindle_ip}:{settings.kindle_port} ({settings.kindle_user || 'root'})
                  </div>
                  <div className="text-[10px] text-[#53685B]">
                    {kindleConnected === true ? 'KOReader Đã kết nối' : 'KOReader Ngoại tuyến'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRecheck}
                disabled={checkingConn || installing}
                title="Kiểm tra lại kết nối"
                className="p-1 rounded-lg text-[#81B8A8] hover:text-[#F7E8B2] hover:bg-[#509475]/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingConn ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={installing}
                className="px-4 py-2 rounded-xl border border-[#509475]/30 text-[#81B8A8] hover:text-[#F7E8B2] hover:border-[#509475] transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleInstall}
                disabled={installing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#509475] hover:bg-[#63b07a] text-[#0c1512] font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {installing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang cài đặt sang Kindle...</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5" />
                    <span>Cài Đặt Vào Kindle</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
