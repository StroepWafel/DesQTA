import { register, init, getLocaleFromNavigator, locale } from 'svelte-i18n';

// Register locales
register('en', () => import('./locales/en.json'));
register('es', () => import('./locales/es.json'));
register('fr', () => import('./locales/fr.json'));
register('de', () => import('./locales/de.json'));
register('zh', () => import('./locales/zh.json'));
register('ja', () => import('./locales/ja.json'));
register('en-pirate', () => import('./locales/en-pirate.json'));

// Initialize i18n
export function initI18n() {
  return init({
    fallbackLocale: 'en',
    initialLocale: getLocaleFromNavigator() || 'en',
    loadingDelay: 200,
  });
}

// Export the locale store and utilities
export { locale, _ } from 'svelte-i18n';

// Available locales for language selection
export const availableLocales = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'en-pirate', name: 'English Pirate', flag: '🏴‍☠️' },
];

// Helper to get current locale info
export function getCurrentLocaleInfo() {
  let currentLocale: string;
  const unsubscribe = locale.subscribe(value => {
    currentLocale = value || 'en';
  });
  unsubscribe();
  
  return availableLocales.find(l => l.code === currentLocale) || availableLocales[0];
}
