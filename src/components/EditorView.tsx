import React, { useEffect, useRef, useCallback } from 'react';
import { EditorDocument } from '../types';

export interface EditorViewRef {
  getCurrentText: () => string;
  focus: () => void;
  clear: () => void;
  setText: (text: string) => void;
}

interface EditorViewProps {
  doc: EditorDocument;
  currentFont: string;
  fontSize: number;
  onDocChangeDirty: (dirty: boolean) => void;
  onStatsChange: (stats: { wordCount: number; charCount: number; readingTimeMinutes: number }) => void;
  onSaveShortcut: () => void;
  onOpenLibrary?: () => void;
  editorRef?: React.MutableRefObject<EditorViewRef | null>;
}

export const EditorView: React.FC<EditorViewProps> = React.memo(({
  doc,
  currentFont,
  fontSize,
  onDocChangeDirty,
  onStatsChange,
  onSaveShortcut,
  onOpenLibrary,
  editorRef,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentPathRef = useRef<string | null>(doc.path || null);
  const isDirtyRef = useRef<boolean>(false);
  const isComposingRef = useRef<boolean>(false);
  const statsTimerRef = useRef<any>(null);

  // Safe fallback font stack prioritizing JetBrainsMono Nerd Font, strictly excluding icon fonts
  const cleanFont = currentFont && currentFont.toLowerCase() !== 'omarchy' ? currentFont : 'JetBrainsMono Nerd Font';
  const safeFontFamily = `"${cleanFont}", "JetBrainsMono Nerd Font", monospace`;

  // Compute stats passively without blocking main thread
  const updateStats = useCallback((text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    const readingTime = Math.max(1, Math.ceil(words / 220));
    onStatsChange({
      wordCount: words,
      charCount: chars,
      readingTimeMinutes: readingTime,
    });
  }, [onStatsChange]);

  // Expose methods to parent ref
  useEffect(() => {
    if (editorRef) {
      editorRef.current = {
        getCurrentText: () => {
          return textareaRef.current ? textareaRef.current.value : doc.content;
        },
        focus: () => {
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        },
        clear: () => {
          if (textareaRef.current) {
            textareaRef.current.value = "";
            isDirtyRef.current = true;
            onDocChangeDirty(true);
            updateStats("");
          }
        },
        setText: (newText: string) => {
          if (textareaRef.current) {
            textareaRef.current.value = newText;
            updateStats(newText);
          }
        }
      };
    }
  }, [editorRef, doc.content, onDocChangeDirty, updateStats]);

  // Initialize once on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.value = doc.content;
      currentPathRef.current = doc.path || null;
      isDirtyRef.current = false;
      updateStats(doc.content);
      textareaRef.current.focus();
    }
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Synchronize ONLY when external document path changes (e.g. opened file from Library)
  useEffect(() => {
    if (doc.path !== currentPathRef.current) {
      currentPathRef.current = doc.path || null;
      if (textareaRef.current) {
        textareaRef.current.value = doc.content;
        isDirtyRef.current = false;
        updateStats(doc.content);
        textareaRef.current.focus();
      }
    }
  }, [doc.path, doc.content, updateStats]);

  // Handle native input event: completely decoupled from synchronous React re-renders
  const handleInput = () => {
    if (!isDirtyRef.current) {
      isDirtyRef.current = true;
      // Defer dirty notification so the current event loop finishes uninterrupted
      requestAnimationFrame(() => {
        onDocChangeDirty(true);
      });
    }

    if (isComposingRef.current) {
      return; // Do not calculate stats while user is composing IME
    }

    if (statsTimerRef.current) {
      clearTimeout(statsTimerRef.current);
    }
    statsTimerRef.current = setTimeout(() => {
      if (textareaRef.current && !isComposingRef.current) {
        updateStats(textareaRef.current.value);
      }
    }, 600);
  };

  // IME Composition handling: protects WebKitGTK input buffer
  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
    handleInput();
  };

  // Handle keyboard shortcuts (Ctrl+S save, Tab indent)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // When composing IME, never intercept any keys
    if (isComposingRef.current || e.nativeEvent.isComposing) {
      return;
    }

    // Ctrl+S / Cmd+S save
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      onSaveShortcut();
      isDirtyRef.current = false;
      return;
    }

    // F2 / Ctrl+O / Alt+L switch to Library
    if (
      e.key === 'F2' ||
      ((e.ctrlKey || e.metaKey) && (e.key === 'o' || e.key === 'O')) ||
      (e.altKey && (e.key === 'l' || e.key === 'L')) ||
      ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L'))
    ) {
      e.preventDefault();
      onOpenLibrary?.();
      return;
    }

    // Tab indent
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      target.value = val.substring(0, start) + '  ' + val.substring(end);
      target.selectionStart = target.selectionEnd = start + 2;
      handleInput();
    }
  };

  return (
    <div
      onClick={() => textareaRef.current?.focus()}
      className="w-full h-full bg-[#111c18] overflow-hidden flex justify-center relative select-text box-border"
    >
      {/* Centered Zen Writing Column: 780-800px standard without scrollbars */}
      <div className="w-full max-w-[800px] h-full px-8 pt-16 pb-20 flex flex-col box-border">
        <textarea
          ref={textareaRef}
          defaultValue={doc.content}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          style={{
            fontFamily: safeFontFamily,
            fontSize: `${fontSize}px`,
            lineHeight: 1.85,
          }}
          placeholder="Bắt đầu viết ở đây..."
          className="w-full h-full flex-1 bg-transparent text-[#C1C497] border-none outline-none resize-none caret-[#509475] selection:bg-[#509475]/35 selection:text-[#F7E8B2] placeholder:text-[#53685B] overflow-y-auto overflow-x-hidden box-border no-scrollbar"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="soft"
          autoFocus
        />
      </div>
    </div>
  );
});
