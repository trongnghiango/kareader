import React from 'react';
import { EditorDocument } from '../types';
import { CodeMirrorEditor } from './editor/CodeMirrorEditor';

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
  return (
    <div
      className="w-full h-full bg-[#111c18] overflow-hidden flex justify-center relative select-text box-border"
    >
      {/* Centered Zen Writing Column: 780-800px standard without scrollbars */}
      <div className="w-full max-w-[800px] h-full px-8 pt-16 pb-20 flex flex-col box-border">
        <CodeMirrorEditor
          initialDoc={doc.content}
          docPath={doc.path}
          docFilename={doc.filename}
          currentFont={currentFont}
          fontSize={fontSize}
          onDocChangeDirty={onDocChangeDirty}
          onStatsChange={onStatsChange}
          onSaveShortcut={onSaveShortcut}
          onOpenLibrary={onOpenLibrary}
          editorRef={editorRef}
        />
      </div>
    </div>
  );
});
