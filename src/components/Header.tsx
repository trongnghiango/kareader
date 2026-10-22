import React from 'react';
import { Monitor, Tablet, Edit3, Settings, RefreshCw, Upload, Download, BookOpen } from 'lucide-react';
import { AppSettings } from '../types';

interface HeaderProps {
  currentTab: 'editor' | 'local' | 'kindle' | 'reader';
  onTabChange: (tab: 'editor' | 'local' | 'kindle' | 'reader') => void;
  settings: AppSettings;
  kindleConnected: boolean | null;
  checkingConnection: boolean;
  syncing: boolean;
  readingBookTitle?: string | null;
  onSyncAll: () => void;
  onCheckConnection: () => void;
  onOpenSettings: () => void;
  onImportFile: () => void;
  onExportCurrent: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  settings,
  kindleConnected,
  checkingConnection,
  syncing,
  readingBookTitle,
  onSyncAll,
  onCheckConnection,
  onOpenSettings,
  onImportFile,
  onExportCurrent,
}) => {
  return (
    <header className="h-14 border-b border-[#509475]/30 bg-[#0c1512] px-4 flex items-center justify-between select-none">
      {/* Brand & Editor Mode & Reader */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onTabChange('editor')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
            currentTab === 'editor'
              ? 'bg-[#509475] text-[#0c1512] border-[#509475] font-semibold shadow-sm'
              : 'bg-[#111c18] text-[#81B8A8] border-[#509475]/30 hover:border-[#509475] hover:text-[#F7E8B2]'
          }`}
          title="Mở trình soạn thảo Markdown (Omawrite)"
        >
          <Edit3 className="w-4 h-4" />
          <span className="text-xs">Soạn thảo</span>
        </button>

        {readingBookTitle && (
          <button
            onClick={() => onTabChange('reader')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer max-w-[190px] ${
              currentTab === 'reader'
                ? 'bg-[#509475] text-[#0c1512] border-[#509475] font-semibold shadow-sm'
                : 'bg-[#111c18] text-[#81B8A8] border-[#509475]/30 hover:border-[#509475] hover:text-[#F7E8B2]'
            }`}
            title={`Đang đọc: ${readingBookTitle}`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs truncate">{readingBookTitle}</span>
          </button>
        )}

        <div className="h-5 w-[1px] bg-[#509475]/20 mx-1" />

        {/* 2 Device Icons: Máy tính & Thiết bị đọc sách */}
        <div className="flex items-center bg-[#111c18] p-1 rounded-lg border border-[#509475]/30 gap-1">
          {/* 1. Máy tính (Local Storage) */}
          <button
            onClick={() => onTabChange('local')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              currentTab === 'local'
                ? 'bg-[#509475]/30 text-[#F7E8B2] border border-[#509475] font-semibold'
                : 'text-[#81B8A8] hover:text-[#C1C497] hover:bg-[#509475]/10 border border-transparent'
            }`}
            title="Thư viện sách & tài liệu trên Máy tính (Local)"
          >
            <Monitor className="w-4 h-4 text-[#509475]" />
            <span>Máy tính</span>
          </button>

          {/* Sync Button between Devices */}
          <button
            onClick={onSyncAll}
            disabled={syncing}
            className={`p-1.5 rounded-md text-[#509475] hover:bg-[#509475]/20 hover:text-[#F7E8B2] transition-all cursor-pointer ${
              syncing ? 'animate-spin' : ''
            }`}
            title="Đồng bộ giữa Máy tính và Thiết bị đọc sách"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* 2. Thiết bị đọc sách (Kindle KOReader) */}
          <button
            onClick={() => onTabChange('kindle')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              currentTab === 'kindle'
                ? 'bg-[#509475]/30 text-[#F7E8B2] border border-[#509475] font-semibold'
                : 'text-[#81B8A8] hover:text-[#C1C497] hover:bg-[#509475]/10 border border-transparent'
            }`}
            title="Thiết bị đọc sách Kindle (KOReader Wi-Fi)"
          >
            <Tablet className="w-4 h-4 text-[#509475]" />
            <span>Máy đọc sách</span>
          </button>
        </div>
      </div>

      {/* Center Actions: Import & Export */}
      <div className="flex items-center gap-2">
        <button
          onClick={onImportFile}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111c18] border border-[#509475]/30 hover:border-[#509475] text-[#81B8A8] hover:text-[#F7E8B2] text-xs font-medium transition-all cursor-pointer"
          title="Nhập file (.epub, .pdf, .md, .txt) vào thư viện"
        >
          <Upload className="w-3.5 h-3.5 text-[#509475]" />
          <span>Import</span>
        </button>

        <button
          onClick={onExportCurrent}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111c18] border border-[#509475]/30 hover:border-[#509475] text-[#81B8A8] hover:text-[#F7E8B2] text-xs font-medium transition-all cursor-pointer"
          title="Xuất tài liệu đang soạn thảo (Markdown hoặc EPUB)"
        >
          <Download className="w-3.5 h-3.5 text-[#509475]" />
          <span>Export</span>
        </button>
      </div>

      {/* Right Controls: KOReader Connection Status & Settings */}
      <div className="flex items-center gap-3">
        {/* Connection status badge */}
        <div 
          onClick={onCheckConnection}
          title="Kiểm tra trạng thái kết nối Wi-Fi KOReader"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#111c18] border border-[#509475]/30 cursor-pointer hover:border-[#509475] transition-all"
        >
          <div className="relative flex items-center justify-center">
            {checkingConnection ? (
              <RefreshCw className="w-3 h-3 text-[#509475] animate-spin" />
            ) : (
              <span
                className={`w-2 h-2 rounded-full ${
                  kindleConnected === true
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    : kindleConnected === false
                    ? 'bg-rose-500'
                    : 'bg-amber-400'
                }`}
              />
            )}
          </div>
          <span className="text-xs text-[#81B8A8] font-mono">
            {kindleConnected === true ? (
              <span className="text-emerald-300">KOReader: Online ({settings.kindle_ip})</span>
            ) : kindleConnected === false ? (
              <span className="text-rose-400">KOReader: Offline</span>
            ) : (
              <span>KOReader: {settings.kindle_ip}</span>
            )}
          </span>
        </div>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          title="Cấu hình thiết bị & Thư mục"
          className="p-1.5 rounded-lg text-[#81B8A8] hover:text-[#F7E8B2] hover:bg-[#509475]/20 border border-transparent hover:border-[#509475]/40 transition-all cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
