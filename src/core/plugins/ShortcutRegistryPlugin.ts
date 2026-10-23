/**
 * Scoped Shortcut Registry Plugin
 * Isolates keyboard shortcuts to active canvas, preventing window/document leaks
 */

import { IEditorPlugin, IEditorContext } from '../contracts/editor';

export class ShortcutRegistryPlugin implements IEditorPlugin {
  readonly id = 'shortcut-registry';
  readonly name = 'Isolated Shortcut Registry';

  private unregisters: (() => void)[] = [];

  init(context: IEditorContext): void {
    // Ctrl+S / Cmd+S save
    const unbindSave = context.registerShortcut('Ctrl+S', (e) => {
      e.preventDefault();
      context.save();
    });
    this.unregisters.push(unbindSave);
  }

  onDestroy(): void {
    for (const unbind of this.unregisters) {
      unbind();
    }
    this.unregisters = [];
  }
}
