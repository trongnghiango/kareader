/**
 * Kareader - Core Theme & Aesthetic Contracts
 * Centralized Omarchy CSS Variables Management (Zero-Reflow Switch)
 */

export interface OmarchyThemeVariables {
  '--bg': string;
  '--bg-dark': string;
  '--bg-lighter': string;
  '--fg': string;
  '--accent': string;
  '--muted': string;
  '--font': string;
}

export interface IThemeContract {
  /** Active theme key (e.g. 'omarchy-dark', 'sepia', 'solarized', 'nord') */
  readonly currentTheme: string;

  /** Apply CSS variables directly to root DOM without layout reflow */
  applyTheme(variables: Partial<OmarchyThemeVariables>): void;

  /** Load system-wide theme from Omarchy environment */
  loadSystemTheme(): Promise<void>;

  /** Subscribe to theme changes */
  registerThemeListener(listener: (theme: OmarchyThemeVariables) => void): () => void;
}
