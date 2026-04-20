/**
 * Installs dev-only performance instrumentation when running `tauri dev`.
 *
 * Must be called synchronously during the root layout's initialisation (top-level
 * script), not from async onMount — SvelteKit's beforeNavigate/afterNavigate register
 * via onMount and require a component init frame.
 */

import { tick } from 'svelte';
import { browser } from '$app/environment';
import { beforeNavigate, afterNavigate } from '$app/navigation';
import { isDevTauriPerformance } from './devTauriContext';
import { initMetricsTracker, sessionMetrics, benchmarkHistory, downloadMetrics, exportMetrics } from './services/metricsTracker';
import { recordStartupPhase, enableLongTaskDetection, startRouteTransition, endRouteTransition } from './hooks';
import { logger } from '../../utils/logger';

export type DevPerfGlobal = {
	sessionMetrics: typeof sessionMetrics;
	benchmarkHistory: typeof benchmarkHistory;
	downloadMetrics: typeof downloadMetrics;
	exportMetrics: typeof exportMetrics;
	recordStartupPhase: typeof recordStartupPhase;
};

declare global {
	interface Window {
		__DESQTA_DEV_PERF__?: DevPerfGlobal;
	}
}

let installed = false;
let cleanupLongTasks: (() => void) | undefined;

export function installDevTauriPerformanceRuntime(): void {
	if (!browser || !isDevTauriPerformance() || installed) return;
	installed = true;

	initMetricsTracker();
	recordStartupPhase('app_start');

	beforeNavigate(({ to }) => {
		if (to?.url?.pathname) {
			startRouteTransition(to.url.pathname);
		}
	});

	afterNavigate(({ to }) => {
		tick().then(() => {
			endRouteTransition(to?.url.pathname);
		});
	});

	cleanupLongTasks = enableLongTaskDetection(50);

	const api: DevPerfGlobal = {
		sessionMetrics,
		benchmarkHistory,
		downloadMetrics,
		exportMetrics,
		recordStartupPhase,
	};
	window.__DESQTA_DEV_PERF__ = api;

	logger.info('performance', 'devTauriRuntime', 'Dev Tauri performance runtime installed');
}

export function teardownDevTauriPerformanceRuntime(): void {
	if (!installed) return;
	installed = false;
	cleanupLongTasks?.();
	cleanupLongTasks = undefined;
	delete window.__DESQTA_DEV_PERF__;
}
