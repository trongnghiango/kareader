import { keymap } from '@codemirror/view';
import { defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands';

interface EditorKeymapOptions {
  onSaveShortcut?: () => void;
  onOpenLibrary?: () => void;
}

export function createEditorKeymaps(options: EditorKeymapOptions) {
  const customKeymaps = [];

  if (options.onSaveShortcut) {
    customKeymaps.push({
      key: 'Mod-s',
      run: () => {
        options.onSaveShortcut?.();
        return true;
      },
    });
  }

  if (options.onOpenLibrary) {
    const handleOpenLibrary = () => {
      options.onOpenLibrary?.();
      return true;
    };

    customKeymaps.push(
      { key: 'F2', run: handleOpenLibrary },
      { key: 'Mod-o', run: handleOpenLibrary },
      { key: 'Alt-l', run: handleOpenLibrary },
      { key: 'Mod-l', run: handleOpenLibrary },
    );
  }

  return keymap.of([
    ...customKeymaps,
    indentWithTab,
    ...defaultKeymap,
    ...historyKeymap,
  ]);
}
