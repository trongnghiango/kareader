import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  Send,
  Wifi,
  WifiOff,
  Type,
  Save,
  AlertCircle,
  FilePlus,
  FileUp,
  FolderOpen,
  BookOpen,
  Edit3,
  RefreshCw,
  Settings,
  Maximize2,
  Minimize2,
  Download,
  FileText,
  Monitor,
  Tablet,
  Package,
} from 'lucide-react';
import { AppSettings, EditorDocument } from '../types';

export interface CornerHUDProps {
  currentTab: 'editor' | 'local' | 'kindle' | 'reader';
  onTabChange: (tab: 'editor' | 'local' | 'kindle' | 'reader') => void;
  doc: EditorDocument;
  onNewDoc: () => void;
  onOpenFile: () => void;
  onImportFile: () => void;
  onSaveDoc: () => void;
  saving?: boolean;
  saveStatus?: string;
  onRenameDoc?: (filename: string, author: string) => void;
  settings: AppSettings;
  onOpenSettings: () => void;
  kindleConnected: boolean | null;
  checkingConnection: boolean;
  onCheckConnection: () => void;
  onSyncCurrentToKindle: (asEpub: boolean) => Promise<void>;
  onSyncAll: () => void;
  syncing?: boolean;
  onExportFile: () => void;
  onInstallKualExtension?: () => void;
  readingBookTitle?: string | null;
  fonts: string[];
  currentFont: string;
  onSelectFont: (font: string) => void;
  fontSize: number;
  onChangeFontSize: (size: number) => void;
  stats: {
    wordCount: number;
    charCount: number;
    readingTimeMinutes: number;
  };
}

