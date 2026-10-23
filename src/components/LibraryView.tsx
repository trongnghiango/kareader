import React, { useState, useMemo, useDeferredValue } from 'react';
import { Search, RefreshCw, Book, FolderOpen, Monitor, Tablet, BookOpen, Edit3 } from 'lucide-react';
import { BookMetadata, AppSettings } from '../types';

interface LibraryViewProps {
  books: BookMetadata[];
  settings: AppSettings;
  loading: boolean;
  mode: 'local' | 'kindle';
  onRefresh: () => void;
  onOpenBook: (book: BookMetadata) => void;
  onEditBook: (book: BookMetadata) => void;
  onSyncBookToKindle: (localPath: string) => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface BookCardProps {
  book: BookMetadata;
  isSyncing: boolean;
  onOpen: (book: BookMetadata) => void;
  onEdit: (book: BookMetadata) => void;
  onSync: (book: BookMetadata) => void;
}

const BookCard = React.memo<BookCardProps>(({ book, isSyncing, onOpen, onEdit, onSync }) => {
  const isEditable = ['md', 'txt', 'markdown'].includes(book.format.toLowerCase());

  return (
    <div
      style={{ contain: 'content' }}
      className="group relative flex flex-col rounded-xl bg-[#0c1512] border border-[#509475]/25 hover:border-[#509475] transition-colors duration-100 overflow-hidden"
    >
      {/* Book Cover */}
      <div className="relative aspect-[3/4] bg-[#111c18] overflow-hidden flex items-center justify-center">
        {book.cover_data_url ? (
          <img
            src={book.cover_data_url}
            alt={book.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover select-none pointer-events-none"
          />
        ) : (
          <div className="w-full h-full p-4 flex flex-col justify-between bg-[#13221c] border-b border-[#509475]/20 select-none">
            <div className="flex justify-between items-start">
              <Book className="w-5 h-5 text-[#509475]/70" />
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#509475]/30 text-[#81B8A8] border border-[#509475]/40">
                {book.format}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#F7E8B2] line-clamp-3 leading-snug">
                {book.title}
              </p>
              <p className="text-[11px] text-[#53685B] mt-1 truncate">
                {book.author}
              </p>
            </div>
          </div>
        )}

        {/* Format Badge overlay if has cover */}
        {book.cover_data_url && (
          <span className="absolute top-2 right-2 text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-black/80 text-[#81B8A8] border border-[#509475]/40 pointer-events-none">
            {book.format}
          </span>
        )}

        {/* Action Overlay on Hover - instant 60 FPS, zero Gaussian blur */}
        <div className="absolute inset-0 bg-[#0c1512]/90 opacity-0 group-hover:opacity-100 transition-opacity duration-100 flex flex-col items-center justify-center p-3 gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen(book);
            }}
            className="w-full py-1.5 px-3 rounded-lg bg-[#509475] hover:bg-[#63b07a] text-[#0c1512] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-100"
            title="Mở chế độ đọc sách Zen"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Đọc sách</span>
          </button>

          {isEditable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(book);
              }}
              className="w-full py-1.5 px-3 rounded-lg bg-[#1d2e27] hover:bg-[#2a4338] border border-[#509475]/60 text-[#F7E8B2] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-100"
              title="Chỉnh sửa trực tiếp file này trong Kareader"
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sửa file</span>
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSync(book);
            }}
            disabled={isSyncing}
            className="w-full py-1.5 px-3 rounded-lg bg-[#111c18] border border-[#509475]/40 hover:border-[#509475] text-[#81B8A8] hover:text-[#F7E8B2] text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-100"
            title="Đồng bộ file này sang Máy đọc sách KOReader qua Wi-Fi"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Đang bắn...' : 'Gửi Kindle'}</span>
          </button>
        </div>
      </div>

      {/* Book Info below cover */}
      <div
        onClick={() => onOpen(book)}
        className="p-3 flex-1 flex flex-col justify-between cursor-pointer"
      >
        <div>
          <h4 className="text-xs font-semibold text-[#F7E8B2] line-clamp-1 leading-snug group-hover:text-emerald-400 transition-colors duration-100" title={book.title}>
            {book.title}
          </h4>
          <p className="text-[11px] text-[#81B8A8] truncate mt-0.5" title={book.author}>
            {book.author}
          </p>
        </div>
        <div className="flex items-center justify-between text-[10px] text-[#53685B] font-mono mt-2 pt-2 border-t border-[#509475]/15">
          <span>{formatSize(book.size_bytes)}</span>
          <div className="flex items-center gap-1.5">
            {isEditable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(book);
                }}
                title="Sửa file này"
                className="p-1 rounded text-[#81B8A8] hover:text-emerald-400 hover:bg-[#509475]/20 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            )}
            <span className="uppercase font-semibold text-[#509475]">
              {book.format}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  settings,
  loading,
  mode,
  onRefresh,
  onOpenBook,
  onEditBook,
  onSyncBookToKindle,
  onNotify,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // React 19 Concurrent deferred search: never blocks UI or lags keystrokes
  const deferredSearch = useDeferredValue(searchTerm);

  // Filter books efficiently
  const filteredBooks = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return books.filter((book) => {
      const matchSearch =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.filename.toLowerCase().includes(q);
      const matchFormat = selectedFormat === 'all' || book.format.toLowerCase() === selectedFormat;
      return matchSearch && matchFormat;
    });
  }, [books, deferredSearch, selectedFormat]);

  // Handle sync single book to Kindle
  const handleSyncBook = async (book: BookMetadata) => {
    setSyncingId(book.id);
    try {
      onNotify(`Đang đồng bộ "${book.title}" sang Máy đọc sách qua Wi-Fi...`, 'success');
      await onSyncBookToKindle(book.path);
      onNotify(`Đã đồng bộ thành công "${book.title}" sang KOReader!`, 'success');
    } catch (e: any) {
      onNotify(`Lỗi đồng bộ: ${String(e)}`, 'error');
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-[#111c18] overflow-hidden">
      {/* Top Filter & Search Bar */}
      <div className="h-14 border-b border-[#509475]/20 bg-[#0c1512] pl-16 pr-16 flex items-center justify-between gap-4 select-none shrink-0">
        {/* Device Mode Title */}
        <div className="flex items-center gap-2">
          {mode === 'local' ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F7E8B2]">
              <Monitor className="w-4 h-4 text-[#509475]" />
              <div className="flex flex-col">
                <span>Thư viện Kareader</span>
                <span className="text-[10px] text-[#53685B] font-mono font-normal leading-tight">{settings.local_library_dir}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F7E8B2]">
              <Tablet className="w-4 h-4 text-[#509475]" />
              <span>Thiết bị KOReader ({settings.kindle_ip})</span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#53685B]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên sách, tác giả..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#111c18] border border-[#509475]/30 text-xs text-[#F7E8B2] focus:outline-none focus:border-[#509475] font-mono placeholder:text-[#53685B]"
          />
        </div>

        {/* Format Chips */}
        <div className="flex items-center gap-1.5">
          {['all', 'epub', 'md', 'pdf', 'cbz', 'txt'].map((fmt) => (
            <button
              key={fmt}
              onClick={() => setSelectedFormat(fmt)}
              className={`px-2.5 py-1 rounded text-xs uppercase font-mono transition-colors duration-100 cursor-pointer ${
                selectedFormat === fmt
                  ? 'bg-[#509475] text-[#0c1512] font-semibold'
                  : 'bg-[#111c18] text-[#81B8A8] border border-[#509475]/20 hover:border-[#509475]/40'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>

        {/* Refresh & Library Info */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#53685B] font-mono">
            {filteredBooks.length}/{books.length} tài liệu
          </span>
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Quét lại thư mục sách"
            className="p-1.5 rounded-lg text-[#81B8A8] hover:text-[#F7E8B2] hover:bg-[#509475]/20 border border-[#509475]/30 transition-colors duration-100 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Books Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        {books.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-[#509475]/10 border border-[#509475]/30 flex items-center justify-center text-[#509475] mb-4">
              <FolderOpen className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-[#F7E8B2] mb-1">Chưa có tài liệu nào trong thư viện</h3>
            <p className="text-xs text-[#81B8A8] max-w-sm leading-relaxed mb-4">
              Bạn có thể kéo thả tài liệu vào màn hình hoặc sao chép vào thư mục <strong className="text-[#509475] font-mono">{settings.local_library_dir}</strong>.
            </p>
            <button
              onClick={onRefresh}
              className="px-4 py-2 rounded-lg bg-[#509475] text-[#0c1512] font-semibold text-xs hover:bg-[#63b07a] transition-colors duration-100 cursor-pointer"
            >
              Quét lại thư viện
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                isSyncing={syncingId === book.id}
                onOpen={onOpenBook}
                onEdit={onEditBook}
                onSync={handleSyncBook}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
