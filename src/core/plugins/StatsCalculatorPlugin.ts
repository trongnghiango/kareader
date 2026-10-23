/**
 * Passive Stats Calculator Plugin
 * Computes words, characters, and reading time in O(1) time without blocking input
 */

import { IEditorPlugin, IEditorContext, EditorStats } from '../contracts/editor';

export class StatsCalculatorPlugin implements IEditorPlugin {
  readonly id = 'stats-calculator';
  readonly name = 'Document Statistics Calculator';

  private timer: any = null;
  private onStatsComputed?: (stats: EditorStats) => void;

  constructor(onStatsComputed?: (stats: EditorStats) => void) {
    this.onStatsComputed = onStatsComputed;
  }

  init(context: IEditorContext): void {
    const text = context.getText();
    this.calculate(text);
  }

  onDocChange(text: string): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.calculate(text);
    }, 500);
  }

  private calculate(text: string): void {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    const readingTimeMinutes = Math.max(1, Math.ceil(words / 220));

    if (this.onStatsComputed) {
      this.onStatsComputed({
        wordCount: words,
        charCount: chars,
        readingTimeMinutes,
      });
    }
  }

  onDestroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
