export interface BookMetadata {
  id: string;
  path: string;
  filename: string;
  title: string;
  author: string;
  description: string;
  format: string;
  size_bytes: number;
  cover_data_url?: string | null;
}

export interface AppSettings {
  kindle_ip: string;
  kindle_port: number;
  kindle_user: string;
  kindle_password?: string;
  remote_books_dir: string;
  local_library_dir: string;
  editor_font?: string;
}

export interface OmarchyTheme {
  background: string;
  foreground: string;
  accent: string;
  muted: string;
  dark_background: string;
  lighter_background: string;
  mode: string;
}

export interface TransferResult {
  success: boolean;
  filename: string;
  bytes_sent: number;
  message: string;
}

export interface ReaderTocItem {
  title: string;
  chapter_index: number;
}

export interface ReaderSession {
  path: string;
  filename: string;
  title: string;
  author: string;
  format: string;
  total_chapters: number;
  current_chapter: number;
  toc: ReaderTocItem[];
  chapter_html: string;
  raw_text?: string | null;
}

export interface ReaderChapter {
  chapter_index: number;
  title: string;
  html: string;
}

export interface EditorDocument {
  path?: string | null;
  filename: string;
  content: string;
  author?: string;
  isDirty?: boolean;
}
