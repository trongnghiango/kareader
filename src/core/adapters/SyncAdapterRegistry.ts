/**
 * Kareader - Sync Adapters & Registry
 * Ports & Adapters for KOReader SFTP, Kindle, WebDAV
 */

import { invoke } from '@tauri-apps/api/core';
import { ISyncAdapter, DeviceStatus, TransferResult } from '../contracts/sync';
import { AppSettings } from '../../types';

export class KOReaderSftpAdapter implements ISyncAdapter {
  readonly id = 'koreader-sftp';
  readonly label = 'Kindle KOReader (Wi-Fi SFTP)';

  private settings: AppSettings;

  constructor(settings: AppSettings) {
    this.settings = settings;
  }

  public updateSettings(settings: AppSettings): void {
    this.settings = settings;
  }

  async testConnection(): Promise<boolean> {
    try {
      await invoke<string>('test_kindle_connection', {
        ip: this.settings.kindle_ip,
        port: this.settings.kindle_port,
        user: this.settings.kindle_user || 'root',
        password: this.settings.kindle_password || '',
      });
      return true;
    } catch {
      return false;
    }
  }

  async pushFile(localPath: string, remoteDir?: string): Promise<TransferResult> {
    return await invoke<TransferResult>('send_book_to_kindle', {
      ip: this.settings.kindle_ip,
      port: this.settings.kindle_port,
      user: this.settings.kindle_user || 'root',
      password: this.settings.kindle_password || '',
      remoteDir: remoteDir || this.settings.remote_books_dir,
      localPath,
    });
  }

  async pushMarkdown(
    title: string,
    author: string,
    content: string,
    asEpub: boolean
  ): Promise<TransferResult> {
    return await invoke<TransferResult>('send_markdown_to_kindle', {
      ip: this.settings.kindle_ip,
      port: this.settings.kindle_port,
      user: this.settings.kindle_user || 'root',
      password: this.settings.kindle_password || '',
      remoteDir: this.settings.remote_books_dir,
      title,
      author,
      content,
      asEpub,
    });
  }

  async pullStatus(): Promise<DeviceStatus> {
    const isOnline = await this.testConnection();
    return {
      connected: isOnline,
      deviceName: 'Kindle KOReader',
      ipAddress: this.settings.kindle_ip,
      message: isOnline ? 'Đã kết nối qua Wi-Fi SFTP' : 'Ngoại tuyến',
      lastSyncTimestamp: Date.now(),
    };
  }

  dispose(): void {
    // Zero-leak cleanup
  }
}

export class WebDavAdapter implements ISyncAdapter {
  readonly id = 'webdav';
  readonly label = 'WebDAV Cloud Storage';

  async testConnection(): Promise<boolean> {
    // Extensible stub for future WebDAV cloud sync
    return false;
  }

  async pushFile(_localPath: string, _remoteDir?: string): Promise<TransferResult> {
    return {
      success: false,
      filename: '',
      bytes_sent: 0,
      message: 'WebDAV adapter chưa được kích hoạt',
    };
  }

  async pullStatus(): Promise<DeviceStatus> {
    return {
      connected: false,
      deviceName: 'WebDAV Server',
      message: 'Chưa cấu hình',
    };
  }
}

export class SyncAdapterRegistry {
  private adapters = new Map<string, ISyncAdapter>();
  private activeAdapterId = 'koreader-sftp';

  constructor(settings: AppSettings) {
    this.register(new KOReaderSftpAdapter(settings));
    this.register(new WebDavAdapter());
  }

  public register(adapter: ISyncAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  public getActiveAdapter(): ISyncAdapter {
    const adapter = this.adapters.get(this.activeAdapterId);
    if (!adapter) {
      throw new Error(`Active sync adapter not found: ${this.activeAdapterId}`);
    }
    return adapter;
  }

  public setActiveAdapter(id: string): void {
    if (!this.adapters.has(id)) {
      throw new Error(`Unknown sync adapter: ${id}`);
    }
    this.activeAdapterId = id;
  }

  public listAdapters(): { id: string; label: string }[] {
    return Array.from(this.adapters.values()).map((a) => ({
      id: a.id,
      label: a.label,
    }));
  }

  public dispose(): void {
    for (const a of this.adapters.values()) {
      if (a.dispose) a.dispose();
    }
    this.adapters.clear();
  }
}