export const CornerHUD: React.FC<CornerHUDProps> = ({
  currentTab,
  onTabChange,
  doc,
  onNewDoc,
  onOpenFile,
  onImportFile,
  onSaveDoc,
  saving = false,
  saveStatus = 'Đã lưu',
  onRenameDoc,
  settings,
  onOpenSettings,
  kindleConnected,
  checkingConnection,
  onCheckConnection,
  onSyncCurrentToKindle,
  onSyncAll,
  syncing = false,
  onExportFile,
  onInstallKualExtension,
  readingBookTitle,
  fonts,
  currentFont,
  onSelectFont,
  fontSize,
  onChangeFontSize,
  stats,
}) => {
  // Popover state for each of the 4 corners: null | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
  const [activeCorner, setActiveCorner] = useState<string | null>(null);

  // Rename inputs state inside Bottom-Right popover
  const [editingTitle, setEditingTitle] = useState(doc.filename);
  const [editingAuthor, setEditingAuthor] = useState(doc.author || 'Ka');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync mode choice state inside Top-Right popover
  const [syncAsEpub, setSyncAsEpub] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close popup on outside click: ONLY active when a corner menu is open
  useEffect(() => {
    if (!activeCorner) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveCorner(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveCorner(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeCorner]);

  // Sync title and author when doc changes
  useEffect(() => {
    setEditingTitle(doc.filename);
    setEditingAuthor(doc.author || 'Ka');
  }, [doc.filename, doc.author]);

  const toggleCorner = (corner: string) => {
    setActiveCorner((prev) => (prev === corner ? null : corner));
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleApplyRename = () => {
    if (onRenameDoc) {
      onRenameDoc(editingTitle.trim() || 'tai-lieu.md', editingAuthor.trim() || 'Ka');
    }
  };

  return (
    <div ref={containerRef} className="pointer-events-none select-none z-50">
      {/* =========================================================================
          1. TOP-LEFT CORNER: Navigation & Document Management
      ========================================================================= */}
      <div className="fixed top-3 left-3 pointer-events-auto">
        <button
          onClick={() => toggleCorner('topLeft')}
          title="Điều hướng & Quản lý tài liệu"
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md ${
            activeCorner === 'topLeft'
              ? 'bg-[#509475] text-[#0c1512] border border-[#509475] shadow-lg scale-105'
              : 'bg-[#0c1512]/70 hover:bg-[#0c1512] border border-[#509475]/30 hover:border-[#509475] text-[#81B8A8] hover:text-[#F7E8B2] '
          }`}
        >
          <Compass className="w-4 h-4" />
        </button>

        {/* Top-Left Dropdown Menu */}
        {activeCorner === 'topLeft' && (
          <div className="absolute top-11 left-0 w-64 rounded-2xl bg-[#0c1512]/95 border border-[#509475]/40 shadow-2xl  p-2.5 animate-in fade-in zoom-in-95 duration-150 text-xs font-mono">
            <div className="px-2 py-1.5 text-[10px] uppercase font-bold text-[#509475] tracking-wider border-b border-[#509475]/20 mb-1 flex items-center justify-between">
              <span>Điều hướng</span>
              <span className="text-[#53685B] lowercase">{currentTab}</span>
            </div>

            {/* Mode: Editor */}
            <button
              onClick={() => {
                onTabChange('editor');
                setActiveCorner(null);
              }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all cursor-pointer ${
                currentTab === 'editor'
                  ? 'bg-[#509475] text-[#0c1512] font-semibold'
                  : 'text-[#C1C497] hover:bg-[#509475]/15 hover:text-[#F7E8B2]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 shrink-0" />
              <div className="text-left flex-1">
                <div>Soạn thảo</div>
                <div className="text-[10px] opacity-75">Kareader Markdown</div>
              </div>
            </button>

            {/* Mode: Reader (if active) */}
            {readingBookTitle && (
              <button
                onClick={() => {
                  onTabChange('reader');
                  setActiveCorner(null);
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all cursor-pointer mt-1 ${
                  currentTab === 'reader'
                    ? 'bg-[#509475] text-[#0c1512] font-semibold'
                    : 'text-[#C1C497] hover:bg-[#509475]/15 hover:text-[#F7E8B2]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <div className="text-left flex-1 truncate">
                  <div>Đọc sách</div>
                  <div className="text-[10px] opacity-75 truncate">{readingBookTitle}</div>
                </div>
              </button>
            )}

            {/* Mode: Local Library */}
            <button
              onClick={() => {
                onTabChange('local');
                setActiveCorner(null);
              }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all cursor-pointer mt-1 ${
                currentTab === 'local'
                  ? 'bg-[#509475] text-[#0c1512] font-semibold'
                  : 'text-[#C1C497] hover:bg-[#509475]/15 hover:text-[#F7E8B2]'
              }`}
            >
              <Monitor className="w-3.5 h-3.5 shrink-0" />
              <div className="text-left flex-1">
                <div>Thư viện Máy tính</div>
                <div className="text-[10px] opacity-75">{settings.local_library_dir}</div>
              </div>
            </button>

            {/* Mode: Kindle KOReader Library */}
            <button
              onClick={() => {
                onTabChange('kindle');
                setActiveCorner(null);
              }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all cursor-pointer mt-1 ${
                currentTab === 'kindle'
                  ? 'bg-[#509475] text-[#0c1512] font-semibold'
                  : 'text-[#C1C497] hover:bg-[#509475]/15 hover:text-[#F7E8B2]'
              }`}
            >
              <Tablet className="w-3.5 h-3.5 shrink-0" />
              <div className="text-left flex-1">
                <div>Máy đọc sách Kindle</div>
                <div className="text-[10px] opacity-75">KOReader SFTP</div>
              </div>
            </button>

            <div className="my-1.5 border-t border-[#509475]/20" />

            {/* Actions: New Doc */}
            <button
              onClick={() => {
                onNewDoc();
                setActiveCorner(null);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[#81B8A8] hover:text-[#F7E8B2] hover:bg-[#509475]/15 transition-all cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5 shrink-0" />
              <span>Ghi chép mới</span>
            </button>

            {/* Actions: Open File */}
            <button
              onClick={() => {
                onOpenFile();
                setActiveCorner(null);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[#81B8A8] hover:text-[#F7E8B2] hover:bg-[#509475]/15 transition-all cursor-pointer mt-0.5"
            >
              <FileUp className="w-3.5 h-3.5 shrink-0" />
              <span>Mở tệp trên máy...</span>
            </button>

            {/* Actions: Import File to Library */}
            <button
              onClick={() => {
                onImportFile();
                setActiveCorner(null);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[#81B8A8] hover:text-[#F7E8B2] hover:bg-[#509475]/15 transition-all cursor-pointer mt-0.5"
            >
              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              <span>Nạp sách vào Thư viện...</span>
            </button>
          </div>
        )}
      </div>

      {/* =========================================================================
          2. TOP-RIGHT CORNER: KOReader Sync & Export
      ========================================================================= */}
      <div className="fixed top-3 right-3 pointer-events-auto">
        <button
          onClick={() => toggleCorner('topRight')}
          title="Đồng bộ KOReader (Kindle) & Xuất bản"
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md relative ${
            activeCorner === 'topRight'
              ? 'bg-[#509475] text-[#0c1512] border border-[#509475] shadow-lg scale-105'
              : 'bg-[#0c1512]/70 hover:bg-[#0c1512] border border-[#509475]/30 hover:border-[#509475] text-[#81B8A8] hover:text-[#F7E8B2] '
          }`}
        >
          {syncing ? (
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
          ) : (
            <Send className="w-4 h-4" />
          )}

          {/* Connection state dot */}
          <span
            className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full border border-[#0c1512] ${
              kindleConnected === true
                ? 'bg-emerald-400'
                : kindleConnected === false
                ? 'bg-rose-500'
                : 'bg-neutral-500'
            }`}
          />
        </button>

        {/* Top-Right Dropdown Menu */}
        {activeCorner === 'topRight' && (
          <div className="absolute top-11 right-0 w-72 rounded-2xl bg-[#0c1512]/95 border border-[#509475]/40 shadow-2xl  p-3 animate-in fade-in zoom-in-95 duration-150 text-xs font-mono">
            {/* Connection Status Box */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-[#111c18] border border-[#509475]/25 mb-2.5">
              <div className="flex items-center gap-2">
                {kindleConnected === true ? (
                  <Wifi className="w-4 h-4 text-emerald-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-rose-400" />
                )}
                <div>
                  <div className="font-semibold text-[#F7E8B2]">
                    {kindleConnected === true ? 'KOReader Đã kết nối' : 'KOReader Ngoại tuyến'}
                  </div>
                  <div className="text-[10px] text-[#53685B]">
                    {settings.kindle_ip}:{settings.kindle_port}
                  </div>
                </div>
              </div>

              <button
                onClick={onCheckConnection}
                disabled={checkingConnection}
                title="Kiểm tra lại kết nối SFTP"
                className="p-1 rounded-lg text-[#81B8A8] hover:text-[#F7E8B2] hover:bg-[#509475]/20 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingConnection ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Sync Format Selector */}
            <div className="mb-2">
              <span className="text-[10px] uppercase text-[#53685B] block mb-1">Định dạng gửi</span>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#111c18] rounded-xl border border-[#509475]/20">
                <button
                  onClick={() => setSyncAsEpub(false)}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    !syncAsEpub
                      ? 'bg-[#509475] text-[#0c1512] font-semibold shadow-sm'
                      : 'text-[#81B8A8] hover:text-[#C1C497]'
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  <span>.md thô</span>
                </button>
                <button
                  onClick={() => setSyncAsEpub(true)}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    syncAsEpub
                      ? 'bg-[#509475] text-[#0c1512] font-semibold shadow-sm'
                      : 'text-[#81B8A8] hover:text-[#C1C497]'
                  }`}
                >
                  <BookOpen className="w-3 h-3" />
                  <span>.epub sách</span>
                </button>
              </div>
            </div>

            {/* Send Current Document */}
            <button
              onClick={async () => {
                await onSyncCurrentToKindle(syncAsEpub);
                setActiveCorner(null);
              }}
              disabled={syncing}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#509475] hover:bg-[#63b07a] text-[#0c1512] font-semibold transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${syncing ? 'animate-bounce' : ''}`} />
              <span>{syncing ? 'Đang truyền SFTP...' : 'Gửi tài liệu này sang Kindle'}</span>
            </button>

            <div className="my-2 border-t border-[#509475]/20" />

            {/* Sync All Library */}
            <button
              onClick={() => {
                onSyncAll();
                setActiveCorner(null);
              }}
              disabled={syncing}
              className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-[#81B8A8] hover:text-[#F7E8B2] hover:bg-[#509475]/15 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              <span>Đồng bộ nhanh Thư viện (1-Click)</span>
            </button>

            {/* Export File to Disk */}
            <button
              onClick={() => {
                onExportFile();
                setActiveCorner(null);
              }}
              className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-[#81B8A8] hover:text-[#F7E8B2] hover:bg-[#509475]/15 transition-all cursor-pointer mt-0.5"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Xuất ra tệp (.md / .epub)...</span>
            </button>

            {/* Install KUAL Extension (.zip) */}
            {onInstallKualExtension && (
              <button
                onClick={() => {
                  onInstallKualExtension();
                  setActiveCorner(null);
                }}
                className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-[#81B8A8] hover:text-[#F7E8B2] hover:bg-[#509475]/15 transition-all cursor-pointer mt-0.5"
              >
                <Package className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>Cài đặt KUAL Extension (.zip)...</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          3. BOTTOM-LEFT CORNER: Typography & Statistics
      ========================================================================= */}
      <div className="fixed bottom-3 left-3 pointer-events-auto">
        <button
          onClick={() => toggleCorner('bottomLeft')}
          title="Kiểu chữ & Thống kê"
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md ${
            activeCorner === 'bottomLeft'
              ? 'bg-[#509475] text-[#0c1512] border border-[#509475] shadow-lg scale-105'
              : 'bg-[#0c1512]/70 hover:bg-[#0c1512] border border-[#509475]/30 hover:border-[#509475] text-[#81B8A8] hover:text-[#F7E8B2] '
          }`}
        >
          <Type className="w-4 h-4" />
        </button>

        {/* Bottom-Left Dropdown Menu */}
        {activeCorner === 'bottomLeft' && (
          <div className="absolute bottom-11 left-0 w-72 rounded-2xl bg-[#0c1512]/95 border border-[#509475]/40 shadow-2xl  p-3 animate-in fade-in zoom-in-95 duration-150 text-xs font-mono">
            <div className="px-1 text-[10px] uppercase font-bold text-[#509475] tracking-wider mb-2 flex items-center justify-between">
              <span>Kiểu chữ & Giao diện</span>
            </div>

            {/* Font Selector */}
            <div className="mb-2.5">
              <span className="text-[10px] text-[#53685B] block mb-1">Font chữ:</span>
              <div className="max-h-28 overflow-y-auto space-y-0.5 pr-1">
                {fonts.map((f) => (
                  <button
                    key={f}
                    onClick={() => onSelectFont(f)}
                    className={`w-full text-left px-2 py-1 rounded text-[11px] truncate transition-all cursor-pointer ${
                      currentFont === f
                        ? 'bg-[#509475] text-[#0c1512] font-semibold'
                        : 'text-[#C1C497] hover:bg-[#509475]/15 hover:text-[#F7E8B2]'
                    }`}
                    style={{ fontFamily: f }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size Slider */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-[11px] text-[#81B8A8] mb-1">
                <span>Cỡ chữ:</span>
                <span className="text-[#F7E8B2] font-semibold">{fontSize}px</span>
              </div>
              <input
                type="range"
                min="14"
                max="28"
                step="1"
                value={fontSize}
                onChange={(e) => onChangeFontSize(Number(e.target.value))}
                className="w-full accent-[#509475] cursor-pointer"
              />
            </div>

            <div className="my-2 border-t border-[#509475]/20" />

            {/* Real-time Statistics */}
            <div className="p-2 rounded-xl bg-[#111c18] border border-[#509475]/20 space-y-1 text-[11px]">
              <div className="text-[10px] uppercase text-[#509475] font-bold mb-1">Thống kê tài liệu</div>
              <div className="flex justify-between text-[#81B8A8]">
                <span>Số từ:</span>
                <strong className="text-[#F7E8B2]">{stats.wordCount.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between text-[#81B8A8]">
                <span>Số ký tự:</span>
                <strong className="text-[#F7E8B2]">{stats.charCount.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between text-[#81B8A8]">
                <span>Thời gian đọc:</span>
                <strong className="text-[#F7E8B2]">~{stats.readingTimeMinutes} phút</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          4. BOTTOM-RIGHT CORNER: Save & App Settings
      ========================================================================= */}
      <div className="fixed bottom-3 right-3 pointer-events-auto">
        <button
          onClick={() => toggleCorner('bottomRight')}
          title="Lưu trữ & Cài đặt (Ctrl+S)"
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md ${
            activeCorner === 'bottomRight'
              ? 'bg-[#509475] text-[#0c1512] border border-[#509475] shadow-lg scale-105'
              : doc.isDirty
              ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-amber-300 '
              : 'bg-[#0c1512]/70 hover:bg-[#0c1512] border border-[#509475]/30 hover:border-[#509475] text-[#81B8A8] hover:text-[#F7E8B2] '
          }`}
        >
          {doc.isDirty ? (
            <AlertCircle className="w-4 h-4 text-amber-400" />
          ) : (
            <Save className="w-4 h-4" />
          )}
        </button>

        {/* Bottom-Right Dropdown Menu */}
        {activeCorner === 'bottomRight' && (
          <div className="absolute bottom-11 right-0 w-72 rounded-2xl bg-[#0c1512]/95 border border-[#509475]/40 shadow-2xl  p-3 animate-in fade-in zoom-in-95 duration-150 text-xs font-mono">
            {/* Save Action */}
            <button
              onClick={() => {
                onSaveDoc();
                setActiveCorner(null);
              }}
              disabled={saving}
              className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all cursor-pointer font-semibold shadow-md active:scale-95 mb-2 ${
                doc.isDirty
                  ? 'bg-amber-400 text-[#0c1512] hover:bg-amber-300'
                  : 'bg-[#509475] text-[#0c1512] hover:bg-[#63b07a]'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Đang lưu...' : doc.isDirty ? 'Lưu ngay (Ctrl+S)' : 'Đã lưu an toàn'}</span>
            </button>

            {/* Status indicator */}
            <div className="text-[10px] text-[#53685B] text-center mb-2.5 truncate" title={doc.path || 'Chưa lưu'}>
              {saveStatus}
            </div>

            {/* Title & Author Quick Edit */}
            <div className="p-2 rounded-xl bg-[#111c18] border border-[#509475]/20 space-y-2 mb-2.5">
              <div>
                <span className="text-[10px] text-[#53685B] block mb-0.5">Tên tệp:</span>
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={handleApplyRename}
                  className="w-full bg-[#0c1512] border border-[#509475]/30 focus:border-[#509475] text-[#F7E8B2] text-[11px] rounded px-2 py-1 font-mono focus:outline-none"
                />
              </div>

              <div>
                <span className="text-[10px] text-[#53685B] block mb-0.5">Tác giả:</span>
                <input
                  type="text"
                  value={editingAuthor}
                  onChange={(e) => setEditingAuthor(e.target.value)}
                  onBlur={handleApplyRename}
                  className="w-full bg-[#0c1512] border border-[#509475]/30 focus:border-[#509475] text-[#81B8A8] text-[11px] rounded px-2 py-1 font-mono focus:outline-none"
                />
              </div>
            </div>

            <div className="my-1.5 border-t border-[#509475]/20" />

            {/* Fullscreen Toggle */}
            <button
              onClick={handleToggleFullscreen}
              className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-[#81B8A8] hover:text-[#F7E8B2] hover:bg-[#509475]/15 transition-all cursor-pointer"
            >
              <span className="flex items-center gap-2">
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình (F11)'}</span>
              </span>
            </button>

            {/* Open Settings Modal */}
            <button
              onClick={() => {
                onOpenSettings();
                setActiveCorner(null);
              }}
              className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-[#81B8A8] hover:text-[#F7E8B2] hover:bg-[#509475]/15 transition-all cursor-pointer mt-0.5"
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
              <span>Cài đặt hệ thống (KOReader & Thư mục)...</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};