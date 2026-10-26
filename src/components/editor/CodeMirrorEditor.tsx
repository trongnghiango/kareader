import React, { useEffect, useRef, useCallback } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { history } from '@codemirror/commands';
import { createOmarchyTheme, omarchyMarkdownHighlighting } from './extensions/theme';
import { markdownLineDecorations } from './extensions/lineDecorations';
import { createEditorKeymaps } from './extensions/keymaps';
import { EditorViewRef } from '../EditorView';

interface CodeMirrorEditorProps {
  initialDoc: string;
  docPath?: string | null;
  docFilename?: string;
  currentFont: string;
  fontSize: number;
  onDocChangeDirty: (dirty: boolean) => void;
  onStatsChange: (stats: { wordCount: number; charCount: number; readingTimeMinutes: number }) => void;
  onSaveShortcut: () => void;
  onOpenLibrary?: () => void;
  editorRef?: React.MutableRefObject<EditorViewRef | null>;
}

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = React.memo(({
  initialDoc,
  docPath,
  docFilename,
  currentFont,
  fontSize,
  onDocChangeDirty,
  onStatsChange,
  onSaveShortcut,
  onOpenLibrary,
  editorRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const currentPathRef = useRef<string | null>(docPath || null);
  const currentFilenameRef = useRef<string | null>(docFilename || null);
  const isDirtyRef = useRef<boolean>(false);
  const statsTimerRef = useRef<any>(null);

  const themeCompartmentRef = useRef(new Compartment());
  const keymapCompartmentRef = useRef(new Compartment());

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

  // Handle save shortcut wrapper that clears dirty flag
  const handleSave = useCallback(() => {
    onSaveShortcut();
    isDirtyRef.current = false;
  }, [onSaveShortcut]);

  // Expose API to parent ref
  useEffect(() => {
    if (editorRef) {
      editorRef.current = {
        getCurrentText: () => {
          return viewRef.current ? viewRef.current.state.doc.toString() : initialDoc;
        },
        focus: () => {
          viewRef.current?.focus();
        },
        clear: () => {
          if (viewRef.current) {
            viewRef.current.dispatch({
              changes: { from: 0, to: viewRef.current.state.doc.length, insert: '' },
            });
            isDirtyRef.current = true;
            onDocChangeDirty(true);
            updateStats('');
          }
        },
        setText: (newText: string) => {
          if (viewRef.current) {
            viewRef.current.dispatch({
              changes: { from: 0, to: viewRef.current.state.doc.length, insert: newText },
            });
            updateStats(newText);
          }
        },
      };
    }
  }, [editorRef, initialDoc, onDocChangeDirty, updateStats]);

  // Initialize CodeMirror instance once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    currentPathRef.current = docPath || null;
    isDirtyRef.current = false;

    const state = EditorState.create({
      doc: initialDoc,
      extensions: [
        // Markdown parser with CommonMark and GFM compliance
        markdown(),

        // Line wrapping for zen writing
        EditorView.lineWrapping,

        // Undo / Redo history
        history(),

        // Live styling line decorations (blockquote borders, codeblocks, divider lines)
        markdownLineDecorations,

        // Syntax highlighting for headings, bold, italic, code, quotes, lists
        omarchyMarkdownHighlighting,

        // Theme compartment for dynamic font and font-size reconfiguration
        themeCompartmentRef.current.of(createOmarchyTheme(safeFontFamily, fontSize)),

        // Keymaps compartment (Tab, Ctrl+S, F2, history)
        keymapCompartmentRef.current.of(
          createEditorKeymaps({
            onSaveShortcut: handleSave,
            onOpenLibrary,
          })
        ),

        // Document change and IME listener
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            if (!isDirtyRef.current) {
              isDirtyRef.current = true;
              requestAnimationFrame(() => {
                onDocChangeDirty(true);
              });
            }

            if (statsTimerRef.current) {
              clearTimeout(statsTimerRef.current);
            }
            statsTimerRef.current = setTimeout(() => {
              if (viewRef.current && !viewRef.current.composing) {
                updateStats(viewRef.current.state.doc.toString());
              }
            }, 500);
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    updateStats(initialDoc);

    const timer = setTimeout(() => {
      view.focus();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (statsTimerRef.current) {
        clearTimeout(statsTimerRef.current);
      }
      view.destroy();
      viewRef.current = null;
    };
  }, []); // Run once on mount

  // Synchronize when document path or filename changes (e.g. opened new file from Library or created new doc)
  useEffect(() => {
    const pathChanged = docPath !== currentPathRef.current;
    const filenameChanged = !docPath && docFilename !== currentFilenameRef.current;

    if ((pathChanged || filenameChanged) && viewRef.current) {
      currentPathRef.current = docPath || null;
      currentFilenameRef.current = docFilename || null;
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: initialDoc },
      });
      isDirtyRef.current = false;
      updateStats(initialDoc);
      viewRef.current.focus();
    }
  }, [docPath, docFilename, initialDoc, updateStats]);

  // Dynamically reconfigure font and font-size without resetting editor state
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: themeCompartmentRef.current.reconfigure(
          createOmarchyTheme(safeFontFamily, fontSize)
        ),
      });
    }
  }, [safeFontFamily, fontSize]);

  // Dynamically reconfigure keymaps if callbacks change
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: keymapCompartmentRef.current.reconfigure(
          createEditorKeymaps({
            onSaveShortcut: handleSave,
            onOpenLibrary,
          })
        ),
      });
    }
  }, [handleSave, onOpenLibrary]);

  return (
    <div
      ref={containerRef}
      onClick={() => viewRef.current?.focus()}
      className="w-full h-full cursor-text"
    />
  );
});
