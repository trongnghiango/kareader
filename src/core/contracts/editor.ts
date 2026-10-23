/**
 * Kareader - Core Editor Plugin Contracts
 * Microkernel / Ports & Adapters Architecture
 */

import { EditorDocument } from '../../types';

export interface EditorStats {
  wordCount: number;
  charCount: number;
  readingTimeMinutes: number;
}

export interface IEditorContext {
  /** Get current document metadata */
  getDocument(): EditorDocument;
  /** Get real-time content from the unmanaged text buffer */
  getText(): string;
  /** Programmatically set editor text */
  setText(text: string): void;
  /** Mark document dirty status */
  setDirty(dirty: boolean): void;
  /** Trigger document save */
  save(): Promise<string>;
  /** Register a keyboard shortcut */
  registerShortcut(keyCombo: string, handler: (e: KeyboardEvent) => void): () => void;
  /** Trigger toast notification */
  notify(msg: string, type?: 'success' | 'error'): void;
}

/**
 * Standard interface for extending Editor capabilities
 * Zero-leak lifecycle: init -> onDocChange -> onDestroy
 */
export interface IEditorPlugin {
  readonly id: string;
  readonly name: string;
  readonly version?: string;

  /** Initialize plugin with editor execution context */
  init(context: IEditorContext): void | Promise<void>;

  /** Optional reactive hook when document text changes */
  onDocChange?(text: string): void;

  /** Optional hook before document save */
  beforeSave?(): void | Promise<void>;

  /** Optional hook after document save */
  afterSave?(savedPath: string): void;

  /** Destroy plugin and release all timers, listeners and memory */
  onDestroy(): void;
}
