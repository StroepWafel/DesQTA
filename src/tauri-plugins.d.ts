/**
 * Ambient type declarations for Tauri plugins.
 * These packages may not resolve during svelte-check (e.g. when not in Tauri context)
 * but are available at runtime when running in Tauri.
 */

declare module '@choochmeque/tauri-plugin-biometry-api' {
  export interface BiometryStatus {
    isAvailable: boolean;
    biometryType?: number;
    error?: string | null;
    errorCode?: string;
  }

  export interface AuthOptions {
    allowDeviceCredential?: boolean;
    cancelTitle?: string;
    fallbackTitle?: string;
    title?: string;
    subtitle?: string;
    confirmationRequired?: boolean;
    maxAttempts?: number;
  }

  export function checkStatus(): Promise<BiometryStatus>;
  export function authenticate(reason: string, options?: AuthOptions): Promise<void>;
}

declare module '@saurl/tauri-plugin-safe-area-insets-css-api' {
  // Dynamic import only - no exports needed at type level
}
