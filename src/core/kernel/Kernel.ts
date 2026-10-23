/**
 * Kareader - Core Microkernel Architecture
 * Ports & Adapters Coordinator with Zero Memory Leak guarantees
 */

import { IEditorPlugin, IEditorContext } from '../contracts/editor';
import { defaultReaderRegistry, ReaderDriverRegistry } from '../drivers/ReaderDriverRegistry';
import { SyncAdapterRegistry } from '../adapters/SyncAdapterRegistry';
import { defaultThemeManager, ThemeManager } from '../theme/ThemeManager';
import { DisposableStore } from './DisposableStore';
import { AppSettings } from '../../types';

export class AppKernel {
  private editorPlugins = new Map<string, IEditorPlugin>();
  private readerRegistry: ReaderDriverRegistry;
  private syncRegistry: SyncAdapterRegistry;
  private themeManager: ThemeManager;
  private disposableStore: DisposableStore;

  constructor(settings: AppSettings) {
    this.disposableStore = new DisposableStore();
    this.readerRegistry = defaultReaderRegistry;
    this.syncRegistry = new SyncAdapterRegistry(settings);
    this.themeManager = defaultThemeManager;

    this.disposableStore.add(() => this.readerRegistry.dispose());
    this.disposableStore.add(() => this.syncRegistry.dispose());
    this.disposableStore.add(() => this.themeManager.dispose());
  }

  // --- Plugin Management ---
  public registerEditorPlugin(plugin: IEditorPlugin): void {
    if (this.editorPlugins.has(plugin.id)) {
      this.unregisterEditorPlugin(plugin.id);
    }
    this.editorPlugins.set(plugin.id, plugin);
  }

  public unregisterEditorPlugin(pluginId: string): void {
    const plugin = this.editorPlugins.get(pluginId);
    if (plugin) {
      plugin.onDestroy();
      this.editorPlugins.delete(pluginId);
    }
  }

  public initEditorPlugins(context: IEditorContext): void {
    for (const plugin of this.editorPlugins.values()) {
      try {
        plugin.init(context);
      } catch (err) {
        console.error(`Failed to init plugin ${plugin.id}:`, err);
      }
    }
  }

  public notifyDocChange(text: string): void {
    for (const plugin of this.editorPlugins.values()) {
      if (plugin.onDocChange) {
        try {
          plugin.onDocChange(text);
        } catch (err) {
          console.error(`Error in plugin ${plugin.id}.onDocChange:`, err);
        }
      }
    }
  }

  public destroyEditorPlugins(): void {
    for (const plugin of this.editorPlugins.values()) {
      try {
        plugin.onDestroy();
      } catch (err) {
        console.error(`Error destroying plugin ${plugin.id}:`, err);
      }
    }
    this.editorPlugins.clear();
  }

  // --- Getters ---
  public getReaderRegistry(): ReaderDriverRegistry {
    return this.readerRegistry;
  }

  public getSyncRegistry(): SyncAdapterRegistry {
    return this.syncRegistry;
  }

  public getThemeManager(): ThemeManager {
    return this.themeManager;
  }

  public getDisposables(): DisposableStore {
    return this.disposableStore;
  }

  // --- Complete Shutdown ---
  public destroy(): void {
    this.destroyEditorPlugins();
    this.disposableStore.dispose();
  }
}
