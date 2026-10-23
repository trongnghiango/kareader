/**
 * Zero-Leak Lifecycle & Resource Management
 * Automatically disposes listeners, timers, subscriptions and blob URLs
 */

export interface IDisposable {
  dispose(): void;
}

export type DisposableFunction = () => void;

export class DisposableStore implements IDisposable {
  private disposables = new Set<IDisposable | DisposableFunction>();
  private isDisposed = false;

  public add<T extends IDisposable | DisposableFunction>(d: T): T {
    if (this.isDisposed) {
      if (typeof d === 'function') d();
      else d.dispose();
      return d;
    }
    this.disposables.add(d);
    return d;
  }

  public registerTimer(timerId: any): void {
    this.add(() => {
      clearTimeout(timerId);
      clearInterval(timerId);
    });
  }

  public registerEventListener(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    target.addEventListener(type, listener, options);
    this.add(() => target.removeEventListener(type, listener, options));
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    for (const d of this.disposables) {
      try {
        if (typeof d === 'function') {
          d();
        } else {
          d.dispose();
        }
      } catch (e) {
        console.error('Error disposing resource:', e);
      }
    }
    this.disposables.clear();
  }
}
