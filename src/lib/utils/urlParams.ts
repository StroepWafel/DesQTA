import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { get } from 'svelte/store';

/**
 * Get a URL parameter value
 */
export function getUrlParam(key: string): string | null {
  return get(page).url.searchParams.get(key);
}

/**
 * Update a URL parameter, preserving other parameters
 */
export async function updateUrlParam(key: string, value: string | null, options?: { keepFocus?: boolean }) {
  const currentUrl = get(page).url;
  const params = new URLSearchParams(currentUrl.searchParams);
  
  if (value === null || value === '') {
    params.delete(key);
  } else {
    params.set(key, value);
  }
  
  const newUrl = `${currentUrl.pathname}${params.toString() ? `?${params.toString()}` : ''}${currentUrl.hash}`;
  await goto(newUrl, { keepFocus: options?.keepFocus ?? true, noScroll: true });
}

/**
 * Remove a URL parameter
 */
export async function removeUrlParam(key: string) {
  await updateUrlParam(key, null);
}

/**
 * Get multiple URL parameters as an object
 */
export function getUrlParams(keys: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  const currentParams = get(page).url.searchParams;
  
  for (const key of keys) {
    result[key] = currentParams.get(key);
  }
  
  return result;
}

/**
 * Update multiple URL parameters at once
 */
export async function updateUrlParams(params: Record<string, string | null>, options?: { keepFocus?: boolean }) {
  const currentUrl = get(page).url;
  const urlParams = new URLSearchParams(currentUrl.searchParams);
  
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === '') {
      urlParams.delete(key);
    } else {
      urlParams.set(key, value);
    }
  }
  
  const newUrl = `${currentUrl.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ''}${currentUrl.hash}`;
  await goto(newUrl, { keepFocus: options?.keepFocus ?? true, noScroll: true });
}
