/**
 * Auto-Save Plugin
 * Periodically saves dirty document directly to disk without UI disruption
 */

import { IEditorPlugin, IEditorContext } from '../contracts/editor';

export class AutoSavePlugin implements IEditorPlugin {
  readonly id = 'auto-save';
  readonly name = 'Background Auto Save';

  private context: IEditorContext | null = null;
  private intervalTimer: any = null;
  private saveIntervalMs: number;

  constructor(saveIntervalMs = 60000) {
    this.saveIntervalMs = saveIntervalMs;
  }

  init(context: IEditorContext): void {
    this.context = context;
    this.intervalTimer = setInterval(async () => {
      const doc = this.context?.getDocument();
      if (doc && doc.isDirty) {
        try {
          await this.context?.save();
        } catch {
          // Passive failover
        }
      }
    }, this.saveIntervalMs);
  }

  onDestroy(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.context = null;
  }
}
