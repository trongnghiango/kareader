import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Save,
  FolderOpen,
  FilePlus,
  FileUp,
  RefreshCw,
  BookOpen,
  FileText,
  Check,
  AlertCircle,
  HardDrive,
} from 'lucide-react';
import { AppSettings, EditorDocument } from '../types';
import { FontPicker } from './FontPicker';

// CodeMirror 6 Modules
import { basicSetup, EditorView as CMView } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';

interface EditorViewProps {
  doc: EditorDocument;
  settings: AppSettings;
  fonts: string[];
  currentFont: string;
  onSelectFont: (font: string) => void;
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
  const [filePath, setFilePath] = useState<string | null>(doc.path || null);
  const [isDirty, setIsDirty] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncAsEpub, setSyncAsEpub] = useState(false);
  const [isFontPickerOpen, setIsFontPickerOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>(
    doc.path ? `Đã mở: ${doc.filename}` : 'Tài liệu mới'
  );

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const cmViewRef = useRef<CMView | null>(null);
  const currentPathRef = useRef<string | null>(doc.path || null);

  // Calculate live statistics
  const updateStats = (text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
    setCharCount(text.length);
  };

  // Get current text from CodeMirror
  const getCurrentText = useCallback(() => {
    return cmViewRef.current ? cmViewRef.current.state.doc.toString() : doc.content;
  }, [doc.content]);

  // Handle Save
  const handleSave = useCallback(async () => {
    setSaving(true);
    const contentToSave = getCurrentText();
    try {
      const cleanFilename = title.trim().length > 0 ? title.trim() : 'tai-lieu.md';
      const toSave: EditorDocument = {
        path: filePath,
        filename: cleanFilename,
        author: author.trim(),
        content: contentToSave,
        isDirty: false,
      };

      const savedPath = await onSaveDoc(toSave);
      setFilePath(savedPath);
      currentPathRef.current = savedPath;
      setIsDirty(false);
      setSaveStatus(`✓ Đã lưu lúc ${new Date().toLocaleTimeString()}`);
      onNotify(`Đã lưu trực tiếp: ${cleanFilename}`, 'success');
    } catch (e: any) {
      onNotify(`Lỗi lưu file: ${String(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  }, [title, filePath, author, getCurrentText, onSaveDoc, onNotify]);

  // Sync to KOReader
  const handleSync = async () => {
    setSyncing(true);
    const contentToSend = getCurrentText();
    try {
      const modeStr = syncAsEpub ? 'EPUB' : 'Markdown (.md)';
      onNotify(`Đang đồng bộ dạng ${modeStr} sang KOReader qua Wi-Fi...`, 'success');
      await onSyncMarkdownToKindle(title, author, contentToSend, syncAsEpub);
      onNotify(`Đã đồng bộ thành công "${title}" sang Máy đọc sách!`, 'success');
      setSaveStatus(`Đã gửi KOReader (${modeStr})`);
    } catch (e: any) {
      onNotify(`Lỗi đồng bộ sang KOReader: ${String(e)}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Setup CodeMirror 6 View
  useEffect(() => {
    if (!editorContainerRef.current) return;

    // Authentic Omarchy Dark Theme matching native omawrite & Omarchy desktop
    const omarchyTheme = CMView.theme({
      '&': {
        height: '100%',
        backgroundColor: '#111c18',
        color: '#C1C497',
        fontFamily: currentFont,
        fontSize: '18px',
        lineHeight: '1.8',
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: currentFont,
      },
      '.cm-content': {
        fontFamily: currentFont,
        caretColor: '#509475',
        maxWidth: '780px',
        margin: '0 auto',
        padding: '3rem 1.5rem 12rem 1.5rem',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: '#509475 !important',
        borderLeftWidth: '2.5px !important',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: 'rgba(80, 148, 117, 0.35) !important',
        color: '#F7E8B2 !important',
      },
      '.cm-activeLine': {
        backgroundColor: 'rgba(80, 148, 117, 0.05)',
      },
      '.cm-gutters': {
        display: 'none',
      },
      '.cm-line': {
        padding: '0 2px',
      },
      // Headers styling matching Omarchy obsidian.css
      '.tok-heading1': { color: '#FF5345 !important', fontWeight: 'bold' },
      '.tok-heading2': { color: '#549e6a !important', fontWeight: 'bold' },
      '.tok-heading3': { color: '#459451 !important', fontWeight: 'bold' },
      '.tok-keyword': { color: '#FF5345 !important' },
      '.tok-string': { color: '#549e6a !important' },
      '.tok-comment': { color: '#53685B !important', fontStyle: 'italic' },
      '.tok-operator': { color: '#509475 !important' },
      '.tok-link': { color: '#509475 !important', textDecoration: 'underline' },
    }, { dark: true });

    // Custom Keymaps including Ctrl+S save
    const customKeymap = keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          handleSave();
          return true;
        },
      },
    ]);

    // Listener for document changes
    const updateListener = CMView.updateListener.of((update) => {
      if (update.docChanged) {
        setIsDirty(true);
        setSaveStatus('● Chưa lưu (Ctrl+S)');
        const text = update.state.doc.toString();
        updateStats(text);
      }
    });

    const startState = EditorState.create({
      doc: doc.content,
      extensions: [
        basicSetup,
        omarchyTheme,
        markdown(),
        customKeymap,
        updateListener,
        CMView.lineWrapping,
      ],
    });

    const view = new CMView({
      state: startState,
      parent: editorContainerRef.current,
    });

    cmViewRef.current = view;
    updateStats(doc.content);

    return () => {
      view.destroy();
      cmViewRef.current = null;
    };
  }, []);

  // Update editor font dynamically
  useEffect(() => {
    if (editorContainerRef.current) {
      editorContainerRef.current.style.fontFamily = currentFont;
    }
  }, [currentFont]);

  // Synchronize state when switching to another document
  useEffect(() => {
    if (doc.path !== currentPathRef.current || !currentPathRef.current) {
      currentPathRef.current = doc.path || null;
      setTitle(doc.filename);
      setAuthor(doc.author || 'Ka');
      setFilePath(doc.path || null);
      setIsDirty(false);
      setSaveStatus(doc.path ? `Đã mở: ${doc.filename}` : 'Tài liệu mới');

      if (cmViewRef.current) {
        const view = cmViewRef.current;
        const currentText = view.state.doc.toString();
        if (currentText !== doc.content) {
          view.dispatch({
            changes: { from: 0, to: currentText.length, insert: doc.content },
          });
          updateStats(doc.content);
        }
      }
    }
  }, [doc.path, doc.filename, doc.content, doc.author]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-[#111c18] overflow-hidden relative">
      {/* Top Document Controls Bar */}
      <div className="h-12 border-b border-[#509475]/20 bg-[#0c1512] px-6 flex items-center justify-between select-none">
        {/* Title, Author & File Location Indicator */}
        <div className="flex items-center gap-3 flex-1 max-w-2xl min-w-0">
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setIsDirty(true);
              setSaveStatus('● Chưa lưu (Ctrl+S)');
            }}
            placeholder="Tên tệp (vd: ghi-chu.md)..."
            className="bg-[#111c18] border border-[#509475]/30 focus:border-[#509475] text-sm font-semibold text-[#F7E8B2] focus:outline-none rounded px-2.5 py-1 w-64 truncate font-mono select-text"
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
            className="bg-[#111c18] border border-[#509475]/30 focus:border-[#509475] text-xs text-[#81B8A8] focus:outline-none rounded px-2 py-1 w-32 truncate select-text"
          />

          {/* Direct File Path Badge */}
          {filePath ? (
            <span
              className="text-[11px] text-[#53685B] font-mono truncate max-w-[220px] hidden lg:inline flex items-center gap-1 opacity-80 select-text"
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

        {/* Sync & Mode Controls */}
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

          {/* Open in Reader Mode */}
          <button
            onClick={() => {
              const full = getCurrentText();
              onOpenInReader({
                path: filePath,
                filename: title,
                author,
                content: full,
                isDirty,
              });
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#509475]/30 hover:border-[#509475] text-[#81B8A8] hover:text-[#F7E8B2] text-xs font-mono transition-all cursor-pointer"
            title="Mở tài liệu này trong giao diện đọc sách (Reader Mode)"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#509475]" />
            <span className="hidden md:inline">Đọc sách</span>
          </button>
        </div>
      </div>

      {/* Main CodeMirror 6 Canvas (Virtual Windowing & Infinite Scale) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Full-width Zen Writing Canvas */}
        <div
          ref={editorContainerRef}
          className="flex-1 h-full overflow-hidden"
        />
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

        {/* Right Stats & Engine indicator */}
        <div className="flex items-center gap-3 text-[11px] text-[#53685B]">
          <span className="text-emerald-400/90 font-mono hidden sm:inline">● CodeMirror 6</span>
          <span className="hidden md:inline">•</span>
          <span>{wordCount} từ</span>
          <span>•</span>
          <span>{charCount} ký tự</span>
          <span className="hidden md:inline">•</span>
          <span className="hidden md:inline">
            Font: <strong className="text-[#81B8A8]">{currentFont}</strong>
          </span>
        </div>
      </footer>
    </div>
  );
};
