/**
 * Kareader - Core Reader Driver Contracts
 * Infinite Format Reader Extensibility (Epub, Cbz, Pdf, Markdown, Txt...)
 */

import { ReaderSession, ReaderChapter } from '../../types';

export type { ReaderSession, ReaderChapter };

/**
 * Standard Driver Contract for infinite document format readers
 * Decoupled Ports & Adapters Architecture
 */
export interface IReaderDriver {
  /** Unique driver identifier (e.g. 'epub-driver', 'cbz-driver', 'markdown-driver') */
  readonly id: string;

  /** Display label for UI */
  readonly name: string;

  /** Supported file extensions in lowercase without dots (e.g. ['epub'], ['cbz', 'zip']) */
  readonly supportedExtensions: string[];

  /** Test if this driver can open the given file extension */
  canHandle(ext: string): boolean;

  /** Open and parse document session */
  open(filePath: string): Promise<ReaderSession>;

  /** Retrieve a specific chapter or page by index */
  getChapter(index: number): Promise<ReaderChapter>;

  /** Clean up resources, revoke Blob URLs, and release file handles */
  dispose(): void;
}
