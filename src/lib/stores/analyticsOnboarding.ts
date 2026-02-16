import { writable } from 'svelte/store';

/**
 * True when analytics page is loading or syncing (background task in progress).
 * Used by Onboarding to show "Hold on, crunching the numbers" instead of the normal tooltip.
 */
export const analyticsCrunching = writable(false);
