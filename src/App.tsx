import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { CornerHUD } from './components/CornerHUD';
import { EditorView, EditorViewRef } from './components/EditorView';
import { LibraryView } from './components/LibraryView';
import { ReaderView } from './components/ReaderView';
import { SettingsModal } from './components/SettingsModal';
import { KualInstallModal } from './components/KualInstallModal';
import {
  AppSettings,
  BookMetadata,
  EditorDocument,
  KualInstallResult,
  KualPackageInfo,
  OmarchyTheme,
  ReaderSession,
  TransferResult,
} from './types';
import { CheckCircle2, AlertCircle, X, Upload } from 'lucide-react';

const DEFAULT_SETTINGS: AppSettings = {
  kindle_ip: '192.168.1.15',
  kindle_port: 2222,
  kindle_user: 'root',
  kindle_password: '',
  remote_books_dir: '/mnt/us/documents/Books',
  local_library_dir: '/home/ka/.local/share/kareader/books',
  editor_font: 'JetBrainsMono Nerd Font',
};

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'editor' | 'local' | 'kindle' | 'reader'>('editor');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [books, setBooks] = useState<BookMetadata[]>([]);
  const [fonts, setFonts] = useState<string[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [kindleConnected, setKindleConnected] = useState<boolean | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('Tài liệu mới');
  const [kualPackageInfo, setKualPackageInfo] = useState<KualPackageInfo | null>(null);
  const [isKualModalOpen, setIsKualModalOpen] = useState(false);

  // Font size state
  const [fontSize, setFontSize] = useState<number>(() => {
    return (
      Number(
        localStorage.getItem('kareader_font_size') ||
          localStorage.getItem('omawrite_font_size')
      ) || 18
    );
  });

  // Editor document statistics
  const [docStats, setDocStats] = useState({
    wordCount: 0,
    charCount: 0,
    readingTimeMinutes: 1,
  });

  // Active Reader Session
  const [readingSession, setReadingSession] = useState<ReaderSession | null>(null);

  // Active Document in Editor (directly bound to disk file when opened)
  const [currentDoc, setCurrentDoc] = useState<EditorDocument>({
    path: null,
    filename: 'Ghi chép mới.md',
    content: `# Ghi chép mới

Ứng dụng viết văn bản tối giản kết hợp quản lý tài liệu và đồng bộ không dây sang máy đọc sách Kindle KOReader.

## Tính năng nổi bật
- Soạn thảo và chỉnh sửa trực tiếp các tệp văn bản trên máy tính.
- Giao diện 4 góc Zen HUD tối giản, không chiếm dụng không gian.
- Kháng hoàn toàn lỗi nuốt chữ bộ gõ tiếng Việt Fcitx5.
- Đồng bộ 1-Click sang KOReader qua Wi-Fi SFTP.
`,
    author: 'Ka',
    isDirty: false,
  });

  const editorRef = useRef<EditorViewRef | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Notify toast helper
  const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast((prev) => (prev?.msg === msg ? null : prev));
    }, 4500);
  }, []);

  // Apply Omarchy Theme
  const applyTheme = useCallback(async () => {
    try {
      const theme = await invoke<OmarchyTheme>('load_omarchy_theme');
      const root = document.documentElement;
      root.style.setProperty('--bg', theme.background);
      root.style.setProperty('--bg-dark', theme.dark_background);
      root.style.setProperty('--bg-lighter', theme.lighter_background);
      root.style.setProperty('--fg', theme.foreground);
      root.style.setProperty('--accent', theme.accent);
      root.style.setProperty('--muted', theme.muted);
    } catch {
      // Fallback to default
    }
  }, []);

  // Check KOReader SSH Connection
  const checkConnection = useCallback(async () => {
    setCheckingConnection(true);
    try {
      await invoke<string>('test_kindle_connection', {
        ip: settings.kindle_ip,
        port: settings.kindle_port,
        user: settings.kindle_user || 'root',
        password: settings.kindle_password || '',
      });
      setKindleConnected(true);
    } catch {
      setKindleConnected(false);
    } finally {
      setCheckingConnection(false);
    }
  }, [settings.kindle_ip, settings.kindle_port, settings.kindle_user, settings.kindle_password]);

  // Load Library
  const refreshLibrary = useCallback(async () => {
    setLoadingBooks(true);
    try {
      const list = await invoke<BookMetadata[]>('scan_library', { customDir: null });
      setBooks(list);
    } catch (e: any) {
      notify(`Lỗi quét thư viện: ${String(e)}`, 'error');
    } finally {
      setLoadingBooks(false);
    }
  }, [notify]);

  // Initial Load
  useEffect(() => {
    applyTheme();

    // Load system fonts
    invoke<string[]>('get_system_fonts')
      .then((f) => setFonts(f))
      .catch(() => {});

    // Global shortcuts: F2 or Ctrl+L toggles between Editor and Local Library
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'F2') ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L'))
      ) {
        e.preventDefault();
        setCurrentTab((prev) => (prev === 'local' ? 'editor' : 'local'));
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);

    // Load settings with strict font sanitization
    invoke<AppSettings>('load_settings')
      .then((loaded) => {
        const cleanFont =
          loaded.editor_font && loaded.editor_font.toLowerCase() !== 'omarchy'
            ? loaded.editor_font
            : 'JetBrainsMono Nerd Font';
        setSettings({
          ...loaded,
          kindle_user: loaded.kindle_user || 'root',
          editor_font: cleanFont,
        });
      })
      .catch(() => {});

    refreshLibrary();
  }, [applyTheme, refreshLibrary]);

  // Drag and drop file listener
  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;
    try {
      getCurrentWindow()
        .onDragDropEvent(async (event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            setIsDragging(true);
          } else if (event.payload.type === 'leave') {
            setIsDragging(false);
          } else if (event.payload.type === 'drop') {
            setIsDragging(false);
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              // Intercept single .zip dropped to check if it's a KUAL extension package
              if (paths.length === 1 && paths[0].toLowerCase().endsWith('.zip')) {
                try {
                  notify(`Đang phân tích gói KUAL: ${paths[0].split('/').pop()}...`, 'success');
                  const info = await invoke<KualPackageInfo>('inspect_kual_zip', { zipPath: paths[0] });
                  setKualPackageInfo(info);
                  setIsKualModalOpen(true);
                  return;
                } catch {
                  // Not a KUAL package, fallback to regular library import
                }
              }

              notify(`Đang nạp ${paths.length} file vào thư viện...`, 'success');
              let firstImportedPath = '';
              for (const p of paths) {
                try {
                  const dest = await invoke<string>('import_file_to_library', { sourcePath: p });
                  if (!firstImportedPath) firstImportedPath = dest;
                } catch (err: any) {
                  notify(`Lỗi nạp ${p}: ${String(err)}`, 'error');
                }
              }
              notify(`Đã nạp thành công các tệp vào thư viện!`, 'success');
              refreshLibrary();

              // Open markdown directly if dropped
              if (
                firstImportedPath &&
                (firstImportedPath.endsWith('.md') || firstImportedPath.endsWith('.txt'))
              ) {
                try {
                  const content = await invoke<string>('read_text_file', { path: firstImportedPath });
                  const fname = firstImportedPath.split('/').pop() || 'tai-lieu.md';
                  setCurrentDoc({
                    path: firstImportedPath,
                    filename: fname,
                    author: 'Ka',
                    content,
                    isDirty: false,
                  });
                  setSaveStatus(`Đã mở: ${fname}`);
                  setCurrentTab('editor');
                  notify(`Đã mở trực tiếp "${fname}" vào trình soạn thảo`, 'success');
                } catch {
                  // Ignore
                }
              }
            }
          }
        })
        .then((fn) => {
          unlisten = fn;
        })
        .catch(() => {});
    } catch {
      // Ignore
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, [notify, refreshLibrary]);

  // Check connection when settings change
  useEffect(() => {
    if (settings.kindle_ip) {
      checkConnection();
    }
  }, [settings.kindle_ip, settings.kindle_port, settings.kindle_user, settings.kindle_password, checkConnection]);

  // Save Settings
  const handleSaveSettings = async (newSettings: AppSettings) => {
    await invoke('save_settings', { settings: newSettings });
    setSettings(newSettings);
    notify('Đã lưu cấu hình KOReader & Thư viện', 'success');
    refreshLibrary();
    checkConnection();
  };

  // Font Selection
  const handleSelectFont = async (font: string) => {
    const updated = { ...settings, editor_font: font };
    setSettings(updated);
    await invoke('save_settings', { settings: updated });
    notify(`Đã chọn font: ${font}`, 'success');
  };

  // Font Size Change
  const handleChangeFontSize = (size: number) => {
    setFontSize(size);
    localStorage.setItem('kareader_font_size', String(size));
  };

  // Test Connection
  const handleTestConnection = async (ip: string, port: number, user: string, password: string) => {
    return await invoke<string>('test_kindle_connection', {
      ip,
      port,
      user,
      password,
    });
  };

  // Save Document DIRECTLY to File
  const handleSaveCurrentDoc = useCallback(async (): Promise<string> => {
    setSavingDoc(true);
    const contentToSave = editorRef.current ? editorRef.current.getCurrentText() : currentDoc.content;

    let targetPath = currentDoc.path;
    if (!targetPath) {
      const cleanName = currentDoc.filename.endsWith('.md')
        ? currentDoc.filename
        : `${currentDoc.filename}.md`;
      targetPath = `${settings.local_library_dir}/${cleanName}`;
    }

    try {
      await invoke<string>('save_markdown_file', {
        path: targetPath,
        content: contentToSave,
      });

      setCurrentDoc((prev) => ({
        ...prev,
        path: targetPath,
        content: contentToSave,
        isDirty: false,
      }));

      const timeStr = new Date().toLocaleTimeString();
      setSaveStatus(`✓ Đã lưu lúc ${timeStr}`);
      notify(`Đã lưu trực tiếp: ${currentDoc.filename}`, 'success');
      refreshLibrary();
      return targetPath;
    } catch (e: any) {
      notify(`Lỗi lưu file: ${String(e)}`, 'error');
      throw e;
    } finally {
      setSavingDoc(false);
    }
  }, [currentDoc.path, currentDoc.filename, currentDoc.content, settings.local_library_dir, notify, refreshLibrary]);

  // Rename Document
  const handleRenameDoc = (filename: string, author: string) => {
    setCurrentDoc((prev) => ({
      ...prev,
      filename,
      author,
      isDirty: true,
    }));
    setSaveStatus('● Chưa lưu (Ctrl+S)');
  };

  // Stable callback for document dirty changes without triggering re-render cascades
  const handleDocChangeDirty = useCallback((dirty: boolean) => {
    setCurrentDoc((prev) => (prev.isDirty === dirty ? prev : { ...prev, isDirty: dirty }));
    if (dirty) setSaveStatus('● Chưa lưu (Ctrl+S)');
  }, []);

  // Create New Document
  const handleNewDoc = () => {
    const defaultName = `Ghi-chep-${new Date().toISOString().slice(0, 10)}.md`;
    setCurrentDoc({
      path: null,
      filename: defaultName,
      content: '# Tiêu đề bài viết\n\nBắt đầu viết ở đây...\n',
      author: 'Ka',
      isDirty: false,
    });
    setSaveStatus('Tài liệu mới');
    setCurrentTab('editor');
    notify('Đã tạo tài liệu mới', 'success');
  };

  // Open file from disk via File Dialog directly into Editor
  const handleOpenFileFromDisk = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Markdown & Text Files', extensions: ['md', 'txt', 'markdown'] }],
      });
      if (selected && typeof selected === 'string') {
        notify(`Đang mở: ${selected}...`, 'success');
        const content = await invoke<string>('read_text_file', { path: selected });
        const filename = selected.split('/').pop() || 'tai-lieu.md';

        setCurrentDoc({
          path: selected,
          filename,
          author: 'Ka',
          content,
          isDirty: false,
        });
        setSaveStatus(`Đã mở: ${filename}`);
        setCurrentTab('editor');
        notify(`Đã mở thành công: ${filename}`, 'success');
      }
    } catch (e: any) {
      notify(`Lỗi mở file: ${String(e)}`, 'error');
    }
  };

  // Edit Book directly from Library or Reader
  const handleEditBook = async (book: BookMetadata) => {
    try {
      notify(`Đang nạp "${book.filename}" để chỉnh sửa...`, 'success');
      const content = await invoke<string>('read_text_file', { path: book.path });
      setCurrentDoc({
        path: book.path,
        filename: book.filename,
        author: book.author || 'Ka',
        content,
        isDirty: false,
      });
      setSaveStatus(`Đã mở: ${book.filename}`);
      setCurrentTab('editor');
      notify(`Đã mở "${book.filename}" vào trình soạn thảo`, 'success');
    } catch (e: any) {
      notify(`Không thể mở tệp: ${String(e)}`, 'error');
    }
  };

  // Edit Book from Reader with raw text
  const handleEditFromReader = (path: string, filename: string, content: string) => {
    setCurrentDoc({
      path,
      filename,
      author: 'Ka',
      content,
      isDirty: false,
    });
    setSaveStatus(`Đã nạp: ${filename}`);
    setCurrentTab('editor');
    notify(`Đã nạp "${filename}" vào trình soạn thảo`, 'success');
  };

  // Sync Markdown / EPUB to Kindle KOReader
  const handleSyncMarkdownToKindle = async (asEpub: boolean) => {
    const contentToSend = editorRef.current ? editorRef.current.getCurrentText() : currentDoc.content;
    const modeStr = asEpub ? 'EPUB' : 'Markdown (.md)';

    notify(`Đang đồng bộ dạng ${modeStr} sang KOReader qua Wi-Fi...`, 'success');
    const res = await invoke<TransferResult>('send_markdown_to_kindle', {
      ip: settings.kindle_ip,
      port: settings.kindle_port,
      user: settings.kindle_user || 'root',
      password: settings.kindle_password || '',
      remoteDir: settings.remote_books_dir,
      title: currentDoc.filename,
      author: currentDoc.author || 'Ka',
      content: contentToSend,
      asEpub,
    });

    if (!res.success) {
      notify(`Lỗi đồng bộ: ${res.message}`, 'error');
      throw new Error(res.message);
    }

    notify(`Đã đồng bộ thành công "${currentDoc.filename}" sang KOReader!`, 'success');
    setKindleConnected(true);
    setSaveStatus(`Đã gửi KOReader (${modeStr})`);
    refreshLibrary();
  };

  // Sync single book file from library to Kindle
  const handleSyncBookToKindle = async (localPath: string) => {
    const res = await invoke<TransferResult>('send_book_to_kindle', {
      ip: settings.kindle_ip,
      port: settings.kindle_port,
      user: settings.kindle_user || 'root',
      password: settings.kindle_password || '',
      remoteDir: settings.remote_books_dir,
      localPath,
    });
    if (!res.success) {
      throw new Error(res.message);
    }
    setKindleConnected(true);
  };

  // Sync All / Quick Sync between PC and Kindle
  const handleSyncAll = async () => {
    if (books.length === 0) {
      notify('Thư viện máy tính chưa có tài liệu nào để đồng bộ', 'error');
      return;
    }
    setSyncingAll(true);
    try {
      notify('Đang đồng bộ tài liệu giữa Máy tính và Máy đọc sách...', 'success');
      for (const book of books.slice(0, 3)) {
        await handleSyncBookToKindle(book.path);
      }
      notify(`Đã đồng bộ thành công các tài liệu sang KOReader!`, 'success');
    } catch (e: any) {
      notify(`Lỗi đồng bộ: ${String(e)}`, 'error');
    } finally {
      setSyncingAll(false);
    }
  };

  // Import File via Dialog
  const handleImportFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Ebooks & Docs', extensions: ['epub', 'pdf', 'md', 'txt', 'mobi', 'cbz'] }],
      });
      if (selected && typeof selected === 'string') {
        notify('Đang sao chép file vào thư viện...', 'success');
        const imported = await invoke<string>('import_file_to_library', { sourcePath: selected });
        notify(`Đã nạp thành công: ${imported}`, 'success');
        refreshLibrary();
      }
    } catch (e: any) {
      notify(`Lỗi nhập file: ${String(e)}`, 'error');
    }
  };

  // Open Book in Reader
  const handleOpenBook = async (book: BookMetadata) => {
    try {
      notify(`Đang mở "${book.title}" trong chế độ đọc...`, 'success');
      const session = await invoke<ReaderSession>('open_book_reader', { path: book.path });
      setReadingSession(session);
      setCurrentTab('reader');
    } catch (e: any) {
      notify(`Không thể mở sách: ${String(e)}`, 'error');
    }
  };

  // Open KUAL Extension Dialog & Wireless Installation
  const handleOpenKualExtensionDialog = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: 'KUAL Extension ZIP',
            extensions: ['zip'],
          },
        ],
      });
      if (selected && typeof selected === 'string') {
        notify(`Đang phân tích gói: ${selected.split('/').pop()}...`, 'success');
        const info = await invoke<KualPackageInfo>('inspect_kual_zip', { zipPath: selected });
        setKualPackageInfo(info);
        setIsKualModalOpen(true);
      }
    } catch (err: any) {
      notify(`Lỗi đọc gói KUAL: ${String(err)}`, 'error');
    }
  }, [notify]);

  const handleInstallKual = useCallback(
    async (preserveDb: boolean): Promise<KualInstallResult> => {
      if (!kualPackageInfo) {
        throw new Error('Chưa chọn gói KUAL Extension');
      }
      notify(`Đang tải ${kualPackageInfo.name} sang Kindle qua SFTP...`, 'success');
      const result = await invoke<KualInstallResult>('install_kual_extension', {
        ip: settings.kindle_ip,
        port: settings.kindle_port,
        user: settings.kindle_user || 'root',
        password: settings.kindle_password || '',
        zipPath: kualPackageInfo.zip_path,
        preserveDb,
      });
      notify(`Đã cài đặt thành công ${kualPackageInfo.name} vào Kindle!`, 'success');
      return result;
    },
    [kualPackageInfo, settings, notify]
  );

  // Export Dialog
  const handleExportCurrent = async () => {
    try {
      const content = editorRef.current ? editorRef.current.getCurrentText() : currentDoc.content;
      const filePath = await save({
        defaultPath: currentDoc.filename,
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'EPUB Ebook', extensions: ['epub'] },
        ],
      });
      if (filePath) {
        if (filePath.endsWith('.epub')) {
          await invoke('export_markdown_to_epub', {
            title: currentDoc.filename.replace(/\.[^/.]+$/, ''),
            author: currentDoc.author || 'Ka',
            markdownContent: content,
            outputFile: filePath,
          });
        } else {
          await invoke('save_markdown_file', { path: filePath, content });
        }
        notify(`Đã xuất file thành công ra: ${filePath}`, 'success');
      }
    } catch (e: any) {
      notify(`Lỗi xuất file: ${String(e)}`, 'error');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#111c18] text-[#C1C497] relative select-none">
      {/* 4-Corner HUD: Absolute Minimalist Omarchy Experience */}
      {currentTab !== 'reader' && (
        <CornerHUD
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        doc={currentDoc}
        onNewDoc={handleNewDoc}
        onOpenFile={handleOpenFileFromDisk}
        onImportFile={handleImportFile}
        onSaveDoc={handleSaveCurrentDoc}
        saving={savingDoc}
        saveStatus={saveStatus}
        onRenameDoc={handleRenameDoc}
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        kindleConnected={kindleConnected}
        checkingConnection={checkingConnection}
        onCheckConnection={checkConnection}
        onSyncCurrentToKindle={handleSyncMarkdownToKindle}
        onSyncAll={handleSyncAll}
        syncing={syncingAll}
        onExportFile={handleExportCurrent}
        onInstallKualExtension={handleOpenKualExtensionDialog}
        readingBookTitle={readingSession?.title}
        fonts={fonts}
        currentFont={settings.editor_font || 'JetBrainsMono Nerd Font'}
        onSelectFont={handleSelectFont}
        fontSize={fontSize}
        onChangeFontSize={handleChangeFontSize}
        stats={docStats}
        />
      )}

      {/* Main Viewport Content Area: 100% Fullscreen Canvas */}
      <main className="flex-1 flex w-full h-full overflow-hidden">
        {currentTab === 'reader' && readingSession ? (
          <ReaderView
            session={readingSession}
            settings={settings}
            onClose={() => setCurrentTab('local')}
            onOpenEditor={() => setCurrentTab('editor')}
            onEditBook={handleEditFromReader}
            onSyncToKindle={handleSyncBookToKindle}
            onNotify={notify}
          />
        ) : currentTab === 'editor' ? (
          <EditorView
            key={currentDoc.path || currentDoc.filename}
            doc={currentDoc}
            currentFont={settings.editor_font || 'JetBrainsMono Nerd Font'}
            fontSize={fontSize}
            onDocChangeDirty={handleDocChangeDirty}
            onStatsChange={setDocStats}
            onSaveShortcut={handleSaveCurrentDoc}
            onOpenLibrary={() => setCurrentTab('local')}
            editorRef={editorRef}
          />
        ) : (
          <LibraryView
              books={books}
              settings={settings}
              loading={loadingBooks}
              mode={currentTab === 'kindle' ? 'kindle' : 'local'}
              onRefresh={refreshLibrary}
              onOpenBook={handleOpenBook}
              onEditBook={handleEditBook}
              onSyncBookToKindle={handleSyncBookToKindle}
              onNotify={notify}
          />
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
        onTestConnection={handleTestConnection}
      />

      {/* KUAL Extension Installer Modal */}
      <KualInstallModal
        isOpen={isKualModalOpen}
        onClose={() => setIsKualModalOpen(false)}
        packageInfo={kualPackageInfo}
        settings={settings}
        kindleConnected={kindleConnected}
        onCheckConnection={checkConnection}
        onInstall={handleInstallKual}
      />

      {/* Drag and Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-[#0c1512]/90  border-4 border-dashed border-[#509475] flex flex-col items-center justify-center p-8 pointer-events-none animate-in fade-in duration-150">
          <div className="w-20 h-20 rounded-2xl bg-[#509475]/20 flex items-center justify-center text-[#509475] mb-4">
            <Upload className="w-10 h-10 animate-bounce" />
          </div>
          <h3 className="text-xl font-bold text-[#F7E8B2] mb-2 font-mono">
            Thả file để nạp vào Thư viện sách
          </h3>
          <p className="text-sm text-[#81B8A8] font-mono">
            Hỗ trợ: .epub, .pdf, .md, .txt, .cbz, KUAL (.zip)
          </p>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-14 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0c1512] border border-[#509475] shadow-2xl text-xs font-mono animate-in slide-in-from-bottom duration-200">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="text-[#F7E8B2]">{toast.msg}</span>
          <button
            onClick={() => setToast(null)}
            className="text-[#53685B] hover:text-[#C1C497] ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};