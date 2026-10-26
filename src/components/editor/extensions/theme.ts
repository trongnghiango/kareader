import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/**
 * Creates the base Omarchy visual theme for CodeMirror 6.
 * Configured specifically for zen distraction-free writing.
 */
export function createOmarchyTheme(fontFamily: string, fontSize: number) {
  return EditorView.theme({
    '&': {
      color: '#C1C497',
      backgroundColor: 'transparent',
      fontFamily: fontFamily,
      fontSize: `${fontSize}px`,
      height: '100%',
      width: '100%',
      outline: 'none',
    },
    '.cm-scroller': {
      fontFamily: fontFamily,
      lineHeight: '1.85',
      overflowY: 'auto',
      overflowX: 'hidden',
      height: '100%',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      '&::-webkit-scrollbar': {
        display: 'none',
      },
    },
    '.cm-content': {
      caretColor: '#509475',
      padding: '0',
      minHeight: '100%',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#509475',
      borderLeftWidth: '2.5px',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: '#509475',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(80, 148, 117, 0.35) !important',
      color: '#F7E8B2 !important',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
    },
    '.cm-line': {
      padding: '0',
      lineHeight: '1.85',
    },
    // Line-level styling hooks for markdown blocks
    '.cm-blockquote-line': {
      borderLeft: '3px solid #509475 !important',
      paddingLeft: '14px !important',
      backgroundColor: 'rgba(80, 148, 117, 0.05)',
      borderRadius: '0 4px 4px 0',
    },
    '.cm-codeblock-line': {
      backgroundColor: '#0c1512',
      fontFamily: '"JetBrainsMono Nerd Font", monospace !important',
      borderLeft: '2px solid #233c30',
      paddingLeft: '10px !important',
    },
    '.cm-hr-line': {
      borderBottom: '1px solid #273a31',
      paddingBottom: '4px',
      marginBottom: '4px',
    },
  });
}

/**
 * Lezer syntax highlighting style for Markdown in Omarchy colors.
 * Headings are visually scaled and prominent, raw tokens (#, **, etc.)
 * remain fully editable and visible with subtle muted accent coloring.
 */
export const markdownHighlightStyle = HighlightStyle.define([
  // Headings
  { tag: tags.heading1, fontSize: '1.85em', fontWeight: '700', color: '#F7E8B2' },
  { tag: tags.heading2, fontSize: '1.5em', fontWeight: '700', color: '#EAEAB8' },
  { tag: tags.heading3, fontSize: '1.25em', fontWeight: '600', color: '#DCDCA2' },
  { tag: tags.heading4, fontSize: '1.12em', fontWeight: '600', color: '#CFD19C' },
  { tag: tags.heading5, fontSize: '1.05em', fontWeight: '600', color: '#C1C497' },
  { tag: tags.heading6, fontSize: '1.0em', fontWeight: '600', color: '#A6A97D' },

  // Bold & Italic
  { tag: tags.strong, fontWeight: '700', color: '#FFF3C4' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#E2E6BE' },

  // Markdown syntax marks (#, **, *, `, >, -) are mapped to processingInstruction in Lezer Markdown
  { tag: tags.processingInstruction, color: 'rgba(80, 148, 117, 0.55)', fontWeight: '500' },

  // Inline Code
  {
    tag: tags.monospace,
    fontFamily: '"JetBrainsMono Nerd Font", monospace',
    backgroundColor: 'rgba(80, 148, 117, 0.16)',
    padding: '2px 6px',
    borderRadius: '4px',
    color: '#88D4B0',
  },

  // Quotes
  { tag: tags.quote, color: '#A3BFB0', fontStyle: 'italic' },

  // Links & URLs
  { tag: tags.link, color: '#72B89E', textDecoration: 'underline', textUnderlineOffset: '3px' },
  { tag: tags.url, color: '#53685B' },

  // Lists & Metadata
  { tag: tags.list, color: '#509475', fontWeight: '600' },
  { tag: tags.meta, color: '#53685B' },

  // Code syntax tokens (inside code blocks)
  { tag: tags.keyword, color: '#509475', fontWeight: '600' },
  { tag: tags.string, color: '#C1C497' },
  { tag: tags.number, color: '#E5A967' },
  { tag: tags.comment, color: '#53685B', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#C1C497' },
  { tag: tags.function(tags.variableName), color: '#88D4B0' },
]);

export const omarchyMarkdownHighlighting = syntaxHighlighting(markdownHighlightStyle, { fallback: true });
