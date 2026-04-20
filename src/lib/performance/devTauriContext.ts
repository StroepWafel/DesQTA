/**
 * True only when running `pnpm tauri dev` (Vite dev + Tauri-injected platform).
 * Production builds and plain `pnpm dev` in the browser skip performance instrumentation.
 */
export function isDevTauriPerformance(): boolean {
	return import.meta.env.DEV === true && Boolean(import.meta.env.TAURI_ENV_PLATFORM);
}
