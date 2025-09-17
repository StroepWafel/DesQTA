import { invoke } from '@tauri-apps/api/core';
import { writable, type Writable } from 'svelte/store';

// Eagerly import all translation JSON files under src/languages/translations
// The files live at src/languages/translations, and this file is at src/lib/services
// so we need to go up two levels
const translationModules = import.meta.glob('../../languages/translations/*.json', {
  eager: true,
}) as Record<string, { default: unknown }>;

// Use English as the canonical type for autocomplete
// eslint-disable-next-line @typescript-eslint/no-var-requires
import eng from '../../languages/translations/eng.json';
export type Translations = typeof eng;

let currentLanguageCode: string | null = null;
let translationsByCode: Record<string, Translations> | null = null;

function computeCodeFromPath(path: string): string {
  const match = path.match(/([^/\\]+)\.json$/);
  return (match?.[1] ?? 'eng').toLowerCase();
}

function asTranslations(obj: unknown): Translations {
  return obj as Translations;
}

    function buildTranslationsIndex(): Record<string, Translations> {
    const index: Record<string, Translations> = {};
  for (const [path, mod] of Object.entries(translationModules)) {
    const code = computeCodeFromPath(path);
    index[code] = asTranslations(mod.default);
  }
  return index;
}

function deepMerge<A extends Record<string, any>, B extends Record<string, any>>(base: A, overrideObj: B): A & B {
  const result: any = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(overrideObj ?? {})) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof (result as any)[key] === 'object' &&
      (result as any)[key] !== null &&
      !Array.isArray((result as any)[key])
    ) {
      (result as any)[key] = deepMerge((result as any)[key], value);
    } else {
      (result as any)[key] = value;
    }
  }
  return result;
}

const tStore: Writable<Translations> = writable(eng);
export const t = tStore;
export const currentLanguage: Writable<string> = writable('eng');

export async function initI18n(): Promise<void> {
  if (!translationsByCode) translationsByCode = buildTranslationsIndex();

  try {
    const subset = await invoke<any>('get_settings_subset', { keys: ['current_language'] });
    currentLanguageCode = (subset?.current_language as string | undefined)?.toLowerCase() ?? 'eng';
  } catch {
    currentLanguageCode = 'eng';
  }

  const all = translationsByCode!;
  const chosen = all[currentLanguageCode] ?? eng;
  // Fallback: ensure all missing keys from eng are present
  const merged = deepMerge(structuredClone(eng), chosen);
  tStore.set(merged);
  currentLanguage.set(currentLanguageCode);
}

export function getCurrentLanguage(): string {
  return currentLanguageCode ?? 'eng';
}

export async function setLanguage(code: string): Promise<void> {
  if (!translationsByCode) translationsByCode = buildTranslationsIndex();
  const normalized = code.toLowerCase();
  const chosen = translationsByCode[normalized] ?? eng;
  const merged = deepMerge(structuredClone(eng), chosen);
  tStore.set(merged);
  currentLanguageCode = normalized;
  currentLanguage.set(normalized);
  // persist setting via merge to avoid overwriting others
  await invoke('save_settings_merge', { patch: { current_language: normalized } });
}

export function getTranslations(): Translations {
  let value: Translations = eng;
  const unsubscribe = tStore.subscribe((v) => (value = v));
  unsubscribe();
  return value;
}


