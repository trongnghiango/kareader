import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';

/**
 * ViewPlugin that decorates lines in the visible viewport based on Markdown AST:
 * - Blockquote lines get a vertical accent border and soft tint.
 * - Code block lines get dark background and distinct border.
 * - Horizontal rule lines get bottom divider.
 * 
 * Only evaluates the visible viewport, maintaining O(1) performance regardless of doc size.
 */
export const markdownLineDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      const doc = view.state.doc;
      const decoratedLines = new Map<number, string>();

      for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from,
          to,
          enter(node) {
            if (node.name === 'Blockquote') {
              const startLine = doc.lineAt(node.from).number;
              const endLine = doc.lineAt(node.to).number;
              for (let l = startLine; l <= endLine; l++) {
                const linePos = doc.line(l).from;
                const prev = decoratedLines.get(linePos) || '';
                if (!prev.includes('cm-blockquote-line')) {
                  decoratedLines.set(linePos, (prev + ' cm-blockquote-line').trim());
                }
              }
            } else if (node.name === 'FencedCode') {
              const startLine = doc.lineAt(node.from).number;
              const endLine = doc.lineAt(node.to).number;
              for (let l = startLine; l <= endLine; l++) {
                const linePos = doc.line(l).from;
                const prev = decoratedLines.get(linePos) || '';
                if (!prev.includes('cm-codeblock-line')) {
                  decoratedLines.set(linePos, (prev + ' cm-codeblock-line').trim());
                }
              }
            } else if (node.name === 'HorizontalRule') {
              const linePos = doc.lineAt(node.from).from;
              const prev = decoratedLines.get(linePos) || '';
              if (!prev.includes('cm-hr-line')) {
                decoratedLines.set(linePos, (prev + ' cm-hr-line').trim());
              }
            }
          },
        });
      }

      const sortedPositions = Array.from(decoratedLines.keys()).sort((a, b) => a - b);
      for (const pos of sortedPositions) {
        const cls = decoratedLines.get(pos)!;
        builder.add(pos, pos, Decoration.line({ attributes: { class: cls } }));
      }

      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
