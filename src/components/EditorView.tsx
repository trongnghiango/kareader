import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Save,
  FolderOpen,
  FilePlus,
  FileUp,
  RefreshCw,
  Eye,
  EyeOff,
  BookOpen,
  FileText,
  Check,
  AlertCircle,
  HardDrive,
} from 'lucide-react';
import { AppSettings, EditorDocument } from '../types';
import { FontPicker } from './FontPicker';

interface EditorViewProps {
  doc: EditorDocument;
  settings: AppSettings;
  fonts: string[];
  currentFont: string;
  onSelectFont: (font: string) => void;
  onChangeDoc: (doc: EditorDocument) => void;
  onSaveDoc: (doc: EditorDocument) => Promise<string>;
  onNewDoc: () => void;
  onOpenFile: () => void;
  onOpenLibrary: () => void;
  onOpenInReader: (doc: EditorDocument) => void;
  onSyncMarkdownToKindle: (title: string, author: string, content: string, asEpub: boolean) => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const EditorView: React.FC<EditorViewProps> = ({
  doc,
  settings: _settings,
  fonts,
  currentFont,
  onSelectFont,
  onChangeDoc,
  onSaveDoc,
  onNewDoc,
  onOpenFile,
  onOpenLibrary,
  onOpenInReader,
  onSyncMarkdownToKindle,
  onNotify,
}) => {
  const [title, setTitle] = useState(doc.filename);
  const [author, setAuthor] = useState(doc.author || 'Ka');
  const [content, setContent] = useState(doc.content);
  const [filePath, setFilePath] = useState<string | null>(doc.path || null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>(
    doc.path ? `Đang mở: ${doc.filename}` : 'Tài liệu mới'
  );

  const [previewMode, setPreviewMode] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncAsEpub, setSyncAsEpub] = useState(false);
  const [isFontPickerOpen, setIsFontPickerOpen] = useState(false);

  // Synchronize state when active document changes from outside
  useEffect(() => {
    setTitle(doc.filename);
    setAuthor(doc.author || 'Ka');
    setContent(doc.content);
    setFilePath(doc.path || null);
    setIsDirty(false);
    setSaveStatus(doc.path ? `Đã mở: ${doc.filename}` : 'Tài liệu mới');
  }, [doc.path, doc.filename, doc.content, doc.author]);

  // Statistics
  const stats = useMemo(() => {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const chars = content.length;
    const minutes = Math.ceil(words / 200);
    return { words, chars, minutes };
  }, [content]);

  // Handle Save Directly to File
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const cleanFilename = title.trim().length > 0 ? title.trim() : 'tai-lieu.md';
      const toSave: EditorDocument = {
        path: filePath,
        filename: cleanFilename,
        author: author.trim(),
        content,
        isDirty: false,
      };

      const savedPath = await onSaveDoc(toSave);
      setFilePath(savedPath);
      setIsDirty(false);
      setSaveStatus(`✓ Đã lưu lúc ${new Date().toLocaleTimeString()}`);
      onNotify(`Đã lưu trực tiếp: ${cleanFilename}`, 'success');
    } catch (e: any) {
      onNotify(`Lỗi lưu file: ${String(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  }, [title, filePath, author, content, onSaveDoc, onNotify]);

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Sync to KOReader
  const handleSync = async () => {
    setSyncing(true);
    try {
      const modeStr = syncAsEpub ? 'EPUB' : 'Markdown (.md)';
      onNotify(`Đang đồng bộ dạng ${modeStr} sang KOReader qua Wi-Fi...`, 'success');
      await onSyncMarkdownToKindle(title, author, content, syncAsEpub);
      onNotify(`Đã đồng bộ thành công "${title}" sang Máy đọc sách!`, 'success');
      setSaveStatus(`Đã gửi KOReader (${modeStr})`);
    } catch (e: any) {
      onNotify(`Lỗi đồng bộ sang KOReader: ${String(e)}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setIsDirty(true);
    setSaveStatus('● Chưa lưu (Ctrl+S)');
    onChangeDoc({
      path: filePath,
      filename: title,
      author,
      content: newContent,
      isDirty: true,
    });
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setIsDirty(true);
    setSaveStatus('● Chưa lưu (Ctrl+S)');
    onChangeDoc({
      path: filePath,
      filename: newTitle,
      author,
      content,
      isDirty: true,
    });
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-[#111c18] overflow-hidden relative">
      {/* Top Document Controls Bar */}
      <div className="h-12 border-b border-[#509475]/20 bg-[#0c1512] px-6 flex items-center justify-between">
        {/* Title, Author & File Location Indicator */}
        <div className="flex items-center gap-3 flex-1 max-w-2xl min-w-0">
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Tên tệp (vd: ghi-chu.md)..."
            className="bg-[#111c18] border border-[#509475]/30 focus:border-[#509475] text-sm font-semibold text-[#F7E8B2] focus:outline-none rounded px-2.5 py-1 w-64 truncate font-mono"
            title={title}
          />

          <span className="text-xs text-[#53685B] shrink-0">Tác giả:</span>
          <input
            type="text"
            value={author}
            onChange={(e) => {
              setAuthor(e.target.value);
              setIsDirty(true);
            }}
            placeholder="Tác giả"
            className="bg-[#111c18] border border-[#509475]/30 focus:border-[#509475] text-xs text-[#81B8A8] focus:outline-none rounded px-2 py-1 w-32 truncate"
          />

          {/* Direct File Path Badge */}
          {filePath ? (
            <span
              className="text-[11px] text-[#53685B] font-mono truncate max-w-[220px] hidden lg:inline flex items-center gap-1 opacity-80"
              title={`Tệp lưu trực tiếp tại: ${filePath}`}
            >
              <HardDrive className="w-3 h-3 text-[#509475] shrink-0" />
              <span className="truncate">{filePath}</span>
            </span>
          ) : (
            <span className="text-[10px] text-amber-400/80 font-mono hidden lg:inline shrink-0">
              [Tệp mới - chưa lưu trên ổ đĩa]
            </span>
          )}
        </div>

        {/* Sync & Preview Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Format Selector for Sync */}
          <div className="flex items-center bg-[#111c18] rounded-lg border border-[#509475]/30 p-0.5 text-xs">
            <button
              onClick={() => setSyncAsEpub(false)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all cursor-pointer ${
                !syncAsEpub
                  ? 'bg-[#509475] text-[#0c1512] font-semibold'
                  : 'text-[#81B8A8] hover:text-[#C1C497]'
              }`}
              title="Đồng bộ trực tiếp file Markdown (.md), không qua convert"
            >
              <FileText className="w-3 h-3" />
              <span>.md</span>
            </button>
            <button
              onClick={() => setSyncAsEpub(true)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all cursor-pointer ${
                syncAsEpub
                  ? 'bg-[#509475] text-[#0c1512] font-semibold'
                  : 'text-[#81B8A8] hover:text-[#C1C497]'
              }`}
              title="Đóng gói sang định dạng EPUB chuẩn sách điện tử"
            >
              <BookOpen className="w-3 h-3" />
              <span>.epub</span>
            </button>
          </div>

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#509475] text-[#0c1512] font-semibold text-xs hover:bg-[#63b07a] transition-all cursor-pointer shadow-sm active:scale-95"
            title={`Đồng bộ sang Máy đọc sách dạng ${syncAsEpub ? 'EPUB' : 'Markdown (.md)'}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">{syncing ? 'Đang gửi...' : 'Gửi Kindle'}</span>
          </button>

          {/* Toggle Live Preview */}
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`p-1.5 rounded-lg text-xs border flex items-center gap-1 cursor-pointer transition-all ${
              previewMode
                ? 'bg-[#509475]/30 text-[#F7E8B2] border-[#509475]'
                : 'text-[#81B8A8] hover:text-[#C1C497] hover:bg-[#509475]/10 border-[#509475]/30'
            }`}
            title="Xem trước Markdown cạnh bên"
          >
            {previewMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>

          {/* Open in Reader Mode */}
          <button
            onClick={() =>
              onOpenInReader({
                path: filePath,
                filename: title,
                author,
                content,
                isDirty,
              })
            }
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#509475]/30 hover:border-[#509475] text-[#81B8A8] hover:text-[#F7E8B2] text-xs font-mono transition-all cursor-pointer"
            title="Mở tài liệu này trong giao diện đọc sách (Reader Mode)"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#509475]" />
            <span className="hidden md:inline">Đọc</span>
          </button>
        </div>
      </div>

      {/* Main Writing Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Area */}
        <div className={`flex-1 flex flex-col p-8 overflow-y-auto ${previewMode ? 'w-1/2' : 'w-full'}`}>
          <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col">
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              style={{ fontFamily: currentFont }}
              placeholder="Bắt đầu viết ở đây..."
              className="w-full flex-1 bg-transparent border-none text-[#C1C497] text-sm leading-relaxed focus:outline-none resize-none selection:bg-[#32473B]"
              spellCheck={false}
              autoFocus
            />
          </div>
        </div>

        {/* Live Preview Panel */}
        {previewMode && (
          <div className="w-1/2 p-8 overflow-y-auto bg-[#0c1512] border-l border-[#509475]/20">
            <div className="max-w-xl w-full mx-auto font-serif text-[#C1C497] leading-relaxed">
              <h1 className="text-2xl font-bold text-[#F7E8B2] mb-2">{title}</h1>
              <p className="text-xs text-[#53685B] italic mb-6">Tác giả: {author}</p>
              <div className="whitespace-pre-wrap font-sans text-sm opacity-90">
                {content}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Font Picker Popover */}
      <FontPicker
        isOpen={isFontPickerOpen}
        onClose={() => setIsFontPickerOpen(false)}
        fonts={fonts}
        currentFont={currentFont}
        onSelectFont={onSelectFont}
      />

      {/* Bottom Status & Tool Bar (Omawrite Style) */}
      <footer className="h-9 border-t border-[#509475]/20 bg-[#0c1512] px-4 flex items-center justify-between text-xs text-[#53685B] font-mono select-none">
        {/* Left Actions: Save, New, Open, Folder, Font 'A' */}
        <div className="flex items-center gap-2">
          {/* Save icon */}
          <button
            onClick={handleSave}
            disabled={saving}
            title="Lưu trực tiếp vào file (Ctrl+S)"
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all cursor-pointer ${
              isDirty
                ? 'bg-[#509475] text-[#0c1512] font-semibold shadow-sm'
                : 'text-[#81B8A8] hover:text-[#F7E8B2] hover:bg-[#509475]/15'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lưu</span>
          </button>

          {/* New file */}
          <button
            onClick={onNewDoc}
            title="Tạo tài liệu mới trắng tinh"
            className="flex items-center gap-1 p-1.5 rounded text-[#81B8A8] hover:text-[#F7E8B2] hover:bg-[#509475]/15 transition-all cursor-pointer"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>

          {/* Open local file from disk */}
          <button
            onClick={onOpenFile}
            title="Mở file từ máy tính (.md, .txt)..."
            className="flex items-center gap-1 p-1.5 rounded text-[#81B8A8] hover:text-[#F7E8B2] hover:bg-[#509475]/15 transition-all cursor-pointer"
          >
            <FileUp className="w-3.5 h-3.5" />
          </button>

          {/* Open Library View */}
          <button
            onClick={onOpenLibrary}
            title="Mở Thư viện sách & tài liệu"
            className="flex items-center gap-1 p-1.5 rounded text-[#81B8A8] hover:text-[#F7E8B2] hover:bg-[#509475]/15 transition-all cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>

          {/* Font 'A' Popover button */}
          <button
            onClick={() => setIsFontPickerOpen(!isFontPickerOpen)}
            title={`Chọn Font chữ (Hiện tại: ${currentFont})`}
            className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
              isFontPickerOpen
                ? 'bg-[#509475] text-[#0c1512]'
                : 'text-[#81B8A8] hover:text-[#F7E8B2] hover:bg-[#509475]/15'
            }`}
          >
            A
          </button>

          <div className="h-4 w-[1px] bg-[#509475]/20 mx-1" />

          {/* Status Label */}
          <span
            className={`text-[11px] font-mono flex items-center gap-1 ${
              isDirty ? 'text-amber-400 font-semibold' : 'text-[#81B8A8]'
            }`}
          >
            {isDirty ? (
              <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
            ) : (
              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
            )}
            <span>{saveStatus}</span>
          </span>
        </div>

        {/* Right Stats */}
        <div className="flex items-center gap-3 text-[11px] text-[#53685B]">
          <span className="hidden md:inline">
            Font: <strong className="text-[#81B8A8]">{currentFont}</strong>
          </span>
          <span className="hidden md:inline">•</span>
          <span>{stats.words} từ</span>
          <span>•</span>
          <span>{stats.chars} ký tự</span>
          <span>•</span>
          <span>~{stats.minutes} phút</span>
        </div>
      </footer>
    </div>
  );
};
