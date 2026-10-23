import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  ArrowLeft,
  BookOpen,
  List,
  Type,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Edit3,
  Maximize2,
  Minimize2,
  X,
  Check,
  Palette,
} from 'lucide-react';
import { ReaderSession, ReaderChapter, AppSettings } from '../types';

interface ReaderViewProps {
  session: ReaderSession;
  settings: AppSettings;
  onClose: () => void;
  onOpenEditor?: () => void;
  onEditBook?: (path: string, filename: string, content: string) => void;
  onSyncToKindle: (path: string) => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

type ReaderTheme = 'omarchy' | 'sepia' | 'black' | 'light';

export const ReaderView: React.FC<ReaderViewProps> = ({
  session,
  settings: _settings,
  onClose,
  onOpenEditor,
  onEditBook,
  onSyncToKindle,
  onNotify,
}) => {
  // Saved reading position in localStorage
  const storageKey = `kareader_pos_${session.path}`;
  const savedPos = (() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(
    savedPos?.chapterIndex ?? session.current_chapter ?? 0
  );
  const [chapterHtml, setChapterHtml] = useState<string>(session.chapter_html);
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Typography & Theme state with localStorage
  const [theme, setTheme] = useState<ReaderTheme>(() => {
    return (
      (localStorage.getItem('kareader_theme') ||
        localStorage.getItem('omawrite_reader_theme')) as ReaderTheme
    ) || 'omarchy';
  });
  const [fontSize, setFontSize] = useState<number>(() => {
    return (
      Number(
        localStorage.getItem('kareader_fontsize') ||
          localStorage.getItem('omawrite_reader_fontsize')
      ) || 18
    );
  });
  const [fontFamily, setFontFamily] = useState<string>(() => {
    return (
      localStorage.getItem('kareader_fontfamily') ||
      localStorage.getItem('omawrite_reader_fontfamily') ||
      'JetBrainsMono Nerd Font'
    );
  });
  const [lineHeight, setLineHeight] = useState<number>(() => {
    return (
      Number(
        localStorage.getItem('kareader_lineheight') ||
          localStorage.getItem('omawrite_reader_lineheight')
      ) || 1.8
    );
  });
  const [maxWidth, setMaxWidth] = useState<'normal' | 'wide' | 'full'>(() => {
    return (
      ((localStorage.getItem('kareader_maxwidth') ||
        localStorage.getItem('omawrite_reader_maxwidth')) as any) || 'normal'
    );
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Save preferences
  useEffect(() => {
    localStorage.setItem('kareader_theme', theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem('kareader_fontsize', fontSize.toString());
  }, [fontSize]);
  useEffect(() => {
    localStorage.setItem('kareader_fontfamily', fontFamily);
  }, [fontFamily]);
  useEffect(() => {
    localStorage.setItem('kareader_lineheight', lineHeight.toString());
  }, [lineHeight]);
  useEffect(() => {
    localStorage.setItem('kareader_maxwidth', maxWidth);
  }, [maxWidth]);

  // Load a chapter by index
  const loadChapter = useCallback(
    async (idx: number) => {
      if (idx < 0 || idx >= session.total_chapters) return;
      setLoadingChapter(true);
      try {
        const res = await invoke<ReaderChapter>('get_book_chapter', {
          path: session.path,
          chapterIndex: idx,
        });
        setCurrentChapterIndex(res.chapter_index);
        setChapterHtml(res.html);
        if (scrollRef.current) {
          scrollRef.current.scrollTop = 0;
        }
        localStorage.setItem(storageKey, JSON.stringify({ chapterIndex: res.chapter_index }));
      } catch (e: any) {
        onNotify(`Lỗi tải chương: ${String(e)}`, 'error');
      } finally {
        setLoadingChapter(false);
      }
    },
    [session.path, session.total_chapters, storageKey, onNotify]
  );

  // If saved chapter index was different from initial chapter 0, load it
  useEffect(() => {
    if (savedPos?.chapterIndex && savedPos.chapterIndex !== 0 && session.format === 'epub') {
      loadChapter(savedPos.chapterIndex);
    }
  }, []);

  // Track scroll progress
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll <= 0) {
      setScrollProgress(100);
    } else {
      const pct = Math.min(100, Math.max(0, Math.round((scrollTop / maxScroll) * 100)));
      setScrollProgress(pct);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Escape') {
        if (isTocOpen) setIsTocOpen(false);
        else if (isStyleMenuOpen) setIsStyleMenuOpen(false);
        else if (isZenMode) setIsZenMode(false);
        else onClose();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (session.total_chapters > 1 && currentChapterIndex > 0) {
          loadChapter(currentChapterIndex - 1);
        }
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (session.total_chapters > 1 && currentChapterIndex < session.total_chapters - 1) {
          loadChapter(currentChapterIndex + 1);
        }
      } else if (e.key === 't' || e.key === 'T') {
        setIsTocOpen((prev) => !prev);
      } else if (e.key === 'z' || e.key === 'Z') {
        setIsZenMode((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isTocOpen,
    isStyleMenuOpen,
    isZenMode,
    session.total_chapters,
    currentChapterIndex,
    loadChapter,
    onClose,
  ]);

  // Sync to Kindle
  const handleSync = async () => {
    setSyncing(true);
    try {
      onNotify(`Đang bắn "${session.title}" sang Kindle KOReader...`, 'success');
      await onSyncToKindle(session.path);
      onNotify(`Đã đồng bộ thành công sang KOReader!`, 'success');
    } catch (e: any) {
      onNotify(`Lỗi đồng bộ: ${String(e)}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Theme styles
  const themeStyles = {
    omarchy: {
      bg: 'bg-[#111c18]',
      text: 'text-[#C1C497]',
      accent: 'text-[#509475]',
      border: 'border-[#509475]/30',
      barBg: 'bg-[#0c1512]',
      prose: 'prose-invert',
      card: 'bg-[#0c1512]',
    },
    sepia: {
      bg: 'bg-[#fbf0d9]',
      text: 'text-[#433422]',
      accent: 'text-[#8c5e29]',
      border: 'border-[#dfcfb0]',
      barBg: 'bg-[#f4e4c3]',
      prose: 'prose-sepia',
      card: 'bg-[#f4e4c3]',
    },
    black: {
      bg: 'bg-[#000000]',
      text: 'text-[#d4d4d4]',
      accent: 'text-[#10b981]',
      border: 'border-neutral-800',
      barBg: 'bg-[#0a0a0a]',
      prose: 'prose-invert',
      card: 'bg-[#0a0a0a]',
    },
    light: {
      bg: 'bg-[#fcfcfc]',
      text: 'text-[#222222]',
      accent: 'text-[#2d6a4f]',
      border: 'border-neutral-200',
      barBg: 'bg-[#f1f3f5]',
      prose: '',
      card: 'bg-[#ffffff]',
    },
  }[theme];

  const maxWidthClass = {
    normal: 'max-w-[720px]',
    wide: 'max-w-[920px]',
    full: 'max-w-none px-8',
  }[maxWidth];

  return (
    <div className={`flex flex-col h-full w-full select-text ${themeStyles.bg} ${themeStyles.text} transition-colors duration-200 relative overflow-hidden`}>
      {/* Top Header Bar */}
      {!isZenMode && (
        <header
          className={`h-14 border-b shrink-0 px-4 flex items-center justify-between select-none z-20 ${themeStyles.barBg} ${themeStyles.border}`}
        >
          {/* Left: Back to Library or Editor */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={onClose}
              className={`p-2 rounded-lg border text-xs font-mono transition-all cursor-pointer ${themeStyles.border} hover:opacity-80`}
              title="Quay lại Thư viện (Esc)"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>

            {onOpenEditor && (
              <button
                onClick={onOpenEditor}
                className={`p-2 rounded-lg border text-xs font-mono transition-all cursor-pointer ${themeStyles.border} hover:opacity-80`}
                title="Quay lại Trình soạn thảo (Kareader)"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="h-5 w-[1px] bg-current opacity-20 mx-1 shrink-0" />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded border ${themeStyles.border} opacity-80`}>
                  {session.format}
                </span>
                <h2 className="text-xs font-semibold truncate" title={session.title}>
                  {session.title}
                </h2>
              </div>
              <p className="text-[11px] opacity-60 truncate">
                {session.author}
                {session.total_chapters > 1 && (
                  <span className="ml-2 font-mono">
                    • Chương {currentChapterIndex + 1}/{session.total_chapters}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Table of Contents Button */}
            <button
              onClick={() => setIsTocOpen(!isTocOpen)}
              className={`p-2 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                isTocOpen ? 'bg-black/20 font-semibold ring-1 ring-emerald-500' : ''
              } ${themeStyles.border}`}
              title="Mục lục & Các chương (T)"
            >
              <List className="w-3.5 h-3.5" />
            </button>

            {/* Typography & Theme Popover Toggle */}
            <div className="relative">
              <button
                onClick={() => setIsStyleMenuOpen(!isStyleMenuOpen)}
                className={`p-2 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                  isStyleMenuOpen ? 'bg-black/20 font-semibold ring-1 ring-emerald-500' : ''
                } ${themeStyles.border}`}
                title="Tùy chỉnh font chữ & giao diện đọc"
              >
                <Type className="w-3.5 h-3.5" />
              </button>

              {/* Style & Theme Dropdown Menu */}
              {isStyleMenuOpen && (
                <div
                  className={`absolute right-0 top-full mt-2 w-72 rounded-xl p-4 shadow-2xl border z-50 animate-in fade-in zoom-in-95 duration-150 ${themeStyles.card} ${themeStyles.border}`}
                >
                  <div className="flex items-center justify-between pb-2 mb-3 border-b opacity-40">
                    <span className="text-xs font-semibold font-mono flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5" /> Tùy chỉnh đọc
                    </span>
                    <button
                      onClick={() => setIsStyleMenuOpen(false)}
                      className="cursor-pointer opacity-70 hover:opacity-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Themes */}
                  <div className="mb-4">
                    <label className="text-[11px] font-mono opacity-70 block mb-1.5">Màu nền</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(
                        [
                          { id: 'omarchy', label: 'Omarchy', bg: 'bg-[#111c18]', text: 'text-[#C1C497]' },
                          { id: 'sepia', label: 'Sepia', bg: 'bg-[#fbf0d9]', text: 'text-[#433422]' },
                          { id: 'black', label: 'OLED', bg: 'bg-[#000000]', text: 'text-[#ffffff]' },
                          { id: 'light', label: 'Sáng', bg: 'bg-[#ffffff]', text: 'text-[#222222]' },
                        ] as const
                      ).map((th) => (
                        <button
                          key={th.id}
                          onClick={() => setTheme(th.id)}
                          className={`py-1.5 px-2 rounded-lg border text-[10px] font-mono flex flex-col items-center gap-1 cursor-pointer transition-all ${th.bg} ${th.text} ${
                            theme === th.id ? 'ring-2 ring-emerald-500 font-bold' : 'opacity-80 hover:opacity-100'
                          }`}
                        >
                          <span>{th.label}</span>
                          {theme === th.id && <Check className="w-2.5 h-2.5" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Size */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-[11px] font-mono opacity-70">Cỡ chữ</label>
                      <span className="text-xs font-mono font-bold">{fontSize}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setFontSize((s) => Math.max(12, s - 2))}
                        className={`flex-1 py-1 rounded border text-xs font-mono cursor-pointer hover:bg-black/10 ${themeStyles.border}`}
                      >
                        A -
                      </button>
                      <button
                        onClick={() => setFontSize((s) => Math.min(32, s + 2))}
                        className={`flex-1 py-1 rounded border text-xs font-mono cursor-pointer hover:bg-black/10 ${themeStyles.border}`}
                      >
                        A +
                      </button>
                    </div>
                  </div>

                  {/* Font Family */}
                  <div className="mb-4">
                    <label className="text-[11px] font-mono opacity-70 block mb-1.5">Font chữ</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'IBM Plex Mono', label: 'Mono' },
                        { id: 'Merriweather, Georgia, serif', label: 'Serif' },
                        { id: '-apple-system, system-ui, sans-serif', label: 'Sans' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setFontFamily(f.id)}
                          className={`py-1.5 px-2 rounded-lg border text-[11px] font-mono cursor-pointer transition-all ${themeStyles.border} ${
                            fontFamily === f.id ? 'bg-emerald-500/20 font-bold border-emerald-500' : 'opacity-70 hover:opacity-100'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Line Height & Width */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-mono opacity-70 block mb-1">Dãn dòng</label>
                      <select
                        value={lineHeight}
                        onChange={(e) => setLineHeight(Number(e.target.value))}
                        className={`w-full p-1 rounded border text-xs font-mono cursor-pointer bg-transparent ${themeStyles.border}`}
                      >
                        <option value={1.5} className="text-black">1.5x</option>
                        <option value={1.8} className="text-black">1.8x</option>
                        <option value={2.0} className="text-black">2.0x</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-mono opacity-70 block mb-1">Độ rộng</label>
                      <select
                        value={maxWidth}
                        onChange={(e) => setMaxWidth(e.target.value as any)}
                        className={`w-full p-1 rounded border text-xs font-mono cursor-pointer bg-transparent ${themeStyles.border}`}
                      >
                        <option value="normal" className="text-black">Chuẩn (720px)</option>
                        <option value="wide" className="text-black">Rộng (920px)</option>
                        <option value="full" className="text-black">Toàn viền</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Edit in Omawrite (if Markdown or Text) */}
            {['md', 'txt', 'markdown'].includes(session.format.toLowerCase()) && session.raw_text && onEditBook && (
              <button
                onClick={() => onEditBook(session.path, session.filename, session.raw_text!)}
                className={`p-2 rounded-lg border text-xs font-mono transition-all cursor-pointer ${themeStyles.border} hover:opacity-80`}
                title="Mở chỉnh sửa trực tiếp tệp này trong Kareader"
              >
                <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            )}

            {/* Sync to Kindle Button */}
            <button
              onClick={handleSync}
              disabled={syncing}
              className={`p-2 rounded-lg bg-[#509475] hover:bg-[#63b07a] text-[#0c1512] font-semibold text-xs font-mono transition-all cursor-pointer shadow-sm active:scale-95`}
              title="Bắn trực tiếp sang KOReader qua Wi-Fi SFTP"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            </button>

            {/* Zen Mode Button */}
            <button
              onClick={() => setIsZenMode(true)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${themeStyles.border} opacity-80 hover:opacity-100`}
              title="Chế độ đọc tập trung (Zen Mode - phím Z)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>
      )}

      {/* Reading Progress Bar (Top) */}
      <div className="h-0.5 w-full bg-black/10 shrink-0 relative overflow-hidden">
        <div
          className="h-full bg-[#509475] transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Zen Mode Exit Button Overlay */}
      {isZenMode && (
        <button
          onClick={() => setIsZenMode(false)}
          className="fixed top-3 right-4 z-50 p-2 rounded-full bg-black/60 text-white/80 hover:text-white  border border-white/20 transition-all cursor-pointer shadow-xl hover:scale-110"
          title="Thoát chế độ Zen (Esc hoặc Z)"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Table of Contents Drawer */}
        {isTocOpen && (
          <aside
            className={`w-80 h-full border-r shrink-0 flex flex-col z-30 animate-in slide-in-from-left duration-200 ${themeStyles.card} ${themeStyles.border}`}
          >
            <div className="h-12 px-4 border-b flex items-center justify-between opacity-80 font-mono text-xs">
              <span className="font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#509475]" />
                Mục lục ({session.toc.length})
              </span>
              <button
                onClick={() => setIsTocOpen(false)}
                className="cursor-pointer hover:opacity-100 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs">
              {session.toc.map((item, idx) => {
                const isSelected = item.chapter_index === currentChapterIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      loadChapter(item.chapter_index);
                      if (window.innerWidth < 768) {
                        setIsTocOpen(false);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all truncate cursor-pointer ${
                      isSelected
                        ? 'bg-[#509475] text-[#0c1512] font-semibold shadow-sm'
                        : 'opacity-70 hover:opacity-100 hover:bg-black/10'
                    }`}
                  >
                    {item.title}
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        {/* Reader Canvas / Document Scroll View */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 h-full overflow-y-auto overflow-x-hidden flex flex-col items-center p-6 md:p-12 relative"
        >
          {/* Universal Reader Canvas: EPUB / PDF / CBZ / Markdown / TXT */}
          <article
            className={`w-full ${maxWidthClass} transition-all duration-150`}
            style={{
              fontFamily: fontFamily,
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight,
            }}
          >
            {loadingChapter ? (
              <div className="py-20 flex flex-col items-center justify-center opacity-60 font-mono text-xs gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-[#509475]" />
                <span>Đang tải nội dung...</span>
              </div>
            ) : (
              <div
                className="kareader-content omawrite-reader-content prose max-w-none focus:outline-none"
                dangerouslySetInnerHTML={{ __html: chapterHtml }}
              />
            )}

            {/* Bottom Multi-chapter / Multi-page Navigation */}
            {session.total_chapters > 1 && !loadingChapter && (
              <div className="mt-16 pt-8 border-t border-current opacity-30 flex items-center justify-between text-xs font-mono select-none">
                <button
                  onClick={() => loadChapter(currentChapterIndex - 1)}
                  disabled={currentChapterIndex <= 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-current disabled:opacity-20 hover:opacity-100 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{session.format === 'pdf' || session.format === 'cbz' ? 'Trang trước' : 'Chương trước'}</span>
                </button>

                <span className="opacity-80">
                  {session.format === 'pdf' || session.format === 'cbz' ? 'Trang' : 'Chương'} {currentChapterIndex + 1} / {session.total_chapters}
                </span>

                <button
                  onClick={() => loadChapter(currentChapterIndex + 1)}
                  disabled={currentChapterIndex >= session.total_chapters - 1}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-current disabled:opacity-20 hover:opacity-100 cursor-pointer disabled:cursor-not-allowed"
                >
                  <span>{session.format === 'pdf' || session.format === 'cbz' ? 'Trang kế' : 'Chương sau'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </article>
        </div>
      </div>

      {/* Reader CSS overrides for parsed EPUB & Markdown content */}
      <style>{'\
        .kareader-content, .omawrite-reader-content {\
          word-break: break-word;\
        }\
        .omawrite-reader-content p {\
          margin-bottom: 1.25em;\
          text-align: justify;\
        }\
        .omawrite-reader-content h1, .omawrite-reader-content h2, .omawrite-reader-content h3 {\
          font-weight: 700;\
          line-height: 1.3;\
          margin-top: 1.8em;\
          margin-bottom: 0.6em;\
        }\
        .omawrite-reader-content h1 { font-size: 1.8em; border-bottom: 1px solid currentColor; opacity: 0.9; padding-bottom: 0.3em; }\
        .omawrite-reader-content h2 { font-size: 1.4em; }\
        .omawrite-reader-content h3 { font-size: 1.2em; }\
        .omawrite-reader-content img, .omawrite-reader-content image {\
          max-width: 100%;\
          height: auto;\
          margin: 1.5em auto;\
          display: block;\
          border-radius: 8px;\
        }\
        .omawrite-reader-content blockquote {\
          border-left: 3px solid #509475;\
          padding-left: 1.2em;\
          margin: 1.5em 0;\
          font-style: italic;\
          opacity: 0.85;\
        }\
        .omawrite-reader-content ul, .omawrite-reader-content ol {\
          margin: 1em 0;\
          padding-left: 1.6em;\
        }\
        .omawrite-reader-content li {\
          margin-bottom: 0.4em;\
        }\
        .omawrite-reader-content pre {\
          background-color: rgba(0,0,0,0.25);\
          padding: 1em;\
          border-radius: 8px;\
          overflow-x: auto;\
          margin: 1.2em 0;\
          font-size: 0.9em;\
        }\
        .omawrite-reader-content code {\
          background-color: rgba(0,0,0,0.15);\
          padding: 0.2em 0.4em;\
          border-radius: 4px;\
          font-size: 0.9em;\
        }\
        .omawrite-reader-content table {\
          width: 100%;\
          border-collapse: collapse;\
          margin: 1.5em 0;\
        }\
        .omawrite-reader-content th, .omawrite-reader-content td {\
          border: 1px solid rgba(128,128,128,0.3);\
          padding: 8px 12px;\
          text-align: left;\
        }\
      '}</style>
    </div>
  );
};
