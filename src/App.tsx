import React, { useState, useEffect, useCallback } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Header } from './components/Header';
import { EditorView } from './components/EditorView';
import { LibraryView } from './components/LibraryView';
import { ReaderView } from './components/ReaderView';
import { SettingsModal } from './components/SettingsModal';
import { AppSettings, BookMetadata, EditorDocument, OmarchyTheme, ReaderSession, TransferResult } from './types';
import { CheckCircle2, AlertCircle, X, Upload } from 'lucide-react';

const DEFAULT_SETTINGS: AppSettings = {
  kindle_ip: '192.168.1.15',
  kindle_port: 2222,
  kindle_user: 'root',
  kindle_password: '',
  remote_books_dir: '/mnt/us/documents/Books',
  local_library_dir: '/home/ka/Books',
  editor_font: 'IBM Plex Mono',
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
- Mở và lưu trực tiếp không qua trung gian.
- Xem trước và đọc sách với chế độ Zen Reader.
- Đồng bộ 1-Click sang KOReader qua Wi-Fi SFTP.
`,
    author: 'Ka',
    isDirty: false,
  });

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

    // Load settings
    invoke<AppSettings>('load_settings')
      .then((loaded) => {
        setSettings({
          ...loaded,
          kindle_user: loaded.kindle_user || 'root',
          editor_font: loaded.editor_font || 'IBM Plex Mono',
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
              notify(`Đang nhập ${paths.length} file vào thư viện...`, 'success');
              let firstImportedPath = '';
              for (const p of paths) {
                try {
                  const dest = await invoke<string>('import_file_to_library', { sourcePath: p });
                  if (!firstImportedPath) firstImportedPath = dest;
                } catch (err: any) {
                  notify(`Lỗi nhập ${p}: ${String(err)}`, 'error');
                }
              }
              notify(`Đã nạp thành công các tệp vào thư viện!`, 'success');
              refreshLibrary();

              // If user drops a markdown or text file while in editor, offer or open directly
              if (firstImportedPath && (firstImportedPath.endsWith('.md') || firstImportedPath.endsWith('.txt'))) {
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
                  setCurrentTab('editor');
                  notify(`Đã mở trực tiếp "${fname}" vào trình soạn thảo`, 'success');
                } catch {
                  // Ignore if error
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
      // Ignore if not in Tauri window context
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
  const handleSaveDoc = async (docToSave: EditorDocument): Promise<string> => {
    let targetPath = docToSave.path;

    if (!targetPath) {
      // If document is not yet saved to a path, place it in local library folder
      const cleanName = docToSave.filename.endsWith('.md')
        ? docToSave.filename
        : `${docToSave.filename}.md`;
      targetPath = `${settings.local_library_dir}/${cleanName}`;
    }

    await invoke<string>('save_markdown_file', {
      path: targetPath,
      content: docToSave.content,
    });

    const updatedDoc: EditorDocument = {
      ...docToSave,
      path: targetPath,
      isDirty: false,
    };
    setCurrentDoc(updatedDoc);
    refreshLibrary();
    return targetPath;
  };

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
        setCurrentTab('editor');
        notify(`Đã mở thành công tệp: ${filename}`, 'success');
      }
    } catch (e: any) {
      notify(`Lỗi mở file: ${String(e)}`, 'error');
    }
  };

  // Edit Book directly from Library or Reader
  const handleEditBook = async (book: BookMetadata) => {
    try {
      notify(`Đang mở "${book.filename}" để chỉnh sửa...`, 'success');
      const content = await invoke<string>('read_text_file', { path: book.path });
      setCurrentDoc({
        path: book.path,
        filename: book.filename,
        author: book.author || 'Ka',
        content,
        isDirty: false,
      });
      setCurrentTab('editor');
      notify(`Đã nạp file "${book.filename}" vào trình soạn thảo`, 'success');
    } catch (e: any) {
      notify(`Không thể mở tệp để sửa: ${String(e)}`, 'error');
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
    setCurrentTab('editor');
    notify(`Đã nạp "${filename}" vào trình soạn thảo`, 'success');
  };

  // Sync Markdown / EPUB to Kindle KOReader
  const handleSyncMarkdownToKindle = async (
    title: string,
    author: string,
    content: string,
    asEpub: boolean
  ) => {
    const res = await invoke<TransferResult>('send_markdown_to_kindle', {
      ip: settings.kindle_ip,
      port: settings.kindle_port,
      user: settings.kindle_user || 'root',
      password: settings.kindle_password || '',
      remoteDir: settings.remote_books_dir,
      title,
      author,
      content,
      asEpub,
    });
    if (!res.success) {
      throw new Error(res.message);
    }
    setKindleConnected(true);
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
        notify(`Đã nhập thành công: ${imported}`, 'success');
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

  // Read current draft from Editor
  const handleReadCurrentDocument = async (docToRead: EditorDocument) => {
    try {
      let filePath = docToRead.path;
      if (!filePath) {
        filePath = await handleSaveDoc(docToRead);
      } else {
        await invoke('save_markdown_file', { path: filePath, content: docToRead.content });
      }
      const session = await invoke<ReaderSession>('open_book_reader', { path: filePath });
      setReadingSession(session);
      setCurrentTab('reader');
    } catch (e: any) {
      notify(`Lỗi đọc tài liệu: ${String(e)}`, 'error');
    }
  };

  // Export Dialog
  const handleExportCurrent = async () => {
    try {
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
            markdownContent: currentDoc.content,
            outputFile: filePath,
          });
        } else {
          await invoke('save_markdown_file', { path: filePath, content: currentDoc.content });
        }
        notify(`Đã xuất file thành công ra: ${filePath}`, 'success');
      }
    } catch (e: any) {
      notify(`Lỗi xuất file: ${String(e)}`, 'error');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#111c18] text-[#C1C497]">
      {/* Header Bar (Hidden when in Reader mode to eliminate double headers) */}
      {currentTab !== 'reader' && (
        <Header
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          settings={settings}
          kindleConnected={kindleConnected}
          checkingConnection={checkingConnection}
          syncing={syncingAll}
          readingBookTitle={readingSession?.title}
          onSyncAll={handleSyncAll}
          onCheckConnection={checkConnection}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onImportFile={handleImportFile}
          onExportCurrent={handleExportCurrent}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
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
            doc={currentDoc}
            settings={settings}
            fonts={fonts}
            currentFont={settings.editor_font || 'IBM Plex Mono'}
            onSelectFont={handleSelectFont}
            onSaveDoc={handleSaveDoc}
            onNewDoc={handleNewDoc}
            onOpenFile={handleOpenFileFromDisk}
            onOpenLibrary={() => setCurrentTab('local')}
            onOpenInReader={handleReadCurrentDocument}
            onSyncMarkdownToKindle={handleSyncMarkdownToKindle}
            onNotify={notify}
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

      {/* Drag and Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-[#0c1512]/90 backdrop-blur-md border-4 border-dashed border-[#509475] flex flex-col items-center justify-center p-8 pointer-events-none animate-in fade-in duration-150">
          <div className="w-20 h-20 rounded-2xl bg-[#509475]/20 flex items-center justify-center text-[#509475] mb-4">
            <Upload className="w-10 h-10 animate-bounce" />
          </div>
          <h3 className="text-xl font-bold text-[#F7E8B2] mb-2 font-mono">
            Thả file để nạp vào Thư viện sách
          </h3>
          <p className="text-sm text-[#81B8A8] font-mono">
            Hỗ trợ: .epub, .pdf, .md, .txt, .mobi
          </p>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-12 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0c1512] border border-[#509475] shadow-2xl text-xs font-mono animate-in slide-in-from-bottom duration-200">
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
