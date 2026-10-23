/**
 * Kareader - Reader Drivers & Registry
 * Extensible Drivers for EPUB, CBZ, Markdown, TXT, PDF
 */

import { invoke } from '@tauri-apps/api/core';
import { IReaderDriver, ReaderChapter, ReaderSession } from '../contracts/reader';

export class EpubDriver implements IReaderDriver {
  readonly id = 'epub-driver';
  readonly name = 'EPUB Ebook Driver';
  readonly supportedExtensions = ['epub'];

  private activeFilePath: string | null = null;

  canHandle(ext: string): boolean {
    return this.supportedExtensions.includes(ext.toLowerCase());
  }

  async open(filePath: string): Promise<ReaderSession> {
    this.activeFilePath = filePath;
    return await invoke<ReaderSession>('open_book_reader', { path: filePath });
  }

  async getChapter(index: number): Promise<ReaderChapter> {
    if (!this.activeFilePath) throw new Error('No open book in EpubDriver');
    return await invoke<ReaderChapter>('get_book_chapter', {
      path: this.activeFilePath,
      chapterIndex: index,
    });
  }

  dispose(): void {
    this.activeFilePath = null;
  }
}

export class CbzDriver implements IReaderDriver {
  readonly id = 'cbz-driver';
  readonly name = 'Comic Book CBZ Driver';
  readonly supportedExtensions = ['cbz'];

  private activeFilePath: string | null = null;

  canHandle(ext: string): boolean {
    return this.supportedExtensions.includes(ext.toLowerCase());
  }

  async open(filePath: string): Promise<ReaderSession> {
    this.activeFilePath = filePath;
    return await invoke<ReaderSession>('open_book_reader', { path: filePath });
  }

  async getChapter(index: number): Promise<ReaderChapter> {
    if (!this.activeFilePath) throw new Error('No open book in CbzDriver');
    return await invoke<ReaderChapter>('get_book_chapter', {
      path: this.activeFilePath,
      chapterIndex: index,
    });
  }

  dispose(): void {
    this.activeFilePath = null;
  }
}

export class MarkdownDriver implements IReaderDriver {
  readonly id = 'markdown-driver';
  readonly name = 'Markdown Zen Driver';
  readonly supportedExtensions = ['md', 'markdown'];

  private activeFilePath: string | null = null;

  canHandle(ext: string): boolean {
    return this.supportedExtensions.includes(ext.toLowerCase());
  }

  async open(filePath: string): Promise<ReaderSession> {
    this.activeFilePath = filePath;
    return await invoke<ReaderSession>('open_book_reader', { path: filePath });
  }

  async getChapter(index: number): Promise<ReaderChapter> {
    if (!this.activeFilePath) throw new Error('No open book in MarkdownDriver');
    return await invoke<ReaderChapter>('get_book_chapter', {
      path: this.activeFilePath,
      chapterIndex: index,
    });
  }

  dispose(): void {
    this.activeFilePath = null;
  }
}

export class TextDriver implements IReaderDriver {
  readonly id = 'text-driver';
  readonly name = 'Plain Text Driver';
  readonly supportedExtensions = ['txt'];

  private activeFilePath: string | null = null;

  canHandle(ext: string): boolean {
    return this.supportedExtensions.includes(ext.toLowerCase());
  }

  async open(filePath: string): Promise<ReaderSession> {
    this.activeFilePath = filePath;
    return await invoke<ReaderSession>('open_book_reader', { path: filePath });
  }

  async getChapter(index: number): Promise<ReaderChapter> {
    if (!this.activeFilePath) throw new Error('No open book in TextDriver');
    return await invoke<ReaderChapter>('get_book_chapter', {
      path: this.activeFilePath,
      chapterIndex: index,
    });
  }

  dispose(): void {
    this.activeFilePath = null;
  }
}

export class PdfDriver implements IReaderDriver {
  readonly id = 'pdf-driver';
  readonly name = 'PDF Document Driver';
  readonly supportedExtensions = ['pdf'];

  private activeFilePath: string | null = null;

  canHandle(ext: string): boolean {
    return this.supportedExtensions.includes(ext.toLowerCase());
  }

  async open(filePath: string): Promise<ReaderSession> {
    this.activeFilePath = filePath;
    return await invoke<ReaderSession>('open_book_reader', { path: filePath });
  }

  async getChapter(index: number): Promise<ReaderChapter> {
    if (!this.activeFilePath) throw new Error('No open book in PdfDriver');
    return await invoke<ReaderChapter>('get_book_chapter', {
      path: this.activeFilePath,
      chapterIndex: index,
    });
  }

  dispose(): void {
    this.activeFilePath = null;
  }
}

/**
 * Central Reader Driver Registry
 * Delegates open() dynamically to the matching registered driver
 */
export class ReaderDriverRegistry {
  private drivers = new Map<string, IReaderDriver>();
  private activeDriver: IReaderDriver | null = null;

  constructor() {
    // Register standard built-in drivers
    this.register(new EpubDriver());
    this.register(new CbzDriver());
    this.register(new MarkdownDriver());
    this.register(new TextDriver());
    this.register(new PdfDriver());
  }

  public register(driver: IReaderDriver): void {
    this.drivers.set(driver.id, driver);
  }

  public getDriverForFile(filePath: string): IReaderDriver | null {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    for (const driver of this.drivers.values()) {
      if (driver.canHandle(ext)) {
        return driver;
      }
    }
    return null;
  }

  public async openBook(filePath: string): Promise<{ session: ReaderSession; driver: IReaderDriver }> {
    if (this.activeDriver) {
      this.activeDriver.dispose();
      this.activeDriver = null;
    }

    const driver = this.getDriverForFile(filePath);
    if (!driver) {
      throw new Error(`Không tìm thấy driver đọc tệp phù hợp cho: ${filePath}`);
    }

    const session = await driver.open(filePath);
    this.activeDriver = driver;
    return { session, driver };
  }

  public dispose(): void {
    if (this.activeDriver) {
      this.activeDriver.dispose();
      this.activeDriver = null;
    }
    for (const driver of this.drivers.values()) {
      driver.dispose();
    }
  }
}

export const defaultReaderRegistry = new ReaderDriverRegistry();
