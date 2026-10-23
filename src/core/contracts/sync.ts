/**
 * Kareader - Core Sync Adapter Contracts
 * Infinite Wireless Sync Extensibility (KOReader SFTP, Kindle Email, WebDAV...)
 */

import { TransferResult } from '../../types';

export type { TransferResult };

export interface DeviceStatus {
  connected: boolean;
  deviceName?: string;
  ipAddress?: string;
  storageFreeBytes?: number;
  lastSyncTimestamp?: number;
  message?: string;
}

/**
 * Standard Adapter Contract for wireless synchronization targets
 */
export interface ISyncAdapter {
  /** Unique adapter identifier (e.g. 'koreader-sftp', 'kindle-email', 'webdav') */
  readonly id: string;

  /** Display label */
  readonly label: string;

  /** Test connectivity to target device or server */
  testConnection(): Promise<boolean>;

  /** Push local document to remote directory */
  pushFile(localPath: string, remoteDir?: string): Promise<TransferResult>;

  /** Query remote target status */
  pullStatus(): Promise<DeviceStatus>;

  /** Optional dispose cleanup */
  dispose?(): void;
}
