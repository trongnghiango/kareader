/**
 * Kareader - Theme Manager
 * Implements IThemeContract for centralized CSS variable control with zero reflow
 */

import { invoke } from '@tauri-apps/api/core';
import { IThemeContract, OmarchyThemeVariables } from '../contracts/theme';
import { OmarchyTheme } from '../../types';

export class ThemeManager implements IThemeContract {
  private _currentTheme = 'omarchy-zen';
  private listeners = new Set<(theme: OmarchyThemeVariables) => void>();

  private activeVariables: OmarchyThemeVariables = {
    '--bg': '#111c18',
    '--bg-dark': '#0c1512',
    '--bg-lighter': '#1d2e27',
    '--fg': '#C1C497',
    '--accent': '#509475',
    '--muted': '#53685B',
    '--font': 'JetBrainsMono Nerd Font',
  };

  get currentTheme(): string {
    return this._currentTheme;
  }

  applyTheme(variables: Partial<OmarchyThemeVariables>): void {
    const root = document.documentElement;
    this.activeVariables = { ...this.activeVariables, ...variables };

    for (const [key, value] of Object.entries(variables)) {
      if (value) {
        root.style.setProperty(key, value);
      }
    }

    for (const listener of this.listeners) {
      listener(this.activeVariables);
    }
  }

  async loadSystemTheme(): Promise<void> {
    try {
      const theme = await invoke<OmarchyTheme>('load_omarchy_theme');
      this.applyTheme({
        '--bg': theme.background,
        '--bg-dark': theme.dark_background,
        '--bg-lighter': theme.lighter_background,
        '--fg': theme.foreground,
        '--accent': theme.accent,
        '--muted': theme.muted,
      });
    } catch {
      // Keep defaults
    }
  }

  registerThemeListener(listener: (theme: OmarchyThemeVariables) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.listeners.clear();
  }
}

export const defaultThemeManager = new ThemeManager();
